import { useState } from 'react'
import ModalBase from './ModalBase'
import { updateUserLanguages } from '../lib/api'

const ALL_LANGUAGES = [
  'Afrikaans', 'Albanian', 'Arabic', 'Armenian', 'Azerbaijani',
  'Basque', 'Belarusian', 'Bengali', 'Bosnian', 'Bulgarian',
  'Catalan', 'Chinese (Cantonese)', 'Chinese (Mandarin)', 'Croatian', 'Czech',
  'Danish', 'Dutch',
  'Estonian',
  'Finnish', 'French',
  'Galician', 'Georgian', 'German', 'Greek',
  'Hebrew', 'Hindi', 'Hungarian',
  'Icelandic', 'Indonesian', 'Italian',
  'Japanese',
  'Kazakh', 'Korean',
  'Latvian', 'Lithuanian',
  'Macedonian', 'Malay', 'Maltese', 'Mongolian',
  'Norwegian',
  'Persian', 'Polish', 'Portuguese', 'Punjabi',
  'Romanian', 'Russian',
  'Serbian', 'Slovak', 'Slovenian', 'Spanish', 'Swahili', 'Swedish',
  'Tagalog', 'Tamil', 'Telugu', 'Thai', 'Turkish',
  'Ukrainian', 'Urdu', 'Uzbek',
  'Vietnamese',
  'Welsh',
]

export default function LanguagesModal({ user, onClose, onSaved }) {
  const [selected, setSelected] = useState(new Set(user.languages ?? []))
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const filtered = ALL_LANGUAGES.filter((l) =>
    l.toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (lang) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(lang)) next.delete(lang)
      else next.add(lang)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateUserLanguages(user.slug, [...selected])
      await onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalBase title="Edit Languages" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-stone-500 dark:text-stone-400">
          English is always shown as baseline. Select any additional languages you speak.
        </p>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search languages…"
          className="w-full border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-sky-300"
        />

        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {filtered.map((lang) => (
            <label key={lang} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selected.has(lang)}
                onChange={() => toggle(lang)}
                className="accent-sky-500 w-4 h-4 flex-shrink-0"
              />
              <span className="text-sm text-stone-700 dark:text-stone-200">{lang}</span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-2 text-sm text-stone-400 dark:text-stone-500 py-2">No languages found.</p>
          )}
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
            className="px-4 py-2 text-sm bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </ModalBase>
  )
}
