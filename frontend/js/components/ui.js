import { escapeHTML as e } from '../lib/format.js';

const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  users: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 5v2"/>',
  note: '<rect x="6" y="2" width="12" height="20" rx="1"/><path d="M9 7h6m-6 4h6m-6 4h4"/>',
  chart: '<path d="M3 3v18h18M7 16v-4m5 4V6m5 10V9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="m15 4 5 5M4 16 16 4a3 3 0 0 1 4 4L8 20H4z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
};
export const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
export const button = (text, attrs = '', style = '') => `<button type="button" class="btn ${style}" ${attrs}>${text}</button>`;
export function badge(state) { const color = { Disponible: 'available', Separado: 'reserved', Vendido: '', 'Dentro del plazo': 'available', 'Plazo vencido': 'expired', 'Fecha futura': 'expired' }[state] || ''; return `<span class="badge ${color}">${e(state)}</span>`; }
export const heading = (title, description, section = 'GESTIÓN') => `<div class="page-heading"><div><div class="breadcrumb">VILLA HORIZONTE / ${e(section)}</div><h1>${e(title)}</h1><p>${e(description)}</p></div><span class="desktop-tag"><span class="dot"></span> Gestión interna</span></div>`;
export const empty = (text = 'No se encontraron registros.') => `<div class="empty">${icon('search')}<strong>${e(text)}</strong><span>Prueba con otros filtros o registra un nuevo elemento.</span></div>`;
export function table(headers, rows, { title = '', subtitle = '', total = rows.length, footer = '', page = 1, pageSize = 5, paginated = false } = {}) {
  const visible = paginated ? rows.slice((page - 1) * pageSize, page * pageSize) : rows;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return `<section class="card">${title ? `<div class="card-head"><div><h2>${e(title)} <span class="count">${total}</span></h2>${subtitle ? `<p>${e(subtitle)}</p>` : ''}</div></div>` : ''}${visible.length ? `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${visible.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>${footer ? `<tfoot>${footer}</tfoot>` : ''}</table></div>` : empty()}<div class="pagination"><span>${total ? `${paginated ? (page - 1) * pageSize + 1 : 1}–${paginated ? Math.min(page * pageSize, total) : total} de ${total}` : '0 registros'}</span>${paginated ? `${button('Anterior', `data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}`, 'small')}<span class="page-number">${page}</span>${button('Siguiente', `data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}`, 'small')}` : ''}</div></section>`;
}
export function field(name, label, { value = '', type = 'text', required = true, readonly = false, options = null, attrs = '', full = false } = {}) {
  const id = `field-${name}`;
  const common = `id="${id}" name="${name}" ${required ? 'required' : ''} ${readonly ? 'readonly' : ''} ${attrs}`;
  const control = options ? `<select ${common}>${options.map(([v, text]) => `<option value="${e(v)}" ${String(v) === String(value) ? 'selected' : ''}>${e(text)}</option>`).join('')}</select>` : type === 'textarea' ? `<textarea ${common}>${e(value)}</textarea>` : `<input type="${type}" ${common} value="${e(value)}">`;
  return `<div class="field ${full ? 'full' : ''}"><label for="${id}">${e(label)}${required ? ' <span class="required">*</span>' : ''}</label>${control}</div>`;
}
let previousFocus;
export function openModal(title, body, { onSubmit, onClose } = {}) {
  const dialog = document.getElementById('modal');
  if (dialog.open) dialog.close();
  previousFocus = document.activeElement;
  dialog.innerHTML = `<div class="modal-head"><h2 id="modal-title">${e(title)}</h2><button class="icon-btn" type="button" data-close aria-label="Cerrar ventana">${icon('close')}</button></div><div class="modal-body"><div class="error-message" role="alert" id="modal-error"></div>${body}</div>`;
  dialog.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => dialog.close()));
  dialog.onclose = () => { previousFocus?.focus(); onClose?.(); };
  const form = dialog.querySelector('form');
  if (form && onSubmit) form.addEventListener('submit', async event => {
    event.preventDefault(); const submit = form.querySelector('[type=submit]');
    try { if (submit) submit.disabled = true; await onSubmit(Object.fromEntries(new FormData(form)), form); }
    catch (error) { const message = dialog.querySelector('#modal-error'); message.textContent = error.message; message.scrollIntoView({ block: 'nearest' }); }
    finally { if (submit) submit.disabled = false; }
  });
  dialog.showModal();
  return dialog;
}
export const closeModal = () => document.getElementById('modal').close();
export const formActions = (label = 'Guardar') => `<div class="modal-actions">${button('Cancelar', 'data-close')}<button type="submit" class="btn primary">${e(label)}</button></div>`;
export function confirm(title, text, onConfirm, { label = 'Confirmar', danger = false } = {}) {
  openModal(title, `<form><p>${e(text)}</p>${formActions(label)}</form>`, { onSubmit: async () => { await onConfirm(); closeModal(); } });
  if (danger) document.querySelector('#modal [type=submit]').classList.add('danger');
}
export function toast(message, error = false) {
  const el = document.createElement('div'); el.className = `toast${error ? ' error' : ''}`; el.textContent = message;
  document.getElementById('notifications').append(el); setTimeout(() => el.remove(), 6500);
}
export function actionButtons(key, { detail = true, reserve = null } = {}) {
  const val = e(key);
  return `<div class="actions">${detail ? `<button class="icon-btn" data-detail="${val}" aria-label="Ver detalle ${val}" title="Ver detalle">${icon('eye')}</button>` : ''}<button class="icon-btn" data-edit="${val}" aria-label="Editar ${val}" title="Editar">${icon('edit')}</button><button class="icon-btn danger" data-delete="${val}" aria-label="Eliminar ${val}" title="Eliminar">${icon('trash')}</button>${reserve !== null ? button('Separar', `data-reserve="${val}" ${reserve ? '' : 'disabled'}`, 'small soft') : ''}</div>`;
}
export function bindPages(container, callback) { container.querySelectorAll('[data-page]').forEach(el => el.addEventListener('click', () => callback(Number(el.dataset.page)))); }
