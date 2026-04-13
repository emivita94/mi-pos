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

// ── Modo conversación continua ─────────────────────────
var _asistModoConversacion = false;
var _asistSilencioTimer = null;
var _asistCountdownTimer = null;
var _asistSilencioMs = 12000;      // 12s sin voz = salir
var _asistUltimoInterim = '';
var _asistUltimoFinal = '';
var _asistReiniciando = false;     // bandera para reiniciar rec tras onend

// ── Disambiguación ─────────────────────────────────────
var _asistDisambiguacion = null;   // { candidatos:[], callback:fn, intentos:N, textoOriginal:str }

// ── Aliases (IndexedDB) ────────────────────────────────
var _asistDb = null;
var _asistAliasCache = {};         // { aliasNormalizado: productoId }
var _asistAliasMem = false;        // true cuando falló IndexedDB y vamos en memoria

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
  _recognition.continuous = true;     // modo conversación
  _recognition.interimResults = true; // para transcripción en vivo
  _recognition.maxAlternatives = 3;

  _recognition.onstart = function(){
    _asistEscuchando = true;
    _asistMostrarOndas(true);
    console.log('[Asistente] Escuchando...');
  };

  _recognition.onresult = function(e){
    var interim = '';
    var finales = [];
    for(var i = e.resultIndex; i < e.results.length; i++){
      var res = e.results[i];
      if(res.isFinal){
        var alts = [];
        for(var k = 0; k < res.length; k++) alts.push(res[k].transcript);
        finales.push(alts);
      } else {
        interim += res[0].transcript;
      }
    }

    // Cualquier actividad de voz resetea el silencio
    _asistResetSilencio();

    if(interim){
      _asistUltimoInterim = interim;
      _asistTranscripcionUpdate(interim, false);
    }

    for(var j = 0; j < finales.length; j++){
      var alternativas = finales[j];
      _asistUltimoFinal = alternativas[0] || '';
      _asistUltimoInterim = '';
      console.log('[Asistente] Escuché (final):', alternativas);
      _asistTranscripcionUpdate(_asistUltimoFinal, true);

      // Chequear frases de salida ANTES de limpiar muletillas
      // (porque "listo" también figura en la lista de muletillas)
      var textoCrudo = _asistNormalizar(alternativas[0] || '');
      if(_asistEsFraseSalida(textoCrudo)){
        _asistHablar('Chau, hasta luego');
        _asistSalirConversacion();
        return;
      }

      // ¿Estamos esperando respuesta de disambiguación?
      if(_asistDisambiguacion){
        var textoLimpio = _asistLimpiarMuletillas(textoCrudo);
        _asistResolverDisambiguacion(textoLimpio);
      } else {
        _asistEjecutarComando(alternativas);
      }
    }
  };

  _recognition.onerror = function(e){
    console.warn('[Asistente] Error:', e.error);
    if(e.error === 'not-allowed'){
      _asistHablar('Permiso de micrófono denegado. Activalo en la configuración del navegador.');
      toast('⚠ Micrófono denegado');
      _asistSalirConversacion();
    } else if(e.error === 'no-speech'){
      // En modo conversación no avisamos, seguimos escuchando (se reinicia onend)
      if(!_asistModoConversacion){
        toast('No te escuché, volvé a tocar el micrófono');
      }
    } else if(e.error === 'aborted'){
      // ignorar
    } else {
      toast('Error del asistente: ' + e.error);
      _asistSalirConversacion();
    }
  };

  _recognition.onend = function(){
    _asistEscuchando = false;
    // Si seguimos en modo conversación, reiniciar el recognition
    if(_asistModoConversacion){
      try {
        _asistReiniciando = true;
        _recognition.start();
      } catch(e){
        // Ya reiniciando, ignorar
        setTimeout(function(){
          if(_asistModoConversacion){
            try { _recognition.start(); } catch(e2){ _asistSalirConversacion(); }
          }
        }, 250);
      }
      return;
    }
    _asistMostrarOndas(false);
    _asistTranscripcionOcultar();
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
  // Asegurar que aliases estén cargados
  _asistAliasInit();

  if(_asistModoConversacion){
    // Segundo tap durante conversación = salir
    _asistHablar('Listo');
    _asistSalirConversacion();
    return;
  }
  if(_asistEscuchando){
    try { rec.abort(); } catch(e){}
    return;
  }
  try {
    if('speechSynthesis' in window) window.speechSynthesis.cancel();
    _asistEntrarConversacion();
    rec.start();
  } catch(e){
    console.warn('[Asistente] No se pudo iniciar:', e.message);
    toast('Error al iniciar: ' + e.message);
    _asistModoConversacion = false;
  }
}

// ── CONVERSACIÓN CONTINUA ──────────────────────────────
function _asistEntrarConversacion(){
  _asistModoConversacion = true;
  _asistDisambiguacion = null;
  _asistUltimoInterim = '';
  _asistUltimoFinal = '';
  _asistTranscripcionMostrar();
  _asistResetSilencio();
  console.log('[Asistente] → Modo conversación');
}

function _asistSalirConversacion(){
  _asistModoConversacion = false;
  _asistDisambiguacion = null;
  if(_asistSilencioTimer){ clearTimeout(_asistSilencioTimer); _asistSilencioTimer = null; }
  if(_asistCountdownTimer){ clearInterval(_asistCountdownTimer); _asistCountdownTimer = null; }
  try { if(_recognition) _recognition.abort(); } catch(e){}
  _asistMostrarOndas(false);
  _asistTranscripcionOcultar();
  console.log('[Asistente] ← Fin conversación');
}

function _asistResetSilencio(){
  if(_asistSilencioTimer){ clearTimeout(_asistSilencioTimer); _asistSilencioTimer = null; }
  if(_asistCountdownTimer){ clearInterval(_asistCountdownTimer); _asistCountdownTimer = null; }
  if(!_asistModoConversacion) return;

  var inicio = Date.now();
  _asistSilencioTimer = setTimeout(function(){
    console.log('[Asistente] Silencio prolongado, saliendo');
    _asistHablar('Chau');
    _asistSalirConversacion();
  }, _asistSilencioMs);

  // Countdown visible en los últimos 5s
  _asistCountdownTimer = setInterval(function(){
    if(!_asistModoConversacion){ clearInterval(_asistCountdownTimer); return; }
    var transcurrido = Date.now() - inicio;
    var restante = Math.ceil((_asistSilencioMs - transcurrido) / 1000);
    if(restante <= 5 && restante > 0){
      _asistTranscripcionCountdown(restante);
    } else {
      _asistTranscripcionCountdown(0);
    }
  }, 500);
}

