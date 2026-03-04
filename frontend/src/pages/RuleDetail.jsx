import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { getRuleById } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'

function headingId(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function parseToc(body) {
  const items = []
  for (const line of body.split('\n')) {
    const h2 = line.match(/^## (.+)/)
    const h3 = line.match(/^### (.+)/)
    if (h2) items.push({ level: 2, text: h2[1].trim() })
    else if (h3) items.push({ level: 3, text: h3[1].trim() })
  }
  return items
}

const markdownComponents = {
  h2: ({ children }) => {
    const id = headingId(String(children))
    return (
      <h2 id={id} className="scroll-mt-20">
        {children}
      </h2>
    )
  },
  h3: ({ children }) => {
    const id = headingId(String(children))
    return (
      <h3 id={id} className="scroll-mt-20">
        {children}
      </h3>
    )
  },
}

export default function RuleDetail() {
  const { id } = useParams()
  const [rule, setRule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getRuleById(id)
      .then((res) => setRule(res.data))
      .catch(() => setError('This rule could not be found.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingSpinner className="py-20" />

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <Link to="/legal/rules" className="text-amber-600 dark:text-amber-500 hover:underline text-sm">
          ← Back to Rules
        </Link>
        <p className="text-red-600 dark:text-red-400 mt-4">{error}</p>
      </div>
    )
  }

  const toc = parseToc(rule.body)

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/legal/rules" className="text-amber-600 dark:text-amber-500 hover:underline text-sm">
        ← Back to Rules
      </Link>

      <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 mt-4 mb-2">{rule.title}</h1>
      <p className="text-stone-500 dark:text-stone-400 mb-6 text-base">{rule.summary}</p>

      {toc.length > 0 && (
        <nav className="bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700 p-4 mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-2">
            Contents
          </p>
          <ul className="space-y-1">
            {toc.map((item, i) => (
              <li key={i} className={item.level === 3 ? 'pl-4' : ''}>
                <a
                  href={`#${headingId(item.text)}`}
                  className="text-sm text-amber-700 dark:text-amber-400 hover:underline"
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="prose prose-stone dark:prose-invert max-w-none">
        <ReactMarkdown components={markdownComponents}>{rule.body}</ReactMarkdown>
      </div>
    </div>
  )
}
