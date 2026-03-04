import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getUser, getImageUrl, deleteCompanion, reorderCompanions, setPrimaryCompanion, getThoughtsByUser, getUserStatus, setStatus } from '../lib/api'
import LanguagesModal from '../components/LanguagesModal'
import { useAuth } from '../context/AuthContext'
import { useSocial } from '../context/SocialContext'
import VisibilityBadge from '../components/VisibilityBadge'
import MarkdownRenderer from '../components/MarkdownRenderer'
import LoadingSpinner from '../components/LoadingSpinner'
import EditProfileModal from '../components/EditProfileModal'
import SkillsModal from '../components/SkillsModal'
import LLMExperienceModal from '../components/LLMExperienceModal'
import EditCompanionModal from '../components/EditCompanionModal'
import EditLinksModal from '../components/EditLinksModal'
import CompanionDetailModal from '../components/CompanionDetailModal'
import CommunityRolesModal from '../components/CommunityRolesModal'
import AmbassadorModal from '../components/AmbassadorModal'
import FollowButton from '../components/social/FollowButton'
import IgnoreButton from '../components/social/IgnoreButton'
import ThoughtLibraryItem from '../components/thoughts/ThoughtLibraryItem'
import ComposeThoughtModal from '../components/thoughts/ComposeThoughtModal'
import ThoughtModal from '../components/thoughts/ThoughtModal'
import TagPill from '../components/ui/TagPill'

const EXPERIENCE_LABELS = {
  0: 'No Experience',
  1: 'Beginner',
  2: 'Advanced',
  3: 'Expert',
}

const ALIGNMENT_LABELS = {
  0: 'Lawful Good',
  1: 'Neutral Good',
  2: 'Chaotic Good',
  3: 'Lawful Neutral',
  4: 'True Neutral',
  5: 'Chaotic Neutral',
  6: 'Lawful Evil',
  7: 'Neutral Evil',
  8: 'Chaotic Evil',
}

