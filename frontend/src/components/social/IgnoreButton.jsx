import { useSocial } from '../../context/SocialContext'
import { useAuth } from '../../context/AuthContext'

export default function IgnoreButton({ userSlug, targetUserId }) {
  const { user } = useAuth()
  const { isIgnoring, toggleIgnore } = useSocial()

  if (!user || user.id === targetUserId) return null

  const ignoring = isIgnoring(targetUserId)

  return (
    <button
      onClick={() => toggleIgnore(userSlug, targetUserId)}
      title={ignoring ? 'Remove ignore' : 'Ignore this user'}
      className={`p-1.5 rounded-lg transition-colors text-base
        ${ignoring
          ? 'text-red-400 hover:text-red-300'
          : 'text-gray-600 hover:text-gray-400'
        }`}
    >
      {ignoring ? '🚫' : '👁'}
    </button>
  )
}
