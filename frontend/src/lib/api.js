import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.profiles.secondcircuit.io'

const api = axios.create({
  baseURL: BASE_URL,
  paramsSerializer: (params) => {
    const parts = []
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`)
        }
      } else if (value !== undefined && value !== null) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      }
    }
    return parts.join('&')
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let sessionExpiredHandler = null
export const setSessionExpiredHandler = (handler) => { sessionExpiredHandler = handler }

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token')
      sessionExpiredHandler?.()
    }
    return Promise.reject(error)
  }
)

export const getAuthConfig = () => api.get('/api/auth/config')
export const postAuthCallback = (code) => api.post('/api/auth/callback', { code })
export const getMe = () => api.get('/api/auth/me')
export const getUsers = (params) => api.get('/api/users', { params })
export const getUser = (slug) => api.get(`/api/users/${slug}`)
export const getImageUrl = (filename) => `${BASE_URL}/api/images/${filename}`
export const getLegalDocument = (doc) => api.get(`/api/legal/${doc}`)

export const updateUser = (slug, data) => api.put(`/api/users/${slug}`, data)
export const updateUserSkills = (slug, skillIds) => api.put(`/api/users/${slug}/skills`, { skillIds })
export const updateUserLanguages = (slug, languages) => api.put(`/api/users/${slug}/languages`, { languages })
export const updateUserLlmExperiences = (slug, experiences) => api.put(`/api/users/${slug}/llm-experiences`, { experiences })
export const uploadUserImage = (slug, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/api/users/${slug}/image`, form)
}
export const deleteUserImage = (slug) => api.delete(`/api/users/${slug}/image`)
export const uploadUserBanner = (slug, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/api/users/${slug}/banner`, form)
}
export const deleteUserBanner = (slug) => api.delete(`/api/users/${slug}/banner`)

export const getUserSettings = (slug) => api.get(`/api/users/${slug}/settings`)
export const patchUserSettings = (slug, settings) => api.patch(`/api/users/${slug}/settings`, { settings })

export const getSkills = () => api.get('/api/skills')
export const getLlmProviders = () => api.get('/api/llm-providers')

export const getCompanions = (slug) => api.get(`/api/users/${slug}/companions`)
export const reorderCompanions = (slug, companionIds) => api.put(`/api/users/${slug}/companions/order`, { companionIds })
export const createCompanion = (slug, data) => api.post(`/api/users/${slug}/companions`, data)
export const updateCompanion = (slug, id, data) => api.put(`/api/users/${slug}/companions/${id}`, data)
export const deleteCompanion = (slug, id) => api.delete(`/api/users/${slug}/companions/${id}`)
export const uploadCompanionImage = (slug, id, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/api/users/${slug}/companions/${id}/image`, form)
}
export const deleteCompanionImage = (slug, id) => api.delete(`/api/users/${slug}/companions/${id}/image`)

export const createSkill = (name) => api.post('/api/skills', { name })
export const deleteSkill = (id) => api.delete(`/api/skills/${id}`)
export const createLlmProvider = (name) => api.post('/api/llm-providers', { name })
export const deleteLlmProvider = (id) => api.delete(`/api/llm-providers/${id}`)
export const getAdminAudit = (params) => api.get('/api/admin/audit', { params })
export const getStats = () => api.get('/api/stats')

export const updateUserLinks = (slug, links) => api.put(`/api/users/${slug}/links`, { links })
export const setPrimaryCompanion = (slug, companionId) => api.put(`/api/users/${slug}/primary-companion`, { companionId })
export const updateUserCommunityRoles = (slug, roleIds) => api.put(`/api/users/${slug}/community-roles`, { roleIds })

export const getCommunityRoles = () => api.get('/api/community-roles')
export const createCommunityRole = (name) => api.post('/api/community-roles', { name })
export const deleteCommunityRole = (id) => api.delete(`/api/community-roles/${id}`)

export const getPartnerCommunities = () => api.get('/api/partner-communities')
export const createPartnerCommunity = ({ name, discordInviteUrl }) => api.post('/api/partner-communities', { name, discordInviteUrl })
export const deletePartnerCommunity = (id) => api.delete(`/api/partner-communities/${id}`)
export const setUserAmbassadorCommunity = (slug, communityId) => api.put(`/api/users/${slug}/ambassador-community`, { communityId: communityId || null })

