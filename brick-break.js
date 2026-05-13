/**
 * brick-break.js – Huvud-modul för Brick Break
 *
 * Breakout-inspirerat arkadspel med strikt pixelkonst-estetik.
 * Inga rundade former, inga gradienter, ingen anti-aliasing.
 * Intern canvas: 240×320 logiska pixlar, skalad 2× via CSS.
 *
 * Spellägen:
 *   ATTRACT_TITLE → PLAYING (demo, AI) → ATTRACT_HISCORE → (loop)
 *   SPACE under attract → PLAYING (riktig spelare)
 *
 * Användning:
 *   import { BrickBreak } from './brick-break.js';
 *   BrickBreak.init('#game', { lives: 3 });
 */

import { DEFAULT_CONFIG, META_CONFIG, SUPABASE_CONFIG } from './config.js';

// ── Publik API ────────────────────────────────────────────────────────────────
export const BrickBreak = { init, destroy, loadMaps };

// ── Spelkonstanter ────────────────────────────────────────────────────────────
const W = 240;    // intern canvas-bredd (logiska pixlar)
const H = 320;    // intern canvas-höjd

const HUD_TOP     = 18;   // y för övre HUD-separator
const HUD_BOT     = 302;  // y för nedre HUD-separator
const PLAY_TOP    = 19;   // spelytans överkant
const PLAY_BOT    = 301;  // spelytans underkant
const PADDLE_Y    = 288;  // paddelns överkant-y

const BRICK_COLS    = 10;
const BRICK_W       = 21;  // (240 - 2×6 marginal - 9×2 gap) / 10 = 21px
const BRICK_H       = 9;
const BRICK_GAP     = 2;
const BRICK_LEFT    = 6;   // centrerar de 10 brickorna: (240-228)/2 = 6px
const BRICK_START_Y = 42;  // skeppet flyger på y=22–30, brickorna börjar efter

// Bricktyper – nyckel = ASCII-tecken i kartfiler
// hits: Infinity = oförstörbar (permanent)
const BRICK_TYPES = {
  G: { fill: '#0a3d1a', highlight: '#27ae60', shadow: '#051a0d', points: 10, hits: 1 },  // Grön
  Y: { fill: '#6b5a00', highlight: '#f1c40f', shadow: '#3a3000', points: 15, hits: 1 },  // Gul
  O: { fill: '#6b2800', highlight: '#e67e22', shadow: '#3a1500', points: 20, hits: 1 },  // Orange
  R: { fill: '#6b0000', highlight: '#e74c3c', shadow: '#3a0000', points: 25, hits: 1 },  // Röd
  L: { fill: '#2a0a50', highlight: '#9b59b6', shadow: '#150528', points: 30, hits: 1 },  // Lila
  B: { fill: '#0a2050', highlight: '#3498db', shadow: '#050f28', points: 35, hits: 1 },  // Blå
  P: { fill: '#5a0a38', highlight: '#ff44cc', shadow: '#2a0518', points: 40, hits: 1 },  // Rosa
  V: { fill: '#383848', highlight: '#f0f0f8', shadow: '#18182a', points: 45, hits: 1 },  // Vit
  H: { fill: '#2a2a3a', highlight: '#888899', shadow: '#111120', points: 50, hits: 2 },  // Hard – mörkgrå, tål 2 träffar
  X: { fill: '#3d2e00', highlight: '#ffd700', shadow: '#1a1400', points:  0, hits: Infinity },  // Permanent – guld, oförstörbar
};

// Standardordning på typer vid automatisk radgenerering (utan kartfil)
const DEFAULT_ROW_TYPES = ['G', 'Y', 'O', 'R', 'L', 'B'];

// Tangentgrid för namninmatning – tre rader med bokstäver + specialtangenter
const NAME_GRID = [
  ['A','B','C','D','E','F','G','H','I','J'],
  ['K','L','M','N','O','P','Q','R','S','T'],
  ['U','V','W','X','Y','Z','RUB','END'],
];
const NE_KEY_W   = 20;   // standardbredd för en bokstavstangent (px)
const NE_KEY_H   = 12;   // höjd för alla tangenter (px)
const NE_KEY_GAP =  2;   // mellanrum mellan tangenter (px)
const NE_WIDE_W  = 42;   // bredd för RUB/END – exakt 2 tangenter + 1 gap
const NE_START_X = 11;   // vänster startpunkt; centrerar 218px i 240px canvas
const NE_ROW_Y   = [112, 126, 140];  // y-position (överkant) per tangentrad
const NE_TIMER   = 30;   // sekunder att ange initialer

// Pixelcirkel-maskar (koordinater relativt centrum) – aldrig arc()
const CIRCLE_R3 = [
  [-1,3],[0,3],[1,3],
  [-2,2],[-1,2],[1,2],[2,2],
  [-3,1],[-2,1],[2,1],[3,1],
  [-3,0],[3,0],
  [-3,-1],[-2,-1],[2,-1],[3,-1],
  [-2,-2],[-1,-2],[1,-2],[2,-2],
  [-1,-3],[0,-3],[1,-3],
];
const CIRCLE_R2 = [
  [-1,2],[0,2],[1,2],
  [-2,1],[-1,1],[1,1],[2,1],
  [-2,0],[2,0],
  [-2,-1],[-1,-1],[1,-1],[2,-1],
  [-1,-2],[0,-2],[1,-2],
];
const CIRCLE_R1 = [
  [0,1],[-1,0],[1,0],[0,-1],
];

