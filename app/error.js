'use client'

export default function Error({ error, reset }) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
      <h2>Something went wrong</h2>
      <p style={{ color: '#a0a0b0' }}>{error?.message || 'An unexpected error occurred'}</p>
      <button onClick={reset} style={{ padding: '0.5rem 1rem', marginTop: '1rem', cursor: 'pointer', background: '#9c27b0', color: '#fff', border: 'none', borderRadius: '8px' }}>
        Try Again
      </button>
    </div>
  )
}
