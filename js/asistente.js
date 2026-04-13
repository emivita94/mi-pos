// ── ASISTENTE DE VOZ BIDIRECCIONAL ──────────────────────────────
// Usa Web Speech API (SpeechRecognition) para escuchar al cajero y
// ejecutar comandos. Responde usando las funciones de voz existentes
// en sounds.js (hablarGenerico).
//
// Flujo:
//   1. Usuario toca el FAB 🎤 o dice "hey pos"
//   2. Se activa SpeechRecognition con lang='es-PY'
//   3. Al detectar speech, parsea el texto contra patrones conocidos
//   4. Ejecuta la acción
//   5. Responde con voz y toast visual
//
// Comandos soportados:
//   - "agregar/agrega [producto]"
//   - "cobrar [efectivo|tarjeta|transferencia|justo]"
//   - "confirmar pago"
//   - "nueva venta"
//   - "abrir mesa [número]"
//   - "cuánto llevo vendido"
//   - "total del turno"
//   - "cancelar" / "cerrar"
//   - "ayuda" (lista comandos)

var _recognition = null;
var _asistActivo = false;
var _asistEscuchando = false;

// Inicializa el reconocimiento de voz — sólo se ejecuta una vez
function _initAsistente(){
  if(_recognition) return _recognition;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    console.warn('[Asistente] SpeechRecognition no disponible');
    return null;
  }
  _recognition = new SR();
  _recognition.lang = 'es-PY';
  _recognition.continuous = false;
  _recognition.interimResults = false;
  _recognition.maxAlternatives = 3;

  _recognition.onstart = function(){
    _asistEscuchando = true;
    _asistMostrarOndas(true);
    console.log('[Asistente] Escuchando...');
  };

  _recognition.onresult = function(e){
    // Tomar la alternativa con mayor confianza
    var alternativas = [];
    for(var i = 0; i < e.results[0].length; i++){
      alternativas.push(e.results[0][i].transcript);
    }
    console.log('[Asistente] Escuché:', alternativas);
    _asistEjecutarComando(alternativas);
  };

  _recognition.onerror = function(e){
    console.warn('[Asistente] Error:', e.error);
    if(e.error === 'not-allowed'){
      _asistHablar('Permiso de micrófono denegado. Activalo en la configuración del navegador.');
      toast('⚠ Micrófono denegado');
    } else if(e.error === 'no-speech'){
      toast('No te escuché, volvé a tocar el micrófono');
    } else if(e.error !== 'aborted'){
      toast('Error del asistente: ' + e.error);
    }
    _asistMostrarOndas(false);
    _asistEscuchando = false;
  };

  _recognition.onend = function(){
    _asistEscuchando = false;
    _asistMostrarOndas(false);
  };

  return _recognition;
}

// Trigger manual — se llama desde el botón 🎤
function asistenteEscuchar(){
  var rec = _initAsistente();
  if(!rec){
    toast('Tu navegador no soporta reconocimiento de voz');
    return;
  }
  if(_asistEscuchando){
    // Segundo tap = cancelar
    try { rec.abort(); } catch(e){}
    return;
  }
  try {
    // Cancelar cualquier voz que esté hablando
    if('speechSynthesis' in window) window.speechSynthesis.cancel();
    rec.start();
  } catch(e){
    console.warn('[Asistente] No se pudo iniciar:', e.message);
    toast('Error al iniciar: ' + e.message);
  }
}

