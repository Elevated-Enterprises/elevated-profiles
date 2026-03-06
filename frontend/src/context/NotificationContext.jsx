import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { getNotificationsUnreadCount, getNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/api'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [loaded, setLoaded] = useState(false)
  const intervalRef = useRef(null)

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return
    try {
      const res = await getNotificationsUnreadCount()
      setUnreadCount(res.data.count)
    } catch {
      // silently ignore
    }
  }, [user])

  const loadNotifications = useCallback(async () => {
    if (!user) return
    try {
      const res = await getNotifications()
      setNotifications(res.data)
      setLoaded(true)
      const unread = res.data.filter((n) => !n.isRead).length
      setUnreadCount(unread)
    } catch {
      // silently ignore
    }
  }, [user])

  const markRead = useCallback(async (id) => {
    try {
      await markNotificationRead(id)
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // silently ignore
    }
  }, [])

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      setNotifications([])
      setLoaded(false)
      return
    }
    refreshUnreadCount()
    // Poll every 30 seconds
    intervalRef.current = setInterval(refreshUnreadCount, 30_000)
    return () => clearInterval(intervalRef.current)
  }, [user, refreshUnreadCount])

  return (
    <NotificationContext.Provider value={{ unreadCount, notifications, loaded, loadNotifications, markRead, markAllRead, refreshUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider')
  return ctx
}
