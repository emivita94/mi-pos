// ── Admin: Dashboard, Ventas, Terminales, Cajas ──

// ── DASHBOARD ─────────────────────────────────────────────
function renderDashboard(){
  var c=document.getElementById('content');
  c.innerHTML=`
<div class="ph">
  <div><div class="pt">Dashboard</div><div class="ps">Resumen del negocio</div></div>
  <div class="dbar">
    <button class="dbtn on" onclick="setFD('hoy',this)">Hoy</button>
    <button class="dbtn" onclick="setFD('semana',this)">Esta semana</button>
    <button class="dbtn" onclick="setFD('mes',this)">Este mes</button>
  </div>
</div>

<!-- KPIs fila 1 -->
<div class="kg k4" style="margin-bottom:14px;">
  <div class="kc" style="--c:var(--green)">
    <div class="kc-l" id="kTLabel">Ventas de hoy</div>
    <div class="kc-v" id="kT">₲0</div>
    <div class="kc-s" id="kTdiff" style="cursor:help;">—</div>
  </div>
  <div class="kc" style="--c:var(--blue)">
    <div class="kc-l">Ticket promedio</div>
    <div class="kc-v" id="kP">₲0</div>
    <div class="kc-s" id="kC" style="cursor:help;">0 operaciones</div>
  </div>
  <div class="kc" style="--c:var(--green)">
    <div class="kc-l">Efectivo</div>
    <div class="kc-v" id="kEf">₲0</div>
    <div class="kc-s" id="kEfPct">0%</div>
  </div>
  <div class="kc" style="--c:var(--orange)">
    <div class="kc-l">POS / Transfer.</div>
    <div class="kc-v" id="kEl">₲0</div>
    <div class="kc-s" id="kElPct">0%</div>
  </div>
</div>

<!-- Gráfico últimos 7 días + insights -->
<div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px;">
  <div class="card">
    <div class="card-h"><span class="card-t">Últimos 7 días</span></div>
    <div style="padding:14px;height:240px;"><canvas id="ch7Dias"></canvas></div>
  </div>
  <div style="display:flex;flex-direction:column;gap:12px;">
    <div class="card" style="flex:1;">
      <div style="background:var(--green);padding:10px 14px;display:flex;align-items:center;gap:8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span style="font-size:13px;font-weight:700;color:#fff;">Día más activo</span>
      </div>
      <div style="padding:14px;">
        <div style="font-size:22px;font-weight:800;color:var(--text);" id="diaMasActivo">—</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;" id="diaMasActivoSub">calculando...</div>
      </div>
    </div>
    <div class="card" style="flex:1;">
      <div style="background:var(--blue);padding:10px 14px;display:flex;align-items:center;gap:8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span style="font-size:13px;font-weight:700;color:#fff;">Hora más activa</span>
      </div>
      <div style="padding:14px;">
        <div style="font-size:22px;font-weight:800;color:var(--text);" id="horaMasActiva">—</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;" id="horaMasActivaSub">calculando...</div>
      </div>
    </div>
  </div>
</div>

<!-- Categorías + Productos -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
  <div class="card">
    <div class="card-h"><span class="card-t" id="catTitle">Participación por categoría — hoy</span></div>
    <div style="padding:14px;display:flex;align-items:center;justify-content:center;min-height:260px;" id="catWrap">
      <canvas id="chCats" style="max-width:240px;max-height:240px;"></canvas>
    </div>
  </div>
  <div class="card">
    <div class="card-h"><span class="card-t" id="prodTitle">Productos más vendidos — hoy</span></div>
    <div id="topProdsList" style="padding:8px 0;max-height:320px;overflow-y:auto;"></div>
  </div>
</div>

<!-- Formas de pago -->
<div class="card" style="margin-bottom:14px;">
  <div class="card-h"><span class="card-t" id="pagosTitle">Formas de pago — hoy</span></div>
  <div id="pagosCards" style="padding:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;"></div>
</div>

<!-- Compras y Gastos -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
  <div class="card">
    <div class="card-h"><span class="card-t" id="comprasTitle">Compras — hoy</span></div>
    <div id="comprasWrap" style="padding:14px;"><div class="loading"><span class="sp"></span></div></div>
  </div>
  <div class="card">
    <div class="card-h"><span class="card-t" id="gastosTitle">Gastos — hoy</span></div>
    <div id="gastosWrap" style="padding:14px;"><div class="loading"><span class="sp"></span></div></div>
  </div>
</div>

<!-- Heatmap -->
<div class="card" style="margin-bottom:14px;">
  <div class="card-h"><span class="card-t">Horarios pico (últimos 30 días)</span></div>
  <div style="padding:14px;" id="heatmapWrap"></div>
</div>`;

  delete _dashCharts['ch7Dias'];
  delete _dashCharts['_heatDone'];

  if(typeof Chart==='undefined'){
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload=function(){ loadDashData(filtroD); };
    document.head.appendChild(s);
  } else {
    loadDashData(filtroD);
  }
}

function setFD(f,b){
  filtroD=f;
  document.querySelectorAll('.dbtn').forEach(function(x){x.classList.remove('on');});
  if(b) b.classList.add('on');
  loadDashData(f);
}

var _dashCharts={};
function _destroyChart(id){ if(_dashCharts[id]){try{_dashCharts[id].destroy();}catch(e){/* chart already destroyed */} delete _dashCharts[id];} }
function _mkChart(id,cfg){ _destroyChart(id); var el=document.getElementById(id); if(!el)return; _dashCharts[id]=new Chart(el,cfg); return _dashCharts[id]; }
function _isDark(){ return !document.documentElement.hasAttribute('data-theme')||document.documentElement.getAttribute('data-theme')==='dark'; }

