/**
 * The promotion piece to try for a solver's move. With no piece given (or a queen the board picked
 * by itself because auto-queen is on) a move that matches the expected one's squares takes its piece,
 * so underpromotion puzzles stay solvable without the picker.
 */
export function pickPromotion(from: string, to: string, promotion: string | undefined, expected: string | undefined, autoQueen: boolean): string {
  const matches = expected?.length === 5 && expected.slice(0, 4) === from + to
  if (matches && (!promotion || (promotion === 'q' && autoQueen))) return expected[4]
  return promotion ?? ''
}
