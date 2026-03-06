import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSubmission, saveAnswers, submitApplication, retractApplication } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'

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
    <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${info.cls}`}>
      {info.label}
    </span>
  )
}

function HistoryEntry({ entry }) {
  return (
    <div className="flex items-start gap-3 text-xs text-stone-500 dark:text-stone-400">
      <span className="text-stone-300 dark:text-stone-600 mt-0.5">→</span>
      <div>
        <span className="font-medium text-stone-700 dark:text-stone-300">{entry.toState}</span>
        {entry.fromState && <span className="text-stone-400"> (from {entry.fromState})</span>}
        <span className="ml-2">by {entry.changedByDiscordUsername}</span>
        <span className="ml-2">{new Date(entry.changedAt).toLocaleString()}</span>
        {entry.remarks && (
          <p className="mt-1 text-stone-500 italic">"{entry.remarks}"</p>
        )}
      </div>
    </div>
  )
}

export default function ApplicationSubmission() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [answers, setAnswers] = useState({})
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [retracting, setRetracting] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [actionError, setActionError] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await getSubmission(id)
      setSubmission(res.data)
      const answerMap = {}
      res.data.answers.forEach((a) => { answerMap[a.questionId] = a.text })
      setAnswers(answerMap)
    } catch {
      setError('Application not found or not accessible.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const canEdit = submission?.state === 'Incomplete'
  const canSubmit = canEdit && submission?.questions?.every((q) => (answers[q.id] ?? '').trim().length > 0)
  const canRetract = submission?.state === 'Submitted' || submission?.state === 'Rejected'

  const handleSave = async () => {
    setSaving(true)
    setActionError(null)
    try {
      const payload = submission.questions.map((q) => ({ questionId: q.id, text: answers[q.id] ?? '' }))
      await saveAnswers(id, payload)
      setSavedAt(new Date())
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!window.confirm('Submit this application? You can retract it later as long as it has not been put under review.')) return
    setSubmitting(true)
    setActionError(null)
    try {
      const payload = submission.questions.map((q) => ({ questionId: q.id, text: answers[q.id] ?? '' }))
      await saveAnswers(id, payload)
      await submitApplication(id)
      await load()
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to submit.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetract = async () => {
    if (!window.confirm('Retract this application? Your answers will be preserved and you can edit them again.')) return
    setRetracting(true)
    setActionError(null)
    try {
      await retractApplication(id)
      await load()
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to retract.')
    } finally {
      setRetracting(false)
    }
  }

  if (loading) return <LoadingSpinner className="py-20" />

  if (error) return (
    <div className="max-w-2xl mx-auto py-12 text-center text-red-500 text-sm">{error}</div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/applications')}
        className="text-sm text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 mb-6 flex items-center gap-1 transition-colors"
      >
        ← Back to Applications
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100">{submission.formTypeName}</h1>
          {submission.formTypeDescription && (
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{submission.formTypeDescription}</p>
          )}
        </div>
        <StateBadge state={submission.state} />
      </div>

      {/* Admin remarks on rejection */}
      {submission.state === 'Rejected' && submission.adminRemarks && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">Feedback from reviewers</p>
          <p className="text-sm text-red-600 dark:text-red-400">{submission.adminRemarks}</p>
        </div>
      )}

      {/* Accepted message */}
      {submission.state === 'Accepted' && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Your application has been accepted!</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Roles will be assigned manually on Discord.</p>
        </div>
      )}

      {/* Info for submitted/in-review */}
      {(submission.state === 'Submitted' || submission.state === 'InReview') && (
        <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl p-4 mb-6">
          <p className="text-sm text-sky-700 dark:text-sky-300">
            {submission.state === 'Submitted'
              ? 'Your application is awaiting review. You can retract it if you want to make changes.'
              : 'Your application is currently being reviewed. You can no longer retract it at this stage.'}
          </p>
        </div>
      )}

      {/* Questions & Answers */}
      <div className="flex flex-col gap-6 mb-8">
        {submission.questions.map((q, i) => {
          const answer = answers[q.id] ?? ''
          return (
            <div key={q.id} className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 p-6">
              <label className="block text-sm font-semibold text-stone-800 dark:text-stone-100 mb-3">
                {i + 1}. {q.text}
              </label>
              {canEdit ? (
                <>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    maxLength={2000}
                    rows={5}
                    className="w-full border border-stone-200 dark:border-stone-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-y"
                    placeholder="Your answer…"
                  />
                  <div className="text-right text-xs text-stone-400 dark:text-stone-500 mt-1">
                    {answer.length}/2000
                  </div>
                </>
              ) : (
                <p className="text-sm text-stone-600 dark:text-stone-300 whitespace-pre-wrap">
                  {submission.answers.find((a) => a.questionId === q.id)?.text || (
                    <span className="text-stone-400 italic">No answer provided.</span>
                  )}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      {actionError && <p className="text-sm text-red-500 mb-3">{actionError}</p>}

      <div className="flex flex-wrap items-center gap-3 mb-10">
        {canEdit && (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
            {savedAt && (
              <span className="text-xs text-stone-400 dark:text-stone-500">
                Draft saved at {savedAt.toLocaleTimeString()}
              </span>
            )}
          </>
        )}
        {canRetract && (
          <button
            onClick={handleRetract}
            disabled={retracting}
            className="px-4 py-2 text-sm border border-stone-200 dark:border-stone-600 text-stone-500 dark:text-stone-400 hover:border-red-300 hover:text-red-500 dark:hover:border-red-700 dark:hover:text-red-400 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {retracting ? 'Retracting…' : 'Retract Application'}
          </button>
        )}
      </div>

      {/* History */}
      {submission.history && submission.history.length > 0 && (
        <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 p-6">
          <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-200 mb-4">History</h3>
          <div className="flex flex-col gap-3">
            {submission.history.map((entry) => (
              <HistoryEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
