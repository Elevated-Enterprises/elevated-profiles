import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAcademyArticle } from '../lib/api'
import AcademyMarkdownRenderer from '../components/academy/AcademyMarkdownRenderer'

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AcademyArticle() {
  const { category, article } = useParams()
  const path = `${category}/${article}`
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getAcademyArticle(path)
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err.response?.status === 404) setError('Article not found.')
        else setError('Failed to load article.')
      })
      .finally(() => setLoading(false))
  }, [path])

  if (loading) return (
    <div className="max-w-3xl mx-auto py-12 text-stone-400 text-sm text-center">Loading…</div>
  )

  if (error) return (
    <div className="max-w-3xl mx-auto py-12 text-red-500 text-sm text-center">{error}</div>
  )

  const { metadata, markdown } = data

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link
          to={`/academy/${category}`}
          className="text-sm text-stone-400 dark:text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors capitalize"
        >
          ← {category.replace(/-/g, ' ')}
        </Link>
      </div>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 leading-tight">
          {metadata.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-400 dark:text-stone-500">
          {metadata.author && <span>by {metadata.author}</span>}
          {metadata.dateUpdated && <span>{formatDate(metadata.dateUpdated)}</span>}
        </div>
      </header>

      <AcademyMarkdownRenderer content={markdown} />

      {metadata.tags?.length > 0 && (
        <div className="mt-10 pt-6 border-t border-stone-100 dark:border-stone-700 flex flex-wrap gap-2">
          {metadata.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-stone-100 dark:border-stone-700">
        <p className="text-xs text-stone-300 dark:text-stone-600">
          Content licensed under Creative Commons. Academy curated by Second Circuit.
        </p>
      </div>
    </div>
  )
}
