import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRules } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Rules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getRules()
      .then((res) => setRules(res.data))
      .catch(() => setError('Could not load community rules.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner className="py-20" />

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 mb-6">Community Rules</h1>
      <p className="text-stone-600 dark:text-stone-300 mb-8 text-lg leading-relaxed">
        Second Circuit is a community for humans and their AI companions. To keep this space
        welcoming and meaningful for everyone, we ask all members to follow these guidelines.
      </p>

      {error && (
        <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
      )}

      {!error && rules.length === 0 && (
        <p className="text-stone-500 dark:text-stone-400">No rules have been published yet.</p>
      )}

      <div className="space-y-4">
        {rules.map((rule) => (
          <Link
            key={rule.id}
            to={`/legal/rules/${rule.id}`}
            className="block bg-white dark:bg-stone-800 rounded-xl border border-stone-100 dark:border-stone-700 p-5 hover:border-amber-300 dark:hover:border-amber-600 transition-colors group"
          >
            <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100 mb-1 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
              {rule.title}
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">{rule.summary}</p>
          </Link>
        ))}
      </div>

      <p className="text-xs text-stone-400 dark:text-stone-500 mt-8">
        These rules are subject to change. Questions? Join us on{' '}
        <a
          href="https://discord.gg/secondcircuit"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-600 dark:text-amber-500 hover:underline"
        >
          Discord
        </a>
        .
      </p>
    </div>
  )
}
