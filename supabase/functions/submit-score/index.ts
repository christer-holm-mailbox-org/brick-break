import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Maximalt rimlig poäng per spelad sekund – grov övre gräns mot fuskat
const MAX_SCORE_PER_SECOND = 500;

// Läser in HMAC-hemligheten som lagts in under Project Settings → Edge Functions
const HMAC_SECRET = Deno.env.get('SCORE_HMAC_SECRET') ?? '';

// Beräknar HMAC-SHA256 och returnerar hex-sträng
async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Tidskonstant jämförelse – förhindrar timing-attacker
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  // CORS – tillåt anrop från alla origins (spelet kan bäddas in var som helst)
  // Måste deklareras innan metod-kontrollen så att OPTIONS-preflight får rätt headers
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  };

  // Svara på CORS preflight-anrop innan övrig validering
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Tillåt bara POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: { name?: string; score?: number; bricksDestroyed?: number; timePlayed?: number; token?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Ogiltig JSON' }), { status: 400, headers: corsHeaders });
  }

  const { name, score, bricksDestroyed, timePlayed, token } = body;

  // ── Grundläggande indatavalidering ──────────────────────────────────────────
  if (
    typeof name          !== 'string'  ||
    typeof score         !== 'number'  ||
    typeof bricksDestroyed !== 'number' ||
    typeof timePlayed    !== 'number'  ||
    typeof token         !== 'string'
  ) {
    return new Response(JSON.stringify({ error: 'Saknade fält' }), { status: 400, headers: corsHeaders });
  }

  const cleanName = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  if (cleanName.length < 1) {
    return new Response(JSON.stringify({ error: 'Ogiltigt namn' }), { status: 400, headers: corsHeaders });
  }

  // ── Rimlighetskontroll ───────────────────────────────────────────────────────
  if (score < 0 || score > 999_999) {
    return new Response(JSON.stringify({ error: 'Ogiltig poäng' }), { status: 400, headers: corsHeaders });
  }

  if (timePlayed > 0 && score / timePlayed > MAX_SCORE_PER_SECOND) {
    return new Response(JSON.stringify({ error: 'Orimlig poäng' }), { status: 400, headers: corsHeaders });
  }

  // ── HMAC-verifiering ─────────────────────────────────────────────────────────
  // Spelet beräknar token = HMAC(secret, "score={score}&bricks={bricksDestroyed}")
  const expectedToken = await hmacHex(HMAC_SECRET, `score=${score}&bricks=${bricksDestroyed}`);
  if (!safeEqual(expectedToken, token)) {
    return new Response(JSON.stringify({ error: 'Ogiltig token' }), { status: 403, headers: corsHeaders });
  }

  // ── Lagra i databasen ────────────────────────────────────────────────────────
  // service_role-nyckeln injiceras automatiskt av Supabase runtime – aldrig exponerad
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error: insertError } = await supabase
    .from('hiscores')
    .insert({ name: cleanName, score });

  if (insertError) {
    console.error('DB-fel:', insertError.message);
    return new Response(JSON.stringify({ error: 'Databasfel' }), { status: 500, headers: corsHeaders });
  }

  // ── Returnera uppdaterad top-10 ──────────────────────────────────────────────
  const { data: topScores, error: selectError } = await supabase
    .from('hiscores')
    .select('name, score')
    .order('score', { ascending: false })
    .limit(10);

  if (selectError) {
    return new Response(JSON.stringify({ error: 'Kunde inte hämta hiscore' }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true, hiscores: topScores }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
