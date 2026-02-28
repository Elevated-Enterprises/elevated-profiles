import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'sc_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-stone-900 text-stone-100 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <p className="text-sm text-stone-300 max-w-2xl">
          This site uses browser local storage to keep you logged in, and a preference cookie
          to remember your sort order. No tracking cookies or third-party analytics are used.{' '}
          <Link to="/legal/privacy-policy" className="underline text-amber-400 hover:text-amber-300">
            Privacy Policy
          </Link>
        </p>
        <button
          onClick={handleAccept}
          className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
