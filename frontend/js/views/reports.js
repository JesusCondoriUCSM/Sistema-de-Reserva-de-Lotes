import { heading, field, button, table, bindPages, toast } from '../components/ui.js';
import { reportNames, buildReport } from '../services/reports.js';
import { escapeHTML as e, fullName, today, addDays, lotLabel } from '../lib/format.js';

export function mount(container, context) {
  let id = 6; let filters = {}; let page = 1; let result = buildReport(context.repository.snapshot(), id, filters);
  const render = () => {
    const data = context.repository.snapshot();
    const fields = [];
    if ([1, 3, 5, 6, 9].includes(id)) fields.push(field('project', 'Proyecto', { required: id === 9, value: filters.project || '', options: [['', id === 9 ? 'Selecciona un proyecto' : 'Todos'], ...data.proyecto.map(x => [x.nombre_proyecto, x.nombre_proyecto])] }));
    if (id === 2) fields.push(field('lot', 'Lote', { value: filters.lot || '', options: [['', 'Selecciona un lote'], ...data.lote.map(x => [x.id_lote, `${lotLabel(x)} · ${x.nombre_proyecto} · Mz. ${x.manzana} · ${x.numero_lote}`])] }));
    if (id === 4) fields.push(field('client', 'Cliente', { value: filters.client || '', options: [['', 'Selecciona un cliente'], ...data.cliente.map(x => [x.dni_cliente, `${x.dni_cliente} · ${fullName(x)}`])] }));
    if (id === 8) fields.push(field('advisor', 'Asesor', { value: filters.advisor || '', options: [['', 'Selecciona un asesor'], ...data.asesor.map(x => [x.dni_asesor, fullName(x)])] }));
    if (id === 9) fields.push(field('block', 'Manzana', { value: filters.block || '', options: [['', 'Selecciona una manzana'], ...[...new Set(data.lote.map(x => x.manzana))].sort().map(x => [x, x])] }));
    if ([3, 8, 10].includes(id)) fields.push(field('from', 'Desde', { type: 'date', required: id !== 3, value: filters.from || '' }), field('to', 'Hasta', { type: 'date', required: id !== 3, value: filters.to || '' }));
    if (id === 10) fields.push(field('payment', 'Forma de pago', { required: false, value: filters.payment || '', options: [['', 'Todas'], ...[...new Set(data.nota_venta.map(x => x.forma_pago))].map(x => [x, x])] }));
    container.innerHTML = heading('Reportes', 'Consulta información operativa según el reporte seleccionado.') + `<section class="card filters"><div class="field" style="margin-bottom:20px">${field('report', 'Seleccionar reporte', { value: id, options: reportNames.map((name, i) => [i + 1, `${i + 1}. ${name}`]) })}</div><form id="report-filters"><div class="fields">${fields.join('')}</div><div class="filter-actions"><button class="btn primary" type="submit">Consultar</button>${button('Limpiar', 'id="clear-report"')}</div></form></section><div id="report-results">${result ? table(result.headers, result.rows.map(row => row.map(e)), { title: result.title, total: result.rows.length, page, paginated: true }) + (result.note ? `<div class="info">${e(result.note)}</div>` : '') : '<div class="info">Completa los filtros y presiona Consultar para generar el reporte.</div>'}</div>`;
    container.querySelector('[name=report]').onchange = event => { id = Number(event.target.value); page = 1; filters = [8, 10].includes(id) ? { from: addDays(today(), -30), to: today() } : {}; result = null; render(); };
    container.querySelector('#report-filters').onsubmit = event => {
      event.preventDefault(); filters = Object.fromEntries(new FormData(event.currentTarget));
      try { result = buildReport(context.repository.snapshot(), id, filters); page = 1; render(); } catch (error) { toast(error.message, true); }
    };
    container.querySelector('#clear-report').onclick = () => { filters = {}; result = null; page = 1; render(); };
    bindPages(container, value => { page = value; render(); });
  };
  render();
}
