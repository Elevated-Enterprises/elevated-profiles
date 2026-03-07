import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getAcademyIndex } from '../lib/api'
import { communityName } from '../lib/community'

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function isNew(dateCreated, days = 30) {
  if (!dateCreated) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return new Date(dateCreated + 'T00:00:00') > cutoff
}

export default function AcademyLanding() {
  const [index, setIndex] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getAcademyIndex()
      .then((res) => setIndex(res.data))
      .catch(() => setError('Failed to load Academy content.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="max-w-4xl mx-auto py-12 text-stone-400 text-sm text-center">Loading…</div>
  )

  if (error) return (
    <div className="max-w-4xl mx-auto py-12 text-red-500 text-sm text-center">{error}</div>
  )

  const { featuredArticle, recentArticles, categories } = index

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100">{communityName} Academy</h1>
        <p className="mt-2 text-stone-500 dark:text-stone-400">
          Knowledge, ethics, and community.
        </p>
      </div>

      {featuredArticle && (
        <Link
          to={`/academy/${featuredArticle.path}`}
          className="block mb-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-6 hover:border-amber-400 dark:hover:border-amber-500 transition-colors group"
        >
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
            Featured
          </p>
          <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
            {featuredArticle.metadata.title}
          </h2>
          {featuredArticle.metadata.description && (
            <p className="mt-2 text-stone-600 dark:text-stone-400 text-sm">
              {featuredArticle.metadata.description}
            </p>
          )}
          <p className="mt-3 text-amber-600 dark:text-amber-400 text-sm font-medium">Read article →</p>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {recentArticles.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">Recently Added</h2>
            <ul className="space-y-3">
              {recentArticles.map((article) => (
                <li key={article.path}>
                  <Link
                    to={`/academy/${article.path}`}
                    className="group flex items-start gap-2"
                  >
                    <span className="text-sm text-stone-700 dark:text-stone-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-snug">
                      {article.metadata.title}
                    </span>
                    {isNew(article.metadata.dateCreated) && (
                      <span className="flex-shrink-0 text-xs bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 px-1.5 py-0.5 rounded font-medium">
                        New
                      </span>
                    )}
                  </Link>
                  {article.metadata.dateCreated && (
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                      {formatDate(article.metadata.dateCreated)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {categories.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">Categories</h2>
            <ul className="space-y-2">
              {categories.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    to={`/academy/${cat.slug}`}
                    className="flex items-center justify-between group rounded-xl border border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-3 hover:border-amber-300 dark:hover:border-amber-600 transition-colors"
                  >
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {cat.displayName}
                    </span>
                    <span className="text-xs text-stone-400 dark:text-stone-500">
                      {cat.articleCount} {cat.articleCount === 1 ? 'article' : 'articles'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {categories.length === 0 && recentArticles.length === 0 && (
        <p className="text-stone-400 dark:text-stone-500 text-sm">
          No content yet. Sync the Academy to load content.
        </p>
      )}

      <div className="mt-12 pt-6 border-t border-stone-200 dark:border-stone-700 text-xs text-stone-400 dark:text-stone-500 space-y-1">
        <p>
          This work is licensed under the{' '}
          <strong className="text-stone-500 dark:text-stone-400">Creative Commons Attribution-NonCommercial 4.0 International License</strong>{' '}
          (CC BY-NC 4.0).
        </p>
        <p>
          <a
            href="https://creativecommons.org/licenses/by-nc/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          >
            View full licence
          </a>
        </p>
      </div>
    </div>
  )
}
