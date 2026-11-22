import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { ThemeMode } from '../types'
import { windowControls } from '../api'

const STORAGE_KEY = 'upm_theme_mode'

export interface ThemeTransitionOrigin {
  x: number
  y: number
}

interface ViewTransitionLike {
  ready: Promise<void>
}

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => ViewTransitionLike
}

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

function resolveDark(mode: ThemeMode, systemDark: boolean): boolean {
  return mode === 'dark' || (mode === 'system' && systemDark)
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(getInitialTheme)
  const [resolvedDark, setResolvedDark] = useState<boolean>(() =>
    resolveDark(getInitialTheme(), window.matchMedia('(prefers-color-scheme: dark)').matches),
  )
  const fallbackTimerRef = useRef<number | null>(null)

  const runFallbackTransition = useCallback((applyChange: () => void) => {
    const root = document.documentElement
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current)
    }
    root.classList.add('theme-transitioning')
    applyChange()
    fallbackTimerRef.current = window.setTimeout(() => {
      root.classList.remove('theme-transitioning')
      fallbackTimerRef.current = null
    }, 320)
  }, [])

  // Keep DOM synchronized on mount and respond smoothly to OS theme changes in 'system' mode
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const initialDark = resolveDark(mode, media.matches)
    setResolvedDark(initialDark)
    document.documentElement.classList.toggle('dark', initialDark)
    windowControls.setTheme(mode)

    const onSystemChange = (e: MediaQueryListEvent) => {
      if (mode !== 'system') return
      const nextDark = e.matches
      runFallbackTransition(() => {
        setResolvedDark(nextDark)
        document.documentElement.classList.toggle('dark', nextDark)
      })
    }

    media.addEventListener('change', onSystemChange)
    return () => media.removeEventListener('change', onSystemChange)
  }, [mode, runFallbackTransition])

  const setMode = useCallback(
    (nextMode: ThemeMode, origin?: ThemeTransitionOrigin) => {
      try {
        localStorage.setItem(STORAGE_KEY, nextMode)
      } catch {
        // ignore storage errors
      }

      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const currentDark = document.documentElement.classList.contains('dark')
      const nextDark = resolveDark(nextMode, systemDark)

      const commit = () => {
        setModeState(nextMode)
        setResolvedDark(nextDark)
        document.documentElement.classList.toggle('dark', nextDark)
      }

      // Skip full-screen animation when visual polarity does not change (e.g. light -> system while OS is light)
      if (currentDark === nextDark) {
        commit()
        return
      }

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const doc = document as DocumentWithViewTransition

      if (doc.startViewTransition && !prefersReducedMotion) {
        const x = origin?.x ?? window.innerWidth / 2
        const y = origin?.y ?? 24
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        )

        const transition = doc.startViewTransition(() => {
          flushSync(commit)
        })

        transition.ready
          .then(() => {
            document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${endRadius}px at ${x}px ${y}px)`,
                ],
              },
              {
                duration: 420,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                pseudoElement: '::view-transition-new(root)',
              },
            )
          })
          .catch(() => {})
        return
      }

      runFallbackTransition(commit)
    },
    [runFallbackTransition],
  )

  return { mode, setMode, resolvedDark }
}
