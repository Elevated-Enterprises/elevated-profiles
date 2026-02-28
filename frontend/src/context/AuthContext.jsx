import { createContext, useContext, useState, useEffect } from 'react'
import { getMe, setSessionExpiredHandler } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    getMe()
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  // Register the 401 handler only after initial auth check — so a stale token
  // on page load causes a silent logout, not a popup.
  useEffect(() => {
    if (loading) return
    setSessionExpiredHandler(() => {
      setUser(null)
      setSessionExpired(true)
    })
    return () => setSessionExpiredHandler(null)
  }, [loading])

  const login = (token, userData) => {
    localStorage.setItem('token', token)
    setUser(userData)
    setSessionExpired(false)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  const dismissSessionExpired = () => setSessionExpired(false)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, sessionExpired, dismissSessionExpired }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
