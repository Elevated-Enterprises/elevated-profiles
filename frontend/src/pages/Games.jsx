import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGameLeaderboard, getReactions, getActiveEmojis, addReaction, removeReaction, getGameReactionInsights } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import ReactionSummary from '../components/reactions/ReactionSummary'
import ReactionPicker from '../components/reactions/ReactionPicker'
import { communityName } from '../lib/community'

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

const GAMES = [
  {
    key: 'pig',
    path: '/pig',
    emoji: '🐷',
    title: 'Pig Dice',
    desc: 'Roll dice and race to 100 points — but roll a 1 and lose your turn score!',
  },
  {
    key: 'yahtzee',
    path: '/yahtzee',
    emoji: '🎯',
    title: 'Yahtzee',
    desc: 'Roll five dice up to three times per turn and fill your scorecard to outscore your rivals.',
  },
]

function GameCard({ game, reactions, emojis, pickerOpen, onTogglePicker, onReactionToggle, onReloadReactions, insights, insightsOpen, insightsLoading, onToggleInsights }) {
  const { user } = useAuth()

  return (
    <div className="group bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md transition-all overflow-hidden">
      <Link to={game.path} className="block p-5">
        <div className="text-4xl mb-3">{game.emoji}</div>
        <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors mb-1">
          {game.title}
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">{game.desc}</p>
        <div className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-400 group-hover:underline">
          Play now →
        </div>
      </Link>

      <div className="px-5 pb-4 pt-3 border-t border-stone-100 dark:border-stone-700">
        <div className="flex items-center gap-3 flex-wrap">
          <ReactionSummary
            reactions={reactions}
            targetId={game.key}
            targetType="game"
            onUpdate={onReloadReactions}
          />
          {user && (
            <div className="relative">
              <button
                onClick={() => onTogglePicker(game.key)}
                className="text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 border border-stone-200 dark:border-stone-600 rounded-full px-2 py-0.5"
              >
                + React
              </button>
              {pickerOpen && (
                <div className="absolute bottom-full left-0 mb-2 z-20">
                  <ReactionPicker
                    emojis={emojis}
                    userReactions={reactions.filter(r => r.userHasReacted).map(r => r.emojiKey)}
                    onSelect={(emojiKey) => onReactionToggle(game.key, emojiKey)}
                    onClose={() => onTogglePicker(null)}
                  />
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => onToggleInsights(game.key)}
            className="text-xs text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 underline transition-colors"
          >
            {insightsOpen ? 'Hide insights' : 'Insights'}
          </button>
        </div>

        {insightsOpen && (
          <div className="mt-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg p-3 text-xs space-y-3">
            {insightsLoading ? (
              <p className="text-stone-400">Loading insights…</p>
            ) : insights && insights.length > 0 ? (
              insights.map(g => (
                <div key={g.emojiKey}>
                  <span className="text-stone-600 dark:text-stone-300 font-semibold">{g.emoji} {g.label} ({g.reactors.length})</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {g.reactors.map(r => (
                      <Link key={r.slug} to={`/profiles/${r.slug}`}
                        className="text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                        {r.username}
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-stone-400">No reactions yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Games() {
  const [pigStats, setPigStats] = useState([])
  const [yahtzeeStats, setYahtzeeStats] = useState([])
  const [loading, setLoading] = useState(true)

  const [reactions, setReactions] = useState({ pig: [], yahtzee: [] })
  const [emojis, setEmojis] = useState([])
  const [openPicker, setOpenPicker] = useState(null)
  const [insights, setInsights] = useState({ pig: null, yahtzee: null })
  const [openInsights, setOpenInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(null)

  useEffect(() => {
    Promise.all([
      getGameLeaderboard('pig', 20),
      getGameLeaderboard('yahtzee', 20),
    ]).then(([pig, yahtzee]) => {
      setPigStats(pig.data)
      setYahtzeeStats(yahtzee.data)
    }).catch(console.error).finally(() => setLoading(false))

    getActiveEmojis().then(({ data }) => setEmojis(data)).catch(() => {})
    loadReactions('pig')
    loadReactions('yahtzee')
  }, [])

  const loadReactions = (gameKey) => {
    getReactions(gameKey, 'game').then(({ data }) =>
      setReactions(prev => ({ ...prev, [gameKey]: data }))
    ).catch(() => {})
  }

  const handleTogglePicker = (gameKey) => {
    setOpenPicker(prev => prev === gameKey ? null : gameKey)
  }

  const handleReactionToggle = async (gameKey, emojiKey) => {
    const existing = reactions[gameKey].find(r => r.emojiKey === emojiKey && r.userHasReacted)
    try {
      if (existing) {
        await removeReaction(gameKey, 'game', emojiKey)
      } else {
        await addReaction(gameKey, 'game', emojiKey)
      }
      loadReactions(gameKey)
      // Reload insights if open so they stay in sync
      if (openInsights === gameKey) {
        const { data } = await getGameReactionInsights(gameKey)
        setInsights(prev => ({ ...prev, [gameKey]: data }))
      }
    } catch { /* ignore */ }
    setOpenPicker(null)
  }

  const handleToggleInsights = async (gameKey) => {
    if (openInsights === gameKey) {
      setOpenInsights(null)
      return
    }
    setOpenInsights(gameKey)
    if (insights[gameKey] !== null) return
    setInsightsLoading(gameKey)
    try {
      const { data } = await getGameReactionInsights(gameKey)
      setInsights(prev => ({ ...prev, [gameKey]: data }))
    } catch {
      setInsights(prev => ({ ...prev, [gameKey]: [] }))
    } finally {
      setInsightsLoading(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-1">Games</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">Multiplayer games for the {communityName} community</p>
      </div>

      {/* Game cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {GAMES.map(game => (
          <GameCard
            key={game.key}
            game={game}
            reactions={reactions[game.key]}
            emojis={emojis}
            pickerOpen={openPicker === game.key}
            onTogglePicker={handleTogglePicker}
            onReactionToggle={handleReactionToggle}
            onReloadReactions={() => loadReactions(game.key)}
            insights={insights[game.key]}
            insightsOpen={openInsights === game.key}
            insightsLoading={insightsLoading === game.key}
            onToggleInsights={handleToggleInsights}
          />
        ))}
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
