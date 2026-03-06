import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getImageUrl, deleteComment } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import MarkdownRenderer from '../MarkdownRenderer'
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

export default function CommentList({ comments, onRefresh, isThoughtOwner = false }) {
  const { user } = useAuth()
  const [deletingId, setDeletingId] = useState(null)

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await deleteComment(id)
      onRefresh?.()
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  if (comments.length === 0)
    return <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">No comments yet. Be the first!</p>

  return (
    <div className="space-y-4">
      {comments.map(comment => (
        <div key={comment.id} className="flex gap-3">
          <Link to={`/profiles/${comment.authorSlug}`} className="flex-shrink-0">
            {comment.authorAvatarUrl ? (
              <img src={getImageUrl(comment.authorAvatarUrl)} className="w-8 h-8 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-xs text-stone-500 dark:text-stone-400">
                {comment.authorUsername?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link to={`/profiles/${comment.authorSlug}`} className="text-sm font-semibold text-stone-800 dark:text-white hover:text-amber-600 dark:hover:text-amber-400">
                {comment.authorUsername}
              </Link>
              <span className="text-xs text-stone-400 dark:text-stone-500">{formatRelativeTime(comment.createdAt)}</span>
              {(comment.isOwnComment || user?.isAdmin || isThoughtOwner) && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  disabled={deletingId === comment.id}
                  className="text-xs text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-auto"
                >
                  {deletingId === comment.id ? '...' : 'Delete'}
                </button>
              )}
            </div>
            <div className="text-sm text-stone-700 dark:text-stone-300 prose dark:prose-invert prose-sm max-w-none">
              <MarkdownRenderer content={comment.body} />
            </div>
            {comment.reactions?.length > 0 && (
              <div className="mt-2">
                <ReactionSummary
                  reactions={comment.reactions}
                  targetId={comment.id}
                  targetType="comment"
                  onUpdate={onRefresh}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
