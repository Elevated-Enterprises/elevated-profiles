import { getImageUrl } from '../../lib/api'
import ReactionSummary from '../reactions/ReactionSummary'

function formatRelativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function CompactThoughtCard({ thought, onClick, onRefresh }) {
  return (
    <div
      onClick={onClick}
      className="p-4 bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-amber-300/30 dark:hover:border-amber-600/30 cursor-pointer transition-colors mb-3"
    >
      <div className="flex items-center gap-2 mb-2">
        {thought.authorAvatarUrl ? (
          <img src={getImageUrl(thought.authorAvatarUrl)} className="w-6 h-6 rounded-full object-cover" alt="" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-xs text-stone-500 dark:text-stone-400">
            {thought.authorUsername?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <span className="text-sm font-medium text-stone-800 dark:text-white">{thought.authorUsername}</span>
        {thought.isFromFollowed && (
          <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">following</span>
        )}
        <span className="text-xs text-stone-400 dark:text-stone-500 ml-auto">{formatRelativeTime(thought.createdAt)}</span>
      </div>

      <h3 className="font-semibold text-stone-800 dark:text-white mb-1">{thought.title}</h3>
      <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2">{thought.excerpt}</p>

      <div className="flex items-center gap-3 mt-3">
        <ReactionSummary
          reactions={thought.topReactions}
          targetId={thought.id}
          targetType="thought"
          onUpdate={onRefresh}
        />
        <div className="flex gap-1 ml-auto">
          {thought.tags.map(tag => (
            <span key={tag} className="text-xs text-amber-600/80 dark:text-amber-400/80">#{tag}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
