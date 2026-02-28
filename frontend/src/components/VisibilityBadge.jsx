const VISIBILITY = {
  0: { label: 'Private', className: 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300' },
  1: { label: 'Members Only', className: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' },
  2: { label: 'Public', className: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' },
}

export default function VisibilityBadge({ visibility }) {
  const config = VISIBILITY[visibility] ?? VISIBILITY[0]
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
