import { describe, it, expect } from 'vitest'
import { TRANSCRIBE_MODE, localTranscribeSchema } from '@/lib/transcribe-mode.js'

describe('TRANSCRIBE_MODE', () => {
  it('SERVER と LOCAL を含む', () => {
    expect(TRANSCRIBE_MODE.SERVER).toBe('SERVER')
    expect(TRANSCRIBE_MODE.LOCAL).toBe('LOCAL')
  })

  it('freeze されている', () => {
    expect(Object.isFrozen(TRANSCRIBE_MODE)).toBe(true)
  })

  it('SERVER と LOCAL の2値のみ', () => {
    expect(Object.keys(TRANSCRIBE_MODE)).toHaveLength(2)
  })
})

describe('localTranscribeSchema', () => {
  const validData = {
    sessionId: 'sess-123',
    segmentNo: 0,
    startAt: '2026-02-17T10:00:00Z',
    endAt: '2026-02-17T10:05:00Z',
    text: 'こんにちは',
    selectedMode: 'SERVER',
    executedMode: 'SERVER',
  }

  it('有効なデータをパースできる', () => {
    const result = localTranscribeSchema.safeParse(validData)
    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      sessionId: 'sess-123',
      segmentNo: 0,
      text: 'こんにちは',
      selectedMode: 'SERVER',
      executedMode: 'SERVER',
    })
  })

  it('LOCAL→LOCAL のデータをパースできる', () => {
    const result = localTranscribeSchema.safeParse({
      ...validData,
      selectedMode: 'LOCAL',
      executedMode: 'LOCAL',
      localEngineVersion: 'whisper-1.0.0',
    })
    expect(result.success).toBe(true)
  })

  it('LOCAL→SERVER フォールバック時に fallbackReason がないとエラー', () => {
    const result = localTranscribeSchema.safeParse({
      ...validData,
      selectedMode: 'LOCAL',
      executedMode: 'SERVER',
      // fallbackReason が未指定
    })
    expect(result.success).toBe(false)
    expect(result.error.issues[0].message).toContain('fallbackReason')
  })

  it('LOCAL→SERVER フォールバック時に fallbackReason があればOK', () => {
    const result = localTranscribeSchema.safeParse({
      ...validData,
      selectedMode: 'LOCAL',
      executedMode: 'SERVER',
      fallbackReason: 'whisper model not available',
    })
    expect(result.success).toBe(true)
  })

  it('sessionId が空文字だとエラー', () => {
    const result = localTranscribeSchema.safeParse({
      ...validData,
      sessionId: '',
    })
    expect(result.success).toBe(false)
  })

  it('text が空文字だとエラー', () => {
    const result = localTranscribeSchema.safeParse({
      ...validData,
      text: '',
    })
    expect(result.success).toBe(false)
  })

  it('不正な selectedMode はエラー', () => {
    const result = localTranscribeSchema.safeParse({
      ...validData,
      selectedMode: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('segmentNo が負数だとエラー', () => {
    const result = localTranscribeSchema.safeParse({
      ...validData,
      segmentNo: -1,
    })
    expect(result.success).toBe(false)
  })

  it('fallbackReason はnull許可', () => {
    const result = localTranscribeSchema.safeParse({
      ...validData,
      fallbackReason: null,
    })
    expect(result.success).toBe(true)
  })

  it('localEngineVersion はnull許可', () => {
    const result = localTranscribeSchema.safeParse({
      ...validData,
      localEngineVersion: null,
    })
    expect(result.success).toBe(true)
  })
})
