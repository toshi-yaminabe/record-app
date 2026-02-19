'use client'

import styles from './error.module.css'

export default function Error({ error, reset }) {
  return (
    <div className={styles.errorContainer}>
      <h2 className={styles.errorTitle}>エラーが発生しました</h2>
      <p className={styles.errorMessage}>{error?.message || '予期しないエラーが発生しました'}</p>
      <button onClick={reset} className={styles.retryButton}>
        再試行
      </button>
    </div>
  )
}
