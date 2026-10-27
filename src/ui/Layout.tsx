import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DotsThreeOutline } from '@phosphor-icons/react'
import { Suspense, useState } from 'react'
import { Logo } from './Logo'
import { AppIcon, type AppIconName } from './AppIcon'
import { BoardScreenSkeleton, HubSkeleton, useDismiss } from './kit'

/** Board screens get a board-shaped placeholder while their code loads; hubs and lists get cards. */
const BOARD_ROUTES = /^\/(play\/(bot|local)|review\/|puzzles\/(rated|daily|rush)|openings|lessons\/|analysis)/

interface Item {
  to: string
  label: string
  icon: AppIconName
}

export function Layout() {
  const { t } = useTranslation()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  useDismiss(moreOpen, () => setMoreOpen(false))

  const primary: Item[] = [
    { to: '/', label: t('nav.home'), icon: 'home' },
    { to: '/play', label: t('nav.play'), icon: 'play' },
    { to: '/puzzles', label: t('nav.puzzles'), icon: 'puzzles' },
    { to: '/lessons', label: t('nav.learn'), icon: 'learn' },
    { to: '/openings', label: t('nav.openings'), icon: 'openings' },
    { to: '/analysis', label: t('nav.analysis'), icon: 'analysis' },
    { to: '/games', label: t('nav.games'), icon: 'games' },
    { to: '/import', label: t('nav.import'), icon: 'import' },
  ]
  const secondary: Item[] = [
    { to: '/profile', label: t('nav.profile'), icon: 'profile' },
    { to: '/settings', label: t('nav.settings'), icon: 'settings' },
  ]
  const mobileMain = primary.slice(0, 4)
  const mobileMore = [...primary.slice(4), ...secondary]
  const inMore = mobileMore.some((i) => location.pathname.startsWith(i.to))

  return (
    <div className="flex h-full pt-[var(--inset-top)]">
      {/* Desktop rail */}
      <nav className="hidden w-[168px] shrink-0 flex-col bg-rail py-3 lg:flex" aria-label={t('nav.main')}>
        <NavLink to="/" className="mb-3 flex items-center gap-2 px-3 py-2">
          <Logo size={30} />
          <span className="whitespace-nowrap text-[17px] font-extrabold tracking-tight">Open Chess</span>
        </NavLink>
        {primary.map((i) => (
          <RailLink key={i.to} item={i} />
        ))}
        <div className="mt-auto">
          {secondary.map((i) => (
            <RailLink key={i.to} item={i} />
          ))}
        </div>
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto pb-[calc(64px+var(--inset-bottom))] lg:pb-0">
        <Suspense fallback={BOARD_ROUTES.test(location.pathname) ? <BoardScreenSkeleton /> : <HubSkeleton />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile bottom bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-rail pb-[var(--inset-bottom)] lg:hidden"
        aria-label={t('nav.main')}
      >
        {mobileMain.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.to === '/'}
            onClick={() => setMoreOpen(false)}
            className={({ isActive }) =>
              `flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? 'text-fg' : 'text-fg-3'}`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`grid h-7 place-items-center transition-[opacity,transform] duration-150 ${isActive ? '' : 'opacity-75 grayscale-[35%]'}`}>
                  <AppIcon name={i.icon} size={26} />
                </span>
                {i.label}
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${moreOpen || inMore ? 'text-fg' : 'text-fg-3'}`}
          aria-expanded={moreOpen}
          aria-controls="more-menu"
        >
          <DotsThreeOutline size={26} weight={moreOpen || inMore ? 'fill' : 'regular'} />
          {t('nav.more')}
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div
            id="more-menu"
            className="enter absolute inset-x-0 bottom-[calc(64px+var(--inset-bottom))] rounded-t-2xl bg-panel p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {mobileMore.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-4 rounded-lg px-4 py-3.5 text-[16px] font-semibold ${isActive ? 'bg-raise text-fg' : 'text-fg-2'}`
                }
              >
                <AppIcon name={i.icon} size={26} />
                {i.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RailLink({ item }: { item: Item }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        `mx-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-bold transition-colors duration-150 ${
          isActive ? 'bg-raise text-fg' : 'text-fg-2 hover:bg-raise/60 hover:text-fg'
        }`
      }
    >
      <AppIcon name={item.icon} size={26} />
      {item.label}
    </NavLink>
  )
}