// Rymdskepp sprite – rad för rad, tecken → palett-nyckel ('.' = transparent)
const SHIP_PALETTE = {
  D: '#1a1a3a',
  B: '#223366',
  L: '#9999ff',
  G: '#aaddff',
  P: '#ff44cc',
};
const SHIP_ROWS = [
  ['.','.','.','.','.','.','.','G','G','G','G','G','.','.','.','.','.','.','.'],
  ['.','.','.','.','.','.','G','G','G','G','G','G','G','.','.','.','.','.','.'],
  ['.','.','.','.','L','L','B','B','B','B','B','B','B','B','B','L','L','.','.'],
  ['.','.','.','L','L','B','B','B','B','B','B','B','B','B','B','B','B','L','.'],
  ['L','B','B','B','B','B','B','B','B','B','B','B','B','B','B','B','B','B','L'],
  ['L','L','B','B','B','B','B','B','B','B','B','B','B','B','B','B','B','L','L'],
  ['.','.','L','L','D','D','D','D','D','D','D','D','D','D','D','L','L','.','.'],
  ['.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
  ['.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
];
const LAMP_COLS = [5, 7, 9, 11, 13];  // x-index för lampor på rad 7

// Fiktiva hiscores som sås in vid första session
const INITIAL_HISCORES = [
  { name: 'ACE', score: 840 },
  { name: 'ZAP', score: 720 },
  { name: 'MAX', score: 560 },
  { name: 'REX', score: 430 },
  { name: 'JET', score: 310 },
];

// ── Modulscoped state ─────────────────────────────────────────────────────────
let canvas, ctx, animFrameId, config;

// Spelläge
let state;         // 'ATTRACT_TITLE'|'ATTRACT_HISCORE'|'PLAYING'|'LIFE_LOST'|'LEVEL_COMPLETE'|'GAME_OVER'|'ALL_CLEAR'|'NAME_ENTRY'
let isDemoMode;    // true = AI styr paddeln (attract-demo)
let attractTimer;  // sekunder kvar på aktuell attract-skärm

// Speldata
let score, hiscore, level, lives;
let paddle;        // { x, vx, width }
let ball;          // { x, y, vx, vy, trail[], flashFrames, flashCount }
let bricks;        // [{ x, y, row, flash, alive }]
let particles;     // explosionspartiklar
let popups;        // flygtextpoäng
let ship;          // null | { x, y, vx, flip }
let hiscores;      // [{ name, score }] – top 5

// Timers och räknare
let shipTimer, paddleShrinkTimer, brickHitCount, frameCount, pauseTimer, ballLaunch;

// Bollhastighet – stiger med varje ny karta, återställs till detta värde vid bollförlust
let currentMinSpeed;
let ballLaunchTimer;  // sekunder kvar innan bollen startar automatiskt

// Input
let keys, spaceConsumed;
let keydownHandler, keyupHandler;
let mouseMoveHandler, mouseLeaveHandler, mouseClickHandler;
let mouseX = null;  // null = ingen aktiv musinput, annars logisk x-koordinat

// Attract-animationer
let attractBricks;  // fallande brickor på titelskärmen

// Laddade kartdata – varje element är ett 2D-array av typtecken
let loadedMaps = [];

// Supabase-statistik – skickas med poänginlämning för server-side fuskkontroll
let bricksDestroyedCount;  // totalt förstörda brickor under spelomgången
let gameStartTime;          // tidsstämpel (ms) då spelomgången startade
let scoreSaved;             // förhindrar dubbel poänginsändning per omgång

// Namninmatning – aktiv under tillståndet NAME_ENTRY
let nameEntryChars;      // inmatade tecken, max 3
let nameEntryTimer;      // nedräkning i sekunder (0 → avbryt utan att spara)
let nameEntryCursorRow;  // markerad rad i tangentgriddet (0–2)
let nameEntryCursorCol;  // markerad kolumn i tangentgriddet

// ── Init & destroy ────────────────────────────────────────────────────────────

function init(selector, options = {}) {
  if (META_CONFIG.debug) console.log(`[BrickBreak v${META_CONFIG.version}] init`, options);

  config = { ...DEFAULT_CONFIG, ...options };

  const container = document.querySelector(selector);
  if (!container) {
    console.error(`[BrickBreak] Hittade inget element för selector: ${selector}`);
    return;
  }

  canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  container.appendChild(canvas);

  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;  // avgörande – aldrig suddig pixelkonst

  frameCount = 0;  // måste initieras innan första render-anropet
  setupInput();
  initHiscores();
  initAttractBricks();
  startAttractTitle();

  // Hämta maps/manifest.json automatiskt – laddas asynkront utan att blockera spelet
  fetch('maps/manifest.json')
    .then(r => r.ok ? r.json() : [])
    .then(files => files.length > 0 ? loadMaps(files.map(f => `maps/${f}`)) : null)
    .catch(() => {});

  animFrameId = requestAnimationFrame(loop);
}

function destroy() {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId);
  document.removeEventListener('keydown', keydownHandler);
  document.removeEventListener('keyup',   keyupHandler);
  if (canvas) {
    canvas.removeEventListener('mousemove',  mouseMoveHandler);
    canvas.removeEventListener('mouseleave', mouseLeaveHandler);
    canvas.removeEventListener('click',      mouseClickHandler);
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
  canvas = ctx = animFrameId = null;
}

// ── Input ─────────────────────────────────────────────────────────────────────

function setupInput() {
  keys = { left: false, right: false, space: false };
  spaceConsumed = false;

  keydownHandler = (e) => {
    // ── Namninmatning – fångar alla relevanta tangenter ──────────────────────────
    if (state === 'NAME_ENTRY') {
      const nav = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter','Backspace'];
      if (nav.includes(e.key) || /^[A-Za-z]$/.test(e.key)) e.preventDefault();
      if (e.key === 'Backspace')       { selectNameKey('RUB'); return; }
      if (e.key === 'Enter')           { selectNameKey('END'); return; }
      if (/^[A-Za-z]$/.test(e.key))   { selectNameKey(e.key.toUpperCase()); return; }
      if (e.key === 'ArrowLeft')       { nameEntryCursorCol = Math.max(0, nameEntryCursorCol - 1); return; }
      if (e.key === 'ArrowRight')      { nameEntryCursorCol = Math.min(NAME_GRID[nameEntryCursorRow].length - 1, nameEntryCursorCol + 1); return; }
      if (e.key === 'ArrowUp')         { nameEntryCursorRow = Math.max(0, nameEntryCursorRow - 1); nameEntryCursorCol = Math.min(nameEntryCursorCol, NAME_GRID[nameEntryCursorRow].length - 1); return; }
      if (e.key === 'ArrowDown')       { nameEntryCursorRow = Math.min(NAME_GRID.length - 1, nameEntryCursorRow + 1); nameEntryCursorCol = Math.min(nameEntryCursorCol, NAME_GRID[nameEntryCursorRow].length - 1); return; }
      if (e.key === ' ')               { selectNameKey(NAME_GRID[nameEntryCursorRow][nameEntryCursorCol]); return; }
      return;
    }

    if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === ' ') {
      e.preventDefault();
      if (state === 'ATTRACT_TITLE' || state === 'ATTRACT_HISCORE' || isDemoMode) {
        startRealGame(); return;
      }
      if (state === 'ALL_CLEAR') { if (score > 0) startNameEntry(); else startAttractTitle(); return; }
      if (state === 'PAUSED') { resumeGame(); return; }
      // Pausa endast när bollen är i rörelse (inte vid ballLaunch-läget)
      if (state === 'PLAYING' && !ballLaunch) { pauseGame(); return; }
      keys.space = true;
    }
  };

  keyupHandler = (e) => {
    if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === ' ') { keys.space = false; spaceConsumed = false; }
  };

  document.addEventListener('keydown', keydownHandler);
  document.addEventListener('keyup',   keyupHandler);

  // Mus: paddeln följer muspekaren, eller uppdaterar cursor i namninmatning
  mouseMoveHandler = (e) => {
    const rect = canvas.getBoundingClientRect();
    const lx   = (e.clientX - rect.left) * (W / rect.width);   // skalkonvertering CSS→logisk
    const ly   = (e.clientY - rect.top)  * (H / rect.height);
    if (state === 'NAME_ENTRY') {
      const hit = getNameKeyAt(lx, ly);
      if (hit) { nameEntryCursorRow = hit.row; nameEntryCursorCol = hit.col; }
      mouseX = null;  // paddeln ska inte röra sig under namninmatning
    } else {
      mouseX = lx;
    }
  };

  // När musen lämnar canvas – återgå till tangentbordsstyrning
  mouseLeaveHandler = () => { mouseX = null; };

  // Klick: starta boll, pausa/fortsätt, starta spel, eller välj tangent vid namninmatning
  mouseClickHandler = (e) => {
    e.stopPropagation();  // förhindrar att expand-klick triggas av spelet
    if (state === 'NAME_ENTRY') {
      const rect = canvas.getBoundingClientRect();
      const mx   = (e.clientX - rect.left) * (W / rect.width);
      const my   = (e.clientY - rect.top)  * (H / rect.height);
      const hit  = getNameKeyAt(mx, my);
      if (hit) selectNameKey(NAME_GRID[hit.row][hit.col]);
      return;
    }
    if (state === 'ATTRACT_TITLE' || state === 'ATTRACT_HISCORE' || isDemoMode) {
      startRealGame(); return;
    }
    if (state === 'GAME_OVER')              { if (score > 0) startNameEntry(); else startAttractTitle(); return; }
    if (state === 'ALL_CLEAR')              { if (score > 0) startNameEntry(); else startAttractTitle(); return; }
    if (state === 'PAUSED')                 { resumeGame();       return; }
    if (state === 'PLAYING' && ballLaunch)  { ballLaunch = false; return; }
    if (state === 'PLAYING' && !ballLaunch) { pauseGame();        return; }
  };

  canvas.addEventListener('mousemove',  mouseMoveHandler);
  canvas.addEventListener('mouseleave', mouseLeaveHandler);
  canvas.addEventListener('click',      mouseClickHandler);
}

