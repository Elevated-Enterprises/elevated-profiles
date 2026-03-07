import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getLegalDocument } from '../lib/api'
import MarkdownRenderer from '../components/MarkdownRenderer'
import LoadingSpinner from '../components/LoadingSpinner'

export default function PrivacyPolicy() {
  const [content, setContent] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLegalDocument('privacy')
      .then(res => setContent(res.data.content))
      .catch(err => { if (err.response?.status === 404) setNotFound(true) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-700 mb-6 text-sm transition-colors">
        ← Back
      </Link>

      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 p-8">
        {loading && <LoadingSpinner />}

        {notFound && (
          <div className="text-center py-8">
            <p className="text-stone-500 dark:text-stone-400 font-medium mb-3">Privacy Policy not configured</p>
            <p className="text-stone-400 dark:text-stone-500 text-sm max-w-md mx-auto">
              Mount a file at <code className="bg-stone-100 dark:bg-stone-700 px-1 rounded">/app/legal/privacy.md</code> in
              the backend container to display your privacy policy here.
              See <code className="bg-stone-100 dark:bg-stone-700 px-1 rounded">legal/privacy.md.example</code> in the
              repository for a template.
            </p>
          </div>
        )}

        {content && <MarkdownRenderer content={content} />}
      </div>
    </div>
  )
}
