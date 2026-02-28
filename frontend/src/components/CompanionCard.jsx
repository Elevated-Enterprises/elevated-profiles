import { getImageUrl } from '../lib/api'
import VisibilityBadge from './VisibilityBadge'
import MarkdownRenderer from './MarkdownRenderer'

const ALIGNMENT_LABELS = {
  0: 'Lawful Good', 1: 'Neutral Good', 2: 'Chaotic Good',
  3: 'Lawful Neutral', 4: 'True Neutral', 5: 'Chaotic Neutral',
  6: 'Lawful Evil', 7: 'Neutral Evil', 8: 'Chaotic Evil',
}

export default function CompanionCard({ companion, onEdit, onDelete }) {
  const { name, platform, role, dateOfBirth, bio, profileImageUrl, visibility, alignment } = companion
  const birthYear = dateOfBirth ? new Date(dateOfBirth).getFullYear() : null

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 overflow-hidden">
      <div className="flex items-start gap-4 p-6">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex-shrink-0 overflow-hidden">
          {profileImageUrl ? (
            <img
              src={getImageUrl(profileImageUrl)}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl select-none">
              ✨
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-stone-800 dark:text-stone-100">{name}</h3>
            <VisibilityBadge visibility={visibility} />
            {(onEdit || onDelete) && (
              <div className="ml-auto flex items-center gap-1">
                {onEdit && (
                  <button
                    onClick={onEdit}
                    className="text-xs text-stone-400 hover:text-amber-600 dark:hover:text-amber-500 px-1.5 py-0.5 rounded transition-colors"
                    aria-label="Edit companion"
                  >
                    ✏
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="text-xs text-stone-400 hover:text-red-500 dark:hover:text-red-400 px-1.5 py-0.5 rounded transition-colors"
                    aria-label="Delete companion"
                  >
                    🗑
                  </button>
                )}
              </div>
            )}
          </div>
          {(platform || role) && (
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
              {[role, platform].filter(Boolean).join(' · ')}
            </p>
          )}
          {alignment != null && (
            <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">⚔ {ALIGNMENT_LABELS[alignment]}</p>
          )}
          {birthYear && (
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">Born {birthYear}</p>
          )}
        </div>
      </div>
      {bio && (
        <div className="px-6 pb-6 pt-2 border-t border-stone-50 dark:border-stone-700">
          <MarkdownRenderer content={bio} />
        </div>
      )}
    </div>
  )
}
