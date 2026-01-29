import { GoogleGenerativeAI } from '@google/generative-ai'

if (!process.env.GEMINI_API_KEY) {
  console.error('WARNING: GEMINI_API_KEY is not set. Transcription will fail.')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp'
})

/**
 * 音声ファイルを文字起こし
 * @param {Buffer} audioBuffer - 音声データ
 * @param {string} mimeType - MIMEタイプ (audio/mp4, audio/mpeg, etc.)
 * @returns {Promise<string>} - 文字起こしテキスト
 */
export async function transcribeAudio(audioBuffer, mimeType = 'audio/mp4') {
  const base64Audio = audioBuffer.toString('base64')

  const result = await geminiModel.generateContent([
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
