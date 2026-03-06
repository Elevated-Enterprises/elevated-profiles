import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUserSettings } from '../context/UserSettingsContext'
import { useRules } from '../context/RulesContext'
import NotificationBell from './NotificationBell'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { settings, updateSetting } = useUserSettings()
  const { unreadCount } = useRules()
  const isDark = settings.darkMode === 'true'
  const isDyslexic = settings.dyslexicFont === 'true'

  return (
    <nav className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm border-b border-amber-100 dark:border-stone-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link to="/" className="text-lg sm:text-xl font-bold text-amber-700 hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-400 transition-colors shrink-0">
            <span className="hidden sm:inline">Second Circuit</span>
            <span className="sm:hidden">SC</span>
          </Link>
          <Link to="/pig" className="flex items-center gap-1 sm:gap-1.5 text-sm font-semibold px-2 sm:px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-400 transition-colors shrink-0">
            🎲<span className="hidden sm:inline"> Pig</span>
          </Link>
          <Link to="/yahtzee" className="flex items-center gap-1 sm:gap-1.5 text-sm font-semibold px-2 sm:px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-400 transition-colors shrink-0">
            🎯<span className="hidden sm:inline"> Yahtzee</span>
          </Link>
          <Link to="/academy" className="flex items-center gap-1 sm:gap-1.5 text-sm font-semibold px-2 sm:px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-400 transition-colors shrink-0">
            🎓<span className="hidden sm:inline"> Academy</span>
          </Link>
          {user && (
            <Link
              to="/applications"
              className="flex items-center gap-1 sm:gap-1.5 text-sm font-semibold px-2 sm:px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-400 transition-colors shrink-0"
            >
              📋<span className="hidden sm:inline"> Apply</span>
            </Link>
          )}
          <Link
            to="/legal/rules"
            className="relative flex items-center gap-1 sm:gap-1.5 text-sm font-semibold px-2 sm:px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-400 transition-colors shrink-0"
          >
            📖<span className="hidden sm:inline"> Rules</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
            )}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {user && <NotificationBell />}
          {/* Dark mode toggle */}
          <button
            onClick={() => updateSetting('darkMode', isDark ? 'false' : 'true')}
            className="text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors text-base leading-none px-1"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          {/* Dyslexic font toggle */}
          <button
            onClick={() => updateSetting('dyslexicFont', isDyslexic ? 'false' : 'true')}
            className={`text-sm font-bold px-2 py-0.5 rounded-md transition-colors ${
              isDyslexic
                ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400'
                : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300'
            }`}
            aria-label={isDyslexic ? 'Disable OpenDyslexic font' : 'Enable OpenDyslexic font'}
            title={isDyslexic ? 'Disable OpenDyslexic font' : 'Enable OpenDyslexic font'}
          >
            Aa
          </button>
          {!user && (
            <Link
              to="/login"
              className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 transition-colors"
            >
              Sign in
            </Link>
          )}
          {user && (
            <>
              <span className="text-stone-300 dark:text-stone-600 hidden sm:block">|</span>
              <span className="text-sm text-stone-500 dark:text-stone-400 hidden sm:block">{user.discordUsername}</span>
              <Link
                to={`/profiles/${user.slug}`}
                className="text-sm text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 transition-colors font-medium"
              >
                My Profile
              </Link>
              {user.isAdmin && (
                <Link
                  to="/admin"
                  className="text-sm text-stone-500 dark:text-stone-400 hover:text-amber-700 dark:hover:text-amber-500 transition-colors font-medium"
                >
                  Admin
                </Link>
              )}
              <button
                onClick={logout}
                className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors font-medium"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
