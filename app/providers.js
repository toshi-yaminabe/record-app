'use client'

import { AuthProvider } from '@/app/contexts/auth-context'

export function Providers({ children }) {
  return <AuthProvider>{children}</AuthProvider>
}
