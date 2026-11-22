import { useEffect, useState } from 'react'
import type { ThemeMode } from '../types'

const STORAGE_KEY = 'upm_theme_mode'

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved
    }
  } catch {
    // ignore storage access issues
  }
  // Default to light theme on first launch as requested
  return 'light'
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getInitialTheme)
  const [resolvedDark, setResolvedDark] = useState<boolean>(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // ignore
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const isDark = mode === 'dark' || (mode === 'system' && media.matches)
      setResolvedDark(isDark)
      document.documentElement.classList.toggle('dark', isDark)
    }

    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [mode])

  return { mode, setMode, resolvedDark }
}
