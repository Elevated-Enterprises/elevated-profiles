import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAuthConfig } from '../lib/api'

const STORAGE_KEY = 'sc_login_nudge_dismissed'
const SNOOZE_MINUTES = parseInt(import.meta.env.VITE_LOGIN_NUDGE_SNOOZE_MINUTES ?? '10', 10)

export default function LoginNudgeModal() {
  const { user, loading, sessionExpired } = useAuth()
  const [visible, setVisible] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    if (loading || user || sessionExpired) return

    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < SNOOZE_MINUTES * 60 * 1000) return
    }

    const timer = setTimeout(() => setVisible(true), 1500)
    return () => clearTimeout(timer)
  }, [loading, user, sessionExpired])

  if (!visible) return null

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    setVisible(false)
  }

  const handleLogin = async () => {
    setLoginLoading(true)
    try {
      const res = await getAuthConfig()
      window.location.href = res.data.authorizationUrl
    } catch {
      setLoginLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700 p-6 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">👋</div>
        <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-2">
          Sign in via Discord?
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">
          Sign in with your Discord account to explore all profiles and create your own.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleLogin}
            disabled={loginLoading}
            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.101 18.08.114 18.1.135 18.115a19.916 19.916 0 0 0 5.993 3.032.079.079 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.032.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
            {loginLoading ? 'Redirecting...' : 'Yes, sign in with Discord'}
          </button>
          <button
            onClick={handleDismiss}
            className="w-full py-2 px-4 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-sm transition-colors"
          >
            No, thanks
          </button>
        </div>
      </div>
    </div>
  )
}
