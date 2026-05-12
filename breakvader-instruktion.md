# Brick-Break – Claude Code-instruktion

Bygg ett komplett Breakout-inspirerat arkadspel i vanilla JavaScript som en inbäddningsbar webbmodul.
Hela spelet ska ha en **konsekvent pixelkonst-estetik**: inga rundade former, inga gradienter, inga
anti-aliasade linjer. Allt ritas i diskreta pixelblock. Känslan ska vara ett klassiskt 80-tals
arkadspel som körs på en CRT-skärm.

---

## Projektstruktur

```
brick-break/
├── brick-break.js       ← huvud-modul (ES-modul, exporterar Brick-Break.init)
├── brick-break.css      ← all styling
└── demo.html           ← demosida som visar hur modulen används
```

---

## Inbäddning (API)

```html
<link rel="stylesheet" href="brick-break.css">
<div id="game"></div>
<script type="module">
  import { Brick-Break } from './brick-break.js';
  Brick-Break.init('#game', {
    lives: 3,
    minSpeed: 150,
    maxSpeed: 420,
    speedIncrement: 4,
    shipIntervalMin: 60,
    shipIntervalMax: 120,
    brickRows: 5,
    canvasWidth: 480,
    canvasHeight: 640,
  });
</script>
```

Alla parametrar ska ha fallback-defaultvärden.

---

## Pixelkonst-principer (gäller ALLT i spelet)

- **Ingen anti-aliasing**: sätt `ctx.imageSmoothingEnabled = false` på alla canvas-kontexter
- **Ingen `arc()`** för cirklar — rita cirklar som pixelblock med en hårdkodad pixelmask (se nedan)
- **Inga `rx`/`ry` rundade hörn** — alla rektanglar är skarpa 90°-hörn
- **Ingen `fillStyle` med rgba-gradienter** — använd bara solida hex-färger
- **Pixelgrid**: alla element snappar till ett 2px-grid (d.v.s. alla x/y-koordinater är jämna tal)
- **Canvas-skala**: rita alltid på ett lågupplöst canvas (240×320 logiska pixlar) och skala upp
  2× med CSS (`width: 480px; height: 640px; image-rendering: pixelated`). Detta ger äkta "stor pixel"-känsla.
  Intern upplösning = `canvasWidth/2 × canvasHeight/2`.
- **Typsnitt**: "Press Start 2P" från Google Fonts — pixelperfekt, ingen hinting-blur

### Pixelcirkel-mask (för boll och bolliv-ikoner)
Rita cirklar med `fillRect(x, y, 1, 1)` per pixel enligt en fördefinierad offset-lista.
Exempel för radie 4 (9×9 pixlar, koordinater relativt centrum):
```js
const CIRCLE_R4 = [
  [-1,4],[0,4],[1,4],
  [-3,3],[-2,3],[2,3],[3,3],
  [-4,2],[-3,2],[3,2],[4,2],
  [-4,1],[-3,1],[3,1],[4,1],
  [-4,0],[-3,0],[3,0],[4,0],
  [-4,-1],[-3,-1],[3,-1],[4,-1],
  [-4,-2],[-3,-2],[3,-2],[4,-2],
  [-3,-3],[-2,-3],[2,-3],[3,-3],
  [-1,-4],[0,-4],[1,-4],
];
function drawPixelCircle(ctx, cx, cy, mask, color) {
  ctx.fillStyle = color;
  for (const [dx, dy] of mask) {
    ctx.fillRect(cx + dx, cy + dy, 1, 1);
  }
}
```
Använd liknande maskar för radie 3 (bolliv-ikoner) och radie 5 (bollen i spelet).

---

## Visuell design

### Canvas och bakgrund
- Intern canvas: `240 × 320` logiska pixlar
- CSS-storlek: `480 × 640` px med `image-rendering: pixelated; image-rendering: crisp-edges`
- Bakgrundsfärg: `#05050f` (nästintill svart med blå ton)
- **Scanline-effekt**: efter varje frame, rita horisontella 1px-linjer med `rgba(0,0,0,0.18)`
  varannan rad (y = 1, 3, 5, ...) — simulerar CRT-skärm
