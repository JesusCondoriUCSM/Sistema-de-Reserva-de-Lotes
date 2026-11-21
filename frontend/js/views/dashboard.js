import { heading, icon, table, badge } from '../components/ui.js';
import { availability } from '../services/demo-repository.js';
import { escapeHTML as e } from '../lib/format.js';

export function mount(container, { repository }) {
  const data = repository.snapshot(); const rows = availability(data);
  const total = data.lote.length;
  const stats = [['Disponible', 'Lotes disponibles', 'grid', '', 'disponibles'], ['Separado', 'Lotes separados', 'clock', 'sand', 'separados'], ['Vendido', 'Lotes vendidos', 'check', 'gray', 'vendidos']];
  container.innerHTML = heading('Inicio', 'Una vista general de la disponibilidad de tus proyectos.', 'RESUMEN GENERAL') +
    `<div class="stats">${stats.map(([state, label, symbol, color]) => { const count = data.lote.filter(lot => lot.estado === state).length; return `<article class="stat ${color}"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon(symbol)}</span></div><strong>${String(count).padStart(2, '0')}</strong><small>de ${total} lotes</small><div class="meter"><span style="width:${total ? count / total * 100 : 0}%"></span></div></article>`; }).join('')}</div>` +
    table(['Proyecto', 'Total de lotes', 'Disponibles', 'Separados', 'Vendidos'], rows.map((r, i) => [`<span class="row-number">${String(i + 1).padStart(2, '0')}</span>${e(r.nombre_proyecto)}`, r.total, r.disponibles, r.separados, r.vendidos]), { title: 'Disponibilidad por proyecto', subtitle: 'Distribuci�n actual de los lotes registrados.', footer: `<tr><td>Total general</td><td>${total}</td>${stats.map(([, , , , key]) => `<td>${rows.reduce((sum, r) => sum + r[key], 0)}</td>`).join('')}</tr>` }) +
    `<h2>Accesos directos</h2><div class="quick-grid">${[['lotes', 'grid', 'Consultar lotes', 'Revisa terrenos y su disponibilidad.'], ['clientes/nuevo', 'users', 'Registrar cliente', 'Agrega un cliente al sistema.'], ['separaciones/nueva', 'note', 'Registrar separaci�n', 'Separa un lote mediante una nota.']].map(([url, symbol, title, text]) => `<a class="quick" href="#/${url}">${icon(symbol)}<div><strong>${title}</strong><small>${text}</small></div><span class="arrow">${icon('arrow')}</span></a>`).join('')}</div><div class="info">Datos ficticios para revisar la interfaz. Las operaciones se guardan en este navegador. La conexi�n con la base de datos se implementar� en la siguiente etapa.</div>`;
}
