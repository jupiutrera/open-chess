# Design

The interface follows the category standard (see PRODUCT.md, Brand Commitments): chess.com's layout and conventions, played straight, with Lichess-level analysis clarity. The board is the product and chrome stays quiet around it.

## Color

Tokens live in `src/styles.css` (`:root`) and are exposed to Tailwind through `@theme inline`.

| Role | Token | Dark | Use |
|---|---|---|---|
| Page | `--bg` | `#302e2b` | app background |
| Rail | `--bg-rail` | `#262421` | sidebar, bottom bar |
| Panel | `--panel` / `--panel-2` | `#262522` / `#21201d` | side panels, wells and inputs |
| Raise | `--raise` / `--raise-2` | `#3c3a37` / `#4b4847` | buttons, hover, selection |
| Text | `--text` / `--text-2` / `--text-3` | `#f1f0ef` / `#c3c2c1` / `#989795` | primary, secondary, muted |
| Accent | `--accent` (`-hi`, `-lo`) | `#81b64c` | the one action colour: primary buttons, active toggles, current-move marker |
| Danger | `--danger` | `#e35d4b` | low clock, wrong move, losses |

Light theme redefines the neutrals under `[data-theme='light']` with the same hierarchy.

The move-quality colours (`--q-brilliant` … `--q-blunder`) are semantic, never decorative. A quality is always shown as colour plus a glyph or icon plus a label (QualityIcon), never colour alone.

Board themes come from `data-board` on `<html>` (green, brown, blue, gray, purple) and set `--sq-light` and `--sq-dark`. The squares are a CSS conic gradient on `cg-board`, so there are no board images.

## Type

There is one family: Geist Variable for the UI and Geist Mono for clocks and evaluations (measurements only). It is self-hosted through @fontsource. Weights do the hierarchy work: 800 for titles, 700 for controls, 400 to 600 for body text. Every number that changes in place uses `.tabular`.

## Shape and depth

- Radius scale: 6px for fields and small controls, 10px for panels and buttons, 12px for large buttons. Avatars are rounded squares (6px).
- Buttons carry chess.com's lip: `box-shadow: 0 3-4px 0` in a darker shade. Pressing translates 2px down and shrinks the lip. Primary buttons are green with the `--accent-lo` lip.
- Panels are flat (no shadow). Separation comes from tone steps and 1px `--line` dividers.

## Components

| Component | File | Notes |
|---|---|---|
| Board | `src/board/Board.tsx` | chessground wrapper; promotion picker, quality badge overlay, highlights, premoves, knight arrows bent into an L |
| OutcomeMarks | `src/board/OutcomeMarks.tsx` | end-of-game badges on both kings: green crown for the winner; red mate, flag or clock for the loser; grey ½ for draws |
| BoardLayout | `src/board/BoardLayout.tsx` | player bars around the board, eval bar left (desktop), side panel right or below; sizing lives in `.board-layout` |
| PlayerBar / Avatar | `src/board/PlayerBar.tsx` | captured pieces, material diff, clock (white when running, red under 20s), bot speech bubble |
| MoveStrip | `src/board/MoveList.tsx` | one-line horizontal move list used on phones instead of the two-column list |
| BotAvatar | `src/features/play/BotAvatar.tsx` | SVG bot portraits built from a `Look`; mood (neutral, happy, sad) follows the game |
| AssistToggles / useAssist | `src/features/play/` | the five bot-game helps (eval bar, threat arrows, suggestion arrows, move feedback, engine) on their own engine |
| EvalBar / EvalStrip | `src/board/EvalBar.tsx` | vertical on desktop, horizontal strip on mobile; transform-only animation |
| MoveList | `src/board/MoveList.tsx` | numbered two-column list, quality icons, auto-scroll |
| QualityIcon / PieceIcon | `src/board/QualityIcon.tsx` | Phosphor glyphs or Informant marks; pieces reuse the cburnett sprites |
| EvalGraph | `src/features/review/EvalGraph.tsx` | White's win% area, key-move dots, crosshair tooltip, click to seek |
| kit | `src/ui/kit.tsx` | PageHeader, Panel, Segmented, Toggle, Sheet (bottom sheet on mobile, dialog on desktop), toasts, Skeleton, SkeletonText, SkeletonRows, BoardScreenSkeleton, HubSkeleton |

## Layout

- Desktop (≥1024px): 168px icon and label rail on the left; the board fills the viewport height (`--bs` in `.board-layout`); 380px side panel (420px from 1536px) that matches the board column's height and scrolls on its own.
- Mobile: board edge to edge; panel below; fixed five-item bottom bar (Inicio, Jugar, Puzzles, Aprender, Más) with a sheet for the rest; safe-area padding.

## Motion

- Curves: `--ease-out` (cubic-bezier(0.23, 1, 0.32, 1)) for enters and feedback, and `--ease-in-out` for on-screen movement.
- Pieces animate for 180ms (chessground). The eval bar moves for 420ms on transform. Button press takes 140ms.
- `.enter` (fade + 6px rise) and `.pop` (fade + scale 0.96) use `@starting-style`. `.shake` marks a wrong move.
- Skeletons shimmer with a 1.4s sweep (`.skeleton`), static under reduced motion. Outcome badges pop in with a small overshoot.
- Nothing animates on keyboard navigation through moves. `prefers-reduced-motion` removes movement and keeps the fades.

## Sound and haptics

Board sounds are synthesized with Web Audio (`src/chess/sounds.ts`), so there are no audio files to license. Each sound is modal synthesis (decaying wood and board resonances plus a contact click), rendered once into a few buffer variants and played through a short room reverb and a compressor; notifications use a soft mallet voice. On Android, moves trigger light haptics through Capacitor.
