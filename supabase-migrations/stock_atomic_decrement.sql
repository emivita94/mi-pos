-- Función RPC para descontar stock de forma atómica (previene race condition multi-terminal)
-- Aplicar en Supabase SQL Editor antes de activar múltiples terminales con inventario.
--
-- El código del POS intenta llamar a esta función primero; si no existe, usa upsert clásico
-- (read-then-write) con riesgo de duplicados bajo carga concurrente.

CREATE OR REPLACE FUNCTION descontar_stock_venta(
  p_deposito_id  INTEGER,
  p_sucursal_id  INTEGER,
  p_licencia_id  INTEGER,
  p_producto_id  INTEGER,
  p_cantidad     NUMERIC,
  p_nombre_producto TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO stock (deposito_id, sucursal_id, licencia_id, producto_id, nombre_producto, cantidad, updated_at)
  VALUES (p_deposito_id, p_sucursal_id, p_licencia_id, p_producto_id, p_nombre_producto, -p_cantidad, NOW())
  ON CONFLICT (deposito_id, producto_id) DO UPDATE
    SET cantidad   = stock.cantidad - p_cantidad,
        updated_at = NOW();
END;
$$;

-- Permisos para rol anon (cliente del POS)
GRANT EXECUTE ON FUNCTION descontar_stock_venta TO anon;
GRANT EXECUTE ON FUNCTION descontar_stock_venta TO authenticated;