// ── PARSEO DE COMANDOS ──────────────────────────────────
function _asistEjecutarComando(alternativas){
  var textoPrimario = (alternativas[0] || '').toLowerCase().trim();
  if(!textoPrimario){
    _asistHablar('No entendí, volvé a intentarlo.');
    return;
  }

  // Normalizar: sacar acentos, puntuación
  var texto = _asistNormalizar(textoPrimario);

  // ── Comandos de navegación ──
  if(texto.match(/^(cancelar|cerrar|salir|atras|atr[aá]s)/)){
    toast('Cancelado');
    _asistHablar('Cancelado');
    return;
  }

  if(texto.match(/^(nueva venta|limpiar|vaciar carrito)/)){
    if(typeof nuevaVenta === 'function'){
      nuevaVenta();
      _asistHablar('Nueva venta');
    } else if(typeof finalizarRecibo === 'function'){
      finalizarRecibo();
      _asistHablar('Nueva venta');
    }
    return;
  }

  if(texto.match(/^(ayuda|help|qu[eé] puedo decir|comandos)/)){
    _asistHablar('Podés decir: agregar producto, cobrar efectivo, cobrar tarjeta, confirmar pago, efectivo justo, nueva venta, cuánto llevo vendido, o abrir mesa número.');
    return;
  }

  // ── Consultas informativas ──
  var matchTotal = texto.match(/^(cu[aá]nto|total|vent[aa]s?|llevo)\s*(vendid[oa]|vend[ií]|del turno|hoy)?/);
  if(matchTotal){
    _responderTotalTurno();
    return;
  }

  // ── Comandos de cobro ──
  if(texto.match(/^(confirmar|finalizar|cerrar)\s+(pago|cobro|venta)/)){
    if(typeof confirmarPago === 'function' && document.getElementById('scCobrar')
       && document.getElementById('scCobrar').classList.contains('active')){
      _asistHablar('Confirmando pago');
      setTimeout(function(){ confirmarPago(); }, 600);
    } else {
      _asistHablar('Primero tenés que estar en la pantalla de cobro');
    }
    return;
  }

  if(texto.match(/^(efectivo\s+justo|justo|monto\s+exacto|exacto)/)){
    if(typeof setEfectivoJusto === 'function'){
      setEfectivoJusto();
      _asistHablar('Efectivo justo seteado');
    } else {
      _asistHablar('No estoy en la pantalla de cobro');
    }
    return;
  }

  var matchCobrar = texto.match(/^(cobrar|cobr[aá]|pasar a cobro|ir a cobrar|cobro)(\s+(con\s+)?(efectivo|tarjeta|pos|transferencia|transfer))?/);
  if(matchCobrar){
    var metodo = matchCobrar[4] || 'efectivo';
    _iniciarCobroPorVoz(metodo);
    return;
  }

  // ── Comandos de mesa ──
  var matchMesa = texto.match(/^(abrir|ir a|mesa)\s*(mesa\s*)?(\d+)/);
  if(matchMesa){
    var nroMesa = parseInt(matchMesa[3]);
    _abrirMesaPorVoz(nroMesa);
    return;
  }

  // ── Agregar productos ──
  var matchAgregar = texto.match(/^(agregar|agreg[aá]|a[nñ]adir|a[nñ]ade|poner|pon[eé]|quiero|sumar|sum[aá])\s+(.+)/);
  if(matchAgregar){
    var nombreProducto = matchAgregar[2];
    // Puede empezar con cantidad: "dos pizzas"
    var matchCant = nombreProducto.match(/^(\d+|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(.+)/);
    var cantidad = 1;
    if(matchCant){
      cantidad = _asistParsearNumero(matchCant[1]);
      nombreProducto = matchCant[2];
    }
    _agregarProductoPorVoz(nombreProducto, cantidad);
    return;
  }

  // Fallback: intentar matchear el texto completo contra productos
  if(typeof PRODS !== 'undefined' && PRODS.length > 0){
    var prodMatch = _buscarProducto(texto);
    if(prodMatch){
      _agregarProductoPorVoz(texto, 1);
      return;
    }
  }

  _asistHablar('No entendí: ' + textoPrimario + '. Decí ayuda para ver los comandos.');
}

// ── HELPERS ──────────────────────────────────────────────

function _asistNormalizar(texto){
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[.,;:!?¿¡]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _asistParsearNumero(str){
  var map = {
    'uno':1, 'una':1, 'dos':2, 'tres':3, 'cuatro':4,
    'cinco':5, 'seis':6, 'siete':7, 'ocho':8, 'nueve':9, 'diez':10
  };
  if(map[str] !== undefined) return map[str];
  var n = parseInt(str);
  return isNaN(n) ? 1 : n;
}

function _buscarProducto(texto){
  if(typeof PRODS === 'undefined') return null;
  var nombreBuscado = _asistNormalizar(texto);
  // Primero match exacto
  var match = PRODS.find(function(p){
    if(!p.name || p.itemLibre) return false;
    return _asistNormalizar(p.name) === nombreBuscado;
  });
  if(match) return match;
  // Match por inclusión (busca si el nombre del producto está contenido en el texto hablado)
  match = PRODS.find(function(p){
    if(!p.name || p.itemLibre) return false;
    var nombreProd = _asistNormalizar(p.name);
    return nombreBuscado.indexOf(nombreProd) >= 0 || nombreProd.indexOf(nombreBuscado) >= 0;
  });
  if(match) return match;
  // Match por palabras en común (al menos 60% de palabras del producto presentes)
  var palabrasBuscadas = nombreBuscado.split(' ').filter(function(w){ return w.length > 2; });
  var mejor = null;
  var mejorScore = 0;
  PRODS.forEach(function(p){
    if(!p.name || p.itemLibre) return;
    var palabrasProd = _asistNormalizar(p.name).split(' ').filter(function(w){ return w.length > 2; });
    var comunes = palabrasProd.filter(function(w){ return palabrasBuscadas.indexOf(w) >= 0; }).length;
    var score = palabrasProd.length > 0 ? comunes / palabrasProd.length : 0;
    if(score > mejorScore && score >= 0.5){
      mejorScore = score;
      mejor = p;
    }
  });
  return mejor;
}

function _agregarProductoPorVoz(nombre, cantidad){
  var prod = _buscarProducto(nombre);
  if(!prod){
    _asistHablar('No encontré el producto ' + nombre);
    return;
  }
  if(typeof addCart !== 'function'){
    _asistHablar('No puedo agregar productos en esta pantalla');
    return;
  }
  // Asegurar que estamos en scSale
  if(typeof goTo === 'function'){
    var scSale = document.getElementById('scSale');
    if(scSale && !scSale.classList.contains('active')){
      goTo('scSale');
    }
  }
  for(var i = 0; i < cantidad; i++){
    addCart(prod.id);
  }
  _asistHablar(cantidad + ' ' + prod.name + (cantidad > 1 ? ' agregados' : ' agregado'));
}

function _iniciarCobroPorVoz(metodo){
  if(typeof calcTotal === 'function' && calcTotal() === 0){
    _asistHablar('El ticket está vacío');
    return;
  }
  if(typeof goCobrar !== 'function'){
    _asistHablar('No puedo cobrar desde esta pantalla');
    return;
  }
  goCobrar();
  // Esperar a que se abra la pantalla y seleccionar el método
  setTimeout(function(){
    var metodoNorm = metodo.toLowerCase();
    if(metodoNorm === 'tarjeta' || metodoNorm === 'pos'){
      _seleccionarMetodoPago('pos');
      _asistHablar('Cobrando con tarjeta');
    } else if(metodoNorm.indexOf('transfer') >= 0){
      _seleccionarMetodoPago('transferencia');
      _asistHablar('Cobrando por transferencia');
    } else {
      _seleccionarMetodoPago('efectivo');
      _asistHablar('Cobrando en efectivo');
    }
  }, 400);
}

function _seleccionarMetodoPago(metodo){
  if(typeof selPay !== 'function') return;
  // Buscar el botón correcto
  var btns = document.querySelectorAll('.pay-btn');
  for(var i = 0; i < btns.length; i++){
    var txt = (btns[i].textContent || '').toLowerCase();
    if(metodo === 'pos' && (txt.indexOf('pos') >= 0 || txt.indexOf('tarjeta') >= 0)){
      selPay(btns[i], 'pos');
      return;
    }
    if(metodo === 'transferencia' && txt.indexOf('transfer') >= 0){
      selPay(btns[i], 'transferencia');
      return;
    }
    if(metodo === 'efectivo' && txt.indexOf('efectivo') >= 0){
      selPay(btns[i], 'efectivo');
      return;
    }
  }
}

function _abrirMesaPorVoz(nro){
  if(typeof mesasMesas === 'undefined' || !mesasMesas.length){
    _asistHablar('No hay mesas configuradas');
    return;
  }
  // Buscar por nombre o número
  var mesa = mesasMesas.find(function(m){
    return m.nombre == String(nro) || m.nombre == ('Mesa ' + nro) || m.nombre.match(new RegExp('\\b' + nro + '\\b'));
  });
  if(!mesa){
    _asistHablar('No encontré la mesa ' + nro);
    return;
  }
  if(typeof onMesaTap === 'function'){
    onMesaTap(mesa.id);
    _asistHablar('Abriendo mesa ' + nro);
  } else {
    _asistHablar('No puedo abrir mesas en este modo');
  }
}

function _responderTotalTurno(){
  if(typeof turnoData === 'undefined' || !turnoData.ventas){
    _asistHablar('No hay turno abierto');
    return;
  }
  var totalVentas = turnoData.ventas.reduce(function(s,v){ return s + (v.total||0); }, 0);
  var cantVentas = turnoData.ventas.length;
  if(cantVentas === 0){
    _asistHablar('Todavía no hay ventas en este turno');
    return;
  }
  var formatted = Number(totalVentas).toLocaleString('es-PY');
  _asistHablar('Llevás ' + cantVentas + ' ventas por un total de ' + formatted + ' guaraníes');
}

// ── RESPUESTA POR VOZ ──────────────────────────────────
function _asistHablar(texto){
  if(typeof toast === 'function') toast('🤖 ' + texto);
  if(typeof vozMuteGet === 'function' && vozMuteGet()) return;
  if(!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance();
    u.text = texto;
    u.lang = 'es-PY';
    u.rate = 1.08;
    u.volume = 1;
    if(typeof _findVozEs === 'function'){
      var v = _findVozEs();
      if(v) u.voice = v;
    }
    window.speechSynthesis.speak(u);
  } catch(e){}
}

// ── UI: FAB FLOTANTE + ONDAS ANIMADAS ───────────────────
function _asistMostrarOndas(activo){
  var fab = document.getElementById('asistFab');
  if(!fab) return;
  if(activo){
    fab.classList.add('escuchando');
  } else {
    fab.classList.remove('escuchando');
  }
}

// Crear el FAB al cargar la página
function _asistCrearFab(){
  if(!document.body){
    console.warn('[Asistente] document.body no disponible aún, reintentando...');
    setTimeout(_asistCrearFab, 200);
    return;
  }
  if(document.getElementById('asistFab')){
    console.log('[Asistente] FAB ya existe');
    return;
  }
  var fab = document.createElement('button');
  fab.id = 'asistFab';
  fab.className = 'asist-fab';
  fab.title = 'Asistente de voz (toca para hablar)';
  // Estilos inline como fallback en caso de que el CSS no cargue
  fab.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'width:62px',
    'height:62px',
    'border-radius:50%',
    'background:linear-gradient(135deg,#4caf50 0%,#2e7d32 100%)',
    'border:3px solid rgba(255,255,255,.25)',
    'color:#fff',
    'box-shadow:0 6px 28px rgba(76,175,80,.6),0 2px 10px rgba(0,0,0,.4)',
    'cursor:pointer',
    'z-index:999999',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:0',
  ].join(';');
  fab.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:relative;z-index:2;">'
    + '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>'
    + '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>'
    + '<line x1="12" y1="19" x2="12" y2="23"/>'
    + '<line x1="8" y1="23" x2="16" y2="23"/>'
    + '</svg>'
    + '<span class="asist-ondas"><span></span><span></span><span></span></span>';
  fab.onclick = asistenteEscuchar;
  document.body.appendChild(fab);
  console.log('[Asistente] FAB creado y agregado al body ✓');
}

// Intentar crear el FAB en múltiples momentos para asegurar que se renderiza
console.log('[Asistente] Script cargado, estado DOM:', document.readyState);
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', _asistCrearFab);
} else {
  _asistCrearFab();
}
// Backup: también al window.load (por si acaso)
window.addEventListener('load', function(){
  if(!document.getElementById('asistFab')) _asistCrearFab();
});
// Último backup: después de 2 segundos, si aún no existe, crearlo
setTimeout(function(){
  if(!document.getElementById('asistFab')){
    console.warn('[Asistente] FAB no se creó en el flujo normal, forzando...');
    _asistCrearFab();
  }
}, 2000);
