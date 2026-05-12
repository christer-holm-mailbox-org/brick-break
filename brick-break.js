/**
 * brick-break.js – Huvud-modul för Brick Break
 *
 * Inbäddningsbart Breakout-inspirerat arkadspel med pixelkonst-estetik.
 * Exponerar ett enkelt API: BrickBreak.init(selector, options) och BrickBreak.destroy().
 *
 * Användning:
 *   import { BrickBreak } from './brick-break.js';
 *   BrickBreak.init('#game', { lives: 3 });
 */

import { DEFAULT_CONFIG, META_CONFIG } from './config.js';

// ──────────────────────────────────────────────────────────────────────────────
// Publik API – exporteras som namngivet ES-modulexport
// ──────────────────────────────────────────────────────────────────────────────
export const BrickBreak = { init, destroy };

// ──────────────────────────────────────────────────────────────────────────────
// Modulscoped state (nollställs vid destroy)
// ──────────────────────────────────────────────────────────────────────────────
let canvas = null;
let ctx = null;
let animFrameId = null;
let config = {};

/**
 * Initierar spelet i angiven container.
 * @param {string} selector – CSS-selector för container-elementet
 * @param {object} options  – Valfria överskridanden av DEFAULT_CONFIG
 */
function init(selector, options = {}) {
  if (META_CONFIG.debug) {
    console.log(`[BrickBreak v${META_CONFIG.version}] init`, options);
  }

  // Slå ihop användarens alternativ med standardvärden
  config = { ...DEFAULT_CONFIG, ...options };

  const container = document.querySelector(selector);
  if (!container) {
    console.error(`[BrickBreak] Hittade inget element för selector: ${selector}`);
    return;
  }

  // Skapa canvas och konfigurera intern (lågupplöst) storlek
  canvas = document.createElement('canvas');
  canvas.width  = config.canvasWidth  / 2;  // logisk upplösning = halva CSS-storleken
  canvas.height = config.canvasHeight / 2;
  container.appendChild(canvas);

  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;  // avgörande för pixelkonst – inga suddiga kanter

  // TODO: initiera spelstatus, brickor, paddel, boll och starta loop
  loop();
}

/**
 * Städar upp och frigör alla resurser (lyssnare, animation-frame, DOM-element).
 * Anropa när spelet ska tas bort från sidan.
 */
function destroy() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (canvas && canvas.parentNode) {
    canvas.parentNode.removeChild(canvas);
  }
  canvas = null;
  ctx    = null;
  config = {};
}

// ──────────────────────────────────────────────────────────────────────────────
// Spelloop (stub – fylls på under implementationen)
// ──────────────────────────────────────────────────────────────────────────────
let lastTimestamp = 0;

function loop(timestamp = 0) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);  // delta-time i sekunder, max 50ms
  lastTimestamp = timestamp;

  update(dt);
  render();

  animFrameId = requestAnimationFrame(loop);
}

function update(_dt) {
  // TODO: uppdatera spelstatus per frame
}

function render() {
  if (!ctx) return;
  ctx.fillStyle = '#05050f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // TODO: rita HUD, brickor, paddel, boll, partiklar
}
