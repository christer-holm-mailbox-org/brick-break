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

  /** Paddelns startbredd i logiska pixlar */
  paddleStartWidth: 40,

  /** Paddelns minsta tillåtna bredd i logiska pixlar */
  paddleMinWidth: 20,

  /** Sekunder mellan varje steg av paddelkrympning (1px per steg) */
  paddleShrinkInterval: 8,

  /** Antal brickor spelaren måste träffa innan bollhastigheten ökar ett steg */
  speedHitInterval: 10,

  /** Minimihastigheten höjs med detta värde (px/s) per ny karta */
  levelSpeedStep: 10,

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

  /** Sekunder som titelskärmen visas i attract-läget */
  attractTitleTime: 6,

  /** Sekunder som demo-spelet körs i attract-läget */
  attractDemoTime: 14,

  /** Sekunder som hiscoreskärmen visas i attract-läget */
  attractHiscoreTime: 5,
};

// ──────────────────────────────────────────────────────────────────────────────
// Supabase-konfiguration
// anon-nyckeln är publik (read-only via RLS) – säker att exponera i klientkod.
// HMAC-hemligheten skyddas av obfuskering i build-steget och finns även
// server-side i Edge Function secrets (SCORE_HMAC_SECRET).
// ──────────────────────────────────────────────────────────────────────────────
export const SUPABASE_CONFIG = {
  /** Projektets bas-URL från Supabase Project Settings → API */
  url:    'https://zxbeyxaxmikrbcppvuex.supabase.co',

  /** Anon/public-nyckel – tillåter publika SELECT-anrop via RLS */
  anon:   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4YmV5eGF4bWlrcmJjcHB2dWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Mzg1MzYsImV4cCI6MjA5NDIxNDUzNn0.yxprrlKhoxBD8MkO6eXNCoUs2iBtz_U5lI33P1Y0g9o',

  /** Edge Function-URL för poänginlämning */
  fnUrl:  'https://zxbeyxaxmikrbcppvuex.supabase.co/functions/v1/submit-score',

  /** HMAC-SHA256-hemlighet – måste matcha SCORE_HMAC_SECRET i Edge Function */
  secret: 'b08e369325a7aa329c7e3fad24943d8a86b6cf61c603519f736b7f2f95bc8bec',
};