async function loadDashData(f){
  var fd=getFD(f||'hoy');
  var hoy=new Date();
  var p2=function(n){return String(n).padStart(2,'0');};
  var fmt=function(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());};
  var isDark=_isDark();
  var textColor=isDark?'#888':'#666';
  var gridColor=isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)';
  var fontFam="'Barlow',sans-serif";
  var $$=function(id){return document.getElementById(id);};

  var periodLabel=f==='hoy'?'hoy':f==='semana'?'esta semana':'este mes';
  if($$('kTLabel')) $$('kTLabel').textContent='Ventas '+periodLabel;
  ['cat','prod','pagos','compras','gastos'].forEach(function(k){
    var el=$$( k+'Title');
    if(el) el.textContent=({'cat':'Participación por categoría','prod':'Productos más vendidos','pagos':'Formas de pago','compras':'Compras','gastos':'Gastos'}[k])+' — '+periodLabel;
  });

  try{
    // Datos del período
    var v=await sg('pos_ventas',
      'licencia_email=ilike.'+encodeURIComponent(SE)+
      '&fecha=gte.'+fd.d+'&fecha=lte.'+fd.h+'&order=fecha.desc&limit=500');
    var tot=v.reduce(function(s,x){return s+(x.total||0);},0);
    var cnt=v.length;
    var totEf=v.filter(function(x){return (x.metodo_pago||'').toUpperCase()==='EFECTIVO';})
               .reduce(function(s,x){return s+(x.total||0);},0);
    var totEl=tot-totEf;

    // Período anterior
    var ms={'hoy':86400000,'semana':7*86400000,'mes':30*86400000}[f]||86400000;
    var dAnt=new Date(new Date(fd.d)-ms), hAnt=new Date(new Date(fd.h)-ms);
    var vAnt=await sg('pos_ventas',
      'licencia_email=ilike.'+encodeURIComponent(SE)+
      '&fecha=gte.'+fmt(dAnt)+'T00:00:00&fecha=lte.'+fmt(hAnt)+'T23:59:59&limit=500');
    var totAnt=vAnt.reduce(function(s,x){return s+(x.total||0);},0);
    var cntAnt=vAnt.length;
    var avgAnt=cntAnt>0?Math.round(totAnt/cntAnt):0;
    var antLabel={'hoy':'ayer','semana':'semana ant.','mes':'mes ant.'}[f]||'período ant.';

    // KPIs
    if($$('kT')) $$('kT').textContent=gs(tot);
    if($$('kP')) $$('kP').textContent=gs(cnt>0?Math.round(tot/cnt):0);
    if($$('kC')){ $$('kC').textContent=cnt+' operaciones'; $$('kC').title='Prom. '+antLabel+': \u20B2'+gs(avgAnt); }
    if($$('kEf')) $$('kEf').textContent=gs(totEf);
    if($$('kEl')) $$('kEl').textContent=gs(totEl);
    if($$('kEfPct')) $$('kEfPct').textContent=tot>0?Math.round(totEf/tot*100)+'% del total':'0%';
    if($$('kElPct')) $$('kElPct').textContent=tot>0?Math.round(totEl/tot*100)+'% del total':'0%';
    if($$('kTdiff')){
      if(totAnt>0){
        var pct=Math.round((tot-totAnt)/totAnt*100);
        var col=pct>=0?'var(--green)':'var(--red)';
        $$('kTdiff').innerHTML='<span style="color:'+col+';font-weight:800;">'+(pct>=0?'↑':'↓')+' '+Math.abs(pct)+'%</span> vs '+antLabel;
        $$('kTdiff').title=antLabel+': \u20B2'+gs(totAnt);
      } else {
        $$('kTdiff').textContent=cnt+' ops · '+antLabel+': \u20B20';
      }
    }

    // Últimos 7 días — siempre fijo
    if(!_dashCharts['ch7Dias']) await _render7Dias(hoy,fmt,p2,textColor,gridColor,fontFam);

    // Insights — día y hora más activos (últimos 30 días)
    _renderInsights(hoy,fmt,p2);

    // Parsear items del período
    var catsMap={}, prodsMap={};
    v.forEach(function(x){
      try{
        var items=typeof x.items==='string'?JSON.parse(x.items):(x.items||[]);
        if(!Array.isArray(items)) return;
        items.forEach(function(it){
          if(it.esDescuento) return;
          var cat=it.cat||it.category||it.categoria||'Sin categoría';
          var nom=it.name||it.nombre||'—';
          var qty=it.qty||1;
          var sub=(it.price||0)*qty;
          if(!catsMap[cat]) catsMap[cat]={tot:0,qty:0};
          catsMap[cat].tot+=sub; catsMap[cat].qty+=qty;
          if(!prodsMap[nom]) prodsMap[nom]={tot:0,qty:0,cat:cat};
          prodsMap[nom].tot+=sub; prodsMap[nom].qty+=qty;
        });
      }catch(e){ console.warn('[Dash] Error parseando items venta:', e.message); }
    });

    // Gráfico categorías — donut con %
    var catEntries=Object.entries(catsMap).sort(function(a,b){return b[1].tot-a[1].tot;});
    var catColors=['rgba(76,175,80,0.9)','rgba(66,165,245,0.9)','rgba(255,152,0,0.9)','rgba(239,83,80,0.9)','rgba(171,71,188,0.9)','rgba(0,188,212,0.9)','rgba(255,235,59,0.85)','rgba(255,87,34,0.9)'];
    _destroyChart('chCats');
    if($$('catWrap')){
      if(!catEntries.length){
        $$('catWrap').innerHTML='<div style="color:var(--muted);font-size:13px;">Sin datos</div>';
      } else {
        $$('catWrap').innerHTML='<canvas id="chCats" style="max-width:240px;max-height:240px;"></canvas>';
        _mkChart('chCats',{
          type:'doughnut',
          data:{
            labels:catEntries.map(function(e){return e[0];}),
            datasets:[{
              data:catEntries.map(function(e){return e[1].tot;}),
              backgroundColor:catColors,borderWidth:2,
              borderColor:isDark?'#161616':'#fff'
            }]
          },
          options:{
            responsive:false,
            plugins:{
              legend:{position:'bottom',labels:{color:textColor,font:{family:fontFam,size:10},padding:8,boxWidth:12}},
              tooltip:{callbacks:{
                label:function(c){
                  var pct=Math.round(c.raw/tot*100);
                  return ' '+c.label+': \u20B2'+gs(c.raw)+' ('+pct+'%)';
                }
              }}
            }
          }
        });
      }
    }

    // Productos más vendidos
    var prodEntries=Object.entries(prodsMap).sort(function(a,b){return b[1].tot-a[1].tot;}).slice(0,10);
    if($$('topProdsList')){
      if(!prodEntries.length){
        $$('topProdsList').innerHTML='<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">Sin datos</div>';
      } else {
        var maxT=prodEntries[0][1].tot||1;
        $$('topProdsList').innerHTML=prodEntries.map(function(e,i){
          var pct=Math.round(e[1].tot/maxT*100);
          var catIdx=catEntries.findIndex(function(c){return c[0]===e[1].cat;});
          var col=catColors[catIdx>=0?catIdx%catColors.length:0];
          return '<div style="padding:8px 16px;'+(i<prodEntries.length-1?'border-bottom:1px solid var(--border);':'')+'">'+
            '<div style="display:flex;justify-content:space-between;margin-bottom:5px;">'+
            '<span style="font-size:12px;font-weight:700;color:var(--text);max-width:65%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+e[0]+'</span>'+
            '<span style="font-size:12px;font-weight:700;color:var(--text);">\u20B2'+gs(e[1].tot)+'</span>'+
            '</div>'+
            '<div style="display:flex;align-items:center;gap:8px;">'+
            '<div style="flex:1;height:5px;background:var(--border);border-radius:3px;">'+
            '<div style="width:'+pct+'%;height:5px;background:'+col+';border-radius:3px;"></div></div>'+
            '<span style="font-size:11px;color:var(--muted);min-width:32px;text-align:right;">'+e[1].qty+'u.</span>'+
            '</div></div>';
        }).join('');
      }
    }

    // Formas de pago
    var pagosMap={};
    v.forEach(function(x){
      var m3=(x.metodo_pago||'EFECTIVO').toUpperCase();
      if(!pagosMap[m3]) pagosMap[m3]={tot:0,cnt:0};
      pagosMap[m3].tot+=(x.total||0); pagosMap[m3].cnt++;
    });
    var pEntries=Object.entries(pagosMap).sort(function(a,b){return b[1].tot-a[1].tot;});
    var pColores={'EFECTIVO':'var(--green)','POS':'var(--blue)','TRANSFERENCIA':'var(--orange)'};
    var pIconos={'EFECTIVO':'💵','POS':'💳','TRANSFERENCIA':'🏦'};
    if($$('pagosCards')){
      $$('pagosCards').innerHTML=pEntries.length?pEntries.map(function(e){
        var pct=tot>0?Math.round(e[1].tot/tot*100):0;
        var col=pColores[e[0]]||'var(--muted)';
        var ico=pIconos[e[0]]||'💰';
        return '<div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;position:relative;overflow:hidden;">'+
          '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:'+col+';"></div>'+
          '<div style="font-size:20px;margin-bottom:6px;">'+ico+'</div>'+
          '<div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px;">'+e[0]+'</div>'+
          '<div style="font-size:20px;font-weight:800;color:'+col+';">\u20B2'+gs(e[1].tot)+'</div>'+
          '<div style="font-size:12px;color:var(--muted);margin-top:4px;">'+pct+'% · '+e[1].cnt+' ops</div>'+
          '</div>';
      }).join(''):'<div style="color:var(--muted);font-size:13px;">Sin ventas</div>';
    }

    // Compras y gastos
    _renderComprasGastos(fd);

    // Heatmap
    if(!_dashCharts['_heatDone']) await _renderHeatmap(hoy,fmt,p2,textColor);

  }catch(e){ toast('Error al cargar dashboard'); console.warn('[Dash]',e.message); }
}

