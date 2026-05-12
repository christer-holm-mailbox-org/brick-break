/**
 * brick-break.js – Huvud-modul för Brick Break
 *
 * Breakout-inspirerat arkadspel med strikt pixelkonst-estetik.
 * Inga rundade former, inga gradienter, ingen anti-aliasing.
 * Intern canvas: 240×320 logiska pixlar, skalad 2× via CSS.
 *
 * Användning:
 *   import { BrickBreak } from './brick-break.js';
 *   BrickBreak.init('#game', { lives: 3 });
 */

import { DEFAULT_CONFIG, META_CONFIG } from './config.js';

// ── Publik API ────────────────────────────────────────────────────────────────
export const BrickBreak = { init, destroy };

// ── Spelkonstanter ────────────────────────────────────────────────────────────
const W = 240;   // intern canvas-bredd (logiska pixlar)
const H = 320;   // intern canvas-höjd

const HUD_TOP    = 18;  // övre HUD-separatorns y
const HUD_BOT    = 302; // nedre HUD-separatorns y
const PLAY_TOP   = 19;  // spelytans överkant
const PLAY_BOT   = 301; // spelytans underkant
const PADDLE_Y   = 288; // paddelns överkant-y

// Brickkonstanter
const BRICK_COLS    = 6;
const BRICK_W       = 37;
const BRICK_H       = 9;
const BRICK_GAP     = 2;
const BRICK_LEFT    = 4;
const BRICK_START_Y = 24;

// Brickfärger per rad: [fill, highlight, shadow, poäng]
const BRICK_COLORS = [
  ['#6b0000', '#e74c3c', '#3a0000', 40],
  ['#6b2800', '#e67e22', '#3a1500', 30],
  ['#6b5a00', '#f1c40f', '#3a3000', 20],
  ['#0a3d1a', '#27ae60', '#051a0d', 10],
  ['#0a2050', '#3498db', '#050f28', 10],
];

// Pixelcirkel-maskar (koordinater relativt centrum)
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

