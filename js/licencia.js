// ── Licencia, sesion, login, activacion ──

// SUPA_URL y SUPA_ANON vienen de js/config.js
const APP_VERSION = 'v1.9.0 (2026-04-08)';

// ══════════════════════════════════════════════════════════════════════════════
// MODO TERMINAL — 'caja' (default) o 'satelite'
//
// DESCRIPCIÓN:
//   Controla qué puede hacer este dispositivo dentro del sistema POS.
//
//   'caja'     → Terminal principal. Puede abrir/cerrar turno, cobrar y facturar.
//                Comportamiento original sin cambios.
//
//   'satelite' → Terminal de mesero/delivery. Puede tomar pedidos, asignar mesas,
//                imprimir comandas en cocina, pero NO puede cobrar ni facturar.
//                El botón COBRAR se convierte en ENVIAR PEDIDO.
//                Los pedidos se sincronizan a Supabase (tabla pos_pedidos) para
//                que la caja central los vea en tiempo real.
//
// CÓMO CONFIGURAR:
//   Desde admin-negocio.html → Configuración → Modo Terminal
//   O directamente: localStorage.setItem('pos_modo_terminal', 'satelite')
//
// IMPACTO EN UI:
//   - Botón COBRAR → ENVIAR PEDIDO (color púrpura #534AB7)
//   - Pantalla #scCobrar → inaccesible
//   - Turno/Cierre → ocultos en drawer
//   - Todo lo demás (catálogo, mesas, delivery, carrito) → sin cambios
// ══════════════════════════════════════════════════════════════════════════════
let MODO_TERMINAL = localStorage.getItem('pos_modo_terminal') || 'caja';
// SUPA_ANON ahora en js/config.js

// supaRPC viene de js/config.js

const SK = {
  token:'lic_token', email:'lic_email', negocio:'lic_negocio',
  plan:'lic_plan', vence:'lic_vence', nextCheck:'lic_next_check',
  activated:'lic_activated', deviceId:'lic_device_id', fallos:'lic_fallos'
};

const DEMO_KEYS = {
  'DEMO-2025-XXXX': { plan:'Basico',   vence:'2026-12-31' },
  'PRO-2025-YYYY':  { plan:'Pro',      vence:'2026-12-31' },
  'FULL-2025-ZZZZ': { plan:'Completo', vence:'2027-12-31' },
};
const USAR_DEMO = (SUPA_URL === 'https://XXXXXXXXXXXXXXXX.supabase.co');

// Cookie helpers para device_id (sobrevive borrar caché en algunos casos)
function cookieSet(name, val, days){
  const d = new Date(); d.setTime(d.getTime()+(days*86400000));
  document.cookie = name+'='+encodeURIComponent(val)+';expires='+d.toUTCString()+';path=/;SameSite=Lax';
}
function cookieGet(name){
  const m = document.cookie.match('(?:^|; )'+name+'=([^;]*)');
  return m ? decodeURIComponent(m[1]) : null;
}

function licGetDeviceId(){
  // Priority: localStorage → cookie → sessionStorage → generate NEW
  let id = localStorage.getItem(SK.deviceId)
         || cookieGet('pos_device_id')
         || sessionStorage.getItem(SK.deviceId);
  if(!id){
    const rand = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
    id = 'dev_' + rand.replace(/-/g,'').slice(0, 20);
  }
  // Persistir en todas las capas
  localStorage.setItem(SK.deviceId, id);
  cookieSet('pos_device_id', id, 365); // cookie dura 1 año
  sessionStorage.setItem(SK.deviceId, id);
  if(typeof db !== 'undefined' && db){
    try { db.config.put({key:'device_id', value:id}); } catch(e){ console.warn('[licencia] Error persistiendo device_id en IndexedDB:', e.message); }
  }
  return id;
}

async function licGetDeviceIdAsync(){
  // 1. Try fastest layers first
  let id = localStorage.getItem(SK.deviceId) || sessionStorage.getItem(SK.deviceId);
  if(id) return id;

  // 2. Try cookie — survives localStorage.clear() in most browsers
  if(!id) id = cookieGet('pos_device_id');
  if(id){
    localStorage.setItem(SK.deviceId, id);
    sessionStorage.setItem(SK.deviceId, id);
    return id;
  }

  // 3. Try IndexedDB — survives localStorage.clear()
  try {
    if(typeof db !== 'undefined' && db){
      const row = await db.config.get('device_id');
      if(row && row.value){
        id = row.value;
        localStorage.setItem(SK.deviceId, id);
        cookieSet('pos_device_id', id, 365);
        sessionStorage.setItem(SK.deviceId, id);
        return id;
      }
    }
  } catch(e){ console.warn('[licencia] Error leyendo device_id de IndexedDB:', e.message); }

  // 3. No ID found anywhere — generate a NEW unique one for THIS device
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
  id = 'dev_' + rand.replace(/-/g,'').slice(0, 20);

  // Persist everywhere
  localStorage.setItem(SK.deviceId, id);
  sessionStorage.setItem(SK.deviceId, id);
  if(typeof db !== 'undefined' && db){
    try { db.config.put({key:'device_id', value:id}); } catch(e){ console.warn('[licencia] Error persistiendo device_id en IndexedDB:', e.message); }
  }
  return id;
}
function licIsActivated(){ return !!localStorage.getItem(SK.activated); }

async function licActivar(email,clave){
  const claveUp=clave.toUpperCase().trim();
  if(!email||!email.includes('@')) return {ok:false,error:'Email invalido'};
  if(!claveUp) return {ok:false,error:'Ingresa la clave de licencia'};
  if(USAR_DEMO){
    await new Promise(r=>setTimeout(r,1200));
    const licData=DEMO_KEYS[claveUp];
    if(!licData) return {ok:false,error:'Clave invalida. (Demo: DEMO-2025-XXXX)'};
    const token='tk_demo_'+btoa(email+':'+claveUp).replace(/=/g,'').substring(0,24);
    return {ok:true,token,email,plan:licData.plan,vence:licData.vence};
  }
  try {
    console.log('[Licencia] Activando con Supabase...', claveUp);
    const data=await supaRPC('activar_licencia',{p_clave:claveUp,p_email:email,p_device_id:licGetDeviceId()});
    console.log('[Licencia] Respuesta Supabase:', data);
    if(!data.ok) return {ok:false,error:data.error||'Error al activar'};
    return {ok:true,token:data.token,email,plan:data.plan,vence:data.vence};
  } catch(e){
    console.error('[Licencia] Error Supabase:', e.message);
    return {ok:false,error:'Error de conexion: '+e.message};
  }
}

function licGuardar(data){
  localStorage.setItem(SK.activated,'1');
  localStorage.setItem(SK.token,data.token);
  localStorage.setItem(SK.email,data.email);
  localStorage.setItem(SK.plan,data.plan);
  localStorage.setItem(SK.vence,data.vence);
  localStorage.setItem(SK.fallos,'0');
  localStorage.setItem(SK.nextCheck,String(Date.now()+24*60*60*1000));
  // Guardar email en cookie como backup para auto-recuperación offline.
  // Si se borra el localStorage, licInit puede leer el email desde aquí
  // y usarlo como fallback mientras no haya internet.
  cookieSet('pos_email_bk', data.email, 730); // 2 años
}

function licSetNegocio(nombre){
  localStorage.setItem(SK.negocio,nombre);
  if(typeof configData!=='undefined') configData.negocio=nombre;
  if(db) dbSaveConfig('negocio',nombre);
}

function licGetTerminal(){
  return localStorage.getItem('pos_terminal') || 'Terminal 1';
}

async function licVerificarServidor(){
  if(USAR_DEMO){ await new Promise(r=>setTimeout(r,400)); return true; }
  const email=localStorage.getItem(SK.email);
  if(!email) return false;
  const data=await supaRPC('verificar_licencia',{p_device_id:licGetDeviceId(),p_email:email});
  return data.activa===true;
}

async function licCheckPeriodico(){
  if(!licIsActivated()) return;
  const next=parseInt(localStorage.getItem(SK.nextCheck)||'0');
  if(Date.now()<next) return;
  await licVerificarAhora();
}

// Verificación forzada — llama al servidor sin importar el timer
async function licVerificarAhora(){
  if(!licIsActivated()) return false;
  if(!navigator.onLine) return true; // sin internet, tolerar
  try {
    const activa=await licVerificarServidor();
    if(!activa){
      localStorage.removeItem(SK.activated);
      licMostrarBloqueo('SUSPENDIDA');
      return false;
    }
    // Verificación exitosa: resetear timer y fallos
    localStorage.setItem(SK.nextCheck, String(Date.now()+24*60*60*1000));
    localStorage.setItem(SK.fallos,'0');
    return true;
  } catch(e){
    // Error de red — siempre tolerar, nunca bloquear por falta de internet
    const fallos=parseInt(localStorage.getItem(SK.fallos)||'0')+1;
    localStorage.setItem(SK.fallos,String(fallos));
    console.warn('[Licencia] Fallo #'+fallos+': '+e.message);
    // Solo bloquear si hay muchos fallos Y hay internet (error real, no de red)
    if(fallos>=5 && navigator.onLine) licMostrarBloqueo('SIN_CONEXION');
    return true; // siempre dejar pasar si es error de conectividad
  }
}

function licMostrarBloqueo(motivo){
  const msgs={
    'SUSPENDIDA':{t:'Licencia suspendida',s:'Tu licencia fue suspendida. Contacta al soporte.',i:''},
    'SIN_CONEXION':{t:'Sin verificacion',s:'No se pudo verificar por 3 dias. Verifica tu internet.',i:''},
    'VENCIDA':{t:'Licencia vencida',s:'Tu periodo vencio. Renova tu licencia para continuar.',i:''},
  };
  const m=msgs[motivo]||msgs['SUSPENDIDA'];
  document.getElementById('bloqueoTitulo').textContent=m.t;
  document.getElementById('bloqueoSub').textContent=m.s;
  document.getElementById('bloqueoInfo').textContent=m.i;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); ['scActivacion','scActivado','scBloqueado'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  document.getElementById('scBloqueado').style.display='flex';
}

