import { lazy, useEffect } from 'react'
import { HashRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Layout } from './ui/Layout'
import { UpdateBanner } from './ui/UpdateBanner'
import { NotFound } from './ui/NotFound'
import { requestPersistentStorage } from './ui/files'
import { Toaster, closeTopOverlay } from './ui/kit'
import { applyDocumentSettings, useResolvedTheme, useSettings } from './settings'
import { startSync } from './sync/sync'
import { preloadSounds } from './chess/sounds'
import { Home } from './features/home/Home'

const PlayHub = lazy(() => import('./features/play/PlayHub'))
const PlayBot = lazy(() => import('./features/play/PlayBot'))
const PlayLocal = lazy(() => import('./features/play/PlayLocal'))
const Review = lazy(() => import('./features/review/Review'))
const PuzzlesHub = lazy(() => import('./features/puzzles/PuzzlesHub'))
const Training = lazy(() => import('./features/weaknesses/Training'))
const PuzzleRated = lazy(() => import('./features/puzzles/PuzzleRated'))
const PuzzleRush = lazy(() => import('./features/puzzles/PuzzleRush'))
const PuzzleMistakes = lazy(() => import('./features/puzzles/PuzzleMistakes'))
const Openings = lazy(() => import('./features/openings/Openings'))
const OpeningTrainer = lazy(() => import('./features/openings/OpeningTrainer'))
const Lessons = lazy(() => import('./features/lessons/Lessons'))
const LessonPlayer = lazy(() => import('./features/lessons/LessonPlayer'))
const Analysis = lazy(() => import('./features/analysis/Analysis'))
const Games = lazy(() => import('./features/profile/Games'))
const Import = lazy(() => import('./features/import/Import'))
const Profile = lazy(() => import('./features/profile/Profile'))
const SettingsPage = lazy(() => import('./features/profile/SettingsPage'))

/** A fresh player per lesson: going back/forward between lessons must not carry the last one's state. */
function LessonRoute() {
  const { id } = useParams()
  return <LessonPlayer key={id} />
}

/** Android hardware back button closes the open sheet or menu first, then follows router history. */
function BackButton() {
  const nav = useNavigate()
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const h = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (closeTopOverlay()) return
      if (canGoBack && location.hash !== '#/') nav(-1)
      else void CapApp.exitApp()
    })
    return () => void h.then((x) => x.remove())
  }, [nav])
  return null
}

export function App() {
  const theme = useResolvedTheme()
  const board = useSettings((s) => s.board)
  const lang = useSettings((s) => s.lang)
  const pieces = useSettings((s) => s.pieces)
  const highContrast = useSettings((s) => s.highContrast)
  useEffect(() => applyDocumentSettings({ theme, board, lang, pieces, highContrast }), [theme, board, lang, pieces, highContrast])
  useEffect(() => startSync(), [])
  useEffect(() => requestPersistentStorage(), [])
  const soundSet = useSettings((s) => s.soundSet)
  // sounds can only play after a user gesture anyway; fetching them then keeps startup light
  useEffect(() => {
    const go = () => preloadSounds(soundSet)
    if (navigator.userActivation?.hasBeenActive) return go()
    window.addEventListener('pointerdown', go, { once: true })
    window.addEventListener('keydown', go, { once: true })
    return () => {
      window.removeEventListener('pointerdown', go)
      window.removeEventListener('keydown', go)
    }
  }, [soundSet])
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    void StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light })
    void StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#262421' : '#ffffff' }).catch(() => {})
  }, [theme])

  return (
    <HashRouter>
      <BackButton />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="play" element={<PlayHub />} />
            <Route path="play/bot/:botId" element={<PlayBot />} />
            <Route path="play/local" element={<PlayLocal />} />
            <Route path="review/:id" element={<Review />} />
            <Route path="puzzles" element={<PuzzlesHub />} />
            <Route path="training" element={<Training />} />
            <Route path="puzzles/rated" element={<PuzzleRated />} />
            <Route path="puzzles/daily" element={<PuzzleRated daily />} />
            <Route path="puzzles/rush/:mode" element={<PuzzleRush />} />
            <Route path="puzzles/mistakes" element={<PuzzleMistakes />} />
            <Route path="openings" element={<Openings />} />
            <Route path="openings/trainer/:color" element={<OpeningTrainer />} />
            <Route path="lessons" element={<Lessons />} />
            <Route path="lessons/:id" element={<LessonRoute />} />
            <Route path="analysis" element={<Analysis />} />
            <Route path="games" element={<Games />} />
            <Route path="import" element={<Import />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      <Toaster />
      <UpdateBanner />
    </HashRouter>
  )
}
