import { BOTS, type Bot } from '../play/bots'

/** Who a variant can be played against: the bots of standard chess, at their rating. Challenges are rules of their own. */
export const RIVALS: Bot[] = BOTS.filter((b) => !b.challenge)

const RIVAL_KEY = 'oc-variant-rival'
/** The same bot a first visit to Play offers. */
const DEFAULT_RIVAL = RIVALS[4]

export function rivalById(id: string | null | undefined): Bot {
  return RIVALS.find((b) => b.id === id) ?? DEFAULT_RIVAL
}

/** The rival of the last variant game, so the next one starts at the same strength. */
export function savedRival(): Bot {
  try {
    return rivalById(localStorage.getItem(RIVAL_KEY))
  } catch {
    return DEFAULT_RIVAL
  }
}

export function rememberRival(bot: Bot) {
  try {
    localStorage.setItem(RIVAL_KEY, bot.id)
  } catch {
    // the rival just isn't remembered
  }
}
