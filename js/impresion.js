// ── Impresión: tickets, facturas, comandas, térmicas, serial, USB ──

// ══════════════════════════════════════════════════════════════════════════════
// BLOQUE 1: Preview, generación HTML, impresión de tickets/facturas/comandas
// ══════════════════════════════════════════════════════════════════════════════

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
    } catch(e){ /* safe: optional iframe auto-height */ }
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
        try { localStorage.setItem('pos_pendientes', JSON.stringify(pendientes)); } catch(e){ /* safe: pendientes persist best-effort */ }
      }
    }
  }
  imprimirComanda({...ultimoReciboData, items: itemsNoEnviados});
}


// ══════════════════════════════════════════════════════
// IMPRESIÓN TÉRMICA — POS58 / POS80
// ══════════════════════════════════════════════════════

// Guardar último recibo para reimprimir
let ultimoReciboData = null;

// Obtener tamaño de papel configurado
function getPaperSize(tipo){ return (printers[tipo] && printers[tipo].size) || localStorage.getItem('printerSize_'+tipo) || '58'; }

// CSS base para impresión térmica
function getCSSTermico(size){
  const w  = size==='58' ? '58mm' : '80mm';
  const pw = size==='58' ? '48mm' : '72mm';
  const fs = size==='58' ? '8.5pt': '10pt';
  const ss = size==='58' ? '7pt'  : '8pt';
  const ls = size==='58' ? '11pt' : '13pt';
  return `
    @page { size: ${w} auto !important; margin: 0 !important; }
    @media print {
      html, body { width: ${w} !important; margin: 0 !important; padding: 0 !important; }
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    html { width:${w}; }
    body {
      font-family: Arial, "Helvetica Neue", sans-serif;
      font-size: ${fs};
      width: ${pw};
      max-width: ${pw};
      margin: 0 auto;
      padding: 2mm 0;
      background: #fff;
      color: #000;
    }
    p  { margin:0; padding:0; line-height:1.3; }
    .c { text-align:center; }
    .r { text-align:right; }
    .b { font-weight:bold; }
    .s { font-size:${ss}; }
    .l { font-size:${ls}; font-weight:bold; }
    .hr{ border:none; border-top:1px dashed #000; margin:1mm 0; display:block; }
    /* fila dos columnas: izq flexible, der fijo */
    .row { display:flex; justify-content:space-between; align-items:baseline; }
    .row .l1 { flex:1; padding-right:4px; word-break:break-word; }
    .row .l2 { text-align:right; white-space:nowrap; min-width:0; }
    /* fila de item: nombre arriba, nums abajo */
    .it-nom { font-size:${ss}; font-weight:bold; word-break:break-word; }
    .it-det { display:flex; justify-content:space-between; font-size:${ss}; padding-left:2px; }
    .it-det .qty { white-space:nowrap; }
    .it-det .pu  { flex:1; text-align:center; white-space:nowrap; }
    .it-det .sub { white-space:nowrap; font-weight:bold; }
    .obs { font-size:${ss}; padding-left:8px; color:#333; }
    /* item factura: nombre + datos en dos líneas */
    .if-nom { font-size:${ss}; font-weight:bold; word-break:break-word; }
    .if-det { display:flex; justify-content:space-between; font-size:${ss}; padding-left:2px; }
    .if-det span { white-space:nowrap; }
  `;
}

// Abrir ventana e imprimir
function abrirVentanaImpresion(html, size){
  const mmW = size==='58' ? '58mm' : '80mm';
  const pxW = size==='58' ? 230 : 310;

  // Método 1: Blob URL — funciona en PWA Android, Chrome, cualquier contexto
  try{
    const blob = new Blob([html], {type:'text/html'});
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if(win){
      win.onload = function(){
        setTimeout(function(){
          win.focus();
          win.print();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
        }, 400);
      };
      // Fallback si onload no dispara (algunos Android)
      setTimeout(function(){
        try{ win.focus(); win.print(); }catch(e){ /* safe: fallback print attempt, may fail on some browsers */ }
        setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
      }, 1500);
      return;
    }
  }catch(e){ console.warn('[Print] Blob falló:', e.message); toast('Error de impresión: '+e.message); }

  // Método 2: iframe visible temporalmente — funciona cuando window.open bloqueado
  try{
    let iframe = document.getElementById('printFrame');
    if(iframe) iframe.remove();
    iframe = document.createElement('iframe');
    iframe.id = 'printFrame';
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;background:#fff;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(function(){
      try{
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(function(){ iframe.remove(); }, 3000);
      }catch(e2){
        iframe.remove();
        // Método 3: window.print con CSS @media
        _imprimirConCSSMedia(html, mmW);
      }
    }, 800);
    return;
  }catch(e){ console.warn('[Print] iframe falló:', e.message); toast('Error de impresión: '+e.message); }

  // Método 3 directo si todo falla
  _imprimirConCSSMedia(html, mmW);
}

function _imprimirConCSSMedia(html, mmW){
  // Inyectar contenido en página actual con @media print
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const content = bodyMatch ? bodyMatch[1] : html;
  const ticketCss = styleMatch ? styleMatch[1] : '';

  let pd = document.getElementById('_printDiv');
  if(!pd){ pd = document.createElement('div'); pd.id = '_printDiv'; document.body.appendChild(pd); }
  pd.innerHTML = content;

  let ps = document.getElementById('_printStyle');
  if(!ps){ ps = document.createElement('style'); ps.id = '_printStyle'; document.head.appendChild(ps); }
  ps.textContent = '@media print{body>*:not(#_printDiv){display:none!important}#_printDiv{display:block!important}@page{size:'+mmW+' auto;margin:0}}@media screen{#_printDiv{display:none}}' + ticketCss;

  setTimeout(function(){
    window.print();
    setTimeout(function(){ pd.innerHTML=''; ps.textContent=''; }, 3000);
  }, 300);
}

// Formatear número guaraní sin símbolo (para ticket)
function gn(n){ return Math.round(n||0).toLocaleString('es-PY'); }

// Padding derecho para columnas
function padL(s,n){ s=String(s); return s.length>=n?s.substring(0,n):s+' '.repeat(n-s.length); }
function padR(s,n){ s=String(s); return s.length>=n?s.substring(0,n):' '.repeat(n-s.length)+s; }
function center(s,n){ s=String(s); const p=Math.max(0,n-s.length); const l=Math.floor(p/2); return ' '.repeat(l)+s+' '.repeat(p-l); }

