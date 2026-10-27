import { lazy, useEffect } from 'react'
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Layout } from './ui/Layout'
import { Toaster } from './ui/kit'
import { applyDocumentSettings, useSettings } from './settings'
import { startSync } from './sync/sync'
import { Home } from './features/home/Home'

const PlayHub = lazy(() => import('./features/play/PlayHub'))
const PlayBot = lazy(() => import('./features/play/PlayBot'))
const PlayLocal = lazy(() => import('./features/play/PlayLocal'))
const Review = lazy(() => import('./features/review/Review'))
const PuzzlesHub = lazy(() => import('./features/puzzles/PuzzlesHub'))
const PuzzleRated = lazy(() => import('./features/puzzles/PuzzleRated'))
const PuzzleRush = lazy(() => import('./features/puzzles/PuzzleRush'))
const Openings = lazy(() => import('./features/openings/Openings'))
const OpeningTrainer = lazy(() => import('./features/openings/OpeningTrainer'))
const Lessons = lazy(() => import('./features/lessons/Lessons'))
const LessonPlayer = lazy(() => import('./features/lessons/LessonPlayer'))
const Analysis = lazy(() => import('./features/analysis/Analysis'))
const Games = lazy(() => import('./features/profile/Games'))
const Import = lazy(() => import('./features/import/Import'))
const Profile = lazy(() => import('./features/profile/Profile'))
const SettingsPage = lazy(() => import('./features/profile/SettingsPage'))

/** Android hardware back button follows router history. */
function BackButton() {
  const nav = useNavigate()
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const h = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && location.hash !== '#/') nav(-1)
      else void CapApp.exitApp()
    })
    return () => void h.then((x) => x.remove())
  }, [nav])
  return null
}

export function App() {
  const theme = useSettings((s) => s.theme)
  const board = useSettings((s) => s.board)
  const lang = useSettings((s) => s.lang)
  const pieces = useSettings((s) => s.pieces)
  useEffect(() => applyDocumentSettings({ theme, board, lang, pieces }), [theme, board, lang, pieces])
  useEffect(() => startSync(), [])
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
            <Route path="puzzles/rated" element={<PuzzleRated />} />
            <Route path="puzzles/daily" element={<PuzzleRated daily />} />
            <Route path="puzzles/rush/:mode" element={<PuzzleRush />} />
            <Route path="openings" element={<Openings />} />
            <Route path="openings/trainer/:color" element={<OpeningTrainer />} />
            <Route path="lessons" element={<Lessons />} />
            <Route path="lessons/:id" element={<LessonPlayer />} />
            <Route path="analysis" element={<Analysis />} />
            <Route path="games" element={<Games />} />
            <Route path="import" element={<Import />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      <Toaster />
    </HashRouter>
  )
}
