// キーはバックエンド lib/constants.js DEFAULT_BUNJINS の slug に統一
const BUNJIN_SIGNATURES = {
  work: { icon: '◻', shortLabel: '業務', shape: 'square', pattern: 'stripe' },
  creative: { icon: '◎', shortLabel: '創作', shape: 'link', pattern: 'dot' },
  social: { icon: '◯', shortLabel: '対人', shape: 'circle', pattern: 'wave' },
  rest: { icon: '⌂', shortLabel: '回復', shape: 'home', pattern: 'grid' },
  learning: { icon: '★', shortLabel: '学習', shape: 'star', pattern: 'solid' },
}

const BUNJIN_NAME_TO_KEY = {
  仕事モード: 'work',
  仕事: 'work',
  クリエイティブ: 'creative',
  ソーシャル: 'social',
  社会: 'social',
  休息: 'rest',
  学習: 'learning',
}

const FALLBACK_SIGNATURE = {
  icon: '◯',
  shortLabel: '分人',
  shape: 'circle',
  pattern: 'solid',
}

export function getBunjinSignature(bunjin) {
  const key = bunjin?.slug || BUNJIN_NAME_TO_KEY[bunjin?.displayName]
  const base = BUNJIN_SIGNATURES[key] || FALLBACK_SIGNATURE

  return {
    icon: bunjin?.icon || base.icon,
    shortLabel: bunjin?.description || base.shortLabel,
    shape: base.shape,
  }
}
