# Contribuir a Open Chess

¡Gracias por querer ayudar! Algunas pautas para que tu PR entre rápido.

## Antes de empezar

- Abre una issue si el cambio es grande (una sección nueva, un cambio en la clasificación de jugadas…) para comentarlo primero.
- La app no tendrá juego online entre personas. Es una decisión de alcance, no un olvido.

## Desarrollo

```bash
npm install
npm run dev
npm test        # tiene que pasar
npm run lint    # tiene que pasar (oxlint)
npm run e2e     # recomendable si tocas el tablero, los bots o la revisión
npm run typecheck
```

Cada PR pasa por el CI: lint, tests unitarios, build y los tests de Playwright. Si falla, revisa el informe que se adjunta al job.

## Ideas que encajan bien

- **Lecciones nuevas**: añádelas en `src/features/lessons/lessonData.ts`. Cada paso es un ejercicio (FEN y jugadas UCI) o una práctica contra el motor. El test `lessonData.test.ts` comprueba que todas las jugadas son legales y que los mates son mates.
- **Bots**: personalidad, aperturas favoritas y estilo en `src/features/play/bots.ts`.
- **Traducciones**: `src/i18n/*.json` para la interfaz y `src/i18n/content/*.json` para lecciones y bots. Para añadir un idioma, crea los dos archivos, añade el código a `LANGS` y `LANG_NAMES` en `src/settings.ts`, su carga a `lazyLangs` en `src/i18n/index.ts` y su contenido a `src/i18n/content.ts`. Los idiomas que no son español ni inglés se descargan solo cuando alguien los elige.
- **Clasificación de jugadas**: `src/features/review/classify.ts`, con sus tests.

## Estilo

- TypeScript estricto, componentes funcionales y Tailwind con los tokens de `src/styles.css` (consulta [DESIGN.md](DESIGN.md)).
- La interfaz sigue las convenciones de chess.com: si algo existe allí, debería sentirse igual aquí.
- Los textos visibles van siempre en los seis archivos de `src/i18n/` (un test comprueba que tengan las mismas claves), nunca escritos directamente en el código. Para cantidades usa las formas `_one` / `_other` de i18next.
- Animaciones cortas (150-250 ms), solo con `transform` y `opacity`, y respetando `prefers-reduced-motion`.

## Licencia

Al contribuir aceptas que tu código se publique bajo GPL-3.0-or-later.