// ══════════════════════════════════════════════════════════════════════════════
// licInit — punto de entrada de la verificación de licencia al arrancar.
//
// FLUJO MEJORADO — auto-recuperación sin re-registro:
//
//   CASO 1 — Normal (localStorage intacto):
//     lic_activated presente → arrancar directo, verificar en background.
//
//   CASO 2 — Caché borrada / app reinstalada (localStorage perdido):
//     lic_activated ausente, PERO el device_id puede sobrevivir en:
//       a) Cookie (dura 1 año, sobrevive borrar caché en Android/Chrome)
//       b) IndexedDB (sobrevive borrar caché si no se borró storage completo)
//     Si hay device_id → consultar activaciones en Supabase.
//     Si Supabase confirma que ese device está activo → restaurar todo
//     automáticamente SIN pedirle nada al usuario.
//     Si no hay device_id O Supabase dice que no está → pedir registro.
//
//   CASO 3 — Sin internet:
//     Usar lo que haya en localStorage/cookies sin verificar.
//     Si no hay nada en ninguna capa → mostrar pantalla de activación.
//
// PRINCIPIO:
//   Una vez que un dispositivo fue registrado, NUNCA debe pedir registro
//   de nuevo salvo que el proveedor (super-admin) lo deshabilite
//   seteando activaciones.activa = false.
// ══════════════════════════════════════════════════════════════════════════════
async function licInit(){

  // ── CASO 1: localStorage intacto — flujo normal ──────────────────────────
  if(licIsActivated()){
    const neg = localStorage.getItem(SK.negocio);
    if(neg && typeof configData !== 'undefined') configData.negocio = neg;

    if(navigator.onLine){
      // Verificar en background sin bloquear el arranque
      licVerificarAhora().catch(e => console.warn('[Licencia] Verificación background:', e.message));
      // Recuperar config de terminal si se perdió (sin re-registro)
      if(!localStorage.getItem('pos_terminal') || !localStorage.getItem('pos_sucursal')){
        try{
          await licGetDeviceIdAsync();
          const cfg = await recuperarConfigTerminalSupabase();
          if(cfg){
            aplicarConfigTerminal(cfg);
            console.log('[licInit] Terminal recuperada:', cfg.terminal, '/', cfg.sucursal);
          }
        }catch(e){ console.warn('[licInit] No se pudo recuperar config:', e.message); }
      }
    } else {
      licCheckPeriodico().catch(function(e){ console.warn('[Licencia] Error en check periódico:', e.message); });
    }
    return true;
  }

  // ── CASO 2: localStorage perdido — intentar auto-recuperar ───────────────
  // El device_id puede sobrevivir en cookie o IndexedDB aunque se borre
  // el localStorage. Si lo encontramos, consultamos Supabase.
  console.log('[licInit] localStorage sin activación — buscando device_id en otras capas...');

  // Mostrar pantalla de carga mientras intentamos recuperar
  licMostrarRecuperando();

  let recuperado = false;

  if(navigator.onLine){
    try{
      // Intentar recuperar el device_id desde cookie o IndexedDB
      const deviceId = await licGetDeviceIdAsync();
      console.log('[licInit] device_id encontrado:', deviceId ? deviceId.substring(0,12)+'...' : 'ninguno');

      if(deviceId){
        // Consultar activaciones por device_id directamente
        const rows = await supaGet('activaciones',
            'device_id=eq.' + encodeURIComponent(deviceId)
            + '&activa=eq.true'
            + '&select=email,nombre_negocio,nombre_terminal,sucursal,licencia_id,modo'
            + '&limit=1');

        {
          const activ = Array.isArray(rows) && rows[0] ? rows[0] : null;

          if(activ && activ.email){
            console.log('[licInit] ✓ Dispositivo reconocido en Supabase — restaurando sesión...');
            console.log('[licInit]   Email:', activ.email, '| Terminal:', activ.nombre_terminal, '| Modo:', activ.modo);

            // Restaurar datos de licencia en localStorage
            // El token lo regeneramos desde Supabase o usamos un placeholder seguro
            const tokenData = await supaRPC('verificar_licencia', {
              p_device_id: deviceId,
              p_email:     activ.email,
            });

            if(tokenData && tokenData.activa){
              // Restaurar todas las claves SK
              localStorage.setItem(SK.activated, '1');
              localStorage.setItem(SK.email,     activ.email);
              localStorage.setItem(SK.token,     tokenData.token || 'restored_' + deviceId.slice(0,8));
              localStorage.setItem(SK.plan,      tokenData.plan  || 'Basico');
              localStorage.setItem(SK.vence,     tokenData.vence || '');
              localStorage.setItem(SK.fallos,    '0');
              localStorage.setItem(SK.nextCheck, String(Date.now() + 24*60*60*1000));

              // Restaurar datos del negocio
              if(activ.nombre_negocio){
                localStorage.setItem(SK.negocio, activ.nombre_negocio);
                if(typeof configData !== 'undefined') configData.negocio = activ.nombre_negocio;
              }

              // Restaurar datos de terminal
              if(activ.nombre_terminal) localStorage.setItem('pos_terminal', activ.nombre_terminal);
              if(activ.sucursal)        localStorage.setItem('pos_sucursal', activ.sucursal);
              if(activ.licencia_id)     { localStorage.setItem('ali', String(activ.licencia_id)); cookieSet('ali', String(activ.licencia_id), 365); }
              if(activ.modo)            localStorage.setItem('pos_modo_terminal', activ.modo);

              // Intentar recuperar config completa (deposito_id, sucursal_id, etc.)
              try{
                const cfg = await recuperarConfigTerminalSupabase();
                if(cfg) aplicarConfigTerminal(cfg);
              }catch(e){ console.warn('[licInit] Error recuperando config terminal:', e.message); }

              recuperado = true;
              console.log('[licInit] ✓ Sesión restaurada automáticamente — sin re-registro');
            } else {
              console.warn('[licInit] Supabase dice que la licencia no está activa para este device');
            }
          } else {
            console.warn('[licInit] device_id no encontrado en activaciones o inactivo');
          }
        }
      }
    } catch(e){
      console.warn('[licInit] Error al intentar auto-recuperar:', e.message);
      // No bloquear: si falla la red, caer al caso 3 (sin internet)
    }
  } else {
    // ── CASO 3: Sin internet y sin localStorage ─────────────────────────────
    // Intentar usar lo que quede en cookie/sessionStorage como fallback mínimo
    const emailCookie = cookieGet('pos_email_bk'); // guardado al activar
    if(emailCookie){
      console.warn('[licInit] Sin internet — usando email desde cookie como fallback offline');
      localStorage.setItem(SK.email, emailCookie);
      // NO marcamos como activated — al conectarse verificará correctamente
    }
  }

  // Ocultar pantalla de recuperación
  licOcultarRecuperando();

  if(recuperado){
    // Restauración exitosa — arrancar normalmente
    return true;
  }

  // No se pudo recuperar — mostrar pantalla de activación
  console.log('[licInit] No se pudo recuperar sesión — mostrando pantalla de activación');
  document.getElementById('scActivacion').style.display = 'flex';
  return false;
}

