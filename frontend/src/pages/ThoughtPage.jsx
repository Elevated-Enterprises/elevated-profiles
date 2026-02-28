import { useParams, useNavigate } from 'react-router-dom'
import ThoughtModal from '../components/thoughts/ThoughtModal'
import { getThoughtBySlug } from '../lib/api'
import { useEffect, useState } from 'react'

export default function ThoughtPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [thoughtId, setThoughtId] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getThoughtBySlug(slug)
      .then(({ data }) => setThoughtId(data.id))
      .catch(() => setNotFound(true))
  }, [slug])

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Thought not found.
      </div>
    )
  }

  if (!thoughtId) return null

  return (
    <ThoughtModal
      thoughtId={thoughtId}
      onClose={() => navigate('/')}
    />
  )
}
