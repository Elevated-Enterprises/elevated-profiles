export default function ModalBase({ title, onClose, children, size = 'md' }) {
  const widthClass = size === 'lg' ? 'max-w-2xl' : 'max-w-lg'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`bg-white dark:bg-stone-900 rounded-2xl shadow-2xl ${widthClass} w-full max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-700">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 text-2xl leading-none transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