- Ram runt canvas: 2px solid `#1a1a3a` i CSS, med `box-shadow: 0 0 20px #0af3`

---

## HUD

HUD ritas direkt på spel-canvas (inte DOM). Intern höjd per HUD-rad: **18 logiska pixlar**.

### Övre HUD (y = 0–17)
- Vänster: `1P:  12345` — "Press Start 2P" 6px, färg `#ffffff`, x=4, y=5
- Höger: `HISCORE: 98765` — samma font, färg `#ffdd00`, högerkantsanpassad x=236
- Separator: 1px horisontell linje y=18, färg `#1a1a3a`

### Nedre HUD (y = 302–319)
- Separator: 1px horisontell linje y=302, färg `#1a1a3a`
- Vänster: Rita återstående liv som pixelcirklar (radie 3, mask) i `#4ac8ff`
  - Första cirkel: cx=8, cy=311; nästa: cx=18, cy=311; osv. (10px steg)
- Höger: `LEVEL 1` — "Press Start 2P" 6px, färg `#ffffff`, högerkantsanpassad x=232, y=314

### Spelyta
y = 19–301 (263 logiska pixlar hög)

---

## Brickor

- 6 brickor per rad
- Brickbredd: beräknas som `(240 - 8 - 5*2) / 6 = 37px`, höjd `9px`, gap `2px`
- Vänstermarginal: `4px`
- Första brickrad börjar på y=24 (6px under övre HUD-separator)
- **Inga rundade hörn** — skarpa `fillRect`
- Varje bricka ritas i tre steg:
  1. Fyll hela brickan med mörkare "fill"-färg
  2. Rita en 1px highlight längs övre och vänstra kanten i ljusare "stroke"-färg
  3. Rita en 1px skugga längs nedre och högra kanten i ännu mörkare färg
  — detta ger en klassisk pixelad 3D-känsla utan gradienter

| Rad | Färg    | Fill      | Highlight  | Shadow    | Poäng |
|-----|---------|-----------|------------|-----------|-------|
| 1   | Röd     | `#6b0000` | `#e74c3c`  | `#3a0000` | 40    |
| 2   | Orange  | `#6b2800` | `#e67e22`  | `#3a1500` | 30    |
| 3   | Gul     | `#6b5a00` | `#f1c40f`  | `#3a3000` | 20    |
| 4   | Grön    | `#0a3d1a` | `#27ae60`  | `#051a0d` | 10    |
| 5   | Blå     | `#0a2050` | `#3498db`  | `#050f28` | 10    |

**Träff-effekt**: brickan blinkar vit (`#ffffff`) exakt 1 frame, sedan `delete`.

**Poäng-popup**: när en bricka förstörs, spawna ett flygtextobjekt:
- Text: `+40` (eller relevant poäng)
- Font: "Press Start 2P" 5px, färg = brickans highlight-färg
- Startposition: brickans centrum
- Rörelse: `dy = -0.5 px/frame`
- Livstid: 40 frames, opacity minskar linjärt sista 15 frames
- Rita med `ctx.globalAlpha` — sätt tillbaka till 1 efteråt

---

## Paddel

- Bredd: 40 logiska pixlar (minskar med 2px per nivå, min 24px)
- Höjd: 5 logiska pixlar
- Placering: y = 288 (14px ovanför nedre HUD-separator)
- **Skarpa hörn** — bara `fillRect`
- Ritas i tre horisontella band:
  - Övre 1px: `#5dade2` (highlight)
  - Mellersta 3px: `#2980b9` (main)
  - Nedre 1px: `#1a5276` (shadow)
- Rörelse med acceleration/friktion: `vx += input * 2.5`, `vx *= 0.78` per frame (i logiska px)
- Stannar vid x=0 och x=240-paddelbredd

---

## Boll