// ── TICKET (no factura) ───────────────────────────────────
// Helper — líneas de forma de pago desglosadas
function lineasPago(data, gn){
  let lineas = '';
  if(data.divPagos && data.divPagos.length >= 2){
    // Pago dividido — mostrar cada método por separado
    data.divPagos.forEach(p => {
      lineas += '<p class="row s"><span class="l1">'+p.metodo.toUpperCase()+':</span><span class="l2">'+gn(p.monto)+'</span></p>';
    });
  } else {
    // Pago simple — o string compuesto viejo (ej: "EFECTIVO + POS")
    const metodo = (data.metodo||'EFECTIVO').toUpperCase();
    if(metodo.includes(' + ')){
      // Dividir string compuesto en partes iguales
      const partes = metodo.split(' + ');
      const montoParte = Math.round(data.total / partes.length);
      partes.forEach((m, i) => {
        const monto = i === partes.length-1 ? data.total - montoParte*(partes.length-1) : montoParte;
        lineas += '<p class="row s"><span class="l1">'+m+':</span><span class="l2">'+gn(monto)+'</span></p>';
      });
    } else {
      lineas += '<p class="row s"><span class="l1">'+metodo+':</span><span class="l2">'+gn(data.total)+'</span></p>';
    }
  }
  return lineas;
}

function generarHTMLTicket(data, size){
  const cols = size==='58' ? 32 : 42;
  const sep  = '-'.repeat(cols);
  const neg  = configData.negocio || 'MI NEGOCIO';
  const ruc  = configData.ruc     || '';
  const dir  = configData.direccion || '';
  const tel  = configData.telefono  || '';

  const pad = n=>String(n).padStart(2,'0');
  const d   = data.fecha;
  const fecha = pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();
  const hora  = pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());

  let lineas = '';

  // Cabecera
  lineas += '<p class="c" style="font-size:14px;font-weight:900;letter-spacing:.5px;">'+neg+'</p>';
  if(ruc)  lineas += '<p class="c s">RUC: '+ruc+'</p>';
  if(dir)  lineas += '<p class="c s">'+dir+'</p>';
  if(tel)  lineas += '<p class="c s">Tel: '+tel+'</p>';
  lineas += '<p class="hr"></p>';

  // Datos ticket
  lineas += '<p class="s">TICKET NRO: '+String(data.nroTicket||0).padStart(6,'0')+'</p>';
  lineas += '<p class="s">FECHA: '+fecha+' - HORA: '+hora+'</p>';
  lineas += '<p class="s">CLIENTE: '+((data.factura && data.factura.nombre)||'SIN NOMBRE')+'</p>';
  if(data.tipoPedido && data.tipoPedido!=='llevar' && data.tipoPedido!=='local'){
    lineas += '<p class="s b">TIPO: '+data.tipoPedido.toUpperCase()+'</p>';
  }
  if(data.mesa) lineas += '<p class="s b">MESA: '+data.mesa+'</p>';
  if(data.obs)  lineas += '<p class="s">OBS: '+data.obs+'</p>';
  lineas += '<p class="hr"></p>';

  // Encabezado columnas
  lineas += '<p class="s b"><span>DESCRIPCIÓN</span></p>';
  lineas += '<p class="s b"><span style="opacity:.6">CANT × P.UNIT</span>'
    +'<span style="float:right;font-weight:bold">SUBTOTAL</span></p>';
  lineas += '<p class="hr"></p>';

  // Items — nombre en línea 1, cant × pu = sub en línea 2
  data.items.forEach(item => {
    const subtot = item.desc>0 ? Math.round(item.price*item.qty*(1-item.desc/100)) : item.price*item.qty;
    lineas += '<p class="it-nom">'+item.name+'</p>';
    lineas += '<p class="it-det">'
      +'<span class="qty">'+item.qty+' × '+gn(item.price)+'</span>'
      +'<span class="pu"></span>'
      +'<span class="sub">'+gn(subtot)+'</span>'
      +'</p>';
    if(item.desc>0) lineas += '<p class="obs">  Desc: '+item.desc+'%</p>';
    if(item.obs)    lineas += '<p class="obs">  '+item.obs+'</p>';
  });
  lineas += '<p class="hr"></p>';

  // Totales
  const subtotal = data.items
    .filter(i=>!i.esDescuento)
    .reduce((s,i)=>s+(i.desc>0?Math.round(i.price*i.qty*(1-i.desc/100)):i.price*i.qty),0);
  const totalDescuentos = data.items
    .filter(i=>i.esDescuento)
    .reduce((s,i)=>s+(i.montoDesc||0),0);
  const hayDescuentos = totalDescuentos>0 || (data.descTicket>0);

  if(hayDescuentos){
    lineas += '<p class="row s"><span class="l1">SUBTOTAL</span><span class="l2">'+gn(subtotal)+'</span></p>';
    if(totalDescuentos>0){
      // Mostrar cada descuento aplicado
      data.items.filter(i=>i.esDescuento).forEach(d=>{
        lineas += '<p class="row s"><span class="l1">(-) '+d.name+'</span><span class="l2">'+gn(d.montoDesc)+'</span></p>';
      });
    }
    if(data.descTicket>0){
      lineas += '<p class="row s"><span class="l1">(-) Desc. ticket '+data.descTicket+'%</span><span class="l2">'+gn(data.descMonto||0)+'</span></p>';
    }
  }
  lineas += '<p class="row b l"><span class="l1">TOTAL:</span><span class="l2">'+gn(data.total)+'</span></p>';
  lineas += '<p class="hr"></p>';

  // Forma de pago
  lineas += '<p class="row s"><span class="l1">FORMA DE PAGO</span><span class="l2">IMPORTE</span></p>';
  lineas += '<p class="hr"></p>';
  lineas += lineasPago(data, gn);
  if(data.efectivo && data.efectivo!=='₲0') lineas += '<p class="row s"><span class="l1">EFECTIVO ENTREGADO:</span><span class="l2">'+data.efectivo+'</span></p>';
  if(data.vuelto) lineas += '<p class="row s"><span class="l1">VUELTO:</span><span class="l2">'+data.vuelto+'</span></p>';
  lineas += '<p class="hr"></p>';

  // Pie
  lineas += '<p class="hr"></p>';
  lineas += '<p class="c s">Comprobante no válido para el IVA</p>';
  if(data.nroOrden) lineas += '<p class="c s">Orden Nro: '+String(data.nroOrden).padStart(4,'0')+'</p>';
  if(configData.pie_recibo) lineas += '<p class="c s">'+configData.pie_recibo+'</p>';
  lineas += '<p class="c s b">*** GRACIAS POR SU PREFERENCIA ***</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  return '<html><head><style>'+getCSSTermico(size)+'</style></head><body>'+lineas+'</body></html>';
}

