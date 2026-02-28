import { addReaction, removeReaction } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

export default function ReactionSummary({ reactions, targetId, targetType, onUpdate }) {
  const { user } = useAuth()

  const handleToggle = async (emojiKey, userHasReacted) => {
    if (!user) return
    try {
      if (userHasReacted) {
        await removeReaction(targetId, targetType, emojiKey)
      } else {
        await addReaction(targetId, targetType, emojiKey)
      }
      onUpdate?.()
    } catch {
      // ignore
    }
  }

  if (!reactions || reactions.length === 0) return null

  return (
    <div className="flex gap-2 flex-wrap">
      {reactions.map(r => (
        <button
          key={r.emojiKey}
          onClick={() => handleToggle(r.emojiKey, r.userHasReacted)}
          disabled={!user}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm border transition-colors
            ${r.userHasReacted
              ? 'border-yellow-500 bg-yellow-600/20 text-yellow-300'
              : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 disabled:cursor-default'
            }`}
        >
          <span>{r.emoji}</span>
          <span className="text-xs">{r.count}</span>
        </button>
      ))}
    </div>
  )
}
