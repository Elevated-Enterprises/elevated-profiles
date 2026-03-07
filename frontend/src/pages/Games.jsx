import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGameLeaderboard } from '../lib/api'

function timeAgo(date) {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

function LeaderboardTable({ entries, title, showBotCategory }) {
  const [tab, setTab] = useState('pure')

  const pure = entries.filter(e => e.gamesPlayed > 0 || e.gamesWon > 0)
    .sort((a, b) => b.gamesWon - a.gamesWon || b.gamesPlayed - a.gamesPlayed)
  const withBots = entries.filter(e => e.gamesPlayedWithBots > 0 || e.gamesWonWithBots > 0)
    .sort((a, b) => b.gamesWonWithBots - a.gamesWonWithBots || b.gamesPlayedWithBots - a.gamesPlayedWithBots)

  const rows = tab === 'pure' ? pure : withBots
  const wonKey = tab === 'pure' ? 'gamesWon' : 'gamesWonWithBots'
  const playedKey = tab === 'pure' ? 'gamesPlayed' : 'gamesPlayedWithBots'

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-700 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-semibold text-stone-800 dark:text-stone-100">{title}</h2>
        {showBotCategory && (
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setTab('pure')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                tab === 'pure'
                  ? 'bg-amber-500 text-white font-medium'
                  : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700'
              }`}
            >
              Humans only
            </button>
            <button
              onClick={() => setTab('bots')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                tab === 'bots'
                  ? 'bg-sky-500 text-white font-medium'
                  : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700'
              }`}
            >
              With bots
            </button>
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-center text-sm text-stone-400 dark:text-stone-500 py-8">No games recorded yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 dark:border-stone-700">
              <th className="px-4 py-2 text-left text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider w-8">#</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">Player</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">Won</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">Played</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden sm:table-cell">Win %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => (
              <tr key={e.userId} className={`${i > 0 ? 'border-t border-stone-100 dark:border-stone-700' : ''} hover:bg-stone-50 dark:hover:bg-stone-750 transition-colors`}>
                <td className="px-4 py-2.5 text-stone-400 dark:text-stone-500 text-xs font-medium">{i + 1}</td>
                <td className="px-4 py-2.5">
                  {e.userSlug ? (
                    <Link to={`/profiles/${e.userSlug}`} className="font-medium text-stone-800 dark:text-stone-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                      {e.username}
                    </Link>
                  ) : (
                    <span className="font-medium text-stone-800 dark:text-stone-100">{e.username}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className="font-bold text-amber-600 dark:text-amber-400">{e[wonKey]}</span>
                </td>
                <td className="px-4 py-2.5 text-center text-stone-500 dark:text-stone-400">{e[playedKey]}</td>
                <td className="px-4 py-2.5 text-center text-stone-500 dark:text-stone-400 hidden sm:table-cell">
                  {e[playedKey] > 0 ? `${Math.round((e[wonKey] / e[playedKey]) * 100)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function Games() {
  const [pigStats, setPigStats] = useState([])
  const [yahtzeeStats, setYahtzeeStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getGameLeaderboard('pig', 20),
      getGameLeaderboard('yahtzee', 20),
    ]).then(([pig, yahtzee]) => {
      setPigStats(pig.data)
      setYahtzeeStats(yahtzee.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1">Games</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">Multiplayer games for the Second Circuit community</p>
      </div>

      {/* Game cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <Link
          to="/pig"
          className="group bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 shadow-sm hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md transition-all"
        >
          <div className="text-4xl mb-3">🐷</div>
          <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors mb-1">
            Pig Dice
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Roll dice and race to 100 points — but roll a 1 and lose your turn score!
          </p>
          <div className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-400 group-hover:underline">
            Play now →
          </div>
        </Link>

        <Link
          to="/yahtzee"
          className="group bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 shadow-sm hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md transition-all"
        >
          <div className="text-4xl mb-3">🎯</div>
          <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors mb-1">
            Yahtzee
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Roll five dice up to three times per turn and fill your scorecard to outscore your rivals.
          </p>
          <div className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-400 group-hover:underline">
            Play now →
          </div>
        </Link>
      </div>

      {/* Leaderboards */}
      <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4">Leaderboard</h2>
      {loading ? (
        <div className="text-center text-stone-400 dark:text-stone-500 py-12 text-sm">Loading stats...</div>
      ) : (
        <div className="space-y-6">
          <LeaderboardTable
            title="Pig Dice"
            entries={pigStats}
            showBotCategory
          />
          <LeaderboardTable
            title="Yahtzee"
            entries={yahtzeeStats}
            showBotCategory={false}
          />
        </div>
      )}
    </div>
  )
}
