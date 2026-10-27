import type { CSSProperties, ReactNode } from 'react'

/**
 * Board screen: player bars above and below the board, optional eval bar,
 * side panel on the right on desktop and underneath on mobile.
 *
 * On desktop the board is sized to fill the viewport (see `.board-layout` in
 * styles.css) and the side column matches the board column's height, scrolling
 * on its own when its content is taller.
 */
export function BoardLayout({
  top,
  bottom,
  board,
  evalBar,
  side,
  above,
}: {
  top?: ReactNode
  bottom?: ReactNode
  board: ReactNode
  evalBar?: ReactNode
  side?: ReactNode
  /** mobile-only strip above the board (e.g. horizontal eval) */
  above?: ReactNode
}) {
  const vars = { '--bars': (top ? 1 : 0) + (bottom ? 1 : 0), '--evalw': evalBar ? '30px' : '0px' } as CSSProperties
  return (
    <div className="board-layout" style={vars}>
      <div className="bl-board">
        {above && <div className="px-2 pt-2 lg:hidden">{above}</div>}
        {top && <div className="px-2 lg:px-0">{top}</div>}
        <div className="flex gap-1.5">
          {evalBar && <div className="hidden lg:flex">{evalBar}</div>}
          <div className="min-w-0 flex-1">{board}</div>
        </div>
        {bottom && <div className="px-2 lg:px-0">{bottom}</div>}
      </div>
      {side && <aside className="bl-side">{side}</aside>}
    </div>
  )
}
