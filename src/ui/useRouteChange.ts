import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'
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
}

/**
 * Shell work on every navigation: the tab title names the section, and focus moves to the new page's h1
 * so screen readers announce it and Tab starts from the page instead of the link that was clicked.
 */
export function useRouteChange(main: RefObject<HTMLElement | null>) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const section = pathname.split('/')[1] ?? ''

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
