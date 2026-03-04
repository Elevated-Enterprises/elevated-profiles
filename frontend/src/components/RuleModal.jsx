import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import ModalBase from './ModalBase'
import { createRule, updateRule } from '../lib/api'

export default function RuleModal({ rule, onClose, onSaved }) {
  const isEditing = !!rule

  const [title, setTitle] = useState(rule?.title ?? '')
  const [summary, setSummary] = useState(rule?.summary ?? '')
  const [body, setBody] = useState(rule?.body ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showPreview, setShowPreview] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !summary.trim() || !body.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (isEditing) {
        await updateRule(rule.id, { title, summary, body })
      } else {
        await createRule({ title, summary, body })
      }
      onSaved()
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalBase title={isEditing ? 'Edit Rule' : 'New Rule'} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. § 1 Be Respectful"
            required
            className="w-full rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
            Summary
            <span className="ml-1 font-normal text-stone-400 dark:text-stone-500">(shown on the overview card)</span>
          </label>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="A short description for the overview page"
            required
            className="w-full rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              Body
              <span className="ml-1 font-normal text-stone-400 dark:text-stone-500">(Markdown)</span>
            </label>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="text-xs text-amber-600 dark:text-amber-500 hover:underline"
            >
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          </div>

          {showPreview ? (
            <div className="prose prose-stone prose-sm dark:prose-invert max-w-none min-h-[200px] rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800/50 px-3 py-2">
              {body.trim() ? (
                <ReactMarkdown>{body}</ReactMarkdown>
              ) : (
                <p className="text-stone-400 dark:text-stone-500 italic">Nothing to preview yet.</p>
              )}
            </div>
          ) : (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              required
              placeholder="Write the full rule content in Markdown. Use ## for sections and ### for sub-sections."
              className="w-full rounded-lg border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
            />
          )}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-800 dark:hover:text-stone-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </form>
    </ModalBase>
  )
}
