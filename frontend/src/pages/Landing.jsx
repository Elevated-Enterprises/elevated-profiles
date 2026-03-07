import { useState, useEffect, useCallback } from 'react'
import { getUsers, getStats, getSkills, getLlmProviders, getCommunityRoles, getPartnerCommunities, getThoughts, getAdminTags } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { communityName } from '../lib/community'
import { getPreference, setPreference } from '../lib/prefs'
import ProfileCard from '../components/ProfileCard'
import SearchBar from '../components/SearchBar'
import Pagination from '../components/Pagination'
import LoadingSpinner from '../components/LoadingSpinner'
import ActivityFeed from '../components/feed/ActivityFeed'
import CompactThoughtCard from '../components/thoughts/CompactThoughtCard'
import ThoughtModal from '../components/thoughts/ThoughtModal'
import TagPill from '../components/ui/TagPill'

const SORT_OPTIONS = [
  { value: 'random', label: 'Random' },
  { value: 'name_asc', label: 'Name A → Z' },
  { value: 'name_desc', label: 'Name Z → A' },
  { value: 'joined_desc', label: 'Newest Members' },
  { value: 'profile_updated_desc', label: 'Profile Updated' },
  { value: 'last_online_desc', label: 'Last Online' },
]

const EXPERIENCE_LEVELS = [
  { value: '', label: 'Any level' },
  { value: '1', label: 'Beginner+' },
  { value: '2', label: 'Advanced+' },
  { value: '3', label: 'Expert' },
]

const PAGE_SIZE_OPTIONS = [12, 24, 36, 48]

function getInitialPageSize() {
  const saved = localStorage.getItem('sc_page_size')
  const n = Number(saved)
  return PAGE_SIZE_OPTIONS.includes(n) ? n : 12
}

function getInitialSort() {
  const saved = getPreference('sc_sort')
  return SORT_OPTIONS.some((o) => o.value === saved) ? saved : 'random'
}