async function _render7Dias(hoy,fmt,p2,textColor,gridColor,fontFam){
  // Últimos 7 días con fecha real
  var labels=[], totales=[], costos=[];
  var diasSem=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  var meses=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  for(var i=6;i>=0;i--){
    var d=new Date(hoy); d.setDate(hoy.getDate()-i);
    labels.push(diasSem[d.getDay()]+' '+d.getDate());
    totales.push(0); costos.push(0);
  }

  var hace7=new Date(hoy); hace7.setDate(hoy.getDate()-6); hace7.setHours(0,0,0,0);
  var v7=await sg('pos_ventas',
    'licencia_email=ilike.'+encodeURIComponent(SE)+
    '&fecha=gte.'+fmt(hace7)+'T00:00:00&fecha=lte.'+fmt(hoy)+'T23:59:59&limit=1000');
  v7.forEach(function(x){
    var d=new Date(x.fecha);
    var diffDays=Math.round((new Date(fmt(d))-new Date(fmt(hace7)))/(86400000));
    if(diffDays>=0&&diffDays<7){
      totales[diffDays]+=(x.total||0);
      // Sumar costos de items
      try{
        var items=typeof x.items==='string'?JSON.parse(x.items):(x.items||[]);
        items.forEach(function(it){
          if(!it.esDescuento) costos[diffDays]+=(it.costo||0)*(it.qty||1);
        });
      }catch(e){ console.warn('[Dash] Error parseando items 7dias:', e.message); }
    }
  });
  var utilidad=totales.map(function(t,i){return Math.max(0,t-costos[i]);});

  _mkChart('ch7Dias',{
    type:'bar',
    data:{
      labels:labels,
      datasets:[
        {label:'Ventas',data:totales,backgroundColor:'rgba(66,165,245,0.85)',borderRadius:4,borderWidth:0},
        {label:'Costos',data:costos,backgroundColor:'rgba(200,200,200,0.4)',borderRadius:4,borderWidth:0,hidden:true},
        {label:'Utilidad',data:utilidad,backgroundColor:'rgba(76,175,80,0.7)',borderRadius:4,borderWidth:0,hidden:true}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{position:'bottom',labels:{color:textColor,font:{family:fontFam,size:11},padding:12,boxWidth:12}},
        tooltip:{callbacks:{label:function(c){return ' '+c.dataset.label+': \u20B2'+gs(c.raw);}}}
      },
      scales:{
        x:{ticks:{color:textColor,font:{family:fontFam,size:10}},grid:{color:gridColor}},
        y:{ticks:{color:textColor,font:{family:fontFam,size:10},callback:function(v2){
          if(v2>=1000000) return 'Gs '+Math.round(v2/1000000)+'M';
          if(v2>=1000) return 'Gs '+Math.round(v2/1000)+'k';
          return 'Gs '+v2;
        }},grid:{color:gridColor}}
      }
    }
  });
}