- Radie: 3 logiska pixlar (rita med pixelcirkel-mask radie 3)
- Pixelmask radie 3:
```js
const CIRCLE_R3 = [
  [-1,3],[0,3],[1,3],
  [-2,2],[-1,2],[1,2],[2,2],
  [-3,1],[-2,1],[2,1],[3,1],
  [-3,0],[3,0],
  [-3,-1],[-2,-1],[2,-1],[3,-1],
  [-2,-2],[-1,-2],[1,-2],[2,-2],
  [-1,-3],[0,-3],[1,-3],
];
```
- Huvudfärg: `#4ac8ff`
- Highlight: 1 pixel offset (-1,-1) från centrum i `#ffffff`
- **Boll-trail**: spara de 5 senaste centrumpositionerna. Rita dem baklänges med:
  - globalAlpha: 0.5, 0.3, 0.2, 0.1, 0.05
  - Radie: 2, 2, 1, 1, 1 (alltid pixelmask, aldrig arc)
  - Färg: `#2a88bf`
- Starthastighet: `minSpeed` i pixlar/sekund (logiska pixlar)
- Startposition: centrum av spelplanen, riktning ±25–45° från rakt upp (slumpmässigt)
- Hastigheten ökar med `speedIncrement` px/s var 5:e sekund

### Studslogik
- Vänster/höger vägg: spegla vx
- Tak (y=19): spegla vy
- Paddel: `angle = (hitOffset / halfPaddleWidth) * 55°`, konvertera till vx/vy, bevara fart
- Bricka: spegla vy (eller vx om sidoträff) — avgör med minsta överlapp (SAT-liknande)
- Passerar under y=302: liv förloras

---

## Rymdskepp

Skeppet ritas **helt i pixelkonst** med `fillRect`-calls enligt en sprite-definition.

### Sprite (19×9 logiska pixlar, förankrad i övre vänstra hörnet)
Rita pixel för pixel med exakta koordinater. Färgkoder:
- `D` = mörk kropp `#1a1a3a`
- `B` = blå kropp `#223366`
- `L` = ljus kant `#9999ff`
- `G` = glas/kupol `#aaddff`
- `P` = lampor (pulserande) `#ff44cc`
- `.` = genomskinlig (rita ej)

```
Pixel-layout (rad för rad, 19 bred × 9 hög):
rad 0: . . . . . . . G G G G G . . . . . . .
rad 1: . . . . . . G G G G G G G . . . . . .
rad 2: . . . L L B B B B B B B B B B L L . .
rad 3: . L L B B B B B B B B B B B B B B L .
rad 4: L B B B B B B B B B B B B B B B B B L   ← bredaste rad
rad 5: L L B B B B B B B B B B B B B B B L L
rad 6: . . L L D D D D D D D D D D D L L . .
rad 7: . . . . . P . P . P . P . P . . . . .   ← lampor
rad 8: . . . . . . . . . . . . . . . . . . .
```

Lamporna på rad 7 (`P`) pulsar: växla mellan `#ff44cc` och `#aa2288` varannan 20:e frame.

- Placering: y = 22 (4px under övre HUD-separator), x animeras
- Flyghastighet: 60 logiska px/s
- Riktning: slumpmässigt höger→vänster eller vänster→höger (sprite speglas horisontellt vid v.→h.)
- Skeppet är aktivt tills det lämnat spelplanen eller träffats

### Träff-kollision
AABB mot bollens boundingbox (6×6 runt bollcentrum mot skeppets 19×7 aktiva area).

---

## Pixelexplosion (rymdskepp förstört)

**Inga partiklar med arc()** — varje partikel är ett pixelblock (1×1 eller 2×2 `fillRect`).

Spawna **24 pixelpartiklar** vid skeppets centrum:
```js
function spawnExplosion(cx, cy) {
  const colors = ['#ff8800','#ffdd00','#ff4400','#ffffff','#ff44cc','#9999ff'];
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const speed = 15 + Math.random() * 40;  // logiska px/s
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() < 0.5 ? 1 : 2,   // 1×1 eller 2×2 pixelblock
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1.0,
      decay: 0.6 + Math.random() * 0.8,    // per sekund
    });
  }
}
```

