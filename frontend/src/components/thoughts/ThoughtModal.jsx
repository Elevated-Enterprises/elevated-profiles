import { useState, useEffect, useCallback, useRef } from 'react'
import { getThought, getActiveEmojis, addReaction, removeReaction, setThoughtHidden, updateThought, getThoughtInsights, getImageUrl } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import MarkdownRenderer from '../MarkdownRenderer'
import CommentList from './CommentList'
import CommentCompose from './CommentCompose'
import ReactionSummary from '../reactions/ReactionSummary'
import ReactionPicker from '../reactions/ReactionPicker'
import FollowButton from '../social/FollowButton'
import IgnoreButton from '../social/IgnoreButton'
import { Link } from 'react-router-dom'

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatRelativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function ThoughtModal({ thoughtId, onClose }) {
  const { user } = useAuth()
  const [thought, setThought] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [emojis, setEmojis] = useState([])
  const [showPicker, setShowPicker] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reactionError, setReactionError] = useState(null)
  const copyTimeout = useRef(null)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  // Insights state
  const [showInsights, setShowInsights] = useState(false)
  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  // PB-03: Escape key closes modal
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleCopyLink = () => {
    if (!thought) return
    const url = `${window.location.origin}/thoughts/${thought.slug}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    clearTimeout(copyTimeout.current)
    copyTimeout.current = setTimeout(() => setCopied(false), 2000)
  }

  const loadThought = useCallback(async () => {
    try {
      const { data } = await getThought(thoughtId)
      setThought(data)
      setLoadError(null)
    } catch {
      setLoadError('Failed to load thought.')
    } finally {
      setLoading(false)
    }
  }, [thoughtId])

  useEffect(() => {
    loadThought()
    getActiveEmojis().then(({ data }) => setEmojis(data)).catch(() => {})
  }, [loadThought])

  const handleStartEdit = () => {
    if (!thought) return
    setEditTitle(thought.title)
    setEditBody(thought.body)
    setEditError(null)
    setEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) { setEditError('Title is required.'); return }
    setEditSaving(true)
    setEditError(null)
    try {
      await updateThought(thoughtId, { title: editTitle.trim(), body: editBody.trim() })
      setEditing(false)
      loadThought()
    } catch {
      setEditError('Failed to save changes.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleLoadInsights = async () => {
    if (insights) { setShowInsights(v => !v); return }
    setInsightsLoading(true)
    setShowInsights(true)
    try {
      const { data } = await getThoughtInsights(thoughtId)
      setInsights(data)
    } catch {
      setInsights(null)
      setShowInsights(false)
    } finally {
      setInsightsLoading(false)
    }
  }

  // PB-11: Optimistic reaction updates
  const handleReactionToggle = async (emojiKey) => {
    if (!user || !thought) return
    const existing = thought.reactions.find(r => r.emojiKey === emojiKey && r.userHasReacted)
    const reactionExists = thought.reactions.find(r => r.emojiKey === emojiKey)

    setThought(prev => {
      let updatedReactions
      if (existing) {
        updatedReactions = prev.reactions
          .map(r => r.emojiKey === emojiKey ? { ...r, count: r.count - 1, userHasReacted: false } : r)
          .filter(r => r.count > 0)
      } else if (reactionExists) {
        updatedReactions = prev.reactions.map(r =>
          r.emojiKey === emojiKey ? { ...r, count: r.count + 1, userHasReacted: true } : r
        )
      } else {
        const emojiMeta = emojis.find(e => e.key === emojiKey) || { key: emojiKey, emoji: emojiKey, label: emojiKey }
        updatedReactions = [...prev.reactions, { emojiKey, count: 1, userHasReacted: true, emoji: emojiMeta.emoji, label: emojiMeta.label }]
      }
      return { ...prev, reactions: updatedReactions }
    })

    setReactionError(null)
    setShowPicker(false)

    try {
      if (existing) {
        await removeReaction(thoughtId, 'thought', emojiKey)
      } else {
        await addReaction(thoughtId, 'thought', emojiKey)
      }
    } catch {
      setReactionError('Failed to update reaction.')
      loadThought()
    }
  }

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={handleBackdrop}
    >
      {/* PB-05: role="dialog", aria-modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={thought?.title ?? 'Thought'}
        className="bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-2xl my-8"
      >
        {/* PB-04: Header row with copy-link + close (no absolute positioning) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            {thought && (
              <button
                onClick={handleCopyLink}
                title="Copy link to this thought"
                className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors p-1"
              >
                {copied ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )}
          </div>
          {/* PB-04: same close button style as ModalBase */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-stone-400 dark:text-stone-500">Loading...</div>
        ) : loadError ? (
          <div className="p-8 text-center">
            <p className="text-red-500 dark:text-red-400 text-sm mb-3">{loadError}</p>
            <button onClick={loadThought} className="text-sm text-amber-600 dark:text-amber-400 hover:underline">Retry</button>
          </div>
        ) : !thought ? (
          <div className="p-8 text-center text-stone-400 dark:text-stone-500">Thought not found.</div>
        ) : (
          <div className="p-6">
            {/* Author row */}
            <div className="flex items-center gap-3 mb-4">
              <Link to={`/profiles/${thought.authorSlug}`} className="flex-shrink-0">
                {thought.authorAvatarUrl ? (
                  <img src={getImageUrl(thought.authorAvatarUrl)} className="w-10 h-10 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                    {thought.authorUsername?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </Link>
              <div className="flex-1">
                <Link to={`/profiles/${thought.authorSlug}`} className="font-semibold text-stone-800 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 text-sm">
                  {thought.authorUsername}
                </Link>
                <p className="text-xs text-stone-400 dark:text-stone-500">{formatDate(thought.createdAt)}</p>
              </div>
              {!thought.isOwnThought && user && (
                <div className="flex gap-2">
                  <FollowButton userSlug={thought.authorSlug} targetUserId={thought.authorUserId} />
                  <IgnoreButton userSlug={thought.authorSlug} targetUserId={thought.authorUserId} />
                </div>
              )}
              {thought.isOwnThought && !editing && (
                <button
                  onClick={handleStartEdit}
                  className="text-xs px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:border-stone-300 dark:hover:border-stone-500 transition-colors"
                >
                  Edit
                </button>
              )}
              {user?.isAdmin && (
                <button
                  onClick={async () => {
                    try {
                      await setThoughtHidden(thought.id, !thought.isHidden)
                      loadThought()
                    } catch { /* ignore */ }
                  }}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    thought.isHidden
                      ? 'border-green-700 text-green-500 hover:bg-green-900/20'
                      : 'border-red-800 text-red-400 hover:bg-red-900/20'
                  }`}
                  title={thought.isHidden ? 'Unhide thought' : 'Hide thought from all feeds'}
                >
                  {thought.isHidden ? 'Unhide' : 'Hide'}
                </button>
              )}
            </div>

            {/* Edit form */}
            {editing ? (
              <div className="mb-4 space-y-3">
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-stone-800 dark:text-white font-bold text-xl focus:ring-2 focus:ring-amber-300 focus:outline-none"
                />
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={10}
                  className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-700 dark:text-stone-300 resize-y focus:ring-2 focus:ring-amber-300 focus:outline-none"
                />
                {editError && <p className="text-red-500 dark:text-red-400 text-sm">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={editSaving || !editTitle.trim()}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold rounded text-sm transition-colors"
                  >
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-1 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Title */}
                <h2 className="text-xl font-bold text-stone-800 dark:text-white mb-4">{thought.title}</h2>

                {/* Body */}
                <div className="prose dark:prose-invert prose-sm max-w-none text-stone-700 dark:text-stone-300 mb-4">
                  <MarkdownRenderer content={thought.body} />
                </div>
              </>
            )}

            {/* Image */}
            {thought.imageUrl && (
              <div className="mb-4 flex justify-center">
                <img
                  src={getImageUrl(thought.imageUrl)}
                  alt=""
                  className="max-w-full h-auto rounded-lg border border-stone-200 dark:border-stone-700"
                  style={{ maxHeight: '32rem' }}
                />
              </div>
            )}

            {/* Tags */}
            {thought.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">
                {thought.tags.map(t => (
                  <span key={t} className="text-xs bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-amber-600 dark:text-amber-500 px-2 py-0.5 rounded">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Reactions */}
            <div className="border-t border-stone-200 dark:border-stone-800 pt-4 mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <ReactionSummary
                  reactions={thought.reactions}
                  targetId={thought.id}
                  targetType="thought"
                  onUpdate={loadThought}
                />
                {user && (
                  <div className="relative">
                    <button
                      onClick={() => setShowPicker(!showPicker)}
                      aria-label="Add a reaction"
                      className="text-sm text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-full px-2 py-0.5"
                    >
                      + React
                    </button>
                    {showPicker && (
                      <div className="absolute bottom-full left-0 mb-2 z-20">
                        <ReactionPicker
                          emojis={emojis}
                          userReactions={thought.reactions.filter(r => r.userHasReacted).map(r => r.emojiKey)}
                          onSelect={handleReactionToggle}
                          onClose={() => setShowPicker(false)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              {reactionError && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-2" aria-live="polite">{reactionError}</p>
              )}
            </div>

            {/* Read stats */}
            {(thought.readCount > 0 || thought.uniqueReaderCount > 0) && (
              <div className="flex gap-4 text-xs text-stone-400 dark:text-stone-500 mb-4 items-center flex-wrap">
                <span title="Total reads">👁 {thought.readCount} read{thought.readCount !== 1 ? 's' : ''}</span>
                <span title="Unique readers">👤 {thought.uniqueReaderCount} unique reader{thought.uniqueReaderCount !== 1 ? 's' : ''}</span>
                {thought.isOwnThought && (
                  <button
                    onClick={handleLoadInsights}
                    className="text-xs text-stone-400 dark:text-stone-500 hover:text-amber-500 dark:hover:text-amber-400 underline transition-colors"
                  >
                    {showInsights ? 'Hide details' : 'Show details'}
                  </button>
                )}
              </div>
            )}

            {/* Insights panel */}
            {thought.isOwnThought && showInsights && (
              <div className="mb-4 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-4 text-xs space-y-4">
                {insightsLoading ? (
                  <p className="text-stone-400 dark:text-stone-500">Loading insights…</p>
                ) : insights ? (
                  <>
                    {insights.reactionGroups.length > 0 && (
                      <div>
                        <p className="text-stone-500 dark:text-stone-400 font-semibold mb-2">Reactions</p>
                        <div className="space-y-2">
                          {insights.reactionGroups.map(g => (
                            <div key={g.emojiKey}>
                              <span className="text-stone-700 dark:text-stone-300">{g.emoji} {g.label} ({g.reactors.length})</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {g.reactors.map(r => (
                                  <Link key={r.slug} to={`/profiles/${r.slug}`} onClick={onClose}
                                    className="text-stone-400 dark:text-stone-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors">
                                    {r.username}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {insights.readers.length > 0 && (
                      <div>
                        <p className="text-stone-500 dark:text-stone-400 font-semibold mb-2">Readers ({insights.readers.length})</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {insights.readers.map(r => (
                            <div key={r.slug} className="flex items-center justify-between">
                              <Link to={`/profiles/${r.slug}`} onClick={onClose}
                                className="text-stone-700 dark:text-stone-300 hover:text-amber-500 dark:hover:text-amber-400 transition-colors">
                                {r.username}
                              </Link>
                              <span className="text-stone-400 dark:text-stone-500">{formatRelativeTime(r.readAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {insights.reactionGroups.length === 0 && insights.readers.length === 0 && (
                      <p className="text-stone-400 dark:text-stone-500">No interactions yet.</p>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {/* Comments */}
            <div className="border-t border-stone-200 dark:border-stone-800 pt-4">
              <h3 className="text-sm font-semibold text-stone-500 dark:text-stone-400 mb-4">
                Comments ({thought.comments.length})
              </h3>
              <CommentList comments={thought.comments} onRefresh={loadThought} isThoughtOwner={thought.isOwnThought} />
              <CommentCompose thoughtId={thought.id} onCommentPosted={loadThought} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
