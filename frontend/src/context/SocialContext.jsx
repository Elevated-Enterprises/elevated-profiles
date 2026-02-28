import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getSocialState, followUser, unfollowUser, ignoreUser, removeIgnoreUser, blockUser, unblockUser } from '../lib/api'
import { useAuth } from './AuthContext'

const SocialContext = createContext(null)

export function SocialProvider({ children }) {
  const { user } = useAuth()
  const [followingIds, setFollowingIds] = useState(new Set())
  const [ignoringIds, setIgnoringIds] = useState(new Set())
  const [blockedIds, setBlockedIds] = useState(new Set())
  const [loaded, setLoaded] = useState(false)

  const loadSocialState = useCallback(async () => {
    if (!user) {
      setFollowingIds(new Set())
      setIgnoringIds(new Set())
      setBlockedIds(new Set())
      setLoaded(true)
      return
    }
    try {
      const { data } = await getSocialState()
      setFollowingIds(new Set(data.followingUserIds))
      setIgnoringIds(new Set(data.ignoringUserIds))
      setBlockedIds(new Set(data.blockedUserIds ?? []))
    } catch {
      // ignore
    } finally {
      setLoaded(true)
    }
  }, [user])

  useEffect(() => {
    loadSocialState()
  }, [loadSocialState])

  const isFollowing = (userId) => followingIds.has(userId)
  const isIgnoring = (userId) => ignoringIds.has(userId)
  const isBlocked = (userId) => blockedIds.has(userId)

  const toggleFollow = async (userSlug, targetUserId) => {
    if (isFollowing(targetUserId)) {
      await unfollowUser(userSlug)
      setFollowingIds(prev => { const next = new Set(prev); next.delete(targetUserId); return next })
    } else {
      await followUser(userSlug)
      setFollowingIds(prev => new Set([...prev, targetUserId]))
    }
  }

  const toggleIgnore = async (userSlug, targetUserId) => {
    if (isIgnoring(targetUserId)) {
      await removeIgnoreUser(userSlug)
      setIgnoringIds(prev => { const next = new Set(prev); next.delete(targetUserId); return next })
    } else {
      await ignoreUser(userSlug)
      setIgnoringIds(prev => new Set([...prev, targetUserId]))
    }
  }

  const toggleBlock = async (userSlug, targetUserId) => {
    if (isBlocked(targetUserId)) {
      await unblockUser(userSlug)
      setBlockedIds(prev => { const next = new Set(prev); next.delete(targetUserId); return next })
    } else {
      await blockUser(userSlug)
      setBlockedIds(prev => new Set([...prev, targetUserId]))
    }
  }

  return (
    <SocialContext.Provider value={{
      followingIds,
      ignoringIds,
      blockedIds,
      isFollowing,
      isIgnoring,
      isBlocked,
      toggleFollow,
      toggleIgnore,
      toggleBlock,
      loaded,
      reload: loadSocialState
    }}>
      {children}
    </SocialContext.Provider>
  )
}

export function useSocial() {
  const ctx = useContext(SocialContext)
  if (!ctx) throw new Error('useSocial must be used within SocialProvider')
  return ctx
}
