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
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg
      ${item.isFromFollowed
        ? 'bg-yellow-950/20 border border-yellow-600/20'
        : 'bg-gray-900/50'
      }`}>
      <Link to={`/profiles/${item.actorSlug}`} className="flex-shrink-0">
        {item.actorAvatarUrl ? (
          <img src={getImageUrl(item.actorAvatarUrl)} className="w-8 h-8 rounded-full object-cover" alt="" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">
            {item.actorUsername?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300">
          <Link to={`/profiles/${item.actorSlug}`} className="font-semibold text-white hover:text-yellow-400">
            {item.actorUsername}
          </Link>
          {' '}{feedItemVerb(item.type)}{' '}
          {item.targetTitle && (
            <button
              onClick={() => onOpenThought?.(item.targetId)}
              className="text-yellow-400 hover:underline"
            >
              &ldquo;{item.targetTitle}&rdquo;
            </button>
          )}
          {item.type === 'status_change' && item.excerpt && (
            <em className="text-gray-300">&ldquo;{item.excerpt}&rdquo;</em>
          )}
          {item.type === 'reaction_milestone' && item.reactionCount && (
            <span className="text-yellow-400">{item.reactionCount} reactions</span>
          )}
        </p>
        {item.excerpt && item.type !== 'status_change' && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{item.excerpt}</p>
        )}
      </div>

      <span className="text-xs text-gray-600 flex-shrink-0">{formatRelativeTime(item.timestamp)}</span>
    </div>
  )
}
