type L10n = { es: string; en: string }

export type LessonStep =
  | {
      kind: 'puzzle'
      fen: string
      text: L10n
      /** UCI: solver move, scripted reply, solver move… (any mate counts on the last move) */
      moves: string[]
      /** other last moves that are just as good (endgames often have several), accepted too */
      also?: string[]
    }
  | {
      kind: 'practice'
      fen: string
      text: L10n
      /** promote: done once the pawn queens where it cannot simply be taken back */
      goal: 'win' | 'draw' | 'promote'
      /** engine strength for the defending side */
      elo?: number
      /** draw goal: done after this many of the learner's moves if the engine sees no win any more */
      hold?: number
    }

export interface Lesson {
  id: string
  category: 'basics' | 'checkmates' | 'tactics' | 'endgames'
  title: L10n
  intro: L10n
  steps: LessonStep[]
}

export const LESSONS: Lesson[] = [
  {
    id: 'hanging-pieces',
    category: 'basics',
    title: { es: 'Captura piezas indefensas', en: 'Capture undefended pieces' },
    intro: {
      es: 'Antes de cada jugada, mira qué piezas del rival no están defendidas. Capturarlas gratis es la forma más sencilla de ganar.',
      en: 'Before every move, look for enemy pieces that are not defended. Taking them for free is the simplest way to win.',
    },
    steps: [
      {
        kind: 'puzzle',
        fen: '4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1',
        text: { es: 'La dama negra está en tu columna y nadie la defiende. Captúrala.', en: 'The black queen sits on your file and nothing defends it. Take it.' },
        moves: ['d1d5'],
      },
      {
        kind: 'puzzle',
        fen: '4k3/8/8/2r5/8/1N6/8/4K3 w - - 0 1',
        text: { es: 'Tu caballo puede llegar a una torre indefensa.', en: 'Your knight can reach an undefended rook.' },
        moves: ['b3c5'],
      },
    ],
  },
  {
    id: 'mate-in-one',
    category: 'checkmates',
    title: { es: 'Mates en una jugada', en: 'Mate in one' },
    intro: {
      es: 'Jaque mate: el rey está atacado y no tiene ninguna forma de escapar, tapar el jaque o capturar a la pieza que lo ataca.',
      en: 'Checkmate: the king is attacked and cannot escape, block the check or capture the attacker.',
    },
    steps: [
      {
        kind: 'puzzle',
        fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
        text: { es: 'El rey negro está encerrado por sus propios peones. Es el mate del pasillo.', en: 'The black king is boxed in by its own pawns. This is the back rank mate.' },
        moves: ['a1a8'],
      },
      {
        kind: 'puzzle',
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        text: { es: 'El punto f7 solo lo defiende el rey. Dama y alfil atacan juntos.', en: 'Only the king defends f7. Queen and bishop attack it together.' },
        moves: ['h5f7'],
      },
    ],
  },
  {
    id: 'smothered-mate',
    category: 'checkmates',
    title: { es: 'Mate de la coz', en: 'Smothered mate' },
    intro: {
      es: 'Cuando el rey está rodeado por sus propias piezas, un caballo puede darle mate él solo.',
      en: 'When the king is surrounded by its own pieces, a lone knight can deliver mate.',
    },
    steps: [
      {
        kind: 'puzzle',
        fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
        text: { es: 'El rey no tiene casillas libres. Busca el salto de caballo.', en: 'The king has no free squares. Find the knight jump.' },
        moves: ['g5f7'],
      },
    ],
  },
  {
    id: 'arabian-mate',
    category: 'checkmates',
    title: { es: 'Mate árabe', en: 'Arabian mate' },
    intro: {
      es: 'Torre y caballo trabajan juntos: el caballo protege a la torre y cubre la huida del rey en la esquina.',
      en: 'Rook and knight work together: the knight protects the rook and covers the king’s escape in the corner.',
    },
    steps: [
      {
        kind: 'puzzle',
        fen: '7k/R7/5N2/8/8/8/8/6K1 w - - 0 1',
        text: { es: 'Lleva la torre junto al rey. El caballo la protege.', en: 'Bring the rook next to the king. The knight protects it.' },
        moves: ['a7h7'],
      },
    ],
  },
  {
    id: 'forks',
    category: 'tactics',
    title: { es: 'Ataque doble', en: 'Forks' },
    intro: {
      es: 'Una pieza que ataca a dos a la vez obliga al rival a salvar solo una. El caballo es el rey de los ataques dobles.',
      en: 'A piece attacking two targets at once lets the opponent save only one. The knight is the king of forks.',
    },
    steps: [
      {
        kind: 'puzzle',
        fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1',
        text: { es: 'Da jaque atacando también a la torre.', en: 'Give check while also attacking the rook.' },
        moves: ['b5c7', 'e8d7', 'c7a8'],
      },
      {
        kind: 'puzzle',
        fen: '2q3k1/8/8/3N4/8/8/8/6K1 w - - 0 1',
        text: { es: 'Otro salto de caballo con jaque gana la dama.', en: 'Another knight check wins the queen.' },
        moves: ['d5e7', 'g8h8', 'e7c8'],
      },
    ],
  },
  {
    id: 'pin',
    category: 'tactics',
    title: { es: 'Clavada', en: 'Pin' },
    intro: {
      es: 'Una pieza clavada no puede salir de su línea sin dejar expuesta a otra más valiosa que está detrás. Si detrás está el rey, salir de la línea ni siquiera es legal.',
      en: 'A pinned piece cannot leave its line without exposing a more valuable piece behind it. If the king is behind it, leaving the line is not even legal.',
    },
    steps: [
      {
        kind: 'puzzle',
        fen: '4k3/5ppp/8/4q3/8/N7/5PPP/R4K2 w - - 0 1',
        text: { es: 'Pon la torre en la columna del rey: la dama queda clavada y tu rey defiende la torre.', en: 'Put your rook on the king’s file: the queen is pinned and your king guards the rook.' },
        moves: ['a1e1', 'e5e1', 'f1e1'],
      },
      {
        kind: 'puzzle',
        fen: '6k1/6pp/8/3q4/8/1P6/5PPP/5BK1 w - - 0 1',
        text: { es: 'Clava la dama en la diagonal del rey. El peón de b3 defiende a tu alfil.', en: 'Pin the queen on the king’s diagonal. The b3 pawn guards your bishop.' },
        moves: ['f1c4', 'd5c4', 'b3c4'],
      },
      {
        kind: 'puzzle',
        fen: '4k3/1p3ppp/2n5/1B6/3P4/8/5PPP/6K1 w - - 0 1',
        text: { es: 'El caballo está clavado y no puede moverse. Atácalo con un peón y luego captúralo.', en: 'The knight is pinned and cannot move. Attack it with a pawn, then take it.' },
        moves: ['d4d5', 'e8d7', 'd5c6'],
      },
    ],
  },
  {
    id: 'skewer',
    category: 'tactics',
    title: { es: 'Enfilada', en: 'Skewer' },
    intro: {
      es: 'Ataca a una pieza valiosa que, al apartarse, deja expuesta a otra detrás en la misma línea.',
      en: 'Attack a valuable piece so that, when it moves away, another piece behind it on the same line is exposed.',
    },
    steps: [
      {
        kind: 'puzzle',
        fen: '4q3/8/8/8/4k3/8/8/R5K1 w - - 0 1',
        text: { es: 'Da jaque en la columna del rey y la dama quedará detrás.', en: 'Check on the king’s file and the queen will be left behind it.' },
        moves: ['a1e1', 'e4d5', 'e1e8'],
      },
    ],
  },
  {
    id: 'discovered-attack',
    category: 'tactics',
    title: { es: 'Ataque a la descubierta', en: 'Discovered attack' },
    intro: {
      es: 'Al mover una pieza, liberas la línea de otra que estaba detrás. Si la pieza que mueves también ataca, el rival no puede atender a las dos amenazas.',
      en: 'Moving one piece opens the line of another behind it. If the moving piece also attacks, the opponent cannot meet both threats.',
    },
    steps: [
      {
        kind: 'puzzle',
        fen: 'q3k3/8/8/8/4B3/8/8/4R1K1 w - - 0 1',
        text: { es: 'Mueve el alfil para descubrir el jaque de la torre y gana la dama.', en: 'Move the bishop to uncover the rook check and win the queen.' },
        moves: ['e4a8'],
      },
    ],
  },
  {
    id: 'kq-vs-k',
    category: 'endgames',
    title: { es: 'Rey y dama contra rey', en: 'King and queen vs king' },
    intro: {
      es: 'Usa la dama para encerrar al rey contrario en una caja cada vez más pequeña, acerca tu rey y da mate en el borde. Cuidado con el ahogado.',
      en: 'Use the queen to box the enemy king into a shrinking area, bring your king closer and mate on the edge. Watch out for stalemate.',
    },
    steps: [
      {
        kind: 'practice',
        fen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1',
        text: { es: 'Da jaque mate al rey negro.', en: 'Checkmate the black king.' },
        goal: 'win',
      },
    ],
  },
  {
    id: 'kr-vs-k',
    category: 'endgames',
    title: { es: 'Rey y torre contra rey', en: 'King and rook vs king' },
    intro: {
      es: 'La torre corta al rey fila a fila. Coloca tu rey en oposición y da jaque con la torre para empujarlo hasta el borde.',
      en: 'The rook cuts the king off rank by rank. Put your king in opposition and check with the rook to push it to the edge.',
    },
    steps: [
      {
        kind: 'practice',
        fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
        text: { es: 'Da jaque mate al rey negro.', en: 'Checkmate the black king.' },
        goal: 'win',
      },
    ],
  },
  {
    id: 'two-rooks',
    category: 'endgames',
    title: { es: 'Mate de la escalera', en: 'Ladder mate' },
    intro: {
      es: 'Dos torres se turnan para dar jaque y cortar al rey, como subiendo una escalera hasta el borde.',
      en: 'Two rooks take turns checking and cutting off the king, like climbing a ladder to the edge.',
    },
    steps: [
      {
        kind: 'practice',
        fen: '8/8/8/3k4/8/8/8/R3K2R w - - 0 1',
        text: { es: 'Da jaque mate con las dos torres.', en: 'Checkmate with the two rooks.' },
        goal: 'win',
      },
    ],
  },
  {
    id: 'promote-pawn',
    category: 'endgames',
    title: { es: 'Corona el peón', en: 'Promote the pawn' },
    intro: {
      es: 'Con tu rey en la sexta fila delante del peón, la victoria está asegurada. Gana la oposición y escolta al peón hasta coronar.',
      en: 'With your king on the sixth rank in front of the pawn, the win is guaranteed. Take the opposition and escort the pawn to promotion.',
    },
    steps: [
      {
        kind: 'practice',
        fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
        text: { es: 'Corona el peón y gana la partida.', en: 'Promote the pawn and win the game.' },
        goal: 'win',
      },
    ],
  },
  // positions and answers below were checked against the Lichess 7-piece tablebase: each
  // expected move keeps the result and is the only one that does, the fastest win, or the
  // one the step's text asks for (`also` lists the other answers that are just as good)
  {
    id: 'opposition',
    category: 'endgames',
    title: { es: 'La oposición', en: 'The opposition' },
    intro: {
      es: 'Cuando los dos reyes se miran de frente con una casilla en medio, el que no tiene que mover tiene la oposición: el otro debe apartarse y cederle el paso. Quien ataca busca las casillas clave delante de su peón; quien defiende se pone enfrente.',
      en: 'When the two kings face each other with one square between them, the side that does not have to move has the opposition: the other must step aside and let it through. The attacker heads for the key squares in front of the pawn; the defender stands in the way.',
    },
    steps: [
      {
        kind: 'puzzle',
        fen: '4k3/8/2K5/8/4P3/8/8/8 w - - 0 1',
        text: {
          es: 'Las casillas clave del peón de e4 son d6, e6 y f6: si tu rey llega a una de ellas, la partida está ganada. Llega ya.',
          en: 'The key squares of the e4 pawn are d6, e6 and f6: once your king stands on one, the game is won. Get there now.',
        },
        moves: ['c6d6'],
      },
      {
        kind: 'puzzle',
        fen: '8/4k3/8/8/4PK2/8/8/8 w - - 0 1',
        text: {
          es: 'Ponte enfrente del rey negro con una casilla en medio. Así le tocará mover a él y tendrá que dejarte pasar.',
          en: 'Stand in front of the black king with one square between you. Then it is Black who must move and let you through.',
        },
        moves: ['f4e5'],
      },
      {
        kind: 'puzzle',
        fen: '8/4k3/8/8/4K3/4P3/8/8 b - - 0 1',
        text: {
          es: 'Ahora defiendes con negras. Toma tú la oposición para que el rey blanco no pueda avanzar.',
          en: 'Now you defend with Black. Take the opposition yourself so the white king cannot advance.',
        },
        moves: ['e7e6'],
      },
      {
        kind: 'practice',
        fen: '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1',
        text: {
          es: 'Defiende con negras: quédate delante del peón y recupera la oposición cada vez que el rey blanco se acerque. Aguanta 12 jugadas sin dejarle pasar.',
          en: 'Defend with Black: stay in front of the pawn and win the opposition back whenever the white king comes closer. Hold for 12 moves without letting it through.',
        },
        goal: 'draw',
        hold: 12,
      },
    ],
  },
  {
    id: 'rule-of-the-square',
    category: 'endgames',
    title: { es: 'La regla del cuadrado', en: 'The rule of the square' },
    intro: {
      es: '¿Llega tu rey a tiempo de parar un peón solo? Dibuja un cuadrado con un lado desde el peón hasta su casilla de coronación. Si tu rey puede entrar en ese cuadrado en su turno, alcanza al peón; si no puede, el peón corona.',
      en: 'Can your king catch a lone pawn in time? Picture a square whose side runs from the pawn to its promotion square. If your king can step into that square on its move, it catches the pawn; if not, the pawn queens.',
    },
    steps: [
      {
        kind: 'puzzle',
        fen: '8/8/8/8/P7/4k3/8/7K b - - 0 1',
        text: {
          es: 'Juegas con negras. El peón de a4 necesita cuatro jugadas para coronar, así que su cuadrado va de a4 a e8. Mete tu rey dentro.',
          en: 'You play Black. The a4 pawn needs four moves to queen, so its square runs from a4 to e8. Step inside it.',
        },
        moves: ['e3d4'],
        also: ['e3e4'],
      },
      {
        kind: 'puzzle',
        fen: '8/8/8/5k2/P7/8/8/K7 w - - 0 1',
        text: {
          es: 'El rey negro está fuera del cuadrado. No pierdas ni un tiempo: avanza el peón y nadie lo alcanzará.',
          en: 'The black king is outside the square. Do not lose a single tempo: push the pawn and nothing will catch it.',
        },
        moves: ['a4a5'],
      },
      {
        kind: 'practice',
        fen: '8/8/8/8/2P5/5k2/8/K7 b - - 0 1',
        text: {
          es: 'Con negras: alcanza el peón con tu rey y captúralo.',
          en: 'As Black: catch the pawn with your king and take it.',
        },
        goal: 'draw',
      },
    ],
  },
  {
    id: 'lucena',
    category: 'endgames',
    title: { es: 'La posición de Lucena', en: 'The Lucena position' },
    intro: {
      es: 'Torre y peón contra torre, con tu peón en séptima y tu rey delante de él: se gana construyendo un puente. Aleja al rey rival con un jaque, sube tu torre a la cuarta fila y saca tu rey; cuando la torre rival dé jaques, tu torre se interpondrá.',
      en: 'Rook and pawn against rook, with your pawn on the seventh and your king in front of it: you win by building a bridge. Push the enemy king away with a check, lift your rook to the fourth rank and bring your king out; when the enemy rook starts checking, your rook steps in between.',
    },
    steps: [
      {
        kind: 'puzzle',
        fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1',
        text: {
          es: 'Primero da un jaque con la torre para alejar al rey negro una columna más.',
          en: 'First check with the rook to push the black king one more file away.',
        },
        moves: ['c1d1'],
      },
      {
        kind: 'puzzle',
        fen: '1K6/1P2k3/8/8/8/8/r7/3R4 w - - 0 1',
        text: {
          es: 'Sube la torre a la cuarta fila. Ese es el puente que protegerá a tu rey de los jaques.',
          en: 'Lift the rook to the fourth rank. That is the bridge that will shield your king from the checks.',
        },
        moves: ['d1d4'],
      },
      {
        kind: 'puzzle',
        fen: '1K6/1P2k3/8/8/3R4/8/8/r7 w - - 0 1',
        text: {
          es: 'Saca el rey de delante del peón. Cuando la torre negra te dé jaque, sigue bajando hacia tu torre.',
          en: 'Bring the king out from in front of the pawn. When the black rook checks, keep walking down towards your rook.',
        },
        moves: ['b8c7', 'a1c1', 'c7b6'],
      },
      {
        kind: 'practice',
        fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1',
        text: {
          es: 'Ahora juega tú todo el plan contra el motor y corona el peón.',
          en: 'Now play the whole plan against the engine and promote the pawn.',
        },
        goal: 'promote',
      },
    ],
  },
  {
    id: 'philidor',
    category: 'endgames',
    title: { es: 'La defensa de Philidor', en: 'The Philidor defence' },
    intro: {
      es: 'Con torre contra torre y peón, la defensa de Philidor hace tablas. Mientras el peón no haya llegado a tu tercera fila, tu torre se queda en ella y no deja pasar al rey. Cuando el peón avanza, el rey rival ya no tiene dónde esconderse: tu torre se va al fondo y da jaques por detrás.',
      en: 'With rook against rook and pawn, the Philidor defence holds the draw. While the pawn has not reached your third rank, your rook stays on it and keeps the king out. Once the pawn advances, the enemy king has nowhere left to hide: your rook drops to the back and checks from behind.',
    },
    steps: [
      {
        kind: 'puzzle',
        fen: '4k3/R7/8/3KP3/8/8/8/1r6 b - - 0 1',
        text: {
          es: 'Juegas con negras. Lleva la torre a tu tercera fila (la sexta) para que el rey blanco no pueda avanzar.',
          en: 'You play Black. Put the rook on your third rank (the sixth) so the white king cannot advance.',
        },
        moves: ['b1b6'],
      },
      {
        kind: 'puzzle',
        fen: '4k3/R7/1r2P3/3K4/8/8/8/8 b - - 0 1',
        text: {
          es: 'El peón ha avanzado. Ahora lleva la torre a la primera fila: desde allí darás jaques por detrás y el rey blanco no tendrá refugio.',
          en: 'The pawn has advanced. Now take the rook to the first rank: from there you check from behind and the white king has no shelter.',
        },
        moves: ['b6b1'],
      },
    ],
  },
]

export const CATEGORIES: Lesson['category'][] = ['basics', 'checkmates', 'tactics', 'endgames']