async function _renderInsights(hoy,fmt,p2){
  var diasNom=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  var $$=function(id){return document.getElementById(id);};
  var hace30=new Date(hoy); hace30.setDate(hoy.getDate()-30);
  try{
    var vH=await sg('pos_ventas',
      'licencia_email=ilike.'+encodeURIComponent(SE)+
      '&fecha=gte.'+fmt(hace30)+'T00:00:00&fecha=lte.'+fmt(hoy)+'T23:59:59&limit=2000');
    // Día más activo — mismo mapeo que heatmap: lun=0 ... dom=6
    var diaMap=new Array(7).fill(0), diaCount=new Array(7).fill(0);
    var hrMap=new Array(24).fill(0), hrCount=new Array(24).fill(0);
    var diasVistos={};
    vH.forEach(function(x){
      var d=new Date(x.fecha);
      var dow=(d.getDay()||7)-1; // lun=0, mar=1 ... dom=6
      var hr=d.getHours();
      var dayKey=fmt(d);
      if(!diasVistos[dayKey]) diasVistos[dayKey]=dow;
      diaMap[dow]+=(x.total||0);
      diaCount[dow]++;
      hrMap[hr]+=(x.total||0);
      hrCount[hr]++;
    });
    // Contar cuántos días únicos hubo de cada dow
    var dowCount=new Array(7).fill(0);
    Object.values(diasVistos).forEach(function(dow){dowCount[dow]++;});
    var maxDia=0, maxDiaIdx=0;
    for(var d2=0;d2<7;d2++){
      var avg=dowCount[d2]>0?diaMap[d2]/dowCount[d2]:0;
      if(avg>maxDia){maxDia=avg;maxDiaIdx=d2;}
    }
    if($$('diaMasActivo')) $$('diaMasActivo').textContent=diasNom[maxDiaIdx];
    if($$('diaMasActivoSub')) $$('diaMasActivoSub').textContent='Prom. ventas: \u20B2'+gs(Math.round(maxDia));

    var maxHr=0, maxHrIdx=0;
    for(var h2=0;h2<24;h2++){
      var avgH=hrCount[h2]>0?hrMap[h2]/hrCount[h2]:0;
      if(avgH>maxHr){maxHr=avgH;maxHrIdx=h2;}
    }
    if($$('horaMasActiva')) $$('horaMasActiva').textContent=p2(maxHrIdx)+':00';
    if($$('horaMasActivaSub')) $$('horaMasActivaSub').textContent='Prom. \u20B2'+gs(Math.round(maxHr))+' por hora';
  }catch(e){ toast('Error al cargar insights'); console.warn('[Insights]',e.message); }
}

async function _renderComprasGastos(fd){
  var $$=function(id){return document.getElementById(id);};

  // Obtener licencia_id
  var licId=SLI;
  if(!licId){
    try{ licId=(await sg('licencias','email_cliente=ilike.'+encodeURIComponent(SE)+'&activa=eq.true&select=id&limit=1'))[0].id; SLI=licId; }catch(e){ console.warn('[Dash] Error obteniendo licencia:', e.message); }
  }

  var _card=function(tot,cnt,rows,tipo){
    var col=tipo==='compras'?'var(--red)':'var(--orange)';
    if(!cnt) return '<div style="color:var(--muted);font-size:13px;padding:8px 0;">Sin registros en el período</div>';
    return '<div style="margin-bottom:12px;">'+
      '<div style="font-size:26px;font-weight:800;color:'+col+';">\u20B2'+gs(tot)+'</div>'+
      '<div style="font-size:12px;color:var(--muted);margin-top:2px;">'+cnt+' registros</div></div>'+
      rows.slice(0,5).map(function(r,i){
        var desc=r.proveedor||r.concepto||r.descripcion||(tipo==='compras'?'Compra':'Gasto');
        var monto=r.total||r.monto||0;
        return '<div style="display:flex;justify-content:space-between;padding:7px 0;'+(i<Math.min(rows.length,5)-1?'border-bottom:1px solid var(--border);':'')+'font-size:13px;">'+
          '<span style="color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%;">'+desc+'</span>'+
          '<span style="font-weight:700;">\u20B2'+gs(monto)+'</span></div>';
      }).join('');
  };

  if(!licId){
    if($$('comprasWrap')) $$('comprasWrap').innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0;">Sin licencia</div>';
    if($$('gastosWrap')) $$('gastosWrap').innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0;">Sin licencia</div>';
    return;
  }

  var fd0=fd.d.substring(0,10), fh0=fd.h.substring(0,10);

  // Compras — tabla stock_comprobantes con licencia_id
  try{
    var comp=await sg('stock_comprobantes',
      'licencia_id=eq.'+licId+
      '&tipo=in.(compra,entrada)'+
      '&fecha=gte.'+fd0+'T00:00:00'+
      '&fecha=lte.'+fh0+'T23:59:59'+
      '&order=fecha.desc&limit=100');
    var totC=comp.reduce(function(s,x){return s+(x.total||x.monto||0);},0);
    if($$('comprasWrap')) $$('comprasWrap').innerHTML=_card(totC,comp.length,comp,'compras');
  }catch(e){ if($$('comprasWrap')) $$('comprasWrap').innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0;">Sin datos de compras</div>'; }

  // Gastos — tabla gastos con licencia_id
  try{
    var gast=await sg('gastos',
      'licencia_id=eq.'+licId+
      '&fecha=gte.'+fd0+
      '&fecha=lte.'+fh0+
      '&order=fecha.desc&limit=100');
    var totG=gast.reduce(function(s,x){return s+(x.monto||x.total||0);},0);
    if($$('gastosWrap')) $$('gastosWrap').innerHTML=_card(totG,gast.length,gast,'gastos');
  }catch(e){ if($$('gastosWrap')) $$('gastosWrap').innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0;">Sin datos de gastos</div>'; }
}

async function _renderHeatmap(hoy,fmt,p2,textColor){
  var heatData=new Array(7).fill(null).map(function(){return new Array(24).fill(0);});
  var hace30=new Date(hoy); hace30.setDate(hoy.getDate()-30);
  var vH=await sg('pos_ventas',
    'licencia_email=ilike.'+encodeURIComponent(SE)+
    '&fecha=gte.'+fmt(hace30)+'T00:00:00&fecha=lte.'+fmt(hoy)+'T23:59:59&limit=2000');
  vH.forEach(function(x){var d4=new Date(x.fecha);heatData[(d4.getDay()||7)-1][d4.getHours()]+=(x.total||0);});
  var maxH=Math.max.apply(null,heatData.map(function(r){return Math.max.apply(null,r);}));
  var diasN=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  var html='<div style="overflow-x:auto;"><div style="display:grid;grid-template-columns:40px repeat(24,1fr);gap:2px;min-width:600px;">';
  html+='<div></div>';
  for(var h2=0;h2<24;h2++) html+='<div style="text-align:center;font-size:9px;color:'+textColor+';padding:2px 0;">'+p2(h2)+'</div>';
  for(var dw=0;dw<7;dw++){
    html+='<div style="font-size:10px;color:'+textColor+';display:flex;align-items:center;font-weight:700;">'+diasN[dw]+'</div>';
    for(var hr2=0;hr2<24;hr2++){
      var val=heatData[dw][hr2];
      var intensity=maxH>0?val/maxH:0;
      var alpha=val>0&&intensity<0.08?0.1:intensity;
      html+='<div title="'+diasN[dw]+' '+p2(hr2)+':00 \u2014 \u20B2'+gs(val)+'" style="height:22px;border-radius:3px;background:rgba(76,175,80,'+alpha.toFixed(2)+');cursor:default;"></div>';
    }
  }
  html+='</div><div style="display:flex;align-items:center;gap:6px;margin-top:10px;justify-content:flex-end;">';
  html+='<span style="font-size:10px;color:'+textColor+';">Bajo</span>';
  for(var li=0;li<=4;li++){html+='<div style="width:16px;height:16px;border-radius:3px;background:rgba(76,175,80,'+(li/4*0.9+0.06).toFixed(2)+');"></div>';}
  html+='<span style="font-size:10px;color:'+textColor+';">Alto</span></div></div>';
  var hwrap=document.getElementById('heatmapWrap');
  if(hwrap) hwrap.innerHTML=html;
  _dashCharts['_heatDone']=true;
}



function renderVentas(){
  var c=document.getElementById('content');
  var p2=function(n){return String(n).padStart(2,'0');};
  var hoy=new Date();
  var fmtDate=function(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());};
  var hoyStr=fmtDate(hoy);
  var lunesStr=fmtDate(new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate()-((hoy.getDay()||7)-1)));
  var mes1Str=fmtDate(new Date(hoy.getFullYear(),hoy.getMonth(),1));

  c.innerHTML='<div class="ph"><div><div class="pt">Historial de Ventas</div><div class="ps">Todas las transacciones</div></div></div>'+
    // Filtros rápidos + rango personalizado
    '<div class="card" style="margin-bottom:14px;padding:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">'+
      '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:4px;">Período rápido</div>'+
      '<div style="display:flex;gap:6px;">'+
        '<button class="dbtn on" id="vBtn_hoy" onclick="setFV(\'hoy\',this)">Hoy</button>'+
        '<button class="dbtn" id="vBtn_semana" onclick="setFV(\'semana\',this)">Semana</button>'+
        '<button class="dbtn" id="vBtn_mes" onclick="setFV(\'mes\',this)">Mes</button>'+
      '</div></div>'+
      '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:4px;">Desde</div>'+
        '<input type="date" id="vFD" class="d-inp" value="'+hoyStr+'"></div>'+
      '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:4px;">Hasta</div>'+
        '<input type="date" id="vFH" class="d-inp" value="'+hoyStr+'"></div>'+
      '<button class="btn-sv" onclick="setFV(\'custom\',null)">Buscar</button>'+
    '</div>'+
    '<div class="card" style="margin-bottom:14px;"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:14px;" id="vKpis"></div></div>'+
    '<div class="card"><div class="card-h"><span class="card-t" id="vCount">—</span><input class="c-srch" placeholder="Buscar..." oninput="filtrV(this.value)"></div>'+
    '<table><thead><tr><th>Fecha/Hora</th><th>Terminal</th><th>Tipo</th><th>Método</th><th style="text-align:right">Total</th><th style="width:32px;"></th></tr></thead>'+
    '<tbody id="vBody"><tr><td colspan="6" class="loading"><span class="sp"></span></td></tr></tbody></table></div>';
  loadVData('hoy');
}