export const setUserBlocked = (slug, blocked) => api.put(`/api/admin/users/${slug}/blocked`, { blocked })
export const deleteAdminUser = (slug) => api.delete(`/api/admin/users/${slug}`)

// ── Thoughts ─────────────────────────────────────────────────────────────────
export const getThoughts = (params) => api.get('/api/thoughts', { params })
export const getThoughtsByUser = (userSlug) => api.get(`/api/thoughts/user/${userSlug}`)
export const getThought = (id) => api.get(`/api/thoughts/${id}`)
export const getThoughtBySlug = (slug) => api.get(`/api/thoughts/slug/${slug}`)
export const createThought = (data) => api.post('/api/thoughts', data)
export const updateThought = (id, data) => api.put(`/api/thoughts/${id}`, data)
export const deleteThought = (id) => api.delete(`/api/thoughts/${id}`)
export const toggleThoughtPin = (id) => api.patch(`/api/thoughts/${id}/pin`)
export const updateThoughtTags = (id, tags) => api.post(`/api/thoughts/${id}/tags`, { tags })
export const uploadThoughtImage = (id, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/api/thoughts/${id}/image`, form)
}
export const deleteThoughtImage = (id) => api.delete(`/api/thoughts/${id}/image`)
export const getThoughtRateLimit = () => api.get('/api/thoughts/rate-limit')
export const setThoughtHidden = (id, hidden) => api.patch(`/api/thoughts/${id}/hidden`, { hidden })
export const getThoughtInsights = (id) => api.get(`/api/thoughts/${id}/insights`)

// ── Comments ──────────────────────────────────────────────────────────────────
export const getComments = (thoughtId) => api.get(`/api/thoughts/${thoughtId}/comments`)
export const createComment = (thoughtId, body) => api.post(`/api/thoughts/${thoughtId}/comments`, { body })
export const deleteComment = (id) => api.delete(`/api/comments/${id}`)

// ── Reactions ─────────────────────────────────────────────────────────────────
export const getActiveEmojis = () => api.get('/api/reactions/emojis')
export const getReactions = (targetId, targetType = 'thought') => api.get(`/api/reactions/${targetId}`, { params: { targetType } })
export const addReaction = (targetId, targetType, emojiKey) => api.post('/api/reactions', { targetId, targetType, emojiKey })
export const removeReaction = (targetId, targetType, emojiKey) => api.delete('/api/reactions', { data: { targetId, targetType, emojiKey } })

// ── Social ────────────────────────────────────────────────────────────────────
export const getSocialState = () => api.get('/api/social/state')
export const followUser = (slug) => api.post(`/api/social/follow/${slug}`)
export const unfollowUser = (slug) => api.delete(`/api/social/follow/${slug}`)
export const ignoreUser = (slug) => api.post(`/api/social/ignore/${slug}`)
export const removeIgnoreUser = (slug) => api.delete(`/api/social/ignore/${slug}`)
export const blockUser = (slug) => api.post(`/api/social/block/${slug}`)
export const unblockUser = (slug) => api.delete(`/api/social/block/${slug}`)

// ── Status ────────────────────────────────────────────────────────────────────
export const setStatus = (text) => api.put('/api/status', { text })
export const getUserStatus = (slug) => api.get(`/api/status/${slug}`)

// ── Feed ──────────────────────────────────────────────────────────────────────
export const getFeedActivity = (params) => api.get('/api/feed/activity', { params })

// ── Admin: Emojis / Tags / Thought Settings ───────────────────────────────────
export const getAdminEmojis = () => api.get('/api/admin/emojis')
export const createAdminEmoji = (data) => api.post('/api/admin/emojis', data)
export const toggleAdminEmoji = (id) => api.patch(`/api/admin/emojis/${id}`)
export const getAdminTags = () => api.get('/api/admin/tags')
export const createAdminTag = (data) => api.post('/api/admin/tags', data)
export const deleteAdminTag = (id) => api.delete(`/api/admin/tags/${id}`)
export const getThoughtSettings = () => api.get('/api/admin/thought-settings')
export const updateThoughtSettings = (data) => api.put('/api/admin/thought-settings', data)
export const setUserThoughtOverride = (userId, data) => api.put(`/api/admin/thought-settings/user/${userId}`, data)

// ── Pig Dice Game ─────────────────────────────────────────────────────────────
export const createPigGame = (customName) => api.post('/api/pig', { customName: customName || null })
export const getOpenPigGames = (page = 1, pageSize = 20) => api.get('/api/pig', { params: { page, pageSize } })

export const createYahtzeeGame = (customName) => api.post('/api/yahtzee', { customName: customName || null })
export const getOpenYahtzeeGames = (page = 1, pageSize = 20) => api.get('/api/yahtzee', { params: { page, pageSize } })

export const getGameLeaderboard = (type, limit = 20) => api.get('/api/stats/games', { params: { type, limit } })

// ── Community Rules ────────────────────────────────────────────────────────────
export const getRules = () => api.get('/api/rules')
export const getRuleById = (id) => api.get(`/api/rules/${id}`)
export const createRule = (data) => api.post('/api/rules', data)
export const updateRule = (id, data) => api.put(`/api/rules/${id}`, data)
export const deleteRule = (id) => api.delete(`/api/rules/${id}`)
export const reorderRules = (ruleIds) => api.put('/api/rules/order', { ruleIds })
export const markRuleRead = (id) => api.post(`/api/rules/${id}/read`)
export const getRulesUnreadCount = () => api.get('/api/rules/unread-count')


// ── Applications ─────────────────────────────────────────────────────────────
export const getAvailableForms = () => api.get('/api/applications/available')
export const getMySubmissions = () => api.get('/api/applications/my')
export const getSubmission = (id) => api.get(`/api/applications/${id}`)
export const startSubmission = (formTypeId) => api.post('/api/applications/start', { formTypeId })
export const saveAnswers = (id, answers) => api.put(`/api/applications/${id}/answers`, { answers })
export const submitApplication = (id) => api.post(`/api/applications/${id}/submit`)
export const retractApplication = (id) => api.post(`/api/applications/${id}/retract`)

// ── Admin: Applications ───────────────────────────────────────────────────────
export const getAdminApplicationFormTypes = () => api.get('/api/admin/applications/form-types')
export const getAdminApplicationFormType = (id) => api.get(`/api/admin/applications/form-types/${id}`)
export const createAdminApplicationFormType = (data) => api.post('/api/admin/applications/form-types', data)
export const updateAdminApplicationFormType = (id, data) => api.put(`/api/admin/applications/form-types/${id}`, data)
export const getAdminSubmissions = (params) => api.get('/api/admin/applications', { params })
export const getAdminSubmission = (id) => api.get(`/api/admin/applications/${id}`)
export const startReviewSubmission = (id) => api.post(`/api/admin/applications/${id}/start-review`)
export const acceptSubmission = (id) => api.post(`/api/admin/applications/${id}/accept`)
export const rejectSubmission = (id, remarks) => api.post(`/api/admin/applications/${id}/reject`, { remarks: remarks || null })
export const lockOutSubmission = (id) => api.post(`/api/admin/applications/${id}/lockout`)
export const assignForm = (formTypeId, userSlug, lockedOut = false) => api.post('/api/admin/applications/assign', { formTypeId, userSlug, lockedOut })

// ── Notifications ─────────────────────────────────────────────────────────────
export const getNotifications = () => api.get('/api/notifications')
export const getNotificationsUnreadCount = () => api.get('/api/notifications/unread-count')
export const markNotificationRead = (id) => api.put(`/api/notifications/${id}/read`)
export const markAllNotificationsRead = () => api.put('/api/notifications/read-all')
// ── Academy ──────────────────────────────────────────────────────────────────

export const getAcademyIndex = () => api.get('/api/academy/index')

export const getAcademyArticle = (path) =>
  api.get('/api/academy/article', { params: { path } })

export const syncAcademy = () => api.post('/api/academy/sync')

export const getAcademyInsights = (path) =>
  api.get('/api/academy/insights', { params: { path } })

export const getAcademyInsightsExport = (path, from, to) =>
  api.get('/api/academy/insights/export', { params: { path, from, to } })

// ── Profile Insights ──────────────────────────────────────────────────────────

export const getProfileInsights = (slug) =>
  api.get(`/api/users/${slug}/profile-insights`)

export const getCompanionReactionInsights = (slug, companionId) =>
  api.get(`/api/users/${slug}/companions/${companionId}/reaction-insights`)

export const getGameReactionInsights = (gameType) =>
  api.get(`/api/stats/games/${gameType}/reaction-insights`)

export default api
