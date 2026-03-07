import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAvailableForms, startSubmission } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import { communityName } from '../lib/community'

const STATE_LABELS = {
  Incomplete: { label: 'In progress', cls: 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300' },
  Submitted: { label: 'Submitted', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  InReview: { label: 'Under review', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  Accepted: { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  Rejected: { label: 'Not accepted', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

function StateBadge({ state }) {
  const info = STATE_LABELS[state] ?? { label: state, cls: 'bg-stone-100 text-stone-600' }
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${info.cls}`}>
      {info.label}
    </span>
  )
}

export default function Applications() {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(null)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const res = await getAvailableForms()
      setForms(res.data)
    } catch {
      setError('Failed to load application forms.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleStart = async (formTypeId) => {
    setStarting(formTypeId)
    try {
      const res = await startSubmission(formTypeId)
      navigate(`/applications/${res.data.id}`)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start application.')
    } finally {
      setStarting(null)
    }
  }

  if (loading) return <LoadingSpinner className="py-20" />

  if (error) return (
    <div className="max-w-2xl mx-auto py-12 text-center text-red-500 text-sm">{error}</div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">My Applications</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-8">
        Application forms you can submit to apply for areas or roles within {communityName}.
      </p>

      {forms.length === 0 && (
        <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 p-8 text-center">
          <p className="text-stone-400 dark:text-stone-500 text-sm">No application forms available at the moment.</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {forms.map(({ formType, mySubmission }) => (
          <div
            key={formType.id}
            className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 p-6"
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h2 className="text-base font-semibold text-stone-800 dark:text-stone-100">{formType.name}</h2>
                {formType.description && (
                  <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{formType.description}</p>
                )}
              </div>
              {mySubmission && <StateBadge state={mySubmission.state} />}
            </div>

            <div className="flex items-center gap-2 mt-4">
              {!mySubmission && (
                <button
                  onClick={() => handleStart(formType.id)}
                  disabled={starting === formType.id}
                  className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                >
                  {starting === formType.id ? 'Starting…' : 'Start Application'}
                </button>
              )}
              {mySubmission && (
                <button
                  onClick={() => navigate(`/applications/${mySubmission.id}`)}
                  className="px-4 py-2 text-sm bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 rounded-lg font-medium transition-colors"
                >
                  {mySubmission.state === 'Incomplete' || mySubmission.state === 'Rejected' ? 'Continue' : 'View'}
                </button>
              )}
              {mySubmission?.state === 'Rejected' && mySubmission.adminRemarks && (
                <span className="text-xs text-red-500 dark:text-red-400">Feedback available — please review before resubmitting.</span>
              )}
            </div>

            {mySubmission?.submittedAt && mySubmission.state === 'Submitted' && (
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-3">
                Submitted {new Date(mySubmission.submittedAt).toLocaleDateString()}
              </p>
            )}
            {mySubmission?.resolvedAt && (mySubmission.state === 'Accepted' || mySubmission.state === 'Rejected') && (
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-3">
                Resolved {new Date(mySubmission.resolvedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