export default function Landing() {
  const { user } = useAuth()

  // ── Members section ─────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [seed, setSeed] = useState(null)
  const [sort, setSort] = useState(getInitialSort)
  const [refreshKey, setRefreshKey] = useState(0)
  const [hasProfileImage, setHasProfileImage] = useState(() => {
    const saved = getPreference('sc_has_profile_image')
    return saved === null ? true : saved === 'true'
  })
  const [pageSize, setPageSize] = useState(getInitialPageSize)
  const [stats, setStats] = useState(null)
  const [membersExpanded, setMembersExpandedRaw] = useState(() => localStorage.getItem('sc_members_expanded') === 'true')
  const setMembersExpanded = (v) => { setMembersExpandedRaw(v); localStorage.setItem('sc_members_expanded', String(v)) }

  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [allSkills, setAllSkills] = useState([])
  const [allProviders, setAllProviders] = useState([])
  const [allRoles, setAllRoles] = useState([])
  const [selectedSkillIds, setSelectedSkillIds] = useState([])
  const [llmProviderId, setLlmProviderId] = useState('')
  const [minExperienceLevel, setMinExperienceLevel] = useState('')
  const [selectedCommunityRoleId, setSelectedCommunityRoleId] = useState('')
  const [adminOnly, setAdminOnly] = useState(false)
  const [allPartnerCommunities, setAllPartnerCommunities] = useState([])
  const [ambassadorOnly, setAmbassadorOnly] = useState(false)
  const [selectedAmbassadorCommunityId, setSelectedAmbassadorCommunityId] = useState('')

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('feed')

  // ── Thoughts tab ─────────────────────────────────────────────────────────
  const [thoughts, setThoughts] = useState([])
  const [thoughtsLoading, setThoughtsLoading] = useState(false)
  const [openThoughtId, setOpenThoughtId] = useState(null)
  const [adminTags, setAdminTags] = useState([])
  const [activeThoughtTag, setActiveThoughtTag] = useState(null)
  const [thoughtCursor, setThoughtCursor] = useState(null)
  const [thoughtsHasMore, setThoughtsHasMore] = useState(false)

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    getStats().then((res) => setStats(res.data)).catch(() => {})
    getSkills().then((res) => setAllSkills(res.data)).catch(() => {})
    getLlmProviders().then((res) => setAllProviders(res.data)).catch(() => {})
    getCommunityRoles().then((res) => setAllRoles(res.data)).catch(() => {})
    getPartnerCommunities().then((res) => setAllPartnerCommunities(res.data)).catch(() => {})
    getAdminTags().then((res) => setAdminTags(res.data)).catch(() => {})
  }, [])

  // ── Members: debounce + fetch ─────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
    setSeed(null)
  }, [debouncedSearch, sort, hasProfileImage, pageSize, selectedSkillIds, llmProviderId, minExperienceLevel, selectedCommunityRoleId, adminOnly, ambassadorOnly, selectedAmbassadorCommunityId])

  useEffect(() => {
    setLoading(true)
    setError(null)

    // When collapsed, always show 6
    const effectivePageSize = membersExpanded ? pageSize : 6
    const params = { page: membersExpanded ? page : 1, pageSize: effectivePageSize, sort }
    if (debouncedSearch) params.search = debouncedSearch
    if (hasProfileImage) params.hasProfileImage = true
    if (sort === 'random' && seed && page > 1) params.seed = seed
    if (membersExpanded) {
      if (selectedSkillIds.length > 0) params.skillIds = selectedSkillIds
      if (llmProviderId) params.llmProviderId = llmProviderId
      if (llmProviderId && minExperienceLevel) params.minExperienceLevel = Number(minExperienceLevel)
      if (selectedCommunityRoleId) params.communityRoleId = selectedCommunityRoleId
      if (adminOnly) params.adminOnly = true
      if (selectedAmbassadorCommunityId) params.ambassadorCommunityId = selectedAmbassadorCommunityId
      else if (ambassadorOnly) params.ambassadorOnly = true
    }

    getUsers(params)
      .then((res) => {
        setProfiles(res.data.items)
        setTotalPages(res.data.totalPages)
        if (page === 1) setSeed(res.data.seed)
      })
      .catch(() => setError('Failed to load profiles. Please try again.'))
      .finally(() => setLoading(false))
  }, [page, debouncedSearch, sort, hasProfileImage, pageSize, selectedSkillIds, llmProviderId, minExperienceLevel, selectedCommunityRoleId, adminOnly, ambassadorOnly, selectedAmbassadorCommunityId, refreshKey, membersExpanded])

  // ── Thoughts: fetch ───────────────────────────────────────────────────────
  const loadThoughts = useCallback(async (reset = false) => {
    setThoughtsLoading(true)
    try {
      const params = { followedFirst: true, limit: 20 }
      if (activeThoughtTag) params.tag = activeThoughtTag
      if (!reset && thoughtCursor) params.cursor = thoughtCursor
      const { data } = await getThoughts(params)
      if (reset) {
        setThoughts(data)
      } else {
        setThoughts(prev => [...prev, ...data])
      }
      setThoughtsHasMore(data.length === 20)
      if (data.length > 0) setThoughtCursor(data[data.length - 1].createdAt)
    } catch {
      // ignore
    } finally {
      setThoughtsLoading(false)
    }
  }, [activeThoughtTag, thoughtCursor])

  useEffect(() => {
    if (activeTab === 'thoughts') {
      setThoughtCursor(null)
      loadThoughts(true)
    }
  }, [activeTab, activeThoughtTag]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleRefresh = () => { setSeed(null); setPage(1); setRefreshKey((k) => k + 1) }
  const handleSortChange = (value) => { setSort(value); setPreference('sc_sort', value) }
  const handlePageSizeChange = (newSize) => { setPreference('sc_page_size', String(newSize)); setPageSize(newSize) }
  const handleHasProfileImageChange = (checked) => { setHasProfileImage(checked); setPreference('sc_has_profile_image', String(checked)) }
  const toggleSkill = (id) => setSelectedSkillIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])

  const activeFilterCount =
    selectedSkillIds.length +
    (llmProviderId ? 1 : 0) +
    (selectedCommunityRoleId ? 1 : 0) +
    (adminOnly ? 1 : 0) +
    (ambassadorOnly ? 1 : 0) +
    (selectedAmbassadorCommunityId ? 1 : 0)

  const clearFilters = () => {
    setSelectedSkillIds([]); setLlmProviderId(''); setMinExperienceLevel('')
    setSelectedCommunityRoleId(''); setAdminOnly(false); handleHasProfileImageChange(true)
    setAmbassadorOnly(false); setSelectedAmbassadorCommunityId('')
  }

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-10 mb-8">
        <h1 className="text-4xl font-bold text-stone-800 dark:text-stone-100 mb-3 tracking-tight">
          Community Profiles
        </h1>
        <p className="text-lg text-stone-500 dark:text-stone-400 max-w-lg mx-auto">
          Meet the humans and their AI companions of {communityName}.
        </p>
        {stats && (
          <p className="text-sm text-stone-400 dark:text-stone-500 mt-3">
            {stats.totalUsers} {stats.totalUsers === 1 ? 'member' : 'members'} · {stats.totalCompanions} {stats.totalCompanions === 1 ? 'companion' : 'companions'}
          </p>
        )}
        {!user && (
          <div className="mt-6">
            <a
              href="https://discord.gg/secondcircuit"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm text-sm"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              Join us on Discord
            </a>
          </div>
        )}
      </div>

      {/* ── Members Section ──────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Members</h2>
          {!membersExpanded && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm text-stone-500 dark:text-stone-400">
              <input
                type="checkbox"
                checked={hasProfileImage}
                onChange={(e) => handleHasProfileImageChange(e.target.checked)}
                className="rounded border-stone-300 text-amber-500 focus:ring-amber-300"
              />
              With profile picture
            </label>
          )}
        </div>

        {/* Collapsed: 6-card grid */}
        {!membersExpanded && (
          <>
            {loading ? (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-2xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-3">
                {profiles.slice(0, 6).map((profile) => (
                  <ProfileCard key={profile.slug} profile={profile} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Expanded: full controls + grid */}
        {membersExpanded && (
          <div className="space-y-3 mb-4">
            <SearchBar value={search} onChange={setSearch} placeholder="Search humans and companions..." />
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <label className="text-sm text-stone-500 dark:text-stone-400 whitespace-nowrap">Sort by:</label>
                <select
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleRefresh}
                  title="Refresh"
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-stone-200 dark:border-stone-600 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-500 transition-colors bg-white dark:bg-stone-800"
                >↺</button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasProfileImage}
                    onChange={(e) => handleHasProfileImageChange(e.target.checked)}
                    className="rounded border-stone-300 text-amber-500 focus:ring-amber-300"
                  />
                  <span className="text-sm text-stone-500 dark:text-stone-400 whitespace-nowrap">With profile picture</span>
                </label>
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                    showFilters || activeFilterCount > 0
                      ? 'border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-stone-200 dark:border-stone-600 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-500'
                  }`}
                >
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-stone-500 dark:text-stone-400 whitespace-nowrap">Show:</label>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="border border-stone-200 dark:border-stone-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {showFilters && (
              <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-4 space-y-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={adminOnly} onChange={(e) => setAdminOnly(e.target.checked)} className="rounded border-stone-300 text-amber-500 focus:ring-amber-300" />
                  <span className="text-sm text-stone-600 dark:text-stone-300">👑 Admins only</span>
                </label>
                {allPartnerCommunities.length > 0 && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={ambassadorOnly} onChange={(e) => { setAmbassadorOnly(e.target.checked); if (!e.target.checked) setSelectedAmbassadorCommunityId('') }} className="rounded border-stone-300 text-teal-500 focus:ring-teal-300" />
                      <span className="text-sm text-stone-600 dark:text-stone-300">🕊️ Ambassadors only</span>
                    </label>
                    {ambassadorOnly && (
                      <select value={selectedAmbassadorCommunityId} onChange={(e) => setSelectedAmbassadorCommunityId(e.target.value)} className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-300">
                        <option value="">All ambassador communities</option>
                        {allPartnerCommunities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                )}
                {allProviders.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">LLM Experience</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <select value={llmProviderId} onChange={(e) => { setLlmProviderId(e.target.value); if (!e.target.value) setMinExperienceLevel('') }} className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-300">
                        <option value="">Any LLM</option>
                        {allProviders.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {llmProviderId && (
                        <select value={minExperienceLevel} onChange={(e) => setMinExperienceLevel(e.target.value)} className="border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-300">
                          {EXPERIENCE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                )}
                {allSkills.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {allSkills.map((skill) => {
                        const active = selectedSkillIds.includes(skill.id)
                        return (
                          <button key={skill.id} onClick={() => toggleSkill(skill.id)} aria-pressed={active} className={`px-3 py-1 rounded-full text-xs border transition-colors ${active ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white dark:bg-stone-700 border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-amber-300 dark:hover:border-amber-500'}`}>
                            {skill.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {allRoles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">Community Role</p>
                    <div className="flex flex-wrap gap-2">
                      {allRoles.map((role) => {
                        const active = selectedCommunityRoleId === role.id
                        return (
                          <button key={role.id} onClick={() => setSelectedCommunityRoleId(active ? '' : role.id)} aria-pressed={active} className={`px-3 py-1 rounded-full text-xs border transition-colors ${active ? 'bg-violet-500 border-violet-500 text-white' : 'bg-white dark:bg-stone-700 border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-violet-300 dark:hover:border-violet-500'}`}>
                            {role.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {activeFilterCount > 0 && (
                  <div className="pt-1">
                    <button onClick={clearFilters} className="text-xs text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">Clear all filters</button>
                  </div>
                )}
              </div>
            )}

            {error ? (
              <div className="text-center py-8 text-stone-500 dark:text-stone-400">{error}</div>
            ) : loading ? (
              <LoadingSpinner className="py-12" />
            ) : profiles.length === 0 ? (
              <div className="text-center py-12 text-stone-400 dark:text-stone-500">
                {debouncedSearch ? `No results for "${debouncedSearch}"` : 'No profiles found.'}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {profiles.map((profile) => (
                    <ProfileCard key={profile.slug} profile={profile} />
                  ))}
                </div>
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </>
            )}
          </div>
        )}

        <button
          onClick={() => setMembersExpanded(!membersExpanded)}
          className="w-full py-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 border border-stone-200 dark:border-stone-700 rounded-xl hover:border-stone-300 dark:hover:border-stone-600 transition-colors"
        >
          {membersExpanded ? '▲ Show fewer members' : '▼ Show more members'}
        </button>
      </div>

      {/* ── Tabs: Feed + Thoughts ─────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto">
        <div className="flex border-b border-stone-200 dark:border-stone-700 mb-6">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'feed'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
            }`}
          >
            Feed
          </button>
          <button
            onClick={() => setActiveTab('thoughts')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'thoughts'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
            }`}
          >
            Thoughts
          </button>
        </div>

        {activeTab === 'feed' && (
          <ActivityFeed onOpenThought={setOpenThoughtId} />
        )}

        {activeTab === 'thoughts' && (
          <div>
            {adminTags.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                <TagPill active={!activeThoughtTag} onClick={() => setActiveThoughtTag(null)}>All</TagPill>
                {adminTags.map(tag => (
                  <TagPill key={tag.id} active={activeThoughtTag === tag.name} onClick={() => setActiveThoughtTag(tag.name)}>
                    #{tag.name}
                  </TagPill>
                ))}
              </div>
            )}

            {thoughtsLoading && thoughts.length === 0 ? (
              <LoadingSpinner />
            ) : thoughts.length === 0 ? (
              <p className="text-center text-stone-500 dark:text-stone-400 text-sm py-8">No thoughts yet. Be the first to share!</p>
            ) : (
              <>
                {thoughts.map(thought => (
                  <CompactThoughtCard
                    key={thought.id}
                    thought={thought}
                    onClick={() => setOpenThoughtId(thought.id)}
                    onRefresh={() => loadThoughts(true)}
                  />
                ))}
                {thoughtsHasMore && (
                  <button
                    onClick={() => loadThoughts(false)}
                    disabled={thoughtsLoading}
                    className="w-full py-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                  >
                    {thoughtsLoading ? 'Loading...' : '▼ Load more'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {openThoughtId && (
        <ThoughtModal thoughtId={openThoughtId} onClose={() => setOpenThoughtId(null)} />
      )}
    </div>
  )
}