// Rymdskepp sprite-layout (19×9, tecken → färg)
const SHIP_PALETTE = {
  D: '#1a1a3a',
  B: '#223366',
  L: '#9999ff',
  G: '#aaddff',
  P: '#ff44cc',  // lampfärg (pulserande)
};
// Rader definierade som arrays av färgnycklar ('.' = transparent)
const SHIP_ROWS = [
  ['.','.','.','.','.','.','.','G','G','G','G','G','.','.','.','.','.','.','.'],
  ['.','.','.','.','.','.','G','G','G','G','G','G','G','.','.','.','.','.','.'],
  ['.','.','.','.','L','L','B','B','B','B','B','B','B','B','B','L','L','.','.'],
  ['.','.','.','L','L','B','B','B','B','B','B','B','B','B','B','B','B','L','.'],
  ['L','B','B','B','B','B','B','B','B','B','B','B','B','B','B','B','B','B','L'],
  ['L','L','B','B','B','B','B','B','B','B','B','B','B','B','B','B','B','L','L'],
  ['.','.','L','L','D','D','D','D','D','D','D','D','D','D','D','L','L','.','.'],
  ['.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],  // lampor — hanteras separat
  ['.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
];
// Lamppositioner på rad 7 (x-index)
const LAMP_COLS = [5, 7, 9, 11, 13];

// ── Modulscoped state ─────────────────────────────────────────────────────────
let canvas, ctx, animFrameId, config;
let state;        // spelläge: 'IDLE' | 'PLAYING' | 'LIFE_LOST' | 'LEVEL_COMPLETE' | 'GAME_OVER'
let score, hiscore, level, lives;
let paddle;       // { x, vx, width }
let ball;         // { x, y, vx, vy, trail[] }
let bricks;       // array av { x, y, row, flash }
let particles;    // explosionspartiklar
let popups;       // poäng-popups
let ship;         // null | { x, y, dir, active }
let shipTimer;    // sekunder till nästa skepp
let speedTimer;   // sekunder till nästa hastighetsökning
let frameCount;
let pauseTimer;   // frames kvar av paus (LIFE_LOST / LEVEL_COMPLETE)
let ballLaunch;   // true = bollen väntar på SPACE
let keys;         // { left, right, space }
let spaceConsumed; // förhindrar att ett SPACE-tryck registreras flera gånger

// Lyssnare – sparas för cleanup
let keydownHandler, keyupHandler;

// ── Init & destroy ────────────────────────────────────────────────────────────

/**
 * Initierar spelet i angiven container.
 * @param {string} selector – CSS-selector för container
 * @param {object} options  – Överskrid DEFAULT_CONFIG-värden
 */
function init(selector, options = {}) {
  if (META_CONFIG.debug) {
    console.log(`[BrickBreak v${META_CONFIG.version}] init`, options);
  }

  config = { ...DEFAULT_CONFIG, ...options };

  const container = document.querySelector(selector);
  if (!container) {
    console.error(`[BrickBreak] Hittade inget element för selector: ${selector}`);
    return;
  }

  // Canvas – intern logisk upplösning är halva CSS-storleken
  canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  container.appendChild(canvas);

  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;  // kritiskt – aldrig suddig pixelkonst

  setupInput();
  startGame();
  animFrameId = requestAnimationFrame(loop);
}

/** Städar upp och frigör alla resurser. */
function destroy() {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId);
  document.removeEventListener('keydown', keydownHandler);
  document.removeEventListener('keyup',   keyupHandler);
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  canvas = ctx = animFrameId = null;
}

// ── Input ─────────────────────────────────────────────────────────────────────

function setupInput() {
  keys = { left: false, right: false, space: false };
  spaceConsumed = false;

  keydownHandler = (e) => {
    if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === ' ') { keys.space = true; e.preventDefault(); }
  };
  keyupHandler = (e) => {
    if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === ' ') { keys.space = false; spaceConsumed = false; }
  };

  document.addEventListener('keydown', keydownHandler);
  document.addEventListener('keyup',   keyupHandler);
}

// ── Spelinitiering ────────────────────────────────────────────────────────────

function startGame() {
  score      = 0;
  hiscore    = parseInt(sessionStorage.getItem('bb_hiscore') || '0', 10);
  level      = 1;
  lives      = config.lives;
  frameCount = 0;
  particles  = [];
  popups     = [];
  ship       = null;
  shipTimer  = randBetween(config.shipIntervalMin, config.shipIntervalMax);
  speedTimer = 5;
  state      = 'IDLE';
}

function startLevel() {
  bricks = buildBricks();
  placePaddle();
  placeBall();
  ballLaunch = true;
  speedTimer = 5;
  state = 'PLAYING';
}

function placePaddle() {
  const w = Math.max(24, 40 - (level - 1) * 2);  // minskar 2px per nivå, min 24px
  paddle = { x: (W - w) / 2, vx: 0, width: w };
}

function placeBall() {
  const speed = Math.min(config.minSpeed, config.maxSpeed);
  const angle = (randBetween(25, 45) * Math.PI / 180) * (Math.random() < 0.5 ? -1 : 1);
  ball = {
    x:  W / 2,
    y:  PLAY_BOT - 20,
    vx: Math.sin(angle) * speed,
    vy: -Math.cos(angle) * speed,
    trail: [],
    speed,
    flashFrames: 0,  // vita/röda blinkar vid liv-förlust
    flashCount:  0,
  };
}

