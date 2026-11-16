import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/** Tab title per section, from the first path segment; sub-screens share their section's name. */
const SECTION_TITLE: Record<string, string> = {
  play: 'nav.play',
  review: 'review.title',
  puzzles: 'nav.puzzles',
  openings: 'nav.openings',
  lessons: 'nav.learn',
  analysis: 'nav.analysis',
  games: 'nav.games',
  import: 'nav.import',
  profile: 'nav.profile',
  settings: 'nav.settings',
  league: 'league.title',
  training: 'training.title',
  clones: 'clone.title',
}

/**
 * <main> is the one scroll container of every route, so it keeps its scroll position across pages:
 * a new page starts at the top, back/forward return to where that history entry was left.
 */
function useScrollRestoration(main: RefObject<HTMLElement | null>) {
  const { pathname, key } = useLocation()
  const navType = useNavigationType()
  // scrollTop per history entry (location.key)
  const positions = useRef(new Map<string, number>())
  const shown = useRef({ key, pathname })
  // true while a restore is still waiting for the page to be tall enough: the clamped scroll it causes isn't a position to keep
  const restoring = useRef(false)

  useEffect(() => {
    const box = main.current
    if (!box) return
    const onScroll = () => {
      if (!restoring.current) positions.current.set(shown.current.key, box.scrollTop)
    }
    box.addEventListener('scroll', onScroll, { passive: true })
    return () => box.removeEventListener('scroll', onScroll)
  }, [main])

  // a layout effect, so the old page's offset never shows under the new page
  useLayoutEffect(() => {
    const prev = shown.current
    if (prev.key === key) return
    shown.current = { key, pathname }
    const box = main.current
    if (!box) return
    if (prev.pathname === pathname) {
      // only the query changed (a replace): same screen, the entry keeps the position it had
      const kept = positions.current.get(prev.key)
      if (kept !== undefined) positions.current.set(key, kept)
      return
    }
    const target = navType === 'POP' ? (positions.current.get(key) ?? 0) : 0
    positions.current.set(key, target)
    box.scrollTop = target
    if (!target) return
    // lazy screens are shorter than their saved offset until they have rendered: try again for a few frames
    restoring.current = true
    let frames = 0
    let raf = 0
    const apply = () => {
      box.scrollTop = target
      if (Math.abs(box.scrollTop - target) < 2 || ++frames > 40) restoring.current = false
      else raf = requestAnimationFrame(apply)
    }
    raf = requestAnimationFrame(apply)
    return () => {
      cancelAnimationFrame(raf)
      restoring.current = false
    }
  }, [key, pathname, navType, main])
}

/**
 * Shell work on every navigation: the tab title names the section, and focus moves to the new page's h1
 * so screen readers announce it and Tab starts from the page instead of the link that was clicked.
 */
export function useRouteChange(main: RefObject<HTMLElement | null>) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const section = pathname.split('/')[1] ?? ''
  useScrollRestoration(main)

  // a layout effect, so a page's own passive effect (NotFound) can still override it
  useLayoutEffect(() => {
    const key = SECTION_TITLE[section]
    document.title = key ? `${t(key)} · Open Chess` : 'Open Chess'
  }, [section, t])

  // compared by path rather than a first-run flag, which StrictMode's double effect run would clear
  const shown = useRef(pathname)
  useEffect(() => {
    // the first page load keeps the browser's default focus
    if (shown.current === pathname) return
    shown.current = pathname
    const box = main.current
    if (!box) return
    const focusHeading = () => {
      const h1 = box.querySelector<HTMLElement>('h1')
      if (!h1) return false
      // a page that already focused something of its own (a search field) keeps it
      if (box.contains(document.activeElement) && document.activeElement !== box) return true
      if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1')
      h1.focus({ preventScroll: true })
      return true
    }
    if (focusHeading()) return
    // lazy screens render their heading after their code loads
    const obs = new MutationObserver(() => focusHeading() && obs.disconnect())
    obs.observe(box, { childList: true, subtree: true })
    const stop = setTimeout(() => obs.disconnect(), 5000)
    return () => {
      obs.disconnect()
      clearTimeout(stop)
    }
  }, [pathname, main])
}