// ── FACTURA ───────────────────────────────────────────────
function generarHTMLFactura(data, size){
  const cols = size==='58' ? 32 : 42;
  const neg  = configData.negocio   || 'MI NEGOCIO';
  const ruc  = configData.ruc       || '';
  const dir  = configData.direccion || '';
  const tel  = configData.telefono  || '';
  const f    = data.factura || {};
  const tim  = f.timbrado   || '';
  const nroF = f.nro_factura|| '';

  const pad = n=>String(n).padStart(2,'0');
  const d   = data.fecha;
  const fecha = pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();
  const hora  = pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());

  // Calcular IVA (solo ítems normales, no descuentos)
  let grav10=0, grav5=0, exento=0;
  const subtotalFact = data.items
    .filter(i=>!i.esDescuento)
    .reduce((s,i)=>s+(i.desc>0?Math.round(i.price*i.qty*(1-i.desc/100)):i.price*i.qty),0);
  const totalDescFact = data.items
    .filter(i=>i.esDescuento)
    .reduce((s,i)=>s+(i.montoDesc||0),0);

  data.items.filter(i=>!i.esDescuento).forEach(item=>{
    const sub = item.desc>0 ? Math.round(item.price*item.qty*(1-item.desc/100)) : item.price*item.qty;
    if(item.iva==='10')       grav10  += sub;
    else if(item.iva==='5')   grav5   += sub;
    else                       exento  += sub;
  });
  const iva10  = Math.round(grav10  * 10/110);
  const iva5   = Math.round(grav5   * 5/105);
  const total  = data.total;

  let lineas = '';

  // Cabecera negocio
  lineas += '<p class="c" style="font-size:14px;font-weight:900;letter-spacing:.5px;">'+neg+'</p>';
  if(dir)  lineas += '<p class="c s">'+dir+'</p>';
  if(ruc)  lineas += '<p class="c s">RUC: '+ruc+'</p>';
  if(tel)  lineas += '<p class="c s">Tel: '+tel+'</p>';
  lineas += '<p class="hr"></p>';

  // Timbrado
  const timActivo = getTimbradoActivo();
  lineas += '<p class="s">TIMBRADO Nro: <b>'+tim+'</b></p>';
  // Vigencia del timbrado
  const vigInicio = (timActivo && timActivo.vig_inicio) || (timActivo && timActivo.fecha_desde) || '';
  const vigFin    = (timActivo && timActivo.vig_fin)    || (timActivo && timActivo.fecha_hasta) || '';
  if(vigInicio) lineas += '<p class="s">INICIO: '+(vigInicio.includes('-')?vigInicio.split('-').reverse().join('/'):vigInicio)+'</p>';
  if(vigFin && vigFin!=='2999-12-31') lineas += '<p class="s">VENCIMIENTO: '+(vigFin.includes('-')?vigFin.split('-').reverse().join('/'):vigFin)+'</p>';
  // Punto de expedición
  if(f.sucursal_nro||f.punto_exp) lineas += '<p class="s">SUC: '+(f.sucursal_nro||'001')+' - P.EXP: '+(f.punto_exp||'001')+'</p>';
  lineas += '<p class="hr"></p>';
  lineas += '<p class="c b" style="font-size:11pt;">FACTURA CONTADO</p>';
  lineas += '<p class="c b" style="font-size:11pt;">NRO: '+nroF+'</p>';
  lineas += '<p class="s">Fecha: '+fecha+' - Hora: '+hora+'</p>';
  if(data.tipoPedido && data.tipoPedido!=='llevar') lineas += '<p class="s">Tipo: '+data.tipoPedido.toUpperCase()+'</p>';
  if(data.mesa) lineas += '<p class="s">Mesa: '+data.mesa+'</p>';
  lineas += '<p class="hr"></p>';

  // Encabezado items
  lineas += '<p class="s b">DESCRIPCIÓN &nbsp;&nbsp;&nbsp; CANT × PU &nbsp;&nbsp; IMP &nbsp; IVA</p>';
  lineas += '<p class="hr"></p>';

  // Items — nombre en línea 1, detalle en línea 2
  data.items.filter(i=>!i.esDescuento).forEach(item=>{
    const sub = item.desc>0 ? Math.round(item.price*item.qty*(1-item.desc/100)) : item.price*item.qty;
    const ivaLabel = item.iva==='exento'?'Exnt':(item.iva||'10')+'%';
    lineas += '<p class="if-nom">'+item.name+'</p>';
    lineas += '<p class="if-det">'
      +'<span>'+item.qty+'×'+gn(item.price)+'</span>'
      +'<span>'+gn(sub)+'</span>'
      +'<span>'+ivaLabel+'</span>'
      +'</p>';
    if(item.obs) lineas += '<p class="obs">  '+item.obs+'</p>';
  });
  lineas += '<p class="hr"></p>';

  // Total
  lineas += '<p class="row b l"><span class="l1">TOTAL:</span><span class="l2">'+gn(total)+'</span></p>';
  lineas += '<p class="hr"></p>';

  // Sub totales IVA
  lineas += '<p class="row s"><span class="l1">SUB TOTALES</span><span class="l2">LIQUIDACION</span><span style="margin-left:4px;" class="l2 s">IVA</span></p>';
  lineas += '<p class="hr"></p>';
  if(grav10>0)  lineas += '<p class="row s"><span class="l1">Gravado 10%</span><span class="l2">'+gn(grav10)+'</span><span style="margin-left:4px;" class="l2">'+gn(iva10)+'</span></p>';
  if(grav5>0)   lineas += '<p class="row s"><span class="l1">Gravado 5%</span><span class="l2">'+gn(grav5)+'</span><span style="margin-left:4px;" class="l2">'+gn(iva5)+'</span></p>';
  if(exento>0)  lineas += '<p class="row s"><span class="l1">Exento</span><span class="l2">'+gn(exento)+'</span><span style="margin-left:4px;" class="l2">0</span></p>';
  lineas += '<p class="hr"></p>';

  // Forma de pago
  lineas += '<p class="row s"><span class="l1">FORMA DE PAGO</span><span class="l2">IMPORTE</span></p>';
  lineas += '<p class="hr"></p>';
  lineas += lineasPago(data, gn);
  if(data.efectivo && data.efectivo!=='₲0') lineas += '<p class="row s"><span class="l1">EFECTIVO ENTREGADO:</span><span class="l2">'+data.efectivo+'</span></p>';
  if(data.vuelto) lineas += '<p class="row s"><span class="l1">VUELTO:</span><span class="l2">'+data.vuelto+'</span></p>';
  lineas += '<p class="hr"></p>';

  // Cliente
  lineas += '<p class="s"><b>Cliente:</b> '+(f.nombre||'CONSUMIDOR FINAL')+'</p>';
  lineas += '<p class="s">RUC: '+(f.ruc||'0000000-0')+'</p>';
  if(f.direccion) lineas += '<p class="s">Dir: '+f.direccion+'</p>';
  lineas += '<p class="hr"></p>';

  // Footer
  if(nroF) lineas += '<p class="s">FACTURA NRO: <b>'+nroF+'</b></p>';
  lineas += '<p class="s">ATENDIDO POR: '+(configData.terminal||'admin')+'</p>';
  lineas += '<p class="s">ORIGINAL: CLIENTE</p>';
  lineas += '<p class="s">DUPLICADO: ARCHIVO TRIBUTARIO</p>';
  lineas += '<p class="hr"></p>';
  lineas += '<p class="s">LOS DATOS IMPRESOS REQUIEREN DE CUIDADOS ESPECIALES.</p>';
  if(configData.pie_recibo) lineas += '<p class="c s">'+configData.pie_recibo+'</p>';
  lineas += '<p class="c s b">*** GRACIAS POR SU PREFERENCIA ***</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  return '<html><head><style>'+getCSSTermico(size)+'</style></head><body>'+lineas+'</body></html>';
}

