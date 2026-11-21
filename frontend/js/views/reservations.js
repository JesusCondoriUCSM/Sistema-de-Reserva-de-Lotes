import { heading, field, button, icon, table, badge, openModal, closeModal, formActions, confirm, toast, bindPages } from '../components/ui.js';
import { editRecord } from '../components/crud.js';
import { latestNote, reservationStatus } from '../services/domain.js';
import { escapeHTML as e, fullName, money, dateLabel, today, addDays, lotLabel } from '../lib/format.js';

export function mount(container, context) {
  if (context.params[0] === 'nueva') return mountForm(container, context);
  if (context.params[0] === 'nota') return mountNote(container, context);
  let tab = 'control'; let filters = { project: '', block: '', status: '', client: '', advisor: '', from: '', to: '' }; let page = 1;
  const render = () => {
    const data = context.repository.snapshot(); const control = tab === 'control';
    let notes = control ? data.lote.filter(lot => lot.estado === 'Separado').map(lot => latestNote(data, lot.id_lote)).filter(Boolean) : [...data.nota_venta];
    notes = notes.filter(note => { const lot = data.lote.find(x => x.id_lote === note.id_lote); const status = reservationStatus(note); return (!filters.project || lot?.nombre_proyecto === filters.project) && (control ? (!filters.block || lot?.manzana === filters.block) && (!filters.status || (filters.status === 'expired' ? status.expired : !status.expired && !status.future)) : (!filters.client || note.dni_cliente === filters.client) && (!filters.advisor || note.dni_asesor === filters.advisor) && (!filters.from || note.fecha_emision >= filters.from) && (!filters.to || note.fecha_emision <= filters.to)); });
    notes.sort((a, b) => control ? a.fecha_emision.localeCompare(b.fecha_emision) : b.fecha_emision.localeCompare(a.fecha_emision) || b.serie_numero.localeCompare(a.serie_numero));
    page = Math.min(page, Math.max(1, Math.ceil(notes.length / 5)));
    const common = field('project', 'Proyecto', { required: false, value: filters.project, options: [['', 'Todos'], ...data.proyecto.map(x => [x.nombre_proyecto, x.nombre_proyecto])] });
    const controls = control ? field('block', 'Manzana', { required: false, value: filters.block, options: [['', 'Todas'], ...[...new Set(data.lote.map(x => x.manzana))].sort().map(x => [x, x])] }) + field('status', 'Situación del plazo', { required: false, value: filters.status, options: [['', 'Todas'], ['current', 'Dentro del plazo'], ['expired', 'Plazo vencido']] }) : field('client', 'Cliente', { required: false, value: filters.client, options: [['', 'Todos'], ...data.cliente.map(x => [x.dni_cliente, fullName(x)])] }) + field('advisor', 'Asesor', { required: false, value: filters.advisor, options: [['', 'Todos'], ...data.asesor.map(x => [x.dni_asesor, fullName(x)])] }) + field('from', 'Desde', { type: 'date', required: false, value: filters.from }) + field('to', 'Hasta', { type: 'date', required: false, value: filters.to });
    const rows = notes.map(note => {
      const lot = data.lote.find(x => x.id_lote === note.id_lote); const status = reservationStatus(note);
      const base = [`<a href="#/separaciones/nota/${encodeURIComponent(note.serie_numero)}">${e(note.serie_numero)}</a>`, e(fullName(data.cliente.find(x => x.dni_cliente === note.dni_cliente))), e(lot?.nombre_proyecto), e(lot?.manzana), e(lot?.numero_lote)];
      return control ? [...base, dateLabel(note.fecha_emision), dateLabel(status.expires), status.expired ? '0 días' : `${status.remaining} días`, badge(status.future ? 'Fecha futura' : status.expired ? 'Plazo vencido' : 'Dentro del plazo'), `<div class="actions">${button('Liberar lote', `data-release="${note.id_lote}" ${!status.expired || status.future ? 'disabled' : ''}`, 'small')}${button('Concretar operación', `data-complete="${note.id_lote}" ${status.expired || status.future ? 'disabled' : ''}`, 'small soft')}</div>`] : [...base, dateLabel(note.fecha_emision), e(fullName(data.asesor.find(x => x.dni_asesor === note.dni_asesor))), money(note.monto_pagado), e(note.forma_pago)];
    });
    container.innerHTML = heading('Gestión de separaciones', 'Controla los plazos y consulta las notas de venta.') + `<div class="toolbar"><div class="tabs" role="tablist" aria-label="Gestión de separaciones"><button role="tab" id="tab-control" aria-controls="reservation-panel" aria-selected="${control}">Control de plazo</button><button role="tab" id="tab-history" aria-controls="reservation-panel" aria-selected="${!control}">Historial de notas</button></div><a class="btn primary" href="#/separaciones/nueva">${icon('plus')} Registrar separación</a></div><section role="tabpanel" id="reservation-panel" aria-labelledby="${control ? 'tab-control' : 'tab-history'}"><section class="card filters"><form id="reservation-filters"><div class="fields">${common}${controls}</div><div class="filter-actions"><button class="btn primary" type="submit">Consultar</button>${button('Limpiar', 'id="clear"')}</div></form></section>` + table(control ? ['Nota', 'Cliente', 'Proyecto', 'Manzana', 'Lote', 'Separación', 'Vencimiento', 'Días restantes', 'Situación', 'Acciones'] : ['Nota', 'Cliente', 'Proyecto', 'Manzana', 'Lote', 'Fecha', 'Asesor', 'Pago', 'Forma de pago'], rows, { title: control ? 'Lotes actualmente separados · Última nota' : 'Historial de notas de venta', page, total: rows.length, paginated: true }) + `</section><div class="info">${control ? 'El vencimiento no libera automáticamente. El plazo termina al inicio de la fecha de vencimiento. Liberar conserva la nota; concretar cambia el lote a Vendido sin registrar el pago total del terreno.' : 'Las notas se conservan aunque el lote se libere o se venda. Este listado muestra operaciones históricas, no un historial de estados de cada separación.'}</div>`;
    container.querySelector('#tab-control').onclick = () => { tab = 'control'; page = 1; render(); };
    container.querySelector('#tab-history').onclick = () => { tab = 'history'; page = 1; render(); };
    container.querySelector('#reservation-filters').onsubmit = event => {
      event.preventDefault(); const next = { ...filters, ...Object.fromEntries(new FormData(event.currentTarget)) };
      if (next.from && next.to && next.from > next.to) { toast('La fecha inicial debe ser anterior o igual a la final.', true); return; }
      filters = next; page = 1; render();
    };
    container.querySelector('#clear').onclick = () => { filters = { project: '', block: '', status: '', client: '', advisor: '', from: '', to: '' }; page = 1; render(); };
    for (const action of ['release', 'complete']) container.querySelectorAll(`[data-${action}]`).forEach(el => el.onclick = () => {
      const lot = data.lote.find(x => x.id_lote === Number(el.dataset[action]));
      confirm(action === 'release' ? 'Liberar lote vencido' : 'Concretar operación', `${lot.nombre_proyecto}, manzana ${lot.manzana}, lote ${lot.numero_lote}. ${action === 'release' ? 'Quedará Disponible y se conservará la nota de venta. El pago no se devuelve.' : 'Quedará Vendido. Esta acción no registra el pago total del terreno.'}`, async () => { await context.repository.changeReservation(lot.id_lote, action); render(); toast(action === 'release' ? 'Lote liberado correctamente.' : 'Operación concretada. El lote está Vendido.'); });
    });
    bindPages(container, value => { page = value; render(); });
  };
  render();
}

