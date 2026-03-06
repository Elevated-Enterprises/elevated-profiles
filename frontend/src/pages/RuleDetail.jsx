import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { getRuleById } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useRules } from '../context/RulesContext'
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
  const { user } = useAuth()
  const { markRead } = useRules()
  const [rule, setRule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getRuleById(id)
      .then((res) => {
        setRule(res.data)
        // Mark as read for logged-in users (only if currently unread)
        if (user && res.data.isUnread) {
          markRead(id)
        }
      })
      .catch(() => setError('This rule could not be found.'))
      .finally(() => setLoading(false))
  }, [id, user])

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
      <div className="flex items-center gap-3 mb-6">
        <p className="text-stone-500 dark:text-stone-400 text-base">{rule.summary}</p>
        <span className="text-xs text-stone-400 dark:text-stone-500 shrink-0">
          Updated {new Date(rule.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {toc.length > 0 && (
        <div className="fixed left-0 top-1/2 -translate-y-1/2 z-30 flex items-stretch group">
          {/* TOC sliding panel */}
          <div className="overflow-hidden transition-all duration-300 ease-in-out w-0 group-hover:w-60 bg-white dark:bg-stone-900 border-y border-r border-stone-200 dark:border-stone-700 rounded-r-xl shadow-xl">
            <div className="w-60 p-4 max-h-[70vh] overflow-y-auto">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-3">
                Contents
              </p>
              <ul className="space-y-1">
                {toc.map((item, i) => (
                  <li key={i} className={item.level === 3 ? 'pl-4' : ''}>
                    <a
                      href={`#${headingId(item.text)}`}
                      className="text-sm text-amber-700 dark:text-amber-400 hover:underline leading-snug block"
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {/* Tab handle */}
          <div className="flex flex-col items-center justify-center bg-amber-600 hover:bg-amber-500 transition-colors text-white rounded-r-lg px-2 py-5 shadow-lg cursor-default select-none gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 transition-transform duration-300 group-hover:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-xs font-bold tracking-widest [writing-mode:vertical-rl]">Contents</span>
          </div>
        </div>
      )}

      <div className="prose prose-stone dark:prose-invert max-w-none">
        <ReactMarkdown components={markdownComponents}>{rule.body}</ReactMarkdown>
      </div>
    </div>
  )
}