// ── COMANDA ───────────────────────────────────────────────
function generarHTMLComanda(data, size){
  const pad = n=>String(n).padStart(2,'0');
  const d   = data.fecha instanceof Date ? data.fecha : new Date(data.fecha);
  const fecha = pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();
  const hora  = pad(d.getHours())+':'+pad(d.getMinutes());
  const nro   = String(data.nroTicket||0).padStart(4,'0');

  const tipoPedido = (data.tipoPedido||'llevar').toLowerCase();
  const esDelivery = tipoPedido==='delivery';
  const esMesa     = tipoPedido==='local' || tipoPedido==='mesa' || !!data.mesa;
  const tipoLabel  = esDelivery          ? '*** DELIVERY ***'
                   : data.mesa           ? '*** MESA ' + data.mesa.toUpperCase() + ' ***'
                   : esMesa              ? '*** LOCAL ***'
                   :                      '*** PARA LLEVAR ***';

  const w = size==='58' ? 48 : 64; // ancho en chars para word-wrap

  // Función para partir texto largo en múltiples líneas
  function wrapText(txt, maxW, indent) {
    if (!txt) return '';
    indent = indent || '';
    const words = String(txt).split(' ');
    const lines = [];
    let cur = '';
    words.forEach(w => {
      if ((cur + (cur?' ':'') + w).length > maxW) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = cur ? cur + ' ' + w : w;
      }
    });
    if (cur) lines.push(cur);
    if (!lines.length) return '';
    return lines[0] + (lines.slice(1).map(l => indent + l).join(''));
  }

  let lineas = '';

  // Separador superior
  lineas += '<p class="hr"></p>';

  // Nro orden — tamaño visible pero no exagerado
  lineas += '<p class="c" style="font-size:28px;font-weight:900;letter-spacing:3px;line-height:1.1;margin:2px 0;">'
          + '# ' + nro + '</p>';

  // Hora y fecha
  lineas += '<p class="c b" style="font-size:12px;margin:2px 0;">' + hora + '  ' + fecha + '</p>';
  lineas += '<p class="hr"></p>';

  // Tipo de pedido — muy visible
  lineas += '<p class="c" style="font-size:13px;font-weight:900;border-top:2px solid #000;border-bottom:2px solid #000;padding:3px 0;margin:2px 0;">'
          + tipoLabel + '</p>';

  // Cliente si tiene
  const cliente = (data.factura && data.factura.nombre) || data.cliente || '';
  if(cliente) lineas += '<p class="c b s" style="margin-top:2px;word-break:break-word;">Cliente: '+cliente+'</p>';
  if(data.obs) lineas += '<p class="c b s;word-break:break-word;">OBS: '+data.obs+'</p>';

  lineas += '<p class="hr"></p>';

  // Items — cantidad en grande, nombre en negrita con word-wrap
  data.items.filter(i=>!i.esDescuento).forEach(item=>{
    const maxNom = w - 3;

    if(item._esMitad){
      // Pizza por mitades — formato especial
      lineas += '<p style="margin:3px 0;">'
              + '<span style="font-size:14px;font-weight:900;">' + item.qty + '</span>'
              + '<span style="font-size:11pt;font-weight:800;"> PIZZA MITAD</span>'
              + '</p>';
      lineas += '<p class="s" style="padding-left:16px;font-weight:800;">½ ' + (item._mitad1||'') + '</p>';
      lineas += '<p class="s" style="padding-left:16px;font-weight:800;">½ ' + (item._mitad2||'') + '</p>';
    } else {
      const nombre = wrapText(item.name, maxNom, '   ');
      lineas += '<p style="margin:3px 0;">'
              + '<span style="font-size:14px;font-weight:900;">' + item.qty + '</span>'
              + '<span style="font-size:11pt;font-weight:800;"> ' + nombre + '</span>'
              + '</p>';
    }
    // Modificadores y observaciones
    if(item.obs && !item._esMitad){
      const obsLines = item.obs.split(' · ');
      obsLines.forEach(ob => {
        lineas += '<p class="s" style="padding-left:16px;font-weight:700;">-&gt; '
                + wrapText(ob, maxNom - 2, '  ') + '</p>';
      });
    } else if(item.obs && item._esMitad === undefined && item.obs){
      lineas += '<p class="s" style="padding-left:16px;font-weight:700;">-&gt; '
              + wrapText(item.obs, maxNom - 2, '  ') + '</p>';
    }
  });

  lineas += '<p class="hr"></p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';
  lineas += '<p style="margin:0;line-height:1.8;">&nbsp;</p>';

  return '<html><head><style>'+getCSSTermico(size)+'</style></head><body>'+lineas+'</body></html>';
}

// ── IMPRIMIR RECIBO (ticket o factura según si tiene timbrado) ──
function imprimirTicketActual(){
  if(!cart || cart.length === 0){ toast('El ticket está vacío'); return; }
  const size = getPaperSize('ticket');
  const ahora = new Date();

  const data = {
    items:     JSON.parse(JSON.stringify(cart)),
    total:     calcTotal(),
    metodo:    '',
    fecha:     ahora,
    nroTicket: currentTicketNro || ticketCounter,
    obs:       '',
    factura:   null,
    descTicket: ticketDescuento || 0,
  };

  // Actualizar ultimoReciboData para que imprimirRecibo() use estos datos
  ultimoReciboData = data;
  const html = generarHTMLTicket(data, size);
  mostrarPreviewRecibo(html, size);
  const titulo = document.getElementById('reciboTitulo');
  if(titulo) titulo.textContent = 'Ticket #' + String(data.nroTicket).padStart(4,'0');
  goTo('scRecibo');
}

function imprimirTicketPendiente(idx){
  const t = pendientes[idx];
  if(!t){ toast('Ticket no encontrado'); return; }
  // Compatibilidad: algunos tickets guardados usan 'items' en vez de 'cart'
  const items = t.cart || t.items || [];
  if(!items.length){ toast('Ticket sin productos'); return; }
  const size = getPaperSize('ticket');
  const data = {
    items:      JSON.parse(JSON.stringify(items)),
    total:      t.total || items.reduce((s,i)=>s+(i.price*i.qty),0),
    metodo:     '',
    fecha:      t.fecha ? new Date(t.fecha) : new Date(),
    nroTicket:  t.nro,
    obs:        t.obs || '',
    factura:    null,
    descTicket: 0,
  };
  // ── CRÍTICO: actualizar ultimoReciboData para que imprimirRecibo()
  // use estos datos y no los de la última venta cobrada
  ultimoReciboData = data;
  const html = generarHTMLTicket(data, size);
  mostrarPreviewRecibo(html, size);
  const titulo = document.getElementById('reciboTitulo');
  if(titulo) titulo.textContent = 'Ticket #'+String(t.nro).padStart(4,'0');
  goTo('scRecibo');
}

