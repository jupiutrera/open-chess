import type { Bot } from './bots'

export type Mood = 'neutral' | 'happy' | 'sad'

export interface Look {
  skin: string
  hair: 'short' | 'long' | 'bun' | 'curly' | 'bald' | 'spiky' | 'bob' | 'ponytail' | 'slick' | 'messy'
  hairColor: string
  shirt: string
  eyes?: 'round' | 'sharp' | 'sleepy'
  brows?: 'soft' | 'bold' | 'none'
  glasses?: 'round' | 'square'
  beard?: 'full' | 'stubble' | 'mustache'
  hat?: 'propeller' | 'cap' | 'headband' | 'bow'
  hatColor?: string
  earrings?: boolean
  blush?: boolean
}

/** Illustrated bot portrait; the expression follows the game through `mood`. */
export function BotAvatar({ bot, size = 40, mood = 'neutral', className = '' }: { bot: Bot; size?: number; mood?: Mood; className?: string }) {
  const id = `bg-${bot.id}`
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 rounded-md ${className}`}
      aria-hidden
      style={{ borderRadius: Math.max(6, size * 0.16) }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={`hsl(${bot.hue} 45% 56%)`} />
          <stop offset="1" stopColor={`hsl(${bot.hue} 48% 34%)`} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
      {bot.look ? (
        <g transform="translate(32 30.5) scale(1.15) translate(-32 -29)">
          <Person look={bot.look} mood={mood} />
        </g>
      ) : (
        <Fish hue={bot.hue} mood={mood} />
      )}
    </svg>
  )
}

function Person({ look: l, mood }: { look: Look; mood: Mood }) {
  const shade = 'rgb(0 0 0 / 0.14)'
  return (
    <g>
      {/* hair that falls behind the head */}
      {l.hair === 'long' && <path d="M16 30c0-12 7-19 16-19s16 7 16 19v24H16z" fill={l.hairColor} />}
      {l.hair === 'bob' && <path d="M17 31c0-12 6-19 15-19s15 7 15 19v12c-3 2-6 2-8 0H25c-2 2-5 2-8 0z" fill={l.hairColor} />}
      {l.hair === 'ponytail' && <path d="M44 20c8 2 10 12 8 22-1 5-4 7-6 6 2-8 1-16-4-20z" fill={l.hairColor} />}
      {l.hair === 'bun' && <circle cx="32" cy="10" r="6.5" fill={l.hairColor} />}

      {/* body */}
      <path d="M8 64c1-11 10-17 24-17s23 6 24 17z" fill={l.shirt} />
      <path d="M26 47c1 4 3 6 6 6s5-2 6-6z" fill={l.skin} />
      <path d="M26 47c1 4 3 6 6 6s5-2 6-6z" fill={shade} />
      <rect x="27.5" y="38" width="9" height="11" rx="3" fill={l.skin} />
      <rect x="27.5" y="38" width="9" height="5" fill={shade} />

      {/* head */}
      <circle cx="18.5" cy="31" r="3.4" fill={l.skin} />
      <circle cx="45.5" cy="31" r="3.4" fill={l.skin} />
      <ellipse cx="32" cy="29" rx="13.5" ry="15" fill={l.skin} />
      {l.earrings && (
        <>
          <circle cx="18.5" cy="35.5" r="1.4" fill="#f5c84c" />
          <circle cx="45.5" cy="35.5" r="1.4" fill="#f5c84c" />
        </>
      )}

      {/* beard sits under the face features */}
      {l.beard === 'full' && <path d="M18.5 29c0 13 6 20 13.5 20s13.5-7 13.5-20c-2 5-5 7-8 7h-11c-3 0-6-2-8-7z" fill={l.hairColor} />}
      {l.beard === 'stubble' && <path d="M19 31c1 9 6 14 13 14s12-5 13-14c-2 4-5 6-8 6H27c-3 0-6-2-8-6z" fill={l.hairColor} opacity="0.35" />}

      {/* hair on top */}
      {l.hair === 'short' && <path d="M18.5 29c-1-11 5-17 13.5-17s14.5 6 13.5 17c-2-6-6-9-13.5-9S20.5 23 18.5 29z" fill={l.hairColor} />}
      {l.hair === 'messy' && (
        <path d="M18 29c-2-10 3-17 11-18l2-3 2 3 3-2 1 3c6 2 9 8 8 17-2-5-4-7-6-8l-2 3-2-3-3 3-2-3-3 3-2-3c-3 1-6 3-7 7z" fill={l.hairColor} />
      )}
      {(l.hair === 'long' || l.hair === 'bob' || l.hair === 'ponytail' || l.hair === 'bun') && (
        <path d="M18.5 30c-1-12 5-18 13.5-18s14.5 6 13.5 18c-3-7-7-11-13-11-2 4-8 7-14 11z" fill={l.hairColor} />
      )}
      {l.hair === 'curly' && (
        <g fill={l.hairColor}>
          {[
            [20, 24, 5],
            [24, 17, 5.5],
            [31, 14, 6],
            [38, 16, 5.5],
            [44, 22, 5],
            [46, 29, 3.5],
            [18, 30, 3.5],
          ].map(([x, y, r]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={r} />
          ))}
        </g>
      )}
      {l.hair === 'spiky' && <path d="M18.5 29l-1-10 5 3 1-8 5 5 3-8 3 7 5-6 1 8 5-3-1 12c-3-5-7-8-13.5-8S21 23 18.5 29z" fill={l.hairColor} />}
      {l.hair === 'slick' && <path d="M18.5 28c-1-10 5-16 13.5-16s14.5 5 13.5 15c-4-4-8-6-14-6-5 0-9 2-13 7z" fill={l.hairColor} />}
      {l.hair === 'bald' && (
        <>
          <path d="M18.6 27c0 3 0 5 1 7l2-1c-1-3-1-5-1-7z" fill={l.hairColor} />
          <path d="M45.4 27c0 3 0 5-1 7l-2-1c1-3 1-5 1-7z" fill={l.hairColor} />
          <ellipse cx="27" cy="18" rx="4" ry="2" fill="#fff" opacity="0.18" />
        </>
      )}

      {/* hats */}
      {l.hat === 'cap' && (
        <>
          <path d="M18 24c0-8 6-13 14-13s14 5 14 13z" fill={l.hatColor} />
          <path d="M30 22h22c1 2 0 3-2 3H30z" fill={l.hatColor} />
          <path d="M30 22h22c1 2 0 3-2 3H30z" fill="rgb(0 0 0 / 0.18)" />
        </>
      )}
      {l.hat === 'propeller' && (
        <>
          <path d="M19 23c0-7 6-12 13-12s13 5 13 12z" fill={l.hatColor} />
          <path d="M19 23c0-7 6-12 13-12v12z" fill="#f2c94c" />
          <rect x="31" y="6" width="2" height="6" fill="#555" />
          <ellipse cx="27" cy="6" rx="5" ry="1.6" fill="#e35d4b" />
          <ellipse cx="37" cy="6" rx="5" ry="1.6" fill="#4b8de3" />
        </>
      )}
      {l.hat === 'headband' && (
        <>
          <path d="M18.6 22.5c4-3 9-4.5 13.4-4.5s9.4 1.5 13.4 4.5l-.6 4c-4-3-8.5-4-12.8-4s-8.8 1-12.8 4z" fill={l.hatColor} />
          <path d="M45 23l6-3-2 6z" fill={l.hatColor} />
        </>
      )}
      {l.hat === 'bow' && (
        <g fill={l.hatColor}>
          <path d="M38 13l-6-4v8z" />
          <path d="M38 13l6-4v8z" />
          <circle cx="38" cy="13" r="2" />
        </g>
      )}

      {l.blush && (
        <>
          <ellipse cx="23" cy="35" rx="2.6" ry="1.6" fill="#ff7f7f" opacity="0.45" />
          <ellipse cx="41" cy="35" rx="2.6" ry="1.6" fill="#ff7f7f" opacity="0.45" />
        </>
      )}
      <Face look={l} mood={mood} />
    </g>
  )
}

function Face({ look: l, mood }: { look: Look; mood: Mood }) {
  const ink = '#2a2420'
  const eyes = l.eyes ?? 'round'
  const browY = mood === 'sad' ? 0.6 : 0
  return (
    <g>
      {/* brows: they tilt with the mood */}
      {l.brows !== 'none' && (
        <g stroke={l.hair === 'bald' || l.beard === 'full' ? l.hairColor : ink} strokeWidth={l.brows === 'bold' ? 2.2 : 1.4} strokeLinecap="round" fill="none">
          {mood === 'sad' ? (
            <>
              <path d={`M23.5 ${24 + browY}l5-2`} />
              <path d={`M40.5 ${24 + browY}l-5-2`} />
            </>
          ) : l.brows === 'bold' || eyes === 'sharp' ? (
            <>
              <path d="M23.5 22.5l5 1.5" />
              <path d="M40.5 22.5l-5 1.5" />
            </>
          ) : (
            <>
              <path d="M23.5 23.5q2.5-1.5 5 0" />
              <path d="M35.5 23.5q2.5-1.5 5 0" />
            </>
          )}
        </g>
      )}

      {/* eyes */}
      {mood === 'happy' && eyes !== 'sharp' ? (
        <g stroke={ink} strokeWidth="1.8" strokeLinecap="round" fill="none">
          <path d="M24 29.5q2-2.5 4 0" />
          <path d="M36 29.5q2-2.5 4 0" />
        </g>
      ) : eyes === 'sharp' ? (
        <g fill={ink}>
          <path d="M23.5 29q2.5-2 5 0q-2.5 1.6-5 0z" />
          <path d="M35.5 29q2.5-2 5 0q-2.5 1.6-5 0z" />
        </g>
      ) : eyes === 'sleepy' ? (
        <g>
          <circle cx="26" cy="29.5" r="1.8" fill={ink} />
          <circle cx="38" cy="29.5" r="1.8" fill={ink} />
          <path d="M23.8 28.6h4.4M35.8 28.6h4.4" stroke={l.skin} strokeWidth="1.6" />
        </g>
      ) : (
        <g fill={ink}>
          <circle cx="26" cy="29" r="2" />
          <circle cx="38" cy="29" r="2" />
          <circle cx="26.7" cy="28.3" r="0.6" fill="#fff" />
          <circle cx="38.7" cy="28.3" r="0.6" fill="#fff" />
        </g>
      )}

      {l.glasses === 'round' && (
        <g stroke="#1d1d1d" strokeWidth="1.3" fill="rgb(255 255 255 / 0.12)">
          <circle cx="26" cy="29" r="4.4" />
          <circle cx="38" cy="29" r="4.4" />
          <path d="M30.4 29h3.2" fill="none" />
        </g>
      )}
      {l.glasses === 'square' && (
        <g stroke="#1d1d1d" strokeWidth="1.4" fill="rgb(255 255 255 / 0.12)">
          <rect x="21.2" y="25.6" width="9" height="6.6" rx="1.4" />
          <rect x="33.8" y="25.6" width="9" height="6.6" rx="1.4" />
          <path d="M30.2 28.6h3.6" fill="none" />
        </g>
      )}

      {/* nose */}
      <path d="M32 31.5q-1.6 2.6 0 3.4" stroke="rgb(0 0 0 / 0.25)" strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {l.beard === 'mustache' && <path d="M26.5 37.4q2.8-2.4 5.5-.6 2.7-1.8 5.5.6-2.8.8-5.5-.4-2.7 1.2-5.5.4z" fill={l.hairColor} />}

      {/* mouth */}
      {mood === 'happy' ? (
        <path d="M27 38q5 5.5 10 0z" fill="#7a2e2e" stroke={ink} strokeWidth="1" strokeLinejoin="round" />
      ) : mood === 'sad' ? (
        <path d="M28 40.5q4-3 8 0" stroke={ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      ) : l.brows === 'bold' || l.eyes === 'sharp' ? (
        <path d="M28.5 39q3 1 7-1" stroke={ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M28 38.5q4 3 8 0" stroke={ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      )}
      {l.beard === 'full' && <path d="M27 41.5q5 2 10 0" stroke={l.hairColor} strokeWidth="2" fill="none" />}
    </g>
  )
}

/** Stockfish: a small robot fish. */
function Fish({ hue, mood }: { hue: number; mood: Mood }) {
  const body = `hsl(${hue} 30% 88%)`
  const metal = `hsl(${hue} 18% 62%)`
  return (
    <g>
      <path d="M46 32l12-10v20z" fill={metal} />
      <ellipse cx="30" cy="32" rx="20" ry="14" fill={body} />
      <path d="M22 19l6-7 6 7z" fill={metal} />
      <path d="M24 45l5 6 5-6z" fill={metal} />
      {[34, 39, 44].map((x) => (
        <path key={x} d={`M${x} 22q3 10 0 20`} stroke={metal} strokeWidth="1.4" fill="none" />
      ))}
      <circle cx="21" cy="29" r="6.5" fill="#1c1f24" />
      <circle cx="21" cy="29" r={mood === 'happy' ? 3.4 : 2.6} fill={mood === 'sad' ? '#ff7a5c' : '#5ef0c0'} />
      <circle cx="22.5" cy="27.5" r="1" fill="#fff" />
      <path d={mood === 'sad' ? 'M12 39q3-2 6 0' : 'M12 37q3 2.5 6 0'} stroke="#1c1f24" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <rect x="29" y="6" width="2" height="7" fill={metal} />
      <circle cx="30" cy="5.5" r="2.4" fill="#5ef0c0" />
    </g>
  )
}
