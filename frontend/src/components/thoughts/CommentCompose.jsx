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
    <div className="border-t border-gray-800 pt-4 mt-4">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Share your thoughts... (markdown supported)"
        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 resize-none min-h-[80px] focus:border-yellow-600 focus:outline-none"
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      <div className="flex justify-between items-center mt-2">
        <span className={`text-xs ${body.length < minLength ? 'text-gray-600' : 'text-green-600'}`}>
          {body.length} / {minLength} min chars
        </span>
        <button
          disabled={body.trim().length < minLength || submitting}
          onClick={handleSubmit}
          className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold px-4 py-1.5 rounded-lg text-sm transition-colors"
        >
          {submitting ? 'Posting...' : 'Post Comment'}
        </button>
      </div>
    </div>
  )
}
