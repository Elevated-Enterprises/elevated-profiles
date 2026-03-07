import { useEffect, useRef, useReducer, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useAuth } from '../context/AuthContext'
import { getImageUrl } from '../lib/api'
import LoadingSpinner from '../components/LoadingSpinner'
import CountdownRing from '../components/CountdownRing'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.profiles.secondcircuit.io'

const MAX_YAHTZEE_SCORE = 375  // theoretical max without Yahtzee bonus cascades

// ── Scoring category config ───────────────────────────────────────────────────

const UPPER_CATS = [
  { key: 'ones',   label: 'Ones',   hint: 'Sum of all 1s' },
  { key: 'twos',   label: 'Twos',   hint: 'Sum of all 2s' },
  { key: 'threes', label: 'Threes', hint: 'Sum of all 3s' },
  { key: 'fours',  label: 'Fours',  hint: 'Sum of all 4s' },
  { key: 'fives',  label: 'Fives',  hint: 'Sum of all 5s' },
  { key: 'sixes',  label: 'Sixes',  hint: 'Sum of all 6s' },
]

const LOWER_CATS = [
  { key: 'threeOfAKind',  label: '3 of a Kind',    hint: 'Sum all if ≥3 same' },
  { key: 'fourOfAKind',   label: '4 of a Kind',    hint: 'Sum all if ≥4 same' },
  { key: 'fullHouse',     label: 'Full House',     hint: '25 pts' },
  { key: 'smallStraight', label: 'Sm. Straight',   hint: '30 pts' },
  { key: 'largeStraight', label: 'Lg. Straight',   hint: '40 pts' },
  { key: 'yahtzee',       label: 'YAHTZEE',        hint: '50 pts' },
  { key: 'chance',        label: 'Chance',         hint: 'Sum all dice' },
]

// ── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  ['#f59e0b', '#d97706'], ['#8b5cf6', '#7c3aed'], ['#06b6d4', '#0891b2'],
  ['#10b981', '#059669'], ['#f43f5e', '#e11d48'], ['#3b82f6', '#2563eb'],
  ['#ec4899', '#db2777'], ['#14b8a6', '#0d9488'], ['#f97316', '#ea580c'],
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
  phase: 'connecting',
  game: null,
  myUserId: null,
  dice: [0, 0, 0, 0, 0],
  heldDice: [false, false, false, false, false],
  rollCount: 0,
  scoredThisTurn: false,
  potentialScores: {},  // category -> number (preview for active player)
  idleCountdown: null,
  idleCountdownMax: null,
  lastAction: null,     // { username, category, points }
  recentlyScored: null, // { userId, category } — triggers flash in table
  rankings: null,
  playAgainVoteYes: 0,
  playAgainVoteNo: 0,
  myPlayAgainVote: null,
  bonusToast: null,     // { username, bonusCount }
  chat: [],
  error: null,
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

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, myUserId: action.userId }

    case 'GAME_STATE':
      return {
        ...state,
        phase: statusToPhase(action.data.status),
        game: action.data,
        dice: action.data.currentDice,
        heldDice: action.data.heldDice,
        rollCount: action.data.rollCount,
        scoredThisTurn: action.data.scoredThisTurn,
      }

    case 'RANDOMISE_TURN_ORDER_CHANGED':
      if (!state.game) return state
      return { ...state, game: { ...state.game, randomiseTurnOrder: action.value } }

    case 'PARTICIPANT_JOINED':
      if (!state.game) return state
      return { ...state, game: { ...state.game, participants: action.participants } }

    case 'PARTICIPANT_LEFT':
      if (!state.game) return state
      return { ...state, game: { ...state.game, participants: action.participants } }

    case 'GAME_STARTED':
      if (!state.game) return state
      return {
        ...state,
        phase: 'in-progress',
        game: { ...state.game, status: 1, participants: action.participants, currentPlayerIndex: action.currentPlayerIndex },
        dice: [0, 0, 0, 0, 0],
        heldDice: [false, false, false, false, false],
        rollCount: 0,
        scoredThisTurn: false,
        idleCountdown: null,
        idleCountdownMax: null,
        lastAction: null,
      }

    case 'GAME_CANCELLED':
      return {
        ...state,
        phase: 'closed',
        error: action.reason === 'gm_left' ? 'The Game Master left — game over.' : 'Game was cancelled.',
      }

    case 'GAME_CLOSED':
      return { ...state, phase: 'closed', error: 'This game is closed.' }

    case 'DICE_ROLLED':
      return {
        ...state,
        dice: action.dice,
        heldDice: action.heldDice,
        rollCount: action.rollCount,
        idleCountdown: null,
        idleCountdownMax: null,
        potentialScores: action.potentialScores ?? state.potentialScores,
      }

    case 'HOLD_TOGGLED': {
      const newHeld = [...state.heldDice]
      newHeld[action.diceIndex] = action.isHeld
      return { ...state, heldDice: newHeld }
    }

    case 'SCORE_SELECTED': {
      if (!state.game) return state
      const updatedParticipants = state.game.participants.map(p =>
        p.userId === action.userId
          ? { ...p, scoreCard: action.updatedScoreCard }
          : p
      )
      const scoreMsg = systemMsg(
        `${action.username} scored ${action.points} pts in ${categoryLabel(action.category)}.`
      )
      return {
        ...state,
        game: { ...state.game, participants: updatedParticipants },
        scoredThisTurn: true,
        lastAction: { username: state.game.participants.find(p => p.userId === action.userId)?.displayName || action.username, category: action.category, points: action.points },
        recentlyScored: { userId: action.userId, category: action.category },
        potentialScores: {},
        idleCountdown: null,
        idleCountdownMax: null,
        chat: [...state.chat, scoreMsg].slice(-200),
      }
    }

    case 'CLEAR_RECENTLY_SCORED':
      return { ...state, recentlyScored: null }

    case 'CHAT_MESSAGE':
      return { ...state, chat: [...state.chat, action.message].slice(-200) }

    case 'TURN_CHANGED': {
      if (!state.game) return state
      const turnMsg = action.playerName
        ? systemMsg(`It's ${action.playerName}'s turn.`)
        : null
      return {
        ...state,
        game: { ...state.game, currentPlayerIndex: action.currentPlayerIndex },
        dice: [0, 0, 0, 0, 0],
        heldDice: [false, false, false, false, false],
        rollCount: 0,
        scoredThisTurn: false,
        potentialScores: {},
        idleCountdown: null,
        idleCountdownMax: null,
        chat: turnMsg ? [...state.chat, turnMsg].slice(-200) : state.chat,
      }
    }

    case 'YAHTZEE_BONUS':
      return { ...state, bonusToast: { userId: action.userId, bonusCount: action.bonusCount } }

    case 'CLEAR_BONUS_TOAST':
      return { ...state, bonusToast: null }

    case 'IDLE_COUNTDOWN':
      return {
        ...state,
        idleCountdown: action.seconds,
        idleCountdownMax: state.idleCountdown === null ? action.seconds : state.idleCountdownMax,
      }

    case 'GAME_FINISHED':
      return {
        ...state,
        phase: 'finished',
        rankings: action.rankings,
        idleCountdown: null,
        idleCountdownMax: null,
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
      return { ...state, playAgainVoteYes: action.yesCount, playAgainVoteNo: action.noCount }

    case 'PLAY_AGAIN_RESULT':
      if (!state.game) return state
      return {
        ...state,
        phase: 'in-progress',
        game: { ...state.game, status: 1, participants: action.participants, currentPlayerIndex: action.currentPlayerIndex },
        dice: [0, 0, 0, 0, 0],
        heldDice: [false, false, false, false, false],
        rollCount: 0,
        scoredThisTurn: false,
        potentialScores: {},
        recentlyScored: null,
        rankings: null,
        playAgainVoteYes: 0,
        playAgainVoteNo: 0,
        myPlayAgainVote: null,
        lastAction: null,
        idleCountdown: null,
        idleCountdownMax: null,
      }

    case 'MY_PLAY_AGAIN_VOTE':
      return { ...state, myPlayAgainVote: action.vote }

    case 'SET_POTENTIAL_SCORES':
      return { ...state, potentialScores: action.scores }

    case 'ERROR':
      return { ...state, phase: 'error', error: action.message }

    default:
      return state
  }
}

// ── Scoring logic (client-side preview) ───────────────────────────────────────

function isYahtzee(dice) { return dice.every(d => d === dice[0] && d !== 0) }

function isFullHouse(dice) {
  const groups = Object.values(dice.reduce((acc, d) => { acc[d] = (acc[d] || 0) + 1; return acc }, {})).sort()
  return groups.length === 2 && groups[0] === 2 && groups[1] === 3
}

function isSmallStraight(dice) {
  const distinct = [...new Set(dice)].sort((a, b) => a - b)
  if (distinct.length < 4) return false
  for (let i = 0; i <= distinct.length - 4; i++) {
    if (distinct[i+1] === distinct[i]+1 && distinct[i+2] === distinct[i]+2 && distinct[i+3] === distinct[i]+3)
      return true
  }
  return false
}

function isLargeStraight(dice) {
  const distinct = [...new Set(dice)].sort((a, b) => a - b)
  return distinct.length === 5 && distinct[4] - distinct[0] === 4
}

