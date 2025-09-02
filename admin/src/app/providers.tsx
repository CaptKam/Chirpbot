'use client'

import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-card text-card-foreground border border-border',
          duration: 4000,
        }}
      />
    </SessionProvider>
  )
}