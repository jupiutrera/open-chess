# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(PWA for desktop and mobile browsers, also packaged as an Android APK with Capacitor. The design language is web, not native Android.)

## Stack

Delegated: Vite + React + TypeScript + Tailwind v4, chessground (board), chess.js (rules), Stockfish WASM (engine), Dexie (IndexedDB), Supabase (optional sync), i18next (ES/EN), Capacitor (Android). Chosen for one codebase across web and APK and offline-first engine work.

## Users

The owner and their circle of friends: chess players tired of chess.com paywalls. They train alone, often in long sessions (puzzles, reviewing their own games, drilling openings), on a laptop at a desk or on a phone. Inferred: club/intermediate level, Spanish-speaking first.

## Product Purpose

A free, self-owned replacement for chess.com's training features: play bots, full game review with move classification and accuracy, rated puzzles and Puzzle Rush, opening explorer and repertoire trainer, lessons and endgame drills, analysis board, import of games from chess.com/Lichess. Success: nobody in the group needs a paid chess.com plan again.

## Positioning

Everything chess.com locks behind Diamond (unlimited game review, unlimited puzzles, lessons, opening trainer) is free, offline-capable, and runs on the player's own device with Stockfish. No ads, no online play against people.

## Operating Context

Long, focused sessions; frequent context switches between playing a bot and immediately reviewing the game. Phone use in portrait, one hand. Games are imported from chess.com/Lichess accounts the users already have.

## Capabilities and Constraints

- No online play between people (explicitly out of scope).
- Local-first data; optional account to sync between web and phone.
- Interface in Spanish (default) and English.
- Open data only: Lichess puzzle DB (CC0), lichess chess-openings (CC0), public Lichess explorer/tablebase APIs, public chess.com/Lichess game APIs.
- chessground is GPL-3.0, so the project is GPL-3.0.

## Brand Commitments

Name: Open Chess. No other assets exist yet.

Standing preference (chosen 2026-10-27): the category standard, played straight. The interface should sit alongside chess.com (primary reference: layout, dark grey chrome, green/cream board, icon sidebar, move-quality vocabulary) and Lichess (analysis board clarity). Execute the convention at full fidelity, no ironic quirks; do not copy chess.com logos, trademarks or proprietary assets.

## Evidence on Hand

None. Do not fabricate user counts, ratings or testimonials.

## Product Principles

1. Never gate a feature. Everything is free and unlimited.
2. The board is the product; chrome must not compete with it.
3. Fast from "game ended" to "what did I do wrong".
4. Works offline; network only enriches (explorer stats, tablebase, import, sync).
5. Comfortable for hours: low glare, calm motion, readable numbers.

## Accessibility & Inclusion

WCAG AA contrast, keyboard play on desktop, respects prefers-reduced-motion, colour is never the only carrier of move quality (icons + labels too).