function setFV(f,b){
  filtroV=f;
  document.querySelectorAll('#vBtn_hoy,#vBtn_semana,#vBtn_mes').forEach(function(x){x.classList.remove('on');});
  if(b) b.classList.add('on');
  // Sincronizar inputs de fecha con el botón
  var p2=function(n){return String(n).padStart(2,'0');};
  var hoy=new Date();
  var fmtDate=function(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());};
  var fd=document.getElementById('vFD'), fh=document.getElementById('vFH');
  if(f==='hoy'&&fd&&fh){ var s=fmtDate(hoy); fd.value=s; fh.value=s; }
  if(f==='semana'&&fd&&fh){ var l=new Date(hoy); l.setDate(hoy.getDate()-((hoy.getDay()||7)-1)); fd.value=fmtDate(l); fh.value=fmtDate(hoy); }
  if(f==='mes'&&fd&&fh){ fd.value=fmtDate(new Date(hoy.getFullYear(),hoy.getMonth(),1)); fh.value=fmtDate(hoy); }
  loadVData(f);
}

async function loadVData(f){
  var body=document.getElementById('vBody');
  if(body) body.innerHTML='<tr><td colspan="6" class="loading"><span class="sp"></span></td></tr>';

  var desde, hasta;
  if(f==='custom'||f===undefined){
    // Rango personalizado desde los inputs
    var fdEl=document.getElementById('vFD'), fhEl=document.getElementById('vFH');
    desde=(fdEl?fdEl.value:'');
    hasta=(fhEl?fhEl.value:'');
    if(!desde||!hasta) return;
  } else {
    var fd=getFD(f);
    desde=fd.d.substring(0,10);
    hasta=fd.h.substring(0,10);
  }

  // Ajuste de zona horaria Paraguay (UTC-4): pedir con offset
  // Para cubrir el día local completo, pedimos desde las 04:00 UTC del día (=00:00 PY)
  // hasta las 03:59 UTC del día siguiente (=23:59 PY)
  var desdeTZ=desde+'T04:00:00';
  var hastaTZ=hasta+'T27:59:59'; // Supabase acepta esto, pero mejor usar día+1
  // Calcular día siguiente para el hasta
  var hastaDate=new Date(hasta+'T00:00:00');
  hastaDate.setDate(hastaDate.getDate()+1);
  var p2=function(n){return String(n).padStart(2,'0');};
  var hastaNext=hastaDate.getFullYear()+'-'+p2(hastaDate.getMonth()+1)+'-'+p2(hastaDate.getDate())+'T03:59:59';

  try{
    allVP=await sg('pos_ventas',
      'licencia_email=ilike.'+encodeURIComponent(SE)+
      '&fecha=gte.'+desdeTZ+
      '&fecha=lte.'+hastaNext+
      '&order=fecha.desc&limit=500');
    renderVT(allVP);
  }catch(e){
    if(document.getElementById('vBody'))
      document.getElementById('vBody').innerHTML='<tr><td colspan="6" class="loading">Error cargando</td></tr>';
  }
}

