import type { Bot } from './bots'

export type Mood = 'neutral' | 'happy' | 'sad'

/** Portraits: Open Peeps SVGs from scripts/build-avatars.mjs, and a photo of a cod for Stockfish (WebP). */
const PORTRAITS = import.meta.glob<string>('../../assets/bots/*.{svg,webp}', { eager: true, query: '?url', import: 'default' })

function portrait(id: string, mood: Mood): string | undefined {
  return PORTRAITS[`../../assets/bots/${id}-${mood}.svg`] ?? PORTRAITS[`../../assets/bots/${id}-${mood}.webp`]
}

/** Bot portrait on the bot's colour; the expression follows the game through `mood`. */
export function BotAvatar({ bot, size = 40, mood = 'neutral', className = '' }: { bot: Bot; size?: number; mood?: Mood; className?: string }) {
  const face = bot.avatar ?? bot.id
  const src = portrait(face, mood) ?? portrait(face, 'neutral')
  // a borrowed portrait (the challenge Stockfishes share the cod photo) is framed in the bot's own colour
  const borrowed = !!bot.avatar
  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(6, size * 0.16),
        background: `linear-gradient(160deg, hsl(${bot.hue} 45% 62%), hsl(${bot.hue} 45% 40%))`,
      }}
      aria-hidden
    >
      {src && <img src={src} alt="" width={size} height={size} draggable={false} className="absolute inset-0 h-full w-full object-cover" />}
      {borrowed && (
        <span
          className="absolute inset-0"
          style={{ borderRadius: 'inherit', boxShadow: `inset 0 0 0 ${Math.max(2, Math.round(size * 0.07))}px hsl(${bot.hue} 75% 58%)` }}
        />
      )}
    </span>
  )
}