function buildBricks() {
  const rows = Math.min(config.brickRows, 8);
  const result = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      result.push({
        x:     BRICK_LEFT + c * (BRICK_W + BRICK_GAP),
        y:     BRICK_START_Y + r * (BRICK_H + BRICK_GAP),
        row:   r,
        flash: 0,  // frames kvar av vit träff-blink
        alive: true,
      });
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
  updatePopups(dt);
  updateParticles(dt);

  if (state === 'IDLE') {
    if (keys.space && !spaceConsumed) {
      spaceConsumed = true;
      startLevel();
    }
    return;
  }

  if (state === 'GAME_OVER') {
    if (keys.space && !spaceConsumed) {
      spaceConsumed = true;
      startGame();
    }
    return;
  }

  if (state === 'LIFE_LOST') {
    updateBallFlash();
    pauseTimer--;
    if (pauseTimer <= 0) {
      if (lives <= 0) {
        state = 'GAME_OVER';
      } else {
        placeBall();
        ballLaunch = true;
        state = 'PLAYING';
      }
    }
    return;
  }

  if (state === 'LEVEL_COMPLETE') {
    pauseTimer--;
    if (pauseTimer <= 0) {
      level++;
      startLevel();
    }
    return;
  }

  // ── PLAYING ──
  updatePaddle(dt);
  updateBall(dt);
  updateShip(dt);
  updateSpeedTimer(dt);

  // Ny nivå om alla brickor är borta
  if (bricks.every(b => !b.alive)) {
    state = 'LEVEL_COMPLETE';
    pauseTimer = 90;
  }
}

function updatePaddle(_dt) {
  const accel = 2.5;
  const friction = 0.78;

  if (keys.left)  paddle.vx -= accel;
  if (keys.right) paddle.vx += accel;
  paddle.vx *= friction;
  paddle.x  += paddle.vx;

  // Klämning vid kanter
  paddle.x = Math.max(0, Math.min(W - paddle.width, paddle.x));
}

function updateBall(dt) {
  if (ballLaunch) {
    // Bollen följer paddeln tills SPACE trycks
    ball.x = paddle.x + paddle.width / 2;
    if (keys.space && !spaceConsumed) {
      spaceConsumed = true;
      ballLaunch = false;
    }
    return;
  }

  // Spara trail
  ball.trail.unshift({ x: ball.x, y: ball.y });
  if (ball.trail.length > 5) ball.trail.pop();

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Vänster/höger vägg
  if (ball.x - 3 < 0)   { ball.x = 3;     ball.vx = Math.abs(ball.vx); }
  if (ball.x + 3 > W)   { ball.x = W - 3; ball.vx = -Math.abs(ball.vx); }

  // Tak
  if (ball.y - 3 < PLAY_TOP) { ball.y = PLAY_TOP + 3; ball.vy = Math.abs(ball.vy); }

  // Paddel-kollision
  if (
    ball.vy > 0 &&
    ball.y + 3 >= PADDLE_Y &&
    ball.y - 3 <= PADDLE_Y + 5 &&
    ball.x >= paddle.x - 3 &&
    ball.x <= paddle.x + paddle.width + 3
  ) {
    const half   = paddle.width / 2;
    const offset = (ball.x - (paddle.x + half)) / half;  // -1 .. 1
    const angle  = offset * (55 * Math.PI / 180);
    const speed  = Math.hypot(ball.vx, ball.vy);
    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.abs(Math.cos(angle) * speed);
    ball.y  = PADDLE_Y - 3;
  }

  // Boll under spelplanen → liv förloras
  if (ball.y - 3 > PLAY_BOT) {
    lives--;
    if (score > hiscore) {
      hiscore = score;
      sessionStorage.setItem('bb_hiscore', String(hiscore));
    }
    state      = 'LIFE_LOST';
    pauseTimer = 60 + 8 * 8;  // blink-animation + paus
    ball.flashFrames = 0;
    ball.flashCount  = 0;
    return;
  }

  // Brickkollision
  checkBrickCollision();
}

