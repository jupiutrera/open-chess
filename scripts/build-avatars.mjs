// Generates the bot portraits in src/assets/bots/: one SVG per bot and mood.
// People use DiceBear's Open Peeps (Pablo Stanley, CC0 1.0). Stockfish's portrait is
// a photo instead (resources/stockfish-cod.jpg, NOAA, public domain), cropped into
// src/assets/bots/stockfish-*.webp by hand. See README.
// Run with `npm run data:avatars` after changing a look.
import { createAvatar } from '@dicebear/core'
import * as openPeeps from '@dicebear/open-peeps'
import { mkdirSync, writeFileSync } from 'node:fs'

const SKIN = { light: 'ffdbb4', fair: 'edb98a', tan: 'd08b5b', brown: 'ae5d29', dark: '694d3d' }

/** Each bot's look; `face` is their resting expression. */
const LOOKS = {
  pip: { skin: SKIN.light, head: 'short5', hair: 'a55728', clothes: 'f97316', face: 'cute' },
  lola: { skin: SKIN.fair, head: 'longCurly', hair: 'c93305', clothes: 'ec4899', face: 'cheeky' },
  teo: { skin: SKIN.tan, head: 'short2', hair: '4a312c', clothes: '3b82f6', face: 'smile' },
  marga: { skin: SKIN.light, head: 'grayBun', hair: 'e8e1e1', clothes: '22a05a', face: 'calm', accessory: 'glasses2' },
  ivan: { skin: SKIN.fair, head: 'mohawk', hair: '2c1b18', clothes: 'dc2626', face: 'driven' },
  noa: { skin: SKIN.brown, head: 'bangs', hair: '2c1b18', clothes: 'eab308', face: 'explaining', accessory: 'glasses' },
  rafa: { skin: SKIN.tan, head: 'short3', hair: '724133', clothes: '64748b', face: 'serious', facialHair: 'goatee1' },
  kira: { skin: SKIN.light, head: 'long', hair: '2c1b18', clothes: '1f2937', face: 'calm' },
  oscar: { skin: SKIN.fair, head: 'pomp', hair: '724133', clothes: '1d4ed8', face: 'suspicious', facialHair: 'moustache2' },
  vera: { skin: SKIN.dark, head: 'bun2', hair: '2c1b18', clothes: '7c3aed', face: 'solemn' },
  boris: { skin: SKIN.light, head: 'grayShort', hair: 'e8e1e1', clothes: '57534e', face: 'old', facialHair: 'full3' },
  elena: { skin: SKIN.light, head: 'mediumStraight', hair: '724133', clothes: '111827', face: 'serious', accessory: 'glasses4' },
}

const MOODS = {
  neutral: (l) => l.face,
  happy: () => 'smileLOL',
  sad: () => 'solemn',
}

const out = 'src/assets/bots'
mkdirSync(out, { recursive: true })

for (const [id, l] of Object.entries(LOOKS)) {
  for (const [mood, face] of Object.entries(MOODS)) {
    const svg = createAvatar(openPeeps, {
      seed: id,
      skinColor: [l.skin],
      head: [l.head],
      headContrastColor: [l.hair],
      clothingColor: [l.clothes],
      face: [face(l)],
      facialHair: l.facialHair ? [l.facialHair] : undefined,
      facialHairProbability: l.facialHair ? 100 : 0,
      accessories: l.accessory ? [l.accessory] : undefined,
      accessoriesProbability: l.accessory ? 100 : 0,
      maskProbability: 0,
      // a little smaller and lower, so the shoulders sit on the tile's bottom edge
      scale: 90,
      translateY: 4,
    }).toString()
    writeFileSync(`${out}/${id}-${mood}.svg`, svg)
  }
}

console.log('avatars written to', out)
