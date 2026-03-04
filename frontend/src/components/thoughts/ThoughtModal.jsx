import { useState, useEffect, useCallback, useRef } from 'react'
import { getThought, getActiveEmojis, addReaction, removeReaction, setThoughtHidden } from '../../lib/api'
import { getImageUrl } from '../../lib/api'
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

export default function ThoughtModal({ thoughtId, onClose }) {
  const { user } = useAuth()
  const [thought, setThought] = useState(null)
  const [loading, setLoading] = useState(true)
  const [emojis, setEmojis] = useState([])
  const [showPicker, setShowPicker] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimeout = useRef(null)

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

            {/* Title */}
            <h2 className="text-xl font-bold text-white mb-4">{thought.title}</h2>

            {/* Body */}
            <div className="prose prose-invert prose-sm max-w-none text-gray-300 mb-4">
              <MarkdownRenderer content={thought.body} />
            </div>

            {/* Image */}
            {thought.imageUrl && (
              <div className="mb-4">
                <img
                  src={getImageUrl(thought.imageUrl)}
                  alt=""
                  className="w-full rounded-lg border border-gray-800 max-h-96 object-cover"
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
              <div className="flex gap-4 text-xs text-gray-600 mb-4">
                <span title="Total reads">👁 {thought.readCount} read{thought.readCount !== 1 ? 's' : ''}</span>
                <span title="Unique readers">👤 {thought.uniqueReaderCount} unique reader{thought.uniqueReaderCount !== 1 ? 's' : ''}</span>
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
