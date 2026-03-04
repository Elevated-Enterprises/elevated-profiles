import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { getRulesUnreadCount, markRuleRead } from '../lib/api'

const RulesContext = createContext({ unreadCount: 0, markRead: async () => {} })

export function RulesProvider({ children }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    getRulesUnreadCount()
      .then((res) => setUnreadCount(res.data.count))
      .catch(() => {})
  }, [user])

  const markRead = async (ruleId) => {
    // Optimistic: decrement immediately so badge disappears at once
    setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await markRuleRead(ruleId)
    } catch {
      // Revert on failure — next page load will re-fetch the correct count
      setUnreadCount((c) => c + 1)
    }
  }

  return (
    <RulesContext.Provider value={{ unreadCount, markRead }}>
      {children}
    </RulesContext.Provider>
  )
}

export const useRules = () => useContext(RulesContext)
