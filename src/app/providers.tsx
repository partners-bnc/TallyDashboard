'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Theme } from '@astryxdesign/core/theme'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'
import { authClient } from '@/lib/auth/client'

type Mode = 'light' | 'dark'

const ThemeModeContext = createContext<{
  mode: Mode
  toggleMode: () => void
}>({
  mode: 'light',
  toggleMode: () => {},
})

export function useThemeMode() {
  return useContext(ThemeModeContext)
}

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const previousSessionId = useRef<string | null>(null)
  const hasLoadedSession = useRef(false)
  const [mode, setMode] = useState<Mode>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (isSessionPending) return

    const sessionId = session?.session.id ?? null
    if (hasLoadedSession.current && previousSessionId.current !== sessionId) {
      router.refresh()
    }

    previousSessionId.current = sessionId
    hasLoadedSession.current = true
  }, [isSessionPending, router, session?.session.id])

  useEffect(() => {
    const savedMode = localStorage.getItem('theme-mode') as Mode | null
    let activeMode: Mode = 'light'
    if (savedMode === 'light' || savedMode === 'dark') {
      activeMode = savedMode
    } else if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      activeMode = 'dark'
    }
    setMode(activeMode)
    if (activeMode === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    setMounted(true)
  }, [])

  const toggleMode = () => {
    const nextMode = mode === 'light' ? 'dark' : 'light'
    setMode(nextMode)
    localStorage.setItem('theme-mode', nextMode)
    if (nextMode === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      <Theme theme={neutralTheme} mode={mounted ? mode : 'light'}>
        {children}
      </Theme>
    </ThemeModeContext.Provider>
  )
}
