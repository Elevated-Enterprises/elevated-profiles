export default function TagPill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors whitespace-nowrap
        ${active
          ? 'bg-yellow-600 text-black'
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700'
        }`}
    >
      {children}
    </button>
  )
}
