// ── Selectores DOM compartidos entre módulos ──
// IDs referenciados desde más de un archivo JS.
// Si renombrás un ID en el HTML, cambialo aquí y todo se actualiza.

var DOM = {
  // ── Cobro / Ventas (compartidos entre cobro.js, ventas.js, app.js) ──
  content:          'content',
  tpanel:           'tpanel',
  prodView:         'prodView',
  shiftDisp:        'shiftDisp',
  npOverlay:        'npOverlay',
  npDisp:           'npDisp',
  npLbl:            'npLbl',
  billetesRow:      'billetesRow',
  cierreTotalDisp:  'cierreTotalDisp',
  cierreValTotal:   'cierreVal_TOTAL',
  tabDeliveryMonto: 'tabDeliveryMonto',
  tabBtnTxt:        'tabBtnTxt',
  tabPendingBadge:  'tabPendingBadge',
  pendingBadge:     'pendingBadge',
  btnGuardarTxt:    'btnGuardarTxt',
  btnGuardarIcon:   'btnGuardarIcon',
  catSheetContent:  'catSheetContent',
  catOv:            'catOv',
  catLbl:           'catLbl',

  // ── Impresión (compartidos entre impresion.js, app.js) ──
  printFrame:       'printFrame',
  previewIframe:    'previewIframe',
  reciboTitulo:     'reciboTitulo',
  reciboPapel:      'reciboPapel',
  btpsBadge:        'btpsBadge',
  btpsStatus:       'btpsStatus',
  btpsMacInput:     'btpsMacInput',
  _btpsError:       '_btpsError',
  usblocalStatus:   'usblocalStatus',
  usblocalName:     'usblocalName',
};

// Helper: DOM.get('tpanel') es equivalente a document.getElementById(DOM.tpanel)
DOM.get = function(key) {
  return document.getElementById(DOM[key] || key);
};
