// Datos exclusivamente ficticios: los identificadores con ceros y los telefonos de prueba no representan personas reales.
import { today, addDays } from '../lib/format.js';

export function createSeed() {
  const date = today();
  const note = (serie_numero, id_lote, dni_cliente, dni_asesor, offset, forma_pago) => ({ serie_numero, id_lote, dni_cliente, dni_asesor, fecha_emision: addDays(date, offset), tipo_comprobante: 'Nota de venta', total_pagar: 100, monto_pagado: 100, forma_pago, descripcion: 'Separación de lote', unidad: 'UND', cantidad: 1, precio_unitario: 100 });
  const lot = (id_lote, nombre_proyecto, manzana, numero_lote, area, precio_metro, estado, tipo_ubicacion = 'Intermedio') => ({ id_lote, nombre_proyecto, manzana, numero_lote, area, precio_metro, precio_venta: area * precio_metro, estado, calle: `Calle ${manzana === 'A' ? '1' : '2'}`, tipo_ubicacion });
  return {
    ciudad_proyecto: [{ id_ciudad: 1, descripcion: 'Lima' }, { id_ciudad: 2, descripcion: 'Trujillo' }, { id_ciudad: 3, descripcion: 'Chiclayo' }],
    distrito_proyecto: [{ id_distrito: 1, descripcion: 'Carabayllo' }, { id_distrito: 2, descripcion: 'Huanchaco' }, { id_distrito: 3, descripcion: 'Ancón' }],
    proyecto: [{ nombre_proyecto: 'Los Girasoles', ciudad_proyecto: 1, distrito_proyecto: 1 }, { nombre_proyecto: 'Villa del Sol', ciudad_proyecto: 2, distrito_proyecto: 2 }, { nombre_proyecto: 'Alameda Norte', ciudad_proyecto: 1, distrito_proyecto: 3 }],
    lote: [lot(1, 'Los Girasoles', 'A', 1, 120, 450, 'Disponible', 'Esquina'), lot(2, 'Los Girasoles', 'A', 2, 150, 450, 'Separado'), lot(3, 'Los Girasoles', 'B', 1, 100, 450, 'Vendido'), lot(4, 'Villa del Sol', 'A', 1, 140, 400, 'Disponible', 'Frentera'), lot(5, 'Alameda Norte', 'C', 3, 125, 400, 'Disponible'), lot(6, 'Villa del Sol', 'B', 2, 135, 400, 'Separado'), lot(7, 'Alameda Norte', 'C', 4, 130, 400, 'Vendido', 'Esquina'), lot(8, 'Los Girasoles', 'B', 2, 110, 450, 'Disponible')],
    cliente: [{ dni_cliente: '00000001', nombres: 'Cliente Demo', apellidos: 'Uno', direccion: 'Direccion ficticia 1' }, { dni_cliente: '00000002', nombres: 'Cliente Demo', apellidos: 'Dos', direccion: 'Direccion ficticia 2' }, { dni_cliente: '00000003', nombres: 'Cliente Demo', apellidos: 'Tres', direccion: 'Direccion ficticia 3' }, { dni_cliente: '00000004', nombres: 'Cliente Demo', apellidos: 'Cuatro', direccion: 'Direccion ficticia 4' }],
    telefono_cliente: [{ dni_cliente: '00000001', telefono: '000000001' }, { dni_cliente: '00000001', telefono: '000000002' }, { dni_cliente: '00000003', telefono: '000000003' }, { dni_cliente: '00000004', telefono: '000000004' }],
    asesor: [{ dni_asesor: '00000011', nombres: 'Asesor Demo', apellidos: 'Uno' }, { dni_asesor: '00000012', nombres: 'Asesor Demo', apellidos: 'Dos' }, { dni_asesor: '00000013', nombres: 'Asesor Demo', apellidos: 'Tres' }, { dni_asesor: '00000014', nombres: 'Asesor Demo', apellidos: 'Cuatro' }],
    nota_venta: [note('NV01-000125', 2, '00000001', '00000011', -3, 'Efectivo'), note('NV01-000126', 6, '00000003', '00000012', -10, 'Transferencia'), note('NV01-000127', 3, '00000004', '00000011', -60, 'Efectivo'), note('NV01-000128', 7, '00000001', '00000013', -30, 'Depósito')],
    sequences: { lote: 9, ciudad_proyecto: 4, distrito_proyecto: 4 }
  };
}
