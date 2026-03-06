import { useState, useEffect } from 'react'
import ModalBase from './ModalBase'
import { getImageUrl, getReactions, getActiveEmojis, addReaction, removeReaction, getCompanionReactionInsights } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import VisibilityBadge from './VisibilityBadge'
import MarkdownRenderer from './MarkdownRenderer'
import ReactionSummary from './reactions/ReactionSummary'
import ReactionPicker from './reactions/ReactionPicker'
import { Link } from 'react-router-dom'

const ALIGNMENT_LABELS = {
  0: 'Lawful Good', 1: 'Neutral Good', 2: 'Chaotic Good',
  3: 'Lawful Neutral', 4: 'True Neutral', 5: 'Chaotic Neutral',
  6: 'Lawful Evil', 7: 'Neutral Evil', 8: 'Chaotic Evil',
}

export default function CompanionDetailModal({ companion, userSlug, canEdit, isOwn, isPrimary, onClose, onEdit, onDelete, onSetPrimary }) {
  const { user } = useAuth()
  const birthYear = companion.dateOfBirth ? new Date(companion.dateOfBirth).getFullYear() : null

  const [reactions, setReactions] = useState([])
  const [emojis, setEmojis] = useState([])
  const [showPicker, setShowPicker] = useState(false)

  const [showInsights, setShowInsights] = useState(false)
  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  useEffect(() => {
    getReactions(companion.id, 'companion').then(({ data }) => setReactions(data)).catch(() => {})
    getActiveEmojis().then(({ data }) => setEmojis(data)).catch(() => {})
  }, [companion.id])

  const loadReactions = () => {
    getReactions(companion.id, 'companion').then(({ data }) => setReactions(data)).catch(() => {})
  }

  const handleReactionToggle = async (emojiKey) => {
    if (!user) return
    const existing = reactions.find(r => r.emojiKey === emojiKey && r.userHasReacted)
    try {
      if (existing) {
        await removeReaction(companion.id, 'companion', emojiKey)
      } else {
        await addReaction(companion.id, 'companion', emojiKey)
      }
      loadReactions()
    } catch { /* ignore */ }
    setShowPicker(false)
  }

  const handleLoadInsights = async () => {
    if (insights) { setShowInsights(v => !v); return }
    setInsightsLoading(true)
    setShowInsights(true)
    try {
      const { data } = await getCompanionReactionInsights(userSlug, companion.id)
      setInsights(data)
    } catch {
      setInsights(null)
      setShowInsights(false)
    } finally {
      setInsightsLoading(false)
    }
  }

  const handleDelete = () => {
    onClose()
    onDelete(companion)
  }

  return (
    <ModalBase title={companion.name} onClose={onClose}>
      <div className="space-y-4">
        {/* Image */}
        {companion.profileImageUrl && (
          <div className="flex justify-center">
            <div className={`w-48 h-48 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 ${isPrimary ? 'ring-2 ring-amber-400 dark:ring-amber-400' : ''}`}>
              <img
                src={getImageUrl(companion.profileImageUrl)}
                alt={companion.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <VisibilityBadge visibility={companion.visibility} />
          {isPrimary && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">⭐ Primary</span>
          )}
          {companion.alignment != null && (
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
              ⚔ {ALIGNMENT_LABELS[companion.alignment]}
            </span>
          )}
        </div>

        {/* Meta */}
        {(companion.role || companion.platform) && (
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {[companion.role, companion.platform].filter(Boolean).join(' · ')}
          </p>
        )}
        {birthYear && (
          <p className="text-sm text-stone-500 dark:text-stone-400">Born {birthYear}</p>
        )}

        {/* Bio */}
        {companion.bio && (
          <div className="pt-2 border-t border-stone-100 dark:border-stone-700">
            <MarkdownRenderer content={companion.bio} />
          </div>
        )}

        {/* Reactions */}
        <div className="pt-2 border-t border-stone-100 dark:border-stone-700">
          <div className="flex items-center gap-3 flex-wrap">
            <ReactionSummary
              reactions={reactions}
              targetId={companion.id}
              targetType="companion"
              onUpdate={loadReactions}
            />
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowPicker(!showPicker)}
                  className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 border border-stone-200 dark:border-stone-600 rounded-full px-2 py-0.5"
                >
                  + React
                </button>
                {showPicker && (
                  <div className="absolute bottom-full left-0 mb-2 z-20">
                    <ReactionPicker
                      emojis={emojis}
                      userReactions={reactions.filter(r => r.userHasReacted).map(r => r.emojiKey)}
                      onSelect={handleReactionToggle}
                      onClose={() => setShowPicker(false)}
                    />
                  </div>
                )}
              </div>
            )}
            {isOwn && (
              <button
                onClick={handleLoadInsights}
                className="text-xs text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 underline transition-colors"
              >
                {showInsights ? 'Hide insights' : 'Insights'}
              </button>
            )}
          </div>

          {/* Insights panel — only for companion owner */}
          {isOwn && showInsights && (
            <div className="mt-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-3 text-xs space-y-3">
              {insightsLoading ? (
                <p className="text-stone-400">Loading insights…</p>
              ) : insights && insights.length > 0 ? (
                insights.map(g => (
                  <div key={g.emojiKey}>
                    <span className="text-stone-600 dark:text-stone-300 font-semibold">{g.emoji} {g.label} ({g.reactors.length})</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {g.reactors.map(r => (
                        <Link key={r.slug} to={`/profiles/${r.slug}`} onClick={onClose}
                          className="text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                          {r.username}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))
              ) : insights ? (
                <p className="text-stone-400">No reactions yet.</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Actions */}
        {(canEdit || isOwn) && (
          <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-700 flex-wrap">
            {isOwn && (
              <button
                onClick={onSetPrimary}
                className={`flex items-center gap-1 text-sm border rounded-lg px-3 py-1.5 transition-colors ${
                  isPrimary
                    ? 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-600 hover:border-amber-400'
                    : 'text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-600 hover:text-amber-600 hover:border-amber-300'
                }`}
              >
                {isPrimary ? '⭐ Primary' : '☆ Set as Primary'}
              </button>
            )}
            {canEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-500 border border-stone-200 dark:border-stone-600 hover:border-amber-300 rounded-lg px-3 py-1.5 transition-colors"
              >
                ✏ Edit
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 text-sm text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-auto"
              >
                🗑 Delete
              </button>
            )}
          </div>
        )}
      </div>
    </ModalBase>
  )
}
