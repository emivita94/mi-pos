// ── Pedidos: satélite, delivery, sincronización de pedidos ──

// CONFIRM PAYMENT
// ══════════════════════════════════════════════════════════════════════════════
// goCobrar — punto de entrada unificado para el botón COBRAR / ENVIAR PEDIDO
//
// MODO CAJA:     Navega a la pantalla #scCobrar (comportamiento original).
//                Valida que el carrito no esté vacío antes de navegar.
//
// MODO SATÉLITE: Llama a sateliteEnviarPedido() que:
//                  1. Inserta en pos_pedidos (Supabase) → caja lo ve en tiempo real
//                  2. Imprime comanda en cocina (reutiliza imprimirComandaPreCobro)
//                  3. Guarda backup local en pendientes[] para modo offline
//                  4. Limpia carrito y vuelve al panel de mesas
//
// Los 3 botones COBRAR del HTML (móvil, tablet, detalle) llaman a esta función.
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// goCobrar — punto de entrada unificado del botón COBRAR / ENVIAR PEDIDO
//
// MODO CAJA:
//   Llama a _goCobrarSetup() (definida en cobro.js) que actualiza el total
//   en pantalla (ctotal), resetea método de pago, etc. Luego navega a scCobrar.
//   IMPORTANTE: _goCobrarSetup() debe ejecutarse ANTES de goTo('scCobrar')
//   para que el DOM de scCobrar tenga el total correcto al mostrarse.
//
// MODO SATÉLITE:
//   Llama a sateliteEnviarPedido() — inserta en pos_pedidos, imprime comanda.
// ══════════════════════════════════════════════════════════════════════════════
function goCobrar(){
  if(MODO_TERMINAL === 'satelite'){
    sateliteEnviarPedido();
  } else {
    if(calcTotal() === 0){ toast('El ticket está vacío'); return; }
    // _goCobrarSetup() actualiza ctotal y los controles antes de navegar
    if(typeof _goCobrarSetup === 'function') _goCobrarSetup();
    goTo('scCobrar');
    // Voz anuncia el total al ENTRAR a la pantalla de cobro
    if(typeof hablarCobro === 'function') hablarCobro(calcTotal());
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// sateliteEnviarPedido — lógica completa del envío de pedido desde satélite
//
// FLUJO:
//   1. Valida carrito no vacío
//   2. Arma el objeto pedido con: items, mesa, tipo, terminal, total
//   3. POST a /rest/v1/pos_pedidos en Supabase (con fallback offline)
//   4. Llama a imprimirComandaPreCobro() → imprime en comandera de cocina
//      y marca los ítems como enviado:true (comportamiento ya existente)
//   5. Guarda copia local en pendientes[] con flag esSatelite:true
//   6. Muestra toast con resultado (con conexión / sin conexión)
//   7. Limpia carrito, mesa, tipoPedido → listo para próximo pedido
//   8. Vuelve al panel de mesas (si hay salones) o al POS
//
// TABLA SUPABASE REQUERIDA:
//   Ver SQL en: /docs/satelite_setup.sql
//   CREATE TABLE pos_pedidos (id uuid, licencia_email, terminal_origen,
//     numero_orden, mesa, tipo_pedido, estado, items jsonb, total, mesero_id,
//     created_at, updated_at)
//
// REGLA DE PROPIEDAD DEL PEDIDO:
//   mesero_id = nombre del terminal que creó el pedido.
//   Los pedidos adicionales a la misma mesa crean un nuevo registro
//   en pos_pedidos con tipo_pedido='adicional', NO editan el original.
//   Esto garantiza que cocina siempre recibe una comanda nueva y clara.
// ══════════════════════════════════════════════════════════════════════════════
async function sateliteEnviarPedido(){
  // ── Validación básica ────────────────────────────────────────────────────
  if(!cart || cart.length === 0){
    toast('Agrega productos primero');
    return;
  }
  if(calcTotal() === 0){
    toast('El total del pedido no puede ser cero');
    return;
  }

  // ── Verificar que hay caja abierta en la sucursal ───────────────────────
  var cajaActiva = await sateliteVerificarCajaActiva();
  if(!cajaActiva){
    toast('No hay caja abierta en esta sucursal. El cajero debe abrir turno primero.');
    sateliteMostrarEsperaCaja();
    return;
  }

  var email    = localStorage.getItem('lic_email');
  var terminal = localStorage.getItem('pos_terminal') || 'Satelite';
  var licId    = parseInt(localStorage.getItem('ali')) || null;
  var tipo     = tipoPedido || 'llevar';
  var mesaNombre = mesaActual ? mesaActual.nombre : null;

  // Número de orden visible (ej: Orden #0012 en la comanda)
  // Usamos ticketCounter que ya existe y se autoincrementa
  const nroOrden = ticketCounter;

  // ── Detectar si es pedido ADICIONAL a una mesa ya ocupada ───────────────
  // Si la mesa ya tiene un pendiente local, marcarlo como adicional
  const esAdicional = mesaActual
    ? pendientes.some(p => p.mesa_id === mesaActual.id && !p.esSateliteCobrado)
    : false;
  const tipoFinal = esAdicional ? 'adicional' : tipo;

  // ── Armar payload para Supabase ──────────────────────────────────────────
  const itemsParaSupabase = cart.map(function(i){
    return {
      id:    i.id    || null,
      name:  i.name  || '',
      qty:   i.qty   || 1,
      price: i.price || 0,
      cat:   i.cat   || '',
      obs:   i.obs   || '',
      costo: i.costo || 0,
    };
  });

  var pedidoData = {
    licencia_email:  email,
    licencia_id:     licId,
    terminal_origen: terminal,
    numero_orden:    nroOrden,
    mesa:            mesaNombre,
    sucursal:        localStorage.getItem('pos_sucursal') || 'Principal',
    tipo_pedido:     tipoFinal,
    estado:          'abierto',
    items:           JSON.stringify(itemsParaSupabase),
    total:           calcTotal(),
    mesero_id:       terminal,
    created_at:      new Date().toISOString(),
    updated_at:      new Date().toISOString(),
  };

  // ── Detectar si hay un pedido Supabase existente para ACTUALIZAR ──────────
  // Si el mesero vuelve a entrar a la mesa y agrega items, el pendiente local
  // tiene supabasePedidoId del pedido original. En ese caso hacemos PATCH
  // para actualizar items y total, en vez de crear un POST nuevo que
  // generaria dos pedidos separados para la misma mesa.
  var existingSupabaseId = null;
  if(currentTicketNro !== null){
    var existente = pendientes.find(function(p){ return p.nro === currentTicketNro; });
    if(existente && existente.supabasePedidoId && existente.esSatelite){
      existingSupabaseId = existente.supabasePedidoId;
    }
  }

  // ── Intentar sincronizar con Supabase ────────────────────────────────────
  let supaOk = false;
  let supabasePedidoId = existingSupabaseId; // preservar el UUID si hay uno
  if(navigator.onLine && email && !USAR_DEMO){
    if(existingSupabaseId){
      // PATCH: actualizar el pedido existente
      try {
        var patchUrl = SUPA_URL + '/rest/v1/pos_pedidos?id=eq.' + encodeURIComponent(existingSupabaseId);
        // En el PATCH NO cambiamos tipo_pedido — mantener el original.
        // El "adicional" no aplica: es el MISMO pedido con mas items.
        var patchBody = {
          items:      pedidoData.items,
          total:      pedidoData.total,
          updated_at: new Date().toISOString(),
        };
        const resP = await fetch(patchUrl, {
          method:  'PATCH',
          headers: supaHeaders({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
          body: JSON.stringify(patchBody),
        });
        supaOk = resP.ok;
        if(resP.ok){
          console.log('[Satélite] Pedido ' + existingSupabaseId + ' ACTUALIZADO (PATCH). Total:', pedidoData.total);
        } else {
          const errText = await resP.text();
          console.warn('[Satélite] Error actualizando pedido:', resP.status, errText);
          // Fallback: si el PATCH falla (404 = el row no existe o fue cobrado),
          // crear un pedido NUEVO con POST
          existingSupabaseId = null;
          supabasePedidoId = null;
        }
      } catch(e){
        console.warn('[Satélite] Sin conexión al actualizar pedido:', e.message);
        existingSupabaseId = null; // intentar POST como fallback
      }
    }

    if(!existingSupabaseId){
      // POST: crear pedido nuevo
      try{
        const res = await fetch(SUPA_URL + '/rest/v1/pos_pedidos', {
          method:  'POST',
          headers: supaHeaders({ 'Content-Type': 'application/json', 'Prefer': 'return=representation' }),
          body: JSON.stringify(pedidoData),
        });
        supaOk = res.ok;
        if(!res.ok){
          const errText = await res.text();
          console.warn('[Satélite] Error al enviar pedido a Supabase:', res.status, errText);
          if(res.status === 404 || res.status === 400){
            console.warn('[Satélite] Tabla pos_pedidos no encontrada. Ejecutar SQL de setup.');
          }
        } else {
          try {
            var inserted = await res.json();
            if(inserted && inserted[0] && inserted[0].id){
              supabasePedidoId = inserted[0].id;
            }
          } catch(ep){ console.warn('[Satélite] No se pudo leer UUID del response'); }
          console.log('[Satélite] Pedido #' + nroOrden + ' CREADO (POST). ID:', supabasePedidoId);
        }
      } catch(e){
        console.warn('[Satélite] Sin conexión al enviar pedido:', e.message);
      }
    }
  }

  // ── Imprimir comanda en cocina (solo si hay impresora configurada) ────────
  // En satelite sin impresora, no abrir ventana de impresion del navegador
  var tieneImpresora = isAndroidAPK()
    || localStorage.getItem('printerType_comanda')
    || localStorage.getItem('printerType_ticket')
    || localStorage.getItem('btps_mac');
  if(tieneImpresora){
    imprimirComandaPreCobro();
  } else {
    // Marcar items como enviados sin imprimir
    cart.forEach(function(i){ i.enviado = true; });
    console.log('[Satelite] Sin impresora — comanda no impresa, items marcados como enviados');
  }

  // ── Guardar/actualizar backup local en pendientes[] ──────────────────────
  // Si el cart vino de un pendiente ya guardado (currentTicketNro != null),
  // REEMPLAZAR ese pendiente en vez de agregar uno nuevo. Esto evita duplicados
  // en el flujo "Guardar → Enviar".
  var nro;
  var idxExistente = -1;
  if(currentTicketNro !== null){
    idxExistente = pendientes.findIndex(function(p){ return p.nro === currentTicketNro; });
  }
  var entradaPendiente = {
    nro:              currentTicketNro !== null ? currentTicketNro : incrementTicketCounter(),
    obs:              mesaNombre || (tipo === 'delivery' ? 'Delivery' : 'Para llevar'),
    cart:             JSON.parse(JSON.stringify(cart)),
    total:            calcTotal(),
    fecha:            new Date().toISOString(),
    mesa_id:          mesaActual ? mesaActual.id : null,
    esSatelite:       true,
    esSateliteCobrado:false,
    supaSync:         supaOk,
    supabasePedidoId: supabasePedidoId, // UUID para reconciliación
    esPresupuesto:    false,
  };
  nro = entradaPendiente.nro;
  if(idxExistente >= 0){
    pendientes[idxExistente] = entradaPendiente;
  } else {
    addPendiente(entradaPendiente);
  }
  guardarPendientesLocal();

  // ── Feedback al mesero ───────────────────────────────────────────────────
  // Si se actualizo un pedido existente, el mensaje lo refleja.
  var fueActualizacion = existingSupabaseId != null;
  const mesaMsg  = mesaNombre
    ? 'Mesa ' + mesaNombre
    : (tipo === 'delivery' ? 'Delivery' : 'Para llevar');
  const syncMsg  = supaOk
    ? ' — caja notificada'
    : ' — sin conexión, guardado local';
  var verbo = fueActualizacion ? 'actualizado' : 'enviado';
  toast('Pedido #' + String(nro).padStart(4, '0') + ' ' + verbo + ' · ' + mesaMsg + syncMsg);

  // ── Limpiar estado para próximo pedido ───────────────────────────────────
  clearCart();
  setCurrentTicketNro(null);
  clearMesaActual();
  setTipoPedido('llevar');
  updMesaBtn();
  updUI();
  updBtnGuardar();
  updTabTicketHeader();

  // Volver al panel de mesas (si hay salones configurados) o al POS principal
  if(mesasSalones && mesasSalones.length > 0){
    abrirPantallaMesas();
  } else {
    goTo('scSale');
  }
}

function imprimirComandaPreCobro(){
  if(!cart.length){ toast('Sin productos'); return; }
  // Solo imprimir ítems NO enviados aún a cocina
  const itemsPendientes = cart.filter(i => !i.enviado);
  if(!itemsPendientes.length){ toast('Todo ya fue enviado a cocina'); return; }
  const d = new Date();
  imprimirComanda({
    items: itemsPendientes,
    fecha: d,
    nroTicket: typeof currentTicketNro !== 'undefined' && currentTicketNro !== null ? currentTicketNro : ticketCounter,
    tipoPedido: tipoPedido||'llevar',
    mesa: mesaActual ? mesaActual.nombre : null,
    factura: null
  });
  // Marcar como enviados en memoria
  cart.forEach(i => { i.enviado = true; });
  // Persistir en localStorage — usar el array global 'pendientes' (tickets guardados)
  if(typeof currentTicketNro !== 'undefined' && currentTicketNro !== null){
    const ticketIdx = pendientes.findIndex(p => p.nro === currentTicketNro);
    if(ticketIdx >= 0){
      pendientes[ticketIdx].cart = JSON.parse(JSON.stringify(cart));
      try { localStorage.setItem('pos_pendientes', JSON.stringify(pendientes)); } catch(e){ console.warn('[Comanda] Error guardando pendientes:', e.message); }
      console.log('[Comanda] Estado enviado guardado en ticket #'+currentTicketNro);
    }
  }
  updBtnComandaCobro();
  updUI();
  if(typeof renderTkt === 'function') renderTkt();
}

// Imprimir comanda del último recibo — solo ítems no enviados
function imprimirComandaActual(){
  if(!ultimoReciboData) return;
  // Filtrar ítems no enviados usando el cart actual (que tiene el estado real)
  const itemsNoEnviados = (ultimoReciboData.items || []).filter(i => !i.enviado);
  if(!itemsNoEnviados.length){
    toast('Todo ya fue enviado a cocina');
    return;
  }
  // Marcar como enviados en ultimoReciboData
  ultimoReciboData.items.forEach(i => { i.enviado = true; });
  // También marcar en cart si los ítems coinciden por lineId
  if(typeof cart !== 'undefined'){
    cart.forEach(i => { i.enviado = true; });
    // Persistir en pendientes si hay ticket activo
    if(typeof currentTicketNro !== 'undefined' && currentTicketNro !== null){
      const ticketIdx = pendientes.findIndex(p => p.nro === currentTicketNro);
      if(ticketIdx >= 0){
        pendientes[ticketIdx].cart = JSON.parse(JSON.stringify(cart));
        try { localStorage.setItem('pos_pendientes', JSON.stringify(pendientes)); } catch(e){ console.warn('[Comanda] Error guardando pendientes:', e.message); }
      }
    }
  }
  imprimirComanda({...ultimoReciboData, items: itemsNoEnviados});
}

// ── marcarPedidoSateliteCobrado — actualiza estado en Supabase tras cobrar ───
// Se llama desde el .then() del INSERT a pos_ventas cuando el pendiente
// tenía supabasePedidoId. Cambia estado 'abierto' → 'cobrado' en pos_pedidos.
// También elimina el pendiente local para que desaparezca de la lista y mesas.
function marcarPedidoSateliteCobrado(pedidoId){
  if(!pedidoId || USAR_DEMO) return;
  // PATCH en Supabase
  var _email = localStorage.getItem('lic_email');
  supaPatch('pos_pedidos', 'id=eq.' + encodeURIComponent(pedidoId) + '&licencia_email=eq.' + encodeURIComponent(_email || ''),
    { estado: 'cobrado', updated_at: new Date().toISOString() }, true)
  .then(function(){
    console.log('[CajaSync] Pedido satélite marcado cobrado:', pedidoId);
  })
  .catch(function(e){ console.warn('[CajaSync] Error marcando cobrado:', e.message); });

  // Eliminar de pendientes[] local inmediatamente (no esperar a Supabase)
  setPendientes(pendientes.filter(function(p){ return p.supabasePedidoId !== pedidoId; }));
  guardarPendientesLocal();
  updBtnGuardar();
  if(typeof renderMesasScreen === 'function') renderMesasScreen();
}

// ══════════════════════════════════════════════════════════════════════════════
// cajaSyncPedidosSatelite — sincroniza pedidos de satélites a pendientes[] de caja
//
// DISEÑO — integración sin tocar el diseño existente:
//   Inyecta los pos_pedidos de Supabase en pendientes[] con el mismo formato
//   de los tickets guardados manualmente. Así la caja los ve automáticamente:
//     - En "Tickets pendientes" (scPendientes / botón GUARDAR) → mismo diseño
//     - En el panel de mesas → mesa.tile.ocupada (rojo) porque renderMesasScreen
//       ya busca en pendientes[] por mesa_id. Sin tocar esa lógica.
//   El único cambio visual: badge "Satélite" en la tarjeta del pendiente.
//
// CUÁNDO CORRE:
//   - Al iniciar la app (setTimeout 7000ms, después de cargar mesas)
//   - Cada 30 segundos en background (setInterval)
//   - Al abrir la pantalla de mesas (abrirPantallaMesas la llama)
//   - Solo en MODO_TERMINAL === 'caja' con internet
// ══════════════════════════════════════════════════════════════════════════════
async function cajaSyncPedidosSatelite(){
  if(MODO_TERMINAL !== 'caja') return;
  if(!navigator.onLine || USAR_DEMO) return;

  const email    = localStorage.getItem(SK.email);
  const sucursal = localStorage.getItem('pos_sucursal') || 'Principal';
  if(!email) return;

  try{
    const rows = await supaGet('pos_pedidos',
        'licencia_email=eq.' + encodeURIComponent(email)
        + '&sucursal=eq.'       + encodeURIComponent(sucursal)
        + '&estado=in.(abierto,en_cobro)'
        + '&order=created_at.asc'
        + '&select=id,numero_orden,mesa,tipo_pedido,estado,items,total,terminal_origen,created_at');
    if(!Array.isArray(rows)) return;

    // Conservar tickets locales (de esta caja), reemplazar los de satélite
    const locales = pendientes.filter(function(p){ return !p.esSatelite; });
    var antes = pendientes.length;

    var satelites = rows.map(function(p){
      var items = [];
      try { items = typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []); } catch(e){ console.warn('[CajaSync] Error parseando items de pedido:', e.message); }

      // Resolver mesa_id local por nombre
      var mesaId = null;
      if(p.mesa && typeof mesasMesas !== 'undefined'){
        var ml = mesasMesas.find(function(m){ return m.nombre === p.mesa; });
        if(ml) mesaId = ml.id;
      }

      var total = p.total || items.reduce(function(s,i){ return s+(i.price||i.precio||0)*(i.qty||1); }, 0);

      return {
        nro:              p.numero_orden || p.id,
        supabasePedidoId: p.id,
        obs:              p.mesa || (p.tipo_pedido === 'delivery' ? 'Delivery' : 'Para llevar'),
        cart: items.map(function(i){
          return {
            lineId:  i.id || Math.random(),
            id:      i.id  || null,
            name:    i.name  || i.nombre || '',
            price:   i.price || i.precio || 0,
            qty:     i.qty   || 1,
            cat:     i.cat   || '',
            obs:     i.obs   || '',
            costo:   i.costo || 0,
            color:   i.color || '#888',
            enviado: true,
          };
        }),
        total:          total,
        fecha:          p.created_at,
        mesa_id:        mesaId,
        tipoPedido:     p.tipo_pedido || 'local',
        esSatelite:     true,
        terminalOrigen: p.terminal_origen || '',
        estadoSupabase: p.estado,
        esPresupuesto:  false,
      };
    });

    setPendientes(locales.concat(satelites));
    guardarPendientesLocal();
    updBtnGuardar();

    if(satelites.length > 0 && typeof renderMesasScreen === 'function') renderMesasScreen();

    var diff = pendientes.length - antes;
    if(diff > 0){
      if(typeof toast === 'function')
        toast(diff + ' pedido' + (diff > 1 ? 's' : '') + ' nuevo' + (diff > 1 ? 's' : '') + ' de mesa');
      if(typeof sndPedido === 'function') sndPedido();
      // Voz sintetica: anunciar pedido nuevo despues del sonido
      if(typeof hablarPedidoNuevo === 'function'){
        setTimeout(function(){ hablarPedidoNuevo(diff); }, 800);
      }
    }

    console.log('[CajaSync] Satelite pendientes:', satelites.length, '| Total:', pendientes.length);
  } catch(e){ console.warn('[CajaSync] Error:', e.message); }
}

// ══════════════════════════════════════════════════════════════════════════════
// CAJA → REALTIME via Supabase WebSocket
//
// En lugar de solo hacer polling cada 6s, abrimos una conexion WebSocket a
// Supabase Realtime. Cuando un satelite INSERTA un pedido nuevo, recibimos
// un evento inmediato y disparamos cajaSyncPedidosSatelite() en milisegundos
// en vez de esperar hasta el proximo poll.
//
// Si Realtime falla o se desconecta, el polling cada 6s sigue siendo el
// fallback confiable.
// ══════════════════════════════════════════════════════════════════════════════
var _realtimeWS = null;
var _realtimeReconnectTimer = null;
var _realtimeRef = 0;

function cajaSuscribirRealtime(){
  if(MODO_TERMINAL !== 'caja') return;
  if(!navigator.onLine || USAR_DEMO) return;
  if(_realtimeWS && _realtimeWS.readyState === 1) return; // ya conectado
  if(typeof SUPA_URL === 'undefined' || typeof SUPA_ANON === 'undefined') return;
  if(typeof WebSocket === 'undefined') return;

  try {
    // URL del endpoint Realtime — derivar del SUPA_URL
    var wsUrl = SUPA_URL.replace(/^https?:\/\//, 'wss://') + '/realtime/v1/websocket?apikey=' + SUPA_ANON + '&vsn=1.0.0';
    _realtimeWS = new WebSocket(wsUrl);

    _realtimeWS.onopen = function(){
      console.log('[Realtime] Conectado a Supabase');
      // Suscribirse a INSERTs en pos_pedidos filtrados por licencia_email
      var email = localStorage.getItem('lic_email');
      if(!email) return;
      var sucursal = localStorage.getItem('pos_sucursal') || 'Principal';
      _realtimeRef++;
      var msg = {
        topic: 'realtime:public:pos_pedidos',
        event: 'phx_join',
        payload: {
          config: {
            postgres_changes: [
              {
                event: 'INSERT',
                schema: 'public',
                table: 'pos_pedidos',
                filter: 'licencia_email=eq.' + email
              },
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'pos_pedidos',
                filter: 'licencia_email=eq.' + email
              }
            ]
          }
        },
        ref: String(_realtimeRef)
      };
      _realtimeWS.send(JSON.stringify(msg));

      // Heartbeat cada 25s para mantener la conexion viva
      _realtimeWS._hb = setInterval(function(){
        if(_realtimeWS && _realtimeWS.readyState === 1){
          _realtimeRef++;
          _realtimeWS.send(JSON.stringify({
            topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(_realtimeRef)
          }));
        }
      }, 25000);
    };

    _realtimeWS.onmessage = function(e){
      try {
        var data = JSON.parse(e.data);
        if(data.event === 'postgres_changes' && data.payload && data.payload.data){
          // Nuevo pedido insertado o updateado — trigger sync inmediato
          var eventType = data.payload.data.type;
          console.log('[Realtime] Cambio en pos_pedidos:', eventType);
          if(MODO_TERMINAL === 'caja'){
            setTimeout(cajaSyncPedidosSatelite, 100);
          }
        }
      } catch(err){ /* ignorar mensajes malformados */ }
    };

    _realtimeWS.onerror = function(err){
      console.warn('[Realtime] Error WebSocket:', err);
    };

    _realtimeWS.onclose = function(){
      console.log('[Realtime] Desconectado — reintentando en 5s');
      if(_realtimeWS && _realtimeWS._hb) clearInterval(_realtimeWS._hb);
      _realtimeWS = null;
      // Reintentar conexion tras 5s
      clearTimeout(_realtimeReconnectTimer);
      _realtimeReconnectTimer = setTimeout(cajaSuscribirRealtime, 5000);
    };
  } catch(e){
    console.warn('[Realtime] No se pudo conectar:', e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SATELITE → SINCRONIZAR ESTADO DE PEDIDOS ENVIADOS
//
// El satelite envia pedidos a pos_pedidos y los guarda localmente en pendientes[].
// Cuando la caja los cobra o cancela, la satelite debe enterarse. Esta funcion
// consulta Supabase y remueve del array local los pedidos que ya estan cobrados
// o cancelados.
// ══════════════════════════════════════════════════════════════════════════════
async function sateliteSyncPedidosPendientes(){
  if(MODO_TERMINAL !== 'satelite') return;
  if(!navigator.onLine || USAR_DEMO) return;
  try {
    var email    = localStorage.getItem('lic_email');
    var terminal = localStorage.getItem('pos_terminal');
    var sucursal = localStorage.getItem('pos_sucursal') || 'Principal';
    if(!email || !terminal) return;

    // Solo pedidos de HOY para no cargar historico completo
    var hoy = new Date(); hoy.setHours(0,0,0,0);
    var hoyISO = hoy.toISOString();
    var query = 'licencia_email=eq.' + encodeURIComponent(email)
              + '&sucursal=eq.'        + encodeURIComponent(sucursal)
              + '&terminal_origen=eq.' + encodeURIComponent(terminal)
              + '&created_at=gte.'     + encodeURIComponent(hoyISO)
              + '&select=id,estado,numero_orden,mesa';

    var rows = await supaGet('pos_pedidos', query);
    if(!rows) return;

    // Crear mapa id → estado
    var estadoById = {};
    var estadoByNroMesa = {};
    rows.forEach(function(r){
      if(r.id) estadoById[r.id] = r.estado;
      var key = (r.numero_orden||'') + '|' + (r.mesa||'');
      estadoByNroMesa[key] = r.estado;
    });

    // Filtrar pendientes: eliminar los que ya fueron cobrados o cancelados
    var antes = pendientes.length;
    var sobrevivientes = pendientes.filter(function(p){
      if(!p.esSatelite) return true;
      var estado = null;
      // Matching por UUID si esta disponible (mas confiable)
      if(p.supabasePedidoId && estadoById[p.supabasePedidoId] !== undefined){
        estado = estadoById[p.supabasePedidoId];
      } else {
        // Fallback: matching por (numero_orden, mesa)
        var key = (p.nro||'') + '|' + (p.mesa_id||'');
        if(estadoByNroMesa[key] !== undefined) estado = estadoByNroMesa[key];
      }
      if(estado === 'cobrado' || estado === 'cancelado'){
        return false; // eliminar
      }
      return true;
    });

    if(sobrevivientes.length !== antes){
      setPendientes(sobrevivientes);
      guardarPendientesLocal();
      updBtnGuardar();
      if(typeof renderMesasScreen === 'function') renderMesasScreen();
      console.log('[SateliteSync] Removidos', antes - sobrevivientes.length, 'pedidos (cobrados/cancelados)');
    }
  } catch(e){ console.warn('[SateliteSync] Error:', e.message); }
}

// ══════════════════════════════════════════════════════════════════════════════
// MODO SATÉLITE — Funciones de inicialización y configuración
// ══════════════════════════════════════════════════════════════════════════════

// sateliteInicializarUI — adapta la interfaz gráfica al modo satélite.
//
// CAMBIOS EN UI:
//   1. Botones COBRAR → texto "ENVIAR PEDIDO" + color púrpura (#534AB7)
//      Afecta: btn-cobrar (móvil), tab-btn-cobrar (tablet), det-cobrar-btn (detalle)
//   2. Badge "SATÉLITE" en el header del POS (identificación visual)
//   3. Ocultar ítems de turno en el drawer (abrir/cerrar turno no aplica)
//
// SIN CAMBIOS:
//   - Catálogo de productos, búsqueda, categorías
//   - Carrito, cantidades, observaciones, descuentos
//   - Panel de mesas (onMesaTap, guardarConMesa — todo igual)
//   - Tipos de pedido: Local/Llevar/Delivery
//   - Impresión de comanda (imprimirComandaPreCobro)
//   - Pantalla de detalle del ticket
//
// Se llama desde iniciarApp() con setTimeout(sateliteInicializarUI, 500)
// para asegurar que el DOM esté completamente renderizado.
// ══════════════════════════════════════════════════════════════════════════════
// leerModoDesdeActivaciones — LEE el modo ('caja'|'satelite') y la sucursal
// directamente desde la tabla activaciones en Supabase.
//
// DISEÑO INTENCIONAL:
//   El modo NO lo elige el usuario ni el negocio. Lo configura el proveedor
//   (Emvitta) desde el super-admin antes o después de la instalación.
//   Esta función es la ÚNICA fuente de verdad para MODO_TERMINAL.
//
// CUÁNDO SE LLAMA:
//   - Al arrancar la app (iniciarApp, paso 1)
//   - Cada vez que se verifica la licencia (background, cada 24hs)
//
// MULTI-SUCURSAL:
//   activaciones.sucursal ya existe y contiene el nombre de la sucursal
//   ('Principal', 'Asunción', 'San Lorenzo', etc.).
//   El satélite filtra pos_pedidos por licencia_email + sucursal,
//   así solo ve pedidos de SU sucursal. La caja de sucursal A
//   nunca ve los pedidos de la sucursal B.
//
// FALLBACK OFFLINE:
//   Si no hay internet, usa el valor guardado en localStorage.
//   Si nunca se conectó y no hay valor, asume 'caja' (más seguro).
// ══════════════════════════════════════════════════════════════════════════════
async function leerModoDesdeActivaciones(){
  // Sin internet: usar el último valor conocido (guardado al conectarse)
  if(!navigator.onLine || USAR_DEMO){
    const modoGuardado = localStorage.getItem('pos_modo_terminal') || 'caja';
    MODO_TERMINAL = modoGuardado;
    console.log('[Modo] Offline — usando modo guardado:', MODO_TERMINAL);
    return MODO_TERMINAL;
  }

  const deviceId = licGetDeviceId();
  const email    = localStorage.getItem(SK.email);
  if(!deviceId || !email){
    console.warn('[Modo] Sin device_id o email — asumiendo modo caja');
    MODO_TERMINAL = 'caja';
    return MODO_TERMINAL;
  }

  try{
    // Consultar activaciones por device_id (identificador único del dispositivo)
    // Traer: modo, sucursal, nombre_terminal, licencia_id
    const rows = await supaGet('activaciones',
        'device_id=eq.' + encodeURIComponent(deviceId)
        + '&email=eq.'     + encodeURIComponent(email)
        + '&activa=eq.true'
        + '&select=modo,sucursal,nombre_terminal,licencia_id'
        + '&limit=1');
    const activ = Array.isArray(rows) && rows[0] ? rows[0] : null;

    if(!activ){
      console.warn('[Modo] Terminal no encontrada en activaciones — asumiendo modo caja');
      MODO_TERMINAL = localStorage.getItem('pos_modo_terminal') || 'caja';
      return MODO_TERMINAL;
    }

    // Aplicar modo leído desde Supabase (la fuente de verdad)
    const modoServidor = activ.modo || 'caja';
    MODO_TERMINAL = modoServidor;

    // Persistir en localStorage para uso offline futuro
    localStorage.setItem('pos_modo_terminal', modoServidor);

    // Actualizar sucursal si viene en activaciones (consistencia)
    if(activ.sucursal && !localStorage.getItem('pos_sucursal')){
      localStorage.setItem('pos_sucursal', activ.sucursal);
      if(typeof configData !== 'undefined') configData.sucursal = activ.sucursal;
    }

    // SIEMPRE actualizar ali desde activaciones — fuente de verdad.
    // Si había un ali de una sesión anterior con otro email (ej: demo@test.com),
    // esto lo corrige automáticamente con el valor correcto de esta licencia.
    if(activ.licencia_id){
      localStorage.setItem('ali', String(activ.licencia_id));
      cookieSet('ali', String(activ.licencia_id), 365);
    }

    console.log('[Modo] Terminal:', activ.nombre_terminal,
                '| Sucursal:', activ.sucursal,
                '| Modo:', modoServidor.toUpperCase(),
                '| Licencia ID:', activ.licencia_id);

    return MODO_TERMINAL;

  } catch(e){
    // Error de red: no bloquear, usar valor local
    console.warn('[Modo] Error leyendo activaciones:', e.message, '— usando modo guardado');
    MODO_TERMINAL = localStorage.getItem('pos_modo_terminal') || 'caja';
    return MODO_TERMINAL;
  }
}

function sateliteInicializarUI(){
  if(MODO_TERMINAL !== 'satelite') return; // no-op en modo caja

  console.log('[Satélite] Inicializando UI modo satélite...');

  // ── 1. Botón COBRAR móvil (scSale, action-bar) ───────────────────────────
  const btnCobrarMob = document.querySelector('#scSale .btn-cobrar');
  if(btnCobrarMob){
    const spanTexto = btnCobrarMob.querySelector('span:first-child');
    if(spanTexto) spanTexto.textContent = 'ENVIAR PEDIDO';
    btnCobrarMob.style.background = '#534AB7'; // púrpura = identifica modo satélite
    btnCobrarMob.style.fontSize   = '13px';    // ajuste para que entre el texto largo
  }

  // ── 2. Botón COBRAR tablet (panel derecho) ───────────────────────────────
  const btnCobrarTab = document.querySelector('.tab-btn-cobrar');
  if(btnCobrarTab){
    const spanTab = btnCobrarTab.querySelector('span:first-child');
    if(spanTab) spanTab.textContent = 'ENVIAR';
    btnCobrarTab.style.background = '#534AB7';
  }

  // ── 3. Botón COBRAR en pantalla detalle (scDetalle) ─────────────────────
  // Hay dos botones det-cobrar-btn: el de imprimir y el de cobrar
  // Solo cambiar el que llama a goCobrar()
  const btnsDet = document.querySelectorAll('.det-cobrar-btn');
  btnsDet.forEach(function(btn){
    if(btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf('goCobrar') >= 0){
      btn.textContent = 'ENVIAR PEDIDO';
      btn.style.background = '#534AB7';
      btn.style.color = '#fff';
    }
  });

  // ── 4. Badge "SATÉLITE" en el header del POS ────────────────────────────
  // Permite identificar visualmente que este dispositivo es un satélite
  if(!document.getElementById('sateliteBadge')){
    const header = document.querySelector('#scSale .htitle');
    if(header){
      const badge = document.createElement('span');
      badge.id = 'sateliteBadge';
      badge.textContent = 'SATÉLITE';
      badge.style.cssText = [
        'font-size:9px',
        'font-weight:800',
        'background:#534AB7',
        'color:#fff',
        'padding:2px 6px',
        'border-radius:4px',
        'letter-spacing:.5px',
        'margin-left:4px',
        'vertical-align:middle',
        'font-family:Barlow,sans-serif',
      ].join(';');
      header.appendChild(badge);
    }
  }

  // ── 5. Ocultar turno en el drawer ────────────────────────────────────────
  // Los meseros no abren/cierran turno — eso es exclusivo de la caja
  // Buscar por el texto del ítem en el drawer
  const drawerItems = document.querySelectorAll('.drawer-item');
  drawerItems.forEach(function(item){
    const txt = item.textContent || '';
    // Ocultar ítems de turno/caja (ajustar strings según el HTML del drawer)
    if(txt.indexOf('Turno') >= 0 || txt.indexOf('Caja') >= 0 || txt.indexOf('Cierre') >= 0){
      item.style.display = 'none';
    }
  });

  console.log('[Satélite] UI adaptada: COBRAR → ENVIAR PEDIDO, badge visible, turno oculto');
}

// sateliteConfigurarModo — cambia el modo del terminal y recarga la UI.
//
// USO DESDE ADMIN:
//   sateliteConfigurarModo('satelite')  → activa modo satélite
//   sateliteConfigurarModo('caja')      → activa modo caja (default)
//
// Persiste en localStorage Y en Supabase (tabla activaciones, campo modo).
// Requiere recarga de la app para aplicar completamente.
//
// Se llama desde admin-negocio.html en la sección de configuración de terminal.
async function sateliteConfigurarModo(modo){
  if(modo !== 'caja' && modo !== 'satelite'){
    console.warn('[Satélite] Modo inválido:', modo);
    return;
  }

  // Guardar localmente
  localStorage.setItem('pos_modo_terminal', modo);
  MODO_TERMINAL = modo;

  // Intentar persistir en Supabase (campo modo en tabla activaciones)
  const email    = localStorage.getItem('lic_email');
  const terminal = localStorage.getItem('pos_terminal');
  if(email && terminal && navigator.onLine && !USAR_DEMO){
    try{
      await supaPatch('activaciones',
        'email=eq.' + encodeURIComponent(email)
          + '&nombre_terminal=eq.' + encodeURIComponent(terminal),
        { modo }, true);
      console.log('[Satélite] Modo ' + modo + ' guardado en Supabase para terminal:', terminal);
    } catch(e){
      console.warn('[Satélite] No se pudo guardar modo en Supabase:', e.message);
    }
  }

  toast('Modo ' + (modo === 'satelite' ? 'SATÉLITE' : 'CAJA') + ' configurado — reiniciá la app para aplicar');
}

// sateliteVerificarCajaActiva — verifica si hay un turno abierto en Supabase.
//
// MODO SATÉLITE ARRANQUE:
//   Al iniciar, el satélite verifica si la caja abrió turno.
//   Si no hay turno: muestra aviso "Esperando que el cajero abra el turno"
//   Si hay turno: permite tomar pedidos normalmente.
//
// Retorna: true si hay caja activa, false si no.
async function sateliteVerificarCajaActiva(){
  if(MODO_TERMINAL !== 'satelite') return true;
  if(!navigator.onLine || USAR_DEMO) return true;

  var email    = localStorage.getItem('lic_email');
  var sucursal = localStorage.getItem('pos_sucursal') || 'Principal';
  if(!email) return false;

  try{
    var rows = await supaGet('pos_turno',
        'licencia_email=eq.' + encodeURIComponent(email)
        + '&sucursal=eq.' + encodeURIComponent(sucursal)
        + '&estado=eq.abierto'
        + '&limit=1'
        + '&select=id,terminal,fecha_apertura,sucursal');
    var hayTurno = Array.isArray(rows) && rows.length > 0;
    if(hayTurno){
      console.log('[Satelite] Caja activa en ' + sucursal + ' — turno de:', rows[0].terminal);
    } else {
      console.warn('[Satelite] Sin caja abierta en sucursal ' + sucursal);
    }
    return hayTurno;
  } catch(e){
    console.warn('[Satelite] Error verificando caja:', e.message);
    return true;
  }
}

// ── Pantalla de espera: satelite esperando caja abierta ──────────────────────
var _satelitePollingId = null;

function sateliteMostrarEsperaCaja(){
  // No duplicar overlay
  if(document.getElementById('sateliteEsperaOverlay')) return;

  var sucursal = localStorage.getItem('pos_sucursal') || 'Principal';
  var div = document.createElement('div');
  div.id = 'sateliteEsperaOverlay';
  div.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#1a1a1a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px;';
  div.innerHTML =
    '<div style="width:64px;height:64px;border-radius:18px;background:rgba(83,74,183,.15);border:2px solid #534AB7;display:flex;align-items:center;justify-content:center;">' +
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#534AB7" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
    '</div>' +
    '<h2 style="color:#fff;font-family:Barlow,sans-serif;font-size:20px;font-weight:800;text-align:center;margin:0;">Esperando caja abierta</h2>' +
    '<p style="color:#888;font-family:Barlow,sans-serif;font-size:14px;text-align:center;max-width:300px;line-height:1.5;margin:0;">' +
      'No hay turno abierto en sucursal <b style="color:#fff;">' + sucursal + '</b>.<br>El cajero debe abrir turno para que puedas tomar pedidos.' +
    '</p>' +
    '<div id="sateliteEsperaStatus" style="color:#534AB7;font-family:Barlow,sans-serif;font-size:12px;font-weight:700;letter-spacing:.5px;">Verificando cada 15 segundos...</div>' +
    '<button onclick="sateliteReintentarCaja()" style="margin-top:12px;background:#534AB7;border:none;border-radius:8px;color:#fff;font-family:Barlow,sans-serif;font-size:14px;font-weight:800;padding:14px 32px;cursor:pointer;letter-spacing:.5px;">REINTENTAR AHORA</button>';
  document.body.appendChild(div);

  // Iniciar polling
  sateliteIniciarPollingCaja();
}

function sateliteOcultarEsperaCaja(){
  var overlay = document.getElementById('sateliteEsperaOverlay');
  if(overlay) overlay.remove();
  if(_satelitePollingId){
    clearInterval(_satelitePollingId);
    _satelitePollingId = null;
  }
}

function sateliteIniciarPollingCaja(){
  if(_satelitePollingId) clearInterval(_satelitePollingId);
  _satelitePollingId = setInterval(async function(){
    var status = document.getElementById('sateliteEsperaStatus');
    if(status) status.textContent = 'Verificando...';
    var activa = await sateliteVerificarCajaActiva();
    if(activa){
      sateliteOcultarEsperaCaja();
      toast('Caja abierta detectada');
      // Entrar al POS
      if(typeof mesasSalones !== 'undefined' && mesasSalones && mesasSalones.length > 0){
        if(typeof mesasCargar === 'function') await mesasCargar();
        goTo('scMesas');
        if(typeof renderMesasScreen === 'function') renderMesasScreen();
      } else {
        goTo('scSale');
        if(typeof renderCatPills === 'function') renderCatPills();
        if(typeof filterP === 'function') filterP();
      }
    } else {
      if(status) status.textContent = 'Sin caja abierta. Reintentando en 15s...';
    }
  }, 15000);
}

async function sateliteReintentarCaja(){
  var status = document.getElementById('sateliteEsperaStatus');
  if(status) status.textContent = 'Verificando...';
  var activa = await sateliteVerificarCajaActiva();
  if(activa){
    sateliteOcultarEsperaCaja();
    toast('Caja abierta detectada');
    if(typeof mesasSalones !== 'undefined' && mesasSalones && mesasSalones.length > 0){
      if(typeof mesasCargar === 'function') await mesasCargar();
      goTo('scMesas');
      if(typeof renderMesasScreen === 'function') renderMesasScreen();
    } else {
      goTo('scSale');
      if(typeof renderCatPills === 'function') renderCatPills();
      if(typeof filterP === 'function') filterP();
    }
  } else {
    if(status) status.textContent = 'Sin caja abierta. Reintentando en 15s...';
    toast('No hay caja abierta todavia');
  }
}
