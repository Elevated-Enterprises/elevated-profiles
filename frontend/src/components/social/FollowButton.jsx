import { useSocial } from '../../context/SocialContext'
import { useAuth } from '../../context/AuthContext'

export default function FollowButton({ userSlug, targetUserId }) {
  const { user } = useAuth()
  const { isFollowing, toggleFollow } = useSocial()

  if (!user || user.id === targetUserId) return null

  const following = isFollowing(targetUserId)

  return (
    <button
      onClick={() => toggleFollow(userSlug, targetUserId)}
      className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors
        ${following
          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          : 'bg-yellow-600 text-black hover:bg-yellow-500'
        }`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