// ── Pantalla de "Recuperando sesión..." (mientras se consulta Supabase) ──────
// Evita que el usuario vea brevemente la pantalla de activación antes
// de que la auto-recuperación termine.
function licMostrarRecuperando(){
  // Reutilizar scBloqueado con mensaje diferente, o crear overlay simple
  const overlay = document.getElementById('licRecuperandoOverlay');
  if(overlay){ overlay.style.display = 'flex'; return; }
  // Crear el overlay si no existe
  const div = document.createElement('div');
  div.id = 'licRecuperandoOverlay';
  div.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:10000', 'background:#1a1a1a',
    'display:flex', 'flex-direction:column', 'align-items:center',
    'justify-content:center', 'gap:16px',
  ].join(';');
  div.innerHTML = [
    '<div style="width:48px;height:48px;border-radius:50%;border:3px solid #2a2a2a;',
    'border-top-color:#4caf50;animation:lic-spin .8s linear infinite;"></div>',
    '<p style="color:#666;font-size:14px;font-family:Barlow,sans-serif;">',
    'Verificando dispositivo...</p>',
  ].join('');
  document.body.appendChild(div);
}

function licOcultarRecuperando(){
  const overlay = document.getElementById('licRecuperandoOverlay');
  if(overlay) overlay.style.display = 'none';
}

async function doActivar(){
  const email=document.getElementById('licEmail').value.trim();
  const clave=document.getElementById('licClave').value.trim();
  const btn=document.getElementById('licActivarBtn');
  const errEl=document.getElementById('licError');
  errEl.style.display='none';
  if(!email){licShowError('Ingresa tu email');return;}
  if(clave.length < 5){licShowError('Ingresa la clave de licencia');return;}
  btn.disabled=true;
  btn.style.background='#333';
  btn.innerHTML='<div style="width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;animation:lic-spin .8s linear infinite;display:inline-block;margin-right:8px;vertical-align:middle;"></div> Verificando...';
  const res=await licActivar(email,clave);
  if(!res.ok){
    btn.disabled=false;
    btn.style.background='#4caf50';
    btn.innerHTML='ACTIVAR';
    licShowError(res.error); return;
  }
  licGuardar(res);
  document.getElementById('scActivacion').style.display='none';
  document.getElementById('activadoPlan').textContent='Plan '+res.plan;
  document.getElementById('activadoSub').textContent='Licencia activa hasta '+res.vence+'. Bienvenido.';
  document.getElementById('activadoNegocio').value='';
  // Mostrar spinner mientras buscamos config previa
  const btnEntrar = document.getElementById('scActivado');
  // Intentar recuperar config de ESTE dispositivo específico
  try{
    const deviceId = await licGetDeviceIdAsync();
    const cfg = await recuperarConfigTerminalSupabase(); // ya usa el deviceId correcto
    if(cfg && cfg.terminal && cfg.sucursal){
      // ✅ Este dispositivo ya fue configurado antes — entrar directo
      aplicarConfigTerminal(cfg);
      console.log('[Activar] Terminal restaurada:', cfg.terminal, '/', cfg.sucursal);
      document.getElementById('scActivado').style.display='none';
      await iniciarApp();
      return;
    }
  }catch(e){ console.warn('[Activar] No se pudo recuperar config:', e.message); }
  // Este dispositivo no tiene config → mostrar formulario de setup
  // Pre-llenar nombre del negocio si lo tenemos
  const negGuardado = localStorage.getItem(SK.negocio);
  if(negGuardado) document.getElementById('activadoNegocio').value = negGuardado;
  document.getElementById('scActivado').style.display='flex';
}

function licShowError(msg){
  const el=document.getElementById('licError');
  if(!el) return;
  el.textContent=msg;
  el.style.display='block';
}

