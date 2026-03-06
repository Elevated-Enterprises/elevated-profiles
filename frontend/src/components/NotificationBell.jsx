import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function NotificationBell() {
  const { unreadCount, notifications, loaded, loadNotifications, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open && !loaded) loadNotifications()
    if (open && loaded) loadNotifications() // refresh on open
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleClick = (notification) => {
    if (!notification.isRead) markRead(notification.id)
    if (notification.relatedEntityId) {
      setOpen(false)
      navigate(`/applications/${notification.relatedEntityId}`)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors leading-none px-1"
        aria-label="Notifications"
        title="Notifications"
      >
        <span className="text-base">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-white text-[9px] font-bold items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-100 dark:border-stone-700 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-700">
            <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!loaded && (
              <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-6">Loading…</p>
            )}
            {loaded && notifications.length === 0 && (
              <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-6">No notifications yet.</p>
            )}
            {loaded && notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 border-b border-stone-50 dark:border-stone-800 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors ${!n.isRead ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${!n.isRead ? 'bg-amber-500' : 'bg-transparent'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-stone-800 dark:text-stone-100 leading-snug">{n.title}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
