// ── App: PRODS, utilidades, config negocio, carrito, drawer, configuración, print UI ──

const PRODS = [
  // El ítem libre siempre existe (id:99) — no se guarda en Supabase
  {id:99,name:'ÍTEM LIBRE',price:0,color:'#546e7a',cat:'Otros',
   precioVariable:true,itemLibre:true,iva:'10',colorPropio:false},
]


// ── UTILIDADES ───────────────────────────────────────────────

// ── CONFIG ───────────────────────────────────────────────────

async function sincronizarConfigNegocio(){
  const email = localStorage.getItem('lic_email');
  if(!email || USAR_DEMO) return;
  try {
    const rows = await supaGet('pos_config',
      'licencia_email=eq.'+encodeURIComponent(email)+
      '&clave=in.(negocio_config,timbrados_config,timbrados_mapa)');

    rows.forEach(row => {
      try {
        const val = JSON.parse(row.valor||'{}');
        if(row.clave === 'negocio_config'){
          if(val.an)  configData.negocio   = val.an;
          if(val.ar)  configData.ruc        = val.ar;
          if(val.ad)  configData.direccion  = val.ad;
          if(val.ciudad) configData.ciudad  = val.ciudad;
          if(val.at)  configData.telefono   = val.at;
          if(val.email_negocio) configData.email = val.email_negocio;
          if(val.pie_recibo)    configData.pie_recibo  = val.pie_recibo;
          if(val.mostrar_ruc)   configData.mostrar_ruc = val.mostrar_ruc;
          if(val.moneda)        configData.moneda = val.moneda;
          Object.entries(val).forEach(([k,v])=>{ if(v) localStorage.setItem(k,v); });
          console.log('[Config] Negocio:', configData.negocio, '| RUC:', configData.ruc);
        }
      } catch(e){ console.warn('[Config] Error parsing', row.clave, e.message); }
    });
    cargarTimbradoSesion();
  } catch(e){ console.warn('[Config] Error sync:', e.message); }
}

function renderGeneralInfo(){
  const el = document.getElementById('generalInfoPanel');
  if(!el) return;
  const terminal   = localStorage.getItem('pos_terminal') || 'Terminal 1';
  const sucursal   = localStorage.getItem('pos_sucursal') || '—';
  const depId      = localStorage.getItem('pos_deposito_id') || null;
  const tim = getTimbradoActivo();
  const pad3 = n => String(n||0).padStart(3,'0');
  const padN = n => String(n||0).padStart(7,'0');
  el.innerHTML = `
    <div style="background:#111;border:1.5px solid #2a2a2a;border-radius:10px;overflow:hidden;margin-bottom:14px;">
      <div style="padding:10px 14px;border-bottom:1px solid #1e1e1e;display:flex;align-items:center;gap:8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <span style="font-size:10px;font-weight:800;color:var(--green);letter-spacing:1px;text-transform:uppercase;">Esta Terminal</span>
      </div>
      <div style="padding:10px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12px;color:#777;">Nombre</span>
          <span style="font-size:16px;font-weight:800;color:#fff;">${terminal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12px;color:#777;">Sucursal</span>
          <span style="font-size:13px;font-weight:600;color:#ccc;">${sucursal}</span>
        </div>
      </div>
    </div>
    ${tim ? `
    <div style="background:#111;border:1.5px solid rgba(76,175,80,.3);border-radius:10px;overflow:hidden;margin-bottom:14px;">
      <div style="padding:10px 14px;border-bottom:1px solid #1e1e1e;">
        <span style="font-size:10px;font-weight:800;color:var(--green);">TIMBRADO ACTIVO</span>
      </div>
      <div style="padding:10px 14px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:12px;color:#777;">Timbrado</span>
          <span style="font-size:13px;font-weight:800;color:#fff;font-family:monospace;">${tim.nro}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-top:4px;border-top:1px solid #1e1e1e;">
          <span style="font-size:12px;color:#777;">Próxima factura</span>
          <span style="font-size:14px;font-weight:800;color:var(--green);font-family:monospace;">${pad3(tim.sucursal)}-${pad3(tim.punto_exp)}-${padN(tim.nro_actual||tim.desde||1)}</span>
        </div>
      </div>
    </div>` : `
    <div style="background:rgba(239,83,80,.08);border:1.5px solid rgba(239,83,80,.3);border-radius:10px;padding:12px 14px;margin-bottom:14px;">
      <span style="font-size:13px;font-weight:700;color:#ef5350;">Sin timbrado configurado</span>
    </div>`}
  `;
  // Panel de diagnóstico
  const licId     = localStorage.getItem('ali') || '—';
  const sucId     = localStorage.getItem('pos_sucursal_id') || '—';
  const depId2    = localStorage.getItem('pos_deposito_id') || '—';
  const termId    = localStorage.getItem('pos_terminal_id') || '—';
  const dbVer     = localStorage.getItem('pos_db_version') || '—';
  const online    = navigator.onLine ? '✓ Online' : '✗ Offline';
  const ua        = navigator.userAgent.match(/Chrome\/([\d.]+)/);
  const chrome    = ua ? 'Chrome '+ua[1] : navigator.userAgent.substring(0,40);
  const pwaMode   = window.matchMedia('(display-mode: standalone)').matches ? 'PWA (standalone)' : 'Navegador';

  el.innerHTML += `
    <div style="background:#111;border:1.5px solid #2a2a2a;border-radius:10px;overflow:hidden;margin-bottom:14px;">
      <div style="padding:10px 14px;border-bottom:1px solid #1e1e1e;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff9800" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style="font-size:10px;font-weight:800;color:#ff9800;letter-spacing:1px;text-transform:uppercase;">Diagnóstico</span>
        </div>
        <button onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('diagPanel').innerText).then(()=>toast('✓ Copiado'))" style="background:none;border:1px solid #333;border-radius:6px;color:#777;font-size:10px;font-weight:700;padding:4px 8px;cursor:pointer;font-family:Barlow,sans-serif;">COPIAR</button>
      </div>
      <div id="diagPanel" style="padding:10px 14px;display:flex;flex-direction:column;gap:5px;font-family:monospace;font-size:12px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:#777;">Licencia ID</span><span style="color:#fff;font-weight:700;">${licId}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#777;">Sucursal ID</span><span style="color:#fff;">${sucId}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#777;">Depósito ID</span><span style="color:#fff;">${depId2}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#777;">Terminal ID</span><span style="color:#fff;">${termId}</span></div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid #1e1e1e;margin-top:4px;padding-top:5px;"><span style="color:#777;">Conexión</span><span style="color:${navigator.onLine?'#4caf50':'#ef5350'};">${online}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#777;">Modo</span><span style="color:#ccc;">${pwaMode}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#777;">Navegador</span><span style="color:#ccc;">${chrome}</span></div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid #1e1e1e;margin-top:4px;padding-top:5px;">
          <span style="color:#777;">URL base</span>
          <span style="color:#ccc;font-size:10px;max-width:180px;text-align:right;word-break:break-all;">${SUPA_URL.replace('https://','').substring(0,30)}...</span>
        </div>
      </div>
    </div>
  `;

  loadGeneralConfigInputs();
}

function loadGeneralConfigInputs(){
  const set = (id, val) => { const el = document.getElementById(id); if(el && val) el.value = val; };
  set('cfgNegocio',   configData.negocio   || localStorage.getItem('an') || '');
  set('cfgDireccion', configData.direccion  || localStorage.getItem('ad') || '');
  set('cfgTelefono',  configData.telefono   || localStorage.getItem('at') || '');
  set('cfgRuc',       configData.ruc        || localStorage.getItem('ar') || '');
  const chk = document.getElementById('cfgPresupuestos');
  if(chk){
    const habilitado = configData.presupuestosHabilitados !== undefined
      ? configData.presupuestosHabilitados
      : localStorage.getItem('pos_presupuestos') === '1';
    chk.checked = !!habilitado;
    configData.presupuestosHabilitados = !!habilitado;
  }
  const chkCom = document.getElementById('cfgComandas');
  if(chkCom){
    const hab = configData.comandasHabilitadas !== undefined
      ? configData.comandasHabilitadas
      : localStorage.getItem('pos_comandas') === '1';
    chkCom.checked = !!hab;
    configData.comandasHabilitadas = !!hab;
  }
  // Cargar config precio mitad
  if(typeof loadCfgMitad === 'function') loadCfgMitad();
}

function presupuestosHabilitados(){
  return !!(configData.presupuestosHabilitados || localStorage.getItem('pos_presupuestos') === '1');
}

function comandasHabilitadas(){
  return !!(configData.comandasHabilitadas || localStorage.getItem('pos_comandas') === '1');
}

function updBtnComandaCobro(){
  // Actualizar badge de ítems pendientes de enviar a cocina
  const pendientes = cart.filter(i => !i.enviado).length;
  // Badge en pantalla de cobro
  const badgeEl = document.getElementById('comandaBadge');
  if(badgeEl){
    badgeEl.textContent = pendientes;
    badgeEl.style.display = pendientes > 0 ? 'inline-flex' : 'none';
  }
  // Badge en botón 🍳 de pantalla de venta
  const badge2 = document.getElementById('comandaBadge2');
  if(badge2){
    badge2.textContent = pendientes;
    badge2.style.display = pendientes > 0 ? 'inline-flex' : 'none';
  }
  const btn = document.getElementById('btnComandaCobro');
  if(btn) btn.style.display = comandasHabilitadas() ? 'flex' : 'none';
}