function formatTimezone(minutes) {
  if (minutes === 0) return 'UTC+0'
  const sign = minutes > 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, '0')}`
}

function formatJoinDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function SectionEditButton({ onClick, label = 'Edit' }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-500 border border-stone-200 dark:border-stone-600 hover:border-amber-300 dark:hover:border-amber-500 rounded-md px-2 py-0.5 transition-colors"
    >
      ✏ {label}
    </button>
  )
}

export default function ProfileDetail() {
  const { slug } = useParams()
  const { user: authUser } = useAuth()
  const { isBlocked, toggleBlock, loaded: socialLoaded } = useSocial()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Status
  const [currentStatus, setCurrentStatus] = useState(null)
  const [statusInput, setStatusInput] = useState('')
  const [statusEditing, setStatusEditing] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)

  // Local companion list for optimistic drag-and-drop reordering
  const [companions, setCompanions] = useState([])
  const [dragFromIdx, setDragFromIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  // Primary companion
  const [primaryCompanionId, setPrimaryCompanionId] = useState(null)

  // Modal state
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showSkills, setShowSkills] = useState(false)
  const [showLLM, setShowLLM] = useState(false)
  const [showLanguages, setShowLanguages] = useState(false)
  const [showEditLinks, setShowEditLinks] = useState(false)
  const [showCommunityRoles, setShowCommunityRoles] = useState(false)
  const [showAmbassador, setShowAmbassador] = useState(false)
  const [companionModal, setCompanionModal] = useState(null) // null | 'add' | companion object
  const [selectedCompanion, setSelectedCompanion] = useState(null)

  // Thoughts state
  const [thoughts, setThoughts] = useState([])
  const [thoughtsLoading, setThoughtsLoading] = useState(false)
  const [thoughtSearch, setThoughtSearch] = useState('')
  const [activeTag, setActiveTag] = useState(null)
  const [thoughtsExpanded, setThoughtsExpanded] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [openThoughtId, setOpenThoughtId] = useState(null)

  // Bio collapsed/expanded
  const [bioExpanded, setBioExpanded] = useState(false)

  const fetchUser = useCallback(() => {
    return getUser(slug).then((res) => setUser(res.data))
  }, [slug])

  const fetchThoughts = useCallback(async () => {
    setThoughtsLoading(true)
    try {
      const { data } = await getThoughtsByUser(slug)
      setThoughts(data)
    } catch {
      // ignore
    } finally {
      setThoughtsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchUser()
      .catch((err) => {
        if (err.response?.status === 404) setError('Profile not found.')
        else setError('Failed to load profile.')
      })
      .finally(() => setLoading(false))
  }, [fetchUser])

  useEffect(() => {
    fetchThoughts()
  }, [fetchThoughts])

  // Sync local state from user data
  useEffect(() => {
    if (user) {
      setCompanions(user.companions || [])
      setPrimaryCompanionId(user.primaryCompanionId || null)
      // Fetch current status
      getUserStatus(slug).then(({ data }) => {
        setCurrentStatus(data?.text ?? null)
        setStatusInput(data?.text ?? '')
      }).catch(() => {})
    }
  }, [user, slug])

  const handleSaveStatus = async () => {
    setStatusSaving(true)
    try {
      await setStatus(statusInput.trim())
      setCurrentStatus(statusInput.trim() || null)
      setStatusEditing(false)
    } catch { /* ignore */ } finally {
      setStatusSaving(false)
    }
  }

  const handleDeleteCompanion = async (companion) => {
    if (!window.confirm(`Delete companion "${companion.name}"?`)) return
    try {
      await deleteCompanion(slug, companion.id)
      await fetchUser()
    } catch {
      alert('Failed to delete companion.')
    }
  }

  const handleSetPrimary = async (companionId) => {
    const newId = companionId === primaryCompanionId ? null : companionId
    setPrimaryCompanionId(newId)
    try {
      await setPrimaryCompanion(slug, newId)
    } catch {
      setPrimaryCompanionId(primaryCompanionId)
    }
  }

  // Drag-and-drop reordering
  const handleDragStart = (e, idx) => {
    setDragFromIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setDragImage(e.currentTarget, 20, 20)
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIdx !== idx) setDragOverIdx(idx)
  }

  const handleDrop = async (e, idx) => {
    e.preventDefault()
    const from = dragFromIdx
    setDragFromIdx(null)
    setDragOverIdx(null)
    if (from === null || from === idx) return

    const newList = [...companions]
    const [moved] = newList.splice(from, 1)
    newList.splice(idx, 0, moved)

    setCompanions(newList)

    try {
      await reorderCompanions(slug, newList.map((c) => c.id))
    } catch {
      setCompanions(user?.companions || [])
    }
  }

  const handleDragEnd = () => {
    setDragFromIdx(null)
    setDragOverIdx(null)
  }

  if (loading) return <LoadingSpinner className="py-24" />

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-stone-500 dark:text-stone-400 mb-4">{error}</p>
        <Link to="/" className="text-amber-600 hover:text-amber-700 font-medium">
          ← Back to profiles
        </Link>
      </div>
    )
  }

  const birthYear = user.dateOfBirth ? new Date(user.dateOfBirth).getFullYear() : null
  const location = [user.city, user.country].filter(Boolean).join(', ')
  const displayName = user.alternativeName || user.discordUsername
  const isOwn = user.isOwnProfile
  const canEdit = isOwn || authUser?.isAdmin
  const canReorder = isOwn && companions.length > 1

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 mb-6 text-sm transition-colors"
      >
        ← All profiles
      </Link>

      {/* Profile Card */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 overflow-hidden mb-6">
        <div className="relative h-32 overflow-hidden">
          {user.bannerImageUrl ? (
            <img
              src={getImageUrl(user.bannerImageUrl)}
              alt="Profile banner"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-amber-100 via-orange-50 to-stone-100 dark:from-amber-900/30 dark:via-orange-900/20 dark:to-stone-800" />
          )}
          {canEdit && (
            <button
              onClick={() => setShowEditProfile(true)}
              className="absolute top-2 right-2 flex items-center gap-1 text-xs bg-black/30 hover:bg-black/50 text-white rounded-md px-2 py-1 backdrop-blur-sm transition-colors"
            >
              ✏ Banner
            </button>
          )}
        </div>
        <div className="px-6 pb-6">
          <div className="-mt-20 mb-4 flex items-end gap-4">
            {/* User avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-40 h-40 rounded-2xl bg-gradient-to-br from-amber-200 to-orange-200 dark:from-amber-800 dark:to-orange-800 border-4 border-white dark:border-stone-800 shadow-md overflow-hidden">
                {user.profileImageUrl ? (
                  <img
                    src={getImageUrl(user.profileImageUrl)}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl select-none">
                    👤
                  </div>
                )}
              </div>
              {user.ambassadorCommunity && (
                <div className="absolute top-0.5 left-0.5 bg-teal-500 rounded-full w-8 h-8 flex items-center justify-center text-lg shadow border-2 border-white dark:border-stone-800 leading-none" title="Ambassador">
                  🕊️
                </div>
              )}
              {user.communityRoles?.length > 0 && (
                <div className={`absolute bottom-0.5 bg-violet-500 dark:bg-violet-600 rounded-full w-8 h-8 flex items-center justify-center text-lg shadow border-2 border-white dark:border-stone-800 leading-none ${user.isAdmin ? 'right-10' : 'right-0.5'}`} title="Team member">
                  ⭐
                </div>
              )}
              {user.isAdmin && (
                <div className="absolute bottom-0.5 right-0.5 bg-amber-400 dark:bg-amber-500 rounded-full w-8 h-8 flex items-center justify-center text-lg shadow border-2 border-white dark:border-stone-800 leading-none" title="Admin">
                  👑
                </div>
              )}
            </div>
            <div className="mb-2 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 truncate">{displayName}</h1>
                <VisibilityBadge visibility={user.visibility} />
              </div>
              {user.alternativeName && (
                <p className="text-sm text-stone-400 dark:text-stone-500">{user.discordUsername}</p>
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => setShowEditProfile(true)}
                className="flex-shrink-0 mb-2 flex items-center gap-1.5 text-sm text-stone-600 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-500 bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 hover:border-amber-300 dark:hover:border-amber-600 rounded-lg px-4 py-2 shadow-sm transition-colors font-medium"
              >
                ✏ Edit Profile
              </button>
            )}
            {!isOwn && user && authUser && (
              <div className="flex gap-2 mb-2 flex-wrap">
                <FollowButton userSlug={slug} targetUserId={user.userId} />
                <IgnoreButton userSlug={slug} targetUserId={user.userId} />
                {socialLoaded && (
                  <button
                    onClick={async () => {
                      if (!isBlocked(user.userId)) {
                        if (!window.confirm(`Block ${displayName}? They won't be able to comment or react to your content.`)) return
                      }
                      try { await toggleBlock(slug, user.userId) } catch { /* ignore */ }
                    }}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      isBlocked(user.userId)
                        ? 'border-red-700 text-red-400 bg-red-900/20 hover:bg-red-900/40'
                        : 'border-stone-200 dark:border-stone-600 text-stone-400 dark:text-stone-500 hover:border-red-400 hover:text-red-500'
                    }`}
                    title={isBlocked(user.userId) ? 'Unblock user' : 'Block user'}
                  >
                    {isBlocked(user.userId) ? '🚫 Blocked' : 'Block'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Blocked banner (admin view) */}
          {user.isBlocked && (
            <div className="mb-4 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center justify-between gap-3">
              <span>⚠ This profile is blocked and hidden from other users.</span>
              {authUser?.isAdmin && (
                <button
                  onClick={async () => {
                    try {
                      const { setUserBlocked } = await import('../lib/api')
                      await setUserBlocked(slug, false)
                      await fetchUser()
                    } catch { alert('Failed to unblock user.') }
                  }}
                  className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline whitespace-nowrap"
                >
                  Unblock
                </button>
              )}
            </div>
          )}
          {!user.isBlocked && authUser?.isAdmin && !user.isOwnProfile && (
            <div className="mb-4 flex justify-end">
              <button
                onClick={async () => {
                  if (!window.confirm(`Block ${displayName}? Their profile will be hidden from other users.`)) return
                  try {
                    const { setUserBlocked } = await import('../lib/api')
                    await setUserBlocked(slug, true)
                    await fetchUser()
                  } catch { alert('Failed to block user.') }
                }}
                className="text-xs text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 border border-stone-200 dark:border-stone-700 hover:border-red-300 dark:hover:border-red-700 rounded-md px-2 py-0.5 transition-colors"
              >
                Block user
              </button>
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-3 text-sm text-stone-500 dark:text-stone-400 mb-4">
            {birthYear && <span>Born {birthYear}</span>}
            {location && <span>📍 {location}</span>}
            {user.timezoneOffsetMinutes != null && (
              <span>🕐 {formatTimezone(user.timezoneOffsetMinutes)}</span>
            )}
            {user.alignment != null && (
              <span className="text-purple-600 dark:text-purple-400 font-medium">⚔ {ALIGNMENT_LABELS[user.alignment]}</span>
            )}
            {user.joinedAt && (
              <span className="text-stone-400 dark:text-stone-500">Joined {formatJoinDate(user.joinedAt)}</span>
            )}
            {user.lastSeenAt && (
              <span className="text-stone-400 dark:text-stone-500" title={new Date(user.lastSeenAt).toLocaleString()}>
                Last online {formatRelativeTime(user.lastSeenAt)}
              </span>
            )}
            {user.profileUpdatedAt && (
              <span className="text-stone-400 dark:text-stone-500" title={new Date(user.profileUpdatedAt).toLocaleString()}>
                Profile updated {formatRelativeTime(user.profileUpdatedAt)}
              </span>
            )}
          </div>

          {/* Profile visit stats — only visible to the owner */}
          {isOwn && (user.visitCount > 0 || user.uniqueVisitorCount > 0) && (
            <div className="mb-4 flex gap-4 text-xs text-stone-400 dark:text-stone-500">
              <span title="Total visits to your profile">
                👁 {user.visitCount ?? 0} visit{user.visitCount !== 1 ? 's' : ''}
              </span>
              <span title="Unique members who visited your profile">
                👤 {user.uniqueVisitorCount ?? 0} unique visitor{user.uniqueVisitorCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Status */}
          {isOwn ? (
            <div className="mb-4">
              {statusEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value.slice(0, 60))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveStatus(); if (e.key === 'Escape') setStatusEditing(false) }}
                    placeholder="What's on your mind? (max 60 chars)"
                    className="flex-1 text-sm border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-1.5 bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <span className="text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">{statusInput.length}/60</span>
                  <button onClick={handleSaveStatus} disabled={statusSaving} className="text-xs text-amber-600 hover:text-amber-700 font-medium disabled:opacity-50">
                    {statusSaving ? '…' : 'Save'}
                  </button>
                  <button onClick={() => setStatusEditing(false)} className="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setStatusEditing(true)}
                  className="text-sm text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 italic"
                >
                  {currentStatus ? `"${currentStatus}"` : '+ Set a status…'}
                </button>
              )}
            </div>
          ) : currentStatus ? (
            <p className="mb-4 text-sm text-stone-500 dark:text-stone-400 italic">"{currentStatus}"</p>
          ) : null}

          {/* Ambassador banner */}
          {user.ambassadorCommunity && (
            <div className="mb-4 px-4 py-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl flex items-center gap-3">
              <span className="text-2xl">🕊️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-teal-800 dark:text-teal-200">
                  Ambassador of {user.ambassadorCommunity.name} to Second Circuit
                </p>
                <a
                  href={user.ambassadorCommunity.discordInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                >
                  Join {user.ambassadorCommunity.name} on Discord →
                </a>
              </div>
              {authUser?.isAdmin && (
                <SectionEditButton onClick={() => setShowAmbassador(true)} />
              )}
            </div>
          )}
          {!user.ambassadorCommunity && authUser?.isAdmin && (
            <div className="mb-4 flex">
              <SectionEditButton onClick={() => setShowAmbassador(true)} label="Assign Ambassador" />
            </div>
          )}

          {/* Companions — compact horizontal strip */}
          {(canEdit || companions.length > 0) && (
            <div className="mb-4 pt-3 border-t border-stone-100 dark:border-stone-700">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">
                  Companions{companions.length > 0 ? ` (${companions.length})` : ''}
                </span>
                {canReorder && (
                  <span className="text-xs text-stone-300 dark:text-stone-600 select-none">· drag to reorder</span>
                )}
              </div>
              <div className="-mx-6 overflow-x-auto">
                <div className="flex gap-3 pt-8 pb-2 px-6 items-start">
                  {companions.map((companion, idx) => (
                    <div
                      key={companion.id}
                      draggable={canReorder}
                      onDragStart={canReorder ? (e) => handleDragStart(e, idx) : undefined}
                      onDragOver={canReorder ? (e) => handleDragOver(e, idx) : undefined}
                      onDrop={canReorder ? (e) => handleDrop(e, idx) : undefined}
                      onDragEnd={canReorder ? handleDragEnd : undefined}
                      onClick={() => setSelectedCompanion(companion)}
                      className={[
                        'relative flex flex-col items-center w-20 flex-shrink-0 group/comp hover:z-10 transition-all duration-150',
                        canReorder ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                        dragFromIdx === idx ? 'opacity-40' : '',
                        dragOverIdx === idx && dragFromIdx !== idx
                          ? 'outline outline-2 outline-amber-300 dark:outline-amber-600 rounded-xl'
                          : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className={[
                        'w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 group-hover/comp:scale-[1.5] transition-transform duration-200 origin-center flex-shrink-0',
                        companion.id === primaryCompanionId ? 'ring-2 ring-amber-400 dark:ring-amber-400' : '',
                      ].filter(Boolean).join(' ')}>
                        {companion.profileImageUrl ? (
                          <img
                            src={getImageUrl(companion.profileImageUrl)}
                            alt={companion.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl select-none">
                            ✨
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-medium text-stone-700 dark:text-stone-200 mt-1 text-center w-full truncate">
                        {companion.name}
                      </p>
                      {companion.alignment != null && (
                        <p className="text-[10px] text-purple-500 dark:text-purple-400 text-center w-full truncate">
                          {ALIGNMENT_LABELS[companion.alignment]}
                        </p>
                      )}
                    </div>
                  ))}

                  {isOwn && (
                    <button
                      onClick={() => setCompanionModal('add')}
                      className="w-20 h-20 flex-shrink-0 rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-600 hover:border-amber-400 dark:hover:border-amber-500 text-stone-400 dark:text-stone-500 hover:text-amber-500 dark:hover:text-amber-400 flex items-center justify-center text-2xl transition-colors"
                      aria-label="Add companion"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Skills */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">Skills</span>
              {canEdit && <SectionEditButton onClick={() => setShowSkills(true)} />}
            </div>
            {user.skills?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            ) : canEdit ? (
              <p className="text-xs text-stone-400 dark:text-stone-500">No skills added yet.</p>
            ) : null}
          </div>

          {/* LLM Experiences */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">LLM Experience</span>
              {canEdit && <SectionEditButton onClick={() => setShowLLM(true)} />}
            </div>
            {user.llmExperiences?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.llmExperiences.map((exp) => (
                  <span
                    key={exp.llmProviderId}
                    className="bg-stone-50 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs px-3 py-1 rounded-full border border-stone-200 dark:border-stone-600"
                  >
                    {exp.llmProviderName}: {EXPERIENCE_LABELS[exp.experienceLevel]}
                  </span>
                ))}
              </div>
            ) : canEdit ? (
              <p className="text-xs text-stone-400 dark:text-stone-500">No LLM experience added yet.</p>
            ) : null}
          </div>

          {/* Languages */}
          {(canEdit || user.languages?.length > 0) && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">Languages</span>
                {canEdit && <SectionEditButton onClick={() => setShowLanguages(true)} />}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 text-xs px-3 py-1 rounded-full border border-sky-200 dark:border-sky-800">
                  English
                </span>
                {user.languages?.map((lang) => (
                  <span
                    key={lang}
                    className="bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 text-xs px-3 py-1 rounded-full border border-sky-200 dark:border-sky-800"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bio — collapsible */}
          {(canEdit || user.bio) && (
            <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-700">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">Bio</span>
                {canEdit && <SectionEditButton onClick={() => setShowEditProfile(true)} />}
              </div>
              {user.bio ? (
                <>
                  <div className={`overflow-hidden transition-all duration-300 ${bioExpanded ? 'max-h-[2000px]' : 'max-h-24'}`}>
                    <MarkdownRenderer content={user.bio} />
                  </div>
                  <button
                    onClick={() => setBioExpanded(!bioExpanded)}
                    className="mt-2 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                  >
                    {bioExpanded ? '▲ Show less' : '▼ Read more'}
                  </button>
                </>
              ) : (
                <p className="text-xs text-stone-400 dark:text-stone-500">No bio added yet.</p>
              )}
            </div>
          )}

          {/* Links */}
          {(canEdit || user.links?.length > 0) && (
            <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-700">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">Links</span>
                {canEdit && <SectionEditButton onClick={() => setShowEditLinks(true)} />}
              </div>
              {user.links?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                    >
                      {link.label || link.url}
                      <span className="text-amber-400 dark:text-amber-600">↗</span>
                    </a>
                  ))}
                </div>
              ) : canEdit ? (
                <p className="text-xs text-stone-400 dark:text-stone-500">No links added yet.</p>
              ) : null}
            </div>
          )}

          {/* Thoughts Library */}
          {(() => {
            const allTags = [...new Set(thoughts.flatMap(t => t.tags))]
            const filtered = thoughts
              .filter(t => !activeTag || t.tags.includes(activeTag))
              .filter(t => !thoughtSearch || t.title.toLowerCase().includes(thoughtSearch.toLowerCase()))
            const displayed = thoughtsExpanded ? filtered : filtered.slice(0, 10)

            return (
              <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-700">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-200 uppercase tracking-wide">
                    Thoughts {thoughts.length > 0 && <span className="text-stone-400">({thoughts.length})</span>}
                  </h2>
                  {isOwn && (
                    <button
                      onClick={() => setShowCompose(true)}
                      className="text-xs bg-yellow-600 hover:bg-yellow-500 text-black font-semibold px-3 py-1 rounded-lg"
                    >
                      + New Thought
                    </button>
                  )}
                </div>

                {allTags.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-3">
                    <TagPill active={!activeTag} onClick={() => setActiveTag(null)}>All</TagPill>
                    {allTags.map(tag => (
                      <TagPill key={tag} active={activeTag === tag} onClick={() => setActiveTag(tag)}>#{tag}</TagPill>
                    ))}
                  </div>
                )}

                {thoughts.length > 5 && (
                  <input
                    value={thoughtSearch}
                    onChange={e => setThoughtSearch(e.target.value)}
                    placeholder="Search thoughts..."
                    className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-700 dark:text-gray-300 mb-3 focus:border-amber-400 focus:outline-none"
                  />
                )}

                {thoughtsLoading ? (
                  <p className="text-xs text-stone-400 py-4">Loading thoughts...</p>
                ) : filtered.length === 0 ? (
                  <p className="text-xs text-stone-400 py-4">
                    {isOwn ? 'No thoughts yet. Share your first one!' : 'No thoughts published yet.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {displayed.map(t => (
                      <ThoughtLibraryItem
                        key={t.id}
                        thought={t}
                        isOwnProfile={isOwn}
                        onClick={() => setOpenThoughtId(t.id)}
                        onRefresh={fetchThoughts}
                      />
                    ))}
                    {filtered.length > 10 && (
                      <button
                        onClick={() => setThoughtsExpanded(!thoughtsExpanded)}
                        className="w-full mt-2 py-2 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                      >
                        {thoughtsExpanded ? '▲ Show fewer' : `▼ Show all ${filtered.length} thoughts`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Community Roles (admin-managed) */}
          {(authUser?.isAdmin || user.communityRoles?.length > 0) && (
            <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-700">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">Community Roles</span>
                {authUser?.isAdmin && <SectionEditButton onClick={() => setShowCommunityRoles(true)} label="Assign" />}
              </div>
              {user.communityRoles?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {user.communityRoles.map((role) => (
                    <span
                      key={role.id}
                      className="bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs px-3 py-1 rounded-full border border-violet-200 dark:border-violet-800"
                    >
                      {role.name}
                    </span>
                  ))}
                </div>
              ) : authUser?.isAdmin ? (
                <p className="text-xs text-stone-400 dark:text-stone-500">No community roles assigned.</p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEditProfile && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEditProfile(false)}
          onSaved={fetchUser}
        />
      )}
      {showSkills && (
        <SkillsModal
          user={user}
          onClose={() => setShowSkills(false)}
          onSaved={fetchUser}
        />
      )}
      {showLLM && (
        <LLMExperienceModal
          user={user}
          onClose={() => setShowLLM(false)}
          onSaved={fetchUser}
        />
      )}
      {showLanguages && (
        <LanguagesModal
          user={user}
          onClose={() => setShowLanguages(false)}
          onSaved={fetchUser}
        />
      )}
      {showEditLinks && (
        <EditLinksModal
          user={user}
          onClose={() => setShowEditLinks(false)}
          onSaved={fetchUser}
        />
      )}
      {selectedCompanion && (
        <CompanionDetailModal
          companion={selectedCompanion}
          canEdit={canEdit}
          isOwn={isOwn}
          isPrimary={selectedCompanion.id === primaryCompanionId}
          onClose={() => setSelectedCompanion(null)}
          onEdit={() => {
            const comp = selectedCompanion
            setSelectedCompanion(null)
            setCompanionModal(comp)
          }}
          onDelete={handleDeleteCompanion}
          onSetPrimary={() => handleSetPrimary(selectedCompanion.id)}
        />
      )}
      {companionModal && (
        <EditCompanionModal
          userSlug={slug}
          companion={companionModal === 'add' ? null : companionModal}
          onClose={() => setCompanionModal(null)}
          onSaved={fetchUser}
        />
      )}
      {showCommunityRoles && (
        <CommunityRolesModal
          user={user}
          onClose={() => setShowCommunityRoles(false)}
          onSaved={fetchUser}
        />
      )}
      {showAmbassador && (
        <AmbassadorModal
          user={user}
          onClose={() => setShowAmbassador(false)}
          onSaved={fetchUser}
        />
      )}
      {showCompose && (
        <ComposeThoughtModal
          onClose={() => setShowCompose(false)}
          onCreated={fetchThoughts}
        />
      )}
      {openThoughtId && (
        <ThoughtModal
          thoughtId={openThoughtId}
          onClose={() => setOpenThoughtId(null)}
        />
      )}
    </div>
  )
}
