/**
 * config.js – Applikationskonfiguration för Brick Break
 *
 * Alla speljusterbara parametrar samlas här.
 * Importera och överskrid valfria värden vid initiering:
 *   import { DEFAULT_CONFIG } from './config.js';
 *   BrickBreak.init('#game', { ...DEFAULT_CONFIG, lives: 5 });
 *
 * Miljö-specifika inställningar (t.ex. debug-läge) hanteras via
 * META_CONFIG nedan – dessa är inte avsedda att ändras av slutanvändaren.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Spel-konfiguration (exponeras via API och kan överskridas vid init)
// ──────────────────────────────────────────────────────────────────────────────
export const DEFAULT_CONFIG = {
  /** Antal bollar/liv spelaren börjar med */
  lives: 3,

  /** Bollens startfart i logiska pixlar per sekund */
  minSpeed: 150,

  /** Bollens maxfart i logiska pixlar per sekund */
  maxSpeed: 420,

  /** Hastighetsökning i px/s var 5:e sekund */
  speedIncrement: 4,

  /** Minsta antal sekunder mellan rymdskepp-spawns */
  shipIntervalMin: 60,

  /** Högsta antal sekunder mellan rymdskepp-spawns */
  shipIntervalMax: 120,

  /** Antal brickorader (1–8) */
  brickRows: 5,

  /** Canvas CSS-bredd i pixlar (intern upplösning = hälften) */
  canvasWidth: 480,

  /** Canvas CSS-höjd i pixlar (intern upplösning = hälften) */
  canvasHeight: 640,
};

// ──────────────────────────────────────────────────────────────────────────────
// Miljö- och debug-konfiguration (ändra här vid lokal utveckling)
// ──────────────────────────────────────────────────────────────────────────────
export const META_CONFIG = {
  /** Aktivera debug-läge: visar kollisionsboxar och FPS-räknare */
  debug: false,

  /** Spelversion – visas i konsolloggen vid start */
  version: '0.1.0',
};
