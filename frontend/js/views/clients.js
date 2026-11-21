import { mountCrud, editRecord } from '../components/crud.js';
import { heading, button, icon, field, table, openModal, closeModal, formActions, confirm, toast } from '../components/ui.js';
import { escapeHTML as e, fullName, money, dateLabel } from '../lib/format.js';

export function mount(container, context) {
  const dni = context.params[0];
  if (!dni || dni === 'nuevo') return mountCrud(container, context, 'cliente');
  const render = () => {
    const data = context.repository.snapshot(); const client = data.cliente.find(x => x.dni_cliente === dni);
    if (!client) { container.innerHTML = heading('Cliente no encontrado', 'El registro no existe.') + '<a href="#/clientes">Volver a clientes</a>'; return; }
    const phones = data.telefono_cliente.filter(x => x.dni_cliente === dni); const notes = data.nota_venta.filter(x => x.dni_cliente === dni).sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision));
    container.innerHTML = heading('Detalle de cliente', fullName(client)) + `<div class="toolbar"><a class="btn" href="#/clientes">← Volver a clientes</a>${button(`${icon('edit')} Editar datos`, 'id="edit-client"')}</div><section class="card card-body"><dl class="data-grid"><div><dt>DNI</dt><dd>${e(dni)}</dd></div><div><dt>Nombre completo</dt><dd>${e(fullName(client))}</dd></div><div><dt>Dirección</dt><dd>${e(client.direccion)}</dd></div></dl></section><section class="card"><div class="card-head"><h2>Teléfonos <span class="count">${phones.length}</span></h2>${button(`${icon('plus')} Agregar teléfono`, 'id="add-phone"', 'small')}</div><div class="card-body">${phones.length ? phones.map(phone => `<div class="phone-row"><span>${e(phone.telefono)}</span><div class="actions">${button('Modificar', `data-phone-edit="${e(phone.telefono)}"`, 'small')}${button('Eliminar', `data-phone-delete="${e(phone.telefono)}"`, 'small')}</div></div>`).join('') : '<p class="muted">Este cliente no tiene teléfonos registrados.</p>'}</div></section>` + table(['Nota', 'Fecha', 'Proyecto', 'Manzana', 'Lote', 'Pago'], notes.map(note => { const lot = data.lote.find(x => x.id_lote === note.id_lote); return [`<a href="#/separaciones/nota/${encodeURIComponent(note.serie_numero)}">${e(note.serie_numero)}</a>`, dateLabel(note.fecha_emision), e(lot?.nombre_proyecto), e(lot?.manzana), e(lot?.numero_lote), money(note.monto_pagado)]; }), { title: 'Historial de notas de venta' });
    const localContext = { ...context, refresh: render };
    container.querySelector('#edit-client').onclick = () => editRecord('cliente', dni, localContext);
    const editPhone = old => openModal(old ? 'Modificar teléfono' : 'Agregar teléfono', `<form><div class="fields">${field('telefono', 'Teléfono', { value: old || '', full: true, attrs: 'pattern="[0-9]{9}" maxlength="9" inputmode="numeric" title="Nueve dígitos"' })}</div>${formActions()}</form>`, { onSubmit: async values => { await context.repository.savePhone(dni, values.telefono, old); closeModal(); render(); toast('Teléfono guardado.'); } });
    container.querySelector('#add-phone').onclick = () => editPhone(null);
    container.querySelectorAll('[data-phone-edit]').forEach(el => el.onclick = () => editPhone(el.dataset.phoneEdit));
    container.querySelectorAll('[data-phone-delete]').forEach(el => el.onclick = () => confirm('Eliminar teléfono', `¿Deseas eliminar el teléfono ${el.dataset.phoneDelete}?`, async () => { await context.repository.removePhone(dni, el.dataset.phoneDelete); render(); toast('Teléfono eliminado.'); }, { label: 'Eliminar', danger: true }));
  };
  render();
}