function checkBrickCollision() {
  const bx = ball.x - 3, by = ball.y - 3, bw = 6, bh = 6;

  for (const brick of bricks) {
    if (!brick.alive) continue;

    const overlapX = Math.min(bx + bw, brick.x + BRICK_W) - Math.max(bx, brick.x);
    const overlapY = Math.min(by + bh, brick.y + BRICK_H) - Math.max(by, brick.y);

    if (overlapX <= 0 || overlapY <= 0) continue;

    // Avgör studskikt via minsta överlapp (SAT-liknande)
    if (overlapX < overlapY) {
      ball.vx = -ball.vx;
    } else {
      ball.vy = -ball.vy;
    }

    brick.alive = false;
    brick.flash = 1;  // vit blink i 1 frame

    const [,highlight,,points] = BRICK_COLORS[brick.row % BRICK_COLORS.length];
    const pts = points * level;
    score += pts;
    if (score > hiscore) {
      hiscore = score;
      sessionStorage.setItem('bb_hiscore', String(hiscore));
    }

    // Poäng-popup
    popups.push({
      x:      brick.x + BRICK_W / 2,
      y:      brick.y + BRICK_H / 2,
      text:   `+${pts}`,
      color:  highlight,
      dy:     -0.5,
      life:   40,
      maxLife: 40,
    });

    break;  // en kollision per frame
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

function updateShip(dt) {
  if (!ship) {
    shipTimer -= dt;
    if (shipTimer <= 0) spawnShip();
    return;
  }

  ship.x += ship.vx * dt;

  // AABB kollision: boll 6×6 mot skepp 19×7
  if (!ballLaunch && ball) {
    const sx = ship.x, sy = ship.y;
    if (
      ball.x + 3 > sx      && ball.x - 3 < sx + 19 &&
      ball.y + 3 > sy + 2  && ball.y - 3 < sy + 9
    ) {
      score += 100 * level;
      if (score > hiscore) {
        hiscore = score;
        sessionStorage.setItem('bb_hiscore', String(hiscore));
      }
      spawnExplosion(sx + 9, sy + 4);
      ship = null;
      shipTimer = randBetween(config.shipIntervalMin, config.shipIntervalMax);
      return;
    }
  }

  // Skepp lämnar spelplanen
  if (ship.vx > 0 && ship.x > W + 2) {
    ship = null;
    shipTimer = randBetween(config.shipIntervalMin, config.shipIntervalMax);
  } else if (ship.vx < 0 && ship.x + 19 < -2) {
    ship = null;
    shipTimer = randBetween(config.shipIntervalMin, config.shipIntervalMax);
  }
}

function spawnShip() {
  const goRight = Math.random() < 0.5;
  ship = {
    x:    goRight ? -20 : W + 2,
    y:    22,
    vx:   goRight ? 60 : -60,
    flip: !goRight,
  };
}

function updateSpeedTimer(dt) {
  if (ballLaunch) return;
  speedTimer -= dt;
  if (speedTimer <= 0) {
    speedTimer = 5;
    if (ball) {
      const currentSpeed = Math.hypot(ball.vx, ball.vy);
      const newSpeed = Math.min(currentSpeed + config.speedIncrement, config.maxSpeed);
      const ratio = newSpeed / currentSpeed;
      ball.vx *= ratio;
      ball.vy *= ratio;
    }
  }
}

function updatePopups(_dt) {
  for (const p of popups) {
    p.y    += p.dy;
    p.life -= 1;  // popups räknas i frames
  }
  popups = popups.filter(p => p.life > 0);
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x    += p.vx * dt;
    p.y    += p.vy * dt;
    p.vy   += 30 * dt;  // pixelgravitation
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
      x:     cx,
      y:     cy,
      vx:    Math.cos(angle) * speed,
      vy:    Math.sin(angle) * speed,
      size:  Math.random() < 0.5 ? 1 : 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      life:  1.0,
      decay: 0.6 + Math.random() * 0.8,
    });
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  if (!ctx) return;

  // Bakgrund
  ctx.fillStyle = '#05050f';
  ctx.fillRect(0, 0, W, H);

  if (state === 'IDLE') {
    renderIdle();
  } else if (state === 'GAME_OVER') {
    renderGameOver();
  } else {
    renderHUD();
    renderBricks();
    renderPaddle();
    renderBall();
    renderShip();
    renderPopups();
    renderParticles();

    if (state === 'LEVEL_COMPLETE') renderLevelComplete();
  }

  renderScanlines();
}

