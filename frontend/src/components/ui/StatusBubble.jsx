export default function StatusBubble({ status }) {
  if (!status) return null
  return (
    <div className="absolute -top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
      <div className="bg-gray-800 border border-yellow-600/40 rounded-2xl rounded-bl-sm px-3 py-1.5 text-xs text-gray-200 whitespace-nowrap shadow-lg max-w-[180px] truncate">
        {status}
      </div>
      <div className="w-2 h-2 bg-gray-800 border-r border-b border-yellow-600/40 rotate-45 ml-4 -mt-1" />
    </div>
  )
}
