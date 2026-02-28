import ModalBase from './ModalBase'
import { getImageUrl } from '../lib/api'
import VisibilityBadge from './VisibilityBadge'
import MarkdownRenderer from './MarkdownRenderer'

const ALIGNMENT_LABELS = {
  0: 'Lawful Good', 1: 'Neutral Good', 2: 'Chaotic Good',
  3: 'Lawful Neutral', 4: 'True Neutral', 5: 'Chaotic Neutral',
  6: 'Lawful Evil', 7: 'Neutral Evil', 8: 'Chaotic Evil',
}

export default function CompanionDetailModal({ companion, canEdit, isOwn, isPrimary, onClose, onEdit, onDelete, onSetPrimary }) {
  const birthYear = companion.dateOfBirth ? new Date(companion.dateOfBirth).getFullYear() : null

  const handleDelete = () => {
    onClose()
    onDelete(companion)
  }

  return (
    <ModalBase title={companion.name} onClose={onClose}>
      <div className="space-y-4">
        {/* Image */}
        {companion.profileImageUrl && (
          <div className="flex justify-center">
            <div className={`w-32 h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 ${isPrimary ? 'ring-2 ring-amber-400 dark:ring-amber-400' : ''}`}>
              <img
                src={getImageUrl(companion.profileImageUrl)}
                alt={companion.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <VisibilityBadge visibility={companion.visibility} />
          {isPrimary && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">⭐ Primary</span>
          )}
          {companion.alignment != null && (
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
              ⚔ {ALIGNMENT_LABELS[companion.alignment]}
            </span>
          )}
        </div>

        {/* Meta */}
        {(companion.role || companion.platform) && (
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {[companion.role, companion.platform].filter(Boolean).join(' · ')}
          </p>
        )}
        {birthYear && (
          <p className="text-sm text-stone-500 dark:text-stone-400">Born {birthYear}</p>
        )}

        {/* Bio */}
        {companion.bio && (
          <div className="pt-2 border-t border-stone-100 dark:border-stone-700">
            <MarkdownRenderer content={companion.bio} />
          </div>
        )}

        {/* Actions */}
        {(canEdit || isOwn) && (
          <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-700 flex-wrap">
            {isOwn && (
              <button
                onClick={onSetPrimary}
                className={`flex items-center gap-1 text-sm border rounded-lg px-3 py-1.5 transition-colors ${
                  isPrimary
                    ? 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-600 hover:border-amber-400'
                    : 'text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-600 hover:text-amber-600 hover:border-amber-300'
                }`}
              >
                {isPrimary ? '⭐ Primary' : '☆ Set as Primary'}
              </button>
            )}
            {canEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-500 border border-stone-200 dark:border-stone-600 hover:border-amber-300 rounded-lg px-3 py-1.5 transition-colors"
              >
                ✏ Edit
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 text-sm text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-auto"
              >
                🗑 Delete
              </button>
            )}
          </div>
        )}
      </div>
    </ModalBase>
  )
}
