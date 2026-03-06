export default function CountdownRing({ seconds, maxSeconds, size = 48 }) {
  const strokeWidth = size * 0.12
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = maxSeconds > 0 ? seconds / maxSeconds : 1
  const offset = circumference * (1 - progress)
  const isLow = progress < 1 / 6      // last ~15 s of 90
  const isMed = progress < 1 / 3      // last ~30 s of 90

  const strokeColour = isLow ? '#ef4444' : isMed ? '#f97316' : '#22c55e'

  return (
    <div className={`inline-flex items-center justify-center relative ${isLow ? 'animate-pulse' : ''}`}
      style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-stone-200 dark:stroke-stone-700"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke={strokeColour}
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease' }}
        />
      </svg>
      <span
        className="absolute text-center font-mono font-bold leading-none select-none"
        style={{ fontSize: size * 0.28, color: strokeColour }}
      >
        {seconds}
      </span>
    </div>
  )
}
