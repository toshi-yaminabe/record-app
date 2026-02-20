import { z } from 'zod'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/prisma.js'
import { decrypt } from '@/lib/crypto.js'
import { logger } from '@/lib/logger.js'
import { GEMINI_API_TIMEOUT_MS } from '@/lib/constants.js'

// Geminiの提案レスポンスのスキーマ
const proposalItemSchema = z.object({
  type: z.enum(['SUMMARY', 'TASK']).default('SUMMARY'),
  title: z.string().min(1).max(500),
  body: z.string().max(5000).default(''),
  bunjinSlug: z.string().max(50).nullable().optional(),
})
const proposalResponseSchema = z.array(proposalItemSchema)

/**
 * Gemini APIクライアントを取得
 * 優先順位: 環境変数 > DB保存キー（userId指定時）
 * @param {string} [userId] - ユーザーID（DB保存キー検索用）
 * @returns {Promise<GoogleGenerativeAI|null>}
 */
async function getGeminiClient(userId) {
  // 1. 環境変数（デプロイ時設定、最優先）
  if (process.env.GEMINI_API_KEY) {
    return new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }

  // 2. DB保存キー（ユーザー設定）
  if (prisma && userId) {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      })
      if (settings?.geminiApiKey) {
        const decryptedKey = decrypt(settings.geminiApiKey)
        if (decryptedKey) {
          return new GoogleGenerativeAI(decryptedKey)
        }
      }
    } catch (error) {
      logger.error('Failed to load Gemini API key from DB', { component: 'gemini', error: error.message })
    }
  }

  return null
}

/**
 * 音声ファイルを文字起こし
 * @param {Buffer} audioBuffer - 音声データ
 * @param {string} mimeType - MIMEタイプ (audio/mp4, audio/mpeg, etc.)
 * @param {string} [userId] - ユーザーID（DB保存キー検索用）
 * @returns {Promise<string>} - 文字起こしテキスト
 */
export async function transcribeAudio(audioBuffer, mimeType = 'audio/mp4', userId) {
  const genAI = await getGeminiClient(userId)
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const base64Audio = audioBuffer.toString('base64')

  // 50秒タイムアウト（clearTimeoutでメモリリークを防止）
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Gemini API timeout (50s)')), GEMINI_API_TIMEOUT_MS)
  })

  const generatePromise = model.generateContent([
    {
      inlineData: {
        mimeType: mimeType,
        data: base64Audio
      }
    },
    { text: 'この音声を日本語で文字起こししてください。話者の発言をそのまま書き起こし、余計な説明は不要です。' }
  ])

  let sttResult
  try {
    sttResult = await Promise.race([generatePromise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId)
  }
  return sttResult.response.text()
}

/**
 * テキストから提案を生成
 * @param {string} transcriptText - セグメントのテキスト群
 * @param {string} dateKey - 日付キー (YYYY-MM-DD)
 * @param {string} [userId] - ユーザーID（DB保存キー検索用）
 * @param {Array<{text: string}>} [memories] - 過去の学習メモリー一覧
 * @param {Array<{slug: string, displayName: string, description: string}>} [bunjins] - 利用可能な分人一覧
 * @returns {Promise<Array<{type: string, title: string, body: string, bunjinSlug?: string}>>}
 */
export async function generateProposals(transcriptText, dateKey, userId, memories = [], bunjins = []) {
  const genAI = await getGeminiClient(userId)
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const memoriesSection = memories.length > 0
    ? `\n## 過去の学習メモリー\n${memories.map(m => m.text).join('\n')}\n`
    : ''

  const bunjinsSection = bunjins.length > 0
    ? `\n## 利用可能な分人（人格ファセット）\n${bunjins.map(b => `- ${b.slug}: ${b.displayName}（${b.description}）`).join('\n')}\n`
    : ''

  const bunjinInstruction = bunjins.length > 0
    ? `各提案が最も関連する分人のslugを "bunjinSlug" フィールドに含めてください（対応する分人がなければnull）。`
    : ''

  const prompt = `以下は${dateKey}の音声録音の文字起こしです。この内容から：
1. 日次サマリー（type: "SUMMARY"）を1つ
2. 具体的なタスク提案（type: "TASK"）を最大3つ

JSON配列で返してください。各要素は {type, title, body, bunjinSlug} の形式です。
titleは簡潔に、bodyは詳細を含めてください。${bunjinInstruction}
${bunjinsSection}${memoriesSection}
文字起こし:
${transcriptText}

JSON配列のみを返してください（マークダウンのコードブロックなし）:`

  // 50秒タイムアウト（clearTimeoutでメモリリークを防止）
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Gemini API timeout (50s)')), GEMINI_API_TIMEOUT_MS)
  })

  let result
  try {
    result = await Promise.race([model.generateContent(prompt), timeoutPromise])
  } finally {
    clearTimeout(timeoutId)
  }
  const text = result.response.text().trim()

  try {
    const cleaned = text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim()
    const parsed = JSON.parse(cleaned)
    // Zodで構造を検証・正規化（不正フィールドは除外、型変換は自動）
    const validated = proposalResponseSchema.safeParse(parsed)
    if (!validated.success) {
      logger.warn('Gemini response failed schema validation, using raw text as summary', {
        component: 'gemini',
        issues: validated.error.issues.map(i => i.message).join(', '),
      })
      return [{ type: 'SUMMARY', title: `${dateKey}のサマリー`, body: text }]
    }
    return validated.data
  } catch (parseError) {
    logger.warn('Gemini response JSON parse failed, using raw text as summary', {
      component: 'gemini',
      error: parseError.message,
      responseLength: text.length,
    })
    return [{ type: 'SUMMARY', title: `${dateKey}のサマリー`, body: text }]
  }
}

/**
 * Gemini APIが利用可能か非同期チェック（DB含む）
 * @param {string} [userId] - ユーザーID
 * @returns {Promise<boolean>}
 */
export async function isGeminiAvailableAsync(userId) {
  const client = await getGeminiClient(userId)
  return client !== null
}
