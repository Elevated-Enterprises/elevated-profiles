import { useState } from 'react'

export default function WarningOverlay() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('warningDismissed') === 'true'
  )

  if (dismissed) return null

  const dismiss = () => {
    sessionStorage.setItem('warningDismissed', 'true')
    setDismissed(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-amber-50 dark:bg-stone-800 rounded-2xl shadow-2xl max-w-md mx-4 p-8 border border-amber-200 dark:border-stone-600">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-3">Experimental Preview</h2>
          <p className="text-stone-600 dark:text-stone-300 leading-relaxed text-sm">
            This is a <strong>purely experimental site</strong> for demo purposes and is{' '}
            <strong>not meant for the public</strong>. You are viewing this as part of an early
            access group while we establish the impressum.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm"
        >
          I Understand
        </button>
      </div>
    </div>
  )
}
