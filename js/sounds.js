// ── SONIDOS UX — feedback auditivo del POS ────────────────────
// Usa Web Audio API con osciladores generados (sin archivos).
//
// Sonidos:
//   sndTap()    → click corto al agregar producto al ticket
//   sndPedido() → campana triple cuando llega pedido del satélite
//   sndCobro()  → acorde ascendente al confirmar cobro
//
// Mute:
//   sonidoMuteGet() / sonidoMuteSet(bool) → persiste en localStorage
//   sonidoToggle() → alterna y devuelve el estado
//
// El AudioContext se crea lazy en la primera llamada (autoplay policy).
// Si está mute o el context no se pudo crear, las funciones son no-op.

var _audioCtx = null;
var _sonidoInit = false;

function _ensureAudioCtx(){
  if(_audioCtx) return _audioCtx;
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return null;
    _audioCtx = new Ctx();
    _sonidoInit = true;
    return _audioCtx;
  } catch(e){
    console.warn('[Sounds] AudioContext no disponible:', e.message);
    return null;
  }
}

function sonidoMuteGet(){
  return localStorage.getItem('pos_sonido_mute') === '1';
}
function sonidoMuteSet(v){
  localStorage.setItem('pos_sonido_mute', v ? '1' : '0');
}
function sonidoToggle(){
  var muted = !sonidoMuteGet();
  sonidoMuteSet(muted);
  return muted;
}

// Helper: reproduce un tono con envelope ADSR simple
function _tono(ctx, freq, startTime, duration, volume, type){
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);

  // Envelope: attack corto, decay exponencial
  var vol = volume || 0.15;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(vol, startTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

// ── TAP — click corto al agregar producto ──
// Duración ~60ms, frecuencia media-alta, volumen bajo.
// Se repite ~500 veces/día → debe ser NO fatigante.
function sndTap(){
  if(sonidoMuteGet()) return;
  // No reproducir taps si la app está en background
  if(document.visibilityState === 'hidden') return;
  var ctx = _ensureAudioCtx();
  if(!ctx) return;
  try {
    var t = ctx.currentTime;
    _tono(ctx, 1200, t, 0.05, 0.08, 'sine');
  } catch(e){}
}

// ── PEDIDO SATÉLITE — campana triple ──
// 3 tonos descendentes tipo "ding-ding-ding" para llamar atención.
// Se reproduce incluso en background porque es crítico.
function sndPedido(){
  if(sonidoMuteGet()) return;
  var ctx = _ensureAudioCtx();
  if(!ctx) return;
  try {
    var t = ctx.currentTime;
    // Tres campanas descendentes
    _tono(ctx, 880, t,          0.18, 0.20, 'triangle'); // A5
    _tono(ctx, 880, t + 0.22,   0.18, 0.20, 'triangle');
    _tono(ctx, 660, t + 0.44,   0.30, 0.20, 'triangle'); // E5 más largo
  } catch(e){}
}

// ── COBRO EXITOSO — acorde mayor ascendente ──
// C5 → E5 → G5 → C6 (acorde de Do mayor ascendente)
// Duración total ~400ms, evoca caja registradora.
function sndCobro(){
  if(sonidoMuteGet()) return;
  var ctx = _ensureAudioCtx();
  if(!ctx) return;
  try {
    var t = ctx.currentTime;
    _tono(ctx, 523.25, t,          0.10, 0.18, 'square'); // C5
    _tono(ctx, 659.25, t + 0.08,   0.10, 0.16, 'square'); // E5
    _tono(ctx, 783.99, t + 0.16,   0.10, 0.14, 'square'); // G5
    _tono(ctx, 1046.5, t + 0.24,   0.25, 0.18, 'square'); // C6 — nota final sostenida
  } catch(e){}
}

// Inicialización en el primer toque (necesario para autoplay policy)
document.addEventListener('touchstart', function _sInitT(){
  _ensureAudioCtx();
  if(_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
}, { passive: true, once: true });

document.addEventListener('click', function _sInitC(){
  _ensureAudioCtx();
  if(_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
}, { once: true });
