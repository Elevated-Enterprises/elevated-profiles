import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAcademyArticle, getReactions, getActiveEmojis, addReaction, removeReaction, getAcademyInsights, getAcademyInsightsExport } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import AcademyMarkdownRenderer from '../components/academy/AcademyMarkdownRenderer'
import ReactionSummary from '../components/reactions/ReactionSummary'
import ReactionPicker from '../components/reactions/ReactionPicker'

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatRelativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function AcademyArticle() {
  const { category, article } = useParams()
  const { user } = useAuth()
  const path = `${category}/${article}`
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [reactions, setReactions] = useState([])
  const [emojis, setEmojis] = useState([])
  const [showPicker, setShowPicker] = useState(false)

  const [showInsights, setShowInsights] = useState(false)
  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  // Admin export state
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    getAcademyArticle(path)
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err.response?.status === 404) setError('Article not found.')
        else setError('Failed to load article.')
      })
      .finally(() => setLoading(false))
  }, [path])

  useEffect(() => {
    getReactions(path, 'academy_article').then(({ data }) => setReactions(data)).catch(() => {})
    if (user) getActiveEmojis().then(({ data }) => setEmojis(data)).catch(() => {})
  }, [path, user])

  const loadReactions = () => {
    getReactions(path, 'academy_article').then(({ data }) => setReactions(data)).catch(() => {})
  }

  const handleReactionToggle = async (emojiKey) => {
    if (!user) return
    const existing = reactions.find(r => r.emojiKey === emojiKey && r.userHasReacted)
    try {
      if (existing) {
        await removeReaction(path, 'academy_article', emojiKey)
      } else {
        await addReaction(path, 'academy_article', emojiKey)
      }
      loadReactions()
    } catch { /* ignore */ }
    setShowPicker(false)
  }

  const handleLoadInsights = async () => {
    if (insights) { setShowInsights(v => !v); return }
    setInsightsLoading(true)
    setShowInsights(true)
    try {
      const { data } = await getAcademyInsights(path)
      setInsights(data)
    } catch {
      setInsights(null)
      setShowInsights(false)
    } finally {
      setInsightsLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const { data } = await getAcademyInsightsExport(
        path,
        exportFrom || undefined,
        exportTo || undefined
      )
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `academy-reads-${article}-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ } finally {
      setExporting(false)
    }
  }

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

      {/* Reactions */}
      <div className="mt-8 pt-4 border-t border-stone-100 dark:border-stone-700">
        <div className="flex items-center gap-3 flex-wrap">
          <ReactionSummary
            reactions={reactions}
            targetId={path}
            targetType="academy_article"
            onUpdate={loadReactions}
          />
          {user && (
            <div className="relative">
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 border border-stone-200 dark:border-stone-600 rounded-full px-2 py-0.5"
              >
                + React
              </button>
              {showPicker && (
                <div className="absolute bottom-full left-0 mb-2 z-20">
                  <ReactionPicker
                    emojis={emojis}
                    userReactions={reactions.filter(r => r.userHasReacted).map(r => r.emojiKey)}
                    onSelect={handleReactionToggle}
                    onClose={() => setShowPicker(false)}
                  />
                </div>
              )}
            </div>
          )}
          {user?.isAdmin && (
            <button
              onClick={handleLoadInsights}
              className="text-xs text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 underline transition-colors"
            >
              {showInsights ? 'Hide insights' : 'Insights'}
            </button>
          )}
        </div>

        {/* Admin insights panel */}
        {user?.isAdmin && showInsights && (
          <div className="mt-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-4 text-xs space-y-4">
            {insightsLoading ? (
              <p className="text-stone-400">Loading insights…</p>
            ) : insights ? (
              <>
                <div className="flex gap-4 text-stone-500 dark:text-stone-400">
                  <span>👁 {insights.totalReads} read{insights.totalReads !== 1 ? 's' : ''}</span>
                  <span>👤 {insights.uniqueReaders} unique reader{insights.uniqueReaders !== 1 ? 's' : ''}</span>
                </div>

                {insights.reactionGroups.length > 0 && (
                  <div>
                    <p className="text-stone-500 dark:text-stone-400 font-semibold mb-2">Reactions</p>
                    <div className="space-y-2">
                      {insights.reactionGroups.map(g => (
                        <div key={g.emojiKey}>
                          <span className="text-stone-600 dark:text-stone-300">{g.emoji} {g.label} ({g.reactors.length})</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {g.reactors.map(r => (
                              <Link key={r.slug} to={`/profiles/${r.slug}`}
                                className="text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                                {r.username}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {insights.readers.length > 0 && (
                  <div>
                    <p className="text-stone-500 dark:text-stone-400 font-semibold mb-2">Readers</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {insights.readers.map((r, i) => (
                        <div key={`${r.slug}-${i}`} className="flex items-center justify-between">
                          <Link to={`/profiles/${r.slug}`}
                            className="text-stone-600 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                            {r.username}
                          </Link>
                          <span className="text-stone-400">{formatRelativeTime(r.readAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {insights.reactionGroups.length === 0 && insights.readers.length === 0 && (
                  <p className="text-stone-400">No interactions yet.</p>
                )}

                {/* JSON Export */}
                <div className="pt-3 border-t border-stone-200 dark:border-stone-700">
                  <p className="text-stone-500 dark:text-stone-400 font-semibold mb-2">Export reads as JSON</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="block text-stone-400 mb-1">From</label>
                      <input
                        type="date"
                        value={exportFrom}
                        onChange={e => setExportFrom(e.target.value)}
                        className="text-xs border border-stone-200 dark:border-stone-600 rounded px-2 py-1 bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-400 mb-1">To</label>
                      <input
                        type="date"
                        value={exportTo}
                        onChange={e => setExportTo(e.target.value)}
                        className="text-xs border border-stone-200 dark:border-stone-600 rounded px-2 py-1 bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200"
                      />
                    </div>
                    <button
                      onClick={handleExport}
                      disabled={exporting}
                      className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded transition-colors"
                    >
                      {exporting ? 'Exporting…' : 'Download JSON'}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-700">
        <p className="text-xs text-stone-300 dark:text-stone-600">
          Content licensed under Creative Commons. Second Circuit Academy.
        </p>
      </div>
    </div>
  )
}