function renderIdle() {
  ctx.font = '10px "Press Start 2P"';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('BRICK BREAK', W / 2, 120);

  ctx.font = '6px "Press Start 2P"';
  ctx.fillStyle = frameCount % 60 < 30 ? '#ffdd00' : '#05050f';
  ctx.fillText('PRESS SPACE', W / 2, 160);
  ctx.fillStyle = frameCount % 60 < 30 ? '#ffdd00' : '#05050f';
  ctx.fillText('TO START', W / 2, 172);

  ctx.textAlign = 'left';
}

function renderGameOver() {
  renderHUD();

  ctx.font = '10px "Press Start 2P"';
  ctx.fillStyle = '#e74c3c';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W / 2, 140);

  ctx.font = '6px "Press Start 2P"';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`SCORE  ${String(score).padStart(5, '0')}`, W / 2, 158);
  ctx.fillStyle = '#ffdd00';
  ctx.fillText(`BEST   ${String(hiscore).padStart(5, '0')}`, W / 2, 170);

  ctx.fillStyle = frameCount % 60 < 30 ? '#ffdd00' : '#05050f';
  ctx.fillText('PRESS SPACE', W / 2, 190);

  ctx.textAlign = 'left';
}

function renderLevelComplete() {
  ctx.font = '8px "Press Start 2P"';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('LEVEL', W / 2, 150);
  ctx.fillStyle = '#ffdd00';
  ctx.fillText('CLEAR!', W / 2, 163);
  ctx.textAlign = 'left';
}

function renderHUD() {
  // Övre HUD
  ctx.font = '6px "Press Start 2P"';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`1P:  ${String(score).padStart(5, '0')}`, 4, 12);

  ctx.fillStyle = '#ffdd00';
  ctx.textAlign = 'right';
  ctx.fillText(`HISCORE: ${String(hiscore).padStart(5, '0')}`, 236, 12);

  // Separatorer
  ctx.fillStyle = '#1a1a3a';
  ctx.fillRect(0, HUD_TOP, W, 1);
  ctx.fillRect(0, HUD_BOT, W, 1);

  // Nedre HUD – liv som pixelcirklar
  for (let i = 0; i < lives; i++) {
    drawPixelCircle(ctx, 8 + i * 10, 311, CIRCLE_R3, '#4ac8ff');
  }

  // Nivå
  ctx.font = '6px "Press Start 2P"';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(`LEVEL ${level}`, 232, 317);

  ctx.textAlign = 'left';
}

function renderBricks() {
  for (const b of bricks) {
    if (!b.alive && b.flash <= 0) continue;

    const [fill, highlight, shadow] = BRICK_COLORS[b.row % BRICK_COLORS.length];

    if (b.flash > 0) {
      // Vit blink i 1 frame vid träff
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
      b.flash = 0;
      continue;
    }

    // Fyllning
    ctx.fillStyle = fill;
    ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);

    // Highlight (övre + vänstra kanten)
    ctx.fillStyle = highlight;
    ctx.fillRect(b.x, b.y, BRICK_W, 1);      // övre
    ctx.fillRect(b.x, b.y, 1, BRICK_H);      // vänster

    // Skugga (nedre + högra kanten)
    ctx.fillStyle = shadow;
    ctx.fillRect(b.x, b.y + BRICK_H - 1, BRICK_W, 1);  // nedre
    ctx.fillRect(b.x + BRICK_W - 1, b.y, 1, BRICK_H);  // höger
  }
}

