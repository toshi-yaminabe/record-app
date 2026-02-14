import { describe, it, expect } from 'vitest'
import { topologicalSort } from '@/lib/services/rule-tree-service.js'

describe('topologicalSort', () => {
  it('empty array -> empty array', () => {
    const result = topologicalSort([])
    expect(result).toEqual([])
  })

  it('single root node -> [root]', () => {
    const root = { id: 'n1', parentId: null, type: 'condition', sortOrder: 0 }
    const result = topologicalSort([root])
    expect(result).toEqual([root])
  })

  it('2-level tree (root -> child1, child2) -> root first, then children', () => {
    const root = { id: 'root', parentId: null, type: 'condition', sortOrder: 0 }
    const child1 = { id: 'c1', parentId: 'root', type: 'bunjin', sortOrder: 1 }
    const child2 = { id: 'c2', parentId: 'root', type: 'bunjin', sortOrder: 2 }

    const result = topologicalSort([root, child1, child2])
    expect(result[0]).toBe(root)
    expect(result).toContain(child1)
    expect(result).toContain(child2)
    // root must come before its children
    expect(result.indexOf(root)).toBeLessThan(result.indexOf(child1))
    expect(result.indexOf(root)).toBeLessThan(result.indexOf(child2))
  })

  it('3-level tree (root -> child -> grandchild) -> correct depth order', () => {
    const root = { id: 'root', parentId: null, type: 'condition', sortOrder: 0 }
    const child = { id: 'child', parentId: 'root', type: 'condition', sortOrder: 1 }
    const grandchild = { id: 'gc', parentId: 'child', type: 'bunjin', sortOrder: 2 }

    const result = topologicalSort([root, child, grandchild])
    expect(result).toEqual([root, child, grandchild])
  })

  it('random input order (grandchild, root, child) -> correct order', () => {
    const root = { id: 'root', parentId: null, type: 'condition', sortOrder: 0 }
    const child = { id: 'child', parentId: 'root', type: 'condition', sortOrder: 1 }
    const grandchild = { id: 'gc', parentId: 'child', type: 'bunjin', sortOrder: 2 }

    const result = topologicalSort([grandchild, root, child])
    expect(result.indexOf(root)).toBe(0)
    expect(result.indexOf(child)).toBe(1)
    expect(result.indexOf(grandchild)).toBe(2)
  })

  it('multiple roots (parentId null) -> all roots come first', () => {
    const root1 = { id: 'r1', parentId: null, type: 'condition', sortOrder: 0 }
    const root2 = { id: 'r2', parentId: null, type: 'bunjin', sortOrder: 1 }
    const child1 = { id: 'c1', parentId: 'r1', type: 'bunjin', sortOrder: 2 }

    const result = topologicalSort([child1, root2, root1])
    // Both roots should come before child1
    expect(result.indexOf(root1)).toBeLessThan(result.indexOf(child1))
    expect(result.indexOf(root2)).toBeLessThan(result.indexOf(child1))
  })
})
