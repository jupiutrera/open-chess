/**
 * Move number of a game ply (1 = first move played), counted from the starting FEN:
 * a game set up with Black to move starts at "N…".
 */
export function moveNumber(ply: number, startFen: string): { n: number; white: boolean } {
  const parts = startFen.split(' ')
  const blackFirst = parts[1] === 'b'
  const start = Number(parts[5]) || 1
  const half = ply - 1 + (blackFirst ? 1 : 0)
  return { n: start + Math.floor(half / 2), white: half % 2 === 0 }
}

/** "12." for White's move, "12…" for Black's. */
export function moveNumberLabel(ply: number, startFen: string, blackDots = '…'): string {
  const { n, white } = moveNumber(ply, startFen)
  return `${n}${white ? '.' : blackDots}`
}
