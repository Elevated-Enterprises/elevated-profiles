import { useState, useEffect } from 'react'
import { createThought, getThoughtRateLimit, uploadThoughtImage } from '../../lib/api'
import ModalBase from '../ModalBase'

export default function ComposeThoughtModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [rateLimit, setRateLimit] = useState(null)
  const [minLength, setMinLength] = useState(150)

  useEffect(() => {
    getThoughtRateLimit()
      .then(({ data }) => setRateLimit(data))
      .catch(() => {})
  }, [])

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Title is required.'); return }
    if (body.trim().length < minLength) { setError(`Body must be at least ${minLength} characters.`); return }

    setSubmitting(true)
    setError(null)
    try {
      const { data: thought } = await createThought({ title: title.trim(), body: body.trim() })

      if (imageFile) {
        try {
          await uploadThoughtImage(thought.id, imageFile)
        } catch {
          // Image upload failure is non-fatal
        }
      }

      onCreated?.(thought)
      onClose()
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to create thought.'
      if (err.response?.status === 429) {
        setError(msg)
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const atLimit = rateLimit && rateLimit.remainingInWindow === 0

  return (
    <ModalBase onClose={onClose} title="New Thought">
      <div className="space-y-4">
        {rateLimit && (
          <div className={`text-xs px-3 py-2 rounded-lg ${atLimit ? 'bg-red-900/30 text-red-400' : 'bg-gray-800 text-gray-400'}`}>
            {atLimit
              ? "You've reached your thought limit for today. Come back tomorrow with fresh ideas."
              : `You have ${rateLimit.remainingInWindow} thought${rateLimit.remainingInWindow === 1 ? '' : 's'} remaining today.`
            }
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-400 mb-1">Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={atLimit}
            placeholder="Give your thought a title..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-yellow-600 focus:outline-none disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Body * (Markdown supported)</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            disabled={atLimit}
            placeholder="Write your thought..."
            rows={8}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 resize-y focus:border-yellow-600 focus:outline-none disabled:opacity-50"
          />
          <div className="flex justify-between text-xs mt-1">
            <span className="text-gray-600">Markdown supported</span>
            <span className={body.length >= minLength ? 'text-green-500' : 'text-gray-600'}>
              {body.length}{body.length < minLength ? ` / ${minLength} min` : ' ✓'}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Image (optional)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleImageChange}
            disabled={atLimit}
            className="text-sm text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-gray-700 file:text-gray-200 file:text-xs hover:file:bg-gray-600"
          />
          {imagePreview && (
            <div className="mt-2 relative inline-block">
              <img src={imagePreview} alt="Preview" className="max-h-32 rounded border border-gray-700" />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null) }}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center"
              >×</button>
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={atLimit || submitting || !title.trim() || body.trim().length < minLength}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-lg text-sm transition-colors"
          >
            {submitting ? 'Publishing...' : 'Publish Thought'}
          </button>
        </div>
      </div>
    </ModalBase>
  )
}
