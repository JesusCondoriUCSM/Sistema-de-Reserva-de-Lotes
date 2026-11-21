import { today, addDays, daysBetween } from '../lib/format.js';

export function latestNote(data, lotId) {
  return data.nota_venta.filter(note => note.id_lote === Number(lotId)).sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision) || b.serie_numero.localeCompare(a.serie_numero))[0];
}
export function reservationStatus(note, date = today()) {
  const expires = addDays(note.fecha_emision, 8);
  return { expires, expired: date >= expires, future: date < note.fecha_emision, remaining: Math.max(daysBetween(date, expires), 0) };
}
export function availability(data) {
  return data.proyecto.map(project => {
    const lots = data.lote.filter(lot => lot.nombre_proyecto === project.nombre_proyecto);
    return { ...project, total: lots.length, disponibles: lots.filter(lot => lot.estado === 'Disponible').length, separados: lots.filter(lot => lot.estado === 'Separado').length, vendidos: lots.filter(lot => lot.estado === 'Vendido').length };
  });
}

