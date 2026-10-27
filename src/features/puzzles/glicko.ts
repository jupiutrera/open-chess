/** Glicko-2 for a single result against a puzzle (Glickman, 2012). */

export interface Glicko {
  rating: number
  rd: number
  vol: number
}

export const DEFAULT_GLICKO: Glicko = { rating: 1200, rd: 350, vol: 0.06 }

const SCALE = 173.7178
const TAU = 0.5

export function updateGlicko(player: Glicko, oppRating: number, oppRd: number, score: 0 | 1): Glicko {
  const mu = (player.rating - 1500) / SCALE
  const phi = player.rd / SCALE
  const muJ = (oppRating - 1500) / SCALE
  const phiJ = oppRd / SCALE
  const g = 1 / Math.sqrt(1 + (3 * phiJ * phiJ) / (Math.PI * Math.PI))
  const E = 1 / (1 + Math.exp(-g * (mu - muJ)))
  const v = 1 / (g * g * E * (1 - E))
  const delta = v * g * (score - E)

  // volatility (Illinois algorithm)
  const a = Math.log(player.vol * player.vol)
  const f = (x: number) =>
    (Math.exp(x) * (delta * delta - phi * phi - v - Math.exp(x))) / (2 * (phi * phi + v + Math.exp(x)) ** 2) - (x - a) / (TAU * TAU)
  let A = a
  let B: number
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v)
  else {
    let k = 1
    while (f(a - k * TAU) < 0) k++
    B = a - k * TAU
  }
  let fA = f(A)
  let fB = f(B)
  for (let i = 0; i < 60 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA)
    const fC = f(C)
    if (fC * fB <= 0) {
      A = B
      fA = fB
    } else fA /= 2
    B = C
    fB = fC
  }
  const vol = Math.exp(A / 2)
  const phiStar = Math.sqrt(phi * phi + vol * vol)
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v)
  const muNew = mu + phiNew * phiNew * g * (score - E)
  return {
    rating: Math.round(muNew * SCALE + 1500),
    rd: Math.max(45, Math.min(350, phiNew * SCALE)),
    vol,
  }
}
