import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRules, deleteRule, reorderRules } from '../lib/api'
import RuleModal from '../components/RuleModal'
import LoadingSpinner from '../components/LoadingSpinner'

export default function AdminRules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [modal, setModal] = useState(null) // null | 'new' | rule object to edit
  const [dragFromIdx, setDragFromIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  const load = () => {
    setLoading(true)
    getRules()
      .then((res) => setRules(res.data))
      .catch(() => setError('Could not load rules.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleDelete = async (rule) => {
    if (!confirm(`Delete "${rule.title}"?`)) return
    const prev = rules
    setRules((r) => r.filter((x) => x.id !== rule.id))
    try {
      await deleteRule(rule.id)
    } catch {
      setRules(prev)
    }
  }

  const handleDragStart = (e, idx) => {
    setDragFromIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setDragImage(e.currentTarget, 20, 20)
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIdx !== idx) setDragOverIdx(idx)
  }

  const handleDrop = async (e, idx) => {
    e.preventDefault()
    const from = dragFromIdx
    setDragFromIdx(null)
    setDragOverIdx(null)
    if (from === null || from === idx) return

    const newList = [...rules]
    const [moved] = newList.splice(from, 1)
    newList.splice(idx, 0, moved)
    setRules(newList)

    try {
      await reorderRules(newList.map((r) => r.id))
    } catch {
      setRules(rules)
    }
  }

  const handleDragEnd = () => {
    setDragFromIdx(null)
    setDragOverIdx(null)
  }

  if (loading) return <LoadingSpinner className="py-20" />

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100">Manage Rules</h1>
          <Link
            to="/legal/rules"
            className="text-xs text-amber-600 dark:text-amber-500 hover:underline mt-0.5 block"
          >
            View public rules page →
          </Link>
        </div>
        <button
          onClick={() => setModal('new')}
          className="px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
        >
          + New Rule
        </button>
      </div>

      {error && <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>}

      {rules.length === 0 && !error && (
        <p className="text-stone-500 dark:text-stone-400 text-sm">
          No rules yet. Create the first one.
        </p>
      )}

      <ul className="space-y-2">
        {rules.map((rule, idx) => (
          <li
            key={rule.id}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={[
              'flex items-center gap-3 bg-white dark:bg-stone-800 rounded-xl border px-4 py-3 cursor-grab active:cursor-grabbing transition-all',
              dragFromIdx === idx
                ? 'opacity-40 border-stone-200 dark:border-stone-700'
                : dragOverIdx === idx && dragFromIdx !== idx
                  ? 'border-amber-400 dark:border-amber-600 outline outline-2 outline-amber-300 dark:outline-amber-600'
                  : 'border-stone-100 dark:border-stone-700',
            ].join(' ')}
          >
            {/* drag handle */}
            <span className="text-stone-300 dark:text-stone-600 select-none shrink-0" title="Drag to reorder">
              ⠿
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">{rule.title}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{rule.summary}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setModal(rule)}
                className="px-3 py-1 text-xs text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(rule)}
                className="px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {modal && (
        <RuleModal
          rule={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
