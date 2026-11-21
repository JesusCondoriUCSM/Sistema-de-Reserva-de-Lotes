import { heading, field, button, icon, table, badge, actionButtons, openModal, closeModal, formActions, toast, bindPages } from '../components/ui.js';
import { deleteRecord } from '../components/crud.js';
import { escapeHTML as e, money, number, dateLabel, fullName, lotLabel } from '../lib/format.js';

export function editLot(key, context) {
  const data = context.repository.snapshot(); const lot = key ? data.lote.find(x => x.id_lote === Number(key)) : null;
  if (key && !lot) { toast('El lote ya no existe.', true); return; }
  const input = (name, label, opts = {}) => field(name, label, { value: lot?.[name] ?? '', ...opts });
  const modal = openModal(lot ? 'Editar lote' : 'Registrar lote', `<form><p class="help">* Campos obligatorios · ${lot ? 'El estado se gestiona desde Separaciones.' : 'Estado inicial: Disponible'}</p><div class="fields two">${input('nombre_proyecto', 'Proyecto', { options: [['', 'Seleccione'], ...data.proyecto.map(x => [x.nombre_proyecto, x.nombre_proyecto])] })}${input('numero_lote', 'Número de lote', { type: 'number', attrs: 'min="1" max="999" step="1"' })}${input('calle', 'Calle', { attrs: 'maxlength="50"' })}${input('manzana', 'Manzana', { attrs: 'maxlength="10"' })}${input('tipo_ubicacion', 'Ubicación comercial', { options: [['Intermedio', 'Intermedio'], ['Esquina', 'Esquina'], ['Frentera', 'Frentera']] })}${input('area', 'Área (m²)', { type: 'number', attrs: 'min="0.01" max="9999.99" step="0.01"' })}${input('precio_metro', 'Precio por m² (S/)', { type: 'number', attrs: 'min="0.01" max="999.99" step="0.01"' })}</div><div class="info"><div class="summary-row"><span>Precio de venta calculado</span><strong id="lot-price">${money(lot?.precio_venta || 0)}</strong></div>Área × precio por m² · No editable</div>${formActions(lot ? 'Guardar cambios' : 'Guardar lote')}</form>`, { onSubmit: async values => { await context.repository.save('lote', values, lot?.id_lote ?? null); closeModal(); context.refresh(); toast('Lote guardado correctamente.'); } });
  const calculate = () => { const form = modal.querySelector('form'); modal.querySelector('#lot-price').textContent = money(Number(form.elements.area.value) * Number(form.elements.precio_metro.value)); };
  modal.querySelector('[name=area]').addEventListener('input', calculate); modal.querySelector('[name=precio_metro]').addEventListener('input', calculate);
}
export function mount(container, context) {
  if (context.params[0]) return mountDetail(container, context);
  let filters = { project: '', block: '', state: '' }; let page = 1;
  const render = () => {
    const data = context.repository.snapshot();
    const lots = data.lote.filter(x => (!filters.project || x.nombre_proyecto === filters.project) && (!filters.block || x.manzana === filters.block) && (!filters.state || x.estado === filters.state));
    page = Math.min(page, Math.max(1, Math.ceil(lots.length / 5)));
    container.innerHTML = heading('Lotes', 'Consulta la disponibilidad y administra los terrenos.') + `<section class="card filters"><form id="lot-filters"><div class="fields">${field('project', 'Proyecto', { required: false, value: filters.project, options: [['', 'Todos'], ...data.proyecto.map(x => [x.nombre_proyecto, x.nombre_proyecto])] })}${field('block', 'Manzana', { required: false, value: filters.block, options: [['', 'Todas'], ...[...new Set(data.lote.map(x => x.manzana))].sort().map(x => [x, x])] })}${field('state', 'Estado', { required: false, value: filters.state, options: [['', 'Todos'], ...['Disponible', 'Separado', 'Vendido'].map(x => [x, x])] })}</div><div class="filter-actions"><button class="btn primary" type="submit">${icon('search')} Buscar</button>${button('Limpiar filtros', 'id="clear-filters"')}${button(`${icon('plus')} Registrar lote`, 'id="new-lot"', 'push')}</div></form></section>` + table(['ID', 'Proyecto', 'Mz.', 'N.º', 'Área', 'Precio de venta', 'Estado', 'Acciones'], lots.map(lot => [e(lotLabel(lot)), e(lot.nombre_proyecto), e(lot.manzana), String(lot.numero_lote).padStart(2, '0'), `${number(lot.area)} m²`, money(lot.precio_venta), badge(lot.estado), actionButtons(lot.id_lote, { reserve: lot.estado === 'Disponible' })]), { title: 'Listado de lotes', page, total: lots.length, paginated: true }) + '<p class="help">Solo los lotes disponibles se pueden separar. Los lotes con historial no se pueden eliminar.</p>';
    const localContext = { ...context, refresh: render };
    container.querySelector('#lot-filters').onsubmit = event => { event.preventDefault(); filters = Object.fromEntries(new FormData(event.currentTarget)); page = 1; render(); };
    container.querySelector('#clear-filters').onclick = () => { filters = { project: '', block: '', state: '' }; page = 1; render(); };
    container.querySelector('#new-lot').onclick = () => editLot(null, localContext);
    container.querySelectorAll('[data-detail]').forEach(el => el.onclick = () => context.navigate(`lotes/${el.dataset.detail}`));
    container.querySelectorAll('[data-edit]').forEach(el => el.onclick = () => editLot(el.dataset.edit, localContext));
    container.querySelectorAll('[data-delete]').forEach(el => el.onclick = () => deleteRecord('lote', el.dataset.delete, `el lote ${lotLabel({ id_lote: el.dataset.delete })}`, localContext));
    container.querySelectorAll('[data-reserve]').forEach(el => el.onclick = () => context.navigate(`separaciones/nueva/${el.dataset.reserve}`));
    bindPages(container, value => { page = value; render(); });
  };
  render();
}
function mountDetail(container, context) {
  const render = () => {
    const data = context.repository.snapshot(); const lot = data.lote.find(x => x.id_lote === Number(context.params[0]));
    if (!lot) { container.innerHTML = heading('Lote no encontrado', 'El terreno no existe.') + '<a href="#/lotes">Volver a lotes</a>'; return; }
    const rows = [['Identificador', lotLabel(lot)], ['Proyecto', lot.nombre_proyecto], ['Manzana', lot.manzana], ['Número de lote', lot.numero_lote], ['Calle', lot.calle], ['Ubicación comercial', lot.tipo_ubicacion], ['Área', `${number(lot.area)} m²`], ['Precio por m²', money(lot.precio_metro)], ['Precio de venta', money(lot.precio_venta)]];
    const notes = data.nota_venta.filter(x => x.id_lote === lot.id_lote).sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision));
    container.innerHTML = heading('Detalle de lote', `${lot.nombre_proyecto} · Manzana ${lot.manzana} · Lote ${lot.numero_lote}`) + `<div class="toolbar"><a class="btn" href="#/lotes">← Volver a lotes</a><div class="actions">${button(`${icon('edit')} Editar lote`, 'id="edit-lot"')}${button('Registrar separación', `id="reserve-lot" ${lot.estado !== 'Disponible' ? 'disabled' : ''}`, 'primary')}</div></div><section class="card"><div class="card-head"><h2>Información del terreno</h2>${badge(lot.estado)}</div><div class="card-body"><dl class="data-grid">${rows.map(([label, value]) => `<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl></div></section>` + table(['Nota', 'Fecha', 'Cliente', 'Asesor', 'Pago'], notes.map(note => [`<a href="#/separaciones/nota/${encodeURIComponent(note.serie_numero)}">${e(note.serie_numero)}</a>`, dateLabel(note.fecha_emision), e(fullName(data.cliente.find(x => x.dni_cliente === note.dni_cliente))), e(fullName(data.asesor.find(x => x.dni_asesor === note.dni_asesor))), money(note.monto_pagado)]), { title: 'Historial de notas de venta' });
    container.querySelector('#edit-lot').onclick = () => editLot(lot.id_lote, { ...context, refresh: render });
    container.querySelector('#reserve-lot').onclick = () => context.navigate(`separaciones/nueva/${lot.id_lote}`);
  };
  render();
}
