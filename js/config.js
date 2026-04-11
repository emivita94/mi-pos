// ── Configuración centralizada ──
// Un solo lugar para credenciales y helpers de Supabase.
// Todos los HTML importan este archivo en vez de declarar sus propias constantes.

const SUPA_URL  = 'https://kmreiniqgcvqgdtzvmel.supabase.co';
const SUPA_ANON = 'sb_publishable_j6btNHo1o3tSprmYUJITPw_8AsYgcvJ';

const SUPA_HEADERS = {
  'apikey':        SUPA_ANON,
  'Authorization': 'Bearer ' + SUPA_ANON,
};

function supaHeaders(extra) {
  return Object.assign({}, SUPA_HEADERS, extra || {});
}

// ── Helpers de fetch para Supabase REST API ──

// GET: supaGet('pos_productos', 'activo=eq.true&order=nombre.asc')
async function supaGet(tabla, query) {
  var url = SUPA_URL + '/rest/v1/' + tabla + (query ? '?' + query : '');
  var r = await fetch(url, {
    headers: supaHeaders({ 'Content-Type': 'application/json', 'Accept': 'application/json' })
  });
  if (!r.ok) {
    var txt = await r.text().catch(function(){ return ''; });
    throw new Error('HTTP ' + r.status + ' en ' + tabla + ': ' + txt.substring(0, 150));
  }
  var d = await r.json();
  return Array.isArray(d) ? d : [];
}

// POST: supaPost('pos_ventas', {datos}, 'on_conflict_col', true) — 4to param = minimal (sin retorno)
async function supaPost(tabla, data, conflictCol, minimal) {
  var url = conflictCol
    ? SUPA_URL + '/rest/v1/' + tabla + '?on_conflict=' + conflictCol
    : SUPA_URL + '/rest/v1/' + tabla;
  var prefer = conflictCol
    ? 'resolution=merge-duplicates,return=' + (minimal ? 'minimal' : 'representation')
    : 'return=' + (minimal ? 'minimal' : 'representation');
  var r = await fetch(url, {
    method: 'POST',
    headers: supaHeaders({ 'Content-Type': 'application/json', 'Prefer': prefer }),
    body: JSON.stringify(data)
  });
  if (minimal) { if (!r.ok) throw new Error('HTTP ' + r.status); return; }
  var txt = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + txt.substring(0, 200));
  try { return JSON.parse(txt); } catch(e) { return []; }
}

// PATCH: supaPatch('pos_productos', 'id=eq.123', {nombre:'nuevo'}, true) — 4to param = minimal
async function supaPatch(tabla, filtro, data, minimal) {
  var r = await fetch(SUPA_URL + '/rest/v1/' + tabla + '?' + filtro, {
    method: 'PATCH',
    headers: supaHeaders({ 'Content-Type': 'application/json', 'Prefer': 'return=' + (minimal ? 'minimal' : 'representation') }),
    body: JSON.stringify(data)
  });
  if (minimal) { if (!r.ok) throw new Error('HTTP ' + r.status); return; }
  var txt = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + txt.substring(0, 200));
  try { return JSON.parse(txt); } catch(e) { return []; }
}

// DELETE: supaDelete('pos_productos', 'id=eq.123')
async function supaDelete(tabla, filtro) {
  var r = await fetch(SUPA_URL + '/rest/v1/' + tabla + '?' + filtro, {
    method: 'DELETE',
    headers: supaHeaders({ 'Prefer': 'return=minimal' })
  });
  if (!r.ok) {
    var txt = await r.text().catch(function(){ return ''; });
    throw new Error('HTTP ' + r.status + ': ' + txt.substring(0, 200));
  }
}

// RPC: supaRPC('nombre_funcion', {param1: 'val'})
async function supaRPC(fn, params) {
  var url = SUPA_URL + '/rest/v1/rpc/' + fn;
  var r = await fetch(url, {
    method: 'POST',
    headers: supaHeaders({ 'Content-Type': 'application/json', 'Accept': 'application/json' }),
    body: JSON.stringify(params)
  });
  var txt = await r.text();
  if (!r.ok) throw new Error('RPC ' + fn + ' HTTP ' + r.status + ': ' + txt.substring(0, 200));
  try { return JSON.parse(txt); } catch(e) { return txt; }
}
