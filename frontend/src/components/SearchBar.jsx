export default function SearchBar({ value, onChange, placeholder = 'Search profiles...' }) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <svg className="w-5 h-5 text-stone-400 dark:text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 transition-shadow"
      />
    </div>
  )
}
