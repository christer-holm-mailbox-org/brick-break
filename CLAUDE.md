# Brick Break — Projektkontext

## Vad projektet är
Breakout-inspirerat arkadspel i vanilla JavaScript med strikt pixel-art-estetik.
Fristående, embedderbar webbmodul (inga globala variabler, modulscoped state).

## Teknikstack
- **Spelmotor**: Vanilla JS (ES2022-moduler), HTML5 Canvas 2D
- **Rendering**: 240×320 logiska pixlar, 2× CSS-skalning → 480×640 px
- **Databas**: Supabase (PostgreSQL), tabell `hiscores`
- **Backend**: Supabase Edge Function (Deno/TypeScript) — `submit-score`
- **Build**: esbuild + javascript-obfuscator → `dist/`
- **Lint**: ESLint v9 (flat config), GitHub Actions auto-lint

## Viktiga filer
- `brick-break.js` — Huvud-spelmotor (~1 500 rader)
- `config.js` — Spelkonfiguration + Supabase-hemligheter
- `maps/manifest.json` — Lista på 10 banfiler (ASCII-format, 10×10)
- `supabase/functions/submit-score/index.ts` — Edge Function med HMAC-validering

## Arkitektoniska beslut
- All spelstatus är modulscoped — inga globala variabler
- Explicit tillståndsmaskin: ATTRACT → PLAYING → GAME_OVER → NAME_ENTRY etc.
- Hiscore skyddas med HMAC-SHA256 (klient genererar token, server verifierar)
- Lokal fallback via `sessionStorage` om Supabase inte nås
- Banfiler laddas async via `fetch()` — blockerar inte spelstart

## Estetiska regler
- Strikt pixel-art: ingen anti-aliasing, inga gradienter, inga kurvor
- Pixelsnapping: alla positioner avrundas till 2 px-grid
- Font: Press Start 2P

## Minneshantering i det här projektet
- **CLAUDE.md** (den här filen): portabel projektköntext, följer med git
- **Globalt minne** (`~/.claude/projects/d--VCS-brick-break/memory/`): feedback, temporär projektinfo, saker som inte passar i repot
