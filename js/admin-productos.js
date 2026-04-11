// ── Admin: Productos, Importación, Catálogo ──

// ── PRODUCTOS ─────────────────────────────────────────────

// ── IMPORTACIÓN DE PRODUCTOS ─────────────────────────────
var _imp = { rows:[], categorias:[], errores:[] };

async function renderImportar(){
  var c = document.getElementById('content');
  c.innerHTML =
    '<div class="ph"><div><div class="pt">Importar productos</div><div class="ps">Subí un Excel con tu catálogo y actualizá masivamente</div></div></div>' +
    '<div class="card" style="margin-bottom:14px">' +
      '<div class="card-h"><span class="card-t">Paso 1 — Descargar plantilla</span></div>' +
      '<div style="padding:16px 18px">' +
        '<p style="font-size:13px;color:var(--muted);margin-bottom:12px;">Completá la planilla con tus productos y guardala como .xlsx o .csv</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
          '<button onclick="descargarPlantilla(\'xlsx\')" style="background:var(--g2);border:1px solid var(--green);border-radius:7px;color:var(--green);font-family:Barlow,sans-serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer;display:flex;align-items:center;gap:7px">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
            'Descargar plantilla Excel' +
          '</button>' +
          '<button onclick="descargarPlantilla(\'csv\')" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;color:var(--muted);font-family:Barlow,sans-serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer">Descargar plantilla CSV</button>' +
        '</div>' +
        '<div style="margin-top:14px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px 14px">' +
          '<div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;">Columnas de la planilla</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px;font-size:12px;">' +
            impColHTML() +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="card" style="margin-bottom:14px">' +
      '<div class="card-h"><span class="card-t">Paso 2 — Subir archivo</span></div>' +
      '<div style="padding:16px 18px">' +
        '<div id="impDropZone" onclick="document.getElementById(\'impFile\').click()" ' +
          'style="border:2px dashed var(--border);border-radius:10px;padding:32px;text-align:center;cursor:pointer;transition:border-color .15s" ' +
          'ondragover="event.preventDefault();this.style.borderColor=\'var(--green)\'" ' +
          'ondragleave="this.style.borderColor=\'var(--border)\'" ' +
          'ondrop="impOnDrop(event)">' +
          '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" style="margin-bottom:10px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
          '<div style="font-size:14px;font-weight:700;color:var(--text2)">Arrastrá tu archivo acá</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-top:4px">o hacé clic para seleccionar</div>' +
        '</div>' +
        '<input type="file" id="impFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="impLeerArchivo(this)">' +
        '<div style="margin-top:10px;font-size:12px;color:var(--muted);text-align:center">💡 Si el archivo tiene columna <code style="background:var(--card2);border:1px solid var(--border);border-radius:3px;padding:1px 5px;color:var(--blue)">id</code>, esas filas se actualizarán. Sin id = producto nuevo.</div>' +
      '</div>' +
    '</div>' +
    '<div id="impPreviewSection" style="display:none">' +
      '<div class="card" style="margin-bottom:14px">' +
        '<div class="card-h">' +
          '<span class="card-t" id="impPreviewTitle">Vista previa</span>' +
          '<div style="display:flex;gap:8px">' +
            '<button onclick="impLimpiar()" style="background:var(--r2);border:1px solid var(--red);border-radius:6px;color:var(--red);font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:7px 13px;cursor:pointer">Cancelar</button>' +
            '<button onclick="impConfirmar()" id="impBtnConfirmar" style="background:var(--green);border:none;border-radius:6px;color:#fff;font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:7px 16px;cursor:pointer">Importar ahora</button>' +
          '</div>' +
        '</div>' +
        '<div id="impErrores" style="display:none;padding:12px 18px;background:rgba(239,83,80,.06);border-bottom:1px solid var(--border)"></div>' +
        '<div style="overflow-x:auto"><table><thead><tr><th>Estado</th><th>ID</th><th>Nombre</th><th>Cat.</th><th>Precio</th><th>Costo</th><th>IVA</th><th>Comanda</th><th>Stock</th></tr></thead><tbody id="impPreviewBody"></tbody></table></div>' +
      '</div>' +
    '</div>' +
    '<div id="impResultSection" style="display:none">' +
      '<div class="card"><div class="card-h"><span class="card-t">Resultado</span></div><div id="impResultBody" style="padding:20px 18px"></div></div>' +
    '</div>';
}

