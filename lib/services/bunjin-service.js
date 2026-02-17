/**
 * 分人サービス
 * - デフォルト分人を優先表示
 * - カスタム分人は最大3つまで
 */

import { prisma } from '@/lib/prisma.js'
import { DEFAULT_BUNJINS } from '@/lib/constants.js'
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors.js'
import { requireUserId, findOwnedOrThrow } from './base-service.js'

// ========================================
// 一覧取得
// ========================================

/**
 * 全分人を取得（デフォルトが先頭）
 * @param {string} userId - ユーザーID
 * @returns {Promise<Array>}
 */
export async function listBunjins(userId) {
  requireUserId(userId)

  const bunjins = await prisma.bunjin.findMany({
    where: { userId },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'asc' },
    ],
  })

  return bunjins
}

// ========================================
// 作成
// ========================================

/**
 * カスタム分人を作成
 * - 最大3つまで（デフォルト5 + カスタム3 = 計8）
 * - slugは一意性チェック
 *
 * @param {string} userId - ユーザーID
 * @param {{ slug: string, displayName: string, description?: string, color?: string, icon?: string }} data
 * @returns {Promise<Object>}
 * @throws {ValidationError} 必須フィールド不足
 * @throws {ConflictError} カスタム分人上限または重複slug
 */
export async function createBunjin(userId, data) {
  requireUserId(userId)

  const { slug, displayName, description, color, icon } = data

  if (!slug || !displayName) {
    throw new ValidationError('slug and displayName are required')
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new ValidationError('slug must be lowercase alphanumeric with hyphens')
  }

  const customCount = await prisma.bunjin.count({
    where: { userId, isDefault: false },
  })

  if (customCount >= 3) {
    throw new ConflictError('Maximum 3 custom bunjins allowed')
  }

  const existing = await prisma.bunjin.findUnique({
    where: { userId_slug: { userId, slug } },
  })

  if (existing) {
    throw new ConflictError(`Bunjin with slug "${slug}" already exists`)
  }

  const bunjin = await prisma.bunjin.create({
    data: {
      userId,
      slug,
      displayName,
      description: description ?? '',
      color: color ?? '#6366f1',
      icon: icon ?? 'person',
      isDefault: false,
    },
  })

  return bunjin
}

// ========================================
// 更新
// ========================================

/**
 * 分人を更新
 * - デフォルト分人のslugは変更不可
 *
 * @param {string} userId - ユーザーID
 * @param {string} id - 分人ID
 * @param {Partial<{ displayName: string, description: string, color: string, icon: string, slug: string }>} data
 * @returns {Promise<Object>}
 */
export async function updateBunjin(userId, id, data) {
  requireUserId(userId)

  const existing = await findOwnedOrThrow(prisma.bunjin, id, userId, 'Bunjin')

  if (existing.isDefault && data.slug && data.slug !== existing.slug) {
    throw new ValidationError('Cannot change slug of default bunjin')
  }

  if (data.slug && data.slug !== existing.slug) {
    if (!/^[a-z0-9-]+$/.test(data.slug)) {
      throw new ValidationError('slug must be lowercase alphanumeric with hyphens')
    }

    const duplicate = await prisma.bunjin.findUnique({
      where: { userId_slug: { userId, slug: data.slug } },
    })

    if (duplicate) {
      throw new ConflictError(`Bunjin with slug "${data.slug}" already exists`)
    }
  }

  if (data.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(data.color)) {
    throw new ValidationError('color must be a valid hex color (e.g. #ff00aa)')
  }
  if (data.icon !== undefined && (typeof data.icon !== 'string' || data.icon.length > 50)) {
    throw new ValidationError('icon must be a string of max 50 characters')
  }

  const allowedFields = ['displayName', 'description', 'color', 'icon', 'slug']
  const updateData = {}
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field]
    }
  }

  const updated = await prisma.bunjin.update({
    where: { id },
    data: updateData,
  })

  return updated
}

// ========================================
// 削除
// ========================================

/**
 * カスタム分人を削除
 * - デフォルト分人は削除不可
 *
 * @param {string} userId - ユーザーID
 * @param {string} id - 分人ID
 * @returns {Promise<void>}
 */
export async function deleteBunjin(userId, id) {
  requireUserId(userId)

  const existing = await prisma.bunjin.findUnique({ where: { id } })

  if (!existing || existing.userId !== userId) {
    throw new NotFoundError('Bunjin', id)
  }

  if (existing.isDefault) {
    throw new ValidationError('Cannot delete default bunjin')
  }

  await prisma.bunjin.delete({ where: { id } })
}