function renderVT(v){
  if(!document.getElementById('vCount')) return;
  var tot=v.reduce(function(s,x){return s+(x.total||0);},0);
  var ef=v.filter(function(x){return (x.metodo_pago||'').toUpperCase()==='EFECTIVO';}).reduce(function(s,x){return s+(x.total||0);},0);
  document.getElementById('vCount').textContent=v.length+' ventas — Total: \u20B2'+gs(tot);

  var kEl=document.getElementById('vKpis');
  if(kEl) kEl.innerHTML=
    '<div style="text-align:center;"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;">Total</div><div style="font-size:22px;font-weight:800;color:var(--green);">\u20B2'+gs(tot)+'</div></div>'+
    '<div style="text-align:center;"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;">Efectivo</div><div style="font-size:22px;font-weight:800;color:var(--green);">\u20B2'+gs(ef)+'</div></div>'+
    '<div style="text-align:center;"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px;">POS / Transfer.</div><div style="font-size:22px;font-weight:800;color:var(--orange);">\u20B2'+gs(tot-ef)+'</div></div>';

  var mb=function(m){var u=(m||'').toUpperCase();return u==='EFECTIVO'?'<span class="tag tag-g">EF</span>':u==='POS'?'<span class="tag tag-b">POS</span>':'<span class="tag tag-o">TR</span>';};
  var tipoTag=function(x){
    var tieneF=x.tiene_factura||false;
    try{ if(x.factura){ var fac=typeof x.factura==='string'?JSON.parse(x.factura):x.factura; if(fac&&fac.nro_factura) tieneF=true; } }catch(e){ console.warn('[Ventas] Error parseando factura:', e.message); }
    return tieneF?'<span class="tag tag-b" style="font-size:10px;">FACTURA</span>':'<span class="tag tag-gr" style="font-size:10px;">TICKET</span>';
  };
  var detalleHtml=function(x){
    var items=[];
    try{ items=typeof x.items==='string'?JSON.parse(x.items):(x.items||[]); }catch(e){ console.warn('[Ventas] Error parseando items:', e.message); }
    var factura=null;
    try{ factura=x.factura?(typeof x.factura==='string'?JSON.parse(x.factura):x.factura):null; }catch(e){ console.warn('[Ventas] Error parseando factura detalle:', e.message); }
    return '<tr id="det_'+x.id+'" style="display:none;"><td colspan="6" style="padding:0;background:var(--card2);">'+
      '<div style="padding:14px;border-top:2px solid var(--green);">'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px;">'+
      '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;">Terminal</div><div style="font-weight:700;">'+(x.terminal||'—')+'</div></div>'+
      '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;">Método</div><div style="font-weight:700;">'+(x.metodo_pago||'—').toUpperCase()+'</div></div>'+
      '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;">Total</div><div style="font-weight:800;color:var(--green);">\u20B2'+gs(x.total)+'</div></div>'+
      (factura&&factura.nro_factura?'<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;">N° Factura</div><div style="font-weight:700;color:var(--blue);">'+factura.nro_factura+'</div></div>':'')+
      (factura&&factura.nombre?'<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;">Cliente</div><div style="font-weight:700;">'+factura.nombre+'</div></div>':'')+
      '</div>'+
      '<table style="font-size:12px;"><thead><tr>'+
        '<th>Producto</th><th>Categoría</th><th style="text-align:center">Cant.</th>'+
        '<th style="text-align:right">P.Unit</th><th style="text-align:right">Subtotal</th>'+
      '</tr></thead><tbody>'+
      (items.filter(function(it){return !it.esDescuento;}).map(function(it){
        return '<tr><td style="font-weight:600;">'+(it.name||it.nombre||'—')+'</td>'+
          '<td style="color:var(--muted);">'+(it.cat||it.categoria||'—')+'</td>'+
          '<td style="text-align:center;">'+(it.qty||1)+'</td>'+
          '<td style="text-align:right;">\u20B2'+gs(it.price||0)+'</td>'+
          '<td style="text-align:right;font-weight:700;">\u20B2'+gs((it.price||0)*(it.qty||1))+'</td></tr>';
      }).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--muted);">Sin detalle</td></tr>')+
      '</tbody></table></div></td></tr>';
  };

  document.getElementById('vBody').innerHTML=v.length?v.map(function(x){
    return '<tr style="cursor:pointer;" onclick="vDetalle(\''+x.id+'\')">'+
      '<td style="font-size:12px;">'+fmtDT(x.fecha)+'</td>'+
      '<td>'+(x.terminal||'—')+'</td>'+
      '<td>'+tipoTag(x)+'</td>'+
      '<td>'+mb(x.metodo_pago)+'</td>'+
      '<td style="text-align:right;font-weight:700;">\u20B2'+gs(x.total)+'</td>'+
      '<td style="text-align:center;color:var(--muted);"><span id="arr_'+x.id+'">▶</span></td>'+
      '</tr>'+
      detalleHtml(x);
  }).join(''):'<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--muted)">Sin ventas en el período</td></tr>';
}

function vDetalle(id){
  var row=document.getElementById('det_'+id);
  var arr=document.getElementById('arr_'+id);
  if(!row) return;
  var visible=row.style.display!=='none';
  // Cerrar todos
  allVP.forEach(function(x){
    var r=document.getElementById('det_'+x.id);
    var a=document.getElementById('arr_'+x.id);
    if(r) r.style.display='none';
    if(a) a.textContent='▶';
  });
  // Abrir este si estaba cerrado
  if(!visible){
    row.style.display='';
    if(arr) arr.textContent='▼';
    setTimeout(function(){ row.scrollIntoView({behavior:'smooth',block:'nearest'}); },100);
  }
}

function filtrV(q){
  if(!allVP||!allVP.length) return;
  var f=q.toLowerCase();
  renderVT(!q?allVP:allVP.filter(function(v){
    return (v.terminal||'').toLowerCase().includes(f)||
           (v.metodo_pago||'').toLowerCase().includes(f)||
           (v.sucursal||'').toLowerCase().includes(f)||
           gs(v.total).includes(f);
  }));
}

