import { describe, it, expect } from 'vitest'
import {
  SESSION_STATUS,
  STT_STATUS,
  TASK_STATUS,
  PROPOSAL_STATUS,
  PROPOSAL_TYPE,
  NODE_TYPE,
  DEFAULT_BUNJINS,
  ARCHIVE_AFTER_DAYS,
  RULE_TREE_MAX_DEPTH,
} from '@/lib/constants.js'

describe('SESSION_STATUS', () => {
  it('ACTIVE と STOPPED を持つ', () => {
    expect(SESSION_STATUS.ACTIVE).toBe('ACTIVE')
    expect(SESSION_STATUS.STOPPED).toBe('STOPPED')
  })

  it('Object.freeze されている（不変）', () => {
    expect(Object.isFrozen(SESSION_STATUS)).toBe(true)
  })
})

describe('STT_STATUS', () => {
  it('4つのステータスを持つ', () => {
    expect(STT_STATUS.PENDING).toBe('PENDING')
    expect(STT_STATUS.PROCESSING).toBe('PROCESSING')
    expect(STT_STATUS.DONE).toBe('DONE')
    expect(STT_STATUS.FAILED).toBe('FAILED')
  })

  it('Object.freeze されている', () => {
    expect(Object.isFrozen(STT_STATUS)).toBe(true)
  })
})

describe('TASK_STATUS', () => {
  it('TODO, DOING, DONE, ARCHIVED を持つ', () => {
    expect(TASK_STATUS.TODO).toBe('TODO')
    expect(TASK_STATUS.DOING).toBe('DOING')
    expect(TASK_STATUS.DONE).toBe('DONE')
    expect(TASK_STATUS.ARCHIVED).toBe('ARCHIVED')
  })

  it('Object.freeze されている', () => {
    expect(Object.isFrozen(TASK_STATUS)).toBe(true)
  })
})

describe('PROPOSAL_STATUS', () => {
  it('PENDING, CONFIRMED, REJECTED を持つ', () => {
    expect(PROPOSAL_STATUS.PENDING).toBe('PENDING')
    expect(PROPOSAL_STATUS.CONFIRMED).toBe('CONFIRMED')
    expect(PROPOSAL_STATUS.REJECTED).toBe('REJECTED')
  })

  it('Object.freeze されている', () => {
    expect(Object.isFrozen(PROPOSAL_STATUS)).toBe(true)
  })
})

describe('PROPOSAL_TYPE', () => {
  it('SUMMARY と TASK を持つ', () => {
    expect(PROPOSAL_TYPE.SUMMARY).toBe('SUMMARY')
    expect(PROPOSAL_TYPE.TASK).toBe('TASK')
  })

  it('Object.freeze されている', () => {
    expect(Object.isFrozen(PROPOSAL_TYPE)).toBe(true)
  })
})

describe('NODE_TYPE', () => {
  it('condition と bunjin を持つ', () => {
    expect(NODE_TYPE.CONDITION).toBe('condition')
    expect(NODE_TYPE.BUNJIN).toBe('bunjin')
  })

  it('Object.freeze されている', () => {
    expect(Object.isFrozen(NODE_TYPE)).toBe(true)
  })
})

describe('DEFAULT_BUNJINS', () => {
  it('5件のデフォルト分人が定義されている', () => {
    expect(DEFAULT_BUNJINS).toHaveLength(5)
  })

  it('各分人が slug, displayName, description, color, icon を持つ', () => {
    for (const bunjin of DEFAULT_BUNJINS) {
      expect(bunjin).toHaveProperty('slug')
      expect(bunjin).toHaveProperty('displayName')
      expect(bunjin).toHaveProperty('description')
      expect(bunjin).toHaveProperty('color')
      expect(bunjin).toHaveProperty('icon')
    }
  })

  it('slug の一覧が正しい', () => {
    const slugs = DEFAULT_BUNJINS.map(b => b.slug)
    expect(slugs).toEqual(['work', 'creative', 'social', 'rest', 'learning'])
  })

  it('Object.freeze されている', () => {
    expect(Object.isFrozen(DEFAULT_BUNJINS)).toBe(true)
  })
})

describe('ARCHIVE_AFTER_DAYS', () => {
  it('14日に設定されている', () => {
    expect(ARCHIVE_AFTER_DAYS).toBe(14)
  })
})

describe('RULE_TREE_MAX_DEPTH', () => {
  it('10に設定されている', () => {
    expect(RULE_TREE_MAX_DEPTH).toBe(10)
  })
})