function mountForm(container, context) {
  const data = context.repository.snapshot(); const preselected = data.lote.find(x => x.id_lote === Number(context.params[1]) && x.estado === 'Disponible');
  let selectedClient = null;
  const nextNumber = Math.max(0, ...data.nota_venta.filter(x => /^NV01-\d+$/.test(x.serie_numero)).map(x => Number(x.serie_numero.split('-')[1]))) + 1;
  container.innerHTML = heading('Registrar separación', 'Completa los datos para registrar una nota de venta por separación.') + `<form id="reservation-form"><div class="split"><div><section class="card"><div class="card-head"><h2><span class="step">1</span>Lote</h2></div><div class="card-body"><div class="fields two">${field('project', 'Proyecto', { value: preselected?.nombre_proyecto || '', options: [['', 'Selecciona un proyecto'], ...data.proyecto.map(x => [x.nombre_proyecto, x.nombre_proyecto])] })}${field('id_lote', 'Lote disponible', { options: [['', 'Selecciona un lote']] })}</div><div id="selected-lot" class="info">Selecciona un lote para consultar sus datos.</div></div></section><section class="card"><div class="card-head"><h2><span class="step">2</span>Cliente</h2></div><div class="card-body"><div class="search-line">${field('dni_cliente', 'DNI del cliente', { attrs: 'pattern="[0-9]{8}" maxlength="8" inputmode="numeric" placeholder="Ej. 00000001"' })}${button('Buscar cliente', 'id="find-client"')}</div><div id="selected-client" aria-live="polite"></div></div></section><section class="card"><div class="card-head"><h2><span class="step">3</span>Asesor</h2></div><div class="card-body">${field('dni_asesor', 'Asesor registrado', { options: [['', 'Selecciona un asesor'], ...data.asesor.map(x => [x.dni_asesor, fullName(x)])] })}</div></section><section class="card"><div class="card-head"><h2><span class="step">4</span>Nota y pago</h2></div><div class="card-body"><div class="fields two">${field('serie', 'Serie', { value: 'NV01', attrs: 'maxlength="10"' })}${field('numero', 'Número de nota', { value: String(nextNumber).padStart(6, '0'), attrs: 'pattern="[0-9]+" maxlength="15" inputmode="numeric"' })}${field('fecha', 'Fecha de registro', { value: dateLabel(today()), readonly: true, required: false })}${field('pago', 'Pago de separación · fijo', { value: money(100), readonly: true, required: false })}${field('descripcion', 'Descripción', { value: 'Separación de lote', type: 'textarea', full: true, attrs: 'maxlength="200"' })}${field('forma_pago', 'Forma de pago', { options: [['', 'Selecciona una opción'], ['Efectivo', 'Efectivo'], ['Transferencia', 'Transferencia'], ['Depósito', 'Depósito']] })}${field('vencimiento', 'Fecha de vencimiento', { value: dateLabel(addDays(today(), 8)), readonly: true, required: false })}</div></div></section><div id="reservation-error" class="error-message" role="alert"></div><div class="toolbar"><a class="btn" href="#/separaciones">Cancelar</a><button type="submit" class="btn primary">Revisar separación</button></div></div><aside class="card card-body summary"><h2>Resumen de separación</h2><p class="muted">Pago único de separación</p><div class="amount">${money(100)}</div><div class="summary-row"><span>Vencimiento</span><strong>${dateLabel(addDays(today(), 8))}</strong></div><div id="lot-summary" class="help">Selecciona un lote disponible.</div><div class="info">La separación tiene una vigencia de ocho días calendario. El pago de S/ 100 no es reembolsable. El plazo termina al inicio de la fecha de vencimiento.</div><p class="help">* Campos obligatorios</p></aside></div></form>`;
  const form = container.querySelector('#reservation-form');
  const projectSelect = form.elements.project; const lotSelect = form.elements.id_lote;
  const updateSummary = () => {
    const lot = context.repository.snapshot().lote.find(x => x.id_lote === Number(lotSelect.value));
    const summary = lot ? `<strong>${e(lot.nombre_proyecto)}</strong><br>Manzana ${e(lot.manzana)} · Lote ${lot.numero_lote}<br>${lot.area} m² · ${money(lot.precio_venta)} · ${badge(lot.estado)}` : 'Selecciona un lote disponible.';
    container.querySelector('#selected-lot').innerHTML = summary; container.querySelector('#lot-summary').innerHTML = summary;
  };
  const populateLots = selected => {
    const lots = context.repository.snapshot().lote.filter(x => x.nombre_proyecto === projectSelect.value && x.estado === 'Disponible');
    lotSelect.innerHTML = `<option value="">${lots.length ? 'Selecciona un lote' : 'No hay lotes disponibles'}</option>` + lots.map(x => `<option value="${x.id_lote}" ${Number(selected) === x.id_lote ? 'selected' : ''}>${e(lotLabel(x))} · Mz. ${e(x.manzana)} · Lote ${x.numero_lote}</option>`).join('');
    lotSelect.disabled = !lots.length; updateSummary();
  };
  projectSelect.onchange = () => populateLots(null); lotSelect.onchange = updateSummary;
  populateLots(preselected?.id_lote);
  const clientArea = container.querySelector('#selected-client');
  const showClient = client => { selectedClient = client; form.elements.dni_cliente.value = client.dni_cliente; clientArea.innerHTML = `<div class="info success"><strong>${e(fullName(client))}</strong><br>DNI ${e(client.dni_cliente)} · ${e(client.direccion)}</div>`; };
  form.elements.dni_cliente.oninput = () => { selectedClient = null; clientArea.innerHTML = ''; };
  container.querySelector('#find-client').onclick = () => {
    const dni = form.elements.dni_cliente.value.trim();
    if (!/^\d{8}$/.test(dni)) { clientArea.innerHTML = '<div class="error-message">Ingresa un DNI de ocho dígitos.</div>'; return; }
    const client = context.repository.snapshot().cliente.find(x => x.dni_cliente === dni);
    if (client) showClient(client);
    else {
      selectedClient = null; clientArea.innerHTML = `<div class="info warning">No existe un cliente con ese DNI. ${button('Registrar cliente', 'id="inline-client"', 'small')}</div>`;
      clientArea.querySelector('#inline-client').onclick = () => editRecord('cliente', null, context, key => showClient(context.repository.snapshot().cliente.find(x => x.dni_cliente === key)), { dni_cliente: dni });
    }
  };
  form.onsubmit = event => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(form));
    const errorArea = container.querySelector('#reservation-error'); errorArea.textContent = '';
    if (!values.id_lote) { errorArea.textContent = 'Selecciona un lote disponible.'; return; }
    if (!selectedClient || selectedClient.dni_cliente !== values.dni_cliente) { errorArea.textContent = 'Busca y confirma el cliente antes de continuar.'; return; }
    const serie = `${values.serie.trim()}-${values.numero.trim()}`;
    if (serie.length > 20) { errorArea.textContent = 'La serie y número completos admiten hasta 20 caracteres.'; return; }
    const lot = context.repository.snapshot().lote.find(x => x.id_lote === Number(values.id_lote));
    if (!lot || lot.estado !== 'Disponible') { errorArea.textContent = 'El lote ya no está disponible. Selecciona otro.'; populateLots(null); return; }
    confirm('Confirmar separación', `${lot.nombre_proyecto} · Mz. ${lot.manzana} · Lote ${lot.numero_lote}. Cliente: ${fullName(selectedClient)}. Pago: ${money(100)}, ${values.forma_pago}. Nota ${serie}. Vence el ${dateLabel(addDays(today(), 8))}. El pago no es reembolsable.`, async () => {
      const note = await context.repository.reserve({ ...values, serie_numero: serie });
      context.navigate(`separaciones/nota/${encodeURIComponent(note)}`); toast(`Separación registrada. Nota ${note}. El lote está Separado.`);
    }, { label: 'Confirmar y registrar' });
  };
}

