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

// Master gain + compressor para aumentar volumen percibido sin clipping
var _masterGain = null;
var _compressor = null;

function _getMaster(ctx){
  if(_masterGain && _compressor) return _masterGain;
  _compressor = ctx.createDynamicsCompressor();
  _compressor.threshold.value = -24;
  _compressor.knee.value = 30;
  _compressor.ratio.value = 12;
  _compressor.attack.value = 0.003;
  _compressor.release.value = 0.25;
  _masterGain = ctx.createGain();
  _masterGain.gain.value = 1.8; // boost global
  _masterGain.connect(_compressor);
  _compressor.connect(ctx.destination);
  return _masterGain;
}

// Helper: tono con frecuencia fija + envelope ADSR
function _tono(ctx, freq, startTime, duration, volume, type){
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(_getMaster(ctx));

  var vol = volume || 0.15;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(vol, startTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

// ── TAP — beep de scanner de supermercado ──
// Doble capa sine para mayor percepción de volumen:
// - 2000Hz principal (el "beep" limpio)
// - 2800Hz armónico superior (le da brillo y lo hace sentir más alto)
function sndTap(){
  if(sonidoMuteGet()) return;
  if(document.visibilityState === 'hidden') return;
  var ctx = _ensureAudioCtx();
  if(!ctx) return;
  try {
    var t = ctx.currentTime;
    _tono(ctx, 2000, t, 0.05, 0.95, 'sine');
    _tono(ctx, 2800, t, 0.05, 0.6,  'sine');
  } catch(e){}
}

// ── PEDIDO SATÉLITE — campana triple ──
function sndPedido(){
  if(sonidoMuteGet()) return;
  var ctx = _ensureAudioCtx();
  if(!ctx) return;
  try {
    var t = ctx.currentTime;
    _tono(ctx, 1320, t,          0.22, 0.7, 'sine'); // E6
    _tono(ctx, 1320, t + 0.26,   0.22, 0.7, 'sine');
    _tono(ctx, 990,  t + 0.52,   0.38, 0.7, 'sine'); // B5 final
  } catch(e){}
}

// ── COBRO EXITOSO — acorde ascendente ──
function sndCobro(){
  if(sonidoMuteGet()) return;
  var ctx = _ensureAudioCtx();
  if(!ctx) return;
  try {
    var t = ctx.currentTime;
    _tono(ctx, 523.25, t,          0.14, 0.55, 'triangle'); // C5
    _tono(ctx, 659.25, t + 0.10,   0.14, 0.55, 'triangle'); // E5
    _tono(ctx, 783.99, t + 0.20,   0.14, 0.55, 'triangle'); // G5
    _tono(ctx, 1046.5, t + 0.30,   0.35, 0.60, 'triangle'); // C6 sostenida
  } catch(e){}
}

// ── VOZ SINTÉTICA — anuncia el total al cobrar ──
// Usa Web Speech API (speechSynthesis) — disponible en Chrome/Android.
// Se configura con la mejor voz española disponible en el dispositivo.

function vozMuteGet(){
  return localStorage.getItem('pos_voz_mute') === '1';
}
function vozMuteSet(v){
  localStorage.setItem('pos_voz_mute', v ? '1' : '0');
}

var _vozEs = null;
function _findVozEs(){
  if(_vozEs) return _vozEs;
  if(!('speechSynthesis' in window)) return null;
  var voces = window.speechSynthesis.getVoices();
  if(!voces || !voces.length) return null;
  // Preferir es-PY, es-AR, luego cualquier español
  var preferidas = ['es-PY','es-AR','es-MX','es-US','es-ES','es-CL','es-CO'];
  for(var i=0; i<preferidas.length; i++){
    var v = voces.find(function(x){ return x.lang === preferidas[i]; });
    if(v){ _vozEs = v; return v; }
  }
  var fallback = voces.find(function(x){ return x.lang && x.lang.indexOf('es') === 0; });
  _vozEs = fallback;
  return fallback;
}

// Carga las voces al estar disponibles (lazy)
if('speechSynthesis' in window){
  window.speechSynthesis.addEventListener('voiceschanged', _findVozEs);
}

// Formatea un número grande en palabras simples para el TTS.
// Ej: 75000 → "setenta y cinco mil guaraníes"
// Mantenemos esto simple: dejamos que el TTS lea el número, solo le
// ponemos "guaraníes" al final. El TTS moderno lee números bien.
function _formatMontoVoz(n){
  n = parseInt(n) || 0;
  return n.toLocaleString('es-PY') + ' guaraníes';
}

function hablarCobro(monto){
  if(vozMuteGet()) return;
  if(!('speechSynthesis' in window)) return;
  try {
    // Cancelar utterance anterior si estaba hablando
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance();
    u.text = 'Total ' + _formatMontoVoz(monto);
    u.lang = 'es-PY';
    u.rate = 1.1;
    u.pitch = 1;
    u.volume = 1;
    var v = _findVozEs();
    if(v) u.voice = v;
    // Esperar un poco al sonido del cobro antes de hablar
    setTimeout(function(){
      try { window.speechSynthesis.speak(u); } catch(e){}
    }, 350);
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
