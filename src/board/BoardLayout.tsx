import type { ReactNode } from 'react'

/**
 * Board screen: player bars above and below the board, optional eval bar,
 * side panel on the right on desktop and underneath on mobile.
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
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-3 lg:flex-row lg:items-start lg:gap-5 lg:p-5">
      <div className="mx-auto w-full lg:mx-0 lg:w-[min(calc(100dvh-140px),calc(100vw-168px-420px))] lg:min-w-[420px]">
        {above && <div className="px-2 pt-2 lg:hidden">{above}</div>}
        {top && <div className="px-2 lg:px-0">{top}</div>}
        <div className="flex gap-1.5">
          {evalBar && <div className="hidden lg:flex">{evalBar}</div>}
          <div className="min-w-0 flex-1">{board}</div>
        </div>
        {bottom && <div className="px-2 lg:px-0">{bottom}</div>}
      </div>
      {side && <aside className="w-full min-w-0 px-2 pb-4 lg:w-[380px] lg:px-0 lg:pb-0">{side}</aside>}
    </div>
  )
}
