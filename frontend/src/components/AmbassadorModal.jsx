import { useState, useEffect } from 'react'
import { getPartnerCommunities, setUserAmbassadorCommunity } from '../lib/api'

export default function AmbassadorModal({ user, onClose, onSaved }) {
  const [communities, setCommunities] = useState([])
  const [selectedId, setSelectedId] = useState(user.ambassadorCommunity?.id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getPartnerCommunities()
      .then((res) => setCommunities(res.data))
      .catch(() => setError('Failed to load communities.'))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await setUserAmbassadorCommunity(user.slug, selectedId || null)
      await onSaved()
      onClose()
    } catch {
      setError('Failed to update ambassador status.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-stone-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">Ambassador Status</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-1">
            Partner Community
          </label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value="">No ambassador community</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-800 dark:hover:text-stone-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
