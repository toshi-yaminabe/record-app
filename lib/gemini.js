import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/prisma.js'
import { decrypt } from '@/lib/crypto.js'
import { logger } from '@/lib/logger.js'

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

  // 50秒タイムアウト (Gemini APIの応答時間に余裕を持たせる)
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Gemini API timeout (50s)')), 50000)
  )

  const generatePromise = model.generateContent([
    {
      inlineData: {
        mimeType: mimeType,
        data: base64Audio
      }
    },
    { text: 'この音声を日本語で文字起こししてください。話者の発言をそのまま書き起こし、余計な説明は不要です。' }
  ])

  const result = await Promise.race([generatePromise, timeoutPromise])
  return result.response.text()
}

/**
 * テキストから提案を生成
 * @param {string} transcriptText - セグメントのテキスト群
 * @param {string} dateKey - 日付キー (YYYY-MM-DD)
 * @param {string} [userId] - ユーザーID（DB保存キー検索用）
 * @param {Array<{text: string}>} [memories] - 過去の学習メモリー一覧
 * @returns {Promise<Array<{type: string, title: string, body: string}>>}
 */
export async function generateProposals(transcriptText, dateKey, userId, memories = []) {
  const genAI = await getGeminiClient(userId)
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const memoriesSection = memories.length > 0
    ? `\n## 過去の学習メモリー\n${memories.map(m => m.text).join('\n')}\n`
    : ''

  const prompt = `以下は${dateKey}の音声録音の文字起こしです。この内容から：
1. 日次サマリー（type: "SUMMARY"）を1つ
2. 具体的なタスク提案（type: "TASK"）を最大3つ

JSON配列で返してください。各要素は {type, title, body} の形式です。
titleは簡潔に、bodyは詳細を含めてください。
${memoriesSection}
文字起こし:
${transcriptText}

JSON配列のみを返してください（マークダウンのコードブロックなし）:`

  // 50秒タイムアウト
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Gemini API timeout (50s)')), 50000)
  )

  const generatePromise = model.generateContent(prompt)
  const result = await Promise.race([generatePromise, timeoutPromise])
  const text = result.response.text().trim()

  try {
    const cleaned = text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim()
    return JSON.parse(cleaned)
  } catch {
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
