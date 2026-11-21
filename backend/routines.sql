-- RESERVA DE LOTES - PostgreSQL 15+
-- Ejecutar UNA VEZ sobre las ocho tablas del PDF ya creadas, en esquema public.
-- Se puede volver a ejecutar para reinstalar estas rutinas.
-- No agrega tablas ni columnas; agrega un indice unico de ubicacion.
-- No cambia ni libera automaticamente los registros existentes.
-- Propuesta operativa: notas = separaciones pagadas de S/ 100, un lote por nota.
-- Nuevas notas: fecha de emision de hoy (America/Lima), sin retroactividad.
-- El plazo termina al inicio de fecha_emision + 8 dias calendario.
-- No incluye cuotas, reembolsos, anulaciones ni historial de cambios de estado.
-- Las PK no se modifican; telefono se modifica identificando su valor anterior.
-- No ejecutar como migracion automatica sobre una BD productiva sin revision.
-- Las rutinas son SECURITY INVOKER: no sustituyen los permisos del backend.
BEGIN;
SET LOCAL search_path TO public, pg_catalog;

-- Evita duplicar un mismo terreno con diferentes identificadores.
-- Si hay duplicados existentes, PostgreSQL cancela la instalacion.
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_lote_ubicacion
ON public.lote (nombre_proyecto, manzana, numero_lote);

-- Validacion compartida: textos obligatorios no vacios y PK inmutables.
-- Se mantiene la validacion de formatos, montos y FK del esquema original.
CREATE OR REPLACE FUNCTION public.fn_app_validar_textos()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_datos jsonb := to_jsonb(NEW);
    v_campo text;
    v_valor jsonb;
    v_clave text;
