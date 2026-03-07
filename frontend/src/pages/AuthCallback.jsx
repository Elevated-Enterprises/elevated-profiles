import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { postAuthCallback } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import { communityName } from '../lib/community'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState(null)
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = searchParams.get('code')
    if (!code) {
      setError('No authorization code received from Discord.')
      return
    }

    postAuthCallback(code)
      .then((res) => {
        login(res.data.token, res.data.user)
        navigate('/', { replace: true })
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          setError(`You must be a member of the ${communityName} Discord server to access this site.`)
        } else {
          setError('Authentication failed. Please try again.')
        }
      })
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-stone-700 mb-6 text-sm leading-relaxed">{error}</p>
          <a href="/login" className="text-amber-600 hover:text-amber-700 font-medium text-sm">
            ← Back to login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner className="mb-4" />
        <p className="text-stone-500 text-sm">Signing you in...</p>
      </div>
    </div>
  )
}