// ── IMPRESIÓN DIRECTA ─────────────────────────────────────
// Imprime sin abrir ventana nueva — funciona en PWA y terminales Android
// ── QUICKPRINTER (puente para impresoras internas Android) ─
// Convierte el HTML del ticket a texto plano y lo manda a QuickPrinter
function imprimirConQuickPrinter(html, size){
  const cols = size === '58' ? 32 : 42;
  const sep  = '-'.repeat(cols);

  // Convertir HTML térmico a texto plano compatible con QuickPrinter
  let texto = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<hr[^>]*>/gi, '\n' + sep + '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*class="[^"]*row[^"]*"[^>]*>([\s\S]*?)<\/p>/gi, function(m, inner){
      const spans = inner.match(/<span[^>]*>([\s\S]*?)<\/span>/gi) || [];
      const texts = spans.map(s => s.replace(/<[^>]+>/g,'').trim());
      if(texts.length >= 2){
        const left  = texts[0];
        const right = texts.slice(1).join(' ');
        const pad   = Math.max(1, cols - left.length - right.length);
        return left + ' '.repeat(pad) + right + '\n';
      }
      return texts.join(' ') + '\n';
    })
    .replace(/<p[^>]*class="[^"]*c[^"]*"[^>]*>([\s\S]*?)<\/p>/gi, function(m, inner){
      const txt = inner.replace(/<[^>]+>/g,'').trim();
      const pad = Math.max(0, Math.floor((cols - txt.length) / 2));
      return ' '.repeat(pad) + txt + '\n';
    })
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Agregar corte al final
  texto += '\n\n\n';

  // Probar con el action directo de QuickPrinter
  // Formato documentado en github.com/diegoveloper/quickprinter
  const encoded = encodeURIComponent(texto);

  // Método 1: Intent con action pe.diegoveloper.printing
  const intent = 'intent:#Intent;' +
                 'action=pe.diegoveloper.printing;' +
                 'type=text/plain;' +
                 'S.android.intent.extra.TEXT=' + encoded + ';' +
                 'end';
  try {
    window.location.href = intent;
    return true;
  } catch(e){
    console.warn('[QuickPrinter]', e.message);
    toast('Error de impresión: '+e.message);
    return false;
  }
}

function imprimirDirecto(html, size){
  const mmW = size === '58' ? '58mm' : '80mm';

  // Intentar QuickPrinter primero (para Vizzion y Android con impresora interna)
  const esAndroid = /android/i.test(navigator.userAgent);
  if(esAndroid){
    // Si el APK expone AndroidPrint, usar ESC/POS directo
    if(typeof window.AndroidPrint !== 'undefined'){
      imprimirAndroidNativo(html, size);
      return;
    }
    // Si no hay AndroidPrint, intentar QuickPrinter
    // Solo si NO estamos dentro de un WebView APK (que rompería la navegación)
    const esWebView = /wv\)/.test(navigator.userAgent) || /; wv\)/.test(navigator.userAgent);
    if(!esWebView){
      imprimirConQuickPrinter(html, size);
      return;
    }
    // Dentro del APK sin AndroidPrint — usar @media print
  }

  // Método 1: Blob URL + ventana nueva (PC / iOS)
  try {
    const fullHtml = html.replace('</style>',
      '@page{size:'+mmW+' auto;margin:0}body{margin:0;padding:0}</style>');
    const blob = new Blob([fullHtml], {type: 'text/html'});
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if(win){
      win.onload = function(){
        setTimeout(function(){
          win.print();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
        }, 500);
      };
      setTimeout(function(){
        try{ win.print(); }catch(e){ /* safe: fallback print attempt */ }
        setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
      }, 2000);
      return;
    }
  } catch(e){ console.warn('[Print] Blob falló:', e.message); toast('Error de impresión: '+e.message); }

  // Método 2: @media print directo en la página
  const bodyMatch  = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const content    = bodyMatch  ? bodyMatch[1]  : html;
  const ticketCss  = styleMatch ? styleMatch[1] : '';
  let pd = document.getElementById('_printDiv');
  if(!pd){ pd = document.createElement('div'); pd.id = '_printDiv'; document.body.appendChild(pd); }
  pd.innerHTML = content;
  let ps = document.getElementById('_printStyle');
  if(!ps){ ps = document.createElement('style'); ps.id = '_printStyle'; document.head.appendChild(ps); }
  ps.textContent =
    '@media print{body>*:not(#_printDiv){display:none!important}#_printDiv{display:block!important}' +
    '@page{size:'+mmW+' auto;margin:0}}' +
    '@media screen{#_printDiv{display:none}}' + ticketCss;
  setTimeout(function(){
    window.print();
    setTimeout(function(){ pd.innerHTML=''; ps.textContent=''; }, 5000);
  }, 300);
}

function imprimirRecibo(){
  if(!ultimoReciboData){ toast('Sin datos para imprimir'); return; }

  // BT Print Server tiene prioridad si hay MAC guardada
  const btpsTipo = localStorage.getItem('printerType_ticket');
  const btpsMac  = localStorage.getItem('btps_mac');
  if(btpsTipo === 'btps' || btpsMac){
    BTPrinter.imprimirRecibo(ultimoReciboData);
    return;
  }

  const size = getPaperSize('ticket');
  const esFactura = ultimoReciboData.factura && ultimoReciboData.factura.timbrado;
  const html = esFactura
    ? generarHTMLFactura(ultimoReciboData, size)
    : generarHTMLTicket(ultimoReciboData, size);
  const p = printers['ticket'];
  if(isAndroidAPK() && typeof window.AndroidPrint !== 'undefined'){
    imprimirAndroidNativo(html, size);
  } else if(p && p.type === 'bt' && p.device){
    imprimirBluetooth(p.device, html, size);
  } else {
    // PC/USB — usar el mismo flujo que la primera impresion
    const widthPx = size === '58' ? '200px' : '280px';
    abrirDialogoImpresion(html, widthPx);
  }
}