// ── Hiscore ───────────────────────────────────────────────────────────────────

function initHiscores() {
  const stored = sessionStorage.getItem('bb_scores');
  hiscores = stored ? JSON.parse(stored) : INITIAL_HISCORES.map(e => ({ ...e }));
  hiscore  = hiscores[0]?.score || 0;

  // Hämta aktuell top-10 från databasen asynkront – uppdaterar utan att blockera spelstart
  fetch(
    `${SUPABASE_CONFIG.url}/rest/v1/hiscores?select=name,score&order=score.desc&limit=10`,
    { headers: { apikey: SUPABASE_CONFIG.anon, Authorization: `Bearer ${SUPABASE_CONFIG.anon}` } },
  )
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && data.length > 0) {
        hiscores = data;
        hiscore  = hiscores[0]?.score || 0;
        sessionStorage.setItem('bb_scores', JSON.stringify(hiscores));
      }
    })
    .catch(() => {});
}

// Sparar spelarens slutpoäng – skickar till Supabase, faller tillbaka på lokal session
async function saveCurrentScore(name = 'YOU') {
  if (score === 0 || scoreSaved) return;
  scoreSaved = true;

  const timePlayed = Math.round((Date.now() - gameStartTime) / 1000);

  try {
    const token = await computeToken(score, bricksDestroyedCount);
    const resp  = await fetch(SUPABASE_CONFIG.fnUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SUPABASE_CONFIG.anon}`,
      },
      body: JSON.stringify({
        name,
        score,
        bricksDestroyed: bricksDestroyedCount,
        timePlayed,
        token,
      }),
    });
    const data = await resp.json();
    if (data.ok && Array.isArray(data.hiscores)) {
      hiscores = data.hiscores;
      hiscore  = hiscores[0]?.score || 0;
      sessionStorage.setItem('bb_scores', JSON.stringify(hiscores));
    }
  } catch {
    // Nätverk otillgängligt – lokal fallback
    hiscores.push({ name: 'YOU', score });
    hiscores.sort((a, b) => b.score - a.score);
    hiscores = hiscores.slice(0, 10);
    sessionStorage.setItem('bb_scores', JSON.stringify(hiscores));
    hiscore = hiscores[0].score;
  }
}

// Beräknar HMAC-SHA256-token klientsidan – speglar Edge Functions verifieringslogik
async function computeToken(score, bricksDestroyed) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SUPABASE_CONFIG.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`score=${score}&bricks=${bricksDestroyed}`));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Attract-animationer ───────────────────────────────────────────────────────

// Skapar fallande brickor som bakgrundsanimation på titelskärmen
function initAttractBricks() {
  const types = Object.keys(BRICK_TYPES).filter(k => k !== 'X');
  attractBricks = [];
  for (let i = 0; i < 10; i++) {
    attractBricks.push({
      x:    snap(Math.random() * (W - BRICK_W)),
      y:    snap(-BRICK_H - Math.random() * H),
      type: types[Math.floor(Math.random() * types.length)],
      dy:   12 + Math.random() * 22,
    });
  }
}

function updateAttractBricks(dt) {
  const types = Object.keys(BRICK_TYPES).filter(k => k !== 'X');
  for (const b of attractBricks) {
    b.y += b.dy * dt;
    if (b.y > H + BRICK_H) {
      b.y   = -BRICK_H;
      b.x   = snap(Math.random() * (W - BRICK_W));
      b.type = types[Math.floor(Math.random() * types.length)];
    }
  }
}

// ── Attract-tillstånd ─────────────────────────────────────────────────────────

function startAttractTitle() {
  state        = 'ATTRACT_TITLE';
  attractTimer = META_CONFIG.attractTitleTime;
  isDemoMode   = false;
  particles    = particles || [];
  popups       = popups   || [];
}

function startAttractDemo() {
  isDemoMode   = true;
  attractTimer = META_CONFIG.attractDemoTime;
  score        = 0;
  level        = 1;
  lives        = config.lives;
  frameCount   = frameCount || 0;
  particles    = [];
  popups       = [];
  ship         = null;
  shipTimer         = randBetween(config.shipIntervalMin, config.shipIntervalMax);
  brickHitCount     = 0;
  paddleShrinkTimer = config.paddleShrinkInterval;
  currentMinSpeed   = config.minSpeed;
  // Slumpmässig karta om tillgänglig, annars 3-raders standardlayout
  if (loadedMaps.length > 0) {
    bricks = buildBricks(config.brickRows, loadedMaps[Math.floor(Math.random() * loadedMaps.length)]);
  } else {
    bricks = buildBricks(3, null);
  }
  placePaddle();
  placeBall();
  ballLaunch   = false;  // AI behöver inte trycka SPACE
  state        = 'PLAYING';
}

function startAttractHiscore() {
  state        = 'ATTRACT_HISCORE';
  attractTimer = META_CONFIG.attractHiscoreTime;
  isDemoMode   = false;
}

// Startar ett riktigt spel från valfritt attract-läge
function startRealGame() {
  isDemoMode   = false;
  score        = 0;
  level        = 1;
  lives        = config.lives;
  frameCount   = 0;
  particles    = [];
  popups       = [];
  ship         = null;
  shipTimer            = randBetween(config.shipIntervalMin, config.shipIntervalMax);
  brickHitCount        = 0;
  bricksDestroyedCount = 0;
  gameStartTime        = Date.now();
  scoreSaved           = false;
  paddleShrinkTimer    = config.paddleShrinkInterval;
  currentMinSpeed      = config.minSpeed;
  bricks               = buildBricks(config.brickRows, loadedMaps.length > 0 ? loadedMaps[0] : null);
  placePaddle();
  placeBall();
  ballLaunch        = true;
  ballLaunchTimer   = 5;
  keys.space        = false;
  spaceConsumed = false;
  state        = 'PLAYING';
}

// ── Spel-initiering ───────────────────────────────────────────────────────────

function startLevel() {
  const mapData = loadedMaps.length > 0
    ? loadedMaps[(level - 1) % loadedMaps.length]
    : null;
  // Minimihastigheten stiger med varje karta; bollen sänks hit vid nivåstart och bollförlust
  currentMinSpeed = Math.min(
    config.minSpeed + (level - 1) * config.levelSpeedStep,
    config.maxSpeed - 60,
  );
  bricks            = buildBricks(config.brickRows, mapData);
  placePaddle();
  placeBall();
  ballLaunch        = isDemoMode ? false : true;  // AI-demo behöver inte trycka SPACE
  ballLaunchTimer   = 5;
  brickHitCount     = 0;
  paddleShrinkTimer = config.paddleShrinkInterval;
  state             = 'PLAYING';
}

function placePaddle() {
  const w = config.paddleStartWidth;
  paddle = { x: (W - w) / 2, vx: 0, width: w };
}

function placeBall() {
  const speed = currentMinSpeed;
  const angle = (randBetween(25, 45) * Math.PI / 180) * (Math.random() < 0.5 ? -1 : 1);
  ball = {
    x: W / 2,
    y: PLAY_BOT - 20,
    vx: Math.sin(angle) * speed,
    vy: -Math.cos(angle) * speed,
    trail:       [],
    flashFrames: 0,
    flashCount:  0,
  };
}

// mapData: 2D-array av typtecken från parseMap(), eller null för standardlayout
function buildBricks(rows = config.brickRows, mapData = null) {
  const result = [];

  if (mapData) {
    for (let r = 0; r < mapData.length; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        const typeChar = mapData[r][c] ?? '.';
        if (typeChar === '.') continue;
        const typeDef = BRICK_TYPES[typeChar];
        if (!typeDef) continue;
        result.push({
          x:        BRICK_LEFT + c * (BRICK_W + BRICK_GAP),
          y:        BRICK_START_Y + r * (BRICK_H + BRICK_GAP),
          type:     typeChar,
          hitsLeft: typeDef.hits,
          flash:    0,
          alive:    true,
        });
      }
    }
  } else {
    rows = Math.min(rows, 8);
    for (let r = 0; r < rows; r++) {
      const typeChar = DEFAULT_ROW_TYPES[r % DEFAULT_ROW_TYPES.length];
      const typeDef  = BRICK_TYPES[typeChar];
      for (let c = 0; c < BRICK_COLS; c++) {
        result.push({
          x:        BRICK_LEFT + c * (BRICK_W + BRICK_GAP),
          y:        BRICK_START_Y + r * (BRICK_H + BRICK_GAP),
          type:     typeChar,
          hitsLeft: typeDef.hits,
          flash:    0,
          alive:    true,
        });
      }
    }
  }

  return result;
}

// ── Spelloop ──────────────────────────────────────────────────────────────────

let lastTimestamp = 0;

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
  lastTimestamp = timestamp;
  frameCount++;

  update(dt);
  render();

  animFrameId = requestAnimationFrame(loop);
}

// ── Update ────────────────────────────────────────────────────────────────────

function update(dt) {
  // Löper alltid, oavsett spelläge
  updatePopups();
  updateParticles(dt);

  // ── Paus – frys all spellogik ──
  if (state === 'PAUSED') return;

  // ── Attract-skärmar (inget spel) ──
  if (state === 'ATTRACT_TITLE') {
    updateAttractBricks(dt);
    attractTimer -= dt;
    if (attractTimer <= 0) startAttractDemo();
    return;
  }

  if (state === 'ATTRACT_HISCORE') {
    attractTimer -= dt;
    if (attractTimer <= 0) startAttractTitle();
    return;
  }

  // ── Game Over ──
  if (state === 'GAME_OVER') {
    pauseTimer--;
    if (pauseTimer <= 0 || (keys.space && !spaceConsumed)) {
      spaceConsumed = true;
      if (score > 0) startNameEntry(); else startAttractTitle();
    }
    return;
  }

  // ── Namninmatning ──
  if (state === 'NAME_ENTRY') {
    updateNameEntry(dt);
    return;
  }

  // ── Alla banor klara ──
  if (state === 'ALL_CLEAR') {
    pauseTimer--;
    if (pauseTimer <= 0 || (keys.space && !spaceConsumed)) {
      spaceConsumed = true;
      if (score > 0) startNameEntry(); else startAttractTitle();
    }
    return;
  }

  // ── Liv förlorat ──
  if (state === 'LIFE_LOST') {
    updateBallFlash();
    pauseTimer--;
    if (pauseTimer <= 0) {
      if (lives <= 0) {
        state      = 'GAME_OVER';
        pauseTimer = 60 * 3;  // 3 sekunder, sedan vidare till namnregistrering
      } else {
        placeBall();
        ballLaunch      = true;
        ballLaunchTimer = 5;
        state           = 'PLAYING';
      }
    }
    return;
  }

  // ── Nivå klar ──
  if (state === 'LEVEL_COMPLETE') {
    // Attract-timern måste räknas ner även här så att demo-loopen inte fastnar
    if (isDemoMode) {
      attractTimer -= dt;
      if (attractTimer <= 0) { startAttractHiscore(); return; }
    }
    pauseTimer--;
    if (pauseTimer <= 0) {
      level++;
      // Sista kartan klar (bara i riktigt spel med laddade kartor) → slutskärm
      if (!isDemoMode && loadedMaps.length > 0 && level > loadedMaps.length) {
        state      = 'ALL_CLEAR';
        pauseTimer = 60 * 7;  // 7 sekunder vid 60fps, eller hoppa med SPACE/klick
      } else {
        startLevel();
      }
    }
    return;
  }

  // ── PLAYING (demo eller riktig) ──
  if (isDemoMode) {
    // Räkna ner attract-timern; switch till hiscore när den tar slut
    attractTimer -= dt;
    if (attractTimer <= 0) {
      startAttractHiscore();
      return;
    }
    updateAIPaddle();
  } else {
    updatePaddle();
  }

  updateBall(dt);
  updateShip(dt);
  updatePaddleShrink(dt);

  // Nivån är klar när alla förstörbara brickor är borta (diamanter räknas inte)
  if (bricks.every(b => !b.alive || b.hitsLeft === Infinity)) {
    state      = 'LEVEL_COMPLETE';
    pauseTimer = 90;
  }
}

// ── Paddel ────────────────────────────────────────────────────────────────────

function updatePaddle() {
  if (mouseX !== null) {
    // Mus: paddeln centreras direkt på muspekarens logiska x-position
    paddle.x  = Math.max(0, Math.min(W - paddle.width, mouseX - paddle.width / 2));
    paddle.vx = 0;
  } else {
    // Tangentbord: acceleration + friktion
    if (keys.left)  paddle.vx -= 2.5;
    if (keys.right) paddle.vx += 2.5;
    paddle.vx *= 0.78;
    paddle.x  += paddle.vx;
    paddle.x   = Math.max(0, Math.min(W - paddle.width, paddle.x));
  }
}

// AI-styrning: mjuk följning av bollen med lite slumpvariation
function updateAIPaddle() {
  if (!ball || ballLaunch) return;
  const target = ball.x - paddle.width / 2 + (Math.random() - 0.5) * 6;
  paddle.vx += (target - paddle.x) * 0.055;
  paddle.vx *= 0.84;
  paddle.x  += paddle.vx;
  paddle.x   = Math.max(0, Math.min(W - paddle.width, paddle.x));
}

// ── Boll ──────────────────────────────────────────────────────────────────────

function updateBall(dt) {
  if (ballLaunch) {
    ball.x = paddle.x + paddle.width / 2;
    if (keys.space && !spaceConsumed) {
      spaceConsumed = true;
      ballLaunch = false;
    } else {
      // Automatisk start om spelaren inte agerar inom 5 sekunder
      ballLaunchTimer -= dt;
      if (ballLaunchTimer <= 0) ballLaunch = false;
    }
    return;
  }

  ball.trail.unshift({ x: ball.x, y: ball.y });
  if (ball.trail.length > 5) ball.trail.pop();

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Vänster/höger vägg
  if (ball.x - 3 < 0)   { ball.x = 3;     ball.vx =  Math.abs(ball.vx); }
  if (ball.x + 3 > W)   { ball.x = W - 3; ball.vx = -Math.abs(ball.vx); }

  // Tak
  if (ball.y - 3 < PLAY_TOP) { ball.y = PLAY_TOP + 3; ball.vy = Math.abs(ball.vy); }

  // Paddel
  if (
    ball.vy > 0 &&
    ball.y + 3 >= PADDLE_Y &&
    ball.y - 3 <= PADDLE_Y + 5 &&
    ball.x     >= paddle.x - 3 &&
    ball.x     <= paddle.x + paddle.width + 3
  ) {
    const half  = paddle.width / 2;
    const angle = ((ball.x - (paddle.x + half)) / half) * (55 * Math.PI / 180);
    const speed = Math.hypot(ball.vx, ball.vy);
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.abs(Math.cos(angle) * speed);
    ball.y  = PADDLE_Y - 3;
  }

  // Boll under spelplanen
  if (ball.y - 3 > PLAY_BOT) {
    if (isDemoMode) {
      // Demo: återplacera bollen utan att förlora liv
      placeBall();
      ballLaunch = false;
      return;
    }
    lives--;
    if (!isDemoMode && score > hiscore) hiscore = score;
    state      = 'LIFE_LOST';
    pauseTimer = 60 + 8 * 8;
    ball.flashFrames = 0;
    ball.flashCount  = 0;
    return;
  }

  checkBrickCollision();
}

function checkBrickCollision() {
  const bx = ball.x - 3, by = ball.y - 3, bw = 6, bh = 6;

  for (const brick of bricks) {
    if (!brick.alive) continue;

    const overlapX = Math.min(bx + bw, brick.x + BRICK_W) - Math.max(bx, brick.x);
    const overlapY = Math.min(by + bh, brick.y + BRICK_H) - Math.max(by, brick.y);
    if (overlapX <= 0 || overlapY <= 0) continue;

    // Vänd rörelseriktning och skjut ut bollen ur brickan så att den aldrig fastnar
    if (overlapX < overlapY) {
      ball.vx = -ball.vx;
      ball.x  = ball.x < brick.x + BRICK_W / 2 ? brick.x - 3 : brick.x + BRICK_W + 3;
    } else {
      ball.vy = -ball.vy;
      ball.y  = ball.y < brick.y + BRICK_H / 2 ? brick.y - 3 : brick.y + BRICK_H + 3;
    }

    const typeDef = BRICK_TYPES[brick.type] || BRICK_TYPES.R;

    // Permanent-brickor studsar tillbaka men förstörs aldrig
    if (brick.hitsLeft === Infinity) {
      brick.flash = 1;
      break;
    }

    brick.hitsLeft--;
    brick.flash = 1;

    if (brick.hitsLeft <= 0) {
      brick.alive = false;

      // Öka hastigheten var speedHitInterval:e förstörd bricka
      brickHitCount++;
      bricksDestroyedCount++;
      if (brickHitCount % config.speedHitInterval === 0) {
        const cur  = Math.hypot(ball.vx, ball.vy);
        const next = Math.min(cur + config.speedIncrement, config.maxSpeed);
        ball.vx   *= next / cur;
        ball.vy   *= next / cur;
      }

      const pts = typeDef.points * level;
      score += pts;
      if (!isDemoMode && score > hiscore) hiscore = score;

      if (pts > 0) {
        popups.push({
          x:       brick.x + BRICK_W / 2,
          y:       brick.y + BRICK_H / 2,
          text:    `+${pts}`,
          color:   typeDef.highlight,
          dy:      -0.5,
          life:    40,
          maxLife: 40,
        });
      }
    }

    break;
  }
}

function updateBallFlash() {
  if (!ball) return;
  ball.flashFrames++;
  if (ball.flashFrames >= 4) {
    ball.flashFrames = 0;
    ball.flashCount++;
  }
}

// ── Rymdskepp ─────────────────────────────────────────────────────────────────

function updateShip(dt) {
  if (!ship) {
    shipTimer -= dt;
    if (shipTimer <= 0) spawnShip();
    return;
  }

  ship.x += ship.vx * dt;

  // Kollision boll ↔ skepp (AABB)
  if (!ballLaunch && ball) {
    const sx = ship.x, sy = ship.y;
    if (
      ball.x + 3 > sx     && ball.x - 3 < sx + 19 &&
      ball.y + 3 > sy + 2 && ball.y - 3 < sy + 9
    ) {
      score += 100 * level;
      if (!isDemoMode && score > hiscore) hiscore = score;
      spawnExplosion(sx + 9, sy + 4);
      ship      = null;
      shipTimer = randBetween(config.shipIntervalMin, config.shipIntervalMax);
      return;
    }
  }

  // Skepp lämnar skärmen
  const gone = ship.vx > 0 ? ship.x > W + 2 : ship.x + 19 < -2;
  if (gone) {
    ship      = null;
    shipTimer = randBetween(config.shipIntervalMin, config.shipIntervalMax);
  }
}

function spawnShip() {
  const goRight = Math.random() < 0.5;
  ship = { x: goRight ? -20 : W + 2, y: 22, vx: goRight ? 60 : -60, flip: !goRight };
}

// ── Paddelkrympning ───────────────────────────────────────────────────────────

function updatePaddleShrink(dt) {
  if (ballLaunch) return;
  paddleShrinkTimer -= dt;
  if (paddleShrinkTimer <= 0) {
    paddleShrinkTimer = config.paddleShrinkInterval;
    if (paddle.width > config.paddleMinWidth) {
      paddle.width = Math.max(config.paddleMinWidth, paddle.width - 1);
    }
  }
}

// ── Popups och partiklar ──────────────────────────────────────────────────────

function updatePopups() {
  for (const p of popups) { p.y += p.dy; p.life--; }
  popups = popups.filter(p => p.life > 0);
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x    += p.vx * dt;
    p.y    += p.vy * dt;
    p.vy   += 30 * dt;
    p.life -= p.decay * dt;
  }
  particles = particles.filter(p => p.life > 0);
}

function spawnExplosion(cx, cy) {
  const colors = ['#ff8800','#ffdd00','#ff4400','#ffffff','#ff44cc','#9999ff'];
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const speed = 15 + Math.random() * 40;
    particles.push({
      x:     cx, y: cy,
      vx:    Math.cos(angle) * speed,
      vy:    Math.sin(angle) * speed,
      size:  Math.random() < 0.5 ? 1 : 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      life:  1.0,
      decay: 0.6 + Math.random() * 0.8,
    });
  }
}

// ── Paus ─────────────────────────────────────────────────────────────────────

function pauseGame()  { state = 'PAUSED';  }
function resumeGame() { state = 'PLAYING'; }

// ── Namninmatning ─────────────────────────────────────────────────────────────

function startNameEntry() {
  state              = 'NAME_ENTRY';
  nameEntryChars     = '';
  nameEntryTimer     = NE_TIMER;
  nameEntryCursorRow = 0;
  nameEntryCursorCol = 0;
}

function updateNameEntry(dt) {
  nameEntryTimer -= dt;
  if (nameEntryTimer <= 0) {
    // Räknaren nådde 0 utan bekräftelse – spara inte poängen
    startAttractTitle();
  }
}

// Hanterar ett val i tangentgriddet (bokstav, RUB eller END)
function selectNameKey(label) {
  if (label === 'RUB') {
    nameEntryChars = nameEntryChars.slice(0, -1);
  } else if (label === 'END') {
    if (nameEntryChars.length >= 1) {
      saveCurrentScore(nameEntryChars);
      startAttractTitle();
    }
  } else if (nameEntryChars.length < 3) {
    nameEntryChars += label;
    if (nameEntryChars.length === 3) {
      // Flytta markören automatiskt till END när tre tecken är inmatade
      nameEntryCursorRow = NAME_GRID.length - 1;
      nameEntryCursorCol = NAME_GRID[nameEntryCursorRow].indexOf('END');
    }
  }
}

// Returnerar {row, col} för den tangent vars area innehåller logisk koordinat (mx, my)
function getNameKeyAt(mx, my) {
  for (let row = 0; row < NAME_GRID.length; row++) {
    const ky = NE_ROW_Y[row];
    if (my < ky || my > ky + NE_KEY_H) continue;
    let x = NE_START_X;
    for (let col = 0; col < NAME_GRID[row].length; col++) {
      const kw = NAME_GRID[row][col].length > 1 ? NE_WIDE_W : NE_KEY_W;
      if (mx >= x && mx <= x + kw) return { row, col };
      x += kw + NE_KEY_GAP;
    }
  }
  return null;
}

function renderPauseOverlay() {
  // Halvgenomskinlig mörk yta över spelplanen
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, PLAY_TOP, W, PLAY_BOT - PLAY_TOP);

  ctx.font      = '10px "Press Start 2P"';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W / 2, 152);

  const blink = Math.floor(frameCount / 30) % 2 === 0;
  ctx.font      = '6px "Press Start 2P"';
  ctx.fillStyle = blink ? '#ffdd00' : '#443300';
  ctx.fillText('SPACE / KLICK', W / 2, 172);
  ctx.fillStyle = blink ? '#ffdd00' : '#443300';
  ctx.fillText('FORTSATT', W / 2, 184);

  ctx.textAlign = 'left';
}

// ── Render (huvud) ────────────────────────────────────────────────────────────

function render() {
  if (!ctx) return;

  ctx.fillStyle = '#05050f';
  ctx.fillRect(0, 0, W, H);

  if (state === 'ATTRACT_TITLE') {
    renderAttractTitle();
  } else if (state === 'ATTRACT_HISCORE') {
    renderAttractHiscore();
  } else if (state === 'GAME_OVER') {
    renderGameOver();
  } else if (state === 'ALL_CLEAR') {
    renderAllClear();
  } else if (state === 'NAME_ENTRY') {
    renderNameEntry();
  } else {
    // PLAYING / LIFE_LOST / LEVEL_COMPLETE
    renderHUD();
    renderBricks();
    renderPaddle();
    renderBall();
    renderShip();
    renderPopups();
    renderParticles();
    if (state === 'LEVEL_COMPLETE') renderLevelComplete();
    if (isDemoMode)                 renderDemoOverlay();
    if (state === 'PAUSED')         renderPauseOverlay();
  }

}

// ── Attract-skärmar ───────────────────────────────────────────────────────────

function renderAttractTitle() {
  // Fallande brickor i bakgrunden (halvgenomskinliga)
  ctx.globalAlpha = 0.22;
  for (const b of attractBricks) {
    const { fill, highlight, shadow } = BRICK_TYPES[b.type] || BRICK_TYPES.R;
    ctx.fillStyle = fill;
    ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
    ctx.fillStyle = highlight;
    ctx.fillRect(b.x, b.y, BRICK_W, 1);
    ctx.fillRect(b.x, b.y, 1, BRICK_H);
    ctx.fillStyle = shadow;
    ctx.fillRect(b.x, b.y + BRICK_H - 1, BRICK_W, 1);
    ctx.fillRect(b.x + BRICK_W - 1, b.y, 1, BRICK_H);
  }
  ctx.globalAlpha = 1;

  // Titel – cyklar genom bricktypernas highlight-färger (exkl. diamant)
  const typeKeys = Object.keys(BRICK_TYPES).filter(k => k !== 'X');
  const ci = Math.floor(frameCount / 30) % typeKeys.length;
  ctx.font      = '12px "Press Start 2P"';
  ctx.fillStyle = BRICK_TYPES[typeKeys[ci]].highlight;
  ctx.textAlign = 'center';
  ctx.fillText('BRICK', W / 2, 104);
  ctx.fillText('BREAK', W / 2, 121);

  // Dekorativ brickrad
  drawDecoBrickRow(138);

  // Blinkande "PRESS SPACE TO PLAY"
  const blink = Math.floor(frameCount / 30) % 2 === 0;
  ctx.font      = '6px "Press Start 2P"';
  ctx.fillStyle = blink ? '#ffdd00' : '#05050f';
  ctx.fillText('PRESS SPACE', W / 2, 185);
  ctx.fillStyle = blink ? '#ffdd00' : '#05050f';
  ctx.fillText('TO PLAY', W / 2, 197);

  // Versionsnummer
  ctx.font      = '5px "Press Start 2P"';
  ctx.fillStyle = '#1a1a3a';
  ctx.fillText(`v${META_CONFIG.version}`, W / 2, 312);

  ctx.textAlign = 'left';
}

function renderAttractHiscore() {
  ctx.font      = '8px "Press Start 2P"';
  ctx.fillStyle = '#ffdd00';
  ctx.textAlign = 'center';
  ctx.fillText('HI-SCORE', W / 2, 62);

  // Separator
  ctx.fillStyle = '#1a1a3a';
  ctx.fillRect(24, 72, W - 48, 1);

  // Rankingfärger: guld, silver, brons, sedan vit/grå
  const rankColors = ['#ffdd00', '#aaaaaa', '#cd7f32', '#888888', '#555566'];

  for (let i = 0; i < hiscores.length; i++) {
    const entry = hiscores[i];
    const y     = 96 + i * 24;

    ctx.font      = '6px "Press Start 2P"';
    ctx.fillStyle = rankColors[i] || '#555566';

    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}.`,    36, y);
    ctx.fillText(entry.name,     62, y);
    ctx.textAlign = 'right';
    ctx.fillText(String(entry.score).padStart(5, '0'), 204, y);
  }

  // Separator
  ctx.fillStyle = '#1a1a3a';
  ctx.fillRect(24, 220, W - 48, 1);

  // Blinkande "PRESS SPACE"
  const blink = Math.floor(frameCount / 30) % 2 === 0;
  ctx.font      = '6px "Press Start 2P"';
  ctx.fillStyle = blink ? '#ffdd00' : '#05050f';
  ctx.textAlign = 'center';
  ctx.fillText('PRESS SPACE', W / 2, 244);
  ctx.fillStyle = blink ? '#ffdd00' : '#05050f';
  ctx.fillText('TO PLAY', W / 2, 256);

  ctx.textAlign = 'left';
}

