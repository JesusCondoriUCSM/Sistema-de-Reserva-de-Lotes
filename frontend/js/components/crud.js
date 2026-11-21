import { heading, table, field, button, icon, actionButtons, openModal, closeModal, formActions, confirm, toast, bindPages } from './ui.js';
import { escapeHTML as e, normalizeSearch, fullName } from '../lib/format.js';

export const keys = { cliente: 'dni_cliente', asesor: 'dni_asesor', proyecto: 'nombre_proyecto', lote: 'id_lote', ciudad_proyecto: 'id_ciudad', distrito_proyecto: 'id_distrito' };
const titles = { cliente: 'cliente', asesor: 'asesor', proyecto: 'proyecto', lote: 'lote', ciudad_proyecto: 'ciudad', distrito_proyecto: 'distrito' };
export function recordFields(type, record, data) {
  const input = (name, label, options = {}) => field(name, label, { value: record?.[name] ?? '', ...options });
  const id = keys[type];
  if (type === 'cliente' || type === 'asesor') return input(id, 'DNI', { readonly: Boolean(record), attrs: 'pattern="[0-9]{8}" maxlength="8" inputmode="numeric" title="Ocho d�gitos"' }) + input('nombres', 'Nombres', { attrs: 'maxlength="80"' }) + input('apellidos', 'Apellidos', { attrs: 'maxlength="80"' }) + (type === 'cliente' ? input('direccion', 'Direcci�n', { attrs: 'maxlength="150"', full: true }) : '');
  if (type === 'proyecto') return input('nombre_proyecto', 'Nombre del proyecto', { readonly: Boolean(record), attrs: 'maxlength="100"', full: true }) + input('ciudad_proyecto', 'Ciudad', { options: [['', 'Seleccione'], ...data.ciudad_proyecto.map(x => [x.id_ciudad, x.descripcion])] }) + input('distrito_proyecto', 'Distrito', { options: [['', 'Seleccione'], ...data.distrito_proyecto.map(x => [x.id_distrito, x.descripcion])] });
  return input('descripcion', 'Descripci�n', { attrs: 'maxlength="60"', full: true });
}
export function editRecord(type, key, context, onSaved = null, initial = {}) {
  const { repository, refresh } = context; const data = repository.snapshot();
  const record = key === null ? null : data[type].find(x => String(x[keys[type]]) === String(key));
  if (key !== null && !record) { toast('El registro ya no existe.', true); return; }
  openModal(`${record ? 'Editar' : 'Registrar'} ${titles[type]}`, `<form><p class="help">* Campos obligatorios${record ? ' � El identificador no se modifica.' : ''}</p><div class="fields two">${recordFields(type, record || (Object.keys(initial).length ? initial : null), data)}</div>${formActions(record ? 'Guardar cambios' : `Registrar ${titles[type]}`)}</form>`, {
    onSubmit: async values => { const saved = repository.save(type, values, record ? record[keys[type]] : null); closeModal(); toast('Datos guardados correctamente.'); if (onSaved) onSaved(saved); else refresh(); }
  });
}
export function deleteRecord(type, key, label, context) {
  confirm(`Eliminar ${titles[type]}`, `�Deseas eliminar ${label}? Solo se permitir� si no tiene operaciones o registros dependientes.`, () => { context.repository.remove(type, key); context.refresh(); toast('Registro eliminado.'); }, { label: 'Eliminar', danger: true });
}

const configs = {
  proyecto: { title: 'Proyectos', description: 'Administra los proyectos y su ubicaci�n.', tableTitle: 'Proyectos registrados', headers: ['Nombre del proyecto', 'Ciudad', 'Distrito', 'Acciones'], searchLabel: 'Buscar por nombre de proyecto', detail: false, columns: (x, data) => [e(x.nombre_proyecto), e(data.ciudad_proyecto.find(c => c.id_ciudad === x.ciudad_proyecto)?.descripcion), e(data.distrito_proyecto.find(d => d.id_distrito === x.distrito_proyecto)?.descripcion)] },
  cliente: { title: 'Clientes', description: 'Consulta y administra la informaci�n de tus clientes.', tableTitle: 'Listado de clientes', headers: ['DNI', 'Nombres', 'Apellidos', 'Direcci�n', 'Tel�fonos', 'Acciones'], searchLabel: 'Buscar por DNI o nombre', detail: true, columns: (x, data) => [e(x.dni_cliente), e(x.nombres), e(x.apellidos), e(x.direccion), data.telefono_cliente.filter(t => t.dni_cliente === x.dni_cliente).map(t => `<span class="phone-line">${e(t.telefono)}</span>`).join('') || '<span class="muted">Sin tel�fono</span>'] },
  asesor: { title: 'Asesores', description: 'Consulta y administra los asesores registrados.', tableTitle: 'Asesores registrados', headers: ['DNI', 'Nombres', 'Apellidos', 'Acciones'], searchLabel: 'Buscar por DNI o nombre', detail: false, columns: x => [e(x.dni_asesor), e(x.nombres), e(x.apellidos)] }
};
export function mountCrud(container, context, type) {
  const config = configs[type]; let search = ''; let page = 1;
  const render = () => {
    const data = context.repository.snapshot();
    const filtered = data[type].filter(record => normalizeSearch(type === 'proyecto' ? record.nombre_proyecto : `${record[keys[type]]} ${fullName(record)}`).includes(normalizeSearch(search)));
    page = Math.min(page, Math.max(1, Math.ceil(filtered.length / 5)));
    container.innerHTML = heading(config.title, config.description) + `<section class="card filters"><form id="search-form" class="search-line">${field('search', config.searchLabel, { value: search, required: false, attrs: 'maxlength="100"' })}<button class="btn primary" type="submit">${icon('search')} Buscar</button>${button('Limpiar', 'id="clear-search"')}${button(`${icon('plus')} Registrar ${titles[type]}`, 'id="new-record"')}</form></section>` + table(config.headers, filtered.map(record => [...config.columns(record, data), actionButtons(record[keys[type]], { detail: config.detail })]), { title: config.tableTitle, page, total: filtered.length, paginated: true }) + `<div class="info">${type === 'cliente' ? 'Administra los tel�fonos desde �Ver detalle�. Un cliente puede registrarse sin tel�fono. Los clientes con notas de venta se conservan.' : type === 'proyecto' ? 'Ciudad y distrito se eligen de cat�logos independientes. El nombre del proyecto no se modifica despu�s del registro.' : 'Los asesores registrados aparecen en el formulario de separaci�n. El DNI no se modifica despu�s del registro.'}</div>`;
    container.querySelector('#search-form').addEventListener('submit', event => { event.preventDefault(); search = new FormData(event.currentTarget).get('search'); page = 1; render(); });
    container.querySelector('#clear-search').addEventListener('click', () => { search = ''; page = 1; render(); });
    const localContext = { ...context, refresh: render };
    container.querySelector('#new-record').addEventListener('click', () => editRecord(type, null, localContext));
    container.querySelectorAll('[data-edit]').forEach(el => el.addEventListener('click', () => editRecord(type, el.dataset.edit, localContext)));
    container.querySelectorAll('[data-delete]').forEach(el => el.addEventListener('click', () => deleteRecord(type, el.dataset.delete, el.dataset.delete, localContext)));
    container.querySelectorAll('[data-detail]').forEach(el => el.addEventListener('click', () => context.navigate(`clientes/${encodeURIComponent(el.dataset.detail)}`)));
    bindPages(container, value => { page = value; render(); });
  };
  render();
  if (context.params[0] === 'nuevo') editRecord(type, null, { ...context, refresh: () => context.navigate('clientes') });
}