function renderPaddle() {
  const { x, width } = paddle;

  ctx.fillStyle = '#5dade2';
  ctx.fillRect(x, PADDLE_Y, width, 1);          // highlight

  ctx.fillStyle = '#2980b9';
  ctx.fillRect(x, PADDLE_Y + 1, width, 3);      // mitten

  ctx.fillStyle = '#1a5276';
  ctx.fillRect(x, PADDLE_Y + 4, width, 1);      // skugga
}

function renderBall() {
  if (!ball) return;

  if (state === 'LIFE_LOST') {
    // Blinka vit/röd 8 gånger (4 frames per blink)
    if (ball.flashCount >= 8) return;
    const color = ball.flashFrames < 2 ? '#ffffff' : '#e74c3c';
    drawPixelCircle(ctx, Math.round(ball.x), Math.round(ball.y), CIRCLE_R3, color);
    return;
  }

  // Trail (baklänges, svagare och mindre)
  const trailMasks = [CIRCLE_R2, CIRCLE_R2, CIRCLE_R1, CIRCLE_R1, CIRCLE_R1];
  const trailAlpha = [0.5, 0.3, 0.2, 0.1, 0.05];
  for (let i = 0; i < ball.trail.length; i++) {
    ctx.globalAlpha = trailAlpha[i];
    drawPixelCircle(ctx, Math.round(ball.trail[i].x), Math.round(ball.trail[i].y), trailMasks[i], '#2a88bf');
  }
  ctx.globalAlpha = 1;

  // Boll
  const bx = Math.round(ball.x);
  const by = Math.round(ball.y);
  drawPixelCircle(ctx, bx, by, CIRCLE_R3, '#4ac8ff');

  // Highlight-pixel
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx - 1, by - 1, 1, 1);
}

function renderShip() {
  if (!ship) return;

  const sx = Math.round(ship.x);
  const sy = Math.round(ship.y);
  const lampOn = Math.floor(frameCount / 20) % 2 === 0;

  for (let row = 0; row < SHIP_ROWS.length; row++) {
    const rowData = SHIP_ROWS[row];
    for (let col = 0; col < rowData.length; col++) {
      const key = rowData[col];
      if (key === '.') continue;

      // Rita lampor separat (hanteras nedan)
      if (row === 6) continue;

      const color = SHIP_PALETTE[key];
      if (!color) continue;

      // Spegla sprite horisontellt vid vänster→höger-rörelse
      const px = ship.flip ? sx + (18 - col) : sx + col;
      ctx.fillStyle = color;
      ctx.fillRect(px, sy + row, 1, 1);
    }
  }

  // Lampor på rad 7
  for (const col of LAMP_COLS) {
    const px = ship.flip ? sx + (18 - col) : sx + col;
    ctx.fillStyle = lampOn ? '#ff44cc' : '#aa2288';
    ctx.fillRect(px, sy + 7, 1, 1);
  }
}

function renderPopups() {
  ctx.font = '5px "Press Start 2P"';
  ctx.textAlign = 'center';

  for (const p of popups) {
    const fadeStart = 15;
    if (p.life < fadeStart) {
      ctx.globalAlpha = p.life / fadeStart;
    }
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, Math.round(p.x), Math.round(p.y));
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'left';
}

function renderParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function renderScanlines() {
  // CRT-simulering: halvgenomskinliga horisontella linjer varannan rad
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 1; y < H; y += 2) {
    ctx.fillRect(0, y, W, 1);
  }
}

// ── Hjälpfunktioner ───────────────────────────────────────────────────────────

/**
 * Ritar en pixelcirkel via en fördefinierad offset-mask.
 * Aldrig arc() – alltid fillRect per pixel.
 */
function drawPixelCircle(ctx, cx, cy, mask, color) {
  ctx.fillStyle = color;
  for (const [dx, dy] of mask) {
    ctx.fillRect(cx + dx, cy + dy, 1, 1);
  }
}

/** Slumpmässigt heltal i intervallet [min, max]. */
function randBetween(min, max) {
  return min + Math.random() * (max - min);
}
