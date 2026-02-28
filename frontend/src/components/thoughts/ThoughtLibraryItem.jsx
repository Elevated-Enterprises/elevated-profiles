import ReactionSummary from '../reactions/ReactionSummary'

export default function ThoughtLibraryItem({ thought, onClick, isOwnProfile, onRefresh }) {
  return (
    <div
      onClick={onClick}
      className="flex items-start justify-between gap-3 p-3 rounded-lg bg-gray-900/60 hover:bg-gray-900 border border-gray-800 hover:border-yellow-600/30 cursor-pointer transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {thought.isPinned && <span className="text-xs text-yellow-600" title="Pinned">📌</span>}
          <span className="font-medium text-white text-sm truncate">{thought.title}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          {thought.tags.map(t => (
            <span key={t} className="text-xs text-yellow-600/80">#{t}</span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <ReactionSummary
          reactions={thought.topReactions}
          targetId={thought.id}
          targetType="thought"
          onUpdate={onRefresh}
        />
        <span className="text-xs text-gray-600">
          {new Date(thought.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}