// Liten "DEMO"-badge i övre vänstra hörnet av spelplanen
function renderDemoOverlay() {
  ctx.font      = '5px "Press Start 2P"';
  ctx.fillStyle = '#ff4400';
  ctx.textAlign = 'left';
  ctx.fillText('DEMO', BRICK_LEFT, PLAY_TOP + 13);
}

// Rita en rad brickor centrerad på y (för dekoration på titelskärmen)
function drawDecoBrickRow(y) {
  const types  = Object.keys(BRICK_TYPES).filter(k => k !== 'X');
  const totalW = BRICK_COLS * BRICK_W + (BRICK_COLS - 1) * BRICK_GAP;
  const startX = Math.floor((W - totalW) / 2);
  for (let i = 0; i < BRICK_COLS; i++) {
    const { fill, highlight, shadow } = BRICK_TYPES[types[i % types.length]];
    const bx = startX + i * (BRICK_W + BRICK_GAP);
    ctx.fillStyle = fill;
    ctx.fillRect(bx, y, BRICK_W, BRICK_H);
    ctx.fillStyle = highlight;
    ctx.fillRect(bx, y, BRICK_W, 1);
    ctx.fillRect(bx, y, 1, BRICK_H);
    ctx.fillStyle = shadow;
    ctx.fillRect(bx, y + BRICK_H - 1, BRICK_W, 1);
    ctx.fillRect(bx + BRICK_W - 1, y, 1, BRICK_H);
  }
}

