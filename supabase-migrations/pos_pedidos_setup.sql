-- Setup tabla pos_pedidos para modo satélite
-- Ejecutar en Supabase SQL Editor si la tabla no existe

CREATE TABLE IF NOT EXISTS pos_pedidos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licencia_email  TEXT NOT NULL,
  licencia_id     INTEGER,
  terminal_origen TEXT NOT NULL DEFAULT 'Satelite',
  numero_orden    INTEGER,
  mesa            TEXT,
  sucursal        TEXT NOT NULL DEFAULT 'Principal',
  tipo_pedido     TEXT NOT NULL DEFAULT 'llevar',  -- 'local' | 'llevar' | 'delivery' | 'adicional'
  estado          TEXT NOT NULL DEFAULT 'abierto', -- 'abierto' | 'cobrado' | 'cancelado'
  items           JSONB NOT NULL DEFAULT '[]',
  total           NUMERIC(15,0) NOT NULL DEFAULT 0,
  descuento_ticket NUMERIC(15,0) NOT NULL DEFAULT 0,
  mesero_id       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pos_pedidos_licencia_estado
  ON pos_pedidos (licencia_email, estado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_pedidos_sucursal
  ON pos_pedidos (licencia_email, sucursal, estado, created_at DESC);

-- RLS: habilitar y permitir lectura/escritura a anon y authenticated
ALTER TABLE pos_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_pedidos_anon_all" ON pos_pedidos;
CREATE POLICY "pos_pedidos_anon_all"
  ON pos_pedidos FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON pos_pedidos TO anon;
GRANT ALL ON pos_pedidos TO authenticated;
