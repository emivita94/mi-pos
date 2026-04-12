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

// Devuelve todas las voces en español disponibles en el dispositivo
function listarVocesEs(){
  if(!('speechSynthesis' in window)) return [];
  var voces = window.speechSynthesis.getVoices() || [];
  return voces.filter(function(v){ return v.lang && v.lang.indexOf('es') === 0; });
}

// Heurística para detectar género por nombre conocido
var _NOMBRES_FEM = ['sabina','helena','paulina','monica','lucia','isabel','marisol','esperanza','laura','sofia','carmen','angelica','conchita','soledad'];
var _NOMBRES_MASC = ['raul','pablo','jorge','diego','carlos','miguel','javier','enrique','antonio','roberto','ricardo','juan','fernando','alberto'];

function generoVoz(v){
  if(!v || !v.name) return 'neutral';
  var n = v.name.toLowerCase();
  if(n.indexOf('female') >= 0 || n.indexOf('mujer') >= 0 || n.indexOf('femenin') >= 0) return 'female';
  if(n.indexOf('male') >= 0 || n.indexOf('hombre') >= 0 || n.indexOf('masculin') >= 0) return 'male';
  for(var i=0; i<_NOMBRES_FEM.length; i++) if(n.indexOf(_NOMBRES_FEM[i]) >= 0) return 'female';
  for(var i=0; i<_NOMBRES_MASC.length; i++) if(n.indexOf(_NOMBRES_MASC[i]) >= 0) return 'male';
  return 'neutral';
}

// Selección de voz guardada en localStorage
function vozSeleccionadaGet(){
  return localStorage.getItem('pos_voz_name') || '';
}
function vozSeleccionadaSet(nombre){
  localStorage.setItem('pos_voz_name', nombre || '');
}

function _findVozEs(){
  if(!('speechSynthesis' in window)) return null;
  var voces = listarVocesEs();
  if(!voces.length) return null;
  // Si el usuario seleccionó una voz específica, usarla
  var guardada = vozSeleccionadaGet();
  if(guardada){
    var v = voces.find(function(x){ return x.name === guardada; });
    if(v) return v;
  }
  // Si no, preferencias por región
  var preferidas = ['es-PY','es-AR','es-MX','es-US','es-ES','es-CL','es-CO'];
  for(var i=0; i<preferidas.length; i++){
    var v2 = voces.find(function(x){ return x.lang === preferidas[i]; });
    if(v2) return v2;
  }
  return voces[0];
}

// Forzar carga inicial de voces (algunos browsers las cargan lazy)
if('speechSynthesis' in window){
  window.speechSynthesis.addEventListener('voiceschanged', function(){});
  // Trigger inicial
  try { window.speechSynthesis.getVoices(); } catch(e){}
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
    u.rate = 1.05;
    u.pitch = 1;
    u.volume = 1;
    var v = _findVozEs();
    if(v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch(e){}
}

// Anuncia el vuelto al cliente ("Vuelto 70.000 guaraníes")
function hablarVuelto(monto){
  if(vozMuteGet()) return;
  if(!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance();
    u.text = 'Vuelto ' + _formatMontoVoz(monto);
    u.lang = 'es-PY';
    u.rate = 1.05;
    u.pitch = 1;
    u.volume = 1;
    var v = _findVozEs();
    if(v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch(e){}
}

// Probar una voz específica con un monto ejemplo
function probarVoz(nombreVoz){
  if(!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance();
    u.text = 'Total 75.000 guaraníes';
    u.lang = 'es-PY';
    u.rate = 1.05;
    u.volume = 1;
    if(nombreVoz){
      var voces = listarVocesEs();
      var v = voces.find(function(x){ return x.name === nombreVoz; });
      if(v) u.voice = v;
    }
    window.speechSynthesis.speak(u);
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
