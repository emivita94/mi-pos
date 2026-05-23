// ════════════════════════════════════════════════════════════
// Admin: Tutoriales — guías paso a paso por módulo
// ════════════════════════════════════════════════════════════
// Index visual con tarjetas agrupadas por categoria. Click en una
// tarjeta abre el tutorial completo (mismo content area).
//
// Para AGREGAR un tutorial: simplemente sumar un objeto a TUTORIALES.
// ════════════════════════════════════════════════════════════

var TUTORIALES = [
  // ───────── CATÁLOGO ─────────
  {
    id: 'productos',
    cat: 'Catálogo',
    titulo: 'Cargar y editar productos',
    icono: 'package',
    resumen: 'Crear, editar y organizar el menú/catálogo de productos que vendés.',
    paraQueSirve: 'Es el corazón del negocio: cada producto que vas a vender (lomito, coca, hamburguesa) tiene que estar cargado acá con su precio, categoría y color. Sin esto, el cajero no tiene qué tocar para vender.',
    pasos: [
      { t:'Entrar a Productos', d:'En el menú lateral izquierdo, hacé click en <b>Productos</b> (sección Catálogo).' },
      { t:'Crear producto nuevo', d:'Apretá el botón <b>+ Nuevo producto</b> arriba a la derecha.' },
      { t:'Cargar los datos básicos', d:'Nombre del producto, precio de venta, categoría (Bebidas, Comidas, etc.) y color (sirve para identificarlo rápido en el POS).' },
      { t:'Activar inventario (si controlás stock)', d:'Si querés llevar control de cuánto te queda, activá el switch <b>Inventario</b>. Vas a poder ver el stock en pantalla.' },
      { t:'Definir mínimo de stock', d:'Si activaste inventario, poné el <b>stock mínimo</b>. Cuando llegues a ese número, el sistema te avisa con un color naranja.' },
      { t:'Guardar', d:'Apretá <b>Guardar</b>. El producto aparece automáticamente en el POS del local.' }
    ],
    tips: [
      'El <b>color</b> ayuda al cajero a encontrar productos rápido en el POS. Usá colores distintos por categoría (rojo para carnes, verde para bebidas, etc.).',
      'Si el producto tiene <b>precio variable</b> (ej. delivery), activá esa opción y al venderlo te va a pedir el monto.'
    ]
  },
  {
    id: 'importar',
    cat: 'Catálogo',
    titulo: 'Importar productos desde Excel',
    icono: 'upload',
    resumen: 'Cargar muchos productos de una en lugar de uno por uno.',
    paraQueSirve: 'Si tenés 50 o 200 productos para subir al sistema, en vez de cargarlos uno por uno podés hacer una planilla de Excel y subirla. Te ahorra horas.',
    pasos: [
      { t:'Entrar a Importar productos', d:'En el menú lateral, sección Catálogo → <b>Importar productos</b>.' },
      { t:'Descargar plantilla', d:'Apretá <b>Descargar plantilla Excel</b>. Te baja un archivo .xlsx con las columnas correctas.' },
      { t:'Llenar la planilla', d:'Abrila en Excel/Google Sheets y cargá una fila por producto: <b>nombre, precio, categoría, color, inventario (sí/no), mínimo, costo</b>.' },
      { t:'Subir la planilla', d:'Volvé al sistema, apretá <b>Seleccionar archivo</b> y elegí tu Excel.' },
      { t:'Revisar la vista previa', d:'El sistema muestra los productos detectados. Verificá que esté todo bien antes de confirmar.' },
      { t:'Confirmar importación', d:'Apretá <b>Importar</b>. Los productos se cargan al catálogo y ya están disponibles en el POS.' }
    ],
    tips: [
      'Hacelo de a tandas si tenés muchos productos (ej. de 50 en 50) para revisar mejor.',
      'Si un producto ya existe con el mismo nombre, el sistema te pregunta si actualizar o saltar.'
    ]
  },
  {
    id: 'insumos',
    cat: 'Catálogo',
    titulo: 'Insumos: qué son y cómo cargarlos',
    icono: 'box',
    resumen: 'Mercadería que comprás para producir, pero que NO vendés directo (harina, aceite, servilletas).',
    paraQueSirve: 'Algunas cosas las comprás pero no se venden por separado: la harina para hacer las pizzas, el aceite, las servilletas. Esos son <b>insumos</b>. Vas a llevarles stock pero no aparecen en el POS para vender por error.',
    pasos: [
      { t:'Diferencia con productos', d:'<b>Producto</b> = se vende (Pizza Margarita). <b>Insumo</b> = se compra y descuenta del stock al producir, pero nadie lo ve en el POS (Harina, Queso, Salsa).' },
      { t:'Crear insumo', d:'Menú lateral → <b>Insumos</b> → <b>+ Nuevo insumo</b>.' },
      { t:'Cargar datos', d:'Nombre, unidad de medida (kg, lt, unid), costo. NO tiene precio de venta porque no se vende.' },
      { t:'Stock inicial', d:'Cargá cuánto tenés ahora del insumo. Después vas a sumar/restar según compres o uses.' },
      { t:'Filtros anti-venta', d:'El sistema bloquea automáticamente que aparezca un insumo en la grilla del POS, en búsqueda, en modificadores, etc. Tranquilo, no se va a vender por error.' }
    ],
    tips: [
      'Si vendés productos COMPUESTOS (una pizza usa harina + queso + salsa) podés en el futuro armar recetas para que al vender una pizza se descuenten automáticamente los insumos.',
      'Igual que con productos, los insumos podés cargarlos masivo por Excel.'
    ]
  },

  // ───────── INVENTARIO ─────────
  {
    id: 'inventarios',
    cat: 'Inventario',
    titulo: 'Controlar mi stock — Inventarios',
    icono: 'list',
    resumen: 'Ver cuánto tenés de cada producto, en cada sucursal/depósito.',
    paraQueSirve: 'Acá ves de un vistazo la situación del stock: cuántos productos hay activos, cuántos están en alerta, cuántos sin stock, y el valor total de tu mercadería. Es la pantalla de inicio del módulo de inventario.',
    pasos: [
      { t:'Entrar a Inventarios', d:'Menú lateral → sección Inventario → <b>Inventarios</b>.' },
      { t:'Elegir sucursal', d:'Arriba a la derecha, dropdown <b>Todas las sucursales</b>. Podés filtrar por una sucursal específica o ver todas juntas.' },
      { t:'Leer los 4 KPIs', d:'<b>Productos</b> (total activos) · <b>Stock bajo</b> (alerta naranja) · <b>Sin stock</b> (rojo, requieren reposición) · <b>Valor en inventario</b> (cantidad × costo unitario).' },
      { t:'Usar los chips de filtro', d:'A la derecha de la búsqueda hay chips: <b>Todos</b> · <b>OK</b> · <b>Bajo</b> · <b>Sin stock</b>. Tocá uno y la tabla filtra.' },
      { t:'Buscar producto rápido', d:'En el campo de búsqueda escribí por nombre o código. La tabla se filtra al instante.' },
      { t:'Ver detalle de un producto', d:'En cada fila tenés dos botones: <b>Historial</b> (ver entradas/salidas) y <b>Ajustar</b> (corregir el stock manualmente).' },
      { t:'Interpretar la barra de stock', d:'En la columna <b>Stock/Mínimo</b> hay una mini barra: verde = OK, naranja = bajo, roja = crítico. Y abajo te dice el mínimo configurado.' }
    ],
    tips: [
      'Los productos críticos (rojo) se ordenan PRIMERO en la lista, para que veas lo urgente sin scrollear.',
      'El <b>Valor en inventario</b> es plata real inmovilizada. Si ves un número muy alto, capaz tenés sobrestock y conviene bajar compras.'
    ]
  },
  {
    id: 'extracto',
    cat: 'Inventario',
    titulo: 'Extracto de un producto — entender por qué se mueve',
    icono: 'trending',
    resumen: 'Ver la evolución completa de un producto: entradas, salidas y saldo en el tiempo.',
    paraQueSirve: 'Cuando un producto te baja mucho y no entendés por qué, el extracto te muestra TODOS los movimientos en orden: cuándo vendiste, cuándo compraste, cuándo ajustaste. Es la auditoría del stock.',
    pasos: [
      { t:'Entrar a Extracto de Producto', d:'Menú lateral → sección Inventario → <b>Extracto de Producto</b>.' },
      { t:'Elegir el producto', d:'En el dropdown <b>Producto</b> seleccioná el que querés revisar.' },
      { t:'Filtrar por período', d:'Usá los chips rápidos <b>Hoy / Semana / Mes / Año</b> o cargá fechas Desde/Hasta manualmente.' },
      { t:'Filtrar por depósito (opcional)', d:'Si querés ver solo una sucursal, elegí en el dropdown <b>Sucursal</b> y después el <b>Depósito</b>.' },
      { t:'Apretar Buscar', d:'El sistema arma los KPIs (saldo inicial, entradas, salidas, saldo final), el gráfico y la tabla.' },
      { t:'Leer el gráfico', d:'La línea muestra cómo evolucionó el stock. Si termina en verde = sumás, en rojo = quedaste negativo, gris = quedaste en cero.' },
      { t:'Mirar la tabla', d:'Cada fila es un movimiento (venta, compra, ajuste, conteo). La última columna <b>Saldo</b> muestra cuánto te quedaba después de ese movimiento.' }
    ],
    tips: [
      'Si ves un salto raro (mucho stock que desaparece de golpe), hacé click en la fila para expandir el detalle del comprobante.',
      'Cuando hay <b>conteo físico</b> en la tabla, ese es el momento donde alguien contó la mercadería real y el sistema se ajustó.'
    ]
  },
  {
    id: 'compras',
    cat: 'Inventario',
    titulo: 'Cargar compras de mercadería',
    icono: 'shoppingCart',
    resumen: 'Registrar cada vez que recibís mercadería del proveedor para que el stock se actualice.',
    paraQueSirve: 'Esta es la operación más importante para que el sistema "sepa" cuánto stock tenés. Cada vez que te llega mercadería (te llega el pedido del proveedor), tenés que cargarla acá. Si no la cargás, el sistema sigue creyendo que no tenés stock.',
    pasos: [
      { t:'Entrar a Compras', d:'Menú lateral → sección Inventario → <b>Compras</b>.' },
      { t:'+ Nueva compra', d:'Apretá la pestaña <b>+ Nueva compra</b>.' },
      { t:'Elegir depósito de entrada', d:'Indicá <b>en qué depósito</b> recibís la mercadería (si tenés una sola sucursal, hay uno solo).' },
      { t:'Cargar el proveedor (opcional)', d:'Si querés trackear de quién comprás, escribí el nombre del proveedor.' },
      { t:'Agregar productos', d:'Buscá los productos en el listado y al hacer click se agregan a la grilla. Cargá <b>cantidad</b> y <b>costo unitario</b> de cada uno.' },
      { t:'Revisar el total', d:'Abajo se calcula el total de la compra automáticamente.' },
      { t:'Cargar referencia (factura)', d:'Si tenés número de factura del proveedor, cargalo en el campo <b>Referencia</b>.' },
      { t:'Guardar', d:'Apretá <b>Guardar compra</b>. El stock se actualiza al instante en todos los productos.' }
    ],
    tips: [
      'Cargá las compras <b>el mismo día que llegan</b>. Si las dejás para después, perdés el control.',
      'El <b>costo unitario</b> que cargás se usa para calcular el <b>Valor en inventario</b> y el margen real cuando vendés.',
      'Si te equivocaste, en el listado podés apretar <b>Anular</b> y la compra se revierte (el stock vuelve a como estaba).'
    ]
  },
  {
    id: 'movstock',
    cat: 'Inventario',
    titulo: 'Movimientos de stock — entradas, salidas, transferencias',
    icono: 'transfer',
    resumen: 'Para todo lo que no es compra: roturas, regalos, mermas, traslados entre depósitos.',
    paraQueSirve: 'No todo movimiento de mercadería es una compra o una venta. Si rompiste algo, regalaste, sacaste para consumo del personal, o moviste de un depósito a otro — todo eso se registra acá.',
    pasos: [
      { t:'Entrar a Movimientos de Stock', d:'Menú lateral → sección Inventario → <b>Movimientos de Stock</b>.' },
      { t:'+ Nuevo movimiento', d:'Apretá la pestaña <b>+ Nuevo movimiento</b>.' },
      { t:'Elegir el tipo', d:'<b>Entrada</b> (suma stock) · <b>Salida</b> (resta stock) · <b>Transferencia</b> (saca de un depósito y mete en otro).' },
      { t:'Para Entrada/Salida', d:'Elegí el depósito, agregá los productos con cantidad y un <b>motivo</b> (obligatorio: ej. "rotura", "regalo", "consumo personal").' },
      { t:'Para Transferencia', d:'Elegí <b>depósito origen</b> (de dónde sale) y <b>depósito destino</b> (a dónde va). Cargá cantidades.' },
      { t:'Guardar', d:'Apretá <b>Guardar</b>. El stock se actualiza en ambos depósitos si fue transferencia.' }
    ],
    tips: [
      'Siempre cargá un <b>motivo claro</b>. Cuando dentro de 6 meses revises el extracto, el motivo te recuerda qué pasó.',
      'Las transferencias generan DOS movimientos: una salida en el depósito origen y una entrada en el destino. Si cancelás la transferencia, se cancelan los dos juntos.'
    ]
  },
  {
    id: 'conteo',
    cat: 'Inventario',
    titulo: 'Conteo físico — alinear sistema con realidad',
    icono: 'check_circle',
    resumen: 'Contar la mercadería real y ajustar el sistema para que coincida.',
    paraQueSirve: 'Por más cuidado que tengas, siempre hay diferencias entre lo que dice el sistema y lo que hay en el depósito (roturas no registradas, robos, errores de carga). El conteo físico te permite contar la mercadería real y dejar todo cuadrado. Se recomienda hacer 1 vez por mes.',
    pasos: [
      { t:'Entrar a Conteo Físico', d:'Menú lateral → sección Inventario → <b>Conteo Físico</b>.' },
      { t:'+ Nuevo conteo', d:'Apretá la pestaña <b>+ Nuevo conteo</b>.' },
      { t:'Elegir depósito', d:'Seleccioná el depósito que vas a contar. Solo uno por conteo (si tenés varios, hacés uno por cada uno).' },
      { t:'Cargar fecha y observación', d:'Fecha del conteo y observación opcional ("Conteo mensual junio").' },
      { t:'Iniciar conteo', d:'El sistema carga todos los productos del depósito. Te aparece una lista con el stock que dice el sistema y un campo para cargar el <b>stock real</b> (lo que contás físicamente).' },
      { t:'Contar y cargar', d:'Andá producto por producto en el depósito, contá lo que hay realmente y cargalo en el campo correspondiente. El sistema te muestra automáticamente la <b>diferencia</b>.' },
      { t:'Confirmar', d:'Cuando terminás de contar todo, apretá <b>✓ Confirmar y ajustar</b>. El sistema genera un comprobante de tipo <b>Conteo</b> y deja el stock alineado con la realidad.' }
    ],
    tips: [
      'Hacelo <b>fuera del horario de venta</b> para que nadie esté moviendo mercadería mientras contás.',
      'Si tenés mucha mercadería, podés guardar el conteo como borrador y seguir después. No tenés que confirmar todo en una sola sentada.',
      'Los productos con diferencia ≠ 0 generan el ajuste automático. Los que están bien (diferencia = 0) no se tocan.',
      'Después del conteo, el extracto del producto muestra el movimiento tipo <b>Conteo</b> en la fecha que lo hiciste, así sabés cuándo fue la última vez.'
    ]
  },

  // ───────── OPERACIONES ─────────
  {
    id: 'cajas',
    cat: 'Operaciones',
    titulo: 'Cajas y turnos — abrir y cerrar caja',
    icono: 'cash',
    resumen: 'Cada vez que se vende hay que tener una caja abierta. Al final del día se cierra y se cuadra.',
    paraQueSirve: 'El turno es la sesión de trabajo del cajero: lo abre cuando empieza a vender (con el efectivo inicial) y lo cierra al final del día contando lo que hay en caja. Si las diferencias dan mal, el sistema te avisa.',
    pasos: [
      { t:'Abrir turno', d:'En el POS del local, al primer ingreso del día te pide <b>efectivo inicial</b>. Cargá lo que dejaste en la caja (ej. 50.000 para vuelto).' },
      { t:'Vender normal', d:'A medida que se cobra, el sistema acumula efectivo, POS, transferencias, etc. en el turno abierto.' },
      { t:'Ver turno desde el admin', d:'En el admin web → menú lateral → <b>Cajas / Turnos</b>. Ves cada turno abierto y cerrado, montos por método, ventas, anulaciones.' },
      { t:'Cerrar turno (en el POS)', d:'Al final del día, en el POS del local, ir a <b>Cerrar caja</b>. Te pide contar el efectivo real y los demás métodos.' },
      { t:'Cargar conteo real', d:'Poné cuánto contaste de efectivo, cuánto de POS, etc. El sistema te muestra automáticamente la <b>diferencia</b> con lo que esperaba.' },
      { t:'Confirmar', d:'Si la diferencia es chica o aceptable, confirmá. El turno queda cerrado y archivado en el reporte.' }
    ],
    tips: [
      'Si la diferencia da MUCHO mal (más de 5%), no confirmes — recontá. Capaz contaste un billete o método.',
      'Los <b>cierres de turno</b> son la auditoría diaria. Reviselo todos los días — si ves diferencias chicas seguidas, capaz hay un cajero descuidado.'
    ]
  },
  {
    id: 'terminales',
    cat: 'Operaciones',
    titulo: 'Terminales — vincular dispositivos al sistema',
    icono: 'monitor',
    resumen: 'Cada celular/tablet/PC que use el POS aparece acá como una terminal independiente.',
    paraQueSirve: 'Si tenés varios dispositivos vendiendo (una tablet en barra + un celular en delivery + una PC en caja), cada uno es una "terminal" del sistema. Acá ves cuáles están activas y desde dónde se vendió cada cosa.',
    pasos: [
      { t:'Entrar a Terminales', d:'Menú lateral → sección Principal → <b>Terminales</b>.' },
      { t:'Ver listado', d:'Tenés todas las terminales registradas con el nombre que le pusiste, sucursal, modo (caja o satélite), y última vez que se conectó.' },
      { t:'Asignar timbrado', d:'Cada terminal puede tener un timbrado distinto para facturar (más en el tutorial de Timbrado).' },
      { t:'Borrar terminal vieja', d:'Si una terminal ya no la usás (vendiste el celular, etc.), podés borrarla para limpiar el listado.' }
    ],
    tips: [
      '<b>Modo Caja</b>: cobra y emite ticket. <b>Modo Satélite</b>: mesero toma pedido y manda a la cocina, NO cobra. La caja después lo agarra y cobra.',
      'Si activás un dispositivo NUEVO con la misma sucursal que ya tenías, NO se crea sucursal nueva (gracias al fix idempotente que aplicamos). Reutiliza la existente.'
    ]
  },

  // ───────── FINANZAS ─────────
  {
    id: 'gastos',
    cat: 'Finanzas',
    titulo: 'Gastos fijos — anotar todo lo que sale',
    icono: 'cash',
    resumen: 'Cargar todos los gastos del negocio (alquiler, luz, sueldos) para saber tu rentabilidad real.',
    paraQueSirve: 'Las ventas son una parte de la historia. Para saber si <b>ganás plata</b> tenés que restar los gastos. Acá cargás todo: alquiler, sueldos, luz, gas, internet, impuestos, sueldos, etc. Sin esto, el balance no sirve.',
    pasos: [
      { t:'Entrar a Gastos Fijos', d:'Menú lateral → sección Finanzas → <b>Gastos Fijos</b>.' },
      { t:'+ Nuevo gasto', d:'Apretá <b>+ Nuevo gasto</b>.' },
      { t:'Elegir categoría', d:'Alquiler, Servicios, Sueldos, Impuestos, etc. (las creás en el Plan de Gastos previamente).' },
      { t:'Elegir concepto', d:'Dentro de cada categoría tenés conceptos puntuales (ej. en Servicios: ANDE, ESSAP, Internet).' },
      { t:'Cargar monto y fecha', d:'Cuánto pagaste y cuándo. Opcionalmente cargá una observación.' },
      { t:'Guardar', d:'El gasto queda registrado y se suma a tu balance del mes.' }
    ],
    tips: [
      'Cargá los gastos <b>el mismo día que los pagás</b> o al menos 1 vez por semana. Si los dejás todos para fin de mes, vas a olvidarte de alguno.',
      'Antes de cargar gastos por primera vez, andá a <b>Plan de Gastos</b> y armá las categorías que vas a usar.'
    ]
  },
  {
    id: 'plan-gastos',
    cat: 'Finanzas',
    titulo: 'Plan de Gastos — armar tus categorías',
    icono: 'tag',
    resumen: 'Crear las categorías y conceptos donde vas a cargar tus gastos.',
    paraQueSirve: 'Antes de empezar a cargar gastos, conviene tener armado tu "árbol" de categorías y conceptos. Así organizás todo y después los reportes salen agrupados de forma útil.',
    pasos: [
      { t:'Entrar a Plan de Gastos', d:'Menú lateral → sección Finanzas → <b>Plan de Gastos</b>.' },
      { t:'+ Nueva categoría', d:'Crea categorías generales: Alquileres, Servicios, Sueldos, Impuestos, Marketing, Mantenimiento.' },
      { t:'+ Nuevo concepto (dentro de cada categoría)', d:'Conceptos puntuales: en Servicios → ANDE, ESSAP, Internet, Cable, Teléfono.' },
      { t:'Reordenar / eliminar', d:'Podés borrar categorías o conceptos que no usás.' }
    ],
    tips: [
      'Empezá con pocas categorías (5-7) y andá creando conceptos a medida que aparecen los gastos. No te pongas a armar 50 conceptos de entrada.'
    ]
  },
  {
    id: 'balance',
    cat: 'Finanzas',
    titulo: 'Balance Pérdidas y Ganancias',
    icono: 'chart',
    resumen: 'Saber si el negocio gana o pierde plata en un período.',
    paraQueSirve: 'El reporte más importante para el dueño. Te dice: cuánto vendiste, cuánto te costó la mercadería vendida, cuánto pagaste en gastos, y cuánto te quedó NETO al final. Si ese número es positivo, ganaste plata. Si es negativo, perdiste.',
    pasos: [
      { t:'Entrar a Balance P&G', d:'Menú lateral → sección Finanzas → <b>Balance P&G</b>.' },
      { t:'Elegir período', d:'Hoy, semana, mes, año o un rango custom.' },
      { t:'Leer los grandes números', d:'<b>Ventas brutas</b> (total vendido) - <b>Costo de mercadería</b> (lo que te costó comprar lo que vendiste) = <b>Margen bruto</b>. Después de eso: - <b>Gastos fijos</b> = <b>Ganancia neta</b>.' },
      { t:'Mirar el % de margen', d:'Si el margen bruto es bajo (menos de 40-50%), capaz estás vendiendo barato o comprando caro. Si la ganancia neta es negativa, los gastos fijos son altos para tu volumen de ventas.' }
    ],
    tips: [
      'Mirá el balance <b>todas las semanas</b>. Si lo mirás solo a fin de mes, ya es tarde para reaccionar.',
      'Si el costo de mercadería sale 0 o muy bajo, capaz no cargaste los costos en los productos. Revisá Productos.'
    ]
  },
  {
    id: 'iva',
    cat: 'Finanzas',
    titulo: 'Liquidación de IVA',
    icono: 'fileText',
    resumen: 'Calcular cuánto IVA tenés que pagar al fisco cada período.',
    paraQueSirve: 'Si emitís facturas, cobrás IVA. Pero también pagás IVA cuando comprás mercadería. La diferencia es lo que tenés que ingresar a la DGI. Esta pantalla te lo calcula automáticamente.',
    pasos: [
      { t:'Entrar a Liquidación IVA', d:'Menú lateral → sección Finanzas → <b>Liquidación IVA</b>.' },
      { t:'Elegir período', d:'Generalmente mensual.' },
      { t:'Leer débito fiscal', d:'IVA que cobraste por tus ventas con factura.' },
      { t:'Leer crédito fiscal', d:'IVA que pagaste en las compras con factura del proveedor.' },
      { t:'Saldo a pagar', d:'Débito - Crédito = lo que tenés que ingresar (o saldo a favor si das negativo).' },
      { t:'Cerrar período', d:'Cuando confirmás, el período queda cerrado y no se puede modificar. Conviene cerrarlo después del 15 del mes siguiente (cuando ya cargaste todas las facturas).' }
    ],
    tips: [
      'Para que el cálculo dé bien, tenés que cargar TODAS las compras como Compras con sus respectivos costos e IVA.',
      'Antes de cerrar el período, repasá los datos. Una vez cerrado se complica modificarlo.'
    ]
  }
];