function impColHTML(){
  var cols = [
    {n:'id',              r:false, d:'ID único del producto — usalo para actualizar existentes; vacío = nuevo producto'},
    {n:'nombre',          r:true,  d:'Nombre del producto'},
    {n:'categoria',       r:false, d:'Categoría (ej: Pizzas)'},
    {n:'precio',          r:true,  d:'Precio de venta'},
    {n:'costo',           r:false, d:'Costo de compra'},
    {n:'iva',             r:false, d:'IVA: 10, 5 o exento'},
    {n:'stock',           r:false, d:'Stock inicial'},
    {n:'stock_min',       r:false, d:'Stock mínimo alerta'},
    {n:'comanda',         r:false, d:'Va a cocina: SI o NO'},
    {n:'precio_variable', r:false, d:'Precio variable: SI o NO'},
    {n:'codigo',          r:false, d:'Código de barras'},
    {n:'color',           r:false, d:'Color hex (ej: #e53935)'},
  ];
  return cols.map(function(c){
    return '<div style="display:flex;align-items:flex-start;gap:6px;padding:4px 0">' +
      '<code style="background:var(--card);border:1px solid var(--border);border-radius:3px;padding:1px 5px;font-size:11px;flex-shrink:0;color:'+(c.r?'var(--green)':'var(--blue)')+'">'+c.n+'</code>' +
      '<span style="color:var(--muted)">'+c.d+(c.r?' <span style="color:var(--red)">*</span>':'')+'</span>' +
    '</div>';
  }).join('');
}

function descargarPlantilla(tipo){
  var headers = ['id','nombre','categoria','precio','costo','iva','stock','stock_min','comanda','precio_variable','codigo','color'];
  var ej1 = ['','PIZZA MUZZA','Pizzas','65000','25000','10','50','5','SI','NO','','#e53935'];
  var ej2 = ['','COCA COLA','Bebidas','8000','4000','10','100','10','NO','NO','7891234567890','#1565c0'];

  if(tipo === 'csv'){
    var csv = headers.join(',') + '\n' + ej1.join(',') + '\n' + ej2.join(',');
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    var a    = document.createElement('a');
    a.href   = URL.createObjectURL(blob);
    a.download = 'plantilla_productos.csv'; a.click();
    return;
  }
  // XLSX via SheetJS
  if(typeof XLSX !== 'undefined'){
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([headers, ej1, ej2]);
    ws['!cols'] = headers.map(function(){return {wch:18};});
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'plantilla_productos.xlsx');
  } else {
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload=function(){ descargarPlantilla('xlsx'); };
    document.head.appendChild(s);
  }
}

function impOnDrop(e){
  e.preventDefault();
  document.getElementById('impDropZone').style.borderColor='var(--border)';
  if(e.dataTransfer.files[0]) impProcesarArchivo(e.dataTransfer.files[0]);
}

function impLeerArchivo(input){
  if(input.files[0]) impProcesarArchivo(input.files[0]);
  input.value='';
}

async function impProcesarArchivo(file){
  var dz=document.getElementById('impDropZone');
  if(dz) dz.innerHTML='<div style="color:var(--muted);font-size:13px">Procesando '+file.name+'...</div>';
  try{
    var rows=[];
    var ext=file.name.split('.').pop().toLowerCase();
    if(ext==='csv'){
      var txt=await file.text();
      rows=impParsearCSV(txt);
    } else {
      if(typeof XLSX==='undefined'){
        await new Promise(function(res,rej){
          var s=document.createElement('script');
          s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
          s.onload=res; s.onerror=rej; document.head.appendChild(s);
        });
      }
      var buf=await file.arrayBuffer();
      var wb=XLSX.read(buf,{type:'array'});
      var ws=wb.Sheets[wb.SheetNames[0]];
      rows=XLSX.utils.sheet_to_json(ws,{raw:false,defval:''});
    }
    if(!rows.length){ toast('El archivo está vacío'); impReset(); return; }
    impValidarYMostrar(rows);
  }catch(e){ toast('Error al leer: '+e.message); impReset(); }
}

