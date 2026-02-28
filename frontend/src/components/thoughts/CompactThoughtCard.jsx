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
      className="p-4 bg-gray-900/60 rounded-xl border border-gray-800 hover:border-yellow-600/30 cursor-pointer transition-colors mb-3"
    >
      <div className="flex items-center gap-2 mb-2">
        {thought.authorAvatarUrl ? (
          <img src={getImageUrl(thought.authorAvatarUrl)} className="w-6 h-6 rounded-full object-cover" alt="" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">
            {thought.authorUsername?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <span className="text-sm font-medium text-white">{thought.authorUsername}</span>
        {thought.isFromFollowed && (
          <span className="text-xs bg-yellow-600/20 text-yellow-500 px-1.5 py-0.5 rounded">following</span>
        )}
        <span className="text-xs text-gray-600 ml-auto">{formatRelativeTime(thought.createdAt)}</span>
      </div>

      <h3 className="font-semibold text-white mb-1">{thought.title}</h3>
      <p className="text-sm text-gray-400 line-clamp-2">{thought.excerpt}</p>

      <div className="flex items-center gap-3 mt-3">
        <ReactionSummary
          reactions={thought.topReactions}
          targetId={thought.id}
          targetType="thought"
          onUpdate={onRefresh}
        />
        <div className="flex gap-1 ml-auto">
          {thought.tags.map(tag => (
            <span key={tag} className="text-xs text-yellow-600/80">#{tag}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
