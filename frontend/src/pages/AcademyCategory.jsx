import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAcademyIndex, getAcademyCategoryArticles } from '../lib/api'

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

export default function AcademyCategory() {
  const { category } = useParams()
  const [articles, setArticles] = useState([])
  const [categoryName, setCategoryName] = useState(category)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([getAcademyIndex(), getAcademyCategoryArticles(category)])
      .then(([indexRes, articlesRes]) => {
        const cat = indexRes.data.categories.find((c) => c.slug === category)
        if (cat) setCategoryName(cat.displayName)
        setArticles(articlesRes.data)
      })
      .catch(() => setError('Failed to load category.'))
      .finally(() => setLoading(false))
  }, [category])

  if (loading) return (
    <div className="max-w-4xl mx-auto py-12 text-stone-400 text-sm text-center">Loading…</div>
  )

  if (error) return (
    <div className="max-w-4xl mx-auto py-12 text-red-500 text-sm text-center">{error}</div>
  )

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link
          to="/academy"
          className="text-sm text-stone-400 dark:text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
        >
          ← Academy
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-stone-800 dark:text-stone-100">{categoryName}</h1>
      </div>

      {articles.length === 0 ? (
        <p className="text-stone-400 dark:text-stone-500 text-sm">No articles in this category yet.</p>
      ) : (
        <ul className="space-y-4">
          {articles.map((article) => (
            <li key={article.path}>
              <Link
                to={`/academy/${article.path}`}
                className="block rounded-2xl border border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 p-5 hover:border-amber-300 dark:hover:border-amber-600 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-snug">
                    {article.metadata.title}
                    {isNew(article.metadata.dateCreated) && (
                      <span className="ml-2 text-xs bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 px-1.5 py-0.5 rounded font-medium">
                        New
                      </span>
                    )}
                  </h2>
                  {article.metadata.dateUpdated && (
                    <span className="flex-shrink-0 text-xs text-stone-400 dark:text-stone-500">
                      {formatDate(article.metadata.dateUpdated)}
                    </span>
                  )}
                </div>
                {article.metadata.description && (
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                    {article.metadata.description}
                  </p>
                )}
                {article.metadata.tags?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {article.metadata.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
