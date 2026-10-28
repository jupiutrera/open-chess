type L10n = { es: string; en: string }

export type LessonStep =
  | {
      kind: 'puzzle'
      fen: string
      text: L10n
      /** UCI: solver move, scripted reply, solver move… (any mate counts on the last move) */
      moves: string[]
    }
  | {
      kind: 'practice'
      fen: string
      text: L10n
      goal: 'win' | 'draw'
      /** engine strength for the defending side */
      elo?: number
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
]

export const CATEGORIES: Lesson['category'][] = ['basics', 'checkmates', 'tactics', 'endgames']
