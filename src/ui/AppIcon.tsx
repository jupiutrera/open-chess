import house from '../assets/icons/house.svg'
import puzzle from '../assets/icons/puzzle_piece.svg'
import books from '../assets/icons/books.svg'
import openBook from '../assets/icons/open_book.svg'
import search from '../assets/icons/magnifying_glass_tilted_left.svg'
import games from '../assets/icons/card_file_box.svg'
import inbox from '../assets/icons/inbox_tray.svg'
import stats from '../assets/icons/bar_chart.svg'
import gear from '../assets/icons/gear.svg'
import bolt from '../assets/icons/high_voltage.svg'
import calendar from '../assets/icons/spiral_calendar.svg'
import trophy from '../assets/icons/trophy.svg'
import { PieceIcon } from '../board/QualityIcon'

/** Colour icons: Microsoft Fluent Emoji (Flat, MIT). "play" uses the current piece set's knight. */
const ICONS = {
  home: house,
  puzzles: puzzle,
  learn: books,
  openings: openBook,
  analysis: search,
  games,
  import: inbox,
  profile: stats,
  settings: gear,
  rush: bolt,
  daily: calendar,
  trophy,
} as const

export type AppIconName = keyof typeof ICONS | 'play'

export function AppIcon({ name, size = 24, className = '' }: { name: AppIconName; size?: number; className?: string }) {
  if (name === 'play') return <PieceIcon piece="n" color="w" size={size * 1.12} />
  return <img src={ICONS[name]} width={size} height={size} alt="" aria-hidden draggable={false} className={`shrink-0 select-none ${className}`} />
}
