'use client'

export function LoadingSkeleton({ rows = 3 }) {
  return (
    <div className="loading-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-box skeleton-circle"></div>
          <div className="skeleton-box skeleton-text"></div>
        </div>
      ))}
    </div>
  )
}