// ── IMPRIMIR COMANDA ──────────────────────────────────────
function imprimirComanda(data){
  const size = getPaperSize('comanda');
  const html = generarHTMLComanda(data, size);

  const btpsMac  = localStorage.getItem('btps_mac');
  const btpsTipo = localStorage.getItem('printerType_ticket');
  if(btpsMac || btpsTipo === 'btps'){
    const cols = size === '58' ? 32 : 42;
    const sep  = '='.repeat(cols);
    const sep2 = '-'.repeat(cols);
    const n    = '\n';

    const d     = data.fecha ? (data.fecha instanceof Date ? data.fecha : new Date(data.fecha)) : new Date();
    // Formato 24hs para evitar caracteres especiales de AM/PM en impresoras térmicas
    const hora  = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    const fecha = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
    const nro   = String(data.nroTicket||'').padStart(4,'0');

    const tipoPedido = (data.tipoPedido||'llevar').toLowerCase();
    const esDelivery = tipoPedido==='delivery';
    const esMesa     = tipoPedido==='local' || tipoPedido==='mesa' || !!data.mesa;
    const tipoLabel  = esDelivery          ? '*** DELIVERY ***'
                     : data.mesa           ? '*** MESA ' + data.mesa.toUpperCase() + ' ***'
                     : esMesa              ? '*** LOCAL ***'
                     :                      '*** PARA LLEVAR ***';

    // Función para partir texto largo en múltiples líneas
    function wrapLine(txt, maxW, indent) {
      if (!txt) return '';
      const words = String(txt).split(' ');
      const lines = []; let cur = '';
      words.forEach(function(w){
        if((cur+(cur?' ':'')+w).length > maxW){ if(cur) lines.push(cur); cur=w; }
        else { cur = cur ? cur+' '+w : w; }
      });
      if(cur) lines.push(cur);
      return lines[0] + (lines.slice(1).map(function(l){ return n+(indent||'   ')+l; }).join(''));
    }

    let txt = '';
    txt += sep + n;

    // Nro de orden — lo más grande posible
    // Línea de espaciado + nro bien centrado + negrita
    txt += n;
    txt += sep + n;
    txt += '[CENTER]ORDEN NRO[/CENTER]' + n;
    txt += '[CENTER][BOLD]# ' + nro + '[/BOLD][/CENTER]' + n;
    txt += sep + n;
    txt += n;

    // Hora y fecha
    txt += '[CENTER][BOLD]' + hora + '  ' + fecha + '[/BOLD][/CENTER]' + n;
    txt += sep2 + n;

    // Tipo de pedido
    txt += '[CENTER][BOLD]' + tipoLabel + '[/BOLD][/CENTER]' + n;
    txt += sep2 + n;

    // Cliente y obs
    const cliente = (data.factura && data.factura.nombre) || data.cliente || '';
    if(cliente) txt += 'Cliente: ' + cliente + n;
    if(data.obs) txt += '[BOLD]OBS: ' + data.obs + '[/BOLD]' + n;
    if(cliente || data.obs) txt += sep2 + n;

    // Items
    (data.items||[]).forEach(function(item){
      if(item.esDescuento) return;
      const maxNom = cols - 3;
      const nombre = wrapLine(item.name, maxNom, '   ');
      txt += '[BOLD]' + item.qty + ' ' + nombre + '[/BOLD]' + n;
      if(item.obs) txt += '  -> ' + wrapLine(item.obs, cols-5, '     ') + n;
    });

    txt += sep + n;
    txt += '[CUT]';

    BTPrinter.print(txt).then(function(r){
      if(r.status !== 'ok'){
        toast('Error comanda: ' + (r.message||'Error'));
        abrirVentanaImpresion(html, size);
      }
    });
    return;
  }

  abrirVentanaImpresion(html, size);
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOQUE 2: Configuración de impresoras (variables, helpers)
// ══════════════════════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════════════════════
// BLOQUE 3: UI impresoras, Bluetooth, USB local, PC, Serial, Android nativo
// ══════════════════════════════════════════════════════════════════════════════

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
      statusEl.textContent = '\u26a0\ufe0f Reconectar Bluetooth';
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
      try { lista = JSON.parse(raw); } catch(e) { /* safe: malformed JSON defaults to empty list */ lista = []; }

      // Verificar si devolvió un error
      if(lista.length > 0 && lista[0].error){
        toast('Error Bluetooth: ' + lista[0].error);
        return;
      }

      if(!lista.length){
        toast('No hay impresoras Bluetooth emparejadas. Emparejá tu impresora en Ajustes \u2192 Bluetooth');
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
        toast('\u2713 Conectada: ' + printer.name);
        return;
      }

      // Si hay varias, mostrar un selector simple
      const nombres = lista.map((p, i) => i + ': ' + p.name + ' (' + p.address + ')').join('\n');
      const input = prompt('Seleccion\u00e1 el n\u00famero de impresora:\n' + nombres, '0');
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
      toast('\u2713 Conectada: ' + printer.name);

    } catch(e){
      toast('Error al obtener impresoras: ' + e.message);
    }
    return;
  }

  // ── MODO WEB: Web Bluetooth API (Chrome/Edge en PC) ─────────────────────────
  if(!navigator.bluetooth){
    toast('Web Bluetooth no disponible \u2014 us\u00e1 Chrome o Edge en PC, o instal\u00e1 la app Android');
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
  var elegida = window.prompt('Seleccion\u00e1 el n\u00famero:\n\n'+opts+'\nPara Generic Text Only USB eleg\u00ed USB001 o USB002');
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
    toast('MAC inv\u00e1lida \u2014 formato: AA:BB:CC:DD:EE:FF'); return;
  }
  localStorage.setItem('btps_mac', mac);
  localStorage.setItem('printerType_ticket', 'btps');
  localStorage.setItem('printerName_ticket', mac);
  toast('Conectando a ' + mac + '...');
  const r = await BTPrinter.connect(mac);
  if (r.status === 'ok') {
    BTPrinter._updUI(true, r.device);
    toast('\u2713 Impresora conectada: ' + r.device);
  } else {
    toast('\u274c ' + (r.message || 'Error al conectar'));
    BTPrinter._updUI(false, null);
  }
}

async function btpsVerEstado(){
  const s = await BTPrinter.status();
  if (!s) { toast('Servidor no disponible \u2014 abre BT Print Server'); return; }
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
    toast('Desconectada \u2014 MAC guardada: ' + (localStorage.getItem('btps_mac') || 'ninguna'));
  }
}

