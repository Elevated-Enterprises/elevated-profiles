import { useState, useEffect } from 'react'
import ModalBase from './ModalBase'
import { getLlmProviders, updateUserLlmExperiences } from '../lib/api'

const LEVELS = [
  { value: 0, label: 'No Experience' },
  { value: 1, label: 'Beginner' },
  { value: 2, label: 'Advanced' },
  { value: 3, label: 'Expert' },
]

export default function LLMExperienceModal({ user, onClose, onSaved }) {
  const [providers, setProviders] = useState([])
  // Map of providerId -> { included: bool, level: number }
  const [entries, setEntries] = useState(() => {
    const map = {}
    user.llmExperiences?.forEach((exp) => {
      map[exp.llmProviderId] = { included: true, level: exp.experienceLevel }
    })
    return map
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getLlmProviders()
      .then((res) => setProviders(res.data))
      .catch(() => setError('Failed to load providers.'))
      .finally(() => setLoading(false))
  }, [])

  const toggleProvider = (id) => {
    setEntries((prev) => {
      const next = { ...prev }
      if (next[id]) {
        delete next[id]
      } else {
        next[id] = { included: true, level: 1 }
      }
      return next
    })
  }

  const setLevel = (id, level) => {
    setEntries((prev) => ({ ...prev, [id]: { included: true, level } }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const experiences = Object.entries(entries).map(([providerId, { level }]) => ({
        llmProviderId: providerId,
        experienceLevel: level,
      }))
      await updateUserLlmExperiences(user.slug, experiences)
      await onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalBase title="Edit LLM Experience" onClose={onClose}>
      {loading ? (
        <p className="text-sm text-stone-500 py-4 text-center">Loading providers…</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {providers.map((provider) => {
              const entry = entries[provider.id]
              const included = Boolean(entry)
              return (
                <div key={provider.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={() => toggleProvider(provider.id)}
                    className="accent-amber-500 w-4 h-4 flex-shrink-0"
                    id={`provider-${provider.id}`}
                  />
                  <label
                    htmlFor={`provider-${provider.id}`}
                    className="text-sm text-stone-700 dark:text-stone-200 w-32 cursor-pointer select-none"
                  >
                    {provider.name}
                  </label>
                  {included && (
                    <select
                      value={entry.level}
                      onChange={(e) => setLevel(provider.id, Number(e.target.value))}
                      className="flex-1 border border-stone-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                    >
                      {LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </ModalBase>
  )
}
