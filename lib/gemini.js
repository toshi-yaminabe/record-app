import { GoogleGenerativeAI } from '@google/generative-ai'

// 起動時検証
if (!process.env.GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is not configured. Gemini features will be unavailable.')
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null

// STT用モデル（安定版）
const sttModel = genAI?.getGenerativeModel({
  model: 'gemini-2.0-flash'
})

// 提案生成用モデル
const proposalModel = genAI?.getGenerativeModel({
  model: 'gemini-2.0-flash'
})

/**
 * 音声ファイルを文字起こし
 * @param {Buffer} audioBuffer - 音声データ
 * @param {string} mimeType - MIMEタイプ (audio/mp4, audio/mpeg, etc.)
 * @returns {Promise<string>} - 文字起こしテキスト
 */
export async function transcribeAudio(audioBuffer, mimeType = 'audio/mp4') {
  if (!sttModel) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const base64Audio = audioBuffer.toString('base64')

  const result = await sttModel.generateContent([
    {
      inlineData: {
        mimeType: mimeType,
        data: base64Audio
      }
    },
    { text: 'この音声を日本語で文字起こししてください。話者の発言をそのまま書き起こし、余計な説明は不要です。' }
  ])

  return result.response.text()
}

/**
 * テキストから提案を生成
 * @param {string} transcriptText - セグメントのテキスト群
 * @param {string} dateKey - 日付キー (YYYY-MM-DD)
 * @returns {Promise<Array<{type: string, title: string, body: string}>>}
 */
export async function generateProposals(transcriptText, dateKey) {
  if (!proposalModel) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const prompt = `以下は${dateKey}の音声録音の文字起こしです。この内容から：
1. 日次サマリー（type: "SUMMARY"）を1つ
2. 具体的なタスク提案（type: "TASK"）を最大3つ

JSON配列で返してください。各要素は {type, title, body} の形式です。
titleは簡潔に、bodyは詳細を含めてください。

文字起こし:
${transcriptText}

JSON配列のみを返してください（マークダウンのコードブロックなし）:`

  const result = await proposalModel.generateContent(prompt)
  const text = result.response.text().trim()

  try {
    // JSON配列をパース（マークダウンコードブロックを除去）
    const cleaned = text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return [{ type: 'SUMMARY', title: `${dateKey}のサマリー`, body: text }]
  }
}

/**
 * Gemini APIが利用可能かチェック
 * @returns {boolean}
 */
export function isGeminiAvailable() {
  return genAI !== null
}