// ── TERMINALES ────────────────────────────────────────────
async function renderTerminales(){
  document.getElementById('content').innerHTML='<div class="ph"><div><div class="pt">Terminales</div><div class="ps">Dispositivos registrados</div></div></div><div id="terBody"><div class="loading"><span class="sp"></span>Cargando...</div></div>';
  try{
    var now=new Date();
    // Query activaciones (source of truth for registered terminals)
    var acts=[];
    try{acts=await sg('activaciones','email=ilike.'+encodeURIComponent(SE)+'&activa=eq.true&select=id,device_id,nombre_terminal,sucursal,updated_at');}catch(e2){console.warn('activaciones err:',e2.message);}
    // Also query pos_ventas to get activity stats per terminal
    var v=[];
    try{v=await sg('pos_ventas','licencia_email=ilike.'+encodeURIComponent(SE)+'&order=fecha.desc&limit=1000');}catch(e3){console.warn('ventas err:',e3.message);}
    var m={};
    v.forEach(function(x){
      var k=(x.terminal||'Principal');
      if(!m[k])m[k]={t:x.terminal||'Principal',s:x.sucursal||'—',tot:0,ops:0,ul:null};
      m[k].tot+=x.total||0;m[k].ops++;
      if(!m[k].ul||x.fecha>m[k].ul)m[k].ul=x.fecha;
    });
    // Merge activaciones into map (show all registered terminals, even those with no sales)
    acts.forEach(function(a){
      var k=a.nombre_terminal||a.device_id||'—';
      if(!m[k])m[k]={t:k,s:a.sucursal||'—',tot:0,ops:0,ul:a.updated_at||null};
      else{m[k].t=k;if(a.sucursal)m[k].s=a.sucursal;}
      m[k].device_id=a.device_id;
      m[k].activ_id=a.id;
    });
    var items=Object.values(m);
    if(!items.length){document.getElementById('terBody').innerHTML='<div class="empty"><div class="empty-i">📱</div><div class="empty-t">Sin terminales registradas</div></div>';return;}
    document.getElementById('terBody').innerHTML='<div class="tg">'+items.map(function(t){
      var ul=t.ul?new Date(t.ul):null;
      var on=ul&&(now-ul)<25*3600000;
      return '<div class="tc '+(on?'on':'')+'">'
        +'<div class="tc-h"><div><div class="tc-n">'+t.t+'</div><div class="tc-s">'+t.s+(t.device_id?'<br><span style="font-size:10px;color:var(--muted);font-family:monospace;">'+t.device_id+'</span>':'')+'</div></div>'
        +'<span class="tag '+(on?'tag-g':'tag-gr')+'">'+(on?'Online':'Offline')+'</span></div>'
        +'<div class="tc-r"><span style="color:var(--muted)">Ventas</span><span style="color:var(--green);font-weight:700">'+gs(t.tot)+'</span></div>'
        +'<div class="tc-r"><span style="color:var(--muted)">Ops</span><span style="font-weight:700">'+t.ops+'</span></div>'
        +'<div class="tc-r"><span style="color:var(--muted)">Última act.</span><span>'+fmtDT(t.ul)+'</span></div>'
        +'</div>';
    }).join('')+'</div>';
  }catch(e){document.getElementById('terBody').innerHTML='<div class="loading">Error: '+e.message+'</div>';console.error(e);}
}

// ── CAJAS ─────────────────────────────────────────────────
async function renderCajas(){
  document.getElementById('content').innerHTML='<div class="ph"><div><div class="pt">Cajas / Turnos</div><div class="ps">Control por terminal</div></div><div class="dbar"><button class="dbtn on" onclick="filtrCj(\'todas\',this)">Todas</button><button class="dbtn" onclick="filtrCj(\'abiertas\',this)">Abiertas</button><button class="dbtn" onclick="filtrCj(\'cerradas\',this)">Cerradas</button></div></div><div class="kg k3"><div class="kc" style="--c:var(--green)"><div class="kc-l">Abiertas</div><div class="kc-v" id="cjA">—</div></div><div class="kc" style="--c:var(--orange)"><div class="kc-l">Cerradas hoy</div><div class="kc-v" id="cjC">—</div></div><div class="kc" style="--c:var(--blue)"><div class="kc-l">Recaudado hoy</div><div class="kc-v" id="cjT">₲0</div></div></div><div id="cajasBody"><div class="loading"><span class="sp"></span>Cargando...</div></div>';
  try{allCjs=await sg('pos_turno','licencia_email=ilike.'+encodeURIComponent(SE)+'&order=fecha_apertura.desc&limit=100');}
  catch(e){ toast('Error al cargar cajas'); console.warn('[Cajas]', e.message); allCjs=[]; }
  renderCajasData();
}

function filtrCj(f,b){filtroCj=f;document.querySelectorAll('.dbtn').forEach(function(x){x.classList.remove('on');});if(b)b.classList.add('on');renderCajasData();}