// ── Spelskärmar ───────────────────────────────────────────────────────────────

function renderGameOver() {
  renderHUD();

  ctx.font      = '10px "Press Start 2P"';
  ctx.fillStyle = '#e74c3c';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W / 2, 140);

  ctx.font      = '6px "Press Start 2P"';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`SCORE  ${String(score).padStart(5, '0')}`, W / 2, 158);
  ctx.fillStyle = '#ffdd00';
  ctx.fillText(`BEST   ${String(hiscore).padStart(5, '0')}`, W / 2, 172);

  const blink = Math.floor(frameCount / 30) % 2 === 0;
  ctx.fillStyle = blink ? '#ffdd00' : '#05050f';
  ctx.fillText('PRESS SPACE', W / 2, 194);

  ctx.textAlign = 'left';
}

function renderAllClear() {
  renderHUD();

  // Blinkande guldram runt spelplanen
  const blink = Math.floor(frameCount / 20) % 2 === 0;
  if (blink) {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth   = 2;
    ctx.strokeRect(2, PLAY_TOP + 2, W - 4, PLAY_BOT - PLAY_TOP - 4);
    ctx.lineWidth = 1;
  }

  ctx.font      = '8px "Press Start 2P"';
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'center';
  ctx.fillText('GRATTIS!', W / 2, 118);

  ctx.font      = '6px "Press Start 2P"';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('DU KLARADE', W / 2, 140);
  ctx.fillText('ALLA BANOR!', W / 2, 154);

  ctx.fillStyle = '#ffdd00';
  ctx.fillText(`POÄNG  ${String(score).padStart(5, '0')}`, W / 2, 176);
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText(`BÄST   ${String(hiscore).padStart(5, '0')}`, W / 2, 190);

  const blink2 = Math.floor(frameCount / 30) % 2 === 0;
  ctx.font      = '5px "Press Start 2P"';
  ctx.fillStyle = blink2 ? '#4ac8ff' : '#05050f';
  ctx.fillText('PRESS SPACE', W / 2, 214);

  ctx.textAlign = 'left';
}

