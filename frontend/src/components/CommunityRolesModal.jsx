import { useState, useEffect } from 'react'
import { getCommunityRoles, updateUserCommunityRoles } from '../lib/api'
import ModalBase from './ModalBase'

export default function CommunityRolesModal({ user, onClose, onSaved }) {
  const [allRoles, setAllRoles] = useState([])
  const [selected, setSelected] = useState(new Set(user.communityRoles?.map((r) => r.id) ?? []))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCommunityRoles()
      .then((res) => setAllRoles(res.data))
      .catch(() => setError('Failed to load community roles.'))
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
      await updateUserCommunityRoles(user.slug, [...selected])
      await onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.')
      setSaving(false)
    }
  }

  return (
    <ModalBase title="Community Roles" onClose={onClose}>
      {loading ? (
        <p className="text-sm text-stone-400 py-4 text-center">Loading…</p>
      ) : error && allRoles.length === 0 ? (
        <p className="text-sm text-red-500 py-4 text-center">{error}</p>
      ) : allRoles.length === 0 ? (
        <p className="text-sm text-stone-400 py-4 text-center">
          No community roles defined yet. Add some in the Admin panel.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 py-2">
          {allRoles.map((role) => {
            const active = selected.has(role.id)
            return (
              <button
                key={role.id}
                onClick={() => toggle(role.id)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  active
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-amber-300 dark:hover:border-amber-500'
                }`}
              >
                {role.name}
              </button>
            )
          })}
        </div>
      )}
      {error && allRoles.length > 0 && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-stone-100 dark:border-stone-700">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-800 dark:hover:text-stone-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </ModalBase>
  )
}
