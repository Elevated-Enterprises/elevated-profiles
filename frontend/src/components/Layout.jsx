import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './Navbar'
import CookieBanner from './CookieBanner'
import LoginNudgeModal from './LoginNudgeModal'
import { useAuth } from '../context/AuthContext'
import { useRules } from '../context/RulesContext'

export default function Layout({ children }) {
  const { sessionExpired, dismissSessionExpired } = useAuth()
  const { unreadCount } = useRules()
  const navigate = useNavigate()

  useEffect(() => {
    if (sessionExpired) navigate('/', { replace: true })
  }, [sessionExpired])

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col">
      <Navbar />

      {/* Session expired modal */}
      {sessionExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-700 p-6 max-w-sm w-full text-center">
            <div className="text-4xl mb-3">🔓</div>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-2">Session expired</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">
              Your login has expired. Sign in again to access all profiles and your account.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                to="/login"
                onClick={dismissSessionExpired}
                className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Sign in again
              </Link>
              <button
                onClick={dismissSessionExpired}
                className="w-full py-2 px-4 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-sm transition-colors"
              >
                Continue as guest
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-400 dark:text-stone-500">
          <span>© {new Date().getFullYear()} Second Circuit</span>
          <div className="flex items-center gap-4">
            <a
              href="https://discord.gg/secondcircuit"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-600 dark:hover:text-stone-400 transition-colors"
            >
              Discord
            </a>
            <Link to="/legal/rules" className="relative hover:text-stone-600 dark:hover:text-stone-400 transition-colors inline-flex items-center gap-1.5">
              Rules
              {unreadCount > 0 && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
              )}
            </Link>
            <Link to="/legal/privacy-policy" className="hover:text-stone-600 dark:hover:text-stone-400 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/legal/imprint" className="hover:text-stone-600 dark:hover:text-stone-400 transition-colors">
              Imprint
            </Link>
          </div>
        </div>
      </footer>
      <LoginNudgeModal />
      <CookieBanner />
    </div>
  )
}
