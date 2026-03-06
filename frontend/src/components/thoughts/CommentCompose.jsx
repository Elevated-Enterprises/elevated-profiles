import { useState } from 'react'
import { createComment } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

export default function CommentCompose({ thoughtId, minLength = 30, onCommentPosted }) {
  const { user } = useAuth()
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (!user) return null

  const handleSubmit = async () => {
    if (body.trim().length < minLength) return
    setSubmitting(true)
    setError(null)
    try {
      await createComment(thoughtId, body.trim())
      setBody('')
      onCommentPosted?.()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to post comment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border-t border-stone-200 dark:border-stone-700 pt-4 mt-4">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Share your thoughts... (markdown supported)"
        className="w-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-3 text-sm text-stone-700 dark:text-stone-300 resize-none min-h-[80px] focus:ring-2 focus:ring-amber-300 focus:outline-none"
      />
      {error && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{error}</p>}
      <div className="flex justify-between items-center mt-2">
        <span className={`text-xs ${body.length < minLength ? 'text-stone-400 dark:text-stone-500' : 'text-green-600 dark:text-green-500'}`}>
          {body.length} / {minLength} min chars
        </span>
        <button
          disabled={body.trim().length < minLength || submitting}
          onClick={handleSubmit}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold px-4 py-1.5 rounded-lg text-sm transition-colors"
        >
          {submitting ? 'Posting...' : 'Post Comment'}
        </button>
      </div>
    </div>
  )
}
