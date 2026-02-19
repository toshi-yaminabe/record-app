const BUNJIN_SIGNATURES = {
  personal: { icon: '◯', shortLabel: '回復', shape: 'circle' },
  social: { icon: '◻', shortLabel: '役割', shape: 'square' },
  home: { icon: '⌂', shortLabel: '安心', shape: 'home' },
  community: { icon: '◎', shortLabel: 'つながり', shape: 'link' },
  free: { icon: '★', shortLabel: '任意', shape: 'star' },
}

const BUNJIN_NAME_TO_KEY = {
  個人: 'personal',
  社会: 'social',
  家庭: 'home',
  コミュ: 'community',
  コミュニティ: 'community',
  自由: 'free',
}

const FALLBACK_SIGNATURE = {
  icon: '◯',
  shortLabel: '分人',
  shape: 'circle',
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