function renderCajasData(){
  if(!document.getElementById('cajasBody')) return;
  var l=filtroCj==='abiertas'?allCjs.filter(function(c){return c.estado==='abierto';}):filtroCj==='cerradas'?allCjs.filter(function(c){return c.estado==='cerrado';}):allCjs;
  var hoy=new Date(),fd=hoy.getFullYear()+'-'+pad(hoy.getMonth()+1)+'-'+pad(hoy.getDate());
  if(document.getElementById('cjA')) document.getElementById('cjA').textContent=allCjs.filter(function(c){return c.estado==='abierto';}).length;
  if(document.getElementById('cjC')) document.getElementById('cjC').textContent=allCjs.filter(function(c){return c.estado==='cerrado'&&(c.fecha_cierre||'').startsWith(fd);}).length;
  if(document.getElementById('cjT')) document.getElementById('cjT').textContent=gs(allCjs.filter(function(c){return (c.fecha_apertura||'').startsWith(fd);}).reduce(function(s,c){return s+(c.total_vendido||0);},0));
  if(!l.length){document.getElementById('cajasBody').innerHTML='<div class="empty"><div class="empty-i">\u{1F5C3}\uFE0F</div><div class="empty-t">Sin cajas</div><div class="empty-s">No hay turnos registrados</div></div>';return;}
  document.getElementById('cajasBody').innerHTML=l.map(function(c,i){
    var ab=c.estado==='abierto';
    var durTxt='';
    if(c.fecha_apertura&&c.fecha_cierre){var ms=new Date(c.fecha_cierre)-new Date(c.fecha_apertura);durTxt=Math.floor(ms/3600000)+'h '+Math.floor((ms%3600000)/60000)+'m';}
    else if(c.fecha_apertura&&ab){var ms2=Date.now()-new Date(c.fecha_apertura);durTxt=Math.floor(ms2/3600000)+'h '+Math.floor((ms2%3600000)/60000)+'m (en curso)';}
    var pagos='';
    if(c.resumen_pagos){try{var rp=typeof c.resumen_pagos==='string'?JSON.parse(c.resumen_pagos):c.resumen_pagos;pagos=Object.keys(rp).map(function(k){return '<div class="cj-dr"><span style="color:var(--muted)">'+k+'</span><span style="font-weight:600">'+gs(rp[k])+'</span></div>';}).join('');}catch(ex){ console.warn('[Cajas] Error parseando resumen_pagos:', ex.message); }}
    if(!pagos){if(c.total_efectivo!=null)pagos+='<div class="cj-dr"><span style="color:var(--muted)">Efectivo</span><span style="font-weight:600">'+gs(c.total_efectivo)+'</span></div>';if(c.total_tarjeta!=null)pagos+='<div class="cj-dr"><span style="color:var(--muted)">Tarjeta/POS</span><span style="font-weight:600">'+gs(c.total_tarjeta)+'</span></div>';if(c.total_transfer!=null)pagos+='<div class="cj-dr"><span style="color:var(--muted)">Transferencia</span><span style="font-weight:600">'+gs(c.total_transfer)+'</span></div>';}
    var difHTML='';
    if(!ab&&c.efectivo_inicial!=null&&c.total_efectivo!=null&&c.efectivo_cierre!=null){var esp=(c.efectivo_inicial||0)+(c.total_efectivo||0),dif=(c.efectivo_cierre||0)-esp,dc=dif===0?'var(--muted)':dif>0?'var(--green)':'var(--red)';difHTML='<div class="cj-dr"><span style="color:var(--muted)">Esperado</span><span>'+gs(esp)+'</span></div><div class="cj-dr"><span style="color:var(--muted)">Al cierre</span><span>'+gs(c.efectivo_cierre)+'</span></div><div class="cj-dr"><span style="color:var(--muted)">Diferencia</span><span style="font-weight:700;color:'+dc+'">'+(dif>=0?'+':'')+gs(dif)+'</span></div>';}
    return '<div class="cj '+(ab?'op':'cl')+'">'
      +'<div class="cj-h" onclick="togCj('+i+')">'
        +'<div style="width:40px;height:40px;border-radius:10px;background:'+(ab?'var(--g2)':'var(--card2)')+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'
          +'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="'+(ab?'var(--green)':'var(--muted)')+'" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>'
        +'</div>'
        +'<div class="cj-info">'
          +'<div class="cj-tit">'+(c.terminal||'Terminal')+(c.sucursal?' &nbsp;<span style="color:var(--muted);font-size:12px;font-weight:400">'+c.sucursal+'</span>':'')+'</div>'
          +'<div class="cj-meta" style="margin-top:3px">'+(ab?'<span style="color:var(--green)">\u25CF Abierta</span> \u00b7 Desde '+fmtDT(c.fecha_apertura)+(durTxt?' \u00b7 '+durTxt:''):'Cerrada '+fmtDT(c.fecha_cierre)+(durTxt?' \u00b7 '+durTxt:''))+'</div>'
          +(c.nombre_operador?'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+c.nombre_operador+'</div>':'')
        +'</div>'
        +'<div style="text-align:right;flex-shrink:0">'
          +'<div style="font-size:18px;font-weight:800;color:var(--green)">'+gs(c.total_vendido||0)+'</div>'
          +'<div style="font-size:11px;color:var(--muted)">'+(c.total_operaciones||c.cantidad_ventas||0)+' ventas</div>'
          +'<span class="tag '+(ab?'tag-g':'tag-gr')+'" style="margin-top:4px">'+(ab?'ABIERTA':'CERRADA')+'</span>'
        +'</div>'
      +'</div>'
      +'<div class="cj-b" id="cjB'+i+'">'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0 10px">'
          +'<div style="background:var(--card2);border-radius:8px;padding:12px">'
            +'<div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">Apertura</div>'
            +'<div class="cj-dr"><span style="color:var(--muted)">Fecha/Hora</span><span>'+fmtDT(c.fecha_apertura)+'</span></div>'
            +'<div class="cj-dr"><span style="color:var(--muted)">Fondo inicial</span><span style="font-weight:600">'+gs(c.efectivo_inicial||0)+'</span></div>'
            +(c.nombre_operador?'<div class="cj-dr"><span style="color:var(--muted)">Operador</span><span>'+c.nombre_operador+'</span></div>':'')
          +'</div>'
          +'<div style="background:var(--card2);border-radius:8px;padding:12px">'
            +'<div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">'+(ab?'En curso':'Cierre')+'</div>'
            +(ab?'<div class="cj-dr"><span style="color:var(--muted)">Tiempo</span><span style="color:var(--green)">'+durTxt+'</span></div><div class="cj-dr"><span style="color:var(--muted)">Estado</span><span style="color:var(--green);font-weight:700">Activa</span></div>':'<div class="cj-dr"><span style="color:var(--muted)">Fecha/Hora</span><span>'+fmtDT(c.fecha_cierre)+'</span></div><div class="cj-dr"><span style="color:var(--muted)">Duraci\u00f3n</span><span>'+durTxt+'</span></div>')
          +'</div>'
        +'</div>'
        +'<div style="background:var(--card2);border-radius:8px;padding:12px;margin-bottom:10px">'
          +'<div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">Resumen</div>'
          +'<div class="cj-dr"><span style="color:var(--muted)">Total vendido</span><span style="color:var(--green);font-weight:800;font-size:15px">'+gs(c.total_vendido||0)+'</span></div>'
          +'<div class="cj-dr"><span style="color:var(--muted)">Cantidad ventas</span><span style="font-weight:700">'+(c.total_operaciones||c.cantidad_ventas||0)+' ops</span></div>'
          +((c.total_operaciones||c.cantidad_ventas)&&c.total_vendido?'<div class="cj-dr"><span style="color:var(--muted)">Ticket prom.</span><span>'+gs(Math.round((c.total_vendido||0)/((c.total_operaciones||c.cantidad_ventas)||1)))+'</span></div>':'')
          +(c.total_descuentos?'<div class="cj-dr"><span style="color:var(--muted)">Descuentos</span><span style="color:var(--red)">-'+gs(c.total_descuentos)+'</span></div>':'')
        +'</div>'
        +(pagos?'<div style="background:var(--card2);border-radius:8px;padding:12px;margin-bottom:10px"><div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">M\u00e9todos de pago</div>'+pagos+'</div>':'')
        +(difHTML?'<div style="background:var(--card2);border-radius:8px;padding:12px;margin-bottom:10px"><div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">Control de efectivo</div>'+difHTML+'</div>':'')
        +(c.notas_cierre?'<div style="background:var(--card2);border-radius:8px;padding:12px;margin-bottom:10px"><div style="font-size:10px;color:var(--muted);font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">Notas</div><div style="font-size:13px;color:var(--text2)">'+c.notas_cierre+'</div></div>':'')
      +'</div>'
    +'</div>';
  }).join('');
}

function togCj(i){var b=document.getElementById('cjB'+i);if(b)b.classList.toggle('open');}
