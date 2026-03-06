import { useEffect, useRef, useReducer, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useAuth } from '../context/AuthContext'
import { getImageUrl } from '../lib/api'
import ModalBase from '../components/ModalBase'
import LoadingSpinner from '../components/LoadingSpinner'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.profiles.secondcircuit.io'

// ── Avatar helpers (same palette as ProfileCard) ──────────────────────────────

const AVATAR_GRADIENTS = [
  ['#f59e0b', '#d97706'],
  ['#8b5cf6', '#7c3aed'],
  ['#06b6d4', '#0891b2'],
  ['#10b981', '#059669'],
  ['#f43f5e', '#e11d48'],
  ['#3b82f6', '#2563eb'],
  ['#ec4899', '#db2777'],
  ['#14b8a6', '#0d9488'],
  ['#f97316', '#ea580c'],
  ['#a855f7', '#9333ea'],
]

function hashName(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

function getGradient(name) {
  return AVATAR_GRADIENTS[hashName(name) % AVATAR_GRADIENTS.length]
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── Reducer ───────────────────────────────────────────────────────────────────

const initialState = {
  phase: 'connecting', // connecting | lobby | in-progress | finished | play-again | closed | error
  game: null,          // PigGameStateSnapshot
  myUserId: null,
  lastDiceValue: null,
  lastDiceRolledBy: null,
  lastPigUsername: null,
  currentTurnScore: 0,
  chat: [],
  idleCountdown: null,
  idleCountdownMax: null,
  winner: null,
  playAgainVoteYes: 0,
  playAgainVoteNo: 0,
  myPlayAgainVote: null,
  error: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, myUserId: action.userId }

    case 'GAME_STATE':
      return {
        ...state,
        phase: statusToPhase(action.data.status),
        game: action.data,
        currentTurnScore: action.data.currentTurnScore,
      }

    case 'PARTICIPANT_JOINED':
      if (!state.game) return state
      return {
        ...state,
        game: { ...state.game, participants: action.participants },
      }

    case 'PARTICIPANT_LEFT':
      if (!state.game) return state
      return {
        ...state,
        game: { ...state.game, participants: action.participants },
      }

    case 'PLAYER_KICKED':
      if (!state.game) return state
      return {
        ...state,
        game: { ...state.game, participants: action.participants },
        chat: [...state.chat, systemMsg(`${action.username} was kicked (${action.reason === 'kicked_by_gm' ? 'removed by Game Master' : 'idle'}).`)],
      }

    case 'GAME_STARTED':
      if (!state.game) return state
      return {
        ...state,
        phase: 'in-progress',
        game: { ...state.game, status: 1, turnOrder: action.turnOrder, currentPlayerIndex: 0, participants: action.participants },
        currentTurnScore: 0,
        lastDiceValue: null,
        lastPigUsername: null,
        idleCountdown: null,
        idleCountdownMax: null,
      }

    case 'GAME_CANCELLED':
      return {
        ...state,
        phase: 'closed',
        error: action.reason === 'gm_left' ? 'The Game Master left — game over.' : 'Game was cancelled.',
        chat: [...state.chat, systemMsg(action.reason === 'gm_left' ? 'The Game Master left — game over.' : 'Game was cancelled.')],
      }

    case 'GAME_CLOSED':
      return {
        ...state,
        phase: 'closed',
        error: reasonToMessage(action.reason),
        chat: [...state.chat, systemMsg(reasonToMessage(action.reason))],
      }

    case 'DICE_ROLLED': {
      const pigUsername = action.value === 1
        ? (state.game?.participants.find(p => p.userId === action.rolledBy)?.username ?? 'Unknown')
        : null
      return {
        ...state,
        lastDiceValue: action.value,
        lastDiceRolledBy: action.rolledBy,
        lastPigUsername: pigUsername,
        currentTurnScore: action.turnScore,
        idleCountdown: null,
        idleCountdownMax: null,
      }
    }

    case 'TURN_ENDED': {
      if (!state.game) return state
      const newIndex = state.game.turnOrder.indexOf(action.nextPlayerId)
      return {
        ...state,
        game: {
          ...state.game,
          currentPlayerIndex: newIndex >= 0 ? newIndex : state.game.currentPlayerIndex,
          participants: state.game.participants.map(p => ({
            ...p,
            score: action.scores[p.userId] ?? p.score,
          })),
        },
        currentTurnScore: 0,
        lastDiceValue: null,
        idleCountdown: null,
        idleCountdownMax: null,
      }
    }

    case 'TURN_SKIPPED': {
      if (!state.game) return state
      const newIdx = state.game.turnOrder.indexOf(action.nextPlayerId)
      return {
        ...state,
        game: {
          ...state.game,
          currentPlayerIndex: newIdx >= 0 ? newIdx : state.game.currentPlayerIndex,
        },
        currentTurnScore: 0,
        lastDiceValue: null,
        idleCountdown: null,
        idleCountdownMax: null,
        chat: [...state.chat, systemMsg(`${action.username} was skipped (${action.reason}).`)],
      }
    }

    case 'IDLE_COUNTDOWN':
      return {
        ...state,
        idleCountdown: action.seconds,
        idleCountdownMax: state.idleCountdown === null ? action.seconds : state.idleCountdownMax,
      }

    case 'GAME_WON':
      return {
        ...state,
        phase: 'finished',
        winner: action,
        game: state.game ? {
          ...state.game,
          status: 2,
          participants: state.game.participants.map(p => ({
            ...p,
            score: action.scores[p.userId] ?? p.score,
          })),
        } : state.game,
        idleCountdown: null,
        idleCountdownMax: null,
        chat: [...state.chat, systemMsg(`🏆 ${action.winnerUsername} wins with ${action.scores[action.winnerUserId]} points!`)],
      }

    case 'PLAY_AGAIN_PROMPT':
      return {
        ...state,
        phase: 'play-again',
        playAgainVoteYes: 0,
        playAgainVoteNo: 0,
        myPlayAgainVote: null,
      }

    case 'PLAY_AGAIN_VOTE_UPDATE':
      return {
        ...state,
        playAgainVoteYes: action.yesCount,
        playAgainVoteNo: action.noCount,
      }

    case 'PLAY_AGAIN_RESULT':
      return {
        ...state,
        phase: 'lobby',
        game: state.game ? { ...state.game, status: 0, participants: action.participants, turnOrder: [], currentPlayerIndex: 0 } : state.game,
        winner: null,
        lastDiceValue: null,
        lastPigUsername: null,
        currentTurnScore: 0,
        idleCountdown: null,
        idleCountdownMax: null,
        playAgainVoteYes: 0,
        playAgainVoteNo: 0,
        myPlayAgainVote: null,
      }

    case 'CHAT_MESSAGE':
      return {
        ...state,
        chat: [...state.chat, action.message].slice(-200),
      }

    case 'MY_PLAY_AGAIN_VOTE':
      return { ...state, myPlayAgainVote: action.vote }

    case 'ERROR':
      return { ...state, phase: 'error', error: action.message }

    default:
      return state
  }
}

