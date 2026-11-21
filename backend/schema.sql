BEGIN;
CREATE TABLE ciudad_proyecto (
 id_ciudad integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 descripcion varchar(60) NOT NULL UNIQUE CHECK (btrim(descripcion) <> '')
);
CREATE TABLE distrito_proyecto (
 id_distrito integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 descripcion varchar(60) NOT NULL UNIQUE CHECK (btrim(descripcion) <> '')
);
CREATE TABLE proyecto (
 nombre_proyecto varchar(100) PRIMARY KEY,
 ciudad_proyecto integer NOT NULL REFERENCES ciudad_proyecto,
 distrito_proyecto integer NOT NULL REFERENCES distrito_proyecto
);
CREATE TABLE cliente (
 dni_cliente varchar(8) PRIMARY KEY CHECK (dni_cliente ~ '^[0-9]{8}$'),
 direccion varchar(150) NOT NULL, nombres varchar(80) NOT NULL, apellidos varchar(80) NOT NULL
);
CREATE TABLE asesor (
 dni_asesor varchar(8) PRIMARY KEY CHECK (dni_asesor ~ '^[0-9]{8}$'),
 nombres varchar(80) NOT NULL, apellidos varchar(80) NOT NULL
);
CREATE TABLE telefono_cliente (
 dni_cliente varchar(8) REFERENCES cliente ON DELETE CASCADE,
 telefono varchar(9) CHECK (telefono ~ '^[0-9]{9}$'),
 PRIMARY KEY (dni_cliente, telefono)
);
CREATE TABLE lote (
 id_lote integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id_lote BETWEEN 1 AND 999),
 nombre_proyecto varchar(100) NOT NULL REFERENCES proyecto,
 numero_lote integer NOT NULL CHECK (numero_lote BETWEEN 1 AND 999),
 calle varchar(50) NOT NULL, manzana varchar(10) NOT NULL,
 tipo_ubicacion varchar(20) NOT NULL CHECK (tipo_ubicacion IN ('Esquina','Frentera','Intermedio')),
 precio_metro numeric(5,2) NOT NULL CHECK (precio_metro > 0),
 area numeric(6,2) NOT NULL CHECK (area > 0),
 precio_venta numeric(8,2) NOT NULL CHECK (precio_venta > 0),
 estado varchar(12) NOT NULL CHECK (estado IN ('Disponible','Separado','Vendido'))
);
CREATE TABLE nota_venta (
 serie_numero varchar(20) PRIMARY KEY,
 id_lote integer NOT NULL REFERENCES lote,
 dni_cliente varchar(8) NOT NULL REFERENCES cliente,
 dni_asesor varchar(8) NOT NULL REFERENCES asesor,
 tipo_comprobante varchar(20) NOT NULL, fecha_emision date NOT NULL,
 total_pagar numeric(8,2) NOT NULL CHECK (total_pagar > 0),
 forma_pago varchar(25) NOT NULL, monto_pagado numeric(8,2) NOT NULL CHECK (monto_pagado > 0),
 descripcion varchar(200) NOT NULL, unidad varchar(10) NOT NULL,
 cantidad integer NOT NULL CHECK (cantidad > 0), precio_unitario numeric(8,2) NOT NULL CHECK (precio_unitario > 0)
);
CREATE INDEX ON nota_venta (id_lote, fecha_emision DESC);
CREATE INDEX ON nota_venta (dni_cliente);
CREATE INDEX ON nota_venta (dni_asesor);
COMMIT;