function calcScore(cat, dice, sc) {
  const joker = isYahtzee(dice) && sc.yahtzee === 50
  switch (cat) {
    case 'ones':          return dice.filter(d => d === 1).reduce((s, d) => s + d, 0)
    case 'twos':          return dice.filter(d => d === 2).reduce((s, d) => s + d, 0)
    case 'threes':        return dice.filter(d => d === 3).reduce((s, d) => s + d, 0)
    case 'fours':         return dice.filter(d => d === 4).reduce((s, d) => s + d, 0)
    case 'fives':         return dice.filter(d => d === 5).reduce((s, d) => s + d, 0)
    case 'sixes':         return dice.filter(d => d === 6).reduce((s, d) => s + d, 0)
    case 'threeOfAKind':  return Object.values(dice.reduce((a, d) => { a[d] = (a[d]||0)+1; return a }, {})).some(c => c >= 3) ? dice.reduce((s, d) => s + d, 0) : 0
    case 'fourOfAKind':   return Object.values(dice.reduce((a, d) => { a[d] = (a[d]||0)+1; return a }, {})).some(c => c >= 4) ? dice.reduce((s, d) => s + d, 0) : 0
    case 'fullHouse':     return joker ? 25 : (isFullHouse(dice) ? 25 : 0)
    case 'smallStraight': return joker ? 30 : (isSmallStraight(dice) ? 30 : 0)
    case 'largeStraight': return joker ? 40 : (isLargeStraight(dice) ? 40 : 0)
    case 'yahtzee':       return isYahtzee(dice) ? 50 : 0
    case 'chance':        return dice.reduce((s, d) => s + d, 0)
    default:              return 0
  }
}

function isFilled(cat, sc) {
  const map = {
    ones: 'ones', twos: 'twos', threes: 'threes', fours: 'fours', fives: 'fives', sixes: 'sixes',
    threeOfAKind: 'threeOfAKind', fourOfAKind: 'fourOfAKind', fullHouse: 'fullHouse',
    smallStraight: 'smallStraight', largeStraight: 'largeStraight', yahtzee: 'yahtzee', chance: 'chance',
  }
  return sc[map[cat]] !== null && sc[map[cat]] !== undefined
}

function computePotentialScores(dice, sc) {
  if (!dice || dice.every(d => d === 0)) return {}
  const result = {}
  const joker = isYahtzee(dice) && sc.yahtzee === 50
  const face = dice[0]
  const upperCatForFace = ['ones','twos','threes','fours','fives','sixes'][face - 1]
  const lowerCats = ['threeOfAKind','fourOfAKind','fullHouse','smallStraight','largeStraight','yahtzee','chance']
  const upperCats = ['ones','twos','threes','fours','fives','sixes']

  const allCats = [...upperCats, ...lowerCats]
  for (const cat of allCats) {
    if (isFilled(cat, sc)) continue

    // Joker rule validation
    if (joker) {
      if (!isFilled(upperCatForFace, sc)) {
        if (cat !== upperCatForFace) continue
      } else {
        const anyLowerAvail = lowerCats.some(c => !isFilled(c, sc))
        if (anyLowerAvail && !lowerCats.includes(cat)) continue
        if (!anyLowerAvail && !upperCats.includes(cat)) continue
      }
    }

    result[cat] = calcScore(cat, dice, sc)
  }
  return result
}

// ── Category label ────────────────────────────────────────────────────────────

function categoryLabel(cat) {
  return [...UPPER_CATS, ...LOWER_CATS].find(c => c.key === cat)?.label ?? cat
}

function systemMsg(text) {
  return { username: 'System', role: 'system', text, timestamp: new Date().toISOString(), isSystem: true }
}

// ── Avatar component ──────────────────────────────────────────────────────────

