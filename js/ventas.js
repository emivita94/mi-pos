// ============================================================
// ventas.js — Lógica de ventas, tickets y pagos
// Ampersand POS
// ============================================================
// Este módulo maneja:
//   - Estado del carrito (cart, tipoPedido, descuentos)
//   - Tickets pendientes
//   - Cobro simple y pago dividido
//   - Cálculos de totales
// ============================================================

// gs, toast, goTo → disponibles globalmente desde js/ui.js
// Parchear goTo para trackear pantalla actual y manejar historial
(function patchGoTo(){
  if(typeof goTo === 'function' && !goTo._parchado){
    var _orig = goTo;
    window.goTo = function(sc){
      _orig(sc);
      if(window._goToWrapper) window._goToWrapper(sc);
    };
    window.goTo._parchado = true;
  } else if(typeof goTo === 'undefined'){
    // ui.js aún no cargó — reintentar después
    setTimeout(patchGoTo, 50);
  }
})();

// ── ESTADO ──────────────────────────────────────────────────
// Variables globales centralizadas en js/state.js
// (cart, ticketDescuento, currentTicketNro, ticketCounter,
//  tipoPedido, pendientes, showTkt, npCtx, npVal,
//  divPagos, divNpIdx, divMethodIdx, PAY_METHODS, mesaActual)
// curCat → js/state.js

// ── CARRITO ─────────────────────────────────────────────────

// ── LONG-PRESS en tiles de producto ──
// Tap corto: agrega al carrito (rápido)
// Long-press (500ms): abre flujo completo con mitades/modificadores opcionales
var _longPressTimer = null;
var _longPressFired = false;

function _setupLongPressGrid(){
  var grid = document.getElementById('pgrid');
  if(!grid || grid._longPressSetup) return;
  grid._longPressSetup = true;

  function iniciarLongPress(e, tile){
    _longPressFired = false;
    clearTimeout(_longPressTimer);
    _longPressTimer = setTimeout(function(){
      _longPressFired = true;
      // Extraer el id del producto del onclick del tile
      var onclickStr = tile.getAttribute('onclick') || '';
      var m = onclickStr.match(/addCart\((\d+)/);
      if(!m) return;
      var id = parseInt(m[1]);
      var p = PRODS.find(function(x){ return x.id === id; });
      if(!p) return;
      // Abrir el flujo completo
      var mods = typeof modificadores !== 'undefined'
        ? modificadores.filter(function(mm){ return mm.productos && mm.productos.includes(p.id); })
        : [];
      if((p.mitad || mods.length > 0) && typeof abrirFlujoPizza === 'function'){
        if(navigator.vibrate) navigator.vibrate(30);
        abrirFlujoPizza(p, mods.length > 0);
      }
    }, 500);
  }

  function cancelarLongPress(){
    clearTimeout(_longPressTimer);
  }

  grid.addEventListener('touchstart', function(e){
    var tile = e.target.closest('.ptile');
    if(tile) iniciarLongPress(e, tile);
  }, { passive: true });
  grid.addEventListener('touchend', cancelarLongPress);
  grid.addEventListener('touchmove', cancelarLongPress);
  grid.addEventListener('touchcancel', cancelarLongPress);
  // Mouse para desktop
  grid.addEventListener('mousedown', function(e){
    var tile = e.target.closest('.ptile');
    if(tile) iniciarLongPress(e, tile);
  });
  grid.addEventListener('mouseup', cancelarLongPress);
  grid.addEventListener('mouseleave', cancelarLongPress);

  // Prevenir que el onclick dispare si ya se ejecutó el long-press
  grid.addEventListener('click', function(e){
    if(_longPressFired){
      e.stopPropagation();
      e.preventDefault();
      _longPressFired = false;
    }
  }, true);
}

// Inicializar cuando el DOM esté listo
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', _setupLongPressGrid);
} else {
  _setupLongPressGrid();
}