function renderLevelComplete() {
  ctx.font      = '8px "Press Start 2P"';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('LEVEL', W / 2, 150);
  ctx.fillStyle = '#ffdd00';
  ctx.fillText('CLEAR!', W / 2, 163);
  ctx.textAlign = 'left';
}

function renderNameEntry() {
  // Rubrik
  ctx.font      = '6px "Press Start 2P"';
  ctx.fillStyle = '#4ac8ff';
  ctx.textAlign = 'center';
  ctx.fillText('ANGE INITIALER', W / 2, 26);

  // Poäng
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`POÄNG  ${String(score).padStart(5, '0')}`, W / 2, 42);

  // Namnslottar – 3 st, 24×20 px var, centrerade
  const slotW = 24, slotH = 20, slotGap = 8;
  const slotX0 = Math.floor((W - (3 * slotW + 2 * slotGap)) / 2);
  for (let i = 0; i < 3; i++) {
    const bx     = slotX0 + i * (slotW + slotGap);
    const filled = i < nameEntryChars.length;
    ctx.fillStyle   = filled ? '#0a2050' : '#0a0a18';
    ctx.fillRect(bx, 54, slotW, slotH);
    ctx.strokeStyle = filled ? '#4ac8ff' : '#222233';
    ctx.lineWidth   = 1;
    ctx.strokeRect(bx + 0.5, 54.5, slotW - 1, slotH - 1);
    if (filled) {
      ctx.font      = '10px "Press Start 2P"';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(nameEntryChars[i], bx + slotW / 2, 54 + slotH - 4);
    }
  }

  // Timervärde – färg övergår grön → gul → röd
  const timerFrac  = Math.max(0, nameEntryTimer) / NE_TIMER;
  const timerColor = timerFrac > 0.5 ? '#27ae60' : timerFrac > 0.25 ? '#f1c40f' : '#e74c3c';
  ctx.font      = '8px "Press Start 2P"';
  ctx.fillStyle = timerColor;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.ceil(Math.max(0, nameEntryTimer))).padStart(2, '0'), W / 2, 96);

  // Timer-stapel
  const barW = W - 32;
  ctx.fillStyle = '#1a1a3a';
  ctx.fillRect(16, 100, barW, 3);
  ctx.fillStyle = timerColor;
  ctx.fillRect(16, 100, Math.round(barW * timerFrac), 3);

  // Tangentgrid
  for (let row = 0; row < NAME_GRID.length; row++) {
    let x = NE_START_X;
    const y = NE_ROW_Y[row];
    for (let col = 0; col < NAME_GRID[row].length; col++) {
      const label    = NAME_GRID[row][col];
      const kw       = label.length > 1 ? NE_WIDE_W : NE_KEY_W;
      const isCursor = nameEntryCursorRow === row && nameEntryCursorCol === col;
      const isEnd    = label === 'END';
      const isRub    = label === 'RUB';

      // Tangentkropp
      ctx.fillStyle = isCursor ? '#4ac8ff' : isEnd ? '#0a3300' : isRub ? '#3a1500' : '#1a1a3a';
      ctx.fillRect(x, y, kw, NE_KEY_H);

      // Highlight-kant (överkant + vänsterkant) – ger 3D-känsla
      ctx.fillStyle = isCursor ? '#88eeff' : isEnd ? '#27ae60' : isRub ? '#e67e22' : '#333355';
      ctx.fillRect(x, y, kw, 1);
      ctx.fillRect(x, y, 1, NE_KEY_H);

      // Tangent-etikett
      const disabled = isEnd && nameEntryChars.length < 1;
      ctx.font      = label.length > 2 ? '5px "Press Start 2P"' : '6px "Press Start 2P"';
      ctx.fillStyle = isCursor ? '#000000' : disabled ? '#333344' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + kw / 2, y + NE_KEY_H - 3);

      x += kw + NE_KEY_GAP;
    }
  }

  // Hjälptext
  ctx.font      = '5px "Press Start 2P"';
  ctx.fillStyle = '#222233';
  ctx.textAlign = 'center';
  ctx.fillText('PILAR/MUS  SPACE/KLICK', W / 2, 170);

  ctx.textAlign = 'left';
}