function Avatar({ username, avatarUrl, size = 'md' }) {
  const [colorA, colorB] = getGradient(username)
  const initials = getInitials(username)
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-sm'
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

// ── Dice display ──────────────────────────────────────────────────────────────

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

function Die({ value, held, canHold, onToggle, index }) {
  return (
    <button
      onClick={() => canHold && onToggle(index)}
      disabled={!canHold}
      className={`
        relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 flex items-center justify-center
        text-4xl sm:text-5xl leading-none select-none transition-all duration-150
        ${held
          ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 scale-95'
          : 'border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800'
        }
        ${canHold ? 'cursor-pointer hover:border-amber-300 active:scale-90' : 'cursor-default'}
        ${value === 0 ? 'opacity-30' : ''}
      `}
    >
      {value > 0 ? DICE_FACES[value] : '⬜'}
      {held && (
        <span className="absolute -top-2 -right-2 text-xs bg-amber-400 text-white px-1 rounded-full font-bold leading-4">
          HELD
        </span>
      )}
    </button>
  )
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function YahtzeeScoreBar({ score, potentialBest = 0, isActive = false }) {
  const bankedPct = Math.min((score / MAX_YAHTZEE_SCORE) * 100, 100)
  const potentialPct = isActive && potentialBest > 0
    ? Math.min((potentialBest / MAX_YAHTZEE_SCORE) * 100, 100 - bankedPct)
    : 0

  return (
    <div className="mt-1 h-1.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden relative">
      <div
        className="absolute inset-y-0 left-0 transition-all duration-500 rounded-full"
        style={{ width: `${bankedPct}%`, backgroundColor: '#dc2626' }}
      />
      {potentialPct > 0 && (
        <div
          className="absolute inset-y-0 transition-all duration-300"
          style={{ left: `${bankedPct}%`, width: `${potentialPct}%`, backgroundColor: '#fca5a5' }}
        />
      )}
    </div>
  )
}

// ── Player bar (top overview) ─────────────────────────────────────────────────

function PlayerBar({ participant, isActive, isMine, isLeader, potentialBest = 0 }) {
  const score = participant.scoreCard?.grandTotal ?? 0
  const displayName = participant.displayName || participant.username
  return (
    <div className={`flex items-center gap-2.5 p-2 rounded-xl transition-colors ${
      isLeader
        ? 'bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-400 dark:ring-amber-500'
        : isActive
          ? 'bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-700'
          : 'hover:bg-stone-50 dark:hover:bg-stone-700/30'
    }`}>
      <div className="relative flex-shrink-0">
        <Avatar username={participant.username} avatarUrl={participant.avatarUrl} size="sm" />
        {!participant.isConnected && (
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-stone-400 rounded-full border-2 border-white dark:border-stone-800" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs font-medium text-stone-800 dark:text-stone-100 truncate">
            {isMine ? 'You' : displayName}
          </span>
          {isActive && (
            <span className="text-xs bg-amber-400 dark:bg-amber-600 text-white px-1 py-0.5 rounded-full leading-none">▶</span>
          )}
        </div>
        <div className="text-xs text-stone-500 dark:text-stone-400">
          {score} pts
          {isActive && potentialBest > 0 && (
            <span className="text-red-300 dark:text-red-400 ml-1">+{potentialBest}</span>
          )}
        </div>
        <YahtzeeScoreBar score={score} potentialBest={potentialBest} isActive={isActive} />
      </div>
    </div>
  )
}

// ── Chat panel ────────────────────────────────────────────────────────────────

function ChatPanel({ messages, onSend, disabled, showSystem, onToggleSystem }) {
  const [text, setText] = useState('')
  const bottomRef = useRef(null)
  const visible = showSystem ? messages : messages.filter(m => !m.isSystem)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [visible])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-1.5 border-b border-stone-100 dark:border-stone-700 flex justify-end">
        <button
          onClick={onToggleSystem}
          className={`text-xs px-2 py-0.5 rounded transition-colors ${
            showSystem
              ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
              : 'text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
          }`}
          title={showSystem ? 'Hide game events' : 'Show game events'}
        >
          {showSystem ? 'Events on' : 'Events off'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-0">
        {visible.length === 0 && (
          <p className="text-xs text-stone-400 dark:text-stone-500 text-center py-4">No messages yet. Say hi!</p>
        )}
        {visible.map((msg, i) => (
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

// ── Combined scorecard table (all players as columns) ─────────────────────────

function countFilled(sc) {
  if (!sc) return 0
  return ['ones','twos','threes','fours','fives','sixes',
          'threeOfAKind','fourOfAKind','fullHouse','smallStraight',
          'largeStraight','yahtzee','chance']
    .filter(k => sc[k] !== null && sc[k] !== undefined).length
}

function CombinedScoreTable({ players, activeUserId, myUserId, potentialScores, rollCount, onSelect, recentlyScored }) {
  const canSelect = activeUserId === myUserId && rollCount >= 1

  function CatRow({ cat }) {
    return (
      <tr className="border-b border-stone-100 dark:border-stone-700/50">
        <td className="py-1 pl-2 pr-1 text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap font-medium" title={cat.hint}>
          {cat.label}
        </td>
        {players.map(p => {
          const sc = p.scoreCard ?? {}
          const val = sc[cat.key]
          const filled = val !== null && val !== undefined
          const isActiveCol = p.userId === activeUserId
          const isMineCol = p.userId === myUserId
          const potential = isActiveCol && isMineCol && canSelect && !filled ? potentialScores[cat.key] : undefined
          const isSelectable = potential !== undefined
          const isFlashing = recentlyScored?.userId === p.userId && recentlyScored?.category === cat.key

          return (
            <td
              key={p.userId}
              onClick={() => isSelectable && onSelect(cat.key)}
              className={`py-1 px-1 text-center text-xs transition-colors
                ${isActiveCol ? 'border-x-2 border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/10' : ''}
                ${isSelectable ? 'cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30' : ''}
                ${isFlashing ? 'bg-amber-200 dark:bg-amber-700/60 animate-pulse' : ''}
              `}
            >
              {filled ? (
                <span className="text-stone-500 dark:text-stone-400">{val}</span>
              ) : isSelectable ? (
                <span className={`font-semibold px-1 py-0.5 rounded ${
                  potential === 0
                    ? 'text-red-400 bg-red-50 dark:bg-red-900/20'
                    : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
                }`}>
                  [{potential}]
                </span>
              ) : (
                <span className="text-stone-300 dark:text-stone-600">—</span>
              )}
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-stone-200 dark:border-stone-600">
            <th className="py-2 pl-2 pr-1 text-left text-xs text-stone-400 dark:text-stone-500 font-normal">Category</th>
            {players.map(p => {
              const isActiveCol = p.userId === activeUserId
              const isMineCol = p.userId === myUserId
              return (
                <th
                  key={p.userId}
                  className={`py-2 px-1 text-center font-semibold text-xs
                    ${isActiveCol
                      ? 'border-x-2 border-t-2 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 rounded-t'
                      : 'text-stone-600 dark:text-stone-300'}
                  `}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <Avatar username={p.username} avatarUrl={p.avatarUrl} size="sm" />
                    <span className="truncate max-w-[64px]">{isMineCol ? 'You' : (p.displayName || p.username)}</span>
                    {!p.isConnected && <span className="text-stone-400 dark:text-stone-500 text-xs">●</span>}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {UPPER_CATS.map(cat => <CatRow key={cat.key} cat={cat} />)}
          {/* Upper bonus row */}
          <tr className="border-b border-stone-100 dark:border-stone-700/50 bg-stone-50 dark:bg-stone-700/30">
            <td className="py-1 pl-2 pr-1 text-xs text-stone-400 dark:text-stone-500 italic whitespace-nowrap">Bonus +35</td>
            {players.map(p => {
              const sc = p.scoreCard ?? {}
              const upperTotal = (sc.ones ?? 0) + (sc.twos ?? 0) + (sc.threes ?? 0) + (sc.fours ?? 0) + (sc.fives ?? 0) + (sc.sixes ?? 0)
              const bonus = upperTotal >= 63 ? 35 : 0
              const isActiveCol = p.userId === activeUserId
              return (
                <td key={p.userId} className={`py-1 px-1 text-center text-xs ${isActiveCol ? 'border-x-2 border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                  {bonus > 0
                    ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+35</span>
                    : <span className="text-stone-400">{upperTotal}/63</span>
                  }
                </td>
              )
            })}
          </tr>
          {LOWER_CATS.map(cat => <CatRow key={cat.key} cat={cat} />)}
          {/* Yahtzee bonus row — only when any player has one */}
          {players.some(p => (p.scoreCard?.yahtzeeBonusCount ?? 0) > 0) && (
            <tr className="border-b border-stone-100 dark:border-stone-700/50">
              <td className="py-1 pl-2 pr-1 text-xs text-amber-600 dark:text-amber-400 italic whitespace-nowrap">YBonus</td>
              {players.map(p => {
                const count = p.scoreCard?.yahtzeeBonusCount ?? 0
                const isActiveCol = p.userId === activeUserId
                return (
                  <td key={p.userId} className={`py-1 px-1 text-center text-xs ${isActiveCol ? 'border-x-2 border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
                    {count > 0
                      ? <span className="text-amber-600 dark:text-amber-400 font-semibold">+{count * 100}</span>
                      : <span className="text-stone-300 dark:text-stone-600">—</span>
                    }
                  </td>
                )
              })}
            </tr>
          )}
          {/* Total row */}
          <tr className="border-t-2 border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800">
            <td className="py-2 pl-2 pr-1 text-xs font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider">Total</td>
            {players.map(p => {
              const sc = p.scoreCard ?? {}
              const isActiveCol = p.userId === activeUserId
              return (
                <td key={p.userId} className={`py-2 px-1 text-center font-bold text-sm
                  ${isActiveCol
                    ? 'border-x-2 border-b-2 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-900/10'
                    : 'text-stone-700 dark:text-stone-200'}
                `}>
                  {sc.grandTotal ?? 0}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function YahtzeeGame() {
  const { slug } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(reducer, initialState)
  const connectionRef = useRef(null)
  const [showChat, setShowChat] = useState(true)
  const [showSystemMessages, setShowSystemMessages] = useState(true)
  const bonusTimerRef = useRef(null)
  const gameRef = useRef(state.game)
  useEffect(() => { gameRef.current = state.game }, [state.game])

  const isGm = state.game?.gmUserId === state.myUserId
  const myParticipant = state.game?.participants.find(p => p.userId === state.myUserId)
  const myRole = myParticipant?.role
  const isPlayer = myRole === 'player'

  const players = state.game?.participants.filter(p => p.role === 'player') ?? []
  const activePlayer = players[state.game?.currentPlayerIndex % Math.max(players.length, 1)]
  const activeUserId = activePlayer?.userId ?? null
  const isMyTurn = isPlayer && activeUserId === state.myUserId

  const potentialScores = (isMyTurn && state.rollCount >= 1 && !state.scoredThisTurn)
    ? computePotentialScores(state.dice, myParticipant?.scoreCard ?? {})
    : {}

  // Best score achievable with current dice without re-rolling (for the active player's score bar)
  const activePotentialBest = (state.rollCount >= 1 && !state.scoredThisTurn && activeUserId)
    ? (() => {
        const activeParticipant = players.find(p => p.userId === activeUserId)
        if (!activeParticipant) return 0
        const scores = computePotentialScores(state.dice, activeParticipant.scoreCard ?? {})
        const vals = Object.values(scores)
        return vals.length > 0 ? Math.max(...vals) : 0
      })()
    : 0

  const canRoll = isMyTurn && state.rollCount < 3 && !state.scoredThisTurn
  const canHold = isMyTurn && state.rollCount >= 1 && state.rollCount < 3 && !state.scoredThisTurn

  const maxFilled = useMemo(() =>
    players.length > 0 ? Math.max(...players.map(p => countFilled(p.scoreCard))) : 0,
    [players]
  )
  const roundsRemaining = 13 - maxFilled

  // Bonus toast auto-clear
  useEffect(() => {
    if (state.bonusToast) {
      clearTimeout(bonusTimerRef.current)
      bonusTimerRef.current = setTimeout(() => dispatch({ type: 'CLEAR_BONUS_TOAST' }), 4000)
    }
  }, [state.bonusToast])

  // Recently scored flash auto-clear
  useEffect(() => {
    if (state.recentlyScored) {
      const t = setTimeout(() => dispatch({ type: 'CLEAR_RECENTLY_SCORED' }), 2000)
      return () => clearTimeout(t)
    }
  }, [state.recentlyScored])

  const connect = useCallback(() => {
    const token = localStorage.getItem('token')
    if (!token || !slug) return

    const connection = new HubConnectionBuilder()
      .withUrl(`${BASE_URL}/hubs/yahtzee?gameSlug=${slug}&access_token=${token}`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('GameState', (data) => {
      dispatch({ type: 'GAME_STATE', data })
    })

    connection.on('ParticipantJoined', ({ participant, participants }) => {
      dispatch({ type: 'PARTICIPANT_JOINED', participant, participants })
    })

    connection.on('ParticipantLeft', ({ userId, participants }) => {
      dispatch({ type: 'PARTICIPANT_LEFT', userId, participants })
    })

    connection.on('GameStarted', ({ participants, currentPlayerIndex }) => {
      dispatch({ type: 'GAME_STARTED', participants, currentPlayerIndex })
    })

    connection.on('GameCancelled', ({ reason }) => {
      dispatch({ type: 'GAME_CANCELLED', reason })
    })

    connection.on('GameClosed', () => {
      dispatch({ type: 'GAME_CLOSED' })
    })

    connection.on('DiceRolled', ({ dice, heldDice, rollCount }) => {
      dispatch({ type: 'DICE_ROLLED', dice, heldDice, rollCount })
    })

    connection.on('HoldToggled', ({ diceIndex, isHeld }) => {
      dispatch({ type: 'HOLD_TOGGLED', diceIndex, isHeld })
    })

    connection.on('ScoreSelected', ({ userId, category, points, updatedScoreCard }) => {
      const username = gameRef.current?.participants.find(p => p.userId === userId)?.username ?? '?'
      dispatch({ type: 'SCORE_SELECTED', userId, username, category, points, updatedScoreCard })
    })

    connection.on('TurnChanged', ({ currentPlayerIndex, playerName }) => {
      dispatch({ type: 'TURN_CHANGED', currentPlayerIndex, playerName })
    })

    connection.on('YahtzeeBonusAwarded', ({ userId, bonusCount }) => {
      dispatch({ type: 'YAHTZEE_BONUS', userId, bonusCount })
    })

    connection.on('IdleCountdown', (seconds) => {
      dispatch({ type: 'IDLE_COUNTDOWN', seconds })
    })

    connection.on('GameFinished', ({ rankings }) => {
      dispatch({ type: 'GAME_FINISHED', rankings })
    })

    connection.on('PlayAgainPrompt', () => {
      dispatch({ type: 'PLAY_AGAIN_PROMPT' })
    })

    connection.on('PlayAgainVoteUpdate', ({ yesCount, noCount }) => {
      dispatch({ type: 'PLAY_AGAIN_VOTE_UPDATE', yesCount, noCount })
    })

    connection.on('PlayAgainResult', ({ participants, currentPlayerIndex }) => {
      dispatch({ type: 'PLAY_AGAIN_RESULT', participants, currentPlayerIndex })
    })

    connection.on('RandomiseTurnOrderChanged', (value) => {
      dispatch({ type: 'RANDOMISE_TURN_ORDER_CHANGED', value })
    })

    connection.on('ChatMessage', (msg) => {
      dispatch({ type: 'CHAT_MESSAGE', message: msg })
    })

    connection.on('Error', (message) => {
      dispatch({ type: 'ERROR', message })
    })

    connection.start()
      .catch(() => dispatch({ type: 'ERROR', message: 'Could not connect to game server.' }))

    connectionRef.current = connection
  }, [slug])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate(`/login?redirect=/yahtzee/${slug}`)
      return
    }
    dispatch({ type: 'SET_USER', userId: user.userId })
    connect()
    return () => { connectionRef.current?.stop() }
  }, [authLoading, user, connect, navigate, slug])

  // ── Hub actions ─────────────────────────────────────────────────────────────

  const send = useCallback((method, ...args) => {
    connectionRef.current?.invoke(method, ...args).catch(console.error)
  }, [])

  const handleRoll = () => send('RollDice')
  const handleHold = (i) => send('ToggleHold', i)
  const handleSelectScore = (category) => send('SelectScore', category)
  const handleStart = () => send('StartGame')
  const handleCancel = () => { if (window.confirm('Cancel this game?')) send('CancelGame') }
  const handleInitiatePlayAgain = () => send('InitiatePlayAgain')
  const handlePlayAgainVote = (vote) => {
    dispatch({ type: 'MY_PLAY_AGAIN_VOTE', vote })
    send('VotePlayAgain', vote)
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
        <Link to="/yahtzee" className="inline-block bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Back to games
        </Link>
      </div>
    )
  }

  const { game } = state
  if (!game) return <LoadingSpinner className="min-h-screen" />

  const canStart = isGm && game.status === 0 && players.length >= 2

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 min-h-screen">

      {/* Bonus Yahtzee toast */}
      {state.bonusToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white font-bold px-5 py-3 rounded-2xl shadow-lg text-center animate-bounce">
          YAHTZEE BONUS! +100 pts (x{state.bonusToast.bonusCount})
        </div>
      )}

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
               state.phase === 'play-again' ? 'Play Again?' : ''}
            </span>
            {myRole && (
              <span className="text-xs text-stone-400 dark:text-stone-500">
                You: {isGm ? 'Game Master' : myRole === 'watcher' ? 'Watcher' : 'Player'}
              </span>
            )}
            <Link to="/yahtzee" className="text-xs text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
              ← Games list
            </Link>
          </div>
        </div>
        {state.phase === 'in-progress' && (
          <button
            onClick={() => setShowChat(s => !s)}
            className="text-xs text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors px-2 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 md:hidden"
          >
            {showChat ? 'Hide Chat' : 'Chat'}
          </button>
        )}
      </div>

      {/* Lobby */}
      {state.phase === 'lobby' && (
        <>
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

          <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 shadow-sm">
            <h2 className="font-semibold text-stone-800 dark:text-stone-100 mb-4">
              Lobby — {players.length}/4 players
            </h2>
            <div className="space-y-2 mb-5">
              {players.map(p => (
                <div key={p.userId} className="flex items-center gap-3 p-2 rounded-lg bg-stone-50 dark:bg-stone-700/30">
                  <Avatar username={p.username} avatarUrl={p.avatarUrl} />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-stone-800 dark:text-stone-100">{p.displayName || p.username}</span>
                    {p.userId === game.gmUserId && (
                      <span className="ml-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">GM</span>
                    )}
                    {p.userId === state.myUserId && (
                      <span className="ml-1 text-xs text-stone-400">(you)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {isGm ? (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleStart}
                  disabled={!canStart}
                  className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
                >
                  {players.length < 2 ? 'Waiting for players...' : 'Start Game'}
                </button>
                <button
                  onClick={() => send('SetRandomiseTurnOrder', !game.randomiseTurnOrder)}
                  title="Randomise the player turn order at the start of each game"
                  className={`text-sm px-3 py-2 rounded-xl border transition-colors ${
                    game.randomiseTurnOrder
                      ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-600 text-violet-700 dark:text-violet-300'
                      : 'border-stone-200 dark:border-stone-600 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300'
                  }`}
                >
                  {game.randomiseTurnOrder ? 'Order: Random' : 'Order: Fixed'}
                </button>
                <button
                  onClick={handleCancel}
                  className="text-sm text-stone-400 hover:text-red-500 transition-colors px-3 py-2"
                >
                  Cancel Game
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm text-stone-400 dark:text-stone-500">Waiting for the Game Master to start...</p>
                {game.randomiseTurnOrder && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300">
                    Turn order will be randomised
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* In-progress */}
      {state.phase === 'in-progress' && (
        <div className={`grid gap-4 ${showChat ? 'md:grid-cols-[1fr_280px]' : ''}`}>

          {/* Left — game area */}
          <div className="space-y-4">

            {/* Player overview with score bars */}
            <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Scoreboard</h2>
                  <span className="text-xs text-stone-400 dark:text-stone-500">
                    Round {maxFilled + 1}/13
                    {roundsRemaining > 0
                      ? ` · ${roundsRemaining} round${roundsRemaining !== 1 ? 's' : ''} remaining`
                      : ''}
                  </span>
                </div>
                {state.idleCountdown !== null && (
                  <CountdownRing
                    seconds={state.idleCountdown}
                    maxSeconds={state.idleCountdownMax ?? state.idleCountdown}
                    size={44}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(() => {
                  const maxScore = Math.max(0, ...players.map(p => p.scoreCard?.grandTotal ?? 0))
                  const leaderUid = maxScore > 0 ? players.find(p => (p.scoreCard?.grandTotal ?? 0) === maxScore)?.userId : null
                  return players.map((p, idx) => (
                    <PlayerBar
                      key={p.userId}
                      participant={p}
                      isActive={idx === (game.currentPlayerIndex % players.length)}
                      isLeader={p.userId === leaderUid}
                      isMine={p.userId === state.myUserId}
                      potentialBest={p.userId === activeUserId ? activePotentialBest : 0}
                    />
                  ))
                })()}
              </div>
              {state.lastAction && (
                <p className="mt-2 text-xs text-stone-400 dark:text-stone-500 italic">
                  Last: {state.lastAction.username} → {categoryLabel(state.lastAction.category)} ({state.lastAction.points >= 0 ? '+' : ''}{state.lastAction.points} pts)
                </p>
              )}
            </div>

            {/* Dice + controls */}
            <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 shadow-sm">
              {activeUserId && (
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-4 text-center">
                  {isMyTurn ? "It's your turn!" : `${activePlayer?.displayName || (activePlayer?.username ?? '...')}'s turn`}
                  {state.rollCount > 0 && (
                    <span className="ml-2 text-xs text-stone-400">
                      Roll {state.rollCount}/3
                    </span>
                  )}
                </p>
              )}

              <div className="flex gap-2 sm:gap-3 justify-center mb-5 flex-wrap">
                {state.dice.map((val, i) => (
                  <Die
                    key={i}
                    index={i}
                    value={val}
                    held={state.heldDice[i]}
                    canHold={canHold}
                    onToggle={handleHold}
                  />
                ))}
              </div>

              {isMyTurn && (
                <div className="text-center">
                  <button
                    onClick={handleRoll}
                    disabled={!canRoll}
                    className="bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-2xl text-lg transition-all shadow-sm"
                  >
                    {state.rollCount === 0 ? '🎲 Roll!' : '🎲 Re-roll'}
                  </button>
                  {canHold && (
                    <p className="text-xs text-stone-400 mt-2">Click dice to hold/unhold before re-rolling</p>
                  )}
                  {state.rollCount >= 3 && !state.scoredThisTurn && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">Select a category in the table below to score!</p>
                  )}
                </div>
              )}

              {!isMyTurn && isPlayer && (
                <p className="text-center text-stone-400 dark:text-stone-500 text-sm">Waiting for your turn...</p>
              )}
              {myRole === 'watcher' && (
                <p className="text-center text-stone-400 dark:text-stone-500 text-sm italic">You're watching this game.</p>
              )}
            </div>

            {/* Combined scorecard table */}
            <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
              <CombinedScoreTable
                players={players}
                activeUserId={activeUserId}
                myUserId={state.myUserId}
                potentialScores={potentialScores}
                rollCount={state.rollCount}
                onSelect={handleSelectScore}
                recentlyScored={state.recentlyScored}
              />
            </div>

            {/* Watchers */}
            {game.participants.some(p => p.role === 'watcher') && (
              <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-3 shadow-sm">
                <h3 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">Watching</h3>
                <div className="flex gap-3 flex-wrap">
                  {game.participants.filter(p => p.role === 'watcher').map(p => (
                    <div key={p.userId} className="flex items-center gap-1.5">
                      <Avatar username={p.username} avatarUrl={p.avatarUrl} size="sm" />
                      <span className="text-xs text-stone-500 dark:text-stone-400">{p.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — chat */}
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
                showSystem={showSystemMessages}
                onToggleSystem={() => setShowSystemMessages(s => !s)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Finished / Play Again */}
      {(state.phase === 'finished' || state.phase === 'play-again') && (
        <div className="max-w-lg mx-auto">
          <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 shadow-sm">
            <div className="text-center mb-6">
              <div className="text-5xl mb-2">🏆</div>
              {state.rankings && state.rankings[0] && (
                <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100">
                  {state.rankings[0].userId === state.myUserId
                    ? 'You won!'
                    : `${state.rankings[0].displayName || state.rankings[0].username} wins!`}
                </h2>
              )}
            </div>

            {state.rankings && (
              <div className="space-y-2 mb-6">
                <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Final Rankings</h3>
                {state.rankings.map((r) => (
                  <div key={r.userId} className="flex items-center gap-3 py-2 border-b border-stone-100 dark:border-stone-700">
                    <span className="text-lg font-bold text-stone-400 w-6 text-center">{r.rank}</span>
                    <span className="flex-1 text-sm text-stone-700 dark:text-stone-300 font-medium">
                      {r.userId === state.myUserId ? 'You' : (r.displayName || r.username)}
                    </span>
                    <span className={`font-bold text-lg ${r.rank === 1 ? 'text-amber-500' : 'text-stone-500 dark:text-stone-400'}`}>
                      {r.grandTotal}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {state.phase === 'finished' && isGm && (
              <button
                onClick={handleInitiatePlayAgain}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-colors mb-3"
              >
                Play Again?
              </button>
            )}

            {state.phase === 'play-again' && (
              <div className="text-center mb-4">
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

            <div className="text-center">
              <Link to="/yahtzee" className="text-sm text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                Back to games list
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
