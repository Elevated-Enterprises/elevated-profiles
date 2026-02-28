import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  getSkills, createSkill, deleteSkill,
  getLlmProviders, createLlmProvider, deleteLlmProvider,
  getCommunityRoles, createCommunityRole, deleteCommunityRole,
  getPartnerCommunities, createPartnerCommunity, deletePartnerCommunity,
  getUsers, setUserBlocked,
  getAdminEmojis, createAdminEmoji, toggleAdminEmoji,
  getAdminTags, createAdminTag, deleteAdminTag,
  getThoughtSettings, updateThoughtSettings,
} from '../lib/api'

function ManagedList({ title, items, onAdd, onDelete }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    const name = input.trim()
    if (!name) return
    setError(null)
    setAdding(true)
    try {
      await onAdd(name)
      setInput('')
    } catch (err) {
      if (err.response?.status === 409) setError('Already exists.')
      else setError(err.response?.data?.error || 'Failed to add.')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return
    try {
      await onDelete(item.id)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete.')
    }
  }

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 p-6">
      <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">{title}</h2>

      <div className="flex gap-2 mb-4">
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null) }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={`New ${title.toLowerCase().replace(/s$/, '')} name…`}
          className="flex-1 border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !input.trim()}
          className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
        >
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-stone-400 dark:text-stone-500">None yet.</p>
      ) : (
        <ul className="divide-y divide-stone-100 dark:divide-stone-700">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-stone-700 dark:text-stone-200">{item.name}</span>
              <button
                onClick={() => handleDelete(item)}
                className="text-xs text-stone-400 hover:text-red-500 transition-colors px-2 py-0.5 rounded"
                aria-label={`Delete ${item.name}`}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CommunityManagedList({ title, items, onAdd, onDelete }) {
  const [name, setName] = useState('')
  const [discordInviteUrl, setDiscordInviteUrl] = useState('')
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    const trimmedName = name.trim()
    const trimmedUrl = discordInviteUrl.trim()
    if (!trimmedName || !trimmedUrl) return
    setError(null)
    setAdding(true)
    try {
      await onAdd({ name: trimmedName, discordInviteUrl: trimmedUrl })
      setName('')
      setDiscordInviteUrl('')
    } catch (err) {
      if (err.response?.status === 409) setError('Already exists.')
      else setError(err.response?.data?.error || 'Failed to add.')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"? This will remove the ambassador status from all affected users.`)) return
    try {
      await onDelete(item.id)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete.')
    }
  }

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 p-6">
      <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">{title}</h2>

      <div className="flex flex-col gap-2 mb-4">
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null) }}
          placeholder="Community name…"
          className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
        <div className="flex gap-2">
          <input
            value={discordInviteUrl}
            onChange={(e) => { setDiscordInviteUrl(e.target.value); setError(null) }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Discord invite URL…"
            className="flex-1 border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !name.trim() || !discordInviteUrl.trim()}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            Add
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-stone-400 dark:text-stone-500">None yet.</p>
      ) : (
        <ul className="divide-y divide-stone-100 dark:divide-stone-700">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2 gap-2">
              <div className="min-w-0">
                <p className="text-sm text-stone-700 dark:text-stone-200 truncate">{item.name}</p>
                <a
                  href={item.discordInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline truncate block"
                >
                  {item.discordInviteUrl}
                </a>
              </div>
              <button
                onClick={() => handleDelete(item)}
                className="text-xs text-stone-400 hover:text-red-500 transition-colors px-2 py-0.5 rounded flex-shrink-0"
                aria-label={`Delete ${item.name}`}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EmojiManagement({ emojis, onAdd, onToggle }) {
  const [emojiChar, setEmojiChar] = useState('')
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  const handleAdd = async () => {
    const k = key.trim(), e = emojiChar.trim(), l = label.trim()
    if (!k || !e || !l) { setError('All fields are required.'); return }
    setError(null)
    setAdding(true)
    try {
      await onAdd({ key: k, emoji: e, label: l })
      setKey(''); setEmojiChar(''); setLabel('')
    } catch (err) {
      if (err.response?.status === 409) setError('Key already exists.')
      else setError(err.response?.data?.error || 'Failed to add.')
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (id) => {
    setTogglingId(id)
    try { await onToggle(id) }
    catch { alert('Failed to toggle emoji.') }
    finally { setTogglingId(null) }
  }

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 p-6">
      <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">Reaction Emojis</h2>
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex gap-2">
          <input
            value={emojiChar}
            onChange={(e) => { setEmojiChar(e.target.value); setError(null) }}
            placeholder="Emoji 🔥"
            className="w-20 border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300 text-center"
          />
          <input
            value={key}
            onChange={(e) => { setKey(e.target.value); setError(null) }}
            placeholder="Key (z.B. fire)"
            className="flex-1 border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
        <div className="flex gap-2">
          <input
            value={label}
            onChange={(e) => { setLabel(e.target.value); setError(null) }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Label (z.B. Fire)"
            className="flex-1 border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !key.trim() || !emojiChar.trim() || !label.trim()}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            Add
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      {emojis.length === 0 ? (
        <p className="text-sm text-stone-400 dark:text-stone-500">None yet.</p>
      ) : (
        <ul className="divide-y divide-stone-100 dark:divide-stone-700">
          {emojis.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg leading-none">{e.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm text-stone-700 dark:text-stone-200">{e.label}</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 font-mono">{e.key}</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle(e.id)}
                disabled={togglingId === e.id}
                className={`text-xs px-2 py-0.5 rounded border transition-colors whitespace-nowrap flex-shrink-0 ${
                  e.isActive
                    ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                    : 'border-stone-200 dark:border-stone-600 text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700/50'
                }`}
              >
                {togglingId === e.id ? '…' : e.isActive ? 'Active' : 'Inactive'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const TAG_COLORS = [
  { value: 'amber', label: 'Amber', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'violet', label: 'Violet', cls: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'sky', label: 'Sky', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'emerald', label: 'Emerald', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'rose', label: 'Rose', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'stone', label: 'Stone', cls: 'bg-stone-100 text-stone-600 border-stone-200' },
]

function TagManagement({ tags, onAdd, onDelete }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('amber')
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    const n = name.trim()
    if (!n) return
    setError(null)
    setAdding(true)
    try {
      await onAdd({ name: n, color })
      setName('')
    } catch (err) {
      if (err.response?.status === 409) setError('Tag already exists.')
      else setError(err.response?.data?.error || 'Failed to add.')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (tag) => {
    if (!window.confirm(`Delete tag "${tag.name}"? It will be removed from all thoughts.`)) return
    try { await onDelete(tag.id) }
    catch (err) { alert(err.response?.data?.error || 'Failed to delete.') }
  }

  const colorCls = TAG_COLORS.find((c) => c.value === color)?.cls ?? TAG_COLORS[0].cls

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 p-6">
      <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">Thought Tags</h2>
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null) }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Tag name…"
            className="flex-1 border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !name.trim()}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            Add
          </button>
        </div>
        <div className="flex gap-1 flex-wrap">
          {TAG_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${c.cls} ${color === c.value ? 'ring-2 ring-offset-1 ring-amber-400' : 'opacity-60 hover:opacity-90'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {name && (
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Preview: <span className={`inline-block px-2 py-0.5 rounded-full text-xs border font-medium ${colorCls}`}>{name}</span>
          </p>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      {tags.length === 0 ? (
        <p className="text-sm text-stone-400 dark:text-stone-500">None yet.</p>
      ) : (
        <ul className="divide-y divide-stone-100 dark:divide-stone-700">
          {tags.map((t) => {
            const tc = TAG_COLORS.find((c) => c.value === t.color)?.cls ?? TAG_COLORS[0].cls
            return (
              <li key={t.id} className="flex items-center justify-between py-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs border font-medium ${tc}`}>{t.name}</span>
                  {t.thoughtCount > 0 && (
                    <span className="text-xs text-stone-400 dark:text-stone-500">{t.thoughtCount} thought{t.thoughtCount !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(t)}
                  className="text-xs text-stone-400 hover:text-red-500 transition-colors px-2 py-0.5 rounded flex-shrink-0"
                  aria-label={`Delete ${t.name}`}
                >
                  🗑
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ThoughtSettingsPanel({ settings, onSave }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (settings) setForm({ ...settings })
  }, [settings])

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError(null)
    try {
      await onSave(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  if (!form) return null

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 p-6">
      <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">Thought Settings</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone-500 dark:text-stone-400">Max thoughts per window</span>
          <input
            type="number" min="1" max="100"
            value={form.maxThoughtsPerWindow}
            onChange={(e) => set('maxThoughtsPerWindow', Number(e.target.value))}
            className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone-500 dark:text-stone-400">Rate limit window (hours)</span>
          <input
            type="number" min="1" max="168"
            value={form.rateLimitWindowHours}
            onChange={(e) => set('rateLimitWindowHours', Number(e.target.value))}
            className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone-500 dark:text-stone-400">Min. thought length (chars)</span>
          <input
            type="number" min="0" max="500"
            value={form.minThoughtLength}
            onChange={(e) => set('minThoughtLength', Number(e.target.value))}
            className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone-500 dark:text-stone-400">Min. comment length (chars)</span>
          <input
            type="number" min="0" max="500"
            value={form.minCommentLength}
            onChange={(e) => set('minCommentLength', Number(e.target.value))}
            className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  )
}

function UserManagement() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [blockingSlug, setBlockingSlug] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!debouncedSearch) { setUsers([]); return }
    setLoading(true)
    getUsers({ search: debouncedSearch, pageSize: 20, sort: 'name_asc' })
      .then((res) => setUsers(res.data.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [debouncedSearch])

  const handleBlock = async (slug, currentlyBlocked) => {
    setBlockingSlug(slug)
    try {
      await setUserBlocked(slug, !currentlyBlocked)
      setUsers((prev) =>
        prev.map((u) => u.slug === slug ? { ...u, isBlocked: !currentlyBlocked } : u)
      )
    } catch {
      alert('Failed to update block status.')
    } finally {
      setBlockingSlug(null)
    }
  }

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 p-6">
      <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">User Management</h2>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search users by name…"
        className="w-full border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300 mb-4"
      />
      {loading && <p className="text-sm text-stone-400 dark:text-stone-500">Searching…</p>}
      {!loading && debouncedSearch && users.length === 0 && (
        <p className="text-sm text-stone-400 dark:text-stone-500">No users found.</p>
      )}
      {users.length > 0 && (
        <ul className="divide-y divide-stone-100 dark:divide-stone-700">
          {users.map((u) => (
            <li key={u.slug} className="flex items-center justify-between py-2 gap-3">
              <div className="min-w-0">
                <Link
                  to={`/profiles/${u.slug}`}
                  className="text-sm font-medium text-stone-700 dark:text-stone-200 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                >
                  {u.displayName}
                </Link>
                {u.isBlocked && (
                  <span className="ml-2 text-xs text-red-500 dark:text-red-400 font-medium">blocked</span>
                )}
                {u.isAdmin && (
                  <span className="ml-2 text-xs text-amber-500 dark:text-amber-400">admin</span>
                )}
              </div>
              <button
                onClick={() => handleBlock(u.slug, u.isBlocked)}
                disabled={blockingSlug === u.slug}
                className={`text-xs px-2 py-0.5 rounded border transition-colors whitespace-nowrap ${
                  u.isBlocked
                    ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                    : 'border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                }`}
              >
                {blockingSlug === u.slug ? '…' : u.isBlocked ? 'Unblock' : 'Block'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!debouncedSearch && (
        <p className="text-xs text-stone-400 dark:text-stone-500">
          Type a name to search. To assign community roles or block/unblock, you can also visit the user's profile directly.
        </p>
      )}
    </div>
  )
}

export default function Admin() {
  const [skills, setSkills] = useState([])
  const [providers, setProviders] = useState([])
  const [roles, setRoles] = useState([])
  const [partnerCommunities, setPartnerCommunities] = useState([])
  const [emojis, setEmojis] = useState([])
  const [tags, setTags] = useState([])
  const [thoughtSettings, setThoughtSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const [s, p, r, pc, em, tg, ts] = await Promise.all([
        getSkills(), getLlmProviders(), getCommunityRoles(), getPartnerCommunities(),
        getAdminEmojis(), getAdminTags(), getThoughtSettings(),
      ])
      setSkills(s.data)
      setProviders(p.data)
      setRoles(r.data)
      setPartnerCommunities(pc.data)
      setEmojis(em.data)
      setTags(tg.data)
      setThoughtSettings(ts.data)
    } catch {
      setError('Failed to load data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAddSkill = async (name) => {
    const res = await createSkill(name)
    setSkills((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const handleDeleteSkill = async (id) => {
    await deleteSkill(id)
    setSkills((prev) => prev.filter((s) => s.id !== id))
  }

  const handleAddProvider = async (name) => {
    const res = await createLlmProvider(name)
    setProviders((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const handleDeleteProvider = async (id) => {
    await deleteLlmProvider(id)
    setProviders((prev) => prev.filter((p) => p.id !== id))
  }

  const handleAddRole = async (name) => {
    const res = await createCommunityRole(name)
    setRoles((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const handleDeleteRole = async (id) => {
    await deleteCommunityRole(id)
    setRoles((prev) => prev.filter((r) => r.id !== id))
  }

  const handleAddPartnerCommunity = async ({ name, discordInviteUrl }) => {
    const res = await createPartnerCommunity({ name, discordInviteUrl })
    setPartnerCommunities((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const handleDeletePartnerCommunity = async (id) => {
    await deletePartnerCommunity(id)
    setPartnerCommunities((prev) => prev.filter((c) => c.id !== id))
  }

  const handleAddEmoji = async (data) => {
    const res = await createAdminEmoji(data)
    setEmojis((prev) => [...prev, res.data])
  }

  const handleToggleEmoji = async (id) => {
    const res = await toggleAdminEmoji(id)
    setEmojis((prev) => prev.map((e) => e.id === id ? res.data : e))
  }

  const handleAddTag = async (data) => {
    const res = await createAdminTag(data)
    setTags((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const handleDeleteTag = async (id) => {
    await deleteAdminTag(id)
    setTags((prev) => prev.filter((t) => t.id !== id))
  }

  const handleSaveThoughtSettings = async (data) => {
    const res = await updateThoughtSettings(data)
    setThoughtSettings(res.data)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-stone-400 text-sm">
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-red-500 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-6">Admin</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <ManagedList
          title="Skills"
          items={skills}
          onAdd={handleAddSkill}
          onDelete={handleDeleteSkill}
        />
        <ManagedList
          title="LLM Providers"
          items={providers}
          onAdd={handleAddProvider}
          onDelete={handleDeleteProvider}
        />
        <ManagedList
          title="Community Roles"
          items={roles}
          onAdd={handleAddRole}
          onDelete={handleDeleteRole}
        />
      </div>
      <div className="mb-6">
        <CommunityManagedList
          title="Partner Communities"
          items={partnerCommunities}
          onAdd={handleAddPartnerCommunity}
          onDelete={handleDeletePartnerCommunity}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <EmojiManagement emojis={emojis} onAdd={handleAddEmoji} onToggle={handleToggleEmoji} />
        <TagManagement tags={tags} onAdd={handleAddTag} onDelete={handleDeleteTag} />
      </div>
      <div className="mb-6">
        <ThoughtSettingsPanel settings={thoughtSettings} onSave={handleSaveThoughtSettings} />
      </div>
      <UserManagement />
    </div>
  )
}
