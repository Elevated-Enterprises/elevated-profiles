import { useEffect, useRef } from 'react'

export default function ReactionPicker({ emojis, onSelect, onClose, userReactions = [] }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="flex gap-2 flex-wrap p-2 bg-gray-800 rounded-xl shadow-xl border border-gray-700 max-w-xs"
    >
      {emojis.map(emoji => (
        <button
          key={emoji.key}
          onClick={() => { onSelect(emoji.key); onClose() }}
          title={emoji.label}
          className={`text-xl p-1.5 rounded-lg transition-colors
            ${userReactions.includes(emoji.key)
              ? 'bg-yellow-600/30 ring-1 ring-yellow-500'
              : 'hover:bg-gray-700'
            }`}
        >
          {emoji.emoji}
        </button>
      ))}
    </div>
  )
}
