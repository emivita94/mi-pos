-- ════════════════════════════════════════════════════════════════════════
-- PATCH: índices UNIQUE en sucursales y depositos
-- ════════════════════════════════════════════════════════════════════════
-- Previene race condition cuando dos terminales se activan simultáneamente
-- con el mismo nombre de sucursal/depósito.
--
-- Paso 1: consolida duplicados existentes (si los hay).
-- Paso 2: crea los índices UNIQUE.
--
-- Ejecutar en Supabase SQL Editor. Si falla en el paso 1, revisar con
-- detectar_duplicados.sql antes de reintentar.
-- ════════════════════════════════════════════════════════════════════════

-- ── PASO 1: Consolidar duplicados existentes ─────────────────────────

DO $$
DECLARE
  r     RECORD;
  p_rec RECORD;
  cnt   INT;
BEGIN
  -- SUCURSALES duplicadas (por licencia + UPPER(TRIM(nombre)))
  FOR r IN
    SELECT licencia_id, UPPER(TRIM(nombre)) AS nombre_norm,
           MIN(id) AS id_canonico, array_agg(id ORDER BY id) AS todos_ids
    FROM sucursales
    GROUP BY licencia_id, UPPER(TRIM(nombre))
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Sucursal lic=% nombre=% canonico=% todos=%',
      r.licencia_id, r.nombre_norm, r.id_canonico, r.todos_ids;

    UPDATE depositos          SET sucursal_id = r.id_canonico
      WHERE sucursal_id = ANY(r.todos_ids) AND sucursal_id <> r.id_canonico;
    UPDATE stock              SET sucursal_id = r.id_canonico
      WHERE sucursal_id = ANY(r.todos_ids) AND sucursal_id <> r.id_canonico;
    UPDATE stock_comprobantes SET sucursal_id = r.id_canonico
      WHERE sucursal_id = ANY(r.todos_ids) AND sucursal_id <> r.id_canonico;
    UPDATE stock_movimientos  SET sucursal_id = r.id_canonico
      WHERE sucursal_id = ANY(r.todos_ids) AND sucursal_id <> r.id_canonico;
    UPDATE stock_conteos      SET sucursal_id = r.id_canonico
      WHERE sucursal_id = ANY(r.todos_ids) AND sucursal_id <> r.id_canonico;

    DELETE FROM sucursales
      WHERE id = ANY(r.todos_ids) AND id <> r.id_canonico;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    RAISE NOTICE '  → % sucursales duplicadas eliminadas', cnt;
  END LOOP;

  -- DEPÓSITOS duplicados (después de mergear sucursales)
  FOR r IN
    SELECT licencia_id, sucursal_id, UPPER(TRIM(nombre)) AS nombre_norm,
           MIN(id) AS id_canonico, array_agg(id ORDER BY id) AS todos_ids
    FROM depositos
    GROUP BY licencia_id, sucursal_id, UPPER(TRIM(nombre))
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Depósito lic=% suc=% nombre=% canonico=% todos=%',
      r.licencia_id, r.sucursal_id, r.nombre_norm, r.id_canonico, r.todos_ids;

    FOR p_rec IN
      SELECT producto_id, SUM(cantidad) AS suma_dup
      FROM stock
      WHERE deposito_id = ANY(r.todos_ids) AND deposito_id <> r.id_canonico
      GROUP BY producto_id
    LOOP
      IF EXISTS (
        SELECT 1 FROM stock
        WHERE deposito_id = r.id_canonico AND producto_id = p_rec.producto_id
      ) THEN
        UPDATE stock
          SET cantidad   = cantidad + p_rec.suma_dup,
              updated_at = NOW()
          WHERE deposito_id = r.id_canonico
            AND producto_id = p_rec.producto_id;
      ELSE
        INSERT INTO stock (licencia_id, sucursal_id, deposito_id, producto_id,
                           nombre_producto, cantidad, updated_at)
        SELECT licencia_id, sucursal_id, r.id_canonico, producto_id,
               nombre_producto, p_rec.suma_dup, NOW()
        FROM stock
        WHERE deposito_id = ANY(r.todos_ids) AND deposito_id <> r.id_canonico
          AND producto_id = p_rec.producto_id
        LIMIT 1;
      END IF;
    END LOOP;

    DELETE FROM stock
      WHERE deposito_id = ANY(r.todos_ids) AND deposito_id <> r.id_canonico;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    RAISE NOTICE '  → % filas de stock consolidadas', cnt;

    UPDATE stock_comprobantes SET deposito_id = r.id_canonico
      WHERE deposito_id = ANY(r.todos_ids) AND deposito_id <> r.id_canonico;
    UPDATE stock_movimientos  SET deposito_id = r.id_canonico
      WHERE deposito_id = ANY(r.todos_ids) AND deposito_id <> r.id_canonico;
    UPDATE stock_conteos      SET deposito_id = r.id_canonico
      WHERE deposito_id = ANY(r.todos_ids) AND deposito_id <> r.id_canonico;

    DELETE FROM depositos
      WHERE id = ANY(r.todos_ids) AND id <> r.id_canonico;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    RAISE NOTICE '  → % depósitos duplicados eliminados', cnt;
  END LOOP;

  RAISE NOTICE '✓ Consolidación terminada (sin duplicados = sin cambios)';
END $$;

-- ── PASO 2: Crear índices UNIQUE ──────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sucursal_lic_nombre
  ON sucursales (licencia_id, UPPER(TRIM(nombre)));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_deposito_lic_suc_nombre
  ON depositos (licencia_id, sucursal_id, UPPER(TRIM(nombre)));

-- ── PASO 3: Actualizar la función crear_sucursal para manejar el ──────
-- constraint explícitamente (ON CONFLICT en lugar de SELECT + INSERT) ──

DROP FUNCTION IF EXISTS crear_sucursal(integer, text, text, text);

CREATE FUNCTION crear_sucursal(
  p_licencia_id INTEGER,
  p_nombre      TEXT,
  p_direccion   TEXT DEFAULT '',
  p_deposito    TEXT DEFAULT 'Depósito Principal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nombre_suc TEXT := UPPER(TRIM(p_nombre));
  v_nombre_dep TEXT := UPPER(TRIM(COALESCE(NULLIF(TRIM(p_deposito), ''), 'Depósito Principal')));
  v_suc_id     INTEGER;
  v_dep_id     INTEGER;
BEGIN
  IF v_nombre_suc = '' THEN
    RAISE EXCEPTION 'El nombre de la sucursal no puede estar vacío';
  END IF;

  -- INSERT ... ON CONFLICT es atómico: no hay race condition
  INSERT INTO sucursales (licencia_id, nombre, direccion, activa)
    VALUES (p_licencia_id, TRIM(p_nombre), COALESCE(p_direccion, ''), TRUE)
    ON CONFLICT (licencia_id, UPPER(TRIM(nombre)))
    DO UPDATE SET activa = TRUE
    RETURNING id INTO v_suc_id;

  INSERT INTO depositos (licencia_id, sucursal_id, nombre, activo)
    VALUES (p_licencia_id, v_suc_id, TRIM(COALESCE(NULLIF(TRIM(p_deposito), ''), 'Depósito Principal')), TRUE)
    ON CONFLICT (licencia_id, sucursal_id, UPPER(TRIM(nombre)))
    DO UPDATE SET activo = TRUE
    RETURNING id INTO v_dep_id;

  RETURN jsonb_build_object(
    'sucursal_id', v_suc_id,
    'deposito_id', v_dep_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION crear_sucursal(integer, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION crear_sucursal(integer, text, text, text) TO authenticated;
