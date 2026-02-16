/**
 * 共有定数 - バックエンド全体で使用
 */

// セッションステータス
export const SESSION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  STOPPED: 'STOPPED',
})

// STTステータス
export const STT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  FAILED: 'FAILED',
})

// タスクステータス
export const TASK_STATUS = Object.freeze({
  TODO: 'TODO',
  DOING: 'DOING',
  DONE: 'DONE',
  ARCHIVED: 'ARCHIVED',
})

// 提案ステータス
export const PROPOSAL_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
})

// 提案タイプ
export const PROPOSAL_TYPE = Object.freeze({
  SUMMARY: 'SUMMARY',
  TASK: 'TASK',
})

// ルールツリーノードタイプ
export const NODE_TYPE = Object.freeze({
  CONDITION: 'condition',
  BUNJIN: 'bunjin',
})

// デフォルト分人定義
export const DEFAULT_BUNJINS = Object.freeze([
  { slug: 'work', displayName: '仕事モード', description: '業務・プロジェクト関連', color: '#3b82f6', icon: 'work' },
  { slug: 'creative', displayName: 'クリエイティブ', description: '創作・アイデア出し', color: '#8b5cf6', icon: 'palette' },
  { slug: 'social', displayName: 'ソーシャル', description: '対人関係・コミュニケーション', color: '#ec4899', icon: 'people' },
  { slug: 'rest', displayName: '休息', description: 'リラックス・回復', color: '#10b981', icon: 'self_improvement' },
  { slug: 'learning', displayName: '学習', description: '勉強・スキルアップ', color: '#f59e0b', icon: 'school' },
])

// タスク自動アーカイブ日数
export const ARCHIVE_AFTER_DAYS = 14

// ルールツリー制限
export const RULE_TREE_MAX_DEPTH = 10

