import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { getImageUrl } from '../lib/api'
import StatusBubble from './ui/StatusBubble'

const ALIGNMENT_LABELS = {
  0: 'Lawful Good',
  1: 'Neutral Good',
  2: 'Chaotic Good',
  3: 'Lawful Neutral',
  4: 'True Neutral',
  5: 'Chaotic Neutral',
  6: 'Lawful Evil',
  7: 'Neutral Evil',
  8: 'Chaotic Evil',
}

// Deterministic color palette — index chosen by hashing the display name
const AVATAR_GRADIENTS = [
  ['#f59e0b', '#d97706'], // amber
  ['#8b5cf6', '#7c3aed'], // violet
  ['#06b6d4', '#0891b2'], // cyan
  ['#10b981', '#059669'], // emerald
  ['#f43f5e', '#e11d48'], // rose
  ['#3b82f6', '#2563eb'], // blue
  ['#ec4899', '#db2777'], // pink
  ['#14b8a6', '#0d9488'], // teal
  ['#f97316', '#ea580c'], // orange
  ['#a855f7', '#9333ea'], // purple
]

function hashName(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function getAvatarGradient(name) {
  return AVATAR_GRADIENTS[hashName(name) % AVATAR_GRADIENTS.length]
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function ProfileCard({ profile }) {
  const { slug, displayName, profileImageUrl, companionNames, alignment, isAdmin, hasCommunityRoles, primaryCompanionName, isAmbassador, ambassadorCommunityName, status } = profile
  const [colorA, colorB] = getAvatarGradient(displayName)
  const initials = getInitials(displayName)

  return (
    <Link to={`/profiles/${slug}`} className="block group relative">
      <StatusBubble status={status} />
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm group-hover:shadow-lg group-hover:-translate-y-0.5 transition-all duration-200 overflow-hidden border border-stone-100 dark:border-stone-700 group-hover:border-amber-200 dark:group-hover:border-amber-700">
        <div className="aspect-square relative overflow-hidden">
          {profileImageUrl ? (
            <img
              src={getImageUrl(profileImageUrl)}
              alt={displayName}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center font-bold text-white text-2xl select-none tracking-wide"
              style={{ background: `linear-gradient(135deg, ${colorA}, ${colorB})` }}
            >
              {initials}
            </div>
          )}

          {/* Hover overlay — gradient from bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

          {isAmbassador && (
            <div className="absolute top-1.5 left-1.5 bg-teal-500 rounded-full w-6 h-6 flex items-center justify-center text-sm shadow leading-none" title={ambassadorCommunityName ? `Ambassador of ${ambassadorCommunityName}` : 'Ambassador'}>
              🕊️
            </div>
          )}

          {hasCommunityRoles && (
            <div className={`absolute bottom-1.5 bg-violet-500 dark:bg-violet-600 rounded-full w-6 h-6 flex items-center justify-center text-sm shadow leading-none ${isAdmin ? 'right-8' : 'right-1.5'}`} title="Team member">
              ⭐
            </div>
          )}
          {isAdmin && (
            <div className="absolute bottom-1.5 right-1.5 bg-amber-400 dark:bg-amber-500 rounded-full w-6 h-6 flex items-center justify-center text-sm shadow leading-none" title="Admin">
              👑
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="flex items-center justify-between gap-1 min-w-0">
            <h3 className="font-semibold text-stone-800 dark:text-stone-100 truncate text-sm">{displayName}</h3>
            <span className="flex-shrink-0 text-amber-500 dark:text-amber-400 text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">→</span>
          </div>
          <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5 truncate min-h-[1.25rem]">
            {alignment != null ? `⚔ ${ALIGNMENT_LABELS[alignment]}` : '\u00a0'}
          </p>
          {companionNames?.length > 0 ? (
            <p className="text-xs mt-0.5 min-h-[1.25rem] truncate">
              {companionNames.map((name, i) => (
                <Fragment key={name}>
                  {i > 0 && <span className="text-stone-400 dark:text-stone-500">, </span>}
                  <span className={name === primaryCompanionName
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : 'text-stone-400 dark:text-stone-500'}>
                    {name}
                  </span>
                </Fragment>
              ))}
            </p>
          ) : (
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5 min-h-[1.25rem]">&nbsp;</p>
          )}
        </div>
      </div>
    </Link>
  )
}
