import { useEffect, useState, useCallback } from 'react'
import { getFeedActivity } from '../../lib/api'
import FeedItem from './FeedItem'
import LoadingSpinner from '../LoadingSpinner'

export default function ActivityFeed({ onOpenThought }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const load = useCallback(async (reset = false) => {
    setLoading(true)
    setError(null)
    try {
      const params = { limit: 30 }
      if (!reset && cursor) params.cursor = cursor
      const { data } = await getFeedActivity(params)
      if (reset) {
        setItems(data)
      } else {
        setItems(prev => [...prev, ...data])
      }
      setHasMore(data.length === 30)
      if (data.length > 0) setCursor(data[data.length - 1].timestamp)
    } catch {
      setError('Failed to load feed.')
    } finally {
      setLoading(false)
    }
  }, [cursor])

  useEffect(() => { load(true) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && items.length === 0) return <LoadingSpinner />

  if (error) return (
    <div className="text-center py-8">
      <p className="text-stone-500 dark:text-stone-400 text-sm mb-3">{error}</p>
      <button
        onClick={() => load(true)}
        className="text-sm text-amber-600 dark:text-amber-400 hover:underline"
      >
        Retry
      </button>
    </div>
  )

  if (items.length === 0)
    return <p className="text-stone-400 dark:text-stone-500 text-sm text-center py-8">No activity yet. Follow some members to see their activity here.</p>

  return (
    <div className="space-y-2">
      {items.map(item => (
        <FeedItem key={item.id} item={item} onOpenThought={onOpenThought} />
      ))}
      {hasMore && (
        <button
          onClick={() => load(false)}
          disabled={loading}
          className="w-full py-2 text-sm text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
        >
          {loading ? 'Loading...' : '▼ Load more'}
        </button>
      )}
    </div>
  )
}