var _ASIST_SALIDA_RE = /^(listo|chau|chao|terminado|terminar|ya\s+est[aá]|gracias|salir|fuera|adios|adi[oó]s|listo\s+gracias|chau\s+gracias|nada\s+mas|nada\s+m[aá]s)$/;
function _asistEsFraseSalida(texto){
  if(!texto) return false;
  return _ASIST_SALIDA_RE.test(texto.trim());
}

// ── PARSEO DE COMANDOS (v2 — NLP extendido) ──────────────────────
//
// Soporta gramática paraguaya/rioplatense con voseo/tuteo, muletillas
// ("che", "dale", "hey pos"), números hablados, fuzzy matching con
// Levenshtein, comandos encadenados con "y", y contexto de pantalla.

// Respuestas naturales variadas
var _ASIST_FRASES = {
  agregado: [
    'Listo, agregué {n} {p}',
    'Ahí va, {n} {p}',
    'Perfecto, {n} {p} al ticket',
    'Ok, sumé {n} {p}'
  ],
  quitado: [
    'Ok, saqué {p}',
    'Listo, quitado',
    'Eliminado del ticket'
  ],
  cobrando: ['Yendo a cobrar', 'Dale, pasando a cobro', 'Pasamos a cobrar'],
  confirmado: ['Listo, venta confirmada', 'Perfecto, cobrado', 'Ahí va, pago confirmado'],
  noEntendi: ['No te entendí, repetí por favor', 'No capté eso', 'Perdón, no agarré qué querés hacer'],
  vacio: ['El ticket está vacío', 'Primero agregá algún producto']
};

function _asistFrase(key, vars){
  var arr = _ASIST_FRASES[key] || ['Ok'];
  var f = arr[Math.floor(Math.random() * arr.length)];
  if(vars){
    for(var k in vars){ f = f.replace(new RegExp('\\{'+k+'\\}','g'), vars[k]); }
  }
  return f;
}

