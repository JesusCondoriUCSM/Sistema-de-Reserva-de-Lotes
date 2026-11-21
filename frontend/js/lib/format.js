export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const money = value => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value));
export const number = value => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(Number(value));
export function today() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function addDays(date, days) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
export function dateLabel(date) { if (!date) return '-'; const [y, m, d] = date.split('-'); return `${d}/${m}/${y}`; }
export const daysBetween = (start, end) => Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000);
export const fullName = person => person ? `${person.nombres} ${person.apellidos}` : '-';
export const lotLabel = lot => `L${String(lot.id_lote).padStart(3, '0')}`;
export const normalizeSearch = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