function impParsearCSV(txt){
  var lines=txt.split(/\r?\n/).filter(function(l){return l.trim();});
  if(lines.length<2) return [];
  var hdr=lines[0].split(',').map(function(h){return h.trim().toLowerCase().replace(/"/g,'');});
  return lines.slice(1).map(function(line){
    var vals=line.split(',').map(function(v){return v.trim().replace(/^"|"$/g,'');});
    var obj={};
    hdr.forEach(function(h,i){obj[h]=vals[i]||'';});
    return obj;
  });
}

function impValidarYMostrar(rows){
  _imp.rows=[]; _imp.errores=[];
  var gv=function(r){
    // obtener valor de una columna tolerando mayúsculas
    for(var k in r){ if(k===arguments[1]||k.toLowerCase()===arguments[1]) return r[k]; }
    return '';
  };
  var validados=rows.map(function(row,idx){
    var fila=idx+2;
    var id=parseInt((row.id||row.Id||row.ID||'').toString().trim())||null;
    var nombre=(row.nombre||row.Nombre||row.NOMBRE||'').toString().trim();
    var precioStr=(row.precio||row.Precio||row.PRECIO||'0').toString().replace(/\s/g,'').replace(',','.');
    var precio=parseFloat(precioStr)||0;
    var errFila=[];
    if(!nombre) errFila.push('Falta nombre');
    // Con ID (UPDATE): precio 0 es válido (no se sobreescribe si no querés)
    // Sin ID (INSERT): precio es obligatorio
    if(!id && precio<=0 && !pv) errFila.push('Precio inválido (requerido para productos nuevos)');
    var iva=(row.iva||row.IVA||row.Iva||'10').toString().trim().toLowerCase();
    if(!['10','5','exento','0'].includes(iva)) iva='10';
    if(iva==='0') iva='exento';
    var comanda=(row.comanda||row.Comanda||'').toString().trim().toUpperCase();
    comanda=comanda==='SI'||comanda==='SÍ'||comanda==='1'||comanda==='TRUE';
    var pv=(row.precio_variable||row.precioVariable||'').toString().trim().toUpperCase();
    pv=pv==='SI'||pv==='SÍ'||pv==='1'||pv==='TRUE';
    var stock=parseInt((row.stock||row.Stock||'0').toString())||0;
    var stockMin=parseInt((row.stock_min||row.stockMin||row.stock_minimo||'0').toString())||0;
    var costo=parseFloat((row.costo||row.Costo||'0').toString().replace(',','.'))||0;
    var cat=(row.categoria||row.Categoria||row.CATEGORIA||'Sin categoría').toString().trim()||'Sin categoría';
    var cod=(row.codigo||row.Codigo||row.CODIGO||'').toString().trim();
    var col=(row.color||row.Color||'').toString().trim()||'';
    if(errFila.length) _imp.errores.push('Fila '+fila+': '+errFila.join(', '));
    return {_fila:fila,_valido:errFila.length===0,_errores:errFila,_esUpdate:!!id,
      id,nombre,categoria:cat,precio:pv?0:precio,costo,iva,comanda,precio_variable:pv,
      stock,stock_min:stockMin,codigo:cod,color:col};
  });
  _imp.rows=validados;
  var total=validados.length, validos=validados.filter(function(r){return r._valido;}).length, inv=total-validos;
  var updates=validados.filter(function(r){return r._valido&&r._esUpdate;}).length;
  var nuevos=validos-updates;
  document.getElementById('impPreviewSection').style.display='block';
  document.getElementById('impPreviewTitle').textContent=
    total+' productos · '+
    (updates?updates+' UPDATE · ':'')+
    (nuevos?nuevos+' NUEVO · ':'')+
    (inv?inv+' con error':'').replace(/ · $/,'');
  if(_imp.errores.length){
    var ed=document.getElementById('impErrores');
    ed.style.display='block';
    ed.innerHTML='<div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:6px;">'+_imp.errores.length+' filas con errores (no se importarán):</div>'+
      _imp.errores.slice(0,5).map(function(e){return '<div style="font-size:12px;color:var(--red)">• '+e+'</div>';}).join('')+
      (_imp.errores.length>5?'<div style="font-size:12px;color:var(--muted)">... y '+(_imp.errores.length-5)+' más</div>':'');
  }
  document.getElementById('impPreviewBody').innerHTML=validados.map(function(r){
    var est=r._valido
      ?(r._esUpdate
        ?'<span style="color:var(--blue);font-size:11px;font-weight:700">UPDATE</span>'
        :'<span style="color:var(--green);font-size:11px;font-weight:700">NUEVO</span>')
      :'<span style="color:var(--red);font-size:11px;font-weight:700" title="'+r._errores.join(', ')+'">Error</span>';
    return '<tr style="opacity:'+(r._valido?'1':'.5')+'">'+
      '<td>'+est+'</td>'+
      '<td style="font-size:11px;color:'+(r._esUpdate?'var(--blue)':'var(--muted)')+'">'+
        (r._esUpdate?'#'+r.id:'—')+'</td>'+
      '<td style="font-weight:600">'+r.nombre+'</td>'+
      '<td>'+r.categoria+'</td>'+
      '<td style="text-align:right;font-weight:700">'+(r.precio_variable?'<span style="color:var(--orange)">Variable</span>':gs(r.precio))+'</td>'+
      '<td style="text-align:right">'+(r.costo?gs(r.costo):'—')+'</td>'+
      '<td><span class="tag tag-gr">IVA '+(r.iva==='exento'?'Exento':r.iva+'%')+'</span></td>'+
      '<td style="text-align:center">'+(r.comanda?'<span style="color:var(--green)">SI</span>':'NO')+'</td>'+
      '<td style="text-align:center">'+(r.stock||'—')+'</td>'+
    '</tr>';
  }).join('');
  var btn=document.getElementById('impBtnConfirmar');
  if(btn){btn.disabled=validos===0;btn.style.opacity=validos===0?'.4':'1';}
  impReset();
  document.getElementById('impResultSection').style.display='none';
}

function impReset(){
  var dz=document.getElementById('impDropZone');
  if(!dz) return;
  dz.innerHTML='<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" style="margin-bottom:10px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'+
    '<div style="font-size:14px;font-weight:700;color:var(--text2)">Arrastrá tu archivo acá</div>'+
    '<div style="font-size:12px;color:var(--muted);margin-top:4px">o hacé clic para seleccionar</div>';
}

function impLimpiar(){
  _imp.rows=[];_imp.errores=[];
  document.getElementById('impPreviewSection').style.display='none';
  document.getElementById('impResultSection').style.display='none';
  document.getElementById('impErrores').style.display='none';
  impReset();
}

async function sincronizarCategorias(nombresCateg){
  // Traer categorías existentes
  try{
    var existentes=await sg('pos_categorias','licencia_email=ilike.'+encodeURIComponent(SE)+'&select=id,nombre&order=id.desc&limit=500');
    var nombresExistentes=existentes.map(function(c){return (c.nombre||'').toUpperCase();});
    var maxCatId=existentes.length?Math.max.apply(null,existentes.map(function(c){return c.id||0;})):0;

    // Filtrar solo las categorías nuevas
    var nuevas=nombresCateg.filter(function(n){
      return n && n!=='SIN CATEGORÍA' && !nombresExistentes.includes(n.toUpperCase());
    });
    // Deduplicar
    nuevas=nuevas.filter(function(n,i,arr){return arr.indexOf(n)===i;});
    if(!nuevas.length){console.log('[Import] Sin categorías nuevas');return;}

    var colores=['#e53935','#8e24aa','#1e88e5','#00897b','#f57c00','#6d4c41','#546e7a','#43a047','#c0ca33','#fdd835'];
    var ahora=new Date().toISOString();
    var payload=nuevas.map(function(nombre,i){
      return {
        id: maxCatId + 1 + i,
        nombre: nombre,
        color: colores[i % colores.length],
        licencia_email: SE,
        updated_at: ahora
      };
    });
    await supaPost('pos_categorias', payload, 'id');
    console.log('[Import] Categorías creadas:', nuevas);
    toast('✓ Categorías creadas: '+nuevas.join(', '));
  }catch(e){
    console.warn('[Import] Error sincronizando categorías:', e.message);
  }
}

async function impConfirmar(){
  var validos=_imp.rows.filter(function(r){return r._valido;});
  if(!validos.length){toast('Sin productos válidos');return;}
  var btn=document.getElementById('impBtnConfirmar');
  if(btn){btn.disabled=true;btn.textContent='Importando...';}
  var ok=0,err=0,errs=[];
  var lote=20;
  for(var i=0;i<validos.length;i+=lote){
    var batch=validos.slice(i,i+lote);
    // Separar updates de inserts
    var updates=batch.filter(function(r){return r._esUpdate;});
    var inserts=batch.filter(function(r){return !r._esUpdate;});
    try{
      // UPDATE uno a uno por id
      for(var j=0;j<updates.length;j++){
        var r=updates[j];
        // Construir objeto de update — si precio es 0, no sobreescribir el precio actual
        var upd={nombre:r.nombre.toUpperCase(),categoria:r.categoria,
          precio_variable:r.precio_variable,iva:r.iva,comanda:r.comanda,
          updated_at:new Date().toISOString()};
        if(r.precio>0) upd.precio=r.precio;
        if(r.costo>0) upd.costo=r.costo;
        if(r.codigo) upd.codigo=r.codigo;
        if(r.color) upd.color=r.color;
        await supaPatch('pos_productos','id=eq.'+r.id+'&licencia_email=ilike.'+encodeURIComponent(SE),upd);
        ok++;
      }
      // INSERT: primero obtener el MAX id actual para generar IDs correlativos
      if(inserts.length){
        // Obtener el id máximo actual de la tabla para este licencia
        var maxRow=await sg('pos_productos','select=id&order=id.desc&limit=1');
        var maxId=maxRow.length && maxRow[0].id ? parseInt(maxRow[0].id) : 0;
        var nextId=maxId + 1;
        console.log('[Import] maxRow:', JSON.stringify(maxRow), '→ nextId:', nextId);
        var ahora=new Date().toISOString();
        var payload=inserts.map(function(r,ri){
          return {
            id: nextId + ri,
            nombre:r.nombre.toUpperCase(),
            categoria:r.categoria||'Sin categoría',
            precio:r.precio||0,
            precio_variable:r.precio_variable||false,
            costo:r.costo||0,
            iva:r.iva||'10',
            comanda:r.comanda||false,
            codigo:r.codigo||'',
            color:r.color||'#546e7a',
            activo:true,
            licencia_email:SE,
            updated_at:ahora
          };
        });
        console.log('[Import] payload[0]:', JSON.stringify(payload[0]));
        await supaPost('pos_productos',payload,'id');
        ok+=inserts.length;
      }
    }catch(e){err+=batch.length;errs.push(e.message.substring(0,200));console.error('[Import error]',e.message);}
    if(btn) btn.textContent='Importando '+ok+'/'+validos.length+'...';
  }
  document.getElementById('impPreviewSection').style.display='none';
  document.getElementById('impResultSection').style.display='block';
  document.getElementById('impResultBody').innerHTML=
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">'+
      '<div style="width:52px;height:52px;border-radius:50%;background:'+(err?'var(--o2)':'var(--g2)')+';display:flex;align-items:center;justify-content:center;font-size:24px">'+(err?'⚠':'✓')+'</div>'+
      '<div><div style="font-size:18px;font-weight:800;color:var(--text)">'+(err===0?'Importación completa':'Importación con errores')+'</div>'+
      '<div style="font-size:13px;color:var(--muted)">'+ok+' importados'+(err?' · '+err+' fallaron':'')+'</div></div>'+
    '</div>'+
    (err?'<div style="background:var(--r2);border:1px solid var(--red);border-radius:8px;padding:12px;font-size:12px;color:var(--red);margin-bottom:14px">'+errs.join('<br>')+'</div>':'')+
    '<div style="display:flex;gap:8px">'+
      '<button onclick="impLimpiar()" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;color:var(--text2);font-family:Barlow,sans-serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer">Nueva importación</button>'+
      '<button onclick="goTo(\'productos\')" style="background:var(--green);border:none;border-radius:7px;color:#fff;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer">Ver productos</button>'+
    '</div>';
  // Sincronizar categorías nuevas en pos_categorias
  var categsImportadas=validos.map(function(r){return (r.categoria||'').toUpperCase();})
    .filter(function(c,i,arr){return c&&c!=='SIN CATEGORÍA'&&arr.indexOf(c)===i;});
  if(categsImportadas.length) await sincronizarCategorias(categsImportadas);

  _imp.rows=[];
  if(btn){btn.disabled=false;btn.textContent='Importar ahora';}
  try{allPrds=await sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&order=nombre.asc&limit=500');}catch(e){ console.warn('[Import] Error recargando productos:', e.message); }
}

async function renderProductos(){
  document.getElementById('content').innerHTML='<div class="ph"><div><div class="pt">Productos</div><div class="ps">Catálogo sincronizado</div></div><div class="dbar"><button onclick="exportarCatalogo()" style="background:var(--b2);border:1px solid var(--blue);border-radius:7px;color:var(--blue);font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Exportar con IDs</button><button onclick="goTo(\'importar\')" style="background:var(--g2);border:1px solid var(--green);border-radius:7px;color:var(--green);font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Importar</button></div></div><div class="card"><div class="card-h"><span class="card-t" id="pCount">—</span><input class="c-srch" placeholder="Buscar..." oninput="filtrP(this.value)"></div><table><thead><tr><th>Producto</th><th>Categoría</th><th>IVA</th><th style="text-align:right">Precio</th></tr></thead><tbody id="pBody"><tr><td colspan="4" class="loading"><span class="sp"></span></td></tr></tbody></table></div>';
  try{
    allPrds=await sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&order=nombre.asc&limit=500');
    renderPT(allPrds);
  }catch(e){document.getElementById('pBody').innerHTML='<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted)">Sin productos sincronizados</td></tr>';}
}

function renderPT(p){
  if(!document.getElementById('pCount')) return;
  document.getElementById('pCount').textContent=p.length+' productos';
  document.getElementById('pBody').innerHTML=p.length?p.map(function(x){return '<tr><td><div style="display:flex;align-items:center;gap:8px"><div style="width:24px;height:24px;border-radius:5px;background:'+(x.color||'#546e7a')+';flex-shrink:0"></div><span style="font-weight:600">'+x.nombre+'</span></div></td><td>'+(x.categoria||'—')+'</td><td><span class="tag tag-gr">IVA '+(x.iva==='exento'?'Exento':x.iva+'%')+'</span></td><td style="text-align:right;font-weight:700">'+(x.precio_variable?'<span style="color:var(--orange)">Variable</span>':gs(x.precio))+'</td></tr>';}).join(''):'<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">Sin productos</td></tr>';
}

async function exportarCatalogo(){
  toast('Preparando exportación...');
  var prods = allPrds.length ? allPrds : await sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&order=nombre.asc&limit=2000');
  if(!prods.length){ toast('Sin productos para exportar'); return; }
  var headers = ['id','nombre','categoria','precio','costo','iva','stock','stock_min','comanda','precio_variable','codigo','color'];
  var rows = prods.map(function(p){
    return [
      p.id||'',
      p.nombre||'',
      p.categoria||'',
      p.precio||0,
      p.costo||0,
      p.iva||'10',
      p.stock||0,
      p.stock_min||0,
      p.comanda?'SI':'NO',
      p.precio_variable?'SI':'NO',
      p.codigo||'',
      p.color||''
    ];
  });
  if(typeof XLSX !== 'undefined'){
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([headers].concat(rows));
    ws['!cols'] = headers.map(function(h){return {wch:h==='nombre'?30:h==='id'?8:16};});
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'catalogo_productos.xlsx');
    toast('Catálogo exportado con '+prods.length+' productos');
  } else {
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload=function(){ exportarCatalogo(); };
    document.head.appendChild(s);
  }
}

function filtrP(q){if(!allPrds.length) return;var f=q.toLowerCase();renderPT(!q?allPrds:allPrds.filter(function(p){return (p.nombre||'').toLowerCase().includes(f)||(p.categoria||'').toLowerCase().includes(f);}));}