function _asistNormalizar(texto){
  return (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?¿¡]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Saca muletillas y wake words: "hey pos", "che", "dale", "a ver", etc.
function _asistLimpiarMuletillas(texto){
  var rels = [
    /^(hey\s+pos|hey\s+post|hey|oye\s+pos|okey\s+pos|ok\s+pos|che\s+pos)\s+/gi,
    /^(che|mira|miri|oye|oi|hola|bueno|ok|okey)\s+/gi,
    /^(por\s+favor|porfa|porfis)\s+/gi,
    /\b(por\s+favor|porfa|porfis)\b/gi,
    /^(quiero|quisiera|necesito|me\s+pod[eé]s|pod[eé]s)\s+/gi,
    /^(anda|andate|dale\s+que|vamos|vamo|a\s+ver|aver|listo)\s+/gi,
    /\b(un\s+poco|un\s+poquito|dale|listo)\b/gi,   // "vendeme un poco" → "vendeme"
    /^(que\s+se)\s+/gi
  ];
  var t = ' ' + texto + ' ';
  rels.forEach(function(r){ t = t.replace(r, ' '); });
  return t.replace(/\s+/g,' ').trim();
}

// Números hablados: "cincuenta mil" → 50000
function _asistParsearNumeroHablado(texto){
  if(texto == null) return NaN;
  var t = _asistNormalizar(String(texto));
  if(!t) return NaN;

  var limpio = t.replace(/\./g,'').replace(/,/g,'');
  var mK = limpio.match(/^(\d+(?:\.\d+)?)\s*k\b/);
  if(mK) return Math.round(parseFloat(mK[1]) * 1000);
  var mMil = limpio.match(/^(\d+(?:\.\d+)?)\s*mil\b/);
  if(mMil) return Math.round(parseFloat(mMil[1]) * 1000);
  var mMillon = limpio.match(/^(\d+(?:\.\d+)?)\s*millon(?:es)?\b/);
  if(mMillon) return Math.round(parseFloat(mMillon[1]) * 1000000);
  if(/^\d+$/.test(limpio)) return parseInt(limpio, 10);

  var unidades = {
    'cero':0,'un':1,'uno':1,'una':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,
    'seis':6,'siete':7,'ocho':8,'nueve':9,'diez':10,'once':11,'doce':12,
    'trece':13,'catorce':14,'quince':15,'dieciseis':16,'diecisiete':17,
    'dieciocho':18,'diecinueve':19,'veinte':20,'veintiuno':21,'veintiun':21,
    'veintidos':22,'veintitres':23,'veinticuatro':24,'veinticinco':25,
    'veintiseis':26,'veintisiete':27,'veintiocho':28,'veintinueve':29
  };
  var decenas = {
    'treinta':30,'cuarenta':40,'cincuenta':50,'sesenta':60,
    'setenta':70,'ochenta':80,'noventa':90
  };
  var centenas = {
    'cien':100,'ciento':100,'doscientos':200,'doscientas':200,
    'trescientos':300,'trescientas':300,'cuatrocientos':400,'cuatrocientas':400,
    'quinientos':500,'quinientas':500,'seiscientos':600,'seiscientas':600,
    'setecientos':700,'setecientas':700,'ochocientos':800,'ochocientas':800,
    'novecientos':900,'novecientas':900
  };

  var palabras = t.split(/\s+/).filter(Boolean);
  var total = 0, actual = 0, hubo = false;
  for(var i = 0; i < palabras.length; i++){
    var w = palabras[i];
    if(w === 'y' || w === 'de') continue;
    if(/^\d+$/.test(w)){ actual += parseInt(w,10); hubo = true; continue; }
    if(unidades[w] !== undefined){ actual += unidades[w]; hubo = true; continue; }
    if(decenas[w] !== undefined){ actual += decenas[w]; hubo = true; continue; }
    if(centenas[w] !== undefined){ actual += centenas[w]; hubo = true; continue; }
    if(w === 'mil'){
      actual = (actual === 0 ? 1 : actual) * 1000;
      total += actual; actual = 0; hubo = true; continue;
    }
    if(w === 'millon' || w === 'millones'){
      actual = (actual === 0 ? 1 : actual) * 1000000;
      total += actual; actual = 0; hubo = true; continue;
    }
    break;
  }
  total += actual;
  return hubo ? total : NaN;
}

// Extrae primer número hablado dentro de una frase larga
function _asistExtraerNumero(texto){
  var t = _asistNormalizar(texto);
  var tokens = t.split(' ');
  var palabrasNum = /^(cero|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintiun|veintidos|veintitres|veinticuatro|veinticinco|veintiseis|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|doscientas|trescientos|trescientas|cuatrocientos|cuatrocientas|quinientos|quinientas|seiscientos|seiscientas|setecientos|setecientas|ochocientos|ochocientas|novecientos|novecientas|mil|millon|millones|y|de)$/;
  var esNumTok = function(w){ return /^\d/.test(w) || palabrasNum.test(w) || /^\d+k$/.test(w); };

  for(var i = 0; i < tokens.length; i++){
    if(!esNumTok(tokens[i])) continue;
    var j = i;
    while(j < tokens.length && esNumTok(tokens[j])) j++;
    var frag = tokens.slice(i, j).join(' ');
    frag = frag.replace(/(\s+(y|de))+$/,'').trim();
    var v = _asistParsearNumeroHablado(frag);
    if(!isNaN(v) && v > 0) return { valor: v, inicio: i, fin: j };
    i = j - 1;
  }
  return null;
}

// Fuzzy matching: Levenshtein
function _asistLevenshtein(a, b){
  if(a === b) return 0;
  if(!a.length) return b.length;
  if(!b.length) return a.length;
  var prev = new Array(b.length + 1), curr = new Array(b.length + 1);
  for(var j = 0; j <= b.length; j++) prev[j] = j;
  for(var i = 1; i <= a.length; i++){
    curr[0] = i;
    for(var k = 1; k <= b.length; k++){
      var cost = a.charCodeAt(i-1) === b.charCodeAt(k-1) ? 0 : 1;
      curr[k] = Math.min(curr[k-1]+1, prev[k]+1, prev[k-1]+cost);
    }
    var tmp = prev; prev = curr; curr = tmp;
  }
  return prev[b.length];
}

function _asistSimilitud(a, b){
  if(!a || !b) return 0;
  var maxL = Math.max(a.length, b.length);
  if(!maxL) return 1;
  return 1 - (_asistLevenshtein(a, b) / maxL);
}

var _ASIST_SINONIMOS = {
  'coca':'gaseosa','cola':'gaseosa','bebida':'gaseosa','refresco':'gaseosa',
  'chela':'cerveza','birra':'cerveza','rubia':'cerveza',
  'piza':'pizza','pizzsa':'pizza',
  'hamburger':'hamburguesa','burger':'hamburguesa','burguer':'hamburguesa',
  'aguita':'agua','cafecito':'cafe'
};

function _asistSingularizar(w){
  if(w.length > 4 && /es$/.test(w)) return w.slice(0,-2);
  if(w.length > 3 && /s$/.test(w))  return w.slice(0,-1);
  return w;
}

function _asistTokensProducto(texto){
  return _asistNormalizar(texto).split(/\s+/)
    .filter(function(w){ return w.length > 1; })
    .map(function(w){ return _ASIST_SINONIMOS[w] || _asistSingularizar(w); });
}

// Versión completa: devuelve { mejor, mejorScore, alternativas }
function _buscarProductosConAlternativas(texto){
  if(typeof PRODS === 'undefined' || !PRODS.length) return { mejor:null, mejorScore:0, alternativas:[] };
  var buscado = _asistNormalizar(texto);
  if(!buscado) return { mejor:null, mejorScore:0, alternativas:[] };

  // 1) Alias aprendido (lookup instantáneo)
  var aliasProd = _asistAliasBuscar(buscado);
  if(aliasProd){
    return { mejor: aliasProd, mejorScore: 1, alternativas: [aliasProd], viaAlias: true };
  }

  var tokensBuscados = _asistTokensProducto(texto);
  if(!tokensBuscados.length) return { mejor:null, mejorScore:0, alternativas:[] };

  var resultados = []; // { p, score }
  var exacto = null;

  for(var i = 0; i < PRODS.length; i++){
    var p = PRODS[i];
    if(!p || !p.name || p.itemLibre) continue;
    var nombreNorm = _asistNormalizar(p.name);
    var tokensProd = _asistTokensProducto(p.name);
    if(!tokensProd.length) continue;

    var score = 0;

    if(nombreNorm === buscado){ exacto = p; break; }
    if(buscado.indexOf(nombreNorm) >= 0){ score = Math.max(score, 0.95); }

    var comunes = 0;
    for(var t = 0; t < tokensProd.length; t++){
      for(var u = 0; u < tokensBuscados.length; u++){
        if(tokensProd[t] === tokensBuscados[u]){ comunes++; break; }
        if(tokensProd[t].length >= 4 && tokensBuscados[u].length >= 4 &&
           _asistSimilitud(tokensProd[t], tokensBuscados[u]) >= 0.8){
          comunes += 0.85; break;
        }
      }
    }
    var coberturaProd = comunes / tokensProd.length;
    var coberturaBusq = comunes / tokensBuscados.length;
    var tokScore = (coberturaProd * 0.7) + (coberturaBusq * 0.3);
    score = Math.max(score, tokScore);

    if(tokensProd.length === 1 && tokensBuscados.length <= 2){
      var simGlobal = 0;
      for(var v = 0; v < tokensBuscados.length; v++){
        var s = _asistSimilitud(tokensProd[0], tokensBuscados[v]);
        if(s > simGlobal) simGlobal = s;
      }
      if(simGlobal >= 0.75) score = Math.max(score, simGlobal);
    }

    if(score >= 0.55) resultados.push({ p: p, score: score });
  }

  if(exacto){
    return { mejor: exacto, mejorScore: 1, alternativas: [exacto], viaAlias: false };
  }
  if(!resultados.length) return { mejor:null, mejorScore:0, alternativas:[] };

  resultados.sort(function(a,b){ return b.score - a.score; });
  var top = resultados[0].score;
  var alternativas = [];
  for(var r = 0; r < resultados.length; r++){
    if(resultados[r].score >= top - 0.15) alternativas.push(resultados[r].p);
    if(alternativas.length >= 5) break;
  }
  return { mejor: resultados[0].p, mejorScore: top, alternativas: alternativas, viaAlias: false };
}

// API original — devuelve solo el producto (o null)
function _buscarProducto(texto){
  var r = _buscarProductosConAlternativas(texto);
  return r.mejor;
}

function _asistPantallaActiva(){
  var scs = ['scSale','scCobrar','scMesas','scPendientes','scConfig','scTurno','scCierre','scDetalle','scGuardar','scRecibo'];
  for(var i = 0; i < scs.length; i++){
    var el = document.getElementById(scs[i]);
    if(el && el.classList.contains('active')) return scs[i];
  }
  return null;
}

function _asistIrA(screenId){
  if(typeof goTo === 'function'){
    var el = document.getElementById(screenId);
    if(el && !el.classList.contains('active')) goTo(screenId);
  }
}

// ── EXTRAER DELIVERY de frases como "con delivery de 5 mil" ──
// Devuelve {monto, textoLimpio} o null
function _asistExtraerDelivery(texto){
  // Patrones: "con delivery de X", "delivery X", "con envio de X", "envio de X"
  var patrones = [
    /\s+con\s+delivery\s+de\s+(.+)$/,
    /\s+con\s+envio\s+de\s+(.+)$/,
    /\s+delivery\s+(?:de\s+)?(.+)$/,
    /\s+envio\s+(?:de\s+)?(.+)$/,
    /\s+con\s+delivery\s*$/,
    /\s+delivery\s*$/
  ];
  for(var i = 0; i < patrones.length; i++){
    var m = texto.match(patrones[i]);
    if(m){
      var monto = null;
      if(m[1]){
        var info = _asistExtraerNumero(m[1]);
        if(info) monto = info.valor;
        else monto = _asistParsearNumeroHablado(m[1]);
      }
      return {
        monto: monto && !isNaN(monto) ? monto : null,
        textoLimpio: texto.replace(patrones[i], '').trim()
      };
    }
  }
  return null;
}

// ── INTENTS ──
function _asistIntentAgregar(texto){
  // Verbos de agregar incluyen "vendeme" (caso del usuario)
  var verbosAdd = /^(agregar|agreg[aá]|agregame|agregale|a[nñ]adir|a[nñ]ade|poner|pon[eé]|poneme|traer|tra[eé]|traeme|sumar|sum[aá]|cargar|carg[aá]|meter|met[eé]|vamos?\s+con|dame|vendeme|venderme|vend[eé]me|cobrame)\s+/;
  var tieneVerbo = verbosAdd.test(texto);
  var cuerpo = tieneVerbo ? texto.replace(verbosAdd,'') : texto;

  // Primero, extraer información de delivery si hay
  var deliveryInfo = _asistExtraerDelivery(cuerpo);
  if(deliveryInfo){
    cuerpo = deliveryInfo.textoLimpio;
  }

  if(!tieneVerbo){
    var primera = cuerpo.split(' ')[0];
    var esNum = /^\d/.test(primera) || _asistParsearNumeroHablado(primera) > 0 ||
                /^(un|una|uno)$/.test(primera);
    if(!esNum && !deliveryInfo) return false;
  }

  // Split por conectores
  var partes = cuerpo.split(/\s+(?:y|mas|más|tambien|también|luego|despues|después|,)\s+/);
  var algoAgregado = false;
  var resumen = [];

  for(var i = 0; i < partes.length; i++){
    var parte = partes[i].trim();
    if(!parte) continue;

    var cantidad = 1;
    var nombre = parte;
    var num = _asistExtraerNumero(parte);
    if(num && num.inicio === 0 && num.valor < 100){
      cantidad = num.valor;
      nombre = parte.split(' ').slice(num.fin).join(' ').trim();
      nombre = nombre.replace(/^de\s+/,'');
    }
    if(!nombre) continue;

    var busq = _buscarProductosConAlternativas(nombre);
    var prod = busq.mejor;
    if(!prod){
      _asistHablar('No encontré ' + nombre);
      continue;
    }
    if(typeof addCart !== 'function'){
      _asistHablar('No puedo agregar en esta pantalla');
      return true;
    }

    // ¿Hay varios candidatos muy cercanos? → disambiguar
    if(busq.alternativas && busq.alternativas.length > 1 && !busq.viaAlias){
      (function(cantFinal, nombreOrig, candidatos){
        _asistPedirDisambiguacion(candidatos, nombreOrig, function(elegido){
          if(!elegido) return;
          _asistIrA('scSale');
          for(var k = 0; k < cantFinal; k++) addCart(elegido.id);
          _asistAliasGuardar(nombreOrig, elegido);
          _asistHablar(_asistFrase('agregado', {n: cantFinal, p: elegido.name}));
        });
      })(cantidad, nombre, busq.alternativas);
      algoAgregado = true;
      // No pusheamos al resumen porque se responde desde el callback
      continue;
    }

    _asistIrA('scSale');
    for(var k = 0; k < cantidad; k++) addCart(prod.id);
    // Guardar alias si el match no fue exacto
    if(!busq.viaAlias && busq.mejorScore < 0.9){
      _asistAliasGuardar(nombre, prod);
    }
    algoAgregado = true;
    resumen.push(cantidad + ' ' + prod.name);
  }

  // Aplicar delivery si se detectó
  if(deliveryInfo && algoAgregado){
    setTimeout(function(){
      if(typeof setTipoPedido === 'function') setTipoPedido('delivery');
      if(deliveryInfo.monto != null && typeof agregarMontoDelivery === 'function'){
        // agregarMontoDelivery lee del input, hay que setearlo primero
        var inp = document.getElementById('tabDeliveryMonto');
        if(inp){ inp.value = deliveryInfo.monto; }
        agregarMontoDelivery();
      }
    }, 300);
  }

  if(algoAgregado && resumen.length){
    var msgDelivery = deliveryInfo
      ? ' con delivery' + (deliveryInfo.monto ? ' de ' + Number(deliveryInfo.monto).toLocaleString('es-PY') : '')
      : '';
    var msg = resumen.length === 1
      ? _asistFrase('agregado', {n: resumen[0].split(' ')[0], p: resumen[0].split(' ').slice(1).join(' ')}) + msgDelivery
      : 'Listo, agregué ' + resumen.join(' y ') + msgDelivery;
    _asistHablar(msg);
  }
  return algoAgregado || tieneVerbo;
}

function _asistIntentQuitar(texto){
  if(!/^(quitar|quit[aá]|sacar|sac[aá]|eliminar|elimin[aá]|borrar|borr[aá]|remover|remov[eé]|deshacer)\b/.test(texto)) return false;

  if(/ultimo|anterior|deshacer/.test(texto)){
    if(typeof cart !== 'undefined' && cart && cart.length && typeof chgQty === 'function'){
      var last = cart[cart.length - 1];
      chgQty(last.lineId || last.id, -1);
      _asistHablar(_asistFrase('quitado', {p: last.name || 'el último'}));
      return true;
    }
  }

  var nombre = texto.replace(/^(quitar|quit[aá]|sacar|sac[aá]|eliminar|elimin[aá]|borrar|borr[aá]|remover|remov[eé])\s+/,'').trim();
  if(!nombre){ _asistHablar('¿Qué querés quitar?'); return true; }

  var prod = _buscarProducto(nombre);
  if(!prod){ _asistHablar('No encontré ' + nombre); return true; }
  if(typeof cart === 'undefined' || !cart || !cart.length){
    _asistHablar('El carrito está vacío'); return true;
  }
  for(var i = cart.length - 1; i >= 0; i--){
    if(cart[i].prodId === prod.id || cart[i].id === prod.id){
      if(typeof chgQty === 'function'){
        chgQty(cart[i].lineId || cart[i].id, -1);
        _asistHablar(_asistFrase('quitado', {p: prod.name}));
        return true;
      }
    }
  }
  _asistHablar('No tenés ' + prod.name + ' en el ticket');
  return true;
}

function _asistIntentCobrar(texto){
  if(/^(confirmar|confirm[aá]|finalizar|finaliz[aá]|aceptar|acept[aá])/.test(texto) ||
     /confirmar\s+(pago|cobro|venta)/.test(texto)){
    var sc = _asistPantallaActiva();
    if(sc === 'scCobrar' && typeof confirmarPago === 'function'){
      _asistHablar(_asistFrase('confirmado'));
      setTimeout(function(){ confirmarPago(); }, 450);
    } else {
      _asistHablar('Primero andá a la pantalla de cobro');
    }
    return true;
  }

  if(/(efectivo\s+justo|^justo|monto\s+exacto|^exacto|pago\s+justo)/.test(texto) && !/cobrar/.test(texto)){
    if(typeof setEfectivoJusto === 'function'){
      setEfectivoJusto();
      _asistHablar('Efectivo justo');
      if(/ya|confirm/.test(texto) && typeof confirmarPago === 'function'){
        setTimeout(function(){ confirmarPago(); }, 500);
      }
      return true;
    }
    return false;
  }

  var mRecibi = texto.match(/^(recibi|me\s+dio|me\s+pago|me\s+pag[oó]|pago\s+con|me\s+entreg[oó])\s+(.+)/);
  if(mRecibi){
    var monto = _asistParsearNumeroHablado(mRecibi[2]);
    if(!isNaN(monto) && monto > 0){
      if(_asistPantallaActiva() !== 'scCobrar' && typeof goCobrar === 'function'){
        goCobrar();
      }
      setTimeout(function(){
        if(typeof setEfectivoBillete === 'function'){
          setEfectivoBillete(monto);
          _asistHablar('Recibido ' + Number(monto).toLocaleString('es-PY'));
        }
      }, 400);
      return true;
    }
  }

  var mCobrar = texto.match(/^(cobrar|cobr[aá]|cobrame|pasar\s+a\s+cobro|ir\s+a\s+cobrar)\b(.*)$/);
  if(!mCobrar) return false;
  var resto = (mCobrar[2] || '').trim();

  var metodo = null;
  if(/\b(efectivo|plata|cash|billete|contado)\b/.test(resto))      metodo = 'efectivo';
  else if(/\b(tarjeta|pos|debito|credito|crédito|débito|posnet)\b/.test(resto)) metodo = 'pos';
  else if(/\b(transfer|transferencia|giro|qr|bancard|sipap)\b/.test(resto))     metodo = 'transferencia';

  var numInfo = _asistExtraerNumero(resto);
  var montoC  = numInfo ? numInfo.valor : null;
  var esJusto = /\bjusto\b|\bexacto\b/.test(resto);
  var confirmarAlFinal = /\bya\b|\bconfirmar?\b|\bfinaliz/.test(resto);

  if(typeof calcTotal === 'function' && calcTotal() === 0){
    _asistHablar(_asistFrase('vacio')); return true;
  }
  if(typeof goCobrar !== 'function'){
    _asistHablar('No puedo cobrar desde esta pantalla'); return true;
  }

  goCobrar();
  _asistHablar(_asistFrase('cobrando'));

  setTimeout(function(){
    if(metodo) _seleccionarMetodoPago(metodo);
    if(esJusto && typeof setEfectivoJusto === 'function'){
      setEfectivoJusto();
    } else if(montoC && typeof setEfectivoBillete === 'function'){
      setEfectivoBillete(montoC);
    }
    if(confirmarAlFinal && typeof confirmarPago === 'function'){
      setTimeout(function(){ confirmarPago(); }, 500);
    }
  }, 450);
  return true;
}

function _seleccionarMetodoPago(metodo){
  if(typeof selPay !== 'function') return;
  var btns = document.querySelectorAll('.pay-btn');
  for(var i = 0; i < btns.length; i++){
    var txt = _asistNormalizar(btns[i].textContent || '');
    if(metodo === 'pos' && (txt.indexOf('pos') >= 0 || txt.indexOf('tarjeta') >= 0 || txt.indexOf('debito') >= 0 || txt.indexOf('credito') >= 0)){
      selPay(btns[i], 'pos'); return;
    }
    if(metodo === 'transferencia' && (txt.indexOf('transfer') >= 0 || txt.indexOf('giro') >= 0)){
      selPay(btns[i], 'transferencia'); return;
    }
    if(metodo === 'efectivo' && (txt.indexOf('efectivo') >= 0 || txt.indexOf('cash') >= 0)){
      selPay(btns[i], 'efectivo'); return;
    }
  }
}

function _asistIntentMesa(texto){
  if(/^(mostrar|ver|abrir|ir\s+a)\s+(las\s+)?mesas\b/.test(texto) ||
     /^pantalla\s+de\s+mesas/.test(texto) || texto === 'mesas'){
    _asistIrA('scMesas');
    _asistHablar('Pantalla de mesas');
    return true;
  }
  var m = texto.match(/\bmesa\s+(.+)$/);
  if(!m) m = texto.match(/(?:pasame|pasar|cambiar|ir|abrir|abri)\s+a\s+la\s+mesa\s+(.+)$/);
  if(m){
    var info = _asistExtraerNumero(m[1]);
    var nro = info ? info.valor : parseInt(m[1]);
    if(isNaN(nro)){ _asistHablar('¿Qué mesa?'); return true; }
    _abrirMesaPorVoz(nro);
    return true;
  }
  return false;
}

function _abrirMesaPorVoz(nro){
  if(typeof mesasMesas === 'undefined' || !mesasMesas.length){
    _asistHablar('No hay mesas configuradas'); return;
  }
  var mesa = mesasMesas.find(function(m){
    if(!m || !m.nombre) return false;
    var n = String(m.nombre);
    return n == String(nro) || n == ('Mesa ' + nro) ||
           n.match(new RegExp('\\b' + nro + '\\b'));
  });
  if(!mesa){ _asistHablar('No encontré la mesa ' + nro); return; }
  if(typeof onMesaTap === 'function'){
    onMesaTap(mesa.id);
    _asistHablar('Abriendo mesa ' + nro);
  }
}

function _asistIntentNavegacion(texto){
  if(/^(ir\s+a\s+ventas|pantalla\s+de\s+ventas|^ventas$|nueva\s+venta|limpiar|vaciar\s+carrito)/.test(texto)){
    if(/nueva\s+venta|limpiar|vaciar/.test(texto)){
      if(typeof nuevaVenta === 'function'){ nuevaVenta(); _asistHablar('Nueva venta'); }
      else if(typeof finalizarRecibo === 'function'){ finalizarRecibo(); _asistHablar('Nueva venta'); }
      return true;
    }
    _asistIrA('scSale'); _asistHablar('Ventas'); return true;
  }
  if(/^(configuraci[oó]n|ajustes|config)\b/.test(texto)){
    _asistIrA('scConfig'); _asistHablar('Configuración'); return true;
  }
  if(/^(ver\s+)?pendientes\b/.test(texto)){
    _asistIrA('scPendientes'); _asistHablar('Pendientes'); return true;
  }
  if(/^(atras|atr[aá]s|volver|salir|cancelar)\b/.test(texto)){
    if(typeof history !== 'undefined' && history.back){ history.back(); }
    _asistHablar('Atrás'); return true;
  }
  return false;
}

function _asistIntentTurno(texto){
  if(/^(abrir|iniciar|comenzar)\s+(turno|caja)/.test(texto)){
    _asistIrA('scShift'); _asistHablar('Pantalla de turno');
    return true;
  }
  if(/^(cerrar|finalizar|terminar)\s+(turno|caja)/.test(texto)){
    if(typeof cerrarTurno === 'function'){ cerrarTurno(); _asistHablar('Cerrando turno'); }
    else { _asistHablar('No puedo cerrar el turno'); }
    return true;
  }
  if(/(que\s+hay\s+en\s+(la\s+)?caja|saldo\s+(de\s+)?caja|cuanto\s+(hay|tengo)\s+en\s+caja|cuanto\s+efectivo)/.test(texto)){
    if(typeof calcSaldoEsperado === 'function'){
      var saldo = calcSaldoEsperado();
      _asistHablar('En caja hay ' + Number(saldo||0).toLocaleString('es-PY') + ' guaraníes');
    } else _asistHablar('No puedo calcular la caja');
    return true;
  }
  return false;
}

function _asistIntentConsulta(texto){
  if(/(cuanto\s+vend[ií]|cuanto\s+llevo|cuantas\s+ventas|total\s+del\s+turno|total\s+de\s+ventas|llevo\s+vendido)/.test(texto)){
    _responderTotalTurno(); return true;
  }
  return false;
}

function _responderTotalTurno(){
  if(typeof turnoData === 'undefined' || !turnoData.ventas){
    _asistHablar('No hay turno abierto'); return;
  }
  var total = turnoData.ventas.reduce(function(s,v){ return s + (v.total||0); }, 0);
  var n = turnoData.ventas.length;
  if(!n){ _asistHablar('Todavía no hay ventas en este turno'); return; }
  _asistHablar('Llevás ' + n + ' ventas por ' + Number(total).toLocaleString('es-PY') + ' guaraníes');
}

function _asistIntentImprimir(texto){
  if(!/(imprimir|imprim[íi]|reimprimir)/.test(texto)) return false;
  if(/comanda/.test(texto)){
    if(typeof imprimirComandaActual === 'function'){ imprimirComandaActual(); _asistHablar('Imprimiendo comanda'); return true; }
  }
  if(typeof imprimirTicketActual === 'function'){ imprimirTicketActual(); _asistHablar('Imprimiendo ticket'); return true; }
  if(typeof imprimirRecibo === 'function'){ imprimirRecibo(); _asistHablar('Imprimiendo'); return true; }
  _asistHablar('No puedo imprimir desde acá');
  return true;
}

function _asistIntentDelivery(texto){
  // "cambiar a delivery", "modo delivery"
  if(/^(modo\s+delivery|delivery$|cambiar\s+a\s+delivery|poner\s+delivery)/.test(texto)){
    if(typeof setTipoPedido === 'function') setTipoPedido('delivery');
    _asistHablar('Modo delivery');
    return true;
  }
  if(/^(modo\s+)?(para\s+)?llevar$/.test(texto)){
    if(typeof setTipoPedido === 'function') setTipoPedido('llevar');
    _asistHablar('Para llevar'); return true;
  }
  if(/^(modo\s+)?local$/.test(texto)){
    if(typeof setTipoPedido === 'function') setTipoPedido('local');
    _asistHablar('Local'); return true;
  }
  return false;
}

function _asistIntentAyuda(texto){
  if(!/^(ayuda|help|que\s+puedo\s+decir|que\s+entend[eé]s|comandos)/.test(texto)) return false;
  _asistHablar('Podés decir: vendeme dos pizzas, cobrá con tarjeta, recibí cien mil, abrí mesa cinco, cuánto vendí hoy, imprimí ticket, nueva venta, o con delivery de cinco mil');
  return true;
}

function _asistIntentAnular(texto){
  if(!/^(anular|anul[aá]|cancelar\s+(la\s+)?venta|cancelar\s+pedido)/.test(texto)) return false;
  if(typeof nuevaVenta === 'function'){ nuevaVenta(); _asistHablar('Venta cancelada'); }
  else _asistHablar('No puedo anular');
  return true;
}

// Dispatcher principal — prueba todas las alternativas y todos los intents
function _asistEjecutarComando(alternativas){
  var alts = [];
  for(var i = 0; i < alternativas.length; i++){
    var raw = (alternativas[i] || '').toString().trim();
    if(raw) alts.push(raw);
  }
  if(!alts.length){ _asistHablar(_asistFrase('noEntendi')); return; }

  var intents = [
    _asistIntentAyuda,
    _asistIntentAnular,
    _asistIntentCobrar,
    _asistIntentTurno,
    _asistIntentConsulta,
    _asistIntentMesa,
    _asistIntentImprimir,
    _asistIntentDelivery,
    _asistIntentNavegacion,
    _asistIntentQuitar,
    _asistIntentAgregar   // último: es el más permisivo
  ];

  function ejecutarFrase(texto){
    var partes = texto.split(/\s+(?:y\s+luego|y\s+despues|y\s+despu[eé]s|luego|despues|,\s+luego)\s+/);
    var ok = false;
    for(var p = 0; p < partes.length; p++){
      var sub = partes[p].trim();
      if(!sub) continue;
      for(var q = 0; q < intents.length; q++){
        if(intents[q](sub)){ ok = true; break; }
      }
    }
    return ok;
  }

  for(var a = 0; a < alts.length; a++){
    var textoNorm = _asistLimpiarMuletillas(_asistNormalizar(alts[a]));
    console.log('[Asistente] Probando alt', a, ':', textoNorm);
    if(ejecutarFrase(textoNorm)) return;
  }

  _asistHablar(_asistFrase('noEntendi') + ' Escuché: ' + alts[0]);
}

// ── DISAMBIGUACIÓN DE PRODUCTOS ─────────────────────────
function _asistPedirDisambiguacion(candidatos, textoOriginal, callback){
  _asistDisambiguacion = {
    candidatos: candidatos.slice(0, 5),
    callback: callback,
    intentos: 0,
    textoOriginal: textoOriginal
  };
  var nombres = _asistDisambiguacion.candidatos.map(function(p){ return p.name; });
  var frase;
  if(nombres.length === 2){
    frase = '¿Cuál? Tengo ' + nombres[0] + ' o ' + nombres[1];
  } else {
    frase = '¿Cuál? ' + nombres.slice(0, -1).join(', ') + ' o ' + nombres[nombres.length - 1];
  }
  _asistHablar(frase);
}

function _asistResolverDisambiguacion(texto){
  var d = _asistDisambiguacion;
  if(!d) return;
  d.intentos++;

  if(/^(cancelar|anular|nada|ninguno|olvid[aá]|dejalo)$/.test(texto)){
    _asistDisambiguacion = null;
    _asistHablar('Ok, cancelado');
    return;
  }

  var elegido = _asistMatchDisambiguacion(texto, d.candidatos);
  if(elegido){
    var cb = d.callback;
    var orig = d.textoOriginal;
    _asistDisambiguacion = null;
    _asistAliasGuardar(orig, elegido);
    if(typeof cb === 'function') cb(elegido);
    return;
  }

  if(d.intentos >= 2){
    _asistDisambiguacion = null;
    _asistHablar('No te entendí, dejalo así');
    return;
  }
  _asistHablar('¿Cuál? Decí el nombre o el número');
}

function _asistMatchDisambiguacion(texto, candidatos){
  if(!texto || !candidatos || !candidatos.length) return null;
  var t = _asistNormalizar(texto);

  // 1) Por posición: primero/segundo/tercero/etc. o número
  var posMap = {
    'primero':0,'el primero':0,'primera':0,'uno':0,'el uno':0,'la uno':0,'1':0,
    'segundo':1,'el segundo':1,'segunda':1,'dos':1,'el dos':1,'2':1,
    'tercero':2,'el tercero':2,'tres':2,'3':2,
    'cuarto':3,'cuatro':3,'4':3,
    'quinto':4,'cinco':4,'5':4
  };
  if(posMap[t] !== undefined && candidatos[posMap[t]]) return candidatos[posMap[t]];
  var m = t.match(/^(?:el\s+|la\s+)?(primero|primera|segundo|segunda|tercero|cuarto|quinto|uno|dos|tres|cuatro|cinco)$/);
  if(m && posMap[m[1]] !== undefined && candidatos[posMap[m[1]]]) return candidatos[posMap[m[1]]];

  // 2) Por substring del nombre (palabra diferenciadora)
  // Calcular tokens únicos por candidato (los que NO comparten con otros)
  var tokensCand = candidatos.map(function(p){ return _asistTokensProducto(p.name); });
  var tokensTexto = _asistTokensProducto(texto);

  // Buscar match directo de token
  var mejorIdx = -1, mejorCnt = 0;
  for(var i = 0; i < candidatos.length; i++){
    var cnt = 0;
    for(var a = 0; a < tokensCand[i].length; a++){
      for(var b = 0; b < tokensTexto.length; b++){
        if(tokensCand[i][a] === tokensTexto[b]){ cnt++; break; }
        if(tokensCand[i][a].length >= 4 && tokensTexto[b].length >= 4 &&
           _asistSimilitud(tokensCand[i][a], tokensTexto[b]) >= 0.8){ cnt++; break; }
      }
    }
    if(cnt > mejorCnt){ mejorCnt = cnt; mejorIdx = i; }
  }
  if(mejorCnt > 0) return candidatos[mejorIdx];

  // 3) Fuzzy sobre nombre completo
  var bestScore = 0, bestP = null;
  for(var j = 0; j < candidatos.length; j++){
    var s = _asistSimilitud(_asistNormalizar(candidatos[j].name), t);
    if(s > bestScore){ bestScore = s; bestP = candidatos[j]; }
  }
  if(bestScore >= 0.5) return bestP;
  return null;
}

// ── ALIASES POR CAJERO (IndexedDB + fallback en memoria) ─
var _ASIST_ALIAS_INIT = false;
function _asistAliasInit(){
  if(_ASIST_ALIAS_INIT) return;
  _ASIST_ALIAS_INIT = true;
  try {
    if(typeof Dexie === 'undefined'){
      console.warn('[Asistente/Alias] Dexie no disponible, usando memoria');
      _asistAliasMem = true;
      return;
    }
    _asistDb = new Dexie('POSAsistAlias');
    _asistDb.version(1).stores({
      aliases: '++id, &alias, productoId, usos, ultimoUso'
    });
    _asistDb.open().then(function(){
      return _asistDb.aliases.toArray();
    }).then(function(rows){
      var ahora = Date.now();
      var limpieza = [];
      var treintaDias = 30 * 24 * 60 * 60 * 1000;
      for(var i = 0; i < rows.length; i++){
        var r = rows[i];
        if((r.usos || 0) < 2 && (ahora - (r.ultimoUso || 0)) > treintaDias){
          limpieza.push(r.id);
          continue;
        }
        _asistAliasCache[r.alias] = r.productoId;
      }
      if(limpieza.length){
        _asistDb.aliases.bulkDelete(limpieza).catch(function(){});
      }
      console.log('[Asistente/Alias] Cargados:', Object.keys(_asistAliasCache).length);
    }).catch(function(err){
      console.warn('[Asistente/Alias] Error abriendo DB, fallback memoria:', err);
      _asistAliasMem = true;
    });
  } catch(e){
    console.warn('[Asistente/Alias] Excepción init, fallback memoria:', e);
    _asistAliasMem = true;
  }
}

function _asistAliasBuscar(textoNorm){
  if(!textoNorm) return null;
  var id = _asistAliasCache[textoNorm];
  if(id == null || typeof PRODS === 'undefined') return null;
  for(var i = 0; i < PRODS.length; i++){
    if(PRODS[i] && PRODS[i].id === id) return PRODS[i];
  }
  return null;
}

function _asistAliasGuardar(texto, producto){
  if(!producto || !producto.id) return;
  var alias = _asistNormalizar(texto);
  if(!alias) return;
  // No guardar si el alias es idéntico al nombre normalizado
  if(alias === _asistNormalizar(producto.name)) return;
  var existente = _asistAliasCache[alias];
  _asistAliasCache[alias] = producto.id;
  console.log('[Asistente/Alias] Guardando:', alias, '→', producto.name);

  if(_asistAliasMem || !_asistDb){
    return; // solo en cache
  }
  try {
    _asistDb.aliases.where('alias').equals(alias).first().then(function(row){
      if(row){
        return _asistDb.aliases.update(row.id, {
          productoId: producto.id,
          usos: (row.usos || 0) + 1,
          ultimoUso: Date.now()
        });
      }
      return _asistDb.aliases.add({
        alias: alias,
        productoId: producto.id,
        usos: 1,
        ultimoUso: Date.now()
      });
    }).catch(function(err){
      console.warn('[Asistente/Alias] Error guardando, fallback memoria:', err);
      _asistAliasMem = true;
    });
  } catch(e){
    console.warn('[Asistente/Alias] Excepción guardando:', e);
    _asistAliasMem = true;
  }
}

// ── UI: PANEL DE TRANSCRIPCIÓN EN VIVO ──────────────────
function _asistTranscripcionEl(){
  var el = document.getElementById('asistTranscripcion');
  if(el) return el;
  el = document.createElement('div');
  el.id = 'asistTranscripcion';
  el.className = 'asist-transcripcion';
  el.innerHTML = '<div class="asist-trans-texto"></div><div class="asist-trans-countdown"></div>';
  document.body.appendChild(el);
  return el;
}

function _asistTranscripcionMostrar(){
  var el = _asistTranscripcionEl();
  el.querySelector('.asist-trans-texto').textContent = 'Escuchando...';
  el.querySelector('.asist-trans-countdown').textContent = '';
  el.classList.add('visible');
}

function _asistTranscripcionOcultar(){
  var el = document.getElementById('asistTranscripcion');
  if(el) el.classList.remove('visible');
}

function _asistTranscripcionUpdate(texto, esFinal){
  var el = document.getElementById('asistTranscripcion');
  if(!el) return;
  var t = el.querySelector('.asist-trans-texto');
  if(t){
    t.textContent = texto || '...';
    t.className = 'asist-trans-texto' + (esFinal ? ' final' : '');
  }
}

function _asistTranscripcionCountdown(segs){
  var el = document.getElementById('asistTranscripcion');
  if(!el) return;
  var c = el.querySelector('.asist-trans-countdown');
  if(c) c.textContent = segs > 0 ? (segs + 's...') : '';
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

// Leer configuración del toggle — por defecto: activado
function asistenteHabilitadoGet(){
  var v = localStorage.getItem('pos_asistente_habilitado');
  return v !== '0'; // default true
}
function asistenteHabilitadoSet(habilitado){
  localStorage.setItem('pos_asistente_habilitado', habilitado ? '1' : '0');
  var fab = document.getElementById('asistFab');
  if(fab){
    fab.style.display = habilitado ? 'flex' : 'none';
  } else if(habilitado){
    _asistCrearFab();
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
  // Solo crear si está habilitado en config
  if(!asistenteHabilitadoGet()){
    console.log('[Asistente] Deshabilitado por config');
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
  // Warm-up del cache de aliases
  try { _asistAliasInit(); } catch(e){}
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
