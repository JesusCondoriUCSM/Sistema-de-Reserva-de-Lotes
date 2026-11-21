-- Datos ficticios autorizados para una instalacion Docker NUEVA.
-- Cargar una sola vez, despues del esquema y antes de los triggers.
INSERT INTO public.ciudad_proyecto (id_ciudad, descripcion) OVERRIDING SYSTEM VALUE VALUES
(1, 'Lima'),
(2, 'Trujillo'),
(3, 'Chiclayo');

INSERT INTO public.distrito_proyecto (id_distrito, descripcion) OVERRIDING SYSTEM VALUE VALUES
(1, 'Carabayllo'),
(2, 'Huanchaco'),
(3, 'Ancón');

INSERT INTO public.proyecto (nombre_proyecto, ciudad_proyecto, distrito_proyecto) VALUES
('Los Girasoles', 1, 1),
('Villa del Sol', 2, 2),
('Alameda Norte', 1, 3);

INSERT INTO public.lote (id_lote, nombre_proyecto, manzana, numero_lote, area, precio_metro, precio_venta, estado, calle, tipo_ubicacion) OVERRIDING SYSTEM VALUE VALUES
(1, 'Los Girasoles', 'A', 1, 120, 450, 54000, 'Disponible', 'Calle 1', 'Esquina'),
(2, 'Los Girasoles', 'A', 2, 150, 450, 67500, 'Separado', 'Calle 1', 'Intermedio'),
(3, 'Los Girasoles', 'B', 1, 100, 450, 45000, 'Vendido', 'Calle 2', 'Intermedio'),
(4, 'Villa del Sol', 'A', 1, 140, 400, 56000, 'Disponible', 'Calle 1', 'Frentera'),
(5, 'Alameda Norte', 'C', 3, 125, 400, 50000, 'Disponible', 'Calle 2', 'Intermedio'),
(6, 'Villa del Sol', 'B', 2, 135, 400, 54000, 'Separado', 'Calle 2', 'Intermedio'),
(7, 'Alameda Norte', 'C', 4, 130, 400, 52000, 'Vendido', 'Calle 2', 'Esquina'),
(8, 'Los Girasoles', 'B', 2, 110, 450, 49500, 'Disponible', 'Calle 2', 'Intermedio');

INSERT INTO public.cliente (dni_cliente, nombres, apellidos, direccion) VALUES
('00000001', 'Cliente Demo', 'Uno', 'Direccion ficticia 1'),
('00000002', 'Cliente Demo', 'Dos', 'Direccion ficticia 2'),
('00000003', 'Cliente Demo', 'Tres', 'Direccion ficticia 3'),
('00000004', 'Cliente Demo', 'Cuatro', 'Direccion ficticia 4');

INSERT INTO public.telefono_cliente (dni_cliente, telefono) VALUES
('00000001', '000000001'),
('00000001', '000000002'),
('00000003', '000000003'),
('00000004', '000000004');

INSERT INTO public.asesor (dni_asesor, nombres, apellidos) VALUES
('00000011', 'Asesor Demo', 'Uno'),
('00000012', 'Asesor Demo', 'Dos'),
('00000013', 'Asesor Demo', 'Tres'),
('00000014', 'Asesor Demo', 'Cuatro');

INSERT INTO public.nota_venta (serie_numero, id_lote, dni_cliente, dni_asesor, fecha_emision, tipo_comprobante, total_pagar, monto_pagado, forma_pago, descripcion, unidad, cantidad, precio_unitario) VALUES
('NV01-000125', 2, '00000001', '00000011', ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date + -3), 'Nota de venta', 100, 100, 'Efectivo', 'Separación de lote', 'UND', 1, 100),
('NV01-000126', 6, '00000003', '00000012', ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date + -10), 'Nota de venta', 100, 100, 'Transferencia', 'Separación de lote', 'UND', 1, 100),
('NV01-000127', 3, '00000004', '00000011', ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date + -60), 'Nota de venta', 100, 100, 'Efectivo', 'Separación de lote', 'UND', 1, 100),
('NV01-000128', 7, '00000001', '00000013', ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date + -30), 'Nota de venta', 100, 100, 'Depósito', 'Separación de lote', 'UND', 1, 100);

SELECT setval(pg_get_serial_sequence('public.ciudad_proyecto', 'id_ciudad'), (SELECT max(id_ciudad) FROM public.ciudad_proyecto));
SELECT setval(pg_get_serial_sequence('public.distrito_proyecto', 'id_distrito'), (SELECT max(id_distrito) FROM public.distrito_proyecto));
SELECT setval(pg_get_serial_sequence('public.lote', 'id_lote'), (SELECT max(id_lote) FROM public.lote));