function addCart(id, tileEl){
  const p=PRODS.find(x=>x.id===id); if(!p)return;
  if(p.precioVariable){ addCartConPrecioVariable(id); return; }

  // Detectar modificadores del producto
  var mods = typeof modificadores !== 'undefined'
    ? modificadores.filter(m => m.productos && m.productos.includes(p.id))
    : [];
  var tieneModif = mods.length > 0;
  var tieneModifObligatorio = mods.some(m => m.obligatorio);

  // Abrir flujo SOLO si hay modificadores obligatorios.
  // Si el producto tiene mitad o modificadores opcionales, se agrega
  // como entera/sin modificadores directamente (tap rápido).
  // Para acceder al flujo completo (mitad, modificadores opcionales),
  // el usuario debe usar long-press sobre el tile.
  if(tieneModifObligatorio && typeof abrirFlujoPizza === 'function'){
    abrirFlujoPizza(p, tieneModif);
    if(tileEl) animAddToCart(tileEl, getProductColor(p));
    return;
  }

  // Producto simple
  const existing = cart.find(l=>l.id===id && !l.obs && !l.enviado);
  if(existing){
    existing.qty++;
  } else {
    cart.push({lineId:Date.now()*1000+Math.floor(Math.random()*1000), ...p, qty:1, obs:'', enviado:false});
  }
  updUI(); updBtnGuardar(); toast('+'+p.name.substring(0,16));
  if(typeof sndTap === 'function') sndTap();
  if(showTkt)renderTkt();
  if(tileEl) animAddToCart(tileEl, getProductColor(p));
}
function chgQty(lineId,d){
  const idx=cart.findIndex(l=>l.lineId===lineId);
  if(idx<0)return;
  if(cart[idx].esDelivery) return;
  cart[idx].qty+=d;
  if(cart[idx].qty<=0) cart.splice(idx,1);
  updUI(); updBtnGuardar(); renderTkt();
}

function calcItemTotal(item) {
  if (item.esDescuento) return item.price;
  const base = item.price * item.qty;
  if (item.desc && item.desc > 0) return Math.round(base * (1 - item.desc / 100));
  return base;
}

function calcSubtotal() {
  return cart.filter(i => !i.esDescuento).reduce((s, i) => s + calcItemTotal(i), 0);
}

function calcTotalDescuentos() {
  return cart.filter(i => i.esDescuento).reduce((s, i) => s + (i.montoDesc || 0), 0);
}

function calcTotal() {
  const sub = calcSubtotal();
  const desc = calcTotalDescuentos();
  const conTicketDesc = ticketDescuento > 0 ? Math.round(sub * (1 - ticketDescuento / 100)) : sub;
  return conTicketDesc - desc;
}

function calcDescuentoMonto() { return calcSubtotal() - calcTotal(); }

function vaciarTicket(){
  if(!cart.length) return;
  // Si es un ticket guardado siendo editado, confirmar antes de vaciar
  if(currentTicketNro !== null){
    if(!confirm('¿Vaciar el ticket #'+String(currentTicketNro).padStart(4,'0')+'? Los cambios no se guardarán.')) return;
  }
  clearCart(); resetTicketDescuento(); setCurrentTicketNro(null); clearMesaActual();
  setTipoPedido('llevar'); updTabTicketHeader(); updMesaBtn?.();
  const dBar=document.getElementById('tabDeliveryBar'); if(dBar)dBar.classList.remove('visible');
  updUI(); updBtnGuardar(); goTo('scSale'); toast('Ticket vaciado');
}

// ── TIPO DE PEDIDO ──────────────────────────────────────────

