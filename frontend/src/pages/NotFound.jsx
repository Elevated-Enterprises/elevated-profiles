import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl font-bold text-amber-200 dark:text-amber-900 mb-4 select-none">404</div>
        <h1 className="text-2xl font-semibold text-stone-700 dark:text-stone-300 mb-2">Page not found</h1>
        <p className="text-stone-500 dark:text-stone-400 mb-8 text-sm">The page you're looking for doesn't exist.</p>
        <Link
          to="/"
          className="inline-block bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 px-6 rounded-xl transition-colors shadow-sm"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
