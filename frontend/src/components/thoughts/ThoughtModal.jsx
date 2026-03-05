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
  const [emojis, setEmojis] = useState([])
  const [showPicker, setShowPicker] = useState(false)
  const [copied, setCopied] = useState(false)
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
    } catch {
      // ignore
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

  const handleReactionToggle = async (emojiKey) => {
    if (!user || !thought) return
    const existing = thought.reactions.find(r => r.emojiKey === emojiKey && r.userHasReacted)
    try {
      if (existing) {
        await removeReaction(thoughtId, 'thought', emojiKey)
      } else {
        await addReaction(thoughtId, 'thought', emojiKey)
      }
      loadThought()
    } catch { /* ignore */ }
    setShowPicker(false)
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
      <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-2xl my-8 relative">
        {/* Toolbar: copy link + close */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {thought && (
            <button
              onClick={handleCopyLink}
              title="Copy link to this thought"
              className="text-gray-500 hover:text-gray-200 transition-colors p-1"
            >
              {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 text-lg leading-none"
          >✕</button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : !thought ? (
          <div className="p-8 text-center text-gray-500">Thought not found.</div>
        ) : (
          <div className="p-6">
            {/* Author row */}
            <div className="flex items-center gap-3 mb-4">
              <Link to={`/profiles/${thought.authorSlug}`} className="flex-shrink-0">
                {thought.authorAvatarUrl ? (
                  <img src={getImageUrl(thought.authorAvatarUrl)} className="w-10 h-10 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm text-gray-400">
                    {thought.authorUsername?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </Link>
              <div className="flex-1">
                <Link to={`/profiles/${thought.authorSlug}`} className="font-semibold text-white hover:text-yellow-400 text-sm">
                  {thought.authorUsername}
                </Link>
                <p className="text-xs text-gray-500">{formatDate(thought.createdAt)}</p>
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
                  className="text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
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
                      ? 'border-green-700 text-green-400 hover:bg-green-900/20'
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
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-bold text-xl focus:border-yellow-600 focus:outline-none"
                />
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  rows={10}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 resize-y focus:border-yellow-600 focus:outline-none"
                />
                {editError && <p className="text-red-400 text-sm">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={editSaving || !editTitle.trim()}
                    className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-black font-semibold rounded text-sm transition-colors"
                  >
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-1 text-gray-400 hover:text-gray-200 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Title */}
                <h2 className="text-xl font-bold text-white mb-4">{thought.title}</h2>

                {/* Body */}
                <div className="prose prose-invert prose-sm max-w-none text-gray-300 mb-4">
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
                  className="max-w-full h-auto rounded-lg border border-gray-800"
                  style={{ maxHeight: '32rem' }}
                />
              </div>
            )}

            {/* Tags */}
            {thought.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">
                {thought.tags.map(t => (
                  <span key={t} className="text-xs bg-gray-800 border border-gray-700 text-yellow-600 px-2 py-0.5 rounded">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Reactions */}
            <div className="border-t border-gray-800 pt-4 mb-4">
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
                      className="text-sm text-gray-500 hover:text-gray-300 border border-gray-700 rounded-full px-2 py-0.5"
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
            </div>

            {/* Read stats */}
            {(thought.readCount > 0 || thought.uniqueReaderCount > 0) && (
              <div className="flex gap-4 text-xs text-gray-600 mb-4 items-center flex-wrap">
                <span title="Total reads">👁 {thought.readCount} read{thought.readCount !== 1 ? 's' : ''}</span>
                <span title="Unique readers">👤 {thought.uniqueReaderCount} unique reader{thought.uniqueReaderCount !== 1 ? 's' : ''}</span>
                {thought.isOwnThought && (
                  <button
                    onClick={handleLoadInsights}
                    className="text-xs text-gray-500 hover:text-yellow-400 underline transition-colors"
                  >
                    {showInsights ? 'Hide details' : 'Show details'}
                  </button>
                )}
              </div>
            )}

            {/* Insights panel — only visible to thought owner */}
            {thought.isOwnThought && showInsights && (
              <div className="mb-4 bg-gray-900 border border-gray-800 rounded-lg p-4 text-xs space-y-4">
                {insightsLoading ? (
                  <p className="text-gray-500">Loading insights…</p>
                ) : insights ? (
                  <>
                    {insights.reactionGroups.length > 0 && (
                      <div>
                        <p className="text-gray-400 font-semibold mb-2">Reactions</p>
                        <div className="space-y-2">
                          {insights.reactionGroups.map(g => (
                            <div key={g.emojiKey}>
                              <span className="text-gray-300">{g.emoji} {g.label} ({g.reactors.length})</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {g.reactors.map(r => (
                                  <Link key={r.slug} to={`/profiles/${r.slug}`} onClick={onClose}
                                    className="text-gray-500 hover:text-yellow-400 transition-colors">
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
                        <p className="text-gray-400 font-semibold mb-2">Readers ({insights.readers.length})</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {insights.readers.map(r => (
                            <div key={r.slug} className="flex items-center justify-between">
                              <Link to={`/profiles/${r.slug}`} onClick={onClose}
                                className="text-gray-300 hover:text-yellow-400 transition-colors">
                                {r.username}
                              </Link>
                              <span className="text-gray-600">{formatRelativeTime(r.readAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {insights.reactionGroups.length === 0 && insights.readers.length === 0 && (
                      <p className="text-gray-600">No interactions yet.</p>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {/* Comments */}
            <div className="border-t border-gray-800 pt-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-4">
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
