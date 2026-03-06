import { Link } from 'react-router-dom'
import { getImageUrl } from '../../lib/api'

function feedItemVerb(type) {
  switch (type) {
    case 'new_thought': return 'shared a thought:'
    case 'new_comment': return 'commented on'
    case 'reaction_milestone': return '— reactions on'
    case 'status_change': return 'is thinking:'
    default: return 'did something with'
  }
}

function formatRelativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function FeedItem({ item, onOpenThought }) {
  if (item.type === 'reaction_milestone') return null

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg
      ${item.isFromFollowed
        ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-600/20'
        : 'bg-stone-50 dark:bg-stone-900/50'
      }`}>
      <Link to={`/profiles/${item.actorSlug}`} className="flex-shrink-0">
        {item.actorAvatarUrl ? (
          <img src={getImageUrl(item.actorAvatarUrl)} className="w-8 h-8 rounded-full object-cover" alt="" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-xs text-stone-500 dark:text-stone-400">
            {item.actorUsername?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-700 dark:text-stone-300">
          <Link to={`/profiles/${item.actorSlug}`} className="font-semibold text-stone-800 dark:text-white hover:text-amber-600 dark:hover:text-amber-400">
            {item.actorUsername}
          </Link>
          {' '}{feedItemVerb(item.type)}{' '}
          {item.targetTitle && (
            <button
              onClick={() => onOpenThought?.(item.targetId)}
              className="text-amber-600 dark:text-amber-400 hover:underline"
            >
              &ldquo;{item.targetTitle}&rdquo;
            </button>
          )}
          {item.type === 'status_change' && item.excerpt && (
            <em className="text-stone-700 dark:text-stone-300">&ldquo;{item.excerpt}&rdquo;</em>
          )}
          {item.type === 'reaction_milestone' && item.reactionCount && (
            <span className="text-amber-600 dark:text-amber-400">{item.reactionCount} reactions</span>
          )}
        </p>
        {item.excerpt && item.type !== 'status_change' && (
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5 truncate">{item.excerpt}</p>
        )}
      </div>

      <span className="text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">{formatRelativeTime(item.timestamp)}</span>
    </div>
  )
}