// ── HUD ───────────────────────────────────────────────────────────────────────

function renderHUD() {
  ctx.font      = '6px "Press Start 2P"';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`1P:  ${String(score).padStart(5, '0')}`, 4, 12);

  ctx.fillStyle = '#ffdd00';
  ctx.textAlign = 'right';
  ctx.fillText(`HISCORE: ${String(hiscore).padStart(5, '0')}`, 236, 12);

  ctx.fillStyle = '#1a1a3a';
  ctx.fillRect(0, HUD_TOP, W, 1);
  ctx.fillRect(0, HUD_BOT, W, 1);

  for (let i = 0; i < lives; i++) {
    drawPixelCircle(ctx, 8 + i * 10, 311, CIRCLE_R3, '#4ac8ff');
  }

  ctx.font      = '6px "Press Start 2P"';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(`LEVEL ${level}`, 232, 317);

  ctx.textAlign = 'left';
}

// ── Spelelement ───────────────────────────────────────────────────────────────

function renderBricks() {
  for (const b of bricks) {
    if (!b.alive && b.flash <= 0) continue;

    const typeDef = BRICK_TYPES[b.type] || BRICK_TYPES.R;
    const { fill, highlight, shadow } = typeDef;

    if (b.flash > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
      b.flash = 0;
      continue;
    }

    ctx.fillStyle = fill;
    ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
    ctx.fillStyle = highlight;
    ctx.fillRect(b.x, b.y, BRICK_W, 1);
    ctx.fillRect(b.x, b.y, 1, BRICK_H);
    ctx.fillStyle = shadow;
    ctx.fillRect(b.x, b.y + BRICK_H - 1, BRICK_W, 1);
    ctx.fillRect(b.x + BRICK_W - 1, b.y, 1, BRICK_H);
  }
}

