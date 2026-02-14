import { describe, it, expect } from 'vitest'
import {
  validateTaskTransition,
  validateRuleTree,
  isValidDateKey,
  isValidWeekKey,
} from '@/lib/validators.js'

const TASK_STATUS = { TODO: 'TODO', DOING: 'DOING', DONE: 'DONE', ARCHIVED: 'ARCHIVED' }
const NODE_TYPE = { CONDITION: 'condition', BUNJIN: 'bunjin' }

describe('validateTaskTransition', () => {
  // Valid transitions
  it('TODO -> DOING: valid', () => {
    const result = validateTaskTransition(TASK_STATUS.TODO, TASK_STATUS.DOING)
    expect(result.valid).toBe(true)
  })

  it('TODO -> ARCHIVED: valid', () => {
    const result = validateTaskTransition(TASK_STATUS.TODO, TASK_STATUS.ARCHIVED)
    expect(result.valid).toBe(true)
  })

  it('DOING -> TODO: valid', () => {
    const result = validateTaskTransition(TASK_STATUS.DOING, TASK_STATUS.TODO)
    expect(result.valid).toBe(true)
  })

  it('DOING -> DONE: valid', () => {
    const result = validateTaskTransition(TASK_STATUS.DOING, TASK_STATUS.DONE)
    expect(result.valid).toBe(true)
  })

  it('DOING -> ARCHIVED: valid', () => {
    const result = validateTaskTransition(TASK_STATUS.DOING, TASK_STATUS.ARCHIVED)
    expect(result.valid).toBe(true)
  })

  it('DONE -> TODO: valid (redo)', () => {
    const result = validateTaskTransition(TASK_STATUS.DONE, TASK_STATUS.TODO)
    expect(result.valid).toBe(true)
  })

  it('DONE -> ARCHIVED: valid', () => {
    const result = validateTaskTransition(TASK_STATUS.DONE, TASK_STATUS.ARCHIVED)
    expect(result.valid).toBe(true)
  })

  // Invalid transitions
  it('TODO -> DONE: invalid', () => {
    const result = validateTaskTransition(TASK_STATUS.TODO, TASK_STATUS.DONE)
    expect(result.valid).toBe(false)
  })

  it('DONE -> DOING: invalid', () => {
    const result = validateTaskTransition(TASK_STATUS.DONE, TASK_STATUS.DOING)
    expect(result.valid).toBe(false)
  })

  it('ARCHIVED -> TODO: invalid', () => {
    const result = validateTaskTransition(TASK_STATUS.ARCHIVED, TASK_STATUS.TODO)
    expect(result.valid).toBe(false)
  })

  it('ARCHIVED -> DOING: invalid', () => {
    const result = validateTaskTransition(TASK_STATUS.ARCHIVED, TASK_STATUS.DOING)
    expect(result.valid).toBe(false)
  })

  it('ARCHIVED -> DONE: invalid', () => {
    const result = validateTaskTransition(TASK_STATUS.ARCHIVED, TASK_STATUS.DONE)
    expect(result.valid).toBe(false)
  })

  it('same status (TODO -> TODO): invalid', () => {
    const result = validateTaskTransition(TASK_STATUS.TODO, TASK_STATUS.TODO)
    expect(result.valid).toBe(false)
    expect(result.message).toContain('Already in status')
  })

  it('unknown status (UNKNOWN -> TODO): invalid', () => {
    const result = validateTaskTransition('UNKNOWN', TASK_STATUS.TODO)
    expect(result.valid).toBe(false)
    expect(result.message).toContain('Unknown status')
  })
})

describe('validateRuleTree', () => {
  it('root only (bunjin node with bunjinSlug) -> valid', () => {
    const nodes = [
      { id: 'root', parentId: null, type: NODE_TYPE.BUNJIN, bunjinSlug: 'work' },
    ]
    const result = validateRuleTree(nodes)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('empty array -> invalid', () => {
    const result = validateRuleTree([])
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Rule tree has no nodes')
  })

  it('null -> invalid', () => {
    const result = validateRuleTree(null)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Rule tree has no nodes')
  })

  it('no root (all have parentId) -> invalid', () => {
    const nodes = [
      { id: 'n1', parentId: 'n2', type: NODE_TYPE.BUNJIN, bunjinSlug: 'work' },
      { id: 'n2', parentId: 'n1', type: NODE_TYPE.BUNJIN, bunjinSlug: 'rest' },
    ]
    const result = validateRuleTree(nodes)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('No root node found'))).toBe(true)
  })

  it('multiple roots -> errors array contains multiple root message', () => {
    const nodes = [
      { id: 'root1', parentId: null, type: NODE_TYPE.BUNJIN, bunjinSlug: 'work' },
      { id: 'root2', parentId: null, type: NODE_TYPE.BUNJIN, bunjinSlug: 'rest' },
    ]
    const result = validateRuleTree(nodes)
    expect(result.errors.some(e => e.includes('Multiple root nodes'))).toBe(true)
  })

  it('cycle detection -> errors array contains cycle message', () => {
    const nodes = [
      { id: 'root', parentId: null, type: NODE_TYPE.CONDITION },
      { id: 'n1', parentId: 'root', type: NODE_TYPE.CONDITION },
      { id: 'n2', parentId: 'n1', type: NODE_TYPE.BUNJIN, bunjinSlug: 'work' },
      // n3 creates an orphan cycle: n3 -> n4 -> n3
      { id: 'n3', parentId: 'n4', type: NODE_TYPE.BUNJIN, bunjinSlug: 'rest' },
      { id: 'n4', parentId: 'n3', type: NODE_TYPE.BUNJIN, bunjinSlug: 'learning' },
    ]
    const result = validateRuleTree(nodes)
    expect(result.valid).toBe(false)
    // n3 and n4 are orphans (unreachable from root)
    expect(result.errors.some(e => e.includes('Orphan node') || e.includes('Cycle'))).toBe(true)
  })
})

describe('isValidDateKey', () => {
  it('"2024-01-15" -> true', () => {
    expect(isValidDateKey('2024-01-15')).toBe(true)
  })

  it('"2024-13-01" -> false (invalid month)', () => {
    expect(isValidDateKey('2024-13-01')).toBe(false)
  })

  it('"abc" -> false', () => {
    expect(isValidDateKey('abc')).toBe(false)
  })

  it('null -> false', () => {
    expect(isValidDateKey(null)).toBe(false)
  })

  it('"" -> false', () => {
    expect(isValidDateKey('')).toBe(false)
  })
})

describe('isValidWeekKey', () => {
  it('"2024-W01" -> true', () => {
    expect(isValidWeekKey('2024-W01')).toBe(true)
  })

  it('"2024-W52" -> true', () => {
    expect(isValidWeekKey('2024-W52')).toBe(true)
  })

  it('"abc" -> false', () => {
    expect(isValidWeekKey('abc')).toBe(false)
  })

  it('null -> false', () => {
    expect(isValidWeekKey(null)).toBe(false)
  })
})