function mountNote(container, context) {
  const render = () => {
    const data = context.repository.snapshot(); const note = data.nota_venta.find(x => x.serie_numero === context.params[1]);
    if (!note) { container.innerHTML = heading('Nota no encontrada', 'El comprobante no existe.') + '<a href="#/separaciones">Volver a separaciones</a>'; return; }
    const lot = data.lote.find(x => x.id_lote === note.id_lote); const client = data.cliente.find(x => x.dni_cliente === note.dni_cliente); const advisor = data.asesor.find(x => x.dni_asesor === note.dni_asesor);
    const rows = [['Serie y número', note.serie_numero], ['Fecha de emisión', dateLabel(note.fecha_emision)], ['Cliente', fullName(client)], ['DNI del cliente', note.dni_cliente], ['Asesor', fullName(advisor)], ['Proyecto', lot?.nombre_proyecto], ['Lote', `Manzana ${lot?.manzana} · Lote ${lot?.numero_lote}`], ['Forma de pago', note.forma_pago]];
    container.innerHTML = heading('Detalle de nota de venta', note.serie_numero) + `<div class="toolbar"><a class="btn" href="#/separaciones">← Volver a separaciones</a>${button(`${icon('edit')} Corregir nota`, 'id="edit-note"')}</div><section class="card"><div class="card-head"><h2>Nota de venta · Separación de lote</h2><span class="badge">Historial conservado</span></div><div class="card-body"><dl class="data-grid">${rows.map(([label, value]) => `<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl></div></section>` + table(['Descripción', 'Cantidad', 'Unidad', 'Precio unitario', 'Total', 'Monto pagado'], [[e(note.descripcion), note.cantidad, e(note.unidad), money(note.precio_unitario), money(note.total_pagar), money(note.monto_pagado)]], { title: 'Detalle del pago' }) + `<div class="info">El pago de ${money(note.monto_pagado)} corresponde a la separación, no al precio total del terreno (${money(lot?.precio_venta || 0)}). La nota se conserva como historial. Solo se corrigen descripción y forma de pago.</div>`;
    container.querySelector('#edit-note').onclick = () => openModal('Corregir nota de venta', `<form><div class="fields two">${field('forma_pago', 'Forma de pago', { value: note.forma_pago, options: [...new Set(['Efectivo', 'Transferencia', 'Depósito', note.forma_pago])].map(x => [x, x]) })}${field('descripcion', 'Descripción', { value: note.descripcion, type: 'textarea', full: true, attrs: 'maxlength="200"' })}</div>${formActions('Guardar corrección')}</form>`, { onSubmit: async values => { await context.repository.updateNote(note.serie_numero, values); closeModal(); render(); toast('Nota corregida correctamente.'); } });
  };
  render();
}
