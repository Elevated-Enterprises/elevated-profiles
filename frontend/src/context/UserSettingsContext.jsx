import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { getUserSettings, patchUserSettings } from '../lib/api'

const UserSettingsContext = createContext({ settings: {}, updateSetting: () => {} })

function applySettings(settings) {
  const html = document.documentElement
  // Dark mode
  if (settings.darkMode === 'true') {
    html.classList.add('dark')
    html.style.colorScheme = 'dark'
    localStorage.setItem('sc_dark_mode', 'true')
  } else {
    html.classList.remove('dark')
    html.style.colorScheme = 'light'
    localStorage.removeItem('sc_dark_mode')
  }
  // Dyslexic font
  if (settings.dyslexicFont === 'true') {
    html.classList.add('font-dyslexic')
    localStorage.setItem('sc_dyslexic_font', 'true')
  } else {
    html.classList.remove('font-dyslexic')
    localStorage.removeItem('sc_dyslexic_font')
  }
}

export function UserSettingsProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState({})

  useEffect(() => {
    if (!user) {
      setSettings({})
      return
    }
    getUserSettings(user.slug)
      .then((res) => {
        const s = res.data ?? {}
        setSettings(s)
        applySettings(s)
      })
      .catch(() => {
        // Settings load failure is non-critical — keep UI preferences from localStorage
      })
  }, [user?.slug])

  const updateSetting = useCallback(async (key, value) => {
    if (!user) return
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    applySettings(updated)
    try {
      await patchUserSettings(user.slug, { [key]: value })
    } catch {
      // Revert on failure
      setSettings(settings)
      applySettings(settings)
    }
  }, [user, settings])

  return (
    <UserSettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </UserSettingsContext.Provider>
  )
}

export const useUserSettings = () => useContext(UserSettingsContext)