// ───────── RENDER ─────────

function renderTutoriales(){
  var c = document.getElementById('content');
  if(!c) return;

  // Agrupar por categoria
  var grupos = {};
  TUTORIALES.forEach(function(t){
    if(!grupos[t.cat]) grupos[t.cat] = [];
    grupos[t.cat].push(t);
  });

  var ico = function(n){ return (typeof NodoIco==='function') ? NodoIco(n,18) : ''; };
  var icoGrande = function(n){ return (typeof NodoIco==='function') ? NodoIco(n,22) : ''; };

  var catIco = { 'Catálogo':'package', 'Inventario':'box', 'Operaciones':'cash', 'Finanzas':'chart' };
  var catColor = { 'Catálogo':'var(--blue)', 'Inventario':'var(--green)', 'Operaciones':'var(--orange)', 'Finanzas':'var(--green)' };

  var html =
    '<div class="ph">'
      +'<div>'
        +'<div class="pt">Tutoriales</div>'
        +'<div class="ps">Aprendé a usar cada módulo del sistema paso a paso</div>'
      +'</div>'
      +'<div class="ps" style="display:flex;align-items:center;gap:6px">'+icoGrande('bulb')+' <span>'+TUTORIALES.length+' tutoriales disponibles</span></div>'
    +'</div>';

  Object.keys(grupos).forEach(function(cat){
    var color = catColor[cat] || 'var(--blue)';
    html += '<div style="margin-bottom:26px">'
      + '<div style="display:flex;align-items:center;gap:9px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:'+color+';margin-bottom:12px;padding:0 2px">'
        + ico(catIco[cat]||'box')
        + '<span>'+cat+'</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';

    grupos[cat].forEach(function(t){
      html += '<div onclick="abrirTutorial(\''+t.id+'\')" class="tut-card" style="background:var(--card);border:1px solid var(--border);border-left:3px solid '+color+';border-radius:10px;padding:16px 18px;cursor:pointer;transition:transform .12s,box-shadow .12s">'
        + '<div style="display:flex;align-items:flex-start;gap:11px;margin-bottom:8px">'
          + '<div style="color:'+color+';flex-shrink:0;margin-top:1px">'+icoGrande(t.icono)+'</div>'
          + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:14px;font-weight:800;color:var(--text);line-height:1.25">'+t.titulo+'</div>'
            + '<div style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.4">'+t.resumen+'</div>'
          + '</div>'
        + '</div>'
        + '<div style="font-size:11px;color:'+color+';font-weight:700;display:flex;align-items:center;gap:5px;margin-top:6px">'
          + '<span>'+t.pasos.length+' pasos</span>'
          + '<span style="opacity:.5">·</span>'
          + '<span>Ver tutorial</span>'
          + ico('chevronRight')
        + '</div>'
      + '</div>';
    });

    html += '</div></div>';
  });

  // Estilos de hover (una sola vez)
  html += '<style>.tut-card:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.18)}[data-theme="light"] .tut-card:hover{box-shadow:0 6px 16px rgba(0,0,40,.10)}</style>';

  c.innerHTML = html;
}