async function doEntrar(){
  const negocio  = document.getElementById('activadoNegocio').value.trim();
  const terminal = document.getElementById('activadoTerminal').value.trim() || 'Terminal 1';
  const sucursal = document.getElementById('activadoSucursal').value.trim() || 'Principal';
  const deposito = document.getElementById('activadoDeposito').value.trim() || 'Depósito Principal';

  if(!negocio){ alert('Ingresá el nombre del negocio'); return; }
  if(!sucursal){ alert('Ingresá el nombre de la sucursal'); return; }

  licSetNegocio(negocio);

  // Guardar todo localmente
  localStorage.setItem('pos_terminal', terminal);
  localStorage.setItem('pos_sucursal', sucursal);
  localStorage.setItem('pos_deposito', deposito);
  cookieSet('pos_terminal', terminal, 365);
  cookieSet('pos_sucursal', sucursal, 365);
  cookieSet('pos_deposito', deposito, 365);
  if(db){
    await dbSaveConfig('terminal', terminal);
    await dbSaveConfig('sucursal', sucursal);
    await dbSaveConfig('deposito', deposito);
  }
  if(typeof configData !== 'undefined'){
    configData.terminal = terminal;
    configData.sucursal = sucursal;
    configData.deposito = deposito;
  }

  // Crear sucursal + depósito en Supabase
  if(!USAR_DEMO){
    try {
      // Primero actualizar activación
      await supaRPC('actualizar_activacion', {
        p_device_id: licGetDeviceId(),
        p_email:     localStorage.getItem(SK.email),
        p_negocio:   negocio,
        p_terminal:  terminal,
        p_sucursal:  sucursal,
      });
      // Obtener licencia_id desde activaciones
      const activ = await supaFetch('GET', 'activaciones?device_id=eq.'+licGetDeviceId()+'&select=licencia_id');
      const activData = await activ.json();
      if(activData && activData[0]){
        const licId = activData[0].licencia_id;
        // Crear sucursal y depósito (si no existe ya)
        const result = await supaRPC('crear_sucursal', {
          p_licencia_id: licId,
          p_nombre:      sucursal,
          p_direccion:   '',
          p_deposito:    deposito,
        });
        if(result && result.sucursal_id){
          localStorage.setItem('pos_sucursal_id', result.sucursal_id);
          localStorage.setItem('pos_deposito_id', result.deposito_id);
          if(db){
            await dbSaveConfig('sucursal_id', String(result.sucursal_id));
            await dbSaveConfig('deposito_id', String(result.deposito_id));
          }
          console.log('[Setup] Sucursal ID:', result.sucursal_id, '| Depósito ID:', result.deposito_id);
        }
      }
    } catch(e){ console.warn('[Setup Supabase]', e.message); toast('Error al configurar en servidor: '+e.message); }
  }

  await licGetDeviceIdAsync();
  await guardarConfigTerminalSupabase({negocio, terminal, sucursal, deposito});
  if(typeof db!=='undefined'&&db){
    try{await db.config.put({key:'terminal_cfg',value:JSON.stringify({negocio,terminal,sucursal,deposito})});}catch(e){ console.warn('[licencia] Error guardando config en IndexedDB:', e.message); }
  }
  document.getElementById('scActivado').style.display='none';
  await iniciarApp();
}

async function doReintentar(){
  try {
    const activa=await licVerificarServidor();
    if(activa){
      localStorage.setItem(SK.fallos,'0');
      localStorage.setItem(SK.activated,'1');
      localStorage.setItem(SK.nextCheck,String(Date.now()+24*60*60*1000));
      document.getElementById('scBloqueado').style.display='none';
      await iniciarApp();
    } else { licMostrarBloqueo('SUSPENDIDA'); }
  } catch(e){ licMostrarBloqueo('SIN_CONEXION'); }
}

function doContactarSoporte(){
  const msg=encodeURIComponent('Hola, necesito ayuda con mi licencia POS. Email: '+(localStorage.getItem(SK.email)||''));
  window.open('https://wa.me/595XXXXXXXXX?text='+msg,'_blank');
}

function doDesactivar(){
  if(!confirm('Desactivar esta licencia en este dispositivo?')) return;
  Object.values(SK).forEach(k=>localStorage.removeItem(k));
  document.getElementById('scBloqueado').style.display='none';
  document.getElementById('scActivacion').style.display='flex';
}
