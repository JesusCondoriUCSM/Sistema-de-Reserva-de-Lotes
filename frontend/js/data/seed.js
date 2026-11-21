import { today, addDays } from '../lib/format.js';

export function createSeed() {
  const date = today();
  const note = (serie_numero, id_lote, dni_cliente, dni_asesor, offset, forma_pago) => ({ serie_numero, id_lote, dni_cliente, dni_asesor, fecha_emision: addDays(date, offset), tipo_comprobante: 'Nota de venta', total_pagar: 100, monto_pagado: 100, forma_pago, descripcion: 'Separaci�n de lote', unidad: 'UND', cantidad: 1, precio_unitario: 100 });
  const lot = (id_lote, nombre_proyecto, manzana, numero_lote, area, precio_metro, estado, tipo_ubicacion = 'Intermedio') => ({ id_lote, nombre_proyecto, manzana, numero_lote, area, precio_metro, precio_venta: area * precio_metro, estado, calle: `Calle ${manzana === 'A' ? '1' : '2'}`, tipo_ubicacion });
  return {
    ciudad_proyecto: [{ id_ciudad: 1, descripcion: 'Lima' }, { id_ciudad: 2, descripcion: 'Trujillo' }, { id_ciudad: 3, descripcion: 'Chiclayo' }],
    distrito_proyecto: [{ id_distrito: 1, descripcion: 'Carabayllo' }, { id_distrito: 2, descripcion: 'Huanchaco' }, { id_distrito: 3, descripcion: 'Anc�n' }],
    proyecto: [{ nombre_proyecto: 'Los Girasoles', ciudad_proyecto: 1, distrito_proyecto: 1 }, { nombre_proyecto: 'Villa del Sol', ciudad_proyecto: 2, distrito_proyecto: 2 }, { nombre_proyecto: 'Alameda Norte', ciudad_proyecto: 1, distrito_proyecto: 3 }],
    lote: [lot(1, 'Los Girasoles', 'A', 1, 120, 450, 'Disponible', 'Esquina'), lot(2, 'Los Girasoles', 'A', 2, 150, 450, 'Separado'), lot(3, 'Los Girasoles', 'B', 1, 100, 450, 'Vendido'), lot(4, 'Villa del Sol', 'A', 1, 140, 400, 'Disponible', 'Frentera'), lot(5, 'Alameda Norte', 'C', 3, 125, 400, 'Disponible'), lot(6, 'Villa del Sol', 'B', 2, 135, 400, 'Separado'), lot(7, 'Alameda Norte', 'C', 4, 130, 400, 'Vendido', 'Esquina'), lot(8, 'Los Girasoles', 'B', 2, 110, 450, 'Disponible')],
    cliente: [{ dni_cliente: '45678912', nombres: 'Mar�a Elena', apellidos: 'Torres L�pez', direccion: 'Av. Lima 245' }, { dni_cliente: '70819234', nombres: 'Jos� Luis', apellidos: 'Ramos D�az', direccion: 'Jr. Sol 180' }, { dni_cliente: '62345178', nombres: 'Luc�a', apellidos: 'P�rez Soto', direccion: 'Calle Norte 42' }, { dni_cliente: '40125689', nombres: 'Carlos Alberto', apellidos: 'Mendoza R�os', direccion: 'Av. Central 128' }],
    telefono_cliente: [{ dni_cliente: '45678912', telefono: '987654321' }, { dni_cliente: '45678912', telefono: '912345678' }, { dni_cliente: '62345178', telefono: '956123487' }, { dni_cliente: '40125689', telefono: '987123654' }],
    asesor: [{ dni_asesor: '42567891', nombres: 'Ana', apellidos: 'Ruiz' }, { dni_asesor: '45891236', nombres: 'Pedro', apellidos: 'Salazar' }, { dni_asesor: '46782315', nombres: 'Elena', apellidos: 'Castro' }, { dni_asesor: '71234560', nombres: 'Luis', apellidos: 'Vargas' }],
    nota_venta: [note('NV01-000125', 2, '45678912', '42567891', -3, 'Efectivo'), note('NV01-000126', 6, '62345178', '45891236', -10, 'Transferencia'), note('NV01-000127', 3, '40125689', '42567891', -60, 'Efectivo'), note('NV01-000128', 7, '45678912', '46782315', -30, 'Dep�sito')],
    sequences: { lote: 9, ciudad_proyecto: 4, distrito_proyecto: 4 }
  };
}