function abrirTutorial(id){
  var t = TUTORIALES.find(function(x){ return x.id === id; });
  if(!t){
    if(typeof toast==='function') toast('Tutorial no encontrado');
    return;
  }
  var c = document.getElementById('content');
  if(!c) return;

  var ico = function(n,s){ return (typeof NodoIco==='function') ? NodoIco(n, s||16) : ''; };

  var pasosHtml = t.pasos.map(function(p, i){
    return '<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--border)">'
      + '<div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:var(--g2);color:var(--green);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;font-family:Consolas,monospace">'+(i+1)+'</div>'
      + '<div style="flex:1;padding-top:4px">'
        + '<div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:4px">'+p.t+'</div>'
        + '<div style="font-size:13px;color:var(--text2);line-height:1.55">'+p.d+'</div>'
      + '</div>'
    + '</div>';
  }).join('');

  var tipsHtml = (t.tips && t.tips.length)
    ? '<div style="background:var(--b2);border-left:3px solid var(--blue);border-radius:8px;padding:14px 16px;margin-top:24px">'
      + '<div style="display:flex;align-items:center;gap:7px;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:800;color:var(--blue);margin-bottom:9px">'
        + ico('bulb',14)+'<span>Tips útiles</span>'
      + '</div>'
      + t.tips.map(function(tip){ return '<div style="font-size:13px;color:var(--text);margin-bottom:7px;line-height:1.5">• '+tip+'</div>'; }).join('')
    + '</div>'
    : '';

  c.innerHTML =
    '<div class="ph">'
      +'<div>'
        +'<button onclick="renderTutoriales()" style="background:transparent;border:1px solid var(--border);border-radius:7px;color:var(--muted);padding:7px 13px;font:600 12px Barlow,sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;margin-bottom:8px">'
          +ico('chevronLeft',14)+'Volver a tutoriales'
        +'</button>'
        +'<div class="pt">'+t.titulo+'</div>'
        +'<div class="ps">'+t.resumen+'</div>'
      +'</div>'
    +'</div>'

    + '<div class="card" style="padding:18px 22px;margin-bottom:20px;background:var(--card);border-left:3px solid var(--green)">'
      + '<div style="display:flex;align-items:center;gap:7px;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:800;color:var(--green);margin-bottom:9px">'
        + ico('help',14)+'<span>¿Para qué sirve?</span>'
      + '</div>'
      + '<div style="font-size:14px;color:var(--text);line-height:1.6">'+t.paraQueSirve+'</div>'
    + '</div>'

    + '<div class="card" style="padding:20px 24px">'
      + '<div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:800;color:var(--muted);margin-bottom:10px">Paso a paso</div>'
      + pasosHtml
    + '</div>'

    + tipsHtml;

  // Scroll arriba
  try { window.scrollTo({top:0, behavior:'smooth'}); } catch(e){}
}