function renderConfigInfo(){
  const el = document.getElementById('configInfoPanel');
  if(!el) return;
  const terminal  = localStorage.getItem('pos_terminal') || 'Terminal 1';
  const sucursal  = localStorage.getItem('pos_sucursal') || '—';
  const deposito  = localStorage.getItem('pos_deposito') || '—';
  const negocio   = configData.negocio   || localStorage.getItem('an') || '—';
  const ruc       = configData.ruc       || localStorage.getItem('ar') || '—';
  const direccion = configData.direccion || localStorage.getItem('ad') || '—';
  const ciudad    = configData.ciudad    || localStorage.getItem('ciudad') || '';
  const telefono  = configData.telefono  || localStorage.getItem('at') || '—';
  const email     = localStorage.getItem('lic_email') || '—';
  const plan      = localStorage.getItem('lic_plan')  || '—';
  const vence     = localStorage.getItem('lic_vence') || '—';
  const tim = getTimbradoActivo();
  const pad3 = n => String(n||0).padStart(3,'0');
  const padN = n => String(n||0).padStart(7,'0');
  const timInfo = tim ? pad3(tim.sucursal)+'-'+pad3(tim.punto_exp)+' · Timb. '+tim.nro : null;
  el.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;margin-bottom:12px;">
      <div style="background:#222;padding:10px 14px;display:flex;align-items:center;gap:8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <span style="font-size:12px;font-weight:800;color:var(--green);text-transform:uppercase;">Esta Terminal</span>
      </div>
      <div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#777;">Nombre</span>
          <span style="font-size:15px;font-weight:800;color:#fff;">${terminal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#777;">Sucursal</span>
          <span style="font-size:13px;font-weight:600;color:#ccc;">${sucursal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#777;">Depósito</span>
          <span style="font-size:13px;color:#aaa;">${deposito}</span>
        </div>
        ${timInfo ? `
        <div style="border-top:1px solid #2a2a2a;padding-top:8px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#777;">Timbrado</span>
          <span style="font-size:12px;font-weight:700;color:var(--green);font-family:monospace;">${timInfo}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#777;">Próx. factura</span>
          <span style="font-size:13px;font-weight:700;color:#fff;font-family:monospace;">${pad3(tim.sucursal)}-${pad3(tim.punto_exp)}-${padN(tim.nro_actual||tim.desde||1)}</span>
        </div>` : `
        <div style="border-top:1px solid #2a2a2a;padding-top:8px;">
          <span style="font-size:12px;color:#ef5350;">⚠️ Sin timbrado asignado</span>
        </div>`}
      </div>
    </div>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;margin-bottom:12px;">
      <div style="background:#222;padding:10px 14px;">
        <span style="font-size:12px;font-weight:800;color:#42a5f5;text-transform:uppercase;">Datos del Negocio</span>
      </div>
      <div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <span style="font-size:12px;color:#777;flex-shrink:0;">Razón social</span>
          <span style="font-size:13px;font-weight:700;color:#fff;text-align:right;">${negocio}</span>
        </div>
        ${ruc !== '—' ? `<div style="display:flex;justify-content:space-between;"><span style="font-size:12px;color:#777;">RUC</span><span style="font-size:13px;font-weight:600;color:#ccc;font-family:monospace;">${ruc}</span></div>` : ''}
        ${direccion !== '—' ? `<div style="display:flex;justify-content:space-between;gap:8px;"><span style="font-size:12px;color:#777;flex-shrink:0;">Dirección</span><span style="font-size:12px;color:#aaa;text-align:right;">${direccion}${ciudad?', '+ciudad:''}</span></div>` : ''}
        ${telefono !== '—' ? `<div style="display:flex;justify-content:space-between;"><span style="font-size:12px;color:#777;">Teléfono</span><span style="font-size:13px;color:#aaa;">${telefono}</span></div>` : ''}
      </div>
    </div>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;margin-bottom:12px;">
      <div style="background:#222;padding:10px 14px;">
        <span style="font-size:12px;font-weight:800;color:#ff9800;text-transform:uppercase;">Licencia</span>
      </div>
      <div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;"><span style="font-size:12px;color:#777;">Email</span><span style="font-size:12px;color:#aaa;">${email}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="font-size:12px;color:#777;">Plan</span><span style="font-size:13px;font-weight:700;color:var(--green);">${plan}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="font-size:12px;color:#777;">Vence</span><span style="font-size:13px;color:#aaa;">${vence}</span></div>
      </div>
    </div>`;
  const emailEl = document.getElementById('configEmail');
  if(emailEl) emailEl.textContent = email;
}

function cargarConfigLocal(){
  const keys = {
    an:'negocio', ar:'ruc', ad:'direccion',
    ciudad:'ciudad', at:'telefono', pie_recibo:'pie_recibo',
    mostrar_ruc:'mostrar_ruc', moneda:'moneda'
  };
  Object.entries(keys).forEach(([lk, ck])=>{
    const v = localStorage.getItem(lk);
    if(v) configData[ck] = v;
  });
}

// ── CARRITO ──────────────────────────────────────────────────
function updUI(){
  const t=calcTotal(), c=cart.reduce((s,i)=>s+i.qty,0);
  document.getElementById('sAmt').textContent=gs(t);
  document.getElementById('sBadge').textContent=c;
  document.getElementById('ttotal').textContent=gs(t);
  const tabAmt = document.getElementById('tabCobrarAmt');
  const tabTotal = document.getElementById('tabTotal');
  if(tabAmt) tabAmt.textContent=gs(t);
  if(tabTotal) tabTotal.textContent=gs(t);
  if(typeof renderTabletTicket==='function') renderTabletTicket();
  updTabTicketHeader();
  updBtnComandaCobro(); // actualizar badge de comanda pendiente
}
function toggleTicket(){
  setShowTkt(!showTkt);
  document.getElementById('tpanel').classList.toggle('open',showTkt);
  document.getElementById('prodView').style.display=showTkt?'none':'flex';
  if(showTkt)renderTkt();
}
function renderTkt(){
  const tl=document.getElementById('tlist');
  if(!cart.length){tl.innerHTML='<div class="tempty"><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.3"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg><p>Ticket vacío</p></div>';return;}
  tl.innerHTML=cart.map(i=>i.esDescuento
    ? `<div class="titem" style="border-left:2px solid #ef5350;"><div class="tiname" style="color:#ef9a9a;">${i.name}</div><div class="tictrl"><button class="qbtn" onclick="chgQty(${i.lineId},-1)">✕</button></div><div class="tiprice" style="color:#ef5350;">-${gs(i.montoDesc)}</div></div>`
    : `<div class="titem" style="${i.enviado?'opacity:.6;':''}">`+
        `<div class="tiname">`+
          (i.enviado ? '<span style="font-size:9px;color:#4caf50;font-weight:700;letter-spacing:.3px;text-transform:uppercase;display:block;line-height:1.2;">✓ enviado</span>' : '')+
          i.name+
          (i.obs?'<div style="font-size:11px;color:#888;font-weight:400;text-transform:none;margin-top:2px;">'+i.obs+'</div>':'')+
        `</div>`+
        `<div class="tictrl"><button class="qbtn" onclick="chgQty(${i.lineId},-1)">−</button><span class="qnum">${i.qty}</span><button class="qbtn" onclick="chgQty(${i.lineId},1)">+</button></div>`+
        `<div class="tiprice">${gs(i.price*i.qty)}</div>`+
      `</div>`
  ).join('');
}


  const v = parseInt(document.getElementById('shiftDisp').textContent.replace(/[₲.,]/g,''))||0;

  // Verificar licencia antes de abrir turno (si hay internet)
function updBtnGuardar(){
  const n=pendientes.length, tieneProductos=calcTotal()>0;
  const badge=document.getElementById('pendingBadge'), txt=document.getElementById('btnGuardarTxt'), icon=document.getElementById('btnGuardarIcon');
  const tabBadge=document.getElementById('tabPendingBadge'), tabTxt=document.getElementById('tabBtnTxt');
  if(tieneProductos){
    txt.textContent='GUARDAR'; if(tabTxt)tabTxt.textContent='GUARDAR';
    icon.innerHTML='<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>';
    if(n>0){ badge.textContent=n>9?'9+':n; badge.classList.add('show'); if(tabBadge){tabBadge.textContent=badge.textContent;tabBadge.style.display='flex';} }
    else { badge.classList.remove('show'); if(tabBadge)tabBadge.style.display='none'; }
  } else if(n>0){
    badge.textContent=n>9?'9+':n; badge.classList.add('show');
    txt.textContent='PENDIENTES'; icon.innerHTML='<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>';
    if(tabBadge){tabBadge.textContent=badge.textContent;tabBadge.style.display='flex';} if(tabTxt)tabTxt.textContent='PENDIENTES';
  } else {
    badge.classList.remove('show'); txt.textContent='GUARDAR';
    icon.innerHTML='<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>';
    if(tabBadge)tabBadge.style.display='none'; if(tabTxt)tabTxt.textContent='GUARDAR';
  }
}

async function doOpenShift(){
  const v   = parseInt(document.getElementById('shiftDisp').textContent.replace(/[₲.,]/g,''))||0;
  const btn = document.querySelector('#scClosed .btn-abrir-outline') || document.querySelector('[onclick*="doOpenShift"]');

  if(navigator.onLine){
    if(btn){ btn.textContent='Verificando...'; btn.disabled=true; }
    const ok = await licVerificarAhora();
    if(btn){ btn.textContent='ABRIR EL TURNO'; btn.disabled=false; }
    if(!ok) return; // licMostrarBloqueo ya fue llamado
  }

  turnoData.fechaApertura  = await obtenerFechaServidor(); // hora del servidor, no del dispositivo
  turnoData.efectivoInicial = v;
  turnoData.ventas          = [];
  turnoData.egresos         = [];
  turnoData.ingresos        = [];
  turnoData.supaId          = null;
  turnoData.dbId            = null;
  // Guardar apertura en Supabase (background, no bloquea)
  supaInsertTurno('abierto', v);
  // Esperar a que IndexedDB asigne el dbId ANTES de guardar en localStorage
  // para que turnoData.dbId quede persistido correctamente
  if(db){
    try { await dbAbrirTurno(v); } catch(e){ console.warn('[Turno] Error al abrir turno en IndexedDB:', e.message); }
  }
  // Persistir en localStorage DESPUÉS de tener el dbId
  turnoGuardar();
  goTo('scSale'); renderCatPills(); filterP(); toast('Turno abierto ✓');
}

// ══════════════════════════════════════════════════════════════════════════════
// obtenerFechaServidor — retorna la hora del servidor Supabase (PostgreSQL).
//
// POR QUÉ:
//   new Date() usa el reloj del dispositivo. En Android, si el usuario tiene
//   la fecha/hora manual o el zona horaria mal configurada, los timestamps
//   de ventas y turnos quedan incorrectos.
//   Supabase/PostgreSQL tiene el reloj del servidor (UTC) siempre correcto.
//
// USO:
//   const ahora = await obtenerFechaServidor();
//   // ahora es un Date() con la hora real del servidor
//
// FALLBACK:
//   Si no hay internet o Supabase falla, retorna new Date() del dispositivo.
//   La app nunca se bloquea por esto.
//
// CACHE:
//   Guarda el offset entre servidor y dispositivo en memoria (_serverOffset).
//   Las llamadas subsiguientes usan el offset sin consultar Supabase de nuevo.
//   El offset se recalcula cada vez que hay internet disponible.
// ══════════════════════════════════════════════════════════════════════════════
var _serverOffset = 0; // diferencia en ms entre servidor y dispositivo
var _serverOffsetOk = false; // si el offset fue calculado exitosamente

async function obtenerFechaServidor(){
  // Intentar calcular el offset si no lo tenemos aún
  if(!_serverOffsetOk && navigator.onLine && !USAR_DEMO){
    try{
      const t0 = Date.now();
      // Consulta mínima a Supabase — solo para obtener la hora del servidor
      // Usamos /rest/v1/ con una tabla que siempre existe y traemos 0 rows
      const res = await fetch(
        SUPA_URL + '/rest/v1/pos_config?limit=0&select=id',
        { headers: supaHeaders({ 'Accept': 'application/json' }) }
      );
      const t1 = Date.now();
      // El header Date de la respuesta HTTP es la hora del servidor
      const serverDateStr = res.headers.get('date');
      if(serverDateStr){
        const serverMs = new Date(serverDateStr).getTime();
        // Compensar la latencia de red (mitad del round-trip)
        const latencia = Math.round((t1 - t0) / 2);
        _serverOffset = (serverMs + latencia) - t1;
        _serverOffsetOk = true;
        console.log('[FechaServidor] Offset calculado:',
          (_serverOffset >= 0 ? '+' : '') + _serverOffset + 'ms respecto al dispositivo',
          '| Latencia:', latencia + 'ms'
        );
      }
    } catch(e){
      console.warn('[FechaServidor] No se pudo calcular offset:', e.message);
    }
  }
  // Retornar fecha ajustada con el offset
  return new Date(Date.now() + _serverOffset);
}

// Sincronizar el offset al arrancar (background, sin bloquear)
function sincronizarFechaServidor(){
  _serverOffsetOk = false; // forzar recálculo
  obtenerFechaServidor().catch(function(e){ console.warn('[FechaServidor] Error en sincronización background:', e.message); });
}

function supaInsertTurno(estado, efectivoInicial){
  const email = localStorage.getItem('lic_email');
  if(!email) return;
  const data = {
    fecha_apertura:   new Date().toISOString(),
    efectivo_inicial: efectivoInicial || 0,
    estado:           estado,
    terminal:         localStorage.getItem('pos_terminal') || 'Terminal 1',
    licencia_email:   email,
  };
  supaPost('pos_turno', data).then(rows=>{
    if(rows&&rows[0]) turnoData.supaId = rows[0].id;
    console.log('[Turno] Guardado en Supabase id:', rows&&rows[0]&&rows[0].id);
  }).catch(e=>console.warn('[Turno] Error Supabase:', e.message));
}
function diag(msg){ /* diag disabled */ }

function renderCatPills(){
  const bar = document.getElementById('catPillBar');
  if(!bar) return;
  const todos = 'Todos los artículos';
  const cats = [todos, ...CATEGORIAS.map(c=>c.nombre)];
  const hasDescs = (typeof DESCUENTOS!=='undefined' && DESCUENTOS.filter(d=>d.activo!==false).length) ||
    PRODS.filter(p=>p.cat==='Descuentos'&&p.activo!==false).length;
  if(hasDescs) cats.push('🏷️ Descuentos');
  bar.innerHTML = cats.map(function(c){
    const sel = curCat===c ? ' sel' : '';
    return '<button class="cat-pill'+sel+'" onclick="pickCat(this)">'+c+'</button>';
  }).join('');
}
function renderCategoriasVenta(){
  var _catOv=document.getElementById('catOv'); if(_catOv && _catOv.classList.contains('open')) openCat();
}
function closeCat(e){ if(e.target===document.getElementById('catOv'))document.getElementById('catOv').classList.remove('open'); }
function pickCat(el){
  const cat = typeof el === 'string' ? el : el.textContent.trim();
  curCat = cat;
  const lbl = document.getElementById('catLbl');
  if(lbl) lbl.textContent = cat;
  document.getElementById('catOv').classList.remove('open');
  renderCatPills();
  filterP();
}
function openCat(){
  const sheet = document.getElementById('catSheetContent');
  const todos = 'Todos los artículos';
  function catItem(nombre, color){
    const sel = curCat===nombre;
    const colorStyle = color ? 'color:'+color+';border-left-color:'+color+';' : '';
    const ic = color ? 'background:'+color+';' : '';
    return '<div class="cat-item'+(sel?' sel':'')+'\" onclick="pickCat(this)" style="'+colorStyle+'">'
      +'<div class="cat-item-ic" style="'+ic+'"></div>'
      +nombre
      +(sel?'<svg style="margin-left:auto" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>':'')
      +'</div>';
  }
  let html = catItem(todos);
  CATEGORIAS.forEach(c => { html += catItem(c.nombre, c.color||null); });
  sheet.innerHTML = html;
  document.getElementById('catOv').classList.add('open');
}

function _getImgSrcSync(p){
  if(!p.imagen) return null;
  return p.imagen; // URL de Supabase Storage o base64
}

function _tileProd(p){
  const imgSrc = _getImgSrcSync(p);
  if(imgSrc){
    return '<div class="ptile" style="background:'+getProductColor(p)+';position:relative;overflow:hidden;" onclick="addCart('+p.id+',this)">'+
      '<img src="'+imgSrc+'" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;" '+
        'onerror="this.style.display=\'none\'" loading="lazy">'+
      '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.8));padding:8px 4px 5px;">'+
        '<span class="pname" style="text-shadow:0 1px 3px rgba(0,0,0,.9);color:#fff;">'+p.name+'</span>'+
      '</div>'+
    '</div>';
  }
  if(p.itemLibre){
    return '<div class="ptile" style="background:#37474f;border:2px dashed #78909c;box-sizing:border-box;" onclick="addCart('+p.id+',this)"><span class="pname">'+p.name+'</span></div>';
  }
  return '<div class="ptile" style="background:'+getProductColor(p)+'" onclick="addCart('+p.id+',this)"><span class="pname">'+p.name+'</span></div>';
}

function renderP(list){
  const g=document.getElementById('pgrid');
  if(!g) return;
  if(!list.length){
    g.innerHTML='<div style="grid-column:span 3;padding:40px;text-align:center;color:#555;font-size:14px;">Sin resultados</div>';
    return;
  }
  g.innerHTML = list.map(p => _tileProd(p)).join('');
}
let _filterPTimer = null;
function filterP(){
  // Debounce — evita renders simultáneos cuando supaLoad y renderCatPills se llaman juntos
  clearTimeout(_filterPTimer);
  _filterPTimer = setTimeout(_filterPInternal, 16);
}
function _filterPInternal(){
  const q = document.getElementById('sinput').value.toLowerCase();

  // Categoría especial: Descuentos
  if(curCat==='Descuentos' || curCat==='🏷️ Descuentos'){
    renderDescuentosTiles();
    return;
  }

  // Si la categoría seleccionada ya no existe, resetear a Todos
  if(curCat !== 'Todos los artículos'){
    const catExiste = CATEGORIAS.some(c=>c.nombre===curCat);
    if(!catExiste){
      curCat = 'Todos los artículos';
      const lbl = document.getElementById('catLbl');
      if(lbl) lbl.textContent = 'Todos los artículos';
    }
  }

  // Productos normales — excluir inactivos e ítem libre
  // NO filtrar por cat=Descuentos ya que eso rompe productos mal categorizados
  let l = (curCat==='Todos los artículos' ? PRODS : PRODS.filter(p=>p.cat===curCat))
           .filter(p=>!p.itemLibre && p.activo!==false && p.activo!==0);
  if(q) l = l.filter(p=>p.name.toLowerCase().includes(q));

  // Ítem libre siempre al final (en todas las vistas, sin búsqueda activa)
  if(!q){
    const libre = PRODS.find(p=>p.itemLibre);
    if(libre) l = [...l, libre];
  }
  renderP(l);
}

function renderDescuentosTiles(){
  const g = document.getElementById('pgrid');
  const descIds2 = new Set(DESCUENTOS.map(d=>String(d.id)));
  const prodsDesc2 = PRODS.filter(p=>
    p.cat==='Descuentos' && p.activo!==false && !descIds2.has(String(p.id))
  );
  const descs = [
    ...DESCUENTOS.filter(d=>d.activo!==false),
    ...prodsDesc2.map(p=>({id:p.id,name:p.name,tipo:p.descTipo||'%',valor:p.descValor||null}))
  ];
  if(!descs.length){
    g.innerHTML = '<div style="grid-column:span 3;padding:40px;text-align:center;color:#555;font-size:14px;">Sin descuentos — creá uno en Artículos → Descuentos</div>';
    return;
  }
  g.innerHTML = descs.map(d => {
    const valStr = d.valor!=null
      ? (d.tipo==='%' ? d.valor+'%' : gs(d.valor))
      : 'valor al vender';
    return '<div class="ptile" style="background:#b71c1c;" onclick="addDescuento('+d.id+')">'+
      '<span class="pname" style="font-size:11px;">'+d.name+'<br>'+
      '<span style="font-size:13px;font-weight:800;">'+valStr+'</span></span>'+
    '</div>';
  }).join('');
}
function toggleSearch(){
  const sb=document.getElementById('sbar'); sb.classList.toggle('open');
  if(sb.classList.contains('open'))document.getElementById('sinput').focus();
  else{document.getElementById('sinput').value='';filterP();}
}


// -- Pedidos: ver js/pedidos.js --

function goDetalle(){
  if(calcTotal() === 0){ toast('El ticket está vacío'); return; }
  renderDetalle();
  goTo('scDetalle');
}
function renderDetalle(){
  const items = cart;
  const total = calcTotal();
  const count = items.reduce((s,i)=>s+i.qty,0);
  document.getElementById('detTitle').textContent = currentTicketNro !== null ? 'Ticket #' + String(currentTicketNro).padStart(4,'0') : 'Ticket actual';
  document.getElementById('detSubtitle').textContent = count + ' artículo' + (count!==1?'s':'') + ' · ' + gs(total);
  document.getElementById('detItems').textContent = count + ' artículo' + (count!==1?'s':'');
  document.getElementById('detTotal').textContent = gs(total);
  const list = document.getElementById('detList');
  list.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'det-item';
    div.id = 'detItem_' + item.lineId;
    const delIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
    if(item.esDescuento){
      div.style.borderLeft = '3px solid #ef5350';
      div.innerHTML = '<div class="det-item-main"><div class="det-item-color" style="background:#e53935;font-size:9px;font-weight:800;">%</div><div class="det-item-name" style="color:#ef9a9a;">'+item.name+'</div><div class="det-item-subtotal" style="color:#ef5350;">-'+gs(item.montoDesc)+'</div></div><div class="det-item-controls"><button class="det-qbtn del" onclick="detChgQty('+item.lineId+',-1)">'+delIcon+'</button></div>';
      list.appendChild(div); return;
    }
    div.innerHTML =
      '<div class="det-item-main"><div class="det-item-color" style="background:'+item.color+'"></div><div class="det-item-name">'+item.name+'</div><div class="det-item-subtotal">'+gs(item.price*item.qty)+'</div></div>' +
      '<div class="det-item-controls"><div class="det-qty-row"><button class="det-qbtn del" onclick="detChgQty('+item.lineId+',-1)">'+(item.qty===1?delIcon:'−')+'</button><span class="det-qnum">'+item.qty+'</span><button class="det-qbtn" onclick="detChgQty('+item.lineId+',1)">+</button></div>' +
      '<span class="det-unit-price">'+gs(item.price)+' c/u</span>' +
      '<button class="det-obs-toggle" onclick="toggleDetObs('+item.lineId+')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'+(item.obs?'Obs: '+item.obs.substring(0,20):'Observación')+'</button>' +
      '<button class="det-obs-toggle" style="color:'+(item.desc>0?'var(--orange)':'var(--muted)')+'" onclick="toggleDetDesc('+item.lineId+')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>'+(item.desc>0?'Desc: '+item.desc+'%':'Descuento')+'</button></div>' +
      '<div class="det-obs-box'+(item.obs?' open':'')+'\" id="detObs_'+item.lineId+'"><input class="det-obs-input" type="text" placeholder="Ej: Sin cebolla, bien cocido..." maxlength="60" value="'+(item.obs||'')+'" oninput="saveDetObs('+item.lineId+', this.value)"></div>' +
      '<div class="det-obs-box'+(item.desc>0?' open':'')+'\" id="detDesc_'+item.lineId+'" style="display:'+(item.desc>0?'block':'none')+';"><div style="display:flex;align-items:center;gap:8px;padding:6px 0;"><span style="font-size:12px;color:var(--muted);flex-shrink:0;">Descuento %</span><input class="det-obs-input" type="number" min="0" max="100" placeholder="0" value="'+(item.desc||'')+'" style="width:70px;text-align:center;" oninput="saveDetDesc('+item.lineId+', this.value)"><span style="font-size:12px;color:var(--orange);flex-shrink:0;">= '+gs(calcItemTotal(item))+'</span></div></div>';
    list.appendChild(div);
  });
}
function detChgQty(lineId, delta){
  const idx = cart.findIndex(l=>l.lineId===lineId); if(idx<0) return;
  cart[idx].qty += delta;
  if(cart[idx].qty <= 0) cart.splice(idx,1);
  updUI(); updBtnGuardar();
  if(calcTotal() === 0){ goTo('scSale'); return; }
  renderDetalle();
}
function toggleDetObs(lineId){ const box=document.getElementById('detObs_'+lineId); if(!box)return; box.classList.toggle('open'); if(box.classList.contains('open'))box.querySelector('input').focus(); }
function saveDetObs(lineId, val){ const item=cart.find(l=>l.lineId===lineId); if(item)item.obs=val; const btn=document.querySelector('#detItem_'+lineId+' .det-obs-toggle'); if(btn)btn.lastChild.textContent=val?' Obs: '+val.substring(0,20):' Observación'; }
function toggleDetDesc(lineId){ const el=document.getElementById('detDesc_'+lineId); if(!el)return; const open=el.style.display==='block'; el.style.display=open?'none':'block'; if(!open)setTimeout(function(){var _i=el.querySelector('input');if(_i)_i.focus();},50); }
function saveDetDesc(lineId, val){
  const item=cart.find(i=>i.lineId===lineId); if(!item)return;
  item.desc=Math.min(100,Math.max(0,parseFloat(val)||0)); updUI();
  const sub=document.querySelector('#detItem_'+lineId+' .det-item-subtotal'); if(sub)sub.textContent=gs(calcItemTotal(item));
  const btns=document.querySelectorAll('#detItem_'+lineId+' .det-obs-toggle'); if(btns[1])btns[1].style.color=item.desc>0?'var(--orange)':'var(--muted)';
  const span=document.querySelector('#detDesc_'+lineId+' span:last-child'); if(span)span.textContent='= '+gs(calcItemTotal(item));
}
// -- imprimirComandaPreCobro: ver js/pedidos.js --

function generarRecibo(data){
  ultimoReciboData = data;

  const esFactura = data.factura && data.factura.timbrado;
  const size      = getPaperSize('ticket');

  // Generar HTML para reimprimir si es necesario
  const htmlImpresion = esFactura
    ? generarHTMLFactura(data, size)
    : generarHTMLTicket(data, size);
  mostrarPreviewRecibo(htmlImpresion, size);

  // ── IMPRIMIR DIRECTO ────────────────────────────────────
  const p        = printers['ticket'];
  const btpsTipo = localStorage.getItem('printerType_ticket');
  const btpsMac  = localStorage.getItem('btps_mac');

  // Imprimir ticket automáticamente
  // BTPS tiene su propio flujo; el resto usa imprimirTicketConf que maneja
  // BT Web (Vizzion), APK nativo, reconexión, PC/USB, etc.
  if(btpsTipo === 'btps' || btpsMac){
    BTPrinter.imprimirRecibo(data);
  } else {
    // imprimirTicketConf maneja todos los casos: BT Web, APK, needsReconnect, PC/USB
    imprimirTicketConf(htmlImpresion, 'ticket');
  }

  // Mostrar pantalla de opciones para comanda / reimprimir / nueva venta
  goTo('scRecibo');
}

function mostrarPreviewRecibo(html, size){
  const papel = document.getElementById('reciboPapel');
  if(!papel) return;

  // Usar iframe para renderizar el HTML térmico fielmente
  const pxW = size==='58' ? 220 : 300;
  papel.style.width  = pxW+'px';
  papel.style.padding = '0';
  papel.style.background = 'transparent';
  papel.style.boxShadow = 'none';

  // Remover iframe anterior si existe
  let iframe = document.getElementById('previewIframe');
  if(iframe) iframe.remove();

  iframe = document.createElement('iframe');
  iframe.id = 'previewIframe';
  iframe.style.cssText = [
    'width:'+pxW+'px',
    'border:none',
    'background:#fff',
    'border-radius:4px',
    'box-shadow:0 2px 20px rgba(0,0,0,.6)',
    'display:block',
    'min-height:200px'
  ].join(';');
  iframe.scrolling = 'no';
  papel.appendChild(iframe);

  // Escribir el HTML térmico en el iframe
  iframe.contentDocument.open();
  iframe.contentDocument.write(html.replace(/<div id="printInfo"[\s\S]*?<\/div>/, ''));
  iframe.contentDocument.close();

  // Auto-altura
  setTimeout(()=>{
    try {
      const h = iframe.contentDocument.body.scrollHeight;
      iframe.style.height = (h+10)+'px';
    } catch(e){ /* safe to ignore: optional iframe auto-height */ }
  }, 200);
}

// Convertir HTML térmico a texto plano para preview
function htmlToPreview(html, size){
  const cols = size==='58' ? 32 : 42;
  // Remover tags y convertir <p> a líneas
  return html
    .replace(/<hr[^>]*>/gi, '-'.repeat(cols))
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<p[^>]*class="row"[^>]*>([\s\S]*?)<\/p>/gi, (m, inner) => {
      // Extraer los dos spans de .row
      const spans = inner.match(/<span[^>]*>([\s\S]*?)<\/span>/gi) || [];
      const texts = spans.map(s => s.replace(/<[^>]+>/g,'').trim());
      if(texts.length >= 2){
        const left  = texts[0];
        const right = texts.slice(1).join(' ');
        const pad   = Math.max(1, cols - left.length - right.length);
        return left + ' '.repeat(pad) + right;
      }
      return texts.join(' ');
    })
    .replace(/<[^>]+>/g, '')  // remover tags restantes
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n');
}

// -- imprimirComandaActual: ver js/pedidos.js --


// -- Impresion: ver js/impresion.js --

// -- Turno: ver js/turno.js --


// ── DRAWER ───────────────────────────────────────────────────────────────────
function openDrawer(){
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
}
function closeDrawer(){
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
}

function drawerGo(section){
  document.querySelectorAll('.drawer-item').forEach(el => el.classList.remove('active'));
  if(event && event.currentTarget) event.currentTarget.classList.add('active');
  closeDrawer();
  if(section === 'ventas'){
    goTo('scSale');
  } else if(section === 'recibos'){
    goToVentas();
  } else if(section === 'articulos'){
    goTo('scArticulos');
    renderArtList();
  } else if(section === 'turno'){
    goTo('scTurno');
    renderTurno();
  } else if(section === 'mesas'){
    abrirPantallaMesas();
  } else {
    if(section === 'configuracion'){
      goToConfig();
    } else {
      toast(section.charAt(0).toUpperCase()+section.slice(1)+' — próximamente');
    }
  }
}

// -- Productos/Categorias/Descuentos: ver js/productos.js --


// Variable global para guardar el HTML del ticket de cierre
var cierreTicketHTML = '';
var cierreTextoPlano = '';

function buildCierreTicket(size){
  size = size || getPaperSize('ticket') || '58';
  var cols = size==='80' ? 48 : 32;
  var saldoEsperado = calcSaldoEsperado();
  var totalContado = Object.values(cierreMetodos).reduce(function(s,d){return s+d.contado;},0);
  var diff = totalContado > 0 ? totalContado - saldoEsperado : null;
  var ahora = new Date();
  var pad2 = function(n){ return String(n).padStart(2,'0'); };
  var fmtDT = function(d){ return d ? pad2(d.getDate())+'/'+pad2(d.getMonth()+1)+'/'+d.getFullYear()+' '+pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds()) : '-'; };
  var gn2 = function(n){ return Math.round(n||0).toLocaleString('es-PY'); };

  var negocio  = configData.negocio   || localStorage.getItem('an') || 'MI NEGOCIO';
  var ruc      = configData.ruc       || localStorage.getItem('ar') || '';
  var dir      = configData.direccion || localStorage.getItem('ad') || '';
  var terminal = configData.terminal  || localStorage.getItem('pos_terminal') || 'CAJA1';
  var usuario  = 'admin';
  var compNro  = turnoData.comprobante || '001-001-001';

  var totalVentas  = turnoData.ventas.reduce(function(s,v){return s+v.total;},0);
  var totalEgresos = turnoData.egresos.filter(function(e){return !e.anulada;}).reduce(function(s,e){return s+e.monto;},0);
  var totalIngresos = (turnoData.ingresos||[]).reduce(function(s,i){return s+i.monto;},0);
  var cantVentas   = turnoData.ventas.length;
  var saldoCaja    = turnoData.efectivoInicial + totalVentas + totalIngresos - totalEgresos;
  var rendicion    = 0; // monto rendido/retirado
  var diferencia   = rendicion - saldoCaja;

  // Formas de pago — desglosar divPagos si existe
  var metodos = {};
  var acumMetodoCierre = function(m, monto){
    m = (m||'EFECTIVO').toUpperCase().trim();
    if(!metodos[m]) metodos[m]={total:0,ops:0};
    metodos[m].total += monto;
    metodos[m].ops++;
  };
  turnoData.ventas.forEach(function(v){
    if(v.divPagos && v.divPagos.length >= 2){
      v.divPagos.forEach(function(p){ acumMetodoCierre(p.metodo, p.monto||0); });
    } else if(v.metodo && v.metodo.includes(' + ')){
      var partes = v.metodo.split(' + ');
      var montoParte = Math.round(v.total / partes.length);
      partes.forEach(function(p, i){
        var monto = i===partes.length-1 ? v.total-montoParte*(partes.length-1) : montoParte;
        acumMetodoCierre(p, monto);
      });
    } else {
      acumMetodoCierre(v.metodo, v.total);
    }
  });

  // Helper: línea separadora
  var SEP_CHAR = '-'.repeat(cols);
  var sep = function(){ return '<p style="margin:0;letter-spacing:0;">'+SEP_CHAR+'</p>'; };

  // Helper: fila izq/der alineada
  var row = function(l, r, bold){
    l=String(l); r=String(r);
    var sp=Math.max(1,cols-l.length-r.length);
    var line=l+' '.repeat(sp)+r;
    return bold
      ? '<p style="margin:0;font-weight:bold;">'+line+'</p>'
      : '<p style="margin:0;">'+line+'</p>';
  };
  var rowLabel = function(label){
    return '<p style="margin:4px 0 2px;font-weight:bold;letter-spacing:1px;">'+label+'</p>';
  };
  var center = function(text, bold){
    var s=String(text); var sp=Math.max(0,Math.floor((cols-s.length)/2));
    var line=' '.repeat(sp)+s;
    return bold
      ? '<p style="margin:0;font-weight:bold;text-align:center;">'+line+'</p>'
      : '<p style="margin:0;text-align:center;">'+line+'</p>';
  };

  var css = 'body{font-family:Arial,"Helvetica Neue",sans-serif;font-size:'+(size==='80'?'11':'9')+'pt;'
    +'width:'+(size==='80'?'80':'58')+'mm;margin:0;padding:2mm 0;background:#fff;color:#000;}'
    +'p{margin:0;padding:0;line-height:1.3;white-space:pre;}';

  var lines = '';
  // Cabecera
  lines += center(negocio, true);
  if(ruc)  lines += center('RUC: '+ruc);
  if(dir)  lines += center(dir);
  lines += sep();
  lines += center('CIERRE DE CAJA', true);
  lines += sep();
  lines += row('Comprobante:', compNro);
  lines += row('Apertura:', fmtDT(turnoData.fechaApertura));
  lines += row('Usuario:', usuario);
  lines += row('Local:', terminal);
  lines += row('Cierre:', fmtDT(ahora));
  lines += sep();
  // RESUMEN
  lines += rowLabel('RESUMEN');
  lines += sep();
  lines += row('Importe Inicial', gn2(turnoData.efectivoInicial));
  lines += row('Total Entrada', gn2(totalVentas));
  lines += row('', gn2(totalVentas));
  lines += row('Total Salida', gn2(totalEgresos));
  lines += row('Saldo En Caja', gn2(saldoCaja), true);
  lines += row('Rendicion', gn2(rendicion));
  lines += row('Diferencia', (diferencia>0?'+':'')+gn2(diferencia));
  lines += sep();
  // FORMAS DE PAGO
  lines += rowLabel('FORMAS DE PAGO');
  lines += sep();
  Object.entries(metodos).sort(function(a,b){return b[1].total-a[1].total;}).forEach(function(e){
    var label = e[0];
    var ops   = e[1].ops;
    var monto = gn2(e[1].total);
    // label + ops (alineado) + monto
    var mid   = String(ops);
    var sp    = Math.max(1, cols - label.length - mid.length - monto.length - 2);
    lines += '<p style="margin:0;white-space:pre;">'+label+' '.repeat(sp)+mid+'  '+monto+'</p>';
  });
  lines += row('TOTAL:', gn2(totalVentas), true);
  lines += sep();
  // MOVIMIENTOS DE CAJA
  lines += rowLabel('MOVIMIENTOS DE CAJA');
  lines += sep();
  var totalEntMovs = (turnoData.ingresos||[]).reduce(function(s,i){return s+i.monto;},0);
  lines += row('Total Entrada:', gn2(totalEntMovs));
  lines += row('Total Salida :', gn2(totalEgresos));
  if(turnoData.egresos && turnoData.egresos.length){
    turnoData.egresos.filter(function(e){return !e.anulada;}).forEach(function(e){
      lines += row('  '+e.desc.substring(0,cols-14), gn2(e.monto));
    });
  }
  lines += sep();
  // Conteo si existe
  if(totalContado > 0){
    lines += rowLabel('CONTEO DE VALORES');
    lines += sep();
    Object.entries(cierreMetodos).forEach(function(e){
      var m=e[0], d=e[1];
      if(d.contado>0){
        var dif=d.contado-d.esperado;
        var difStr=dif===0?' OK':dif>0?' +'+gn2(dif):' -'+gn2(Math.abs(dif));
        lines += row(m.substring(0,cols-gn2(d.contado).length-1), gn2(d.contado));
        lines += '<p style="margin:0;padding-left:8px;font-size:9pt;">Esp: '+gn2(d.esperado)+'  '+difStr+'</p>';
      }
    });
    if(diff!==null){
      var dLabel = diff===0 ? 'CUADRE EXACTO' : diff>0 ? 'SOBRANTE: +'+gn2(diff) : 'FALTANTE: -'+gn2(Math.abs(diff));
      lines += '<p style="margin:4px 0;font-weight:bold;text-align:center;">'+dLabel+'</p>';
    }
    lines += sep();
  }
  // Firma
  lines += '<p style="margin:0;white-space:pre;">OBS:</p>';
  lines += sep();
  lines += '<p style="margin:20px 0 0;">&nbsp;</p>';
  lines += '<p style="margin:0;border-top:1px solid #000;">&nbsp;</p>';
  lines += center('Firma - Aclaracion - CI');
  lines += '<p style="margin:8px 0 0;">&nbsp;</p>';
  lines += center(usuario+' '+fmtDT(ahora));
  lines += sep();
  lines += '<p style="margin:0 0 16px;">&nbsp;</p>';

  cierreTicketHTML = '<html><head><style>'+css+'</style></head><body>'+lines+'</body></html>';

  // Texto plano para WhatsApp
  var wa = '*CIERRE DE CAJA - '+negocio+'*\n';
  wa += 'Apertura: '+fmtDT(turnoData.fechaApertura)+'\nCierre: '+fmtDT(ahora)+'\n';
  wa += '\n*RESUMEN*\n';
  wa += 'Ef. Inicial: '+gn2(turnoData.efectivoInicial)+'\n';
  wa += 'Total Entrada: '+gn2(totalVentas)+'\n';
  wa += 'Total Salida: '+gn2(totalEgresos)+'\n';
  wa += 'Saldo en Caja: '+gn2(saldoCaja)+'\n';
  wa += 'Diferencia: '+gn2(diferencia)+'\n';
  wa += '\n*FORMAS DE PAGO*\n';
  Object.entries(metodos).forEach(function(e){ wa += e[0]+' ('+e[1].ops+'): '+gn2(e[1].total)+'\n'; });
  wa += 'TOTAL: '+gn2(totalVentas)+'\n';
  if(totalContado>0){ wa += '\n*CONTEO*\nTotal contado: '+gn2(totalContado)+'\nSaldo esperado: '+gn2(saldoEsperado)+'\n'; }
  if(diff!==null){
    if(diff===0) wa += '\nCUADRE EXACTO';
    else if(diff>0) wa += '\nSOBRANTE: +'+gn2(diff);
    else wa += '\nFALTANTE: -'+gn2(Math.abs(diff));
  }
  cierreTextoPlano = wa;
}

async function confirmarCierre(){
  var size = getPaperSize('ticket') || '58';
  buildCierreTicket(size);

  // ── Calcular totales para persistir el cierre ────────────
  var totalContado = Object.values(cierreMetodos).reduce(function(s,d){return s+d.contado;},0);
  var saldoEsperado = calcSaldoEsperado();
  var diferencia = totalContado > 0 ? totalContado - saldoEsperado : 0;
  var turnoDbIdCierre = turnoData.dbId;
  var turnoSupaIdCierre = turnoData.supaId;

  // ── Persistir cierre en IndexedDB + encolar sync ─────────
  if(db && turnoDbIdCierre){
    try { await dbCerrarTurno(turnoDbIdCierre, totalContado, diferencia); }
    catch(e){ console.warn('[Cierre] Error IndexedDB:', e.message); }
  }

  // ── Persistir cierre en Supabase directo si hay internet ─
  const supaId = turnoSupaIdCierre || turnoDbIdCierre;
  if(navigator.onLine && supaId){
    try {
      await supaPatch('pos_turno', 'id=eq.'+supaId, {
          estado:        'cerrado',
          fecha_cierre:  (await obtenerFechaServidor()).toISOString(), // hora del servidor
          total_contado: totalContado,
          diferencia:    diferencia,
        }, true);
      console.log('[Cierre] Turno cerrado en Supabase OK');
    } catch(e){ console.warn('[Cierre] Error Supabase:', e.message); }
  }

  // Preview en iframe para fidelidad
  var papel = document.getElementById('previewPapel');
  var pxW = size==='80' ? 320 : 220;
  papel.style.width = pxW+'px';
  papel.style.padding = '0';
  papel.style.background = 'transparent';
  papel.style.boxShadow = 'none';
  var iframeCierre = document.getElementById('cierreIframe');
  if(iframeCierre) iframeCierre.remove();
  iframeCierre = document.createElement('iframe');
  iframeCierre.id = 'cierreIframe';
  iframeCierre.style.cssText = 'width:'+pxW+'px;border:none;background:#fff;display:block;';
  papel.innerHTML = '';
  papel.appendChild(iframeCierre);
  var doc = iframeCierre.contentWindow.document;
  doc.open(); doc.write(cierreTicketHTML); doc.close();
  setTimeout(function(){
    try{ iframeCierre.style.height = (iframeCierre.contentWindow.document.body.scrollHeight+20)+'px'; }catch(e){ /* safe to ignore: optional iframe auto-height */ }
  }, 200);
  // Guardar datos para buildCierreBTPS ANTES de limpiar turnoData
  cierreData = {
    fechaApertura: turnoData.fechaApertura,
    totalVentas:   turnoData.ventas.reduce(function(s,v){return s+v.total;},0),
    totalEgresos:  turnoData.egresos.filter(function(e){return !e.anulada;}).reduce(function(s,e){return s+e.monto;},0),
    totalIngresos: (turnoData.ingresos||[]).reduce(function(s,i){return s+i.monto;},0),
    efInicial:     turnoData.efectivoInicial,
    cantVentas:    turnoData.ventas.length,
    egresos:       turnoData.egresos.filter(function(e){return !e.anulada;}),
    metodos:       (function(){
      var m={};
      var acum=function(met,monto){met=(met||'EFECTIVO').toUpperCase().trim();if(!m[met])m[met]={total:0,ops:0};m[met].total+=monto;m[met].ops++;};
      turnoData.ventas.forEach(function(v){
        if(v.divPagos&&v.divPagos.length>=2){ v.divPagos.forEach(function(p){acum(p.metodo,p.monto||0);}); }
        else if(v.metodo&&v.metodo.includes(' + ')){ var pts=v.metodo.split(' + '),mp=Math.round(v.total/pts.length);pts.forEach(function(p,i){acum(p,i===pts.length-1?v.total-mp*(pts.length-1):mp);}); }
        else{ acum(v.metodo,v.total); }
      });
      return m;
    })(),
  };
  turnoBorrar();
  turnoData = { fechaApertura: null, efectivoInicial: 0, ventas: [], egresos: [], ingresos: [] };
  cierreMetodos = {};
  goTo('scPreviewCierre');
}

function buildCierreBTPS(){
  // Construir texto BTPS del cierre con los datos guardados en cierreTextoPlano
  // pero con formato de impresora térmica
  if(!cierreTextoPlano){ return null; }
  var size = getPaperSize('ticket') || '58';
  var cols = size==='80' ? 48 : 32;
  var sep  = '='.repeat(cols);
  var sep2 = '-'.repeat(cols);
  var n    = '\n';
  var gn2  = function(v){ return Math.round(v||0).toLocaleString('es-PY'); };
  var pad  = function(l,r){ var sp=Math.max(1,cols-String(l).length-String(r).length); return String(l)+' '.repeat(sp)+String(r); };

  var negocio  = configData.negocio  || 'MI NEGOCIO';
  var ruc      = configData.ruc      || '';
  var dir      = configData.direccion|| '';
  var terminal = configData.terminal || 'CAJA1';
  var pad2     = function(n){ return String(n).padStart(2,'0'); };
  var fmtDT    = function(d){ return d ? pad2(new Date(d).getDate())+'/'+pad2(new Date(d).getMonth()+1)+'/'+new Date(d).getFullYear()+' '+pad2(new Date(d).getHours())+':'+pad2(new Date(d).getMinutes()) : '-'; };
  var ahora    = new Date();

  var totalVentas   = cierreData ? cierreData.totalVentas   : 0;
  var totalEgresos  = cierreData ? cierreData.totalEgresos  : 0;
  var totalIngresos = cierreData ? cierreData.totalIngresos : 0;
  var efInicial     = cierreData ? cierreData.efInicial     : 0;
  var saldoCaja     = efInicial + totalVentas + totalIngresos - totalEgresos;
  var totalContado  = Object.values(cierreMetodos).reduce(function(s,d){return s+d.contado;},0);
  var saldoEsp      = calcSaldoEsperado ? calcSaldoEsperado() : saldoCaja;
  var diff          = totalContado > 0 ? totalContado - saldoEsp : null;

  var txt = '';
  txt += '[CENTER][BOLD]' + negocio.toUpperCase() + '[/BOLD][/CENTER]' + n;
  if(ruc) txt += '[CENTER]RUC: ' + ruc + '[/CENTER]' + n;
  if(dir) txt += '[CENTER]' + dir + '[/CENTER]' + n;
  txt += sep + n;
  txt += '[CENTER][BOLD]CIERRE DE CAJA[/BOLD][/CENTER]' + n;
  txt += sep + n;
  txt += pad('Terminal:', terminal) + n;
  txt += pad('Apertura:', fmtDT(cierreData && cierreData.fechaApertura)) + n;
  txt += pad('Cierre:', fmtDT(ahora)) + n;
  txt += sep2 + n;
  txt += '[BOLD]RESUMEN[/BOLD]' + n;
  txt += sep2 + n;
  txt += pad('Ef. Inicial:', gn2(efInicial)) + n;
  txt += pad('Total ventas:', gn2(totalVentas)) + n;
  if(totalEgresos > 0) txt += pad('Total egresos:', gn2(totalEgresos)) + n;
  if(totalIngresos > 0) txt += pad('Total ingresos:', gn2(totalIngresos)) + n;
  txt += '[BOLD]' + pad('SALDO EN CAJA:', gn2(saldoCaja)) + '[/BOLD]' + n;
  txt += sep2 + n;
  txt += '[BOLD]FORMAS DE PAGO[/BOLD]' + n;
  txt += sep2 + n;

  // Usar los metodos ya calculados (ya desglosan divPagos)
  if(cierreData && cierreData.metodos){
    Object.entries(cierreData.metodos).sort(function(a,b){return b[1].total-a[1].total;}).forEach(function(e){
      txt += pad(e[0] + ' ('+e[1].ops+'op):', gn2(e[1].total)) + n;
    });
  }
  txt += '[BOLD]' + pad('TOTAL:', gn2(totalVentas)) + '[/BOLD]' + n;
  txt += sep2 + n;

  if(cierreData && cierreData.egresos && cierreData.egresos.length){
    txt += '[BOLD]EGRESOS[/BOLD]' + n;
    txt += sep2 + n;
    cierreData.egresos.forEach(function(e){
      txt += pad('  '+String(e.desc||'').substring(0, cols-14), gn2(e.monto)) + n;
    });
    txt += sep2 + n;
  }

  if(totalContado > 0){
    txt += '[BOLD]CONTEO[/BOLD]' + n;
    txt += sep2 + n;
    Object.entries(cierreMetodos).forEach(function(e){
      var m=e[0], d=e[1];
      if(d.contado>0){
        var dif=d.contado-d.esperado;
        var difStr=dif===0?' OK':dif>0?' +'+gn2(dif):' -'+gn2(Math.abs(dif));
        txt += pad(m+':', gn2(d.contado)) + n;
        txt += '  Esperado: '+gn2(d.esperado)+'  '+difStr + n;
      }
    });
    if(diff !== null){
      var dLabel = diff===0 ? 'CUADRE EXACTO' : diff>0 ? 'SOBRANTE: +'+gn2(diff) : 'FALTANTE: -'+gn2(Math.abs(diff));
      txt += '[CENTER][BOLD]' + dLabel + '[/BOLD][/CENTER]' + n;
    }
    txt += sep2 + n;
  }

  txt += pad('Cant. ventas:', String(cierreData ? cierreData.cantVentas : 0)) + n;
  txt += sep2 + n;

  // Rendicion del cajero y diferencia
  txt += '[BOLD]RENDICION DEL CAJERO[/BOLD]' + n;
  txt += sep2 + n;
  txt += pad('Saldo esperado:', gn2(saldoCaja)) + n;
  if(totalContado > 0){
    txt += pad('Total contado:', gn2(totalContado)) + n;
    var diferencia = totalContado - saldoCaja;
    if(diferencia === 0){
      txt += '[CENTER][BOLD]*** CUADRE EXACTO ***[/BOLD][/CENTER]' + n;
    } else if(diferencia > 0){
      txt += '[BOLD]' + pad('SOBRANTE:', '+' + gn2(diferencia)) + '[/BOLD]' + n;
    } else {
      txt += '[BOLD]' + pad('FALTANTE:', '-' + gn2(Math.abs(diferencia))) + '[/BOLD]' + n;
    }
  } else {
    txt += pad('Total contado:', '(sin conteo)') + n;
    txt += pad('Diferencia:', '(sin conteo)') + n;
  }
  txt += sep2 + n;

  // Firma del cajero
  txt += 'OBS: ' + n;
  txt += sep2 + n;
  txt += n;
  txt += n;
  txt += '[CENTER]______________________________[/CENTER]' + n;
  txt += '[CENTER]Firma / Aclaracion / CI[/CENTER]' + n;
  txt += sep + n;
  txt += '[CENTER]*** FIN CIERRE ***[/CENTER]' + n;
  txt += '[FEED:4]' + n;
  txt += '[CUT]';
  return txt;
}

// Variable para guardar datos del cierre para BTPS
var cierreData = null;

function imprimirCierre(){
  // NO regenerar — turnoData ya fue borrado en confirmarCierre
  if(!cierreTicketHTML){ toast('Sin datos de cierre'); return; }

  // Si hay BTPS configurado, imprimir via servidor
  var btpsMac  = localStorage.getItem('btps_mac');
  var btpsTipo = localStorage.getItem('printerType_ticket');
  if(btpsMac || btpsTipo === 'btps'){
    var txt = buildCierreBTPS();
    if(txt){
      BTPrinter.print(txt).then(function(r){
        if(r.status === 'ok') toast('✓ Cierre impreso');
        else toast('Error: ' + (r.message||'Error al imprimir'));
      });
      return;
    }
  }

  // Fallback — ventana del navegador
  var isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true;
  if(isPWA){
    var iframe = document.getElementById('printFrame');
    if(!iframe){
      iframe = document.createElement('iframe');
      iframe.id = 'printFrame';
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
      document.body.appendChild(iframe);
    }
    var doc = iframe.contentWindow.document;
    doc.open(); doc.write(cierreTicketHTML); doc.close();
    setTimeout(function(){
      try{ iframe.contentWindow.focus(); iframe.contentWindow.print(); }
      catch(e){ window.print(); }
    }, 600);
  } else {
    var w = window.open('','_blank','width=420,height=800');
    if(!w){ alert('Permitir ventanas emergentes para imprimir'); return; }
    w.document.open();
    w.document.write(cierreTicketHTML);
    w.document.close();
    w.focus();
    setTimeout(function(){ w.print(); w.close(); }, 500);
  }
}

function compartirWhatsApp(){
  window.open('https://wa.me/?text='+encodeURIComponent(cierreTextoPlano), '_blank');
}

function cerrarPreviewCierre(){
  goTo('scClosed');
  toast('Turno cerrado');
}


// ── CONFIGURACIÓN ────────────────────────────────────────────────────────────
let configData = {
  negocio:      localStorage.getItem('an')       || 'MI NEGOCIO',
  direccion:    localStorage.getItem('ad')       || 'ASUNCION',
  ciudad:       localStorage.getItem('ciudad')   || '',
  telefono:     localStorage.getItem('at')       || '',
  ruc:          localStorage.getItem('ar')       || '',
  email:        localStorage.getItem('email_negocio') || '',
  pie_recibo:   localStorage.getItem('pie_recibo')|| '¡Gracias por su compra!',
  mostrar_ruc:  localStorage.getItem('mostrar_ruc')||'1',
  moneda:       localStorage.getItem('moneda')   || 'GS',
  terminal:     localStorage.getItem('pos_terminal')  || 'Terminal 1',
  sucursal:     localStorage.getItem('pos_sucursal')  || 'Principal',
  deposito:     localStorage.getItem('pos_deposito')  || 'Depósito Principal',
  sucursal_id:  localStorage.getItem('pos_sucursal_id') || null,
  deposito_id:  localStorage.getItem('pos_deposito_id') || null,
};

let printers = {
  ticket:  { type: null, name: null, device: null, size: '58' }, // type: 'bt'|'pc'
  comanda: { type: null, name: null, device: null, size: '58' },
};

// Restaurar configuración de impresoras al iniciar
function isAndroidAPK() {
  return typeof window.AndroidPrint !== 'undefined';
}

function restaurarConfigImpresoras(){
  ['ticket','comanda'].forEach(tipo => {
    const savedType        = localStorage.getItem('printerType_' + tipo);
    const savedName        = localStorage.getItem('printerName_' + tipo);
    const savedSize        = localStorage.getItem('printerSize_' + tipo);
    const savedAndroidName = localStorage.getItem('printerAndroidName_' + tipo);

    if(savedSize) printers[tipo].size = savedSize;
    if(savedType && savedName){
      printers[tipo].type = savedType;
      printers[tipo].name = savedName;

      if(savedType === 'bt'){
        if(isAndroidAPK()){
          // En el APK: restaurar el nombre y re-registrar en el puente nativo
          printers[tipo].androidName    = savedAndroidName || savedName;
          printers[tipo].needsReconnect = false; // el APK maneja la conexión
          if(savedAndroidName || savedName){
            window.AndroidPrint.setBluetoothDevice(savedAndroidName || savedName);
          }
        } else {
          // En web: marcar que necesita reconectar (Web Bluetooth no persiste)
          printers[tipo].needsReconnect = true;
        }
      }
      updPrinterUI(tipo);
    }
  });
}

function goToConfig(){
  document.getElementById('cfgNegocio').value   = configData.negocio;
  document.getElementById('cfgDireccion').value = configData.direccion;
  document.getElementById('cfgTelefono').value  = configData.telefono;
  document.getElementById('cfgRuc').value       = configData.ruc;
  document.getElementById('configEmail').textContent = configData.email;
  goTo('scConfig');
}

function saveGeneralConfig(){
  var _cfgNeg=document.getElementById('cfgNegocio'),   _cfgDir=document.getElementById('cfgDireccion');
  var _cfgTel=document.getElementById('cfgTelefono'),   _cfgRuc=document.getElementById('cfgRuc');
  var _cfgPre=document.getElementById('cfgPresupuestos'),_cfgCom=document.getElementById('cfgComandas');
  configData.negocio   = (_cfgNeg  ? _cfgNeg.value   : null) || configData.negocio;
  configData.direccion = (_cfgDir  ? _cfgDir.value   : null) || configData.direccion;
  configData.telefono  = (_cfgTel  ? _cfgTel.value   : null) || configData.telefono;
  configData.ruc       = (_cfgRuc  ? _cfgRuc.value   : null) || configData.ruc;
  configData.presupuestosHabilitados = !!(_cfgPre ? _cfgPre.checked : false);
  configData.comandasHabilitadas     = !!(_cfgCom ? _cfgCom.checked : false);
  // Persistir en localStorage
  localStorage.setItem('an', configData.negocio);
  localStorage.setItem('ad', configData.direccion);
  localStorage.setItem('at', configData.telefono);
  localStorage.setItem('ar', configData.ruc);
  localStorage.setItem('pos_presupuestos', configData.presupuestosHabilitados ? '1' : '0');
  localStorage.setItem('pos_comandas', configData.comandasHabilitadas ? '1' : '0');
  // Mostrar u ocultar botón comanda en cobro
  updBtnComandaCobro();
}

// -- Modificadores: ver js/productos.js --

// ══════════════════════════════════════════════════════════════════════════════
// cerrarSesion — cierre de sesión real con limpieza de estado
//
// QUÉ BORRA:
//   - Credenciales de sesión (lic_activated, lic_token, lic_plan, lic_vence, etc.)
//   - Turno activo (pos_turno_activo) — la caja empieza limpia
//   - Tickets pendientes (pos_pendientes) — sin cola anterior
//   - Contador de tickets (pos_ticket_counter) — vuelve a 1
//   - Modo terminal (pos_modo_terminal) — se re-lee desde Supabase al volver
//
// QUÉ CONSERVA:
//   - device_id (lic_device_id + cookie) — para auto-recuperar sin re-registro
//   - Configuración de terminal (pos_terminal, pos_sucursal, pos_deposito)
//   - Config de impresoras (btps_mac, etc.)
//   - Cookie pos_email_bk — fallback offline
//
// Al volver a abrir la app, licInit() consulta Supabase con el device_id,
// recupera la sesión automáticamente y lee el modo (caja/satélite) fresco.
// ══════════════════════════════════════════════════════════════════════════════
function cerrarSesion(){
  var msg = '¿Cerrar sesión?\n\n' +
    'La terminal se reconectará automáticamente la próxima vez que abras la app.\n' +
    'El modo (Caja/Satélite) se actualizará desde el servidor.';

  if(!confirm(msg)) return;

  // ── Limpiar credenciales de sesión ───────────────────────────────────────
  // Las SK keys son las de autenticación — sin ellas licInit() va a Supabase
  Object.values(SK).forEach(function(k){
    // Conservar solo device_id — es el identificador del dispositivo físico
    if(k !== SK.deviceId) localStorage.removeItem(k);
  });

  // ── Limpiar estado operativo ──────────────────────────────────────────────
  localStorage.removeItem('pos_turno_activo');   // turno activo
  localStorage.removeItem('pos_pendientes');     // tickets pendientes
  localStorage.removeItem('pos_ticket_counter'); // contador de tickets
  localStorage.removeItem('pos_modo_terminal');  // modo — se re-lee desde Supabase

  // ── Limpiar cookies de sesión (NO device_id ni email_bk) ─────────────────
  // pos_email_bk y pos_device_id se conservan para auto-recuperación offline
  cookieSet('ali', '', -1);         // licencia_id — se recupera al reconectar

  // ── Limpiar IndexedDB — turno y ventas en memoria ─────────────────────────
  if(db){
    try{
      db.turno.clear();
      console.log('[Sesion] IndexedDB turno limpiado');
    } catch(e){ console.warn('[Sesion] Error limpiando IndexedDB:', e.message); }
  }

  // ── Reset de variables en memoria ─────────────────────────────────────────
  // Sin esto, la sesión anterior quedaría en RAM aunque el localStorage esté limpio
  if(typeof pendientes !== 'undefined') setPendientes([]);
  if(typeof cart !== 'undefined') clearCart();
  if(typeof currentTicketNro !== 'undefined') setCurrentTicketNro(null);
  if(typeof turnoData !== 'undefined'){
    turnoData.fechaApertura   = null;
    turnoData.efectivoInicial = 0;
    turnoData.ventas          = [];
    turnoData.egresos         = [];
    turnoData.ingresos        = [];
    turnoData.supaId          = null;
    turnoData.dbId            = null;
  }
  if(typeof mesaActual !== 'undefined') clearMesaActual();
  if(typeof MODO_TERMINAL !== 'undefined') MODO_TERMINAL = 'caja';

  toast('Sesión cerrada — reconectando...');

  // ── Recargar la app para aplicar limpieza completa ───────────────────────
  // location.reload() es la forma más limpia — cualquier estado residual
  // en memoria desaparece y licInit() corre desde cero con el device_id
  setTimeout(function(){ location.reload(); }, 800);
}

function selPrinterSize(tipo, size){
  printers[tipo].size = size;
  localStorage.setItem('printerSize_'+tipo, size);
  document.getElementById(tipo+'Size58').classList.toggle('sel', size==='58');
  document.getElementById(tipo+'Size80').classList.toggle('sel', size==='80');
  toast('Papel '+size+'mm configurado para '+tipo);
}

function updPrinterUI(tipo){
  const p = printers[tipo];
  const nameEl   = document.getElementById(tipo+'PrinterName');
  const statusEl = document.getElementById(tipo+'PrinterStatus');
  const discBtn  = document.getElementById(tipo+'PrinterDisconnect');
  const card     = document.getElementById(tipo+'PrinterCard');
  if(p.name){
    nameEl.textContent = p.name;
    if(p.type === 'bt' && p.needsReconnect){
      statusEl.textContent = '⚠️ Reconectar Bluetooth';
      statusEl.className = 'printer-status off';
      card.classList.remove('connected');
    } else {
      statusEl.textContent = p.type==='bt' ? 'Conectada por Bluetooth' : 'Configurada (PC/USB)';
      statusEl.className = 'printer-status ok';
      card.classList.add('connected');
    }
    discBtn.style.display = 'block';
  } else {
    nameEl.textContent = 'Sin impresora';
    statusEl.textContent = 'No conectada';
    statusEl.className = 'printer-status off';
    discBtn.style.display = 'none';
    card.classList.remove('connected');
  }
}

// UUIDs de servicios conocidos de impresoras térmicas BT
const BT_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // ESC/POS genérico
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Xprinter / Zjiang
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microprinter / innprinter
  '0000ff00-0000-1000-8000-00805f9b34fb', // Alternativo genérico
];

async function conectarBluetooth(tipo){

  // ── MODO APK: usar impresoras emparejadas del sistema Android ──────────────
  if(isAndroidAPK()){
    try {
      const raw = window.AndroidPrint.getPairedBtPrinters();
      let lista = [];
      try { lista = JSON.parse(raw); } catch(e) { lista = []; }

      // Verificar si devolvió un error
      if(lista.length > 0 && lista[0].error){
        toast('Error Bluetooth: ' + lista[0].error);
        return;
      }

      if(!lista.length){
        toast('No hay impresoras Bluetooth emparejadas. Emparejá tu impresora en Ajustes → Bluetooth');
        return;
      }

      // Si hay una sola impresora, usarla directamente sin preguntar
      if(lista.length === 1){
        const printer = lista[0];
        window.AndroidPrint.setBluetoothDevice(printer.name);
        printers[tipo].name           = printer.name;
        printers[tipo].type           = 'bt';
        printers[tipo].device         = null;
        printers[tipo].needsReconnect = false;
        printers[tipo].androidName    = printer.name;
        localStorage.setItem('printerType_' + tipo, 'bt');
        localStorage.setItem('printerName_' + tipo, printer.name);
        localStorage.setItem('printerAndroidName_' + tipo, printer.name);
        updPrinterUI(tipo);
        toast('✓ Conectada: ' + printer.name);
        return;
      }

      // Si hay varias, mostrar un selector simple
      const nombres = lista.map((p, i) => i + ': ' + p.name + ' (' + p.address + ')').join('\n');
      const input = prompt('Seleccioná el número de impresora:\n' + nombres, '0');
      if(input === null) return;
      const idx = parseInt(input) || 0;
      const printer = lista[Math.min(idx, lista.length - 1)];

      window.AndroidPrint.setBluetoothDevice(printer.name);
      printers[tipo].name           = printer.name;
      printers[tipo].type           = 'bt';
      printers[tipo].device         = null;
      printers[tipo].needsReconnect = false;
      printers[tipo].androidName    = printer.name;
      localStorage.setItem('printerType_' + tipo, 'bt');
      localStorage.setItem('printerName_' + tipo, printer.name);
      localStorage.setItem('printerAndroidName_' + tipo, printer.name);
      updPrinterUI(tipo);
      toast('✓ Conectada: ' + printer.name);

    } catch(e){
      toast('Error al obtener impresoras: ' + e.message);
    }
    return;
  }

  // ── MODO WEB: Web Bluetooth API (Chrome/Edge en PC) ─────────────────────────
  if(!navigator.bluetooth){
    toast('Web Bluetooth no disponible — usá Chrome o Edge en PC, o instalá la app Android');
    return;
  }
  try {
    const PRINTER_NAMES = [
      'Bluetooth Printer', 'BlueTooth Printer',
      'MTP-II', 'MTP-3', 'RPP02', 'RPP300',
      'Printer', 'printer',
    ];
    const PRINTER_PREFIXES = ['XP-', 'ZJ-', 'BT-', 'PT-', 'MT-', 'DP-', 'GP-'];

    let device;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [
          ...PRINTER_NAMES.map(name => ({ name })),
          ...PRINTER_PREFIXES.map(prefix => ({ namePrefix: prefix })),
        ],
        optionalServices: BT_SERVICES
      });
    } catch(e1){
      if(e1.name === 'NotFoundError') throw e1;
      device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BT_SERVICES
      });
    }

    printers[tipo].device         = device;
    printers[tipo].name           = device.name || 'Bluetooth Printer';
    printers[tipo].type           = 'bt';
    printers[tipo].needsReconnect = false;
    localStorage.setItem('printerType_'+tipo, 'bt');
    localStorage.setItem('printerName_'+tipo, printers[tipo].name);
    updPrinterUI(tipo);
    toast('\u2713 Conectada: ' + printers[tipo].name);
  } catch(e){
    if(e.name !== 'NotFoundError') toast('Error BT: ' + e.message);
  }
}
async function usarImpresoraUSBLocal(tipo){
  toast('Buscando servidor USB...');
  var s = await USBPrinter.status();
  if(!s){
    toast('\u26a0\ufe0f Servidor no encontrado. \u00bfEst\u00e1 corriendo ampersand-print-server?');
    return;
  }
  var lista = await USBPrinter.listarImpresoras();
  if(!lista || lista.length === 0){
    toast('\u26a0\ufe0f No se encontraron puertos/impresoras');
    return;
  }
  // Separar puertos directos e impresoras instaladas
  var puertos = lista.filter(function(x){ return x.tipo === 'puerto'; });
  var impresoras = lista.filter(function(x){ return x.tipo === 'impresora'; });
  var opts = '';
  var items = [];
  if(puertos.length){
    opts += 'PUERTOS DIRECTOS (recomendado para Generic Text Only):\n';
    puertos.forEach(function(p,i){
      opts += (items.length+1)+'. '+p.nombre+'\n';
      items.push(p);
    });
  }
  if(impresoras.length){
    opts += '\nIMPRESORAS WINDOWS:\n';
    impresoras.forEach(function(p){
      opts += (items.length+1)+'. '+p.nombre+'\n';
      items.push(p);
    });
  }
  var elegida = window.prompt('Seleccion\u00e1 el n\u00famero:\n\n'+opts+'\nPara Generic Text Only USB elegí USB001 o USB002');
  var idx = parseInt(elegida) - 1;
  if(isNaN(idx) || idx < 0 || idx >= items.length) return;
  var item = items[idx];
  var r = await USBPrinter.seleccionar(item);
  if(r.status !== 'ok'){
    toast('Error: '+r.mensaje); return;
  }
  printers[tipo].name   = item.nombre;
  printers[tipo].type   = 'usblocal';
  printers[tipo].device = null;
  localStorage.setItem('printerType_'+tipo, 'usblocal');
  localStorage.setItem('printerName_'+tipo, item.nombre);
  localStorage.setItem('usblocal_printer', item.valor);
  localStorage.setItem('usblocal_printer_nombre', item.nombre);
  updPrinterUI(tipo);
  toast('\u2713 Configurada: '+item.nombre);
}

function usarImpresoraPC(tipo){
  printers[tipo].name   = 'Impresora del sistema';
  printers[tipo].type   = 'pc';
  printers[tipo].device = null;
  localStorage.setItem('printerType_'+tipo, 'pc');
  localStorage.setItem('printerName_'+tipo, 'Impresora del sistema');
  updPrinterUI(tipo);
  toast('\u2713 Configurada PC/USB para '+tipo);
}


// ── BT Print Server — funciones de UI ──────────────────────────────
async function btpsConectar(){
  const input = document.getElementById('btpsMacInput');
  const mac   = (input ? input.value.trim() : '').toUpperCase();
  if (!mac.match(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/)) {
    toast('MAC inválida — formato: AA:BB:CC:DD:EE:FF'); return;
  }
  localStorage.setItem('btps_mac', mac);
  localStorage.setItem('printerType_ticket', 'btps');
  localStorage.setItem('printerName_ticket', mac);
  toast('Conectando a ' + mac + '...');
  const r = await BTPrinter.connect(mac);
  if (r.status === 'ok') {
    BTPrinter._updUI(true, r.device);
    toast('✓ Impresora conectada: ' + r.device);
  } else {
    toast('❌ ' + (r.message || 'Error al conectar'));
    BTPrinter._updUI(false, null);
  }
}

async function btpsVerEstado(){
  const s = await BTPrinter.status();
  if (!s) { toast('Servidor no disponible — abre BT Print Server'); return; }
  BTPrinter._updUI(s.connected, s.device);
  if (s.connected) {
    // Guardar tipo btps para que al cobrar use BTPrinter
    localStorage.setItem('printerType_ticket', 'btps');
    toast('Conectada: ' + (s.device || ''));

    // Guardar MAC automáticamente desde la respuesta del servidor
    const inp = document.getElementById('btpsMacInput');
    if (s.deviceMac) {
      localStorage.setItem('btps_mac', s.deviceMac);
      if (inp) inp.value = s.deviceMac;
    } else {
      const macGuardada = localStorage.getItem('btps_mac');
      if (inp && macGuardada) inp.value = macGuardada;
    }
  } else {
    toast('Desconectada — MAC guardada: ' + (localStorage.getItem('btps_mac') || 'ninguna'));
  }
}

async function btpsTestImprimir(){
  const s = await BTPrinter.status();
  if (!s) { toast('⚠️ Abrí la app BT Print Server'); return; }
  if (!s.connected) { toast('⚠️ Impresora desconectada'); return; }
  const r = await BTPrinter.print(
    '[CENTER][BOLD]** PRUEBA **[/BOLD][/CENTER]\n' +
    '--------------------------------\n' +
    'Ampersand POS - Test OK\n' +
    new Date().toLocaleString('es-PY') + '\n' +
    '--------------------------------\n' +
    '[FEED:4]\n[CUT]'
  );
  toast(r.status === 'ok' ? '✓ Test enviado a la impresora' : '❌ ' + r.message);
}

function btpsCargarMacGuardada(){
  const mac = localStorage.getItem('btps_mac');
  const inp = document.getElementById('btpsMacInput');
  if (mac && inp) inp.value = mac;
}

function desconectarImpresora(tipo){
  if(printers[tipo].device && printers[tipo].device.gatt && printers[tipo].device.gatt.connected){
    printers[tipo].device.gatt.disconnect();
  }
  printers[tipo] = { type:null, name:null, device:null, size: printers[tipo].size };
  localStorage.removeItem('printerType_'+tipo);
  localStorage.removeItem('printerName_'+tipo);
  updPrinterUI(tipo);
  toast('Impresora desconectada');
}

// Imprimir ticket usando la impresora configurada
function imprimirTicketConf(htmlContent, tipo){
  const p = printers[tipo] || printers['ticket'];
  const size = p ? p.size : '58';
  const widthPx = size === '58' ? '200px' : '280px';

  // ── MODO APK con Bluetooth nativo ──────────────────────────────────────────
  if(isAndroidAPK() && p && p.type === 'bt'){
    const androidName = p.androidName
      || localStorage.getItem('printerAndroidName_' + tipo)
      || p.name;

    if(!androidName){
      toast('⚠️ Configurá la impresora Bluetooth primero');
      return;
    }

    // Asegurarse de que el puente sabe qué impresora usar
    window.AndroidPrint.setBluetoothDevice(androidName);

    // Convertir HTML a bytes ESC/POS y enviar al puente nativo
    imprimirAndroidNativo(htmlContent, size)
      .then(function(resultado){
        if(resultado && resultado.startsWith('ok')){
          toast('✓ Impreso (' + resultado + ')');
        } else {
          toast('Error al imprimir: ' + resultado);
          abrirDialogoImpresion(htmlContent, widthPx);
        }
      })
      .catch(function(e){
        toast('Error: ' + e.message);
        abrirDialogoImpresion(htmlContent, widthPx);
      });
    return;
  }

  // ── MODO APK sin impresora configurada ────────────────────────────────────
  if(isAndroidAPK() && p && p.type === 'bt' && p.needsReconnect){
    toast('⚠️ Reconectá la impresora Bluetooth primero');
    goTo('scConfigImpresoras');
    return;
  }

  // ── MODO WEB Bluetooth (Chrome/Edge en PC) ────────────────────────────────
  if(p && p.type === 'bt' && p.device){
    imprimirBluetooth(p.device, htmlContent, size);
    return;
  }

  if(p && p.type === 'bt' && p.needsReconnect){
    toast('⚠️ Reconectá la impresora Bluetooth primero');
    goTo('scConfigImpresoras');
    return;
  }

  // ── MODO USB Serial (Web Serial API) ─────────────────────────────────────
  if(p && p.type === 'serial' && p.device){
    imprimirSerial(p.device, htmlContent, size);
    return;
  }

  // ── MODO USB Local (servidor local 9200) ──────────────────────────────────
  if(p && p.type === 'usblocal'){
    imprimirUSBLocal(htmlContent, size);
    return;
  }

  // ── Fallback: PC/USB — abrir diálogo de impresión ─────────────────────────
  abrirDialogoImpresion(htmlContent, widthPx);
}

// ── FUNCIÓN: imprimirPCUSB ───────────────────────────────────────────────────
// Genera bytes ESC/POS identicos al Bluetooth y los envia via canal disponible
async function imprimirPCUSB(htmlContent, size){
  var ESC=0x1B, GS=0x1D;
  var CMD={
    init:[ESC,0x40], left:[ESC,0x61,0x00], center:[ESC,0x61,0x01],
    boldOn:[ESC,0x45,0x01], boldOff:[ESC,0x45,0x00],
    dblWideOn:[ESC,0x21,0x20], dblWideOff:[ESC,0x21,0x00],
    smallOn:[ESC,0x21,0x01], smallOff:[ESC,0x21,0x00],
    cut:[GS,0x56,0x41,0x10], feed:[ESC,0x64,0x04],
  };
  var cols=size==='58'?32:42;

  function enc(str){
    var out=[];
    for(var i=0;i<str.length;i++){
      var c=str.charCodeAt(i);
      if(c<128) out.push(c);
      else if(c===0xC1||c===0xE1) out.push(0xC1);
      else if(c===0xC9||c===0xE9) out.push(0xC9);
      else if(c===0xCD||c===0xED) out.push(0xCD);
      else if(c===0xD3||c===0xF3) out.push(0xD3);
      else if(c===0xDA||c===0xFA) out.push(0xDA);
      else if(c===0xD1||c===0xF1) out.push(0xD1);
      else out.push(0x3F);
    }
    return out;
  }
  function line(str){ return enc(str).concat([0x0A]); }
  function sep(){ return line('-'.repeat(cols)); }
  function rline(l,r){
    var ls=String(l),rs=String(r);
    var sp=Math.max(1,cols-ls.length-rs.length);
    return line(ls+' '.repeat(sp)+rs);
  }

  var tmp=document.createElement('div');
  var bm=htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  tmp.innerHTML=bm?bm[1]:htmlContent;

  var parrafos=Array.from(tmp.querySelectorAll('p'));
  var bytes=[ESC,0x40,ESC,0x74,0x02];

  parrafos.forEach(function(p){
    var cls=p.className||'';
    var text=(p.innerText||p.textContent||'').trim();
    if(!text&&!cls.includes('hr')) return;
    if(cls.includes('hr')){ bytes=bytes.concat(sep()); return; }

    var isCenter=cls.includes('c');
    var isBold=cls.includes('b');
    var isLarge=cls.includes('l');
    var isSmall=cls.includes('s')&&!cls.includes('s b')&&!cls.includes('c s');

    if(isCenter) bytes=bytes.concat(CMD.center); else bytes=bytes.concat(CMD.left);
    if(isLarge)  bytes=bytes.concat(CMD.dblWideOn,CMD.boldOn);
    else if(isBold) bytes=bytes.concat(CMD.boldOn);
    if(isSmall) bytes=bytes.concat(CMD.smallOn);

    if(cls.includes('row')){
      var spans=p.querySelectorAll('span');
      if(spans.length>=2){
        var l=(spans[0].innerText||spans[0].textContent||'').trim();
        var r=(spans[spans.length-1].innerText||spans[spans.length-1].textContent||'').trim();
        bytes=bytes.concat(CMD.left);
        if(isBold||isLarge) bytes=bytes.concat(CMD.boldOn);
        if(isLarge) bytes=bytes.concat(CMD.dblWideOn);
        bytes=bytes.concat(rline(l,r),CMD.boldOff,CMD.dblWideOff,CMD.smallOff);
        return;
      }
    }
    if(cls.includes('it-det')||cls.includes('if-det')){
      var spans=p.querySelectorAll('span');
      if(spans.length>=2){
        bytes=bytes.concat(CMD.left,CMD.smallOn);
        var parts=Array.from(spans).map(function(s){return (s.innerText||s.textContent||'').trim();});
        if(parts.length===3){ bytes=bytes.concat(rline('  '+parts[0],parts[2])); }
        else { bytes=bytes.concat(line('  '+parts.join('  '))); }
        bytes=bytes.concat(CMD.smallOff);
        return;
      }
    }
    if(cls.includes('it-nom')||cls.includes('if-nom')){
      bytes=bytes.concat(CMD.left,CMD.boldOn,line(text),CMD.boldOff);
      return;
    }
    bytes=bytes.concat(line(text),CMD.boldOff,CMD.dblWideOff,CMD.smallOff);
  });
  bytes=bytes.concat(CMD.feed,CMD.cut);

  // Intentar Web Serial si hay puerto guardado
  var serialPort=null;
  try {
    var ports=await navigator.serial.getPorts();
    if(ports&&ports.length>0) serialPort=ports[0];
  } catch(e){ /* safe to ignore: Web Serial API may not be available */ }

  if(serialPort){
    try{
      if(!serialPort.readable){
        await serialPort.open({baudRate:9600});
      }
      var writer=serialPort.writable.getWriter();
      await writer.write(new Uint8Array(bytes));
      writer.releaseLock();
      toast('\u2713 Impreso por USB');
      return;
    }catch(e){ console.warn('Serial fallback:', e.message); }
  }

  // Descargar .bin para imprimir manualmente con impresora-usb.bat
  var blob=new Blob([new Uint8Array(bytes)],{type:'application/octet-stream'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download='ticket.bin';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url);},5000);
  toast('\u2193 ticket.bin descargado — ejecut\u00e1 impresora-usb.bat');
}

// ── HELPER: abrir diálogo de impresión del sistema ──────────────────────────
function htmlATextoPlano(htmlContent, cols){
  // Convierte el HTML del ticket a texto plano para Generic Text Only
  cols = cols || 32;
  var tmp = document.createElement('div');
  var body = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  tmp.innerHTML = body ? body[1] : htmlContent;

  var lineas = [];
  var parrafos = Array.from(tmp.querySelectorAll('p'));

  function pad(l, r){
    var ls = String(l), rs = String(r);
    var sp = Math.max(1, cols - ls.length - rs.length);
    return ls + ' '.repeat(sp) + rs;
  }
  function center(t){
    t = String(t);
    var sp = Math.max(0, Math.floor((cols - t.length) / 2));
    return ' '.repeat(sp) + t;
  }
  // Reemplazar acentos para compatibilidad Generic Text Only
  function limpiar(t){
    return t
      .replace(/[\u00C1\u00E1]/g,'A').replace(/[\u00C9\u00E9]/g,'E')
      .replace(/[\u00CD\u00ED]/g,'I').replace(/[\u00D3\u00F3]/g,'O')
      .replace(/[\u00DA\u00FA]/g,'U').replace(/[\u00D1\u00F1]/g,'N')
      .replace(/\u20B2/g,'Gs').replace(/[\u0080-\uFFFF]/g,'?');
  }

  parrafos.forEach(function(p){
    var cls = p.className || '';
    var text = limpiar((p.innerText || p.textContent || '').trim());
    if(!text && !cls.includes('hr')) return;

    if(cls.includes('hr')){
      lineas.push('-'.repeat(cols));
      return;
    }

    // Fila dos columnas
    if(cls.includes('row')){
      var spans = p.querySelectorAll('span');
      if(spans.length >= 2){
        var l = limpiar((spans[0].innerText || spans[0].textContent || '').trim());
        var r = limpiar((spans[spans.length-1].innerText || spans[spans.length-1].textContent || '').trim());
        lineas.push(pad(l, r));
        return;
      }
    }
    // Items detalle
    if(cls.includes('it-det') || cls.includes('if-det')){
      var spans = p.querySelectorAll('span');
      if(spans.length >= 2){
        var parts = Array.from(spans).map(function(s){ return limpiar((s.innerText||s.textContent||'').trim()); });
        if(parts.length === 3){ lineas.push(pad('  '+parts[0], parts[2])); }
        else { lineas.push('  '+parts.join('  ')); }
        return;
      }
    }
    // Centrado
    if(cls.includes('c') && !cls.includes('it-')){
      lineas.push(center(text));
      return;
    }
    lineas.push(text);
  });

  return lineas.join('\n') + '\n\n\n\n';
}

function limpiarParaImpresora(html){
  return html
    .replace(/\u20B2/g, 'Gs')
    .replace(/\u00D7/g, 'x')
    .replace(/\u00C1/g, 'A').replace(/\u00E1/g, 'a')
    .replace(/\u00C9/g, 'E').replace(/\u00E9/g, 'e')
    .replace(/\u00CD/g, 'I').replace(/\u00ED/g, 'i')
    .replace(/\u00D3/g, 'O').replace(/\u00F3/g, 'o')
    .replace(/\u00DA/g, 'U').replace(/\u00FA/g, 'u')
    .replace(/\u00D1/g, 'N').replace(/\u00F1/g, 'n')
    .replace(/\u00BF/g, '?').replace(/\u00A1/g, '!')
    .replace(/[\u0080-\uFFFF]/g, '?');
}

function abrirDialogoImpresion(htmlContent, widthPx){
  var size = (widthPx === '200px' || widthPx === '58mm' || widthPx === '58') ? '58' : '80';
  var w = size === '58' ? '58mm' : '80mm';

  // Extraer el body del HTML generado por el ticket
  var bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  var body = bodyMatch ? bodyMatch[1] : htmlContent;

  // Reutilizar el mismo CSS termico del sistema
  var css = getCSSTermico(size);

  var fullHtml = '<!DOCTYPE html><html><head>'+
    '<meta charset="UTF-8">'+
    '<title>Ticket</title>'+
    '<style>'+css+
    '@media print{@page{size:'+w+' auto;margin:0;}html,body{width:'+w+';margin:0;padding:0;}}'+
    '</style>'+
    '</head><body>'+body+
    '<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>'+
    '</body></html>';

  var blob = new Blob([fullHtml], {type:'text/html;charset=utf-8'});
  var url  = URL.createObjectURL(blob);
  var win  = window.open(url, '_blank', 'width=320,height=700');
  if(!win){
    var a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  setTimeout(function(){ URL.revokeObjectURL(url); }, 20000);
}

// ── FUNCIÓN: imprimirAndroidNativo ───────────────────────────────────────────
// Convierte el HTML a ESC/POS bytes y llama al puente Java
async function imprimirAndroidNativo(htmlContent, size){
  const ESC = 0x1B, GS = 0x1D;
  const CMD = {
    init:       [ESC, 0x40],
    left:       [ESC, 0x61, 0x00],
    center:     [ESC, 0x61, 0x01],
    boldOn:     [ESC, 0x45, 0x01],
    boldOff:    [ESC, 0x45, 0x00],
    dblWideOn:  [ESC, 0x21, 0x20],
    dblWideOff: [ESC, 0x21, 0x00],
    smallOn:    [ESC, 0x21, 0x01],
    smallOff:   [ESC, 0x21, 0x00],
    cut:        [GS, 0x56, 0x41, 0x10],
    feed:       [ESC, 0x64, 0x03],
  };

  const cols = size === '58' ? 32 : 42;

  function enc(str){
    const out = [];
    for(let i = 0; i < str.length; i++){
      const c = str.charCodeAt(i);
      if(c < 128)                        out.push(c);
      else if(c === 0xC1 || c === 0xE1)  out.push(0xC1); // Á á
      else if(c === 0xC9 || c === 0xE9)  out.push(0xC9); // É é
      else if(c === 0xCD || c === 0xED)  out.push(0xCD); // Í í
      else if(c === 0xD3 || c === 0xF3)  out.push(0xD3); // Ó ó
      else if(c === 0xDA || c === 0xFA)  out.push(0xDA); // Ú ú
      else if(c === 0xD1 || c === 0xF1)  out.push(0xD1); // Ñ ñ
      else out.push(0x3F); // ?
    }
    return out;
  }

  function line(str)  { return [...enc(str), 0x0A]; }
  function sep()      { return line('-'.repeat(cols)); }
  function rline(l, r){
    const ls = String(l), rs = String(r);
    const space = Math.max(1, cols - ls.length - rs.length);
    return line(ls + ' '.repeat(space) + rs);
  }

  // Parsear HTML — extraer solo el <body>
  const tmp = document.createElement('div');
  let htmlParaParsear = htmlContent;
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if(bodyMatch) htmlParaParsear = bodyMatch[1];
  tmp.innerHTML = htmlParaParsear;

  const parrafos = Array.from(tmp.querySelectorAll('p'));
  let bytes = [...CMD.init, ESC, 0x74, 0x02]; // init + página latin-1

  parrafos.forEach(function(p){
    const cls  = p.className || '';
    const text = (p.innerText || p.textContent || '').trim();
    if(!text && !cls.includes('hr')) return;

    if(cls.includes('hr')){ bytes.push(...sep()); return; }

    const isCenter = cls.includes('c');
    const isBold   = cls.includes('b');
    const isLarge  = cls.includes('l');
    const isSmall  = cls.includes('s') && !cls.includes('s b') && !cls.includes('c s');

    if(isCenter) bytes.push(...CMD.center); else bytes.push(...CMD.left);
    if(isLarge)  bytes.push(...CMD.dblWideOn, ...CMD.boldOn);
    else if(isBold) bytes.push(...CMD.boldOn);
    if(isSmall) bytes.push(...CMD.smallOn);

    // Fila con dos columnas
    if(cls.includes('row')){
      const spans = p.querySelectorAll('span');
      if(spans.length >= 2){
        const l = (spans[0].innerText || spans[0].textContent || '').trim();
        const r = (spans[spans.length - 1].innerText || spans[spans.length - 1].textContent || '').trim();
        bytes.push(...CMD.left);
        if(isBold || isLarge) bytes.push(...CMD.boldOn);
        if(isLarge) bytes.push(...CMD.dblWideOn);
        bytes.push(...rline(l, r));
        bytes.push(...CMD.boldOff, ...CMD.dblWideOff, ...CMD.smallOff);
        return;
      }
    }

    // Items
    if(cls.includes('it-det') || cls.includes('if-det')){
      const spans = p.querySelectorAll('span');
      if(spans.length >= 2){
        bytes.push(...CMD.left, ...CMD.smallOn);
        const parts = Array.from(spans).map(s => (s.innerText || s.textContent || '').trim());
        if(parts.length === 3){
          bytes.push(...rline('  ' + parts[0], parts[2]));
        } else {
          bytes.push(...line('  ' + parts.join('  ')));
        }
        bytes.push(...CMD.smallOff);
        return;
      }
    }

    if(cls.includes('it-nom') || cls.includes('if-nom')){
      bytes.push(...CMD.left, ...CMD.boldOn);
      bytes.push(...line(text));
      bytes.push(...CMD.boldOff);
      return;
    }

    bytes.push(...line(text));
    bytes.push(...CMD.boldOff, ...CMD.dblWideOff, ...CMD.smallOff);
  });

  bytes.push(...CMD.feed, ...CMD.cut);

  // Convertir a Base64 y enviar al puente Java
  const uint8 = new Uint8Array(bytes);
  let binary = '';
  for(let i = 0; i < uint8.length; i++){
    binary += String.fromCharCode(uint8[i]);
  }
  const base64 = btoa(binary);

  // Llamar al puente Java — esto ejecuta la impresión Bluetooth nativa
  const resultado = window.AndroidPrint.print(base64);
  return resultado;
}

// ── FUNCIÓN: imprimirUSBLocal (via servidor local 9200) ──────────────────────
async function imprimirUSBLocal(htmlContent, size){
  var ESC=0x1B, GS=0x1D;
  var CMD = {
    init:[ESC,0x40], left:[ESC,0x61,0x00], center:[ESC,0x61,0x01],
    boldOn:[ESC,0x45,0x01], boldOff:[ESC,0x45,0x00],
    dblWideOn:[ESC,0x21,0x20], dblWideOff:[ESC,0x21,0x00],
    smallOn:[ESC,0x21,0x01], smallOff:[ESC,0x21,0x00],
    cut:[GS,0x56,0x41,0x10], feed:[ESC,0x64,0x03],
  };
  var cols = size==='58' ? 32 : 42;

  function enc(str){
    var out=[];
    for(var i=0;i<str.length;i++){
      var c=str.charCodeAt(i);
      if(c<128) out.push(c);
      else if(c===0xC1||c===0xE1) out.push(0xC1);
      else if(c===0xC9||c===0xE9) out.push(0xC9);
      else if(c===0xCD||c===0xED) out.push(0xCD);
      else if(c===0xD3||c===0xF3) out.push(0xD3);
      else if(c===0xDA||c===0xFA) out.push(0xDA);
      else if(c===0xD1||c===0xF1) out.push(0xD1);
      else out.push(0x3F);
    }
    return out;
  }
  function line(str){ return enc(str).concat([0x0A]); }
  function sep(){ return line('-'.repeat(cols)); }
  function rline(l,r){
    var ls=String(l), rs=String(r);
    var sp=Math.max(1,cols-ls.length-rs.length);
    return line(ls+' '.repeat(sp)+rs);
  }

  var tmp=document.createElement('div');
  var htmlParsear=htmlContent;
  var bm=htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if(bm) htmlParsear=bm[1];
  tmp.innerHTML=htmlParsear;

  var parrafos=Array.from(tmp.querySelectorAll('p'));
  var bytes=[ESC,0x40,ESC,0x74,0x02];

  parrafos.forEach(function(p){
    var cls=p.className||'';
    var text=(p.innerText||p.textContent||'').trim();
    if(!text && !cls.includes('hr')) return;
    if(cls.includes('hr')){ bytes=bytes.concat(sep()); return; }

    var isCenter=cls.includes('c');
    var isBold=cls.includes('b');
    var isLarge=cls.includes('l');
    var isSmall=cls.includes('s')&&!cls.includes('s b')&&!cls.includes('c s');

    if(isCenter) bytes=bytes.concat(CMD.center); else bytes=bytes.concat(CMD.left);
    if(isLarge)  bytes=bytes.concat(CMD.dblWideOn,CMD.boldOn);
    else if(isBold) bytes=bytes.concat(CMD.boldOn);
    if(isSmall) bytes=bytes.concat(CMD.smallOn);

    if(cls.includes('row')){
      var spans=p.querySelectorAll('span');
      if(spans.length>=2){
        var l=(spans[0].innerText||spans[0].textContent||'').trim();
        var r=(spans[spans.length-1].innerText||spans[spans.length-1].textContent||'').trim();
        bytes=bytes.concat(CMD.left);
        if(isBold||isLarge) bytes=bytes.concat(CMD.boldOn);
        if(isLarge) bytes=bytes.concat(CMD.dblWideOn);
        bytes=bytes.concat(rline(l,r));
        bytes=bytes.concat(CMD.boldOff,CMD.dblWideOff,CMD.smallOff);
        return;
      }
    }
    if(cls.includes('it-det')||cls.includes('if-det')){
      var spans=p.querySelectorAll('span');
      if(spans.length>=2){
        bytes=bytes.concat(CMD.left,CMD.smallOn);
        var parts=Array.from(spans).map(function(s){return (s.innerText||s.textContent||'').trim();});
        if(parts.length===3){ bytes=bytes.concat(rline('  '+parts[0],parts[2])); }
        else { bytes=bytes.concat(line('  '+parts.join('  '))); }
        bytes=bytes.concat(CMD.smallOff);
        return;
      }
    }
    if(cls.includes('it-nom')||cls.includes('if-nom')){
      bytes=bytes.concat(CMD.left,CMD.boldOn,line(text),CMD.boldOff);
      return;
    }
    bytes=bytes.concat(line(text),CMD.boldOff,CMD.dblWideOff,CMD.smallOff);
  });
  bytes=bytes.concat(CMD.feed,CMD.cut);

  var r = await USBPrinter.imprimirBytes(bytes);
  if(r.status === 'ok'){
    toast('\u2713 Impreso por USB');
  } else {
    toast('\u26a0\ufe0f Error USB: '+(r.mensaje||'desconocido'));
  }
}

// -- Serial/USB: ver js/impresion.js --

// -- Sync: ver js/sync.js --

// ══════════════════════════════════════════════════════════
// SISTEMA DE LICENCIAS
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// MÓDULO: BluetoothPrinter — puente HTTP con BT Print Server
// Servidor local en http://127.0.0.1:8080
// ══════════════════════════════════════════════════════════════════
// ── USB Print Server (local — puerto 9200) ──────────────────────────────────
const USBPrinter = {
  BASE: 'http://127.0.0.1:9200',
  TIMEOUT_MS: 4000,

  async _fetch(path, opts) {
    var ctrl = new AbortController();
    var tid  = setTimeout(function(){ ctrl.abort(); }, this.TIMEOUT_MS);
    try {
      var r = await fetch(this.BASE + path, Object.assign({}, opts, { signal: ctrl.signal }));
      clearTimeout(tid);
      return r;
    } catch(e) { clearTimeout(tid); throw e; }
  },

  async status() {
    try { var r = await this._fetch('/status'); return await r.json(); }
    catch(e) { return null; }
  },

  async listarImpresoras() {
    try { var r = await this._fetch('/impresoras'); return await r.json(); }
    catch(e) { return []; }
  },

  async seleccionar(nombre) {
    try {
      var r = await this._fetch('/seleccionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre })
      });
      return await r.json();
    } catch(e) { return { status: 'error', mensaje: 'Servidor no disponible' }; }
  },

  async imprimirBytes(bytes) {
    try {
      var r = await this._fetch('/imprimir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(bytes)
      });
      return await r.json();
    } catch(e) { return { status: 'error', mensaje: 'Servidor no disponible' }; }
  },

  async iniciar() {
    var tipo = localStorage.getItem('printerType_ticket');
    if(tipo !== 'usblocal') return;
    var s = await this.status();
    if(!s){ this._updUI(false); return; }
    this._updUI(true);
    // Re-seleccionar impresora guardada
    var valor = localStorage.getItem('usblocal_printer');
    var nombre = localStorage.getItem('usblocal_printer_nombre') || valor;
    if(valor) await this.seleccionar({valor: valor, nombre: nombre});
  },

  _updUI(conectada) {
    var st = document.getElementById('usblocalStatus');
    var nm = document.getElementById('usblocalName');
    if(st){ st.textContent = conectada ? '● Servidor activo' : '● Servidor no encontrado'; st.style.color = conectada ? 'var(--green)' : '#ef5350'; }
    if(nm){ nm.textContent = conectada ? (localStorage.getItem('usblocal_printer') || 'USB Local') : 'Sin impresora'; }
  }
};

const BTPrinter = {
  BASE: 'http://127.0.0.1:8080',
  TIMEOUT_MS: 5000,

  async _fetch(path, opts) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), this.TIMEOUT_MS);
    try {
      const r = await fetch(this.BASE + path, Object.assign({}, opts, { signal: ctrl.signal }));
      clearTimeout(tid);
      return r;
    } catch(e) { clearTimeout(tid); throw e; }
  },

  async status() {
    try { const r = await this._fetch('/status'); return await r.json(); }
    catch(e) { return null; }
  },

  async connect(mac) {
    try {
      const r = await this._fetch('/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac: mac })
      });
      return await r.json();
    } catch(e) {
      return { status: 'error', message: 'Abri la app BT Print Server en tu dispositivo' };
    }
  },

  async print(text) {
    try {
      const r = await this._fetch('/print', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: text
      });
      if (!r.ok) {
        const err = await r.json().catch(function(){ return {}; });
        if (r.status === 503) return { status: 'error', message: 'Impresora desconectada, reconectando...' };
        return { status: 'error', message: err.message || 'Error al imprimir' };
      }
      return await r.json();
    } catch(e) {
      return { status: 'error', message: 'Abri la app BT Print Server en tu dispositivo' };
    }
  },

  async iniciar() {
    const mac = localStorage.getItem('btps_mac');
    if (!mac) return;
    const s = await this.status();
    if (!s) { this._updUI(false, null); return; }
    this._updUI(s.connected, s.device);
    if (!s.connected) {
      toast('Reconectando impresora...');
      const r = await this.connect(mac);
      if (r.status === 'ok') { this._updUI(true, r.device); toast('Impresora conectada: ' + r.device); }
    }
  },

  buildTicket(data, cols) {
    if (!cols) cols = 32;
    var sep  = '='.repeat(cols);
    var sep2 = '-'.repeat(cols);
    var n    = '\n';
    var cfg  = (typeof configData !== 'undefined') ? configData : {};

    function pad(l, r) {
      var sp = Math.max(1, cols - String(l).length - String(r).length);
      return String(l) + ' '.repeat(sp) + String(r);
    }
    function ctr(t) {
      t = String(t);
      var sp = Math.max(0, Math.floor((cols - t.length) / 2));
      return ' '.repeat(sp) + t;
    }
    function gs(v) { return Math.round(v||0).toLocaleString('es-PY'); }
    // Partir texto largo en múltiples líneas
    function wrap(label, value, indent) {
      if (!value) return '';
      indent = indent || '';
      var maxVal = cols - label.length - 1;
      if (String(value).length <= maxVal) return label + ' ' + value + n;
      // Partir en líneas
      var words = String(value).split(' ');
      var lines = [''], li = 0;
      words.forEach(function(w) {
        if ((lines[li] + ' ' + w).trim().length > cols - indent.length) {
          li++; lines[li] = '';
        }
        lines[li] = (lines[li] + ' ' + w).trim();
      });
      return label + ' ' + lines[0] + n +
        lines.slice(1).filter(Boolean).map(function(l){ return indent + l + n; }).join('');
    }

    var txt = '';

    // ── ENCABEZADO ──────────────────────────────────────
    if (cfg.negocio) txt += '[CENTER][BOLD]' + cfg.negocio.toUpperCase() + '[/BOLD][/CENTER]' + n;
    if (cfg.ruc)     txt += '[CENTER]RUC ' + cfg.ruc + '[/CENTER]' + n;
    if (cfg.direccion) txt += '[CENTER]' + cfg.direccion + '[/CENTER]' + n;
    if (cfg.telefono)  txt += '[CENTER]Tel: ' + cfg.telefono + '[/CENTER]' + n;
    txt += sep + n;

    // ── DATOS DEL TICKET ─────────────────────────────────
    var nro      = String(data.nroTicket || '').padStart(4, '0');
    var fechaObj = data.fecha ? (data.fecha instanceof Date ? data.fecha : new Date(data.fecha)) : new Date();
    // Formato manual dd/mm/yyyy HH:MM para evitar caracteres especiales AM/PM
    var pd2      = function(x){ return String(x).padStart(2,'0'); };
    var fechaStr = pd2(fechaObj.getDate())+'/'+pd2(fechaObj.getMonth()+1)+'/'+fechaObj.getFullYear();
    var horaStr  = pd2(fechaObj.getHours())+':'+pd2(fechaObj.getMinutes());
    // Si es factura, mostrar nro de factura en dos líneas para no cortar
    var esFacturaBTPS = data.factura && data.factura.timbrado && (data.factura.nro_factura || data.factura.nroFactura);
    if(esFacturaBTPS){
      var f0      = data.factura;
      var tc      = (typeof getTimbradoActivo === 'function') ? getTimbradoActivo() : null;
      var vi      = f0.fecha_desde || (tc && (tc.vig_inicio || tc.fecha_desde)) || '';
      var vf      = f0.fecha_hasta || (tc && (tc.vig_fin    || tc.fecha_hasta)) || '';
      var nroFact = f0.nro_factura || f0.nroFactura;
      txt += '[CENTER][BOLD]FACTURA CONTADO[/BOLD][/CENTER]' + n;
      txt += sep2 + n;
      txt += 'Timbrado: ' + f0.timbrado + n;
      if(vi) txt += 'Inicio:   ' + (vi.includes('-') ? vi.split('-').reverse().join('/') : vi) + n;
      if(vf && vf !== '2999-12-31') txt += 'Vto:      ' + (vf.includes('-') ? vf.split('-').reverse().join('/') : vf) + n;
      if(f0.sucursal_nro && f0.punto_exp) txt += 'Suc: ' + f0.sucursal_nro + '  P.Exp: ' + f0.punto_exp + n;
      txt += '[BOLD]' + pad('Nro:', nroFact) + '[/BOLD]' + n;
      txt += 'Fecha:    ' + fechaStr + '  ' + horaStr + n;
    } else {
      txt += pad('Ticket #' + nro, fechaStr + ' ' + horaStr) + n;
    }
    if (data.obs) txt += 'Obs: ' + data.obs + n;
    txt += sep2 + n;

    // ── ITEMS ─────────────────────────────────────────────
    (data.items || []).forEach(function(item) {
      if (item.esDescuento) {
        txt += pad('  Descuento', '-' + gs(item.montoDesc) + ' Gs.') + n;
        return;
      }
      txt += item.name + n;
      var detalle  = '  ' + item.qty + ' x ' + gs(item.price);
      var subtotal = gs(item.price * item.qty * (1 - (item.desc||0)/100));
      txt += pad(detalle, subtotal) + n;
      if (item.obs) txt += '  (' + item.obs + ')' + n;
    });

    txt += sep2 + n;

    // ── DESCUENTO Y TOTAL ─────────────────────────────────
    if (data.descTicket && data.descTicket > 0) {
      var montoDesc = Math.round(data.total * data.descTicket / 100);
      txt += pad('Descuento ' + data.descTicket + '%', '-' + gs(montoDesc)) + n;
    }
    txt += '[BOLD]' + pad('TOTAL', gs(data.total) + ' Gs.') + '[/BOLD]' + n;
    txt += sep + n;

    // ── PAGO ──────────────────────────────────────────────
    if (data.divPagos && data.divPagos.length >= 2) {
      // Pago dividido — desglosar cada método
      data.divPagos.forEach(function(p) {
        txt += pad(p.metodo.toUpperCase(), gs(p.monto) + ' Gs.') + n;
      });
    } else {
      var metodo = (data.metodo || 'EFECTIVO').toUpperCase();
      if (metodo.includes(' + ')) {
        // String compuesto viejo — dividir en partes iguales
        var partes = metodo.split(' + ');
        var montoParte = Math.round(data.total / partes.length);
        partes.forEach(function(m, i) {
          var monto = i === partes.length - 1
            ? data.total - montoParte * (partes.length - 1)
            : montoParte;
          txt += pad(m, gs(monto) + ' Gs.') + n;
        });
      } else {
        txt += pad(metodo, gs(data.total) + ' Gs.') + n;
      }
    }
    if (data.vuelto && data.vuelto > 0) {
      txt += pad('Vuelto', gs(data.vuelto) + ' Gs.') + n;
    }

    // ── DATOS CLIENTE E IVA (solo en factura) ────────────
    if (data.factura && data.factura.timbrado) {
      var f = data.factura;
      txt += sep2 + n;
      txt += 'Cliente: ' + (f.nombre || 'CONSUMIDOR FINAL') + n;
      txt += 'RUC:     ' + (f.ruc    || '0000000-0') + n;
      if (f.direccion) txt += 'Dir:     ' + f.direccion + n;
      txt += sep2 + n;
      // IVA desglose
      var grav10 = 0, grav5 = 0, exento = 0;
      (data.items || []).filter(function(i){ return !i.esDescuento; }).forEach(function(item){
        var sub = item.desc > 0 ? Math.round(item.price * item.qty * (1 - item.desc/100)) : item.price * item.qty;
        if (item.iva === '5')           grav5  += sub;
        else if (item.iva === 'exento') exento += sub;
        else                            grav10 += sub;
      });
      var iva10 = Math.round(grav10 * 10 / 110);
      var iva5  = Math.round(grav5  * 5  / 105);
      if (grav10 > 0) { txt += pad('Gravado 10%', gs(grav10)) + n; txt += pad('IVA 10%', gs(iva10)) + n; }
      if (grav5  > 0) { txt += pad('Gravado 5%',  gs(grav5))  + n; txt += pad('IVA 5%',  gs(iva5))  + n; }
      if (exento > 0)   txt += pad('Exento',       gs(exento)) + n;
      txt += '[BOLD]' + pad('TOTAL', gs(data.total) + ' Gs.') + '[/BOLD]' + n;
      txt += sep2 + n;
      txt += 'ORIGINAL: CLIENTE' + n;
      txt += 'DUPLICADO: ARCHIVO TRIBUTARIO' + n;
    } else {
      txt += sep2 + n;
      txt += ctr('Comprobante no valido para el IVA') + n;
    }

    // ── PIE ───────────────────────────────────────────────
    txt += '[CENTER]*** Gracias por su compra! ***[/CENTER]' + n;
    if (cfg.mensajeTicket) txt += '[CENTER]' + cfg.mensajeTicket + '[/CENTER]' + n;

    txt += '[CUT]';
    return txt;
  },

  async imprimirRecibo(data) {
    var size = localStorage.getItem('printerSize_ticket') || '58';
    var cols = size === '58' ? 32 : 42;
    var mac  = localStorage.getItem('btps_mac');

    toast('Conectando a impresora...');

    // Verificar servidor
    var s = await this.status();
    if (!s) {
      // Mostrar error visible y persistente
      var esHttps = location.protocol === 'https:';
      if (esHttps) {
        this._showError(
          'No se puede conectar al servidor de impresión.\n\n' +
          '⚠️ Estás usando la app desde el navegador (HTTPS). ' +
          'El servidor BT Print Server corre en HTTP local y el navegador lo bloquea.\n\n' +
          '✅ Solución: Abrí la app desde el ícono instalado (APK), no desde Chrome.'
        );
      } else {
        this._showError('Abrí la app BT Print Server en tu dispositivo y asegurate de que esté corriendo.');
      }
      return false;
    }

    // Si no está conectado, reconectar con MAC guardada
    if (!s.connected) {
      if (!mac) {
        // Sin MAC no podemos reconectar — pedir al usuario que conecte desde config
        this._showError(
          'La impresora se desconecto.\n\n' +
          'Para reconectar:\n' +
          '1. Ir a Configuracion > Impresoras\n' +
          '2. Ingresar la MAC de tu impresora\n' +
          '3. Tocar CONECTAR\n\n' +
          'O bien tocar VER ESTADO si el BT Print Server ya tiene la impresora conectada.'
        );
        return false;
      }
      toast('Reconectando impresora...');
      var cr = await this.connect(mac);
      if (cr.status !== 'ok') {
        toast('Error: ' + (cr.message || 'No se pudo conectar'));
        return false;
      }
      this._updUI(true, cr.device);
      await new Promise(function(r){ setTimeout(r, 500); });
    }

    var ticket = this.buildTicket(data, cols);
    var r = await this.print(ticket);

    if (r.status === 'ok') {
      toast('Impreso correctamente');
      return true;
    }

    // Si falló porque se desconectó, reintentar una vez
    if (r.message && r.message.includes('desconectada') && mac) {
      toast('Reintentando...');
      var cr2 = await this.connect(mac);
      if (cr2.status === 'ok') {
        await new Promise(function(res){ setTimeout(res, 500); });
        var r2 = await this.print(ticket);
        if (r2.status === 'ok') { toast('Impreso correctamente'); return true; }
      }
    }

    toast('Error al imprimir, intenta de nuevo');
    return false;
  },

  _showError(msg) {
    // Mostrar error persistente que el usuario tiene que cerrar manualmente
    var existing = document.getElementById('_btpsError');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.id = '_btpsError';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;' +
      'background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:20px;';
    div.innerHTML =
      '<div style="background:#1e1e1e;border:2px solid #ef5350;border-radius:12px;padding:24px;max-width:380px;width:100%;">' +
        '<div style="font-size:28px;text-align:center;margin-bottom:12px;">🖨️</div>' +
        '<div style="color:#ef5350;font-weight:700;font-size:15px;margin-bottom:12px;text-align:center;">Error de impresión</div>' +
        '<div style="color:#ccc;font-size:13px;line-height:1.6;white-space:pre-line;">' + msg + '</div>' +
        '<button onclick="document.getElementById(\'_btpsError\').remove()" ' +
          'style="margin-top:20px;width:100%;background:#ef5350;border:none;border-radius:8px;' +
          'color:#fff;font-weight:800;font-size:14px;padding:12px;cursor:pointer;">CERRAR</button>' +
      '</div>';
    document.body.appendChild(div);
  },

  _updUI(connected, deviceName) {
    var el = document.getElementById('btpsStatus');
    if (el) {
      el.textContent = connected ? ('Conectada: ' + (deviceName || '')) : 'Desconectada';
      el.style.color = connected ? 'var(--green)' : '#ef5350';
    }
    var badge = document.getElementById('btpsBadge');
    if (badge) {
      badge.textContent = connected ? '●' : '○';
      badge.style.color = connected ? 'var(--green)' : '#ef5350';
    }
  }
};


// -- Licencia: ver js/licencia.js --

