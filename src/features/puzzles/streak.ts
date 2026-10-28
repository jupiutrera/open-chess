/** Puzzle Streak (Lichess style): untimed, one miss ends the run, each puzzle a bit harder. */

/** How far below the user's rating the first puzzle sits, so a run starts with a few easy ones. */
export const STREAK_MARGIN = 300
/** Rating added per puzzle solved. */
export const STREAK_STEP = 30
const FLOOR = 600

/** Target rating of the n-th puzzle (0-based) of a streak for a user rated `rating`. */
export function streakTarget(rating: number, n: number): number {
  return Math.max(FLOOR, Math.round(rating) - STREAK_MARGIN) + n * STREAK_STEP
}
