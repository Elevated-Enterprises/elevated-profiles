export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-4 py-2 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-200 dark:hover:border-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
      >
        ← Previous
      </button>
      <span className="text-stone-500 dark:text-stone-400 text-sm px-3">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-4 py-2 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-200 dark:hover:border-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
      >
        Next →
      </button>
    </div>
  )
}
