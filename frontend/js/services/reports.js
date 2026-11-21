import { availability, latestNote, reservationStatus } from './domain.js';
import { fullName, money, number, dateLabel } from '../lib/format.js';

export const reportNames = ['Lotes disponibles por proyecto y ubicación', 'Ficha de un lote', 'Historial general de separaciones', 'Historial de un cliente', 'Control del plazo de lotes separados', 'Disponibilidad por proyecto', 'Clientes y teléfonos', 'Separaciones por asesor y periodo', 'Operaciones por proyecto y manzana', 'Pagos por forma de pago y periodo'];
export function buildReport(data, id, filters = {}) {
  id = Number(id);
  if (!Number.isInteger(id) || id < 1 || id > 10) throw new Error('Selecciona un reporte válido.');
  if (filters.from && filters.to && filters.from > filters.to) throw new Error('La fecha inicial debe ser anterior o igual a la final.');
  const projectMatch = lot => !filters.project || lot.nombre_proyecto === filters.project;
  const lotOf = note => data.lote.find(lot => lot.id_lote === note.id_lote);
  const clientOf = note => fullName(data.cliente.find(x => x.dni_cliente === note.dni_cliente));
  const advisorOf = note => fullName(data.asesor.find(x => x.dni_asesor === note.dni_asesor));
  const notes = data.nota_venta.filter(note => (!filters.from || note.fecha_emision >= filters.from) && (!filters.to || note.fecha_emision <= filters.to) && (!filters.project || lotOf(note)?.nombre_proyecto === filters.project)).sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision) || b.serie_numero.localeCompare(a.serie_numero));
  let headers = []; let rows = []; let note = '';
  if (id === 1) {
    headers = ['ID', 'Proyecto', 'Ciudad', 'Distrito', 'Manzana', 'Lote', 'Área', 'Precio de venta'];
    rows = data.lote.filter(lot => lot.estado === 'Disponible' && projectMatch(lot)).map(lot => { const project = data.proyecto.find(x => x.nombre_proyecto === lot.nombre_proyecto); return [lot.id_lote, lot.nombre_proyecto, data.ciudad_proyecto.find(x => x.id_ciudad === project.ciudad_proyecto)?.descripcion, data.distrito_proyecto.find(x => x.id_distrito === project.distrito_proyecto)?.descripcion, lot.manzana, lot.numero_lote, `${number(lot.area)} m²`, money(lot.precio_venta)]; });
  } else if (id === 2) {
    if (!filters.lot) throw new Error('Selecciona un lote para consultar su ficha.');
    headers = ['ID', 'Proyecto', 'Manzana', 'Lote', 'Calle', 'Ubicación', 'Área', 'Precio por m²', 'Precio de venta', 'Estado'];
    rows = data.lote.filter(lot => lot.id_lote === Number(filters.lot)).map(lot => [lot.id_lote, lot.nombre_proyecto, lot.manzana, lot.numero_lote, lot.calle, lot.tipo_ubicacion, `${number(lot.area)} m²`, money(lot.precio_metro), money(lot.precio_venta), lot.estado]);
  } else if ([3, 4, 8, 9].includes(id)) {
    if (id === 4 && !filters.client) throw new Error('Selecciona un cliente.');
    if (id === 8 && (!filters.advisor || !filters.from || !filters.to)) throw new Error('Selecciona asesor y periodo.');
    if (id === 9 && (!filters.project || !filters.block)) throw new Error('Selecciona proyecto y manzana.');
    headers = ['Nota', 'Fecha', 'Cliente', 'Proyecto', 'Manzana', 'Lote', 'Asesor', 'Pago', 'Forma de pago'];
    rows = notes.filter(x => (id !== 4 || x.dni_cliente === filters.client) && (id !== 8 || x.dni_asesor === filters.advisor) && (id !== 9 || lotOf(x)?.manzana === filters.block)).map(x => { const lot = lotOf(x); return [x.serie_numero, dateLabel(x.fecha_emision), clientOf(x), lot?.nombre_proyecto, lot?.manzana, lot?.numero_lote, advisorOf(x), money(x.monto_pagado), x.forma_pago]; });
    note = 'Las filas representan notas históricas de separación, no reservas actualmente vigentes.';
  } else if (id === 5) {
    headers = ['Nota', 'Cliente', 'Proyecto', 'Manzana', 'Lote', 'Separación', 'Vencimiento', 'Días restantes', 'Situación'];
    rows = data.lote.filter(lot => lot.estado === 'Separado' && projectMatch(lot)).map(lot => { const current = latestNote(data, lot.id_lote); if (!current) return null; const status = reservationStatus(current); return [current.serie_numero, clientOf(current), lot.nombre_proyecto, lot.manzana, lot.numero_lote, dateLabel(current.fecha_emision), dateLabel(status.expires), status.remaining, status.future ? 'Fecha futura: revisar' : status.expired ? 'Plazo vencido' : 'Dentro del plazo']; }).filter(Boolean);
    note = 'Se muestra la última nota por lote separado. El plazo termina al inicio de la fecha de vencimiento; el lote se libera manualmente.';
  } else if (id === 6) {
    headers = ['Proyecto', 'Total de lotes', 'Disponibles', 'Separados', 'Vendidos'];
    rows = availability(data).filter(projectMatch).map(x => [x.nombre_proyecto, x.total, x.disponibles, x.separados, x.vendidos]);
  } else if (id === 7) {
    headers = ['DNI', 'Nombres', 'Apellidos', 'Dirección', 'Teléfonos'];
    rows = [...data.cliente].sort((a, b) => a.apellidos.localeCompare(b.apellidos)).map(x => [x.dni_cliente, x.nombres, x.apellidos, x.direccion, data.telefono_cliente.filter(t => t.dni_cliente === x.dni_cliente).map(t => t.telefono).join(', ') || 'Sin teléfono']);
  } else if (id === 10) {
    if (!filters.from || !filters.to) throw new Error('Selecciona la fecha inicial y final.');
    headers = ['Forma de pago', 'Cantidad de operaciones', 'Total registrado'];
    const grouped = new Map(); let cents = 0;
    for (const item of notes.filter(x => !filters.payment || x.forma_pago === filters.payment)) {
      const amount = Math.round(item.monto_pagado * 100); const group = grouped.get(item.forma_pago) || { count: 0, cents: 0 };
      group.count += 1; group.cents += amount; cents += amount; grouped.set(item.forma_pago, group);
    }
    rows = [...grouped].sort((a, b) => b[1].cents - a[1].cents).map(([payment, group]) => [payment, group.count, money(group.cents / 100)]);
    note = `Total de pagos registrados: ${money(cents / 100)}. Corresponde a separaciones, no a ventas totales de terrenos.`;
  }
  return { title: reportNames[id - 1], headers, rows, note };
}