function renderPaddle() {
  const { x, width } = paddle;
  ctx.fillStyle = '#aaaaaa'; ctx.fillRect(x, PADDLE_Y,     width, 1);  // highlight
  ctx.fillStyle = '#555555'; ctx.fillRect(x, PADDLE_Y + 1, width, 3);  // kropp
  ctx.fillStyle = '#222222'; ctx.fillRect(x, PADDLE_Y + 4, width, 1);  // skugga
}

function renderBall() {
  if (!ball) return;

  if (state === 'LIFE_LOST') {
    if (ball.flashCount >= 8) return;
    const color = ball.flashFrames < 2 ? '#ffffff' : '#e74c3c';
    drawPixelCircle(ctx, Math.round(ball.x), Math.round(ball.y), CIRCLE_R3, color);
    return;
  }

  // Trail
  const trailMasks = [CIRCLE_R2, CIRCLE_R2, CIRCLE_R1, CIRCLE_R1, CIRCLE_R1];
  const trailAlpha = [0.5, 0.3, 0.2, 0.1, 0.05];
  for (let i = 0; i < ball.trail.length; i++) {
    ctx.globalAlpha = trailAlpha[i];
    drawPixelCircle(ctx, Math.round(ball.trail[i].x), Math.round(ball.trail[i].y), trailMasks[i], '#888888');
  }
  ctx.globalAlpha = 1;

  const bx = Math.round(ball.x), by = Math.round(ball.y);
  drawPixelCircle(ctx, bx, by, CIRCLE_R3, '#d0d0d8');  // silverboll
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx - 1, by - 1, 1, 1);
}

function renderShip() {
  if (!ship) return;
  const sx     = Math.round(ship.x);
  const sy     = Math.round(ship.y);
  const lampOn = Math.floor(frameCount / 20) % 2 === 0;

  for (let row = 0; row < SHIP_ROWS.length; row++) {
    if (row === 7) continue;  // lampor hanteras separat
    const rowData = SHIP_ROWS[row];
    for (let col = 0; col < rowData.length; col++) {
      const key = rowData[col];
      if (key === '.') continue;
      const color = SHIP_PALETTE[key];
      if (!color) continue;
      const px = ship.flip ? sx + (18 - col) : sx + col;
      ctx.fillStyle = color;
      ctx.fillRect(px, sy + row, 1, 1);
    }
  }

  for (const col of LAMP_COLS) {
    const px = ship.flip ? sx + (18 - col) : sx + col;
    ctx.fillStyle = lampOn ? '#ff44cc' : '#aa2288';
    ctx.fillRect(px, sy + 7, 1, 1);
  }
}

function renderPopups() {
  ctx.font      = '5px "Press Start 2P"';
  ctx.textAlign = 'center';
  for (const p of popups) {
    ctx.globalAlpha = p.life < 15 ? p.life / 15 : 1;
    ctx.fillStyle   = p.color;
    ctx.fillText(p.text, Math.round(p.x), Math.round(p.y));
  }
  ctx.globalAlpha = 1;
  ctx.textAlign   = 'left';
}

function renderParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle   = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}


// ── Karthantering ─────────────────────────────────────────────────────────────

// Tolkar en textfil till ett 2D-array av typtecken.
// Format: ett tecken per kolumn, 10 tecken per rad.
// '.' = tom cell, '#' i kolumn 0 = kommentarrad, tomma rader ignoreras.
function parseMap(text) {
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'))
    .map(line => [...line.slice(0, BRICK_COLS).padEnd(BRICK_COLS, '.')]);
}

// Laddar en enskild kartfil och returnerar dess parsade data
async function loadMap(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`[BrickBreak] Kunde inte ladda karta: ${url}`);
  return parseMap(await resp.text());
}

// Förladdar ett antal kartfiler – anropas från host-sidan innan spelet börjar.
// Anropas async: await BrickBreak.loadMaps(['maps/level-01.txt', 'maps/level-02.txt'])
async function loadMaps(urls) {
  loadedMaps = await Promise.all(urls.map(loadMap));
}

// ── Hjälpfunktioner ───────────────────────────────────────────────────────────

// Ritar en pixelcirkel via mask – aldrig arc()
function drawPixelCircle(ctx, cx, cy, mask, color) {
  ctx.fillStyle = color;
  for (const [dx, dy] of mask) {
    ctx.fillRect(cx + dx, cy + dy, 1, 1);
  }
}

// Rundar av till närmaste jämna tal (2px pixelgrid-snappning)
function snap(v) { return Math.round(v / 2) * 2; }

// Slumpmässigt tal i intervallet [min, max]
function randBetween(min, max) { return min + Math.random() * (max - min); }
