// Generates the bot portraits in src/assets/bots/: one SVG per bot and mood.
// People use DiceBear's Toon Head (Johan Melin, CC BY 4.0); Stockfish uses
// Bottts (Pablo Stanley, free for personal and commercial use). See README.
// Run with `npm run data:avatars` after changing a look.
import { createAvatar } from '@dicebear/core'
import * as toonHead from '@dicebear/toon-head'
import * as bottts from '@dicebear/bottts'
import { mkdirSync, writeFileSync } from 'node:fs'

const SKIN = { light: 'f1c3a5', fair: 'c68e7a', tan: 'b98e6a', brown: 'a36b4f', dark: '5c3829' }
const GREY = 'b8b4ad'

/** Each bot's look; `eyes`/`brows` are their resting expression. */
const LOOKS = {
  pip: { skin: SKIN.light, hair: 'spiky', hairColor: 'a55728', clothes: 'tShirt', clothesColor: 'f97316', eyes: 'wide', brows: 'raised' },
  lola: { skin: SKIN.light, hair: 'sideComed', rear: 'longWavy', hairColor: 'a55728', clothes: 'dress', clothesColor: 'ec4899', eyes: 'wink', brows: 'happy' },
  teo: { skin: SKIN.tan, hair: 'undercut', hairColor: 'd6b370', clothes: 'tShirt', clothesColor: '0b3286', eyes: 'happy', brows: 'neutral' },
  marga: { skin: SKIN.light, hair: 'bun', hairColor: GREY, clothes: 'turtleNeck', clothesColor: '147f3c', eyes: 'happy', brows: 'neutral' },
  ivan: { skin: SKIN.fair, hair: 'spiky', hairColor: '2c1b18', clothes: 'openJacket', clothesColor: 'b11f1f', eyes: 'wide', brows: 'angry' },
  noa: { skin: SKIN.brown, hair: 'sideComed', rear: 'shoulderHigh', hairColor: '2c1b18', clothes: 'shirt', clothesColor: 'eab308', eyes: 'wide', brows: 'raised' },
  rafa: { skin: SKIN.tan, hair: 'undercut', hairColor: '724133', beard: 'chin', clothes: 'shirt', clothesColor: '545454', eyes: 'wide', brows: 'neutral' },
  kira: { skin: SKIN.light, hair: 'sideComed', rear: 'longStraight', hairColor: '2c1b18', clothes: 'turtleNeck', clothesColor: '151613', eyes: 'wide', brows: 'neutral' },
  oscar: { skin: SKIN.fair, hair: 'sideComed', hairColor: '724133', beard: 'moustacheTwirl', clothes: 'openJacket', clothesColor: '0b3286', eyes: 'wide', brows: 'raised' },
  vera: { skin: SKIN.dark, hair: 'bun', hairColor: '2c1b18', clothes: 'turtleNeck', clothesColor: '731ac3', eyes: 'happy', brows: 'neutral' },
  boris: { skin: SKIN.light, hair: 'undercut', hairColor: GREY, beard: 'longBeard', clothes: 'openJacket', clothesColor: '545454', eyes: 'wide', brows: 'angry' },
  elena: { skin: SKIN.light, hair: 'bun', rear: 'longStraight', hairColor: '724133', clothes: 'dress', clothesColor: '151613', eyes: 'wide', brows: 'raised' },
}

const MOODS = {
  neutral: (l) => ({ eyes: [l.eyes], eyebrows: [l.brows], mouth: ['smile'] }),
  happy: () => ({ eyes: ['happy'], eyebrows: ['happy'], mouth: ['laugh'] }),
  sad: () => ({ eyes: ['humble'], eyebrows: ['sad'], mouth: ['sad'] }),
}

const out = 'src/assets/bots'
mkdirSync(out, { recursive: true })

for (const [id, l] of Object.entries(LOOKS)) {
  for (const [mood, face] of Object.entries(MOODS)) {
    const svg = createAvatar(toonHead, {
      seed: id,
      skinColor: [l.skin],
      hair: [l.hair],
      hairColor: [l.hairColor],
      hairProbability: 100,
      rearHair: l.rear ? [l.rear] : undefined,
      rearHairProbability: l.rear ? 100 : 0,
      beard: l.beard ? [l.beard] : undefined,
      beardProbability: l.beard ? 100 : 0,
      clothes: [l.clothes],
      clothesColor: [l.clothesColor],
      ...face(l),
    }).toString()
    writeFileSync(`${out}/${id}-${mood}.svg`, svg)
  }
}

// Stockfish: a robot, whose eyes and mouth change with the mood
const ROBOT = {
  neutral: { eyes: ['roundFrame02'], mouth: ['smile01'] },
  happy: { eyes: ['happy'], mouth: ['smile02'] },
  sad: { eyes: ['dizzy'], mouth: ['square01'] },
}
for (const [mood, face] of Object.entries(ROBOT)) {
  const svg = createAvatar(bottts, {
    seed: 'stockfish',
    baseColor: ['43a047'],
    face: ['round01'],
    top: ['antenna'],
    sides: ['antenna01'],
    texture: [],
    textureProbability: 0,
    ...face,
  }).toString()
  writeFileSync(`${out}/stockfish-${mood}.svg`, svg)
}
console.log('avatars written to', out)
