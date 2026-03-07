import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useAuth } from '../context/AuthContext'
import { createYahtzeeGame } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import { communityName } from '../lib/community'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.profiles.secondcircuit.io'

function timeAgo(date) {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export default function YahtzeeGameList() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [games, setGames] = useState([])
  const [connected, setConnected] = useState(false)
  const [creating, setCreating] = useState(false)
  const [customName, setCustomName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState(null)
  const connectionRef = useRef(null)

  const connect = useCallback(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const connection = new HubConnectionBuilder()
      .withUrl(`${BASE_URL}/hubs/yahtzee?mode=list&access_token=${token}`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('OpenGamesUpdated', (gameList) => {
      setGames(gameList || [])
    })

    connection.onclose(() => setConnected(false))
    connection.onreconnecting(() => setConnected(false))
    connection.onreconnected(() => setConnected(true))

    connection.start()
      .then(() => setConnected(true))
      .catch((err) => {
        console.error('SignalR connection failed:', err)
        setConnected(false)
      })

    connectionRef.current = connection
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    connect()
    return () => { connectionRef.current?.stop() }
  }, [authLoading, user, connect])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const res = await createYahtzeeGame(customName || null)
      navigate(`/yahtzee/${res.data.slug}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create game.')
      setCreating(false)
    }
  }

  if (authLoading) return <LoadingSpinner className="min-h-screen" />

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">🎲</div>
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 mb-3">Yahtzee</h1>
        <p className="text-stone-600 dark:text-stone-400 mb-6">
          Real-time multiplayer Yahtzee for the {communityName} community.
          Sign in to play!
        </p>
        <Link to="/login" className="inline-block bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
          Sign in to play
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/games" className="text-xs text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors mb-2 inline-block">
            ← Games overview
          </Link>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
            🎲 Yahtzee
            <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${
              connected
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
            }`}>
              {connected ? 'Live' : 'Connecting...'}
            </span>
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Multiplayer dice game — fill your scorecard and outscore your rivals
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors text-sm"
        >
          + New Game
        </button>
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-stone-800 dark:text-stone-100 mb-3">Create a new game</h2>
          <form onSubmit={handleCreate} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-stone-500 dark:text-stone-400 mb-1">
                Game name (optional)
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={`${user.discordUsername}'s game`}
                maxLength={60}
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl transition-colors text-sm whitespace-nowrap"
            >
              {creating ? 'Creating...' : 'Create & Join Lobby'}
            </button>
          </form>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      )}

      {games.length === 0 ? (
        <div className="text-center py-16 text-stone-400 dark:text-stone-500">
          <div className="text-4xl mb-3">🎲</div>
          <p className="font-medium">No open games right now.</p>
          <p className="text-sm mt-1">Create one and invite your friends!</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 dark:border-stone-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Game</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider hidden sm:table-cell">Host</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider hidden sm:table-cell">Players</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider hidden md:table-cell">Activity</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {games.map((game, i) => (
                <tr
                  key={game.slug}
                  className={`${i > 0 ? 'border-t border-stone-100 dark:border-stone-700' : ''} hover:bg-stone-50 dark:hover:bg-stone-750 transition-colors`}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-stone-800 dark:text-stone-100">{game.name}</span>
                  </td>
                  <td className="px-4 py-3 text-stone-600 dark:text-stone-300 hidden sm:table-cell">
                    {game.gmUsername}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      game.status === 0
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {game.status === 0 ? 'Lobby' : 'In Progress'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500 dark:text-stone-400 hidden sm:table-cell">
                    {game.playerCount}
                    {game.watcherCount > 0 && ` + ${game.watcherCount} watching`}
                  </td>
                  <td className="px-4 py-3 text-stone-400 dark:text-stone-500 text-xs hidden md:table-cell">
                    {timeAgo(game.lastActivity)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/yahtzee/${game.slug}`}
                      className={`inline-block px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        game.status === 0
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {game.status === 0 ? 'Join' : 'Watch'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
