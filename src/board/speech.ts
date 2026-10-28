import type { TFunction } from 'i18next'

const PIECE: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' }

/** A SAN move as a screen reader should say it: "Nxf3+" → "Knight takes f3, check". */
export function spokenSan(san: string, t: TFunction): string {
  const mate = san.includes('#')
  const check = !mate && san.includes('+')
  const bare = san.replace(/[+#!?]/g, '')
  let out: string
  if (bare === 'O-O-O' || bare === '0-0-0') out = t('common.speech.castleLong')
  else if (bare === 'O-O' || bare === '0-0') out = t('common.speech.castleShort')
  else {
    const [move, promo] = bare.split('=')
    const piece = PIECE[move[0]]
    // "Nbxd7" → ["b", "d7"]: disambiguation, then the target square
    const [from, to] = (piece ? move.slice(1) : move).split('x')
    const words = to === undefined ? [from] : [from, t('common.speech.takes'), to]
    out = [piece ? t(`common.piece.${piece}`) : '', ...words].filter(Boolean).join(' ')
    if (promo && PIECE[promo]) out += `, ${t('common.speech.promotion', { piece: t(`common.piece.${PIECE[promo]}`) })}`
  }
  if (mate) out += `, ${t('common.speech.checkmate')}`
  if (check) out += `, ${t('common.speech.check')}`
  return out
}
