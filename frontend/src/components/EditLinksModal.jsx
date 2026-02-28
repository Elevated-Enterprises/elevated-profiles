import { useState } from 'react'
import ModalBase from './ModalBase'
import { updateUserLinks } from '../lib/api'

export default function EditLinksModal({ user, onClose, onSaved }) {
  const [links, setLinks] = useState(
    user.links?.map((l) => ({ label: l.label, url: l.url })) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const addLink = () => {
    if (links.length >= 20) return
    setLinks([...links, { label: '', url: '' }])
  }

  const removeLink = (idx) => setLinks(links.filter((_, i) => i !== idx))

  const updateLink = (idx, field, value) =>
    setLinks(links.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateUserLinks(user.slug, links.filter((l) => l.url.trim()))
      await onSaved()
      onClose()
    } catch {
      setError('Failed to save links.')
      setSaving(false)
    }
  }

  return (
    <ModalBase title="Edit Links" onClose={onClose}>
      <div className="space-y-3">
        {links.length === 0 && (
          <p className="text-sm text-stone-400 dark:text-stone-500">No links yet. Add one below.</p>
        )}
        {links.map((link, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder="Label"
                value={link.label}
                onChange={(e) => updateLink(idx, 'label', e.target.value)}
                className="w-28 border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 text-stone-800 dark:text-stone-100 bg-white dark:bg-stone-800"
                maxLength={100}
              />
              <input
                type="url"
                placeholder="https://..."
                value={link.url}
                onChange={(e) => updateLink(idx, 'url', e.target.value)}
                className="flex-1 border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 text-stone-800 dark:text-stone-100 bg-white dark:bg-stone-800"
                maxLength={500}
              />
            </div>
            <button
              onClick={() => removeLink(idx)}
              className="text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-colors px-2 py-2 text-xl leading-none"
              aria-label="Remove link"
            >
              ×
            </button>
          </div>
        ))}

        {links.length < 20 && (
          <button
            onClick={addLink}
            className="text-sm text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 font-medium transition-colors"
          >
            + Add link
          </button>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-3 border-t border-stone-100 dark:border-stone-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </ModalBase>
  )
}