async function btpsTestImprimir(){
  const s = await BTPrinter.status();
  if (!s) { toast('\u26a0\ufe0f Abr\u00ed la app BT Print Server'); return; }
  if (!s.connected) { toast('\u26a0\ufe0f Impresora desconectada'); return; }
  const r = await BTPrinter.print(
    '[CENTER][BOLD]** PRUEBA **[/BOLD][/CENTER]\n' +
    '--------------------------------\n' +
    'Ampersand POS - Test OK\n' +
    new Date().toLocaleString('es-PY') + '\n' +
    '--------------------------------\n' +
    '[FEED:4]\n[CUT]'
  );
  toast(r.status === 'ok' ? '\u2713 Test enviado a la impresora' : '\u274c ' + r.message);
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
      toast('\u26a0\ufe0f Configur\u00e1 la impresora Bluetooth primero');
      return;
    }

    // Asegurarse de que el puente sabe qué impresora usar
    window.AndroidPrint.setBluetoothDevice(androidName);

    // Convertir HTML a bytes ESC/POS y enviar al puente nativo
    imprimirAndroidNativo(htmlContent, size)
      .then(function(resultado){
        if(resultado && resultado.startsWith('ok')){
          toast('\u2713 Impreso (' + resultado + ')');
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
    toast('\u26a0\ufe0f Reconect\u00e1 la impresora Bluetooth primero');
    goTo('scConfigImpresoras');
    return;
  }

  // ── MODO WEB Bluetooth (Chrome/Edge en PC) ────────────────────────────────
  if(p && p.type === 'bt' && p.device){
    imprimirBluetooth(p.device, htmlContent, size);
    return;
  }

  if(p && p.type === 'bt' && p.needsReconnect){
    toast('\u26a0\ufe0f Reconect\u00e1 la impresora Bluetooth primero');
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
  } catch(e){ /* safe: serial API may not be available */ }

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
    }catch(e){ console.warn('[Print] Serial fallback:', e.message); toast('Error de impresión USB: '+e.message); }
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
  toast('\u2193 ticket.bin descargado \u2014 ejecut\u00e1 impresora-usb.bat');
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
  var cols=size==='58'?32:42;

  function enc(str){
    var out=[];
    for(var i=0;i<str.length;i++){
      var c=str.charCodeAt(i);
      if(c<128)                       out.push(c);
      else if(c===0xC1||c===0xE1)     out.push(0xC1);
      else if(c===0xC9||c===0xE9)     out.push(0xC9);
      else if(c===0xCD||c===0xED)     out.push(0xCD);
      else if(c===0xD3||c===0xF3)     out.push(0xD3);
      else if(c===0xDA||c===0xFA)     out.push(0xDA);
      else if(c===0xD1||c===0xF1)     out.push(0xD1);
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

// ── FUNCIÓN: imprimirSerial (Web Serial API — USB térmicas) ─────────────────
async function imprimirSerial(port, htmlContent, size){
  var ESC=0x1B, GS=0x1D;
  var CMD = {
    init:       [ESC,0x40],
    left:       [ESC,0x61,0x00],
    center:     [ESC,0x61,0x01],
    boldOn:     [ESC,0x45,0x01],
    boldOff:    [ESC,0x45,0x00],
    dblWideOn:  [ESC,0x21,0x20],
    dblWideOff: [ESC,0x21,0x00],
    smallOn:    [ESC,0x21,0x01],
    smallOff:   [ESC,0x21,0x00],
    cut:        [GS,0x56,0x41,0x10],
    feed:       [ESC,0x64,0x03],
  };
  var cols = size==='58' ? 32 : 42;

  function enc(str){
    var out=[];
    for(var i=0;i<str.length;i++){
      var c=str.charCodeAt(i);
      if(c<128)                       out.push(c);
      else if(c===0xC1||c===0xE1)     out.push(0xC1);
      else if(c===0xC9||c===0xE9)     out.push(0xC9);
      else if(c===0xCD||c===0xED)     out.push(0xCD);
      else if(c===0xD3||c===0xF3)     out.push(0xD3);
      else if(c===0xDA||c===0xFA)     out.push(0xDA);
      else if(c===0xD1||c===0xF1)     out.push(0xD1);
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
  var bytes=[ESC,0x40, ESC,0x74,0x02]; // init + latin-1

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

  try {
    await port.open({ baudRate: 9600 });
    var writer=port.writable.getWriter();
    await writer.write(new Uint8Array(bytes));
    writer.releaseLock();
    await port.close();
    toast('\u2713 Impreso por USB');
  } catch(e) {
    // Puerto ya abierto — intentar directo
    try {
      var writer=port.writable.getWriter();
      await writer.write(new Uint8Array(bytes));
      writer.releaseLock();
      toast('\u2713 Impreso por USB');
    } catch(e2){
      toast('Error USB: '+e2.message);
    }
  }
}

async function imprimirBluetooth(device, htmlContent, size){
  const ESC=0x1B, GS=0x1D;
  // Comandos ESC/POS
  const CMD = {
    init:       [ESC,0x40],
    left:       [ESC,0x61,0x00],
    center:     [ESC,0x61,0x01],
    right:      [ESC,0x61,0x02],
    boldOn:     [ESC,0x45,0x01],
    boldOff:    [ESC,0x45,0x00],
    dblWideOn:  [ESC,0x21,0x20],  // doble ancho
    dblWideOff: [ESC,0x21,0x00],
    dblHOn:     [ESC,0x21,0x10],  // doble alto
    dblHOff:    [ESC,0x21,0x00],
    smallOn:    [ESC,0x21,0x01],  // fuente pequeña
    smallOff:   [ESC,0x21,0x00],
    cut:        [GS,0x56,0x41,0x10],
    feed:       [ESC,0x64,0x03],  // 3 líneas avance
    lf:         [0x0A],
  };

  const cols = size==='58' ? 32 : 42;

  function enc(str){
    // Codificación ISO-8859-1 para caracteres latinos
    const out=[];
    for(let i=0;i<str.length;i++){
      const c=str.charCodeAt(i);
      if(c<128) out.push(c);
      else if(c===0xC1||c===0xE1) out.push(0xC1);  // Á á
      else if(c===0xC9||c===0xE9) out.push(0xC9);  // É é
      else if(c===0xCD||c===0xED) out.push(0xCD);  // Í í
      else if(c===0xD3||c===0xF3) out.push(0xD3);  // Ó ó
      else if(c===0xDA||c===0xFA) out.push(0xDA);  // Ú ú
      else if(c===0xD1||c===0xF1) out.push(0xD1);  // Ñ ñ
      else out.push(0x3F);  // ?
    }
    return out;
  }

  function line(str){ return [...enc(str), 0x0A]; }
  function sep(){ return line('-'.repeat(cols)); }
  function cline(str){ // centrar
    const s=String(str); const p=Math.max(0,cols-s.length);
    return line(' '.repeat(Math.floor(p/2))+s);
  }
  function rline(l,r){ // izq + der alineados
    const ls=String(l), rs=String(r);
    const space=Math.max(1, cols-ls.length-rs.length);
    return line(ls+' '.repeat(space)+rs);
  }
  function pad2r(s,n){ s=String(s); return s.length>=n?s.substring(0,n):' '.repeat(n-s.length)+s; }
  function pad2l(s,n){ s=String(s); return s.length>=n?s.substring(0,n-1)+'\u2026':s+' '.repeat(n-s.length); }

  // Parsear el HTML para extraer los datos del ticket
  // IMPORTANTE: extraer solo el <body> antes de asignar a innerHTML
  // Si se asigna un HTML completo a innerHTML de un div, el browser descarta los <p>
  // y solo imprime el encabezado (el problema de "solo sale la cabecera")
  const tmp = document.createElement('div');
  let htmlParaParsear = htmlContent;
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if(bodyMatch) htmlParaParsear = bodyMatch[1];
  tmp.innerHTML = htmlParaParsear;

  // Función para extraer texto de un selector
  function txt(sel){ const el=tmp.querySelector(sel); return el?(el.innerText||el.textContent||'').trim():''; }

  // Extraer párrafos en orden
  const parrafos = Array.from(tmp.querySelectorAll('p'));

  // Construir bytes ESC/POS parseando las clases del HTML
  let bytes=[...CMD.init, ESC,0x74,0x02]; // init + página latin-1

  parrafos.forEach(function(p){
    const cls=p.className||'';
    const text=(p.innerText||p.textContent||'').trim();
    if(!text && !cls.includes('hr')) return;

    if(cls.includes('hr')){
      bytes.push(...sep());
      return;
    }

    const isCenter=cls.includes('c');
    const isBold=cls.includes('b');
    const isLarge=cls.includes('l');
    const isSmall=cls.includes('s')&&!cls.includes('s b')&&!cls.includes('c s');

    if(isCenter) bytes.push(...CMD.center); else bytes.push(...CMD.left);
    if(isLarge)  bytes.push(...CMD.dblWideOn, ...CMD.boldOn);
    else if(isBold) bytes.push(...CMD.boldOn);
    if(isSmall)  bytes.push(...CMD.smallOn);

    // Fila con dos columnas (clase row)
    if(cls.includes('row')){
      const spans=p.querySelectorAll('span');
      if(spans.length>=2){
        const l=(spans[0].innerText||spans[0].textContent||'').trim();
        const r=(spans[spans.length-1].innerText||spans[spans.length-1].textContent||'').trim();
        bytes.push(...CMD.left);
        if(isBold||isLarge) bytes.push(...CMD.boldOn);
        if(isLarge) bytes.push(...CMD.dblWideOn);
        bytes.push(...rline(l,r));
        bytes.push(...CMD.boldOff,...CMD.dblWideOff,...CMD.smallOff);
        return;
      }
    }

    // Item detail (it-det / if-det)
    if(cls.includes('it-det')||cls.includes('if-det')){
      const spans=p.querySelectorAll('span');
      if(spans.length>=2){
        bytes.push(...CMD.left,...CMD.smallOn);
        const parts=Array.from(spans).map(s=>(s.innerText||s.textContent||'').trim());
        if(parts.length===3){
          // cant×pu  [espacio]  subtotal
          const l=parts[0], r=parts[2];
          bytes.push(...rline('  '+l, r));
        } else {
          bytes.push(...line('  '+parts.join('  ')));
        }
        bytes.push(...CMD.smallOff);
        return;
      }
    }

    // Nombre de item (it-nom / if-nom)
    if(cls.includes('it-nom')||cls.includes('if-nom')){
      bytes.push(...CMD.left,...CMD.boldOn);
      bytes.push(...line(text));
      bytes.push(...CMD.boldOff);
      return;
    }

    // Texto normal
    bytes.push(...line(text));
    bytes.push(...CMD.boldOff,...CMD.dblWideOff,...CMD.smallOff);
  });

  bytes.push(...CMD.feed,...CMD.cut);

  try{
    // Reconectar si se desconectó
    let server;
    if(device.gatt.connected){
      server=device.gatt;
    } else {
      server=await device.gatt.connect();
    }

    // Intentar servicios conocidos de impresoras BT
    let char=null;
    const SERVICES=[
      {svc:'000018f0-0000-1000-8000-00805f9b34fb', chr:'00002af1-0000-1000-8000-00805f9b34fb'},
      {svc:'e7810a71-73ae-499d-8c15-faa9aef0c3f2', chr:'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'},
      {svc:'49535343-fe7d-4ae5-8fa9-9fafd205e455', chr:'49535343-8841-43f4-a8d4-ecbe34729bb3'},
    ];
    let lastErr='';
    for(const s of SERVICES){
      try{
        const svc=await server.getPrimaryService(s.svc);
        char=await svc.getCharacteristic(s.chr);
        console.log('[BT] Servicio:', s.svc);
        break;
      }catch(e){ lastErr=e.message; }
    }

    // Fallback: escanear todos los servicios disponibles
    if(!char){
      try{
        const svcs=await server.getPrimaryServices();
        console.log('[BT] Servicios:', svcs.map(s=>s.uuid));
        for(const svc of svcs){
          const chars=await svc.getCharacteristics();
          for(const c of chars){
            if(c.properties.write||c.properties.writeWithoutResponse){
              char=c;
              console.log('[BT] Char:', c.uuid);
              break;
            }
          }
          if(char) break;
        }
      }catch(e2){ console.warn('[BT] Scan error:', e2.message); }
    }

    if(!char) throw new Error('Impresora no soportada. '+lastErr);

    const data = new Uint8Array(bytes);

    // Negociar MTU real del dispositivo (máximo transferible por paquete)
    // Las impresoras BT baratas suelen tener MTU de 20-100 bytes
    // Usamos chunks pequeños para máxima compatibilidad
    let chunkSize = 100; // conservador por defecto
    try {
      // Algunos dispositivos exponen su MTU vía el servidor GATT
      if(server.device && server.device.gatt) {
        // Intentar un chunk de prueba pequeño para detectar el límite
        chunkSize = 100;
      }
    } catch(e) { /* ignorar */ }

    // Enviar con delay adaptativo según tamaño total
    // Tickets largos necesitan más tiempo entre chunks
    const delayMs = data.length > 1000 ? 60 : 40;

    console.log(`[BT] Enviando ${data.length} bytes en chunks de ${chunkSize} con ${delayMs}ms delay`);

    for(let i = 0; i < data.length; i += chunkSize){
      const chunk = data.slice(i, i + chunkSize);
      let enviado = false;

      // Intentar writeWithoutResponse primero (más rápido y sin ACK overhead)
      if(char.properties.writeWithoutResponse){
        try{
          await char.writeValueWithoutResponse(chunk);
          enviado = true;
        }catch(e){ /* fallback a writeValue */ }
      }

      // Fallback a writeValue (con ACK — más lento pero más confiable)
      if(!enviado){
        try{
          await char.writeValue(chunk);
          enviado = true;
        }catch(e){
          throw new Error('Error enviando datos: '+e.message);
        }
      }

      // Delay entre chunks — crítico para que el buffer de la impresora no se llene
      await new Promise(r => setTimeout(r, delayMs));

      // Cada 10 chunks, pausa extra para que la impresora procese
      if(((i / chunkSize) + 1) % 10 === 0){
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Pausa final antes de confirmar — dar tiempo al último chunk
    await new Promise(r => setTimeout(r, 300));
    toast('\u2713 Impreso por Bluetooth');
  }catch(e){
    console.error('[BT]', e.message);
    toast('Error BT: '+e.message);
    imprimirTicketConf(htmlContent,'ticket');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOQUE 4: USBPrinter + BTPrinter — módulos HTTP para servidores locales
// ══════════════════════════════════════════════════════════════════════════════

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
    if(st){ st.textContent = conectada ? '\u25cf Servidor activo' : '\u25cf Servidor no encontrado'; st.style.color = conectada ? 'var(--green)' : '#ef5350'; }
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
          'No se puede conectar al servidor de impresi\u00f3n.\n\n' +
          '\u26a0\ufe0f Est\u00e1s usando la app desde el navegador (HTTPS). ' +
          'El servidor BT Print Server corre en HTTP local y el navegador lo bloquea.\n\n' +
          '\u2705 Soluci\u00f3n: Abr\u00ed la app desde el \u00edcono instalado (APK), no desde Chrome.'
        );
      } else {
        this._showError('Abr\u00ed la app BT Print Server en tu dispositivo y asegurate de que est\u00e9 corriendo.');
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
        '<div style="font-size:28px;text-align:center;margin-bottom:12px;">\ud83d\udda8\ufe0f</div>' +
        '<div style="color:#ef5350;font-weight:700;font-size:15px;margin-bottom:12px;text-align:center;">Error de impresi\u00f3n</div>' +
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
      badge.textContent = connected ? '\u25cf' : '\u25cb';
      badge.style.color = connected ? 'var(--green)' : '#ef5350';
    }
  }
};