function statusToPhase(status) {
  switch (status) {
    case 0: return 'lobby'
    case 1: return 'in-progress'
    case 2: return 'finished'
    case 3: return 'closed'
    default: return 'lobby'
  }
}

function reasonToMessage(reason) {
  switch (reason) {
    case 'gm_no': return 'The Game Master ended the game.'
    case 'abandoned': return 'Game closed due to inactivity.'
    case 'all_left': return 'All players left. Game over.'
    default: return 'Game closed.'
  }
}

function systemMsg(text) {
  return { username: 'System', role: 'system', text, timestamp: new Date().toISOString(), isSystem: true }
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function Avatar({ username, avatarUrl, size = 'md' }) {
  const [colorA, colorB] = getGradient(username)
  const initials = getInitials(username)
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm'

  return (
    <div className={`${sz} rounded-full flex-shrink-0 overflow-hidden`}>
      {avatarUrl ? (
        <img src={getImageUrl(avatarUrl)} alt={username} className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-bold text-white select-none"
          style={{ background: `linear-gradient(135deg, ${colorA}, ${colorB})` }}
        >
          {initials}
        </div>
      )}
    </div>
  )
}

function ParticipantCard({ participant, isGm, isCurrentPlayer, isMine, onKick, showKick, userSlug }) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
      isCurrentPlayer ? 'bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-700' : 'hover:bg-stone-50 dark:hover:bg-stone-750'
    }`}>
      <div
        className={`relative ${participant.isBot ? '' : 'group cursor-pointer'}`}
        onClick={() => !participant.isBot && userSlug && window.open(`/profiles/${userSlug}`, '_blank')}
      >
        <div className={`transition-transform duration-200 ${participant.isBot ? '' : 'group-hover:scale-110'}`}>
          <Avatar username={participant.username} avatarUrl={participant.avatarUrl} />
        </div>
        {!participant.isConnected && !participant.isBot && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-stone-400 rounded-full border-2 border-white dark:border-stone-800" title="Disconnected" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-sm text-stone-800 dark:text-stone-100 truncate">
            {participant.username}
          </span>
          {isGm && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">GM</span>}
          {participant.isBot && <span className="text-xs bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded-full">Bot</span>}
          {participant.role === 'watcher' && <span className="text-xs bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 px-1.5 py-0.5 rounded-full">Watcher</span>}
          {isCurrentPlayer && <span className="text-xs bg-amber-400 dark:bg-amber-600 text-white px-1.5 py-0.5 rounded-full">Playing</span>}
        </div>
        {participant.score > 0 && (
          <div className="text-xs text-stone-500 dark:text-stone-400">{participant.score} pts</div>
        )}
      </div>
      {showKick && !isMine && (
        <button
          onClick={() => onKick(participant.userId, participant.isBot)}
          className="text-xs text-stone-400 hover:text-red-500 dark:hover:text-red-400 transition-colors px-1"
          title={participant.isBot ? 'Remove bot' : 'Kick'}
        >
          ✕
        </button>
      )}
    </div>
  )
}

function DiceDisplay({ value }) {
  const faces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
  return (
    <div className={`text-8xl leading-none transition-all duration-200 select-none ${value === 1 ? 'grayscale opacity-50' : ''}`}>
      {value ? faces[value] : '🎲'}
    </div>
  )
}

function IdleCountdownRing({ seconds, maxSeconds }) {
  const size = 72
  const strokeWidth = 6
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = maxSeconds > 0 ? seconds / maxSeconds : 1
  const offset = circumference * (1 - progress)
  const isLow = progress < 120 / 360

  return (
    <div className={`inline-flex items-center justify-center ${isLow ? 'animate-pulse' : ''}`}>
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
          className={isLow ? 'stroke-red-500' : 'stroke-amber-400'}
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease' }}
        />
      </svg>
    </div>
  )
}

function ChatPanel({ messages, onSend, disabled }) {
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-stone-400 dark:text-stone-500 text-center py-4">No messages yet. Say hi!</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`text-xs leading-relaxed ${msg.isSystem ? 'text-stone-400 dark:text-stone-500 italic text-center' : 'text-stone-700 dark:text-stone-300'}`}>
            {!msg.isSystem && (
              <span className="font-semibold text-stone-800 dark:text-stone-200 mr-1">{msg.username}</span>
            )}
            {msg.role === 'watcher' && !msg.isSystem && (
              <span className="text-xs text-stone-400 mr-1">[W]</span>
            )}
            {msg.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-stone-100 dark:border-stone-700 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Chat..."
          maxLength={500}
          disabled={disabled}
          className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-700 text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="text-xs bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-2 py-1.5 rounded-lg transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}

function HowToPlayModal({ onClose }) {
  return (
    <ModalBase title="How to Play Pig" onClose={onClose} size="lg">
      <div className="space-y-4 text-sm text-stone-700 dark:text-stone-300">
        <p><strong>The Goal:</strong> Be the first player to reach <strong>100 points</strong>.</p>
        <div>
          <p className="font-semibold mb-1">On Your Turn:</p>
          <p className="mb-2">🎲 <strong>Roll</strong> — Roll the die and see what happens:</p>
          <ul className="ml-5 space-y-1 list-disc text-stone-600 dark:text-stone-400">
            <li>You roll a <strong>2–6</strong> → that number is added to your turn score. Keep rolling or Hold.</li>
            <li>You roll a <strong>1 (Pig!)</strong> → you lose your turn score. Turn passes to the next player.</li>
          </ul>
          <p className="mt-2">✋ <strong>Hold</strong> — Bank your turn score and pass the turn.</p>
        </div>
        <div>
          <p className="font-semibold mb-1">Joining & Watching:</p>
          <ul className="ml-5 space-y-1 list-disc text-stone-600 dark:text-stone-400">
            <li>Open games can be <strong>joined</strong> from the list — you'll enter the lobby.</li>
            <li>Running games can be <strong>watched</strong> live. Chat with players and join the next round.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold mb-1">Idle & Disconnect:</p>
          <ul className="ml-5 space-y-1 list-disc text-stone-600 dark:text-stone-400">
            <li>60-second turn timer — don't fall asleep or you'll be skipped.</li>
            <li>Two consecutive skips and you're out.</li>
            <li>30 seconds to reconnect if you lose connection during your turn.</li>
          </ul>
        </div>
        <p className="text-stone-500 dark:text-stone-400 text-xs pt-2 border-t border-stone-100 dark:border-stone-700">
          The Game Master controls the lobby, can kick players, and starts the next round after "Play Again?".
        </p>
      </div>
    </ModalBase>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PigGame() {
  const { slug } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(reducer, initialState)
  const connectionRef = useRef(null)
  const [showChat, setShowChat] = useState(true)
  const [showRules, setShowRules] = useState(false)

  const isGm = state.game?.gmUserId === state.myUserId
  const myParticipant = state.game?.participants.find(p => p.userId === state.myUserId)
  const myRole = myParticipant?.role
  const isPlayer = myRole === 'player'
  const activeUserId = state.game && state.game.turnOrder.length > 0
    ? state.game.turnOrder[state.game.currentPlayerIndex % state.game.turnOrder.length]
    : null
  const isMyTurn = isPlayer && activeUserId === state.myUserId

  const connect = useCallback(() => {
    const token = localStorage.getItem('token')
    if (!token || !slug) return

    const connection = new HubConnectionBuilder()
      .withUrl(`${BASE_URL}/hubs/pig?gameSlug=${slug}&access_token=${token}`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    // Receive full game state on connect
    connection.on('GameState', (data) => {
      dispatch({ type: 'GAME_STATE', data })
    })

    connection.on('ParticipantJoined', ({ participant, participants }) => {
      dispatch({ type: 'PARTICIPANT_JOINED', participant, participants })
    })

    connection.on('ParticipantLeft', ({ userId, participants }) => {
      dispatch({ type: 'PARTICIPANT_LEFT', userId, participants })
    })

    connection.on('PlayerKicked', ({ userId, username, reason, participants }) => {
      dispatch({ type: 'PLAYER_KICKED', userId, username, reason, participants })
    })

    connection.on('YouWereKicked', ({ reason }) => {
      dispatch({ type: 'GAME_CANCELLED', reason: 'kicked' })
    })

    connection.on('GameStarted', ({ turnOrder, participants }) => {
      dispatch({ type: 'GAME_STARTED', turnOrder, participants })
    })

    connection.on('GameCancelled', ({ reason }) => {
      dispatch({ type: 'GAME_CANCELLED', reason })
    })

    connection.on('GameClosed', ({ reason }) => {
      dispatch({ type: 'GAME_CLOSED', reason })
    })

    connection.on('DiceRolled', ({ value, turnScore, rolledBy }) => {
      dispatch({ type: 'DICE_ROLLED', value, turnScore, rolledBy })
    })

    connection.on('TurnEnded', ({ reason, scores, nextPlayerId, currentTurnScore }) => {
      dispatch({ type: 'TURN_ENDED', reason, scores, nextPlayerId, currentTurnScore })
    })

    connection.on('TurnSkipped', ({ userId, username, reason, skipCount, nextPlayerId }) => {
      dispatch({ type: 'TURN_SKIPPED', userId, username, reason, skipCount, nextPlayerId })
    })

    connection.on('IdleCountdown', (seconds) => {
      dispatch({ type: 'IDLE_COUNTDOWN', seconds })
    })

    connection.on('GameWon', ({ winnerUserId, winnerUsername, scores, reason }) => {
      dispatch({ type: 'GAME_WON', winnerUserId, winnerUsername, scores, reason })
    })

    connection.on('PlayAgainPrompt', ({ timeoutSeconds }) => {
      dispatch({ type: 'PLAY_AGAIN_PROMPT', timeoutSeconds })
    })

    connection.on('PlayAgainVoteUpdate', ({ yesCount, noCount }) => {
      dispatch({ type: 'PLAY_AGAIN_VOTE_UPDATE', yesCount, noCount })
    })

    connection.on('PlayAgainResult', ({ participants }) => {
      dispatch({ type: 'PLAY_AGAIN_RESULT', participants })
    })

    connection.on('ChatMessage', (msg) => {
      dispatch({ type: 'CHAT_MESSAGE', message: msg })
    })

    connection.on('Error', (message) => {
      dispatch({ type: 'ERROR', message })
    })

    connection.start()
      .then(() => {})
      .catch(() => dispatch({ type: 'ERROR', message: 'Could not connect to game server.' }))

    connectionRef.current = connection
  }, [slug])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate(`/login?redirect=/pig/${slug}`)
      return
    }
    dispatch({ type: 'SET_USER', userId: user.userId })
    connect()

    const handleBeforeUnload = (e) => {
      if (state.phase === 'in-progress' || state.phase === 'lobby') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      connectionRef.current?.stop()
    }
  }, [authLoading, user, connect, navigate, slug])

  // ── Hub actions ─────────────────────────────────────────────────────────────

  const send = useCallback((method, ...args) => {
    connectionRef.current?.invoke(method, ...args).catch(console.error)
  }, [])

  const handleRoll = () => send('Roll')
  const handleHold = () => send('Hold')
  const handleStart = () => send('StartGame')
  const handleCancel = () => { if (window.confirm('Cancel this game?')) send('CancelGame') }
  const handleLeave = () => { if (window.confirm('Leave the game?')) send('LeaveGame') }
  const handleKick = (userId, isBot) => {
    if (isBot && state.phase === 'lobby') {
      if (window.confirm('Remove this bot?')) send('RemoveBot', userId)
    } else {
      if (window.confirm('Kick this player?')) send('KickPlayer', userId)
    }
  }
  const handleAddBot = () => send('AddBot')
  const handleInitiatePlayAgain = () => send('InitiatePlayAgain')
  const handlePlayAgainVote = (vote) => {
    dispatch({ type: 'MY_PLAY_AGAIN_VOTE', vote })
    send('PlayAgainVote', vote)
  }
  const handleChat = (text) => send('SendChat', text)

  // ── Rendering ────────────────────────────────────────────────────────────────

  if (authLoading || state.phase === 'connecting') {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-3">
        <LoadingSpinner />
        <p className="text-stone-400 dark:text-stone-500 text-sm">Connecting to game...</p>
      </div>
    )
  }

  if (state.phase === 'error' || state.phase === 'closed') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🎲</div>
        <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-2">
          {state.phase === 'error' ? 'Connection Error' : 'Game Ended'}
        </h1>
        <p className="text-stone-500 dark:text-stone-400 mb-6">{state.error || 'This game is no longer active.'}</p>
        <Link to="/pig" className="inline-block bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Back to games
        </Link>
      </div>
    )
  }

  const { game } = state
  if (!game) return <LoadingSpinner className="min-h-screen" />

  const players = game.participants.filter(p => p.role === 'player')
  const watchers = game.participants.filter(p => p.role === 'watcher')
  const canStart = isGm && game.status === 0 && players.length >= 2

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 min-h-screen">
      {showRules && <HowToPlayModal onClose={() => setShowRules(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100">{game.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              state.phase === 'lobby' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
              state.phase === 'in-progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
              state.phase === 'finished' || state.phase === 'play-again' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' :
              'bg-stone-100 text-stone-500'
            }`}>
              {state.phase === 'lobby' ? 'Lobby' :
               state.phase === 'in-progress' ? 'In Progress' :
               state.phase === 'finished' ? 'Finished' :
               state.phase === 'play-again' ? 'Play Again?' : 'Closed'}
            </span>
            {myRole && (
              <span className="text-xs text-stone-400 dark:text-stone-500">
                You: {isGm ? 'Game Master' : myRole === 'watcher' ? 'Watcher' : 'Player'}
              </span>
            )}
            <Link to="/pig" className="text-xs text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
              ← Games list
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRules(true)}
            className="text-xs text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors px-2 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700"
          >
            How to Play
          </button>
          <button
            onClick={() => setShowChat(s => !s)}
            className="text-xs text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors px-2 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 md:hidden"
          >
            {showChat ? 'Hide Chat' : 'Chat'}
          </button>
          {!isGm && game.status !== 3 && (
            <button onClick={handleLeave} className="text-xs text-stone-400 hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700">
              Leave
            </button>
          )}
        </div>
      </div>

      {/* Shareable link — lobby only */}
      {state.phase === 'lobby' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">Share to invite:</span>
          <code className="text-xs bg-white dark:bg-stone-800 px-2 py-1 rounded border border-amber-200 dark:border-amber-700 text-stone-700 dark:text-stone-300 select-all">
            {window.location.href}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded-lg transition-colors"
          >
            Copy
          </button>
        </div>
      )}

      {/* Main layout */}
      <div className={`grid gap-4 ${showChat ? 'md:grid-cols-[1fr_280px]' : ''}`}>

        {/* Left column — game area */}
        <div className="space-y-4">

          {/* Lobby view */}
          {state.phase === 'lobby' && (
            <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 shadow-sm">
              <h2 className="font-semibold text-stone-800 dark:text-stone-100 mb-4">
                Lobby — {players.length}/6 players
              </h2>
              <div className="space-y-1 mb-5">
                {players.map(p => (
                  <ParticipantCard
                    key={p.userId}
                    participant={p}
                    isGm={p.userId === game.gmUserId}
                    isCurrentPlayer={false}
                    isMine={p.userId === state.myUserId}
                    onKick={handleKick}
                    showKick={isGm}
                    userSlug={p.userSlug}
                  />
                ))}
              </div>
              {isGm && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={handleStart}
                    disabled={!canStart}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
                  >
                    {players.length < 2 ? 'Waiting for players...' : 'Start Game'}
                  </button>
                  <button
                    onClick={handleAddBot}
                    disabled={players.length >= 6}
                    className="bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
                  >
                    + Add Bot
                  </button>
                  <button
                    onClick={handleCancel}
                    className="text-sm text-stone-400 hover:text-red-500 transition-colors px-3 py-2"
                  >
                    Cancel Game
                  </button>
                </div>
              )}
              {!isGm && <p className="text-sm text-stone-400 dark:text-stone-500">Waiting for the Game Master to start...</p>}
            </div>
          )}

          {/* In-progress view */}
          {state.phase === 'in-progress' && (
            <>
              {/* Scoreboard */}
              <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-4 shadow-sm">
                <h2 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-3">Scoreboard</h2>
                <div className="space-y-1">
                  {game.turnOrder.map(uid => {
                    const p = game.participants.find(x => x.userId === uid)
                    if (!p) return null
                    return (
                      <ParticipantCard
                        key={uid}
                        participant={p}
                        isGm={uid === game.gmUserId}
                        isCurrentPlayer={uid === activeUserId}
                        isMine={uid === state.myUserId}
                        onKick={handleKick}
                        showKick={isGm}
                        userSlug={p.userSlug}
                      />
                    )
                  })}
                </div>
                {watchers.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-700">
                    <p className="text-xs text-stone-400 dark:text-stone-500 mb-1">Watching</p>
                    {watchers.map(p => (
                      <ParticipantCard
                        key={p.userId}
                        participant={p}
                        isGm={false}
                        isCurrentPlayer={false}
                        isMine={p.userId === state.myUserId}
                        onKick={handleKick}
                        showKick={isGm}
                        userSlug={p.userSlug}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Dice + controls */}
              <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 shadow-sm text-center">
                {activeUserId && (
                  <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
                    {activeUserId === state.myUserId
                      ? "It's your turn!"
                      : `${game.participants.find(p => p.userId === activeUserId)?.username ?? '...'}'s turn`}
                  </p>
                )}

                {/* Idle countdown ring */}
                {state.idleCountdown !== null && (
                  <div className="flex justify-center mb-3">
                    <IdleCountdownRing
                      seconds={state.idleCountdown}
                      maxSeconds={state.idleCountdownMax ?? state.idleCountdown}
                    />
                  </div>
                )}

                <DiceDisplay value={state.lastDiceValue} />

                {state.lastPigUsername && (
                  <p className="text-red-500 font-bold text-lg mt-3">🐷 {state.lastPigUsername} rolled a 1 — Pig! Turn lost!</p>
                )}

                <div className="mt-4 text-stone-500 dark:text-stone-400 text-sm">
                  Turn score: <span className="font-bold text-stone-800 dark:text-stone-100 text-lg">{state.currentTurnScore}</span>
                </div>

                {isMyTurn && (
                  <div className="flex gap-3 justify-center mt-5">
                    <button
                      onClick={handleRoll}
                      className="flex-1 max-w-[140px] bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold py-4 rounded-2xl text-lg transition-all shadow-sm"
                    >
                      🎲 Roll
                    </button>
                    <button
                      onClick={handleHold}
                      disabled={state.currentTurnScore === 0}
                      className="flex-1 max-w-[140px] bg-emerald-500 hover:bg-emerald-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-lg transition-all shadow-sm"
                    >
                      ✋ Hold
                    </button>
                  </div>
                )}

                {!isMyTurn && isPlayer && (
                  <p className="mt-5 text-stone-400 dark:text-stone-500 text-sm">Waiting for your turn...</p>
                )}

                {myRole === 'watcher' && (
                  <p className="mt-5 text-stone-400 dark:text-stone-500 text-sm italic">You're watching this game.</p>
                )}
              </div>
            </>
          )}

          {/* Finished / Play Again view */}
          {(state.phase === 'finished' || state.phase === 'play-again') && (
            <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 shadow-sm">
              {state.winner && (
                <div className="text-center mb-6">
                  <div className="text-5xl mb-2">🏆</div>
                  <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100">
                    {state.winner.winnerUserId === state.myUserId ? 'You won!' : `${state.winner.winnerUsername} wins!`}
                  </h2>
                  {state.winner.reason === 'forfeit' && (
                    <p className="text-sm text-stone-400 mt-1">All other players forfeited.</p>
                  )}
                </div>
              )}

              {/* Final scores */}
              <div className="space-y-2 mb-6">
                <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Final Scores</h3>
                {game.participants
                  .filter(p => p.role === 'player')
                  .sort((a, b) => b.score - a.score)
                  .map(p => (
                    <div key={p.userId} className="flex items-center gap-3 py-1">
                      <Avatar username={p.username} avatarUrl={p.avatarUrl} size="sm" />
                      <span className="flex-1 text-sm text-stone-700 dark:text-stone-300">{p.username}</span>
                      <span className={`font-bold text-lg ${p.userId === state.winner?.winnerUserId ? 'text-amber-500' : 'text-stone-600 dark:text-stone-400'}`}>
                        {p.score}
                      </span>
                    </div>
                  ))}
              </div>

              {state.phase === 'finished' && isGm && (
                <button
                  onClick={handleInitiatePlayAgain}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Play Again?
                </button>
              )}

              {state.phase === 'play-again' && (
                <div className="text-center">
                  <p className="font-semibold text-stone-800 dark:text-stone-100 mb-1">Play Again?</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mb-4">
                    {state.playAgainVoteYes} Yes · {state.playAgainVoteNo} No
                  </p>
                  {state.myPlayAgainVote === null ? (
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => handlePlayAgainVote(true)}
                        className="flex-1 max-w-[120px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors"
                      >
                        Yes!
                      </button>
                      <button
                        onClick={() => handlePlayAgainVote(false)}
                        className="flex-1 max-w-[120px] bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300 font-bold py-3 rounded-xl transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <p className="text-stone-500 dark:text-stone-400 text-sm">
                      You voted <strong>{state.myPlayAgainVote ? 'Yes' : 'No'}</strong>. Waiting for others...
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 text-center">
                <Link to="/pig" className="text-sm text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                  Back to games list
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right column — chat (desktop always visible, mobile toggleable) */}
        {(showChat || window.innerWidth >= 768) && (
          <div className={`bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm flex flex-col overflow-hidden ${showChat ? '' : 'hidden md:flex'}`}
            style={{ height: '600px' }}>
            <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-700 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-400">Chat</h2>
              <button className="text-stone-400 md:hidden" onClick={() => setShowChat(false)}>✕</button>
            </div>
            <div className="flex-1 min-h-0">
              <ChatPanel
                messages={state.chat}
                onSend={handleChat}
                disabled={game.status === 3}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