Varje frame per partikel:
```js
p.x += p.vx * dt;
p.y += p.vy * dt;
p.vy += 30 * dt;   // pixelgravitation nedåt
p.life -= p.decay * dt;
if (p.life > 0) {
  ctx.globalAlpha = Math.max(0, p.life);
  ctx.fillStyle = p.color;
  ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
}
```
Sätt `ctx.globalAlpha = 1` efter alla partiklar.

---

## Poängsystem och hiscore

- Poäng och hiscore visas i HUD med "Press Start 2P" 6px
- Hiscore lagras i `sessionStorage` — nollställs vid fönsterstängning
- Uppdatera hiscore i realtid om aktuell poäng slår den
- Visa alltid 5 siffror med nollpadding: `String(score).padStart(5, '0')`

---

## Spelflöde

```
IDLE → PLAYING → LIFE_LOST → PLAYING  (nytt liv)
                            → GAME_OVER (inga liv kvar)
PLAYING → LEVEL_COMPLETE → PLAYING (ny nivå, nya brickor)
```

### IDLE
- Svart bakgrund med scanlines
- `BRICK BREAK` i "Press Start 2P" 10px, vit, centrerat på y=120
- `PRESS SPACE` blinkande (toggle var 30:e frame), 6px, `#ffdd00`, y=160
- `TO START` samma stil, y=172

### LIFE_LOST
- Boll blinkar vit/röd 8 gånger (4 frames per blink) → försvinner
- 60 frames paus
- Ny boll placeras i centrum, väntar på SPACE

### LEVEL_COMPLETE
- Rita `LEVEL` centrerat 8px vit, `CLEAR!` i `#ffdd00` under
- 90 frames, sedan ny nivå

### GAME_OVER
- `GAME OVER` 10px röd `#e74c3c` centrerat
- Poäng och hiscore under i 6px
- `PRESS SPACE` blinkande

---

## Tekniska krav

- Vanilla JavaScript, ES-modul, noll beroenden (utom Google Fonts)
- `export const Brick-Break = { init, destroy }`
- Spelloop: `requestAnimationFrame` + delta-time i sekunder
- **Intern canvas**: `240×320`, skalad 2× via CSS med `image-rendering: pixelated`
- `ctx.imageSmoothingEnabled = false` — obligatoriskt på alla canvas-kontexter
- Kollision: AABB för brickor/paddel/skepp; 6×6 boundingbox för boll
- Tangentbordslyssnare på `document`, städas vid `destroy()`
- Responsivt: om container < 480px, skala CSS proportionerligt med `max-width: 100%`

---

## demo.html

- Bakgrund `#0a0a0f`
- Spelet centrerat vertikalt och horisontellt på sidan
- Rubrik `BRICK BREAK` i "Press Start 2P" 16px, `#ffffff`, ovanför canvas
- Instruktioner under: `← → MOVE   SPACE START/LAUNCH` i 8px `#555566`
- Ladda Google Fonts, brick-break.css, initiera brick-break.js

---

## Konfigurationsöversikt

| Parameter          | Default | Beskrivning                              |
|--------------------|---------|------------------------------------------|
| `lives`            | 3       | Antal bollar/liv                         |
| `minSpeed`         | 150     | Startfart i logiska px/s                 |
| `maxSpeed`         | 420     | Maxfart i logiska px/s                   |
| `speedIncrement`   | 4       | px/s ökning var 5:e sekund               |
| `shipIntervalMin`  | 60      | Minsta sekunder mellan rymdskepp         |
| `shipIntervalMax`  | 120     | Högsta sekunder mellan rymdskepp         |
| `brickRows`        | 5       | Antal brickorader (1–8)                  |
| `canvasWidth`      | 480     | CSS-bredd (intern = hälften)             |
| `canvasHeight`     | 640     | CSS-höjd (intern = hälften)              |
