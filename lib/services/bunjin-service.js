/**
 * 分人サービス
 * - デフォルト分人を優先表示
 * - カスタム分人は最大3つまで
 */

import { prisma } from '@/lib/prisma.js'
import { MOCK_USER_ID, DEFAULT_BUNJINS } from '@/lib/constants.js'
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors.js'

// ========================================
// 一覧取得
// ========================================

/**
 * 全分人を取得（デフォルトが先頭）
 * @returns {Promise<Array>}
 */
export async function listBunjins() {
  const bunjins = await prisma.bunjin.findMany({
    where: { userId: MOCK_USER_ID },
    orderBy: [
      { isDefault: 'desc' }, // デフォルトが先
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
 * @param {{ slug: string, displayName: string, description?: string, color?: string, icon?: string }} data
 * @returns {Promise<Object>}
 * @throws {ValidationError} 必須フィールド不足
 * @throws {ConflictError} カスタム分人上限または重複slug
 */
export async function createBunjin(data) {
  const { slug, displayName, description, color, icon } = data

  // 必須フィールド検証
  if (!slug || !displayName) {
    throw new ValidationError('slug and displayName are required')
  }

  // slug形式チェック（小文字英数字とハイフンのみ）
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new ValidationError('slug must be lowercase alphanumeric with hyphens')
  }

  // カスタム分人数の上限チェック
  const customCount = await prisma.bunjin.count({
    where: {
      userId: MOCK_USER_ID,
      isDefault: false,
    },
  })

  if (customCount >= 3) {
    throw new ConflictError('Maximum 3 custom bunjins allowed')
  }

  // slug重複チェック
  const existing = await prisma.bunjin.findUnique({
    where: {
      userId_slug: {
        userId: MOCK_USER_ID,
        slug,
      },
    },
  })

  if (existing) {
    throw new ConflictError(`Bunjin with slug "${slug}" already exists`)
  }

  // 作成
  const bunjin = await prisma.bunjin.create({
    data: {
      userId: MOCK_USER_ID,
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
 * @param {string} id - 分人ID
 * @param {Partial<{ displayName: string, description: string, color: string, icon: string, slug: string }>} data
 * @returns {Promise<Object>}
 * @throws {NotFoundError} 分人が存在しない
 * @throws {ValidationError} デフォルト分人のslug変更試行
 * @throws {ConflictError} slug重複
 */
export async function updateBunjin(id, data) {
  // 存在確認
  const existing = await prisma.bunjin.findUnique({
    where: { id },
  })

  if (!existing || existing.userId !== MOCK_USER_ID) {
    throw new NotFoundError('Bunjin', id)
  }

  // デフォルト分人のslug変更禁止
  if (existing.isDefault && data.slug && data.slug !== existing.slug) {
    throw new ValidationError('Cannot change slug of default bunjin')
  }

  // slug重複チェック（変更する場合）
  if (data.slug && data.slug !== existing.slug) {
    if (!/^[a-z0-9-]+$/.test(data.slug)) {
      throw new ValidationError('slug must be lowercase alphanumeric with hyphens')
    }

    const duplicate = await prisma.bunjin.findUnique({
      where: {
        userId_slug: {
          userId: MOCK_USER_ID,
          slug: data.slug,
        },
      },
    })

    if (duplicate) {
      throw new ConflictError(`Bunjin with slug "${data.slug}" already exists`)
    }
  }

  // 入力バリデーション
  if (data.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(data.color)) {
    throw new ValidationError('color must be a valid hex color (e.g. #ff00aa)')
  }
  if (data.icon !== undefined && (typeof data.icon !== 'string' || data.icon.length > 50)) {
    throw new ValidationError('icon must be a string of max 50 characters')
  }

  // ホワイトリストで許可フィールドのみ抽出
  const allowedFields = ['displayName', 'description', 'color', 'icon', 'slug']
  const updateData = {}
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field]
    }
  }

  // 更新
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
 * @param {string} id - 分人ID
 * @returns {Promise<void>}
 * @throws {NotFoundError} 分人が存在しない
 * @throws {ValidationError} デフォルト分人削除試行
 */
export async function deleteBunjin(id) {
  // 存在確認
  const existing = await prisma.bunjin.findUnique({
    where: { id },
  })

  if (!existing || existing.userId !== MOCK_USER_ID) {
    throw new NotFoundError('Bunjin', id)
  }

  // デフォルト分人削除禁止
  if (existing.isDefault) {
    throw new ValidationError('Cannot delete default bunjin')
  }

  // 削除
  await prisma.bunjin.delete({
    where: { id },
  })
}