function setTipoPedido(tipo) {
  tipoPedido = tipo;
  ['local', 'llevar', 'delivery'].forEach(function (t) {
    const btn = document.getElementById('tipoBtn' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle('sel', t === tipo);
  });
  ['local', 'llevar', 'delivery'].forEach(function (t) {
    const btn = document.getElementById('mobTipoBtn' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle('sel', t === tipo);
  });
  const bar = document.getElementById('tabDeliveryBar');
  if (bar) bar.classList.toggle('visible', tipo === 'delivery');
  const mobBar = document.getElementById('mobDeliveryBar');
  if (mobBar) mobBar.style.display = tipo === 'delivery' ? 'flex' : 'none';
  if (tipo !== 'delivery') quitarItemDelivery(null, null);
}

function quitarItemDelivery(){
  const idx=cart.findIndex(i=>i.esDelivery); if(idx>=0){cart.splice(idx,1); updUI(); updBtnGuardar();}
}

function agregarMontoDelivery(){
  const inp=document.getElementById('tabDeliveryMonto');
  const monto=parseInt((inp||{}).value||0)||0;
  if(!monto||monto<=0){toast('Ingresá el monto del envío');inp&&inp.focus();return;}
  quitarItemDelivery();
  cart.push({lineId:Date.now()*1000+999,id:'delivery_item',name:'Envío delivery',price:monto,qty:1,obs:'',iva:'10',esDelivery:true,color:'#e65100',colorPropio:true,enviado:false});
  updUI(); updBtnGuardar(); toast('✓ Envío ₲'+monto.toLocaleString('es-PY')+' agregado'); if(inp)inp.value='';
}

// ── TICKETS PENDIENTES ───────────────────────────────────────

function guardarPendientesLocal() {
  try { localStorage.setItem('pos_pendientes', JSON.stringify(pendientes)); } catch (e) { }
}

function updTabTicketHeader() {
  updMesaBtn?.();
  const nro = currentTicketNro !== null
    ? String(currentTicketNro).padStart(4, '0')
    : String(ticketCounter).padStart(4, '0');
  const nroEl = document.getElementById('tabTicketNro');
  if (nroEl) nroEl.textContent = '#' + nro + (typeof mesaActual!=='undefined' && mesaActual ? '  ' + mesaActual.nombre : '');
  const mobNroEl = document.getElementById('mobTicketNro');
  if (mobNroEl) mobNroEl.textContent = '#' + nro;
}

function onBtnGuardar() {
  if (typeof mesaActual!=='undefined' && mesaActual) { guardarConMesa(); return; }
  const tieneProductos = calcTotal() > 0;
  if (tieneProductos) {
    goGuardar();
  } else if (pendientes.length > 0) {
    goPendientes();
  } else {
    toast('Agregá productos primero');
  }
}

function goGuardar() {
  const total = calcTotal();
  if (total === 0) { toast('Agregá productos primero'); return; }
  const nro = currentTicketNro !== null
    ? String(currentTicketNro).padStart(4, '0')
    : String(ticketCounter).padStart(4, '0');
  document.getElementById('guardNro').textContent = '#' + nro;
  const existente = currentTicketNro !== null
    ? pendientes.find(t => t.nro === currentTicketNro)
    : null;
  document.getElementById('guardObs').value = existente ? existente.obs : '';
  document.getElementById('guardItemsList').innerHTML = cart.map(i =>
    `<div class="guard-item-row">
      <span class="gin">${i.qty}× ${i.name}${i.obs ? ' <span style="color:#777;font-weight:400;font-size:11px;">('+i.obs+')</span>' : ''}</span>
      <span class="gip">${gs(i.price * i.qty)}</span>
    </div>`
  ).join('');
  goTo('scGuardar');
  setTimeout(() => document.getElementById('guardObs').focus(), 300);
}

function doGuardar() {
  const obs = document.getElementById('guardObs').value.trim();
  if (currentTicketNro !== null) {
    const idx = pendientes.findIndex(t => t.nro === currentTicketNro);
    if (idx >= 0) {
      pendientes[idx].cart = JSON.parse(JSON.stringify(cart));
      pendientes[idx].total = calcTotal();
      pendientes[idx].obs = obs || pendientes[idx].obs;
      pendientes[idx].fecha = new Date().toISOString();
      pendientes[idx].tipoPedido = tipoPedido || 'local';
      pendientes[idx].descuentoTicket = ticketDescuento || 0;
    }
    const nro = currentTicketNro;
    setCurrentTicketNro(null);
    clearCart();
    updUI(); updBtnGuardar();
    guardarPendientesLocal();
    goTo('scSale');
    toast('✓ Ticket #' + String(nro).padStart(4, '0') + ' actualizado');
  } else {
    const nro = ticketCounter;
    incrementTicketCounter();
    pendientes.push({
      nro,
      obs: obs || '',
      cart: JSON.parse(JSON.stringify(cart)),
      total: calcTotal(),
      fecha: new Date().toISOString(),
      esPresupuesto: false,
      tipoPedido: tipoPedido || 'local',
      descuentoTicket: ticketDescuento || 0,
    });
    setCurrentTicketNro(null);
    clearCart();
    updUI(); updBtnGuardar();
    guardarPendientesLocal();
    goTo('scSale');
    toast('✓ Ticket #' + String(nro).padStart(4, '0') + ' guardado');
  }
}

function goPendientes() {
  renderPendientes();
  goTo('scPendientes');
}

function renderPendientes() {
  const list = document.getElementById('pendList');
  if (!pendientes.length) {
    list.innerHTML = `<div class="pend-empty">
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      <p>No hay tickets pendientes</p>
    </div>`;
    return;
  }
  // Helper: color de fondo del cuadradito del número según tipo de pedido
  function colorCuadradito(tipo){
    var map = {
      'local':    '#3b82f6',  // azul
      'llevar':   '#10b981',  // verde
      'delivery': '#ff9800',  // naranja
    };
    return map[tipo] || '';
  }
  // Helper: hora HH:MM desde ISO o Date
  function horaCorta(fecha){
    if (!fecha) return '';
    try {
      var d = (typeof fecha === 'string') ? new Date(fecha) : fecha;
      if (isNaN(d.getTime())) return '';
      var hh = String(d.getHours()).padStart(2,'0');
      var mm = String(d.getMinutes()).padStart(2,'0');
      return hh + ':' + mm;
    } catch(e){ return ''; }
  }

  list.innerHTML = pendientes.map((t, i) => {
    // Pedido de terminal satélite — va directo a cobrar, no se edita
    var esSat = !!t.esSatelite;
    // Badge visual: satélite, presupuesto o tipo de pedido
    var badge = '';
    if (esSat) {
      badge = ' <span style="font-size:10px;font-weight:800;background:rgba(83,74,183,.15);' +
              'color:#a78bfa;border:1px solid rgba(83,74,183,.3);padding:1px 6px;' +
              'border-radius:4px;letter-spacing:.5px;vertical-align:middle;">SATELITE</span>';
      if (t.tipoPedido === 'delivery') {
        badge = ' <span style="font-size:10px;font-weight:800;background:rgba(255,152,0,.15);' +
                'color:#ff9800;border:1px solid rgba(255,152,0,.3);padding:1px 6px;' +
                'border-radius:4px;letter-spacing:.5px;vertical-align:middle;">DELIVERY</span>';
      }
    } else if (t.esPresupuesto) {
      badge = ' <span style="font-size:10px;">📋</span>';
    }
    // Color del cuadradito del número según tipo de pedido (solo tickets normales)
    var bgNum = '';
    if (!esSat && !t.esPresupuesto && t.tipoPedido) {
      var cBg = colorCuadradito(t.tipoPedido);
      if (cBg) bgNum = ' style="background:' + cBg + ';color:#fff;"';
    }
    // Acción al tocar: satélite → cobrar directo | local → cargar al carrito
    var onclickAccion = esSat
      ? 'cajaAbrirPedidoSatelite(' + i + ')'
      : 'cargarTicket(' + i + ')';
    // Hora a la derecha del título — fuera de .pend-item-obs porque ese div
    // tiene overflow:hidden + text-overflow:ellipsis y la cortaba.
    var hora = horaCorta(t.fecha);
    var horaHtml = hora
      ? ' <span style="font-size:11px;color:var(--muted);font-weight:600;margin-left:6px;font-family:Courier,monospace;">' + hora + '</span>'
      : '';
    // Info secundaria: obs · cant art. · (terminal si es satélite)
    var artCount = (t.cart || []).reduce(function(s, it) { return s + it.qty; }, 0);
    var infoObs  = (t.obs || 'Sin observación') + ' · ' + artCount + ' art.';
    if (esSat && t.terminalOrigen) infoObs += ' · ' + t.terminalOrigen;
    return '<div class="pend-item" style="display:flex;align-items:center;gap:0;' +
           (esSat ? 'border-left:3px solid #534AB7;' : '') + '">' +
      '<div style="flex:1;display:flex;align-items:center;gap:10px;padding:14px 0 14px 14px;cursor:pointer;" onclick="' + onclickAccion + '">' +
        '<div class="pend-item-num"' + bgNum + '>#' + String(t.nro).padStart(4, '0') + '</div>' +
        '<div class="pend-item-info">' +
          '<div class="pend-item-title">Ticket #' + String(t.nro).padStart(4, '0') + badge + horaHtml + '</div>' +
          '<div class="pend-item-obs">' + infoObs + '</div>' +
        '</div>' +
        '<div class="pend-item-total">' + gs(t.total) + '</div>' +
      '</div>' +
      '<button onclick="event.stopPropagation();imprimirTicketPendiente(' + i + ')" title="Imprimir"' +
        ' style="background:none;border:none;cursor:pointer;color:var(--muted);padding:14px 12px;display:flex;align-items:center;flex-shrink:0;border-left:1px solid var(--border);">' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>' +
      '</button>' +
    '</div>';
  }).join('');
}

function cargarTicket(i) {
  const t = pendientes[i];
  const totalActual = calcTotal();
  if (totalActual > 0) {
    if (currentTicketNro !== null) {
      const idx = pendientes.findIndex(p => p.nro === currentTicketNro);
      if (idx >= 0) {
        pendientes[idx].cart = JSON.parse(JSON.stringify(cart));
        pendientes[idx].total = totalActual;
        pendientes[idx].fecha = new Date();
        pendientes[idx].descuentoTicket = ticketDescuento || 0;
      }
    } else {
      pendientes.push({
        nro: ticketCounter,
        obs: 'Auto-guardado',
        cart: JSON.parse(JSON.stringify(cart)),
        total: totalActual,
        fecha: new Date(),
        esPresupuesto: false,
        descuentoTicket: ticketDescuento || 0,
      });
      incrementTicketCounter();
    }
  }
  if(typeof resetTicketDescuento === 'function') resetTicketDescuento();
  if(t.descuentoTicket && t.descuentoTicket > 0 && typeof setTicketDescuento === 'function'){
    setTicketDescuento(t.descuentoTicket);
  }
  setCart(JSON.parse(JSON.stringify(t.cart)));
  setCurrentTicketNro(t.nro);
  updUI();
  updBtnGuardar();
  goTo('scSale');
  const origen = t.esSatelite ? ' (de ' + (t.terminalOrigen || 'satélite') + ')' : '';
  toast('Ticket #' + String(t.nro).padStart(4, '0') + origen + ' cargado');
}

// ── cajaAbrirPedidoSatelite — abre pedido satélite directo al cobro ──────────
// Los pedidos de satélite no se "editan" — el cajero los cobra tal cual.
// Carga el carrito del pedido y va directo a la pantalla de cobro.
// El pedido queda en pendientes[] hasta que se confirme el cobro en pos_ventas.
function cajaAbrirPedidoSatelite(i) {
  var t = pendientes[i];
  if (!t || !t.esSatelite) { if (typeof cargarTicket !== 'undefined') cargarTicket(i); return; }

  // Si hay carrito activo, preguntar antes de pisar
  var totalActual = typeof calcTotal === 'function' ? calcTotal() : 0;
  if (totalActual > 0) {
    if (!confirm('Hay un ticket en curso. ¿Descartar y abrir el pedido de ' + (t.obs || 'mesero') + '?')) return;
    // Auto-guardar el ticket activo antes de pisarlo (mismo patrón que cargarTicket)
    if (currentTicketNro !== null) {
      var idx = pendientes.findIndex(function(p){ return p.nro === currentTicketNro; });
      if (idx >= 0) {
        pendientes[idx].cart = JSON.parse(JSON.stringify(cart));
        pendientes[idx].total = totalActual;
        pendientes[idx].fecha = new Date();
      }
      // Refrescar índice de t porque pendientes pudo haberse reordenado (no ocurre aquí, pero por consistencia)
      t = pendientes[i];
      if (!t || !t.esSatelite) return;
    }
    // Si currentTicketNro === null, el carrito es nuevo sin guardar — descartar
  }

  // Cargar el carrito del pedido satélite
  if(typeof resetTicketDescuento === 'function') resetTicketDescuento();
  if(t.descuentoTicket && t.descuentoTicket > 0 && typeof setTicketDescuento === 'function'){
    setTicketDescuento(t.descuentoTicket);
  }
  setCart(JSON.parse(JSON.stringify(t.cart || [])));
  setCurrentTicketNro(t.nro);

  // Setear tipo de pedido y mesa si corresponde
  if (typeof setTipoPedido === 'function') {
    setTipoPedido(t.tipoPedido || 'local');
  }
  if (t.mesa_id && typeof mesasMesas !== 'undefined') {
    var mesa = mesasMesas.find(function(m) { return m.id === t.mesa_id; });
    if (mesa) {
      setMesaActual(mesa);
      if (typeof updMesaBtn === 'function') updMesaBtn();
    }
  }

  if (typeof updUI === 'function') updUI();
  if (typeof updBtnGuardar === 'function') updBtnGuardar();

  // Ir al POS para que el cajero pueda agregar items antes de cobrar
  goTo('scSale');
  if (typeof renderCatPills === 'function') renderCatPills();
  if (typeof filterP === 'function') filterP();
  if (typeof toast === 'function')
    toast('Pedido de ' + (t.terminalOrigen || 'mesero') + ' cargado — agregá items o cobrá');
}

function nuevaVenta() {
  guardarPendientesLocal();
  const totalActual = calcTotal();
  if (totalActual > 0) {
    if (currentTicketNro !== null) {
      // Editando ticket existente — actualizar en lugar de crear duplicado
      const idx = pendientes.findIndex(p => p.nro === currentTicketNro);
      if (idx !== -1) {
        pendientes[idx] = { ...pendientes[idx], cart: JSON.parse(JSON.stringify(cart)), total: totalActual, fecha: new Date(), descuentoTicket: ticketDescuento || 0 };
      } else {
        pendientes.push({ nro: currentTicketNro, obs: 'Auto-guardado', cart: JSON.parse(JSON.stringify(cart)), total: totalActual, fecha: new Date(), esPresupuesto: false, descuentoTicket: ticketDescuento || 0 });
      }
    } else {
      pendientes.push({
        nro: ticketCounter,
        obs: 'Auto-guardado',
        cart: JSON.parse(JSON.stringify(cart)),
        total: totalActual,
        fecha: new Date(),
        esPresupuesto: false,
        descuentoTicket: ticketDescuento || 0,
      });
      incrementTicketCounter();
    }
  }
  clearCart();
  setCurrentTicketNro(null);
  updUI();
  updBtnGuardar();
  if (updMesaBtn) updMesaBtn();
  goTo('scSale');
}

function updBtnGuardar() {
  const n = pendientes.length;
  const tieneProductos = calcTotal() > 0;
  const badge = document.getElementById('pendingBadge');
  const txt = document.getElementById('btnGuardarTxt');
  const icon = document.getElementById('btnGuardarIcon');
  const tabBadge = document.getElementById('tabPendingBadge');
  const tabTxt = document.getElementById('tabBtnTxt');
  if (tieneProductos) {
    txt.textContent = 'GUARDAR';
    if (tabTxt) tabTxt.textContent = 'GUARDAR';
    icon.innerHTML = '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>';
    if (n > 0) {
      badge.textContent = n > 9 ? '9+' : n; badge.classList.add('show');
      if (tabBadge) { tabBadge.textContent = badge.textContent; tabBadge.style.display = 'flex'; }
    } else {
      badge.classList.remove('show');
      if (tabBadge) tabBadge.style.display = 'none';
    }
  } else if (n > 0) {
    badge.textContent = n > 9 ? '9+' : n; badge.classList.add('show');
    txt.textContent = 'PENDIENTES';
    icon.innerHTML = '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>';
    if (tabBadge) { tabBadge.textContent = badge.textContent; tabBadge.style.display = 'flex'; }
    if (tabTxt) tabTxt.textContent = 'PENDIENTES';
  } else {
    badge.classList.remove('show');
    txt.textContent = 'GUARDAR';
    icon.innerHTML = '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>';
    if (tabBadge) tabBadge.style.display = 'none';
    if (tabTxt) tabTxt.textContent = 'GUARDAR';
  }
}

// ── PAGO DIVIDIDO ────────────────────────────────────────────

function goDividir() {
  const total = calcTotal();
  if (!total) { toast('Agregá productos primero'); return; }
  clearDivPagos();
  divChgCount(0, 2);
  goTo('scDividir');
}

function divChgCount(delta, forceN) {
  const total = calcTotal();
  let n = forceN !== undefined ? forceN : (divPagos.length + delta);
  if (n < 1) n = 1;
  if (n > 6) n = 6;
  while (divPagos.length < n) {
    const base = Math.floor(total / n);
    divPagos.push({ metodo: 'Efectivo', monto: base, comprobante: '', cobrado: false });
  }
  while (divPagos.length > n) divPagos.pop();
  const base = Math.floor(total / n);
  const resto = total - base * n;
  divPagos.forEach((p, i) => { if (!p.cobrado) { p.monto = base + (i === 0 ? resto : 0); } });
  document.getElementById('divCount').textContent = n;
  document.getElementById('divMinus').disabled = (n <= 1);
  renderDivList();
  updDivRestante();
}

function renderDivList() {
  const container = document.getElementById('divList');
  container.innerHTML = divPagos.map((p, i) => {
    const needsComp = p.metodo === 'POS' || p.metodo === 'Transferencia';
    return `
    <div class="div-pago-item" id="divItem${i}">
      <div class="div-pago-row1">
        <button class="div-trash" onclick="divRemove(${i})">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
        <div class="div-method-sel" onclick="openDivMethodSheet(${i})">
          <span>${p.metodo}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="div-pago-row2">
        <input class="div-monto" id="divMonto${i}" type="text" readonly
          value="${gs(p.monto)}"
          onclick="openDivNumpad(${i})"
          ${p.cobrado ? 'disabled style="opacity:.5"' : ''}>
        <button class="div-cobrar-btn ${p.cobrado ? 'cobrado' : ''}"
          onclick="${p.cobrado ? '' : 'divCobrar(' + i + ')'}"
          ${p.cobrado ? 'disabled' : ''}>
          ${p.cobrado ? '✓ COBRADO' : 'COBRAR'}
        </button>
      </div>
      <div class="div-comp ${needsComp ? 'open' : ''}" id="divComp${i}">
        <label>Nro. Comprobante / Observación</label>
        <div class="efec-row" style="margin-top:4px;${p.cobrado ? 'opacity:.5;pointer-events:none' : ''}" onclick="openDivNPComp(${i})">
          <span class="efec-val" id="divCompDisp${i}" style="font-size:16px;color:${p.comprobante ? '#fff' : '#666'}">${p.comprobante || '—'}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
    </div>`;
  }).join('');
}

function updDivRestante() {
  const total = calcTotal();
  const cobrado = divPagos.filter(p => p.cobrado).reduce((s, p) => s + p.monto, 0);
  const restante = total - cobrado;
  document.getElementById('divRestante').textContent =
    restante <= 0 ? 'Pagado ✓' : 'Restante ' + gs(restante);
}

function divRemove(i) {
  if (divPagos.length <= 1) { toast('Mínimo 1 pago'); return; }
  if (divPagos[i].cobrado) { toast('Ya fue cobrado'); return; }
  divPagos.splice(i, 1);
  document.getElementById('divCount').textContent = divPagos.length;
  document.getElementById('divMinus').disabled = (divPagos.length <= 1);
  renderDivList();
  updDivRestante();
}

function divCobrar(i) {
  const p = divPagos[i];
  if (p.monto <= 0) { toast('El monto debe ser mayor a 0'); return; }
  p.cobrado = true;
  renderDivList();
  updDivRestante();
  toast('✓ Pago cobrado');
  if (divPagos.every(p => p.cobrado)) {
    toast('✓ Todos los pagos cobrados — presioná HECHO');
  }
}

function dividirHecho() {
  if (!divPagos.every(p => p.cobrado)) { toast('Faltan cobrar algunos pagos'); return; }
  confirmarPago();
}

function openDivMethodSheet(i) {
  setDivMethodIdx(i);
  const sheet = document.getElementById('catSheetContent');
  let html = '';
  PAY_METHODS.forEach(m => {
    const sel = divPagos[i].metodo === m ? 'sel' : '';
    html += '<div class="cat-item ' + sel + '" onclick="pickDivMethod(this)">' + m + '</div>';
  });
  sheet.innerHTML = html;
  document.getElementById('catOv').classList.add('open');
}

function pickDivMethod(el) {
  if (divMethodIdx < 0) return;
  const m = typeof el === 'string' ? el : el.textContent.trim();
  divPagos[divMethodIdx].metodo = m;
  divPagos[divMethodIdx].comprobante = '';
  document.getElementById('catOv').classList.remove('open');
  renderDivList();
}

function openDivNumpad(i) {
  if (divPagos[i].cobrado) return;
  setDivNpIdx(i);
  setNpCtx('div');
  setNpVal(String(divPagos[i].monto));
  document.getElementById('npLbl').textContent = 'Monto pago ' + (i + 1);
  document.getElementById('npDisp').textContent = gs(divPagos[i].monto);
  document.getElementById('billetesRow').classList.remove('show');
  document.getElementById('npOverlay').classList.add('open');
}

function openDivNPComp(i) {
  if (divPagos[i].cobrado) return;
  setDivNpIdx(i);
  setNpCtx('divComp');
  setNpVal(divPagos[i].comprobante || '');
  document.getElementById('npLbl').textContent = 'Nro. Comprobante - Pago ' + (i + 1);
  document.getElementById('npDisp').textContent = npVal || '—';
  document.getElementById('billetesRow').classList.remove('show');
  document.getElementById('npOverlay').classList.add('open');
}

// ── Render Tablet Ticket (panel lateral de items) ───────────────────────────

function renderTabletTicket(){
  var tl = document.getElementById('tabTlist');
  var empty = document.getElementById('tabEmpty');
  if(!tl) return;
  if(!cart.length){
    if(empty) empty.style.display='flex';
    Array.from(tl.children).forEach(function(c){ if(c.id!=='tabEmpty') c.remove(); });
    return;
  }
  if(empty) empty.style.display='none';
  Array.from(tl.children).forEach(function(c){ if(c.id!=='tabEmpty') c.remove(); });
  cart.forEach(function(i){
    var div = document.createElement('div');
    div.className='tab-titem';
    if(i.esDelivery){
      div.style.cssText='border-left:3px solid var(--orange);background:rgba(255,152,0,.06)';
      div.innerHTML=
        '<div style="width:7px;height:7px;border-radius:50%;background:var(--orange);flex-shrink:0"></div>'+
        '<div class="tab-tiname" style="color:var(--orange)">'+i.name+'</div>'+
        '<div class="tab-tictrl">'+
          '<button class="tab-qbtn" onclick="quitarItemDelivery();setTipoPedido(\'local\')" title="Quitar delivery" style="background:var(--orange);color:#fff">\u2715</button>'+
        '</div>'+
        '<div class="tab-tiprice" style="color:var(--orange);font-weight:800">'+gs(i.price)+'</div>';
    } else {
      div.innerHTML=
        '<div style="width:7px;height:7px;border-radius:50%;background:'+i.color+';flex-shrink:0"></div>'+
        '<div class="tab-tiname">'+i.name+(i.obs?'<div class="tab-tiobs">'+i.obs+'</div>':'')+'</div>'+
        '<div class="tab-tictrl">'+
          '<button class="tab-qbtn" onclick="chgQty('+i.lineId+',-1)">\u2212</button>'+
          '<span class="tab-qnum">'+i.qty+'</span>'+
          '<button class="tab-qbtn" onclick="chgQty('+i.lineId+',1)">+</button>'+
        '</div>'+
        '<div class="tab-tiprice">'+gs(i.price*i.qty)+'</div>';
    }
    tl.appendChild(div);
  });
}
