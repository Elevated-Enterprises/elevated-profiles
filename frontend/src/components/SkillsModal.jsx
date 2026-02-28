import { useState, useEffect } from 'react'
import ModalBase from './ModalBase'
import { getSkills, updateUserSkills } from '../lib/api'

export default function SkillsModal({ user, onClose, onSaved }) {
  const [allSkills, setAllSkills] = useState([])
  const [selected, setSelected] = useState(new Set(user.skills?.map((s) => s.id) ?? []))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSkills()
      .then((res) => setAllSkills(res.data))
      .catch(() => setError('Failed to load skills.'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateUserSkills(user.slug, [...selected])
      await onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalBase title="Edit Skills" onClose={onClose}>
      {loading ? (
        <p className="text-sm text-stone-500 py-4 text-center">Loading skills…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {allSkills.map((skill) => (
              <label key={skill.id} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selected.has(skill.id)}
                  onChange={() => toggle(skill.id)}
                  className="accent-amber-500 w-4 h-4 flex-shrink-0"
                />
                <span className="text-sm text-stone-700 dark:text-stone-200">{skill.name}</span>
              </label>
            ))}
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
