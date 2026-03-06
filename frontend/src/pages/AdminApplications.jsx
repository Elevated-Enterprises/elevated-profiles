import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  getAdminApplicationFormTypes, getAdminApplicationFormType,
  createAdminApplicationFormType, updateAdminApplicationFormType,
  getAdminSubmissions, getAdminSubmission,
  startReviewSubmission, acceptSubmission, rejectSubmission,
  lockOutSubmission, assignForm,
  getUsers,
} from '../lib/api'
import ModalBase from '../components/ModalBase'
import LoadingSpinner from '../components/LoadingSpinner'

const STATES = ['Incomplete', 'Submitted', 'InReview', 'Accepted', 'Rejected', 'LockedOut']

const STATE_LABELS = {
  Incomplete: { label: 'Incomplete', cls: 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300' },
  Submitted: { label: 'Submitted', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  InReview: { label: 'In Review', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  Accepted: { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  Rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  LockedOut: { label: 'Locked Out', cls: 'bg-stone-200 text-stone-500 dark:bg-stone-700 dark:text-stone-400' },
}

function StateBadge({ state }) {
  const info = STATE_LABELS[state] ?? { label: state, cls: 'bg-stone-100 text-stone-600' }
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${info.cls}`}>{info.label}</span>
}

// ── Form Type Editor ──────────────────────────────────────────────────────────

function FormTypeEditor({ formTypeId, onSaved, onClose }) {
  const [form, setForm] = useState({ name: '', description: '', isPublic: true, questions: [] })
  const [loading, setLoading] = useState(!!formTypeId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!formTypeId) return
    getAdminApplicationFormType(formTypeId)
      .then((res) => {
        const ft = res.data
        setForm({
          name: ft.name,
          description: ft.description ?? '',
          isPublic: ft.isPublic,
          questions: ft.questions.map((q) => ({ text: q.text, sortOrder: q.sortOrder }))
        })
      })
      .catch(() => setError('Failed to load form type.'))
      .finally(() => setLoading(false))
  }, [formTypeId])

  const addQuestion = () => setForm((f) => ({
    ...f,
    questions: [...f.questions, { text: '', sortOrder: f.questions.length }]
  }))

  const updateQuestion = (i, text) => setForm((f) => ({
    ...f,
    questions: f.questions.map((q, idx) => idx === i ? { ...q, text } : q)
  }))

  const removeQuestion = (i) => setForm((f) => ({
    ...f,
    questions: f.questions.filter((_, idx) => idx !== i).map((q, idx) => ({ ...q, sortOrder: idx }))
  }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        isPublic: form.isPublic,
        questions: form.questions.filter((q) => q.text.trim()).map((q, i) => ({ text: q.text.trim(), sortOrder: i }))
      }
      if (formTypeId) await updateAdminApplicationFormType(formTypeId, payload)
      else await createAdminApplicationFormType(payload)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalBase title={formTypeId ? 'Edit Form Type' : 'New Form Type'} onClose={onClose} size="lg">
      {loading ? <LoadingSpinner /> : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-stone-500 dark:text-stone-400">Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="e.g. Internal Area Application"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-stone-500 dark:text-stone-400">Description (optional)</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
              placeholder="Shown to members above the form…"
            />
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
              className="rounded accent-amber-500"
            />
            <span className="text-sm text-stone-700 dark:text-stone-200">
              Public — visible to all members (if unchecked, only visible when assigned)
            </span>
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-stone-500 dark:text-stone-400">Questions</span>
              <button
                onClick={addQuestion}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                + Add question
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {form.questions.length === 0 && (
                <p className="text-xs text-stone-400 dark:text-stone-500 italic">No questions yet — add at least one.</p>
              )}
              {form.questions.map((q, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-xs text-stone-400 dark:text-stone-500 mt-2.5 w-4 flex-shrink-0">{i + 1}.</span>
                  <input
                    value={q.text}
                    onChange={(e) => updateQuestion(i, e.target.value)}
                    className="flex-1 border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
                    placeholder="Question text…"
                  />
                  <button
                    onClick={() => removeQuestion(i)}
                    className="text-stone-300 dark:text-stone-600 hover:text-red-400 mt-2 text-sm leading-none"
                    title="Remove question"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {saving ? 'Saving…' : 'Save Form Type'}
            </button>
          </div>
        </div>
      )}
    </ModalBase>
  )
}

// ── Submission Detail Modal ───────────────────────────────────────────────────

function SubmissionDetailModal({ submissionId, onClose, onUpdated }) {
  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState(null)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await getAdminSubmission(submissionId)
      setSubmission(res.data)
    } catch {
      setActionError('Failed to load submission.')
    } finally {
      setLoading(false)
    }
  }, [submissionId])

  useEffect(() => { load() }, [load])

  const act = async (fn, label) => {
    setActing(true)
    setActionError(null)
    try {
      await fn()
      await load()
      onUpdated()
    } catch (err) {
      setActionError(err.response?.data?.error || `Failed to ${label}.`)
    } finally {
      setActing(false)
    }
  }

  const handleReject = () => act(() => rejectSubmission(submissionId, rejectRemarks), 'reject')

  if (loading) return <ModalBase title="Submission" onClose={onClose}><LoadingSpinner /></ModalBase>

  if (!submission) return (
    <ModalBase title="Submission" onClose={onClose}>
      <p className="text-red-500 text-sm">{actionError || 'Not found.'}</p>
    </ModalBase>
  )

  return (
    <ModalBase title={`Application: ${submission.formTypeName}`} onClose={onClose} size="lg">
      <div className="flex flex-col gap-5">
        {/* Header info */}
        <div className="flex items-center justify-between gap-4">
          <div>
            {submission.userSlug ? (
              <Link
                to={`/profiles/${submission.userSlug}`}
                className="text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                onClick={onClose}
              >
                {submission.userDisplayName}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">{submission.userDisplayName}</span>
            )}
            {submission.userDiscordUsername && (
              <p className="text-xs text-stone-400 dark:text-stone-500">@{submission.userDiscordUsername}</p>
            )}
          </div>
          <StateBadge state={submission.state} />
        </div>

        {/* Admin remarks */}
        {submission.adminRemarks && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Rejection remarks</p>
            <p className="text-xs text-red-600 dark:text-red-400">{submission.adminRemarks}</p>
          </div>
        )}

        {/* Q&A */}
        <div className="flex flex-col gap-4">
          {submission.questions.map((q, i) => {
            const answer = submission.answers.find((a) => a.questionId === q.id)
            return (
              <div key={q.id} className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-4">
                <p className="text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2">{i + 1}. {q.text}</p>
                <p className="text-sm text-stone-700 dark:text-stone-200 whitespace-pre-wrap">
                  {answer?.text || <span className="text-stone-400 italic">No answer.</span>}
                </p>
              </div>
            )
          })}
        </div>

        {/* Admin actions */}
        {actionError && <p className="text-xs text-red-500">{actionError}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          {submission.state === 'Submitted' && (
            <button
              onClick={() => act(() => startReviewSubmission(submissionId), 'start review')}
              disabled={acting}
              className="px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              Start Review
            </button>
          )}
          {submission.state === 'InReview' && (
            <button
              onClick={() => act(() => acceptSubmission(submissionId), 'accept')}
              disabled={acting}
              className="px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              Accept
            </button>
          )}
          {(submission.state === 'InReview' || submission.state === 'LockedOut') && !showRejectInput && (
            <button
              onClick={() => setShowRejectInput(true)}
              className="px-3 py-1.5 text-xs border border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors"
            >
              Reject
            </button>
          )}
          {showRejectInput && (
            <div className="w-full flex flex-col gap-2">
              <textarea
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                rows={3}
                placeholder="Rejection remarks (optional but recommended)…"
                className="w-full border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={acting}
                  className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                >
                  {acting ? '…' : 'Confirm Rejection'}
                </button>
                <button onClick={() => setShowRejectInput(false)} className="text-xs text-stone-400 hover:text-stone-600 px-2">Cancel</button>
              </div>
            </div>
          )}
          {submission.state !== 'Accepted' && submission.state !== 'LockedOut' && (
            <button
              onClick={() => {
                if (!window.confirm('Lock this user out? They will not be able to see or retract this form until you set it back to Rejected.')) return
                act(() => lockOutSubmission(submissionId), 'lock out')
              }}
              disabled={acting}
              className="px-3 py-1.5 text-xs border border-stone-200 dark:border-stone-600 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:border-stone-400 rounded-lg font-medium transition-colors"
            >
              Lock Out
            </button>
          )}
        </div>

        {/* History */}
        {submission.history && submission.history.length > 0 && (
          <div className="border-t border-stone-100 dark:border-stone-700 pt-4">
            <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-3">History</p>
            <div className="flex flex-col gap-2">
              {submission.history.map((h) => (
                <div key={h.id} className="text-xs text-stone-500 dark:text-stone-400 flex items-start gap-2">
                  <span className="text-stone-300 dark:text-stone-600 mt-0.5">→</span>
                  <span>
                    <span className="font-medium text-stone-600 dark:text-stone-300">{h.toState}</span>
                    {h.fromState && <span> (from {h.fromState})</span>}
                    {' '}by {h.changedByDiscordUsername}
                    {' '}{new Date(h.changedAt).toLocaleString()}
                    {h.remarks && <span className="italic ml-1">"{h.remarks}"</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModalBase>
  )
}

// ── Assign Form Modal ─────────────────────────────────────────────────────────

function AssignFormModal({ formTypes, onClose, onAssigned }) {
  const [formTypeId, setFormTypeId] = useState(formTypes[0]?.id ?? '')
  const [userSearch, setUserSearch] = useState('')
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [lockedOut, setLockedOut] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userSearch.trim()) { setUsers([]); return }
    const t = setTimeout(() => {
      getUsers({ search: userSearch, pageSize: 10, sort: 'name_asc' })
        .then((res) => setUsers(res.data.items))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [userSearch])

  const handleAssign = async () => {
    if (!formTypeId || !selectedUser) return
    setAssigning(true)
    setError(null)
    try {
      await assignForm(formTypeId, selectedUser.slug, lockedOut)
      onAssigned()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign form.')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <ModalBase title="Assign Application Form" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone-500 dark:text-stone-400">Form type</span>
          <select
            value={formTypeId}
            onChange={(e) => setFormTypeId(e.target.value)}
            className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            {formTypes.map((ft) => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone-500 dark:text-stone-400">Search member</span>
          <input
            value={userSearch}
            onChange={(e) => { setUserSearch(e.target.value); setSelectedUser(null) }}
            placeholder="Type a name…"
            className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          {users.length > 0 && !selectedUser && (
            <ul className="border border-stone-200 dark:border-stone-600 rounded-lg overflow-hidden mt-1">
              {users.map((u) => (
                <li key={u.slug}>
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                    onClick={() => { setSelectedUser(u); setUserSearch(u.displayName) }}
                  >
                    {u.displayName}
                    <span className="ml-1 text-stone-400 text-xs">@{u.discordUsername}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedUser && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Selected: {selectedUser.displayName} ({selectedUser.slug})</p>
          )}
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={lockedOut}
            onChange={(e) => setLockedOut(e.target.checked)}
            className="rounded accent-amber-500"
          />
          <span className="text-sm text-stone-700 dark:text-stone-200">
            Assign as Locked Out (user cannot see or fill this form)
          </span>
        </label>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">Cancel</button>
          <button
            onClick={handleAssign}
            disabled={!formTypeId || !selectedUser || assigning}
            className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {assigning ? 'Assigning…' : 'Assign Form'}
          </button>
        </div>
      </div>
    </ModalBase>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminApplications() {
  const [tab, setTab] = useState('submissions')
  const [formTypes, setFormTypes] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [submissionsMeta, setSubmissionsMeta] = useState({ total: 0, page: 1, totalPages: 1 })
  const [filterFormType, setFilterFormType] = useState('')
  const [filterState, setFilterState] = useState('')
  const [loadingSubmissions, setLoadingSubmissions] = useState(true)
  const [loadingFormTypes, setLoadingFormTypes] = useState(true)
  const [editingFormTypeId, setEditingFormTypeId] = useState(null)
  const [showNewFormType, setShowNewFormType] = useState(false)
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null)
  const [showAssign, setShowAssign] = useState(false)

  const loadFormTypes = useCallback(async () => {
    try {
      const res = await getAdminApplicationFormTypes()
      setFormTypes(res.data)
    } catch {
      // ignore
    } finally {
      setLoadingFormTypes(false)
    }
  }, [])

  const loadSubmissions = useCallback(async (page = 1) => {
    setLoadingSubmissions(true)
    try {
      const res = await getAdminSubmissions({
        formTypeId: filterFormType || undefined,
        state: filterState || undefined,
        page,
        pageSize: 20
      })
      setSubmissions(res.data.items)
      setSubmissionsMeta({ total: res.data.totalCount, page: res.data.page, totalPages: res.data.totalPages })
    } catch {
      // ignore
    } finally {
      setLoadingSubmissions(false)
    }
  }, [filterFormType, filterState])

  useEffect(() => { loadFormTypes() }, [loadFormTypes])
  useEffect(() => { if (tab === 'submissions') loadSubmissions() }, [loadSubmissions, tab])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100">Application Forms</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAssign(true)}
            className="px-3 py-2 text-sm border border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-amber-300 dark:hover:border-amber-600 rounded-xl transition-colors"
          >
            Assign Form
          </button>
          <button
            onClick={() => setShowNewFormType(true)}
            className="px-3 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors"
          >
            New Form Type
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-stone-100 dark:bg-stone-800 rounded-xl p-1 w-fit">
        {[['submissions', 'Submissions'], ['formtypes', 'Form Types']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              tab === key
                ? 'bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Submissions Tab ── */}
      {tab === 'submissions' && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={filterFormType}
              onChange={(e) => setFilterFormType(e.target.value)}
              className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="">All form types</option>
              {formTypes.map((ft) => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
            </select>
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="">All states</option>
              {STATES.map((s) => <option key={s} value={s}>{STATE_LABELS[s]?.label ?? s}</option>)}
            </select>
            <button
              onClick={() => loadSubmissions(1)}
              className="px-3 py-2 text-sm bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 rounded-lg transition-colors"
            >
              Refresh
            </button>
          </div>

          {loadingSubmissions ? <LoadingSpinner className="py-12" /> : (
            <>
              <div className="text-xs text-stone-400 dark:text-stone-500 mb-3">{submissionsMeta.total} submission{submissionsMeta.total !== 1 ? 's' : ''}</div>
              {submissions.length === 0 ? (
                <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 p-8 text-center">
                  <p className="text-sm text-stone-400 dark:text-stone-500">No submissions found.</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 dark:border-stone-700">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 dark:text-stone-400">Member</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 dark:text-stone-400">Form</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 dark:text-stone-400">State</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 dark:text-stone-400">Updated</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((s) => (
                        <tr key={s.id} className="border-b border-stone-50 dark:border-stone-800 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-700/30 transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-stone-700 dark:text-stone-200">{s.userDisplayName ?? '—'}</p>
                              {s.userDiscordUsername && <p className="text-xs text-stone-400">@{s.userDiscordUsername}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-stone-600 dark:text-stone-300">{s.formTypeName}</td>
                          <td className="px-4 py-3"><StateBadge state={s.state} /></td>
                          <td className="px-4 py-3 text-xs text-stone-400">
                            {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setSelectedSubmissionId(s.id)}
                              className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {submissionsMeta.totalPages > 1 && (
                <div className="flex gap-2 justify-center mt-4">
                  {Array.from({ length: submissionsMeta.totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => loadSubmissions(p)}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        p === submissionsMeta.page
                          ? 'bg-amber-500 text-white'
                          : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Form Types Tab ── */}
      {tab === 'formtypes' && (
        <div>
          {loadingFormTypes ? <LoadingSpinner className="py-12" /> : formTypes.length === 0 ? (
            <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 p-8 text-center">
              <p className="text-sm text-stone-400 dark:text-stone-500">No form types yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {formTypes.map((ft) => (
                <div key={ft.id} className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700 p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-stone-800 dark:text-stone-100">{ft.name}</p>
                    {ft.description && <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{ft.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${ft.isPublic ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-400'}`}>
                        {ft.isPublic ? 'Public' : 'Assigned only'}
                      </span>
                      <span className="text-xs text-stone-400">{ft.questionCount} question{ft.questionCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingFormTypeId(ft.id)}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex-shrink-0"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showNewFormType && (
        <FormTypeEditor
          formTypeId={null}
          onSaved={() => { setShowNewFormType(false); loadFormTypes() }}
          onClose={() => setShowNewFormType(false)}
        />
      )}
      {editingFormTypeId && (
        <FormTypeEditor
          formTypeId={editingFormTypeId}
          onSaved={() => { setEditingFormTypeId(null); loadFormTypes() }}
          onClose={() => setEditingFormTypeId(null)}
        />
      )}
      {selectedSubmissionId && (
        <SubmissionDetailModal
          submissionId={selectedSubmissionId}
          onClose={() => setSelectedSubmissionId(null)}
          onUpdated={() => loadSubmissions(submissionsMeta.page)}
        />
      )}
      {showAssign && formTypes.length > 0 && (
        <AssignFormModal
          formTypes={formTypes}
          onClose={() => setShowAssign(false)}
          onAssigned={() => { setShowAssign(false); loadSubmissions() }}
        />
      )}
      {showAssign && formTypes.length === 0 && (
        <ModalBase title="Assign Form" onClose={() => setShowAssign(false)}>
          <p className="text-sm text-stone-500">No form types exist yet. Create one first.</p>
        </ModalBase>
      )}
    </div>
  )
}
