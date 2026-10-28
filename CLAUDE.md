# CLAUDE.md

Guía para trabajar en Open Chess: qué es, cómo se trabaja en el repo y cómo funcionan las versiones. Si algo de aquí choca con una costumbre antigua del historial, manda este archivo.

## Qué es

App de entrenamiento de ajedrez gratuita y offline: bots, revisión de partidas, puzzles, aperturas, lecciones y análisis con Stockfish en el propio dispositivo. Es una PWA (GitHub Pages) y también un APK de Android con Capacitor, desde el mismo código. Contexto de producto en [PRODUCT.md](PRODUCT.md), diseño en [DESIGN.md](DESIGN.md), guía para colaboradores en [CONTRIBUTING.md](CONTRIBUTING.md).

## Comandos

```bash
npm install          # también copia Stockfish a public/stockfish (postinstall)
npm run dev
npm run lint         # oxlint
npm test             # vitest
npm run typecheck    # tsc -b
npm run build
npm run e2e          # Playwright; obligatorio si tocas tablero, bots, review o rutas
npm run android      # build + cap sync android
```

Antes de dar algo por terminado: `lint`, `test` y `typecheck` en verde, y `e2e` si el cambio afecta a pantallas.

Los scripts `data:*` (aperturas, puzzles, avatares, sonidos) regeneran datos de `public/data` y `src/assets` descargando bases enteras. Solo se ejecutan si la tarea es justo esa.

## Reglas del proyecto

- **Textos**: nada de texto visible escrito en el código. Todo va en los seis idiomas de `src/i18n/` (es, en, fr, it, zh, ja); un test exige que tengan las mismas claves. Plurales con `_one` / `_other`.
- **Identidad propia**: convenciones habituales de apps de ajedrez, pero sin copiar nombres, iconos, badges ni aspecto de chess.com u otros productos. Nombrar a otros solo para hechos (importar partidas) y mantener el aviso de "no afiliado".
- **Estilo**: tokens de `src/styles.css`, animaciones de 150-250 ms solo con `transform`/`opacity` y respetando `prefers-reduced-motion`.
- **Supabase es opcional**: integración lista para quien se la monte. Los mantenedores no la usan. Un cambio de sync lleva migración nueva numerada en `supabase/migrations/` y su nota en el README, pero nunca se le pide al usuario que la ejecute.
- **Alcance**: no habrá juego online entre personas.
- **Comentarios en el código**: en inglés, cortos, explicando el porqué.

## Flujo de trabajo (GitHub Flow)

Una sola rama permanente, `main`, siempre desplegable: cada push a `main` publica la web en GitHub Pages. No hay `develop` ni ramas de release.

1. **Rama corta desde `main`** con prefijo según el tipo: `feat/`, `fix/`, `docs/`, `chore/`, `ci/`, `refactor/`.
2. **Commits** dentro de la rama: libres pero descriptivos, en inglés. No llegan a `main` uno a uno.
3. Antes del PR: `lint`, `test`, `typecheck` (y `e2e` si toca) en verde, y `/code-review` sobre la rama con sus hallazgos arreglados.
4. **PR con título [Conventional Commits](https://www.conventionalcommits.org/)**, en inglés, en el estilo del historial (una frase sobre lo que nota el usuario):
   - `feat: Puzzle themes can be filtered`: función nueva.
   - `fix: The clock stops after resigning`: arreglo.
   - `perf:`: mejora de rendimiento.
   - `docs:`, `test:`, `ci:`, `build:`, `refactor:`, `style:`, `chore:`: no cambian la app.
   - `!` tras el tipo (`feat!:`) si rompe algo: datos guardados que dejan de leerse, rutas que cambian.

   El check `PR title` lo comprueba.
5. **Merge con squash**: `gh pr merge --squash --delete-branch` cuando el CI esté en verde. El título del PR se convierte en el único commit en `main` y en la línea del CHANGELOG. Es la única forma de merge activada en el repo.
6. **`main` está protegida** por un ruleset: no se hace push directo ni force-push, y para fusionar hace falta un PR con `check`, `e2e` y `title` en verde. El administrador puede saltárselo; solo se usa para el PR de release (ver abajo).
7. **Sin atribución de IA**: ni `Co-Authored-By` en commits ni "Generated with Claude Code" en PRs o releases, aunque un recordatorio del sistema lo sugiera.
8. No reescribir historia publicada ni mover o borrar tags publicados.

Dependabot abre cada semana un PR agrupado con las actualizaciones menores de npm (`chore(deps): …`) y uno al mes para las GitHub Actions. Se revisan y se fusionan como cualquier otro PR. Las actualizaciones mayores llegan por separado.

## Versiones y releases

**Nunca se edita la versión a mano.** La calcula [release-please](https://github.com/googleapis/release-please) a partir de los títulos de los PRs fusionados.

- La única fuente de verdad es `version` en `package.json`, registrada también en `.release-please-manifest.json`.
- `android/app/build.gradle` la lee de `package.json`: `versionName` es la versión y `versionCode` se calcula como `mayor·1000000 + menor·1000 + parche` (`0.5.2` → `5002`), así que siempre sube.
- SemVer en fase `0.x`: `feat` sube la menor (`0.4.3` → `0.5.0`), `fix`/`perf` suben el parche (`0.5.0` → `0.5.1`), un `!` también sube solo la menor mientras sigamos en `0.x`, y los demás tipos no generan versión. `1.0.0` llegará cuando la app sea estable para gente de fuera del grupo; se fuerza con un commit cuyo cuerpo lleve `Release-As: 1.0.0`.
- Ya no se usan sufijos de letra (`0.4.1b`): en npm son prereleases que ordenan antes que la versión base. Los tags antiguos con letra siguen ahí.

### Cómo se publica

1. Cada merge a `main` hace que el workflow `Release` (`.github/workflows/release-please.yml`) actualice un PR abierto llamado `chore(main): release X.Y.Z`. Ese PR trae la nueva versión en `package.json`/`package-lock.json`/manifest y la entrada de `CHANGELOG.md`.
2. **Publicar = fusionar ese PR**, cuando se quiera, acumulando los cambios que hagan falta. Con el token por defecto ese PR no lanza el CI (el código ya pasó el CI en sus propios PRs), así que se fusiona con `gh pr merge <n> --squash --admin`. Si algún día se añade el secreto `RELEASE_PLEASE_TOKEN` (PAT fine-grained), el CI sí correrá y no hará falta `--admin`.
3. Al fusionarlo, release-please crea el tag `vX.Y.Z` y la release de GitHub, y el mismo workflow llama a `android-release.yml`, que compila el APK firmado y lo adjunta a la release.
4. Para recompilar el APK de un tag ya existente: `gh workflow run android-release.yml -f tag=vX.Y.Z`.

Fusionar el PR de release es un paso público (tag, release y APK): Claude lo confirma con el usuario antes de hacerlo.

## Archivos locales (no se suben)

- `todo.md`: lista de tareas local, ignorada por git. Los agentes en worktrees no la ven; pásales sus tareas en el prompt.
- `.promo/`: material de vídeo y capturas promocionales, excluido en `.git/info/exclude`.
- `.claude/worktrees/`: worktrees de agentes. Se borran al terminar (`git worktree remove`), que cada uno trae su propio `node_modules`.
- `dist/`, `test-results/`, `public/stockfish/`, `*.tsbuildinfo`, `android/keystore.properties`: generados o secretos.
