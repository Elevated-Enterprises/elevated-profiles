import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAuthConfig } from '../lib/api'
import { communityName } from '../lib/community'

export default function Login() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const handleDiscordLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAuthConfig()
      window.location.href = res.data.authorizationUrl
    } catch {
      setError('Could not reach the server. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-stone-100 dark:from-stone-950 dark:via-stone-900 dark:to-stone-800 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-lg border border-stone-100 dark:border-stone-700 max-w-md w-full p-10 text-center">
        <div className="text-5xl mb-5 select-none">✨</div>
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 mb-2">{communityName}</h1>
        <p className="text-stone-500 dark:text-stone-400 mb-8 text-sm leading-relaxed">
          Sign in with your Discord account to explore community profiles and companions.
        </p>

        {error && (
          <p className="text-red-500 text-sm mb-4 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">{error}</p>
        )}

        <button
          onClick={handleDiscordLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-colors shadow-sm"
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.101 18.08.114 18.1.135 18.115a19.916 19.916 0 0 0 5.993 3.032.079.079 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.032.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
          </svg>
          {loading ? 'Redirecting...' : 'Continue with Discord'}
        </button>

        <p className="text-xs text-stone-400 dark:text-stone-500 mt-6">
          Members of the {communityName} Discord server only.
        </p>
      </div>
    </div>
  )
}