BEGIN
    FOR v_campo, v_valor IN SELECT key, value FROM jsonb_each(v_datos)
    LOOP
        IF jsonb_typeof(v_valor) = 'string' THEN
            IF btrim(v_valor #>> '{}') = '' THEN
                RAISE EXCEPTION 'El campo % no puede quedar vacio.', v_campo
                    USING ERRCODE = '22023';
            END IF;
            v_datos := jsonb_set(
                v_datos, ARRAY[v_campo], to_jsonb(btrim(v_valor #>> '{}'))
            );
        END IF;
    END LOOP;
    NEW := jsonb_populate_record(NEW, v_datos);
    IF TG_OP = 'UPDATE' THEN
        FOREACH v_clave IN ARRAY string_to_array(TG_ARGV[0], ',')
        LOOP
            IF (to_jsonb(NEW) -> v_clave)
                IS DISTINCT FROM (to_jsonb(OLD) -> v_clave) THEN
                RAISE EXCEPTION 'No se permite cambiar la clave %.', v_clave
                    USING ERRCODE = '22023';
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER tr_app_10_textos_ciudad_proyecto
BEFORE INSERT OR UPDATE ON public.ciudad_proyecto
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_textos('id_ciudad');

CREATE OR REPLACE TRIGGER tr_app_10_textos_distrito_proyecto
BEFORE INSERT OR UPDATE ON public.distrito_proyecto
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_textos('id_distrito');

CREATE OR REPLACE TRIGGER tr_app_10_textos_proyecto
BEFORE INSERT OR UPDATE ON public.proyecto
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_textos('nombre_proyecto');

CREATE OR REPLACE TRIGGER tr_app_10_textos_cliente
BEFORE INSERT OR UPDATE ON public.cliente
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_textos('dni_cliente');

CREATE OR REPLACE TRIGGER tr_app_10_textos_asesor
BEFORE INSERT OR UPDATE ON public.asesor
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_textos('dni_asesor');

CREATE OR REPLACE TRIGGER tr_app_10_textos_telefono_cliente
BEFORE INSERT OR UPDATE ON public.telefono_cliente
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_textos('dni_cliente');

CREATE OR REPLACE TRIGGER tr_app_10_textos_lote
BEFORE INSERT OR UPDATE ON public.lote
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_textos('id_lote');

CREATE OR REPLACE TRIGGER tr_app_10_textos_nota_venta
BEFORE INSERT OR UPDATE ON public.nota_venta
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_textos('serie_numero');

-- Reglas del lote: calcula precio, controla sus cambios comerciales.
CREATE OR REPLACE FUNCTION public.fn_app_validar_lote()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_fecha date;
    v_hoy date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date;
BEGIN
    NEW.precio_venta := round(NEW.area * NEW.precio_metro, 2);
    IF TG_OP = 'INSERT' THEN
        IF NEW.estado IS DISTINCT FROM 'Disponible' THEN
            RAISE EXCEPTION 'Un lote nuevo debe registrarse como Disponible.';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
        RETURN NEW;
    END IF;
    SELECT nv.fecha_emision INTO v_fecha
    FROM public.nota_venta nv
    WHERE nv.id_lote = OLD.id_lote
    ORDER BY nv.fecha_emision DESC, nv.serie_numero DESC LIMIT 1;

    IF OLD.estado = 'Disponible' AND NEW.estado = 'Separado' THEN
        IF v_fecha IS DISTINCT FROM v_hoy THEN
            RAISE EXCEPTION 'Registre la nota de separacion antes de separar el lote.';
        END IF;
    ELSIF OLD.estado = 'Separado' AND NEW.estado = 'Disponible' THEN
        IF v_fecha IS NULL OR v_hoy < v_fecha + 8 THEN
            RAISE EXCEPTION 'Solo se libera una separacion cuyo plazo haya vencido.';
        END IF;
    ELSIF OLD.estado = 'Separado' AND NEW.estado = 'Vendido' THEN
        IF v_fecha IS NULL OR v_hoy < v_fecha OR v_hoy >= v_fecha + 8 THEN
            RAISE EXCEPTION 'La separacion debe estar dentro del plazo para concretarla.';
        END IF;
    ELSE
        RAISE EXCEPTION 'Cambio de estado no permitido: % -> %.',
            OLD.estado, NEW.estado;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER tr_app_20_lote
BEFORE INSERT OR UPDATE ON public.lote
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_lote();

-- Cada nueva nota corresponde a una separacion pagada.
-- El bloqueo del lote se conserva hasta terminar la transaccion.
CREATE OR REPLACE FUNCTION public.fn_app_validar_nota()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_estado text;
    v_hoy date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date;
    v_ultima_fecha date;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Las notas de venta se conservan como historial y no se eliminan.';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF (to_jsonb(NEW) - ARRAY['forma_pago', 'descripcion'])
            IS DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['forma_pago', 'descripcion']) THEN
            RAISE EXCEPTION 'Solo se permite corregir forma_pago y descripcion de la nota.';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.fecha_emision IS DISTINCT FROM v_hoy THEN
        RAISE EXCEPTION 'Una nueva separacion debe tener la fecha de hoy: %.', v_hoy;
    END IF;
    IF NEW.cantidad IS DISTINCT FROM 1
       OR NEW.precio_unitario IS DISTINCT FROM 100::numeric
       OR NEW.total_pagar IS DISTINCT FROM 100::numeric
       OR NEW.monto_pagado IS DISTINCT FROM 100::numeric
       OR NEW.tipo_comprobante IS DISTINCT FROM 'Nota de venta'
       OR NEW.unidad IS DISTINCT FROM 'UND' THEN
        RAISE EXCEPTION 'La separacion requiere una unidad y un pago completo de S/ 100.';
    END IF;

    SELECT l.estado INTO v_estado
    FROM public.lote l WHERE l.id_lote = NEW.id_lote FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el lote %.', NEW.id_lote
            USING ERRCODE = 'P0002';
    END IF;
    IF v_estado IS DISTINCT FROM 'Disponible' THEN
        RAISE EXCEPTION 'El lote % no esta disponible (estado: %).',
            NEW.id_lote, v_estado;
    END IF;
    SELECT max(nv.fecha_emision) INTO v_ultima_fecha
    FROM public.nota_venta nv WHERE nv.id_lote = NEW.id_lote;
    IF v_ultima_fecha IS NOT NULL AND v_ultima_fecha >= NEW.fecha_emision THEN
        RAISE EXCEPTION 'La fecha de la nueva nota debe superar a las notas anteriores del lote.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER tr_app_20_nota_validar
BEFORE INSERT OR UPDATE OR DELETE ON public.nota_venta
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_nota();

CREATE OR REPLACE FUNCTION public.fn_app_separar_lote()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    UPDATE public.lote SET estado = 'Separado'
    WHERE id_lote = NEW.id_lote AND estado = 'Disponible';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se pudo separar el lote %.', NEW.id_lote;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER tr_app_30_nota_separar
AFTER INSERT ON public.nota_venta
FOR EACH ROW EXECUTE FUNCTION public.fn_app_separar_lote();

-- Borrados: respeta dependencias; cliente solo si no tiene notas.
-- Los telefonos del cliente se eliminan conjuntamente con el cliente.
CREATE OR REPLACE FUNCTION public.fn_app_validar_borrado()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    CASE TG_TABLE_NAME
    WHEN 'ciudad_proyecto' THEN
        IF EXISTS (SELECT 1 FROM public.proyecto WHERE ciudad_proyecto = OLD.id_ciudad) THEN
            RAISE EXCEPTION 'La ciudad tiene proyectos asociados.';
        END IF;
    WHEN 'distrito_proyecto' THEN
        IF EXISTS (SELECT 1 FROM public.proyecto WHERE distrito_proyecto = OLD.id_distrito) THEN
            RAISE EXCEPTION 'El distrito tiene proyectos asociados.';
        END IF;
    WHEN 'proyecto' THEN
        IF EXISTS (SELECT 1 FROM public.lote WHERE nombre_proyecto = OLD.nombre_proyecto) THEN
            RAISE EXCEPTION 'El proyecto tiene lotes asociados.';
        END IF;
    WHEN 'lote' THEN
        IF OLD.estado IS DISTINCT FROM 'Disponible'
           OR EXISTS (SELECT 1 FROM public.nota_venta WHERE id_lote = OLD.id_lote) THEN
            RAISE EXCEPTION 'Solo se elimina un lote disponible y sin notas de venta.';
        END IF;
    WHEN 'cliente' THEN
        IF EXISTS (SELECT 1 FROM public.nota_venta WHERE dni_cliente = OLD.dni_cliente) THEN
            RAISE EXCEPTION 'El cliente tiene notas de venta y debe conservarse.';
        END IF;
        DELETE FROM public.telefono_cliente WHERE dni_cliente = OLD.dni_cliente;
    WHEN 'asesor' THEN
        IF EXISTS (SELECT 1 FROM public.nota_venta WHERE dni_asesor = OLD.dni_asesor) THEN
            RAISE EXCEPTION 'El asesor tiene notas de venta y debe conservarse.';
        END IF;
    ELSE
        RAISE EXCEPTION 'Tabla no prevista para este trigger: %.', TG_TABLE_NAME;
    END CASE;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE TRIGGER tr_app_40_borrar_ciudad_proyecto
BEFORE DELETE ON public.ciudad_proyecto
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_borrado();

CREATE OR REPLACE TRIGGER tr_app_40_borrar_distrito_proyecto
BEFORE DELETE ON public.distrito_proyecto
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_borrado();

CREATE OR REPLACE TRIGGER tr_app_40_borrar_proyecto
BEFORE DELETE ON public.proyecto
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_borrado();

CREATE OR REPLACE TRIGGER tr_app_40_borrar_cliente
BEFORE DELETE ON public.cliente
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_borrado();

CREATE OR REPLACE TRIGGER tr_app_40_borrar_asesor
BEFORE DELETE ON public.asesor
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_borrado();

CREATE OR REPLACE TRIGGER tr_app_40_borrar_lote
BEFORE DELETE ON public.lote
FOR EACH ROW EXECUTE FUNCTION public.fn_app_validar_borrado();

-- PROCEDIMIENTOS CRUD: se invocan mediante CALL desde el backend.

CREATE OR REPLACE PROCEDURE public.sp_insertar_ciudad_proyecto(
    IN p_descripcion text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    INSERT INTO public.ciudad_proyecto (descripcion)
    VALUES (p_descripcion);
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_modificar_ciudad_proyecto(
    IN p_id_ciudad integer,
    IN p_descripcion text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    UPDATE public.ciudad_proyecto SET descripcion = p_descripcion
    WHERE id_ciudad = p_id_ciudad;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de ciudad_proyecto.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_eliminar_ciudad_proyecto(
    IN p_id_ciudad integer
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    DELETE FROM public.ciudad_proyecto WHERE id_ciudad = p_id_ciudad;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de ciudad_proyecto.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_insertar_distrito_proyecto(
    IN p_descripcion text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    INSERT INTO public.distrito_proyecto (descripcion)
    VALUES (p_descripcion);
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_modificar_distrito_proyecto(
    IN p_id_distrito integer,
    IN p_descripcion text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    UPDATE public.distrito_proyecto SET descripcion = p_descripcion
    WHERE id_distrito = p_id_distrito;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de distrito_proyecto.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_eliminar_distrito_proyecto(
    IN p_id_distrito integer
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    DELETE FROM public.distrito_proyecto WHERE id_distrito = p_id_distrito;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de distrito_proyecto.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_insertar_proyecto(
    IN p_nombre_proyecto text,
    IN p_ciudad_proyecto integer,
    IN p_distrito_proyecto integer
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    INSERT INTO public.proyecto (nombre_proyecto, ciudad_proyecto, distrito_proyecto)
    VALUES (p_nombre_proyecto, p_ciudad_proyecto, p_distrito_proyecto);
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_modificar_proyecto(
    IN p_nombre_proyecto text,
    IN p_ciudad_proyecto integer,
    IN p_distrito_proyecto integer
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    UPDATE public.proyecto SET ciudad_proyecto = p_ciudad_proyecto, distrito_proyecto = p_distrito_proyecto
    WHERE nombre_proyecto = p_nombre_proyecto;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de proyecto.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_eliminar_proyecto(
    IN p_nombre_proyecto text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    DELETE FROM public.proyecto WHERE nombre_proyecto = p_nombre_proyecto;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de proyecto.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_insertar_cliente(
    IN p_dni_cliente text,
    IN p_direccion text,
    IN p_nombres text,
    IN p_apellidos text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    INSERT INTO public.cliente (dni_cliente, direccion, nombres, apellidos)
    VALUES (p_dni_cliente, p_direccion, p_nombres, p_apellidos);
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_modificar_cliente(
    IN p_dni_cliente text,
    IN p_direccion text,
    IN p_nombres text,
    IN p_apellidos text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    UPDATE public.cliente SET direccion = p_direccion, nombres = p_nombres, apellidos = p_apellidos
    WHERE dni_cliente = p_dni_cliente;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de cliente.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_eliminar_cliente(
    IN p_dni_cliente text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    DELETE FROM public.cliente WHERE dni_cliente = p_dni_cliente;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de cliente.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_insertar_asesor(
    IN p_dni_asesor text,
    IN p_nombres text,
    IN p_apellidos text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    INSERT INTO public.asesor (dni_asesor, nombres, apellidos)
    VALUES (p_dni_asesor, p_nombres, p_apellidos);
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_modificar_asesor(
    IN p_dni_asesor text,
    IN p_nombres text,
    IN p_apellidos text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    UPDATE public.asesor SET nombres = p_nombres, apellidos = p_apellidos
    WHERE dni_asesor = p_dni_asesor;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de asesor.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_eliminar_asesor(
    IN p_dni_asesor text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    DELETE FROM public.asesor WHERE dni_asesor = p_dni_asesor;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de asesor.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_insertar_telefono_cliente(
    IN p_dni_cliente text,
    IN p_telefono text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    INSERT INTO public.telefono_cliente (dni_cliente, telefono)
    VALUES (p_dni_cliente, p_telefono);
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_modificar_telefono_cliente(
    IN p_dni_cliente text,
    IN p_telefono text,
    IN p_telefono_nuevo text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    UPDATE public.telefono_cliente SET telefono = p_telefono_nuevo
    WHERE dni_cliente = p_dni_cliente AND telefono = p_telefono;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de telefono_cliente.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_eliminar_telefono_cliente(
    IN p_dni_cliente text,
    IN p_telefono text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    DELETE FROM public.telefono_cliente WHERE dni_cliente = p_dni_cliente AND telefono = p_telefono;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de telefono_cliente.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_insertar_lote(
    IN p_nombre_proyecto text,
    IN p_numero_lote integer,
    IN p_calle text,
    IN p_manzana text,
    IN p_tipo_ubicacion text,
    IN p_precio_metro numeric,
    IN p_area numeric
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    INSERT INTO public.lote (nombre_proyecto, numero_lote, calle, manzana, tipo_ubicacion, precio_metro, area, estado, precio_venta)
    VALUES (p_nombre_proyecto, p_numero_lote, p_calle, p_manzana, p_tipo_ubicacion, p_precio_metro, p_area, 'Disponible', round(p_area * p_precio_metro, 2));
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_modificar_lote(
    IN p_id_lote integer,
    IN p_nombre_proyecto text,
    IN p_numero_lote integer,
    IN p_calle text,
    IN p_manzana text,
    IN p_tipo_ubicacion text,
    IN p_precio_metro numeric,
    IN p_area numeric
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    UPDATE public.lote SET nombre_proyecto = p_nombre_proyecto, numero_lote = p_numero_lote, calle = p_calle, manzana = p_manzana, tipo_ubicacion = p_tipo_ubicacion, precio_metro = p_precio_metro, area = p_area
    WHERE id_lote = p_id_lote;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de lote.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_eliminar_lote(
    IN p_id_lote integer
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    DELETE FROM public.lote WHERE id_lote = p_id_lote;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontro el registro de lote.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

-- La fecha y los importes de la separacion se fijan en la BD.
-- Las restricciones FK y CHECK originales siguen validando todos los registros.
CREATE OR REPLACE PROCEDURE public.sp_registrar_separacion(
    IN p_serie_numero text,
    IN p_id_lote integer,
    IN p_dni_cliente text,
    IN p_dni_asesor text,
    IN p_forma_pago text,
    IN p_descripcion text DEFAULT 'Separacion de lote'
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    INSERT INTO public.nota_venta (
        serie_numero, id_lote, dni_cliente, dni_asesor,
        tipo_comprobante, fecha_emision, total_pagar, forma_pago,
        monto_pagado, descripcion, unidad, cantidad, precio_unitario
    ) VALUES (
        p_serie_numero, p_id_lote, p_dni_cliente, p_dni_asesor,
        'Nota de venta', (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date,
        100, p_forma_pago, 100, p_descripcion, 'UND', 1, 100
    );
END;
$$;

CREATE OR REPLACE PROCEDURE public.sp_modificar_nota_venta(
    IN p_serie_numero text,
    IN p_forma_pago text,
    IN p_descripcion text
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    UPDATE public.nota_venta
    SET forma_pago = p_forma_pago, descripcion = p_descripcion
    WHERE serie_numero = p_serie_numero;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe la nota de venta %.', p_serie_numero
            USING ERRCODE = 'P0002';
    END IF;
END;
$$;

-- Accion manual del asesor; no se ejecuta por el simple paso del tiempo.
CREATE OR REPLACE PROCEDURE public.sp_liberar_separacion_vencida(
    IN p_id_lote integer
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
    v_estado text;
BEGIN
    SELECT estado INTO v_estado FROM public.lote
    WHERE id_lote = p_id_lote FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el lote %.', p_id_lote USING ERRCODE = 'P0002';
    END IF;
    IF v_estado IS DISTINCT FROM 'Separado' THEN
        RAISE EXCEPTION 'El lote debe estar Separado para liberarlo.';
    END IF;
    -- El trigger valida que hayan transcurrido los ocho dias.
    UPDATE public.lote SET estado = 'Disponible' WHERE id_lote = p_id_lote;
END;
$$;

-- Solo representa el cierre comercial, no registra el pago total del terreno.
CREATE OR REPLACE PROCEDURE public.sp_concretar_separacion(
    IN p_id_lote integer
) LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
    v_estado text;
BEGIN
    SELECT estado INTO v_estado FROM public.lote
    WHERE id_lote = p_id_lote FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe el lote %.', p_id_lote USING ERRCODE = 'P0002';
    END IF;
    IF v_estado IS DISTINCT FROM 'Separado' THEN
        RAISE EXCEPTION 'El lote debe estar Separado para concretar la operacion.';
    END IF;
    UPDATE public.lote SET estado = 'Vendido' WHERE id_lote = p_id_lote;
END;
$$;

COMMIT;

-- EJEMPLOS (no se ejecutan al instalar):
-- Utilizar DNIs, proyectos, identificadores y series reales de su BD.
-- CALL public.sp_insertar_cliente('12345678', 'Calle 1', 'Ana', 'Perez');
-- CALL public.sp_modificar_cliente('12345678', 'Calle 2', 'Ana Maria', 'Perez');
-- CALL public.sp_insertar_telefono_cliente('12345678', '987654321');
-- CALL public.sp_modificar_telefono_cliente('12345678', '987654321', '987654322');
-- CALL public.sp_eliminar_telefono_cliente('12345678', '987654322');
-- CALL public.sp_eliminar_cliente('12345678');
-- CALL public.sp_registrar_separacion('NV01-00000004', 1, '72133456', '41200178', 'Efectivo');
-- CALL public.sp_modificar_nota_venta('NV01-00000004', 'Transferencia', 'Separacion de lote');
-- CALL public.sp_concretar_separacion(1);
-- CALL public.sp_liberar_separacion_vencida(2);
--
-- Para agrupar varias llamadas (por ejemplo cliente + telefonos):
-- BEGIN;
-- CALL ...;
-- CALL ...;
-- COMMIT;
-- Ante cualquier error: ROLLBACK; y mostrar el mensaje al usuario.
--
-- Instalacion: no carga datos de ejemplo ni corrige notas historicas.
-- Los INSERT historicos del PDF deben cargarse ANTES de estos triggers.
-- No usar el procedimiento de separacion para migrar fechas antiguas.
-- Control de acceso: el backend debe limitar quien puede corregir notas,
-- concretar operaciones y liberar lotes. No conectar el frontend directamente.

/*
PRUEBA OPCIONAL: ejecutar este bloque POR SEPARADO, sin los delimitadores
de comentario, despues de instalar el script, en una BD de pruebas.
El ROLLBACK revierte sus filas; las secuencias IDENTITY pueden avanzar.
Si se produce un error inesperado, ejecutar ROLLBACK antes de continuar.

BEGIN;
DO $prueba$
DECLARE
    v_sufijo text := txid_current()::text;
    v_ciudad integer;
    v_distrito integer;
    v_lote integer;
    v_dni text;
    v_asesor text;
    v_proyecto text := 'PRUEBA_APP_' || txid_current()::text;
    v_serie text := 'TEST-' || txid_current()::text;
    v_estado text;
    v_rechazado boolean;
BEGIN
    SELECT lpad(n::text, 8, '0') INTO v_dni
    FROM generate_series(99000000, 99000999) AS g(n)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.cliente WHERE dni_cliente = lpad(n::text, 8, '0')
    ) ORDER BY n LIMIT 1;
    SELECT lpad(n::text, 8, '0') INTO v_asesor
    FROM generate_series(99000000, 99000999) AS g(n)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.asesor WHERE dni_asesor = lpad(n::text, 8, '0')
    ) ORDER BY n LIMIT 1;
    IF v_dni IS NULL OR v_asesor IS NULL THEN
        RAISE EXCEPTION 'No hay DNIs de prueba disponibles.';
    END IF;

    CALL public.sp_insertar_ciudad_proyecto('PRUEBA_CIUDAD_' || v_sufijo);
    SELECT id_ciudad INTO v_ciudad FROM public.ciudad_proyecto
    WHERE descripcion = 'PRUEBA_CIUDAD_' || v_sufijo;
    CALL public.sp_insertar_distrito_proyecto('PRUEBA_DISTRITO_' || v_sufijo);
    SELECT id_distrito INTO v_distrito FROM public.distrito_proyecto
    WHERE descripcion = 'PRUEBA_DISTRITO_' || v_sufijo;
    CALL public.sp_insertar_proyecto(v_proyecto, v_ciudad, v_distrito);
    CALL public.sp_insertar_cliente(v_dni, 'Calle prueba', 'Ana', 'Perez');
    CALL public.sp_modificar_cliente(v_dni, 'Calle nueva', 'Ana Maria', 'Perez');
    IF NOT EXISTS (
        SELECT 1 FROM public.cliente
        WHERE dni_cliente = v_dni AND nombres = 'Ana Maria'
    ) THEN RAISE EXCEPTION 'Fallo al modificar el cliente.'; END IF;
    CALL public.sp_insertar_telefono_cliente(v_dni, '999111222');
    CALL public.sp_modificar_telefono_cliente(v_dni, '999111222', '999111223');
    IF NOT EXISTS (
        SELECT 1 FROM public.telefono_cliente
        WHERE dni_cliente = v_dni AND telefono = '999111223'
    ) THEN RAISE EXCEPTION 'Fallo al modificar el telefono.'; END IF;
    CALL public.sp_eliminar_telefono_cliente(v_dni, '999111223');
    -- Cliente sin notas: se permite eliminar; despues se vuelve a crear.
    CALL public.sp_eliminar_cliente(v_dni);
    IF EXISTS (SELECT 1 FROM public.cliente WHERE dni_cliente = v_dni)
    THEN RAISE EXCEPTION 'Fallo al eliminar el cliente.'; END IF;
    CALL public.sp_insertar_cliente(v_dni, 'Calle prueba', 'Ana', 'Perez');
    CALL public.sp_insertar_asesor(v_asesor, 'Luis', 'Ramos');
    CALL public.sp_insertar_lote(
        v_proyecto, 1, 'Calle 1', 'A', 'Esquina', 230::numeric, 140::numeric
    );
    SELECT id_lote INTO v_lote FROM public.lote
    WHERE nombre_proyecto = v_proyecto AND manzana = 'A' AND numero_lote = 1;
    IF NOT EXISTS (
        SELECT 1 FROM public.lote
        WHERE id_lote = v_lote AND precio_venta = 32200 AND estado = 'Disponible'
    ) THEN RAISE EXCEPTION 'Fallo en el calculo del precio del lote.'; END IF;

    -- Duplicar ubicacion debe fallar.
    v_rechazado := false;
    BEGIN
        CALL public.sp_insertar_lote(
            v_proyecto, 1, 'Calle 1', 'A', 'Esquina', 230::numeric, 140::numeric
        );
    EXCEPTION WHEN unique_violation THEN v_rechazado := true;
    END;
    IF NOT v_rechazado THEN RAISE EXCEPTION 'Se acepto un lote duplicado.'; END IF;

    -- Una FK invalida debe revertir tambien la separacion del lote.
    v_rechazado := false;
    BEGIN
        CALL public.sp_registrar_separacion(v_serie, v_lote, NULL, v_asesor, 'Efectivo');
    EXCEPTION WHEN not_null_violation THEN v_rechazado := true;
    END;
    IF NOT v_rechazado THEN RAISE EXCEPTION 'Se acepto un cliente nulo.'; END IF;
    SELECT estado INTO v_estado FROM public.lote WHERE id_lote = v_lote;
    IF v_estado <> 'Disponible' THEN
        RAISE EXCEPTION 'La operacion fallida dejo el lote separado.';
    END IF;

    CALL public.sp_registrar_separacion(v_serie, v_lote, v_dni, v_asesor, 'Efectivo');
    SELECT estado INTO v_estado FROM public.lote WHERE id_lote = v_lote;
    IF v_estado <> 'Separado' THEN
        RAISE EXCEPTION 'El trigger no separo el lote.';
    END IF;

    v_rechazado := false;
    BEGIN
        CALL public.sp_registrar_separacion(
            v_serie || 'B', v_lote, v_dni, v_asesor, 'Efectivo'
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rechazado := true;
    END;
    IF NOT v_rechazado THEN RAISE EXCEPTION 'Se acepto una doble separacion.'; END IF;

    v_rechazado := false;
    BEGIN
        CALL public.sp_liberar_separacion_vencida(v_lote);
    EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rechazado := true;
    END;
    IF NOT v_rechazado THEN RAISE EXCEPTION 'Se libero antes del vencimiento.'; END IF;

    v_rechazado := false;
    BEGIN
        CALL public.sp_eliminar_cliente(v_dni);
    EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rechazado := true;
    END;
    IF NOT v_rechazado THEN RAISE EXCEPTION 'Se elimino un cliente con historial.'; END IF;

    v_rechazado := false;
    BEGIN
        DELETE FROM public.nota_venta WHERE serie_numero = v_serie;
    EXCEPTION WHEN SQLSTATE 'P0001' THEN v_rechazado := true;
    END;
    IF NOT v_rechazado THEN RAISE EXCEPTION 'Se elimino una nota de venta.'; END IF;

    CALL public.sp_modificar_nota_venta(v_serie, 'Transferencia', 'Separacion corregida');
    CALL public.sp_concretar_separacion(v_lote);
    SELECT estado INTO v_estado FROM public.lote WHERE id_lote = v_lote;
    IF v_estado <> 'Vendido' THEN RAISE EXCEPTION 'No se concreto la operacion.'; END IF;

    RAISE NOTICE 'Pruebas basicas correctas. ROLLBACK eliminara las filas de prueba.';
END;
$prueba$;
ROLLBACK;
*/


