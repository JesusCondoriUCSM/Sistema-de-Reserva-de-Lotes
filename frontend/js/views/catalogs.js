import { heading, table, button, icon, actionButtons, field, bindPages } from '../components/ui.js';
import { editRecord, deleteRecord } from '../components/crud.js';
import { escapeHTML as e, normalizeSearch } from '../lib/format.js';

export function mount(container, context) {
  let type = 'ciudad_proyecto'; let search = ''; let page = 1;
  const render = () => {
    const cities = type === 'ciudad_proyecto'; const key = cities ? 'id_ciudad' : 'id_distrito';
    const records = context.repository.snapshot()[type].filter(x => normalizeSearch(x.descripcion).includes(normalizeSearch(search)));
    page = Math.min(page, Math.max(1, Math.ceil(records.length / 5)));
    container.innerHTML = heading('Cat�logos', 'Administra ciudades y distritos de forma independiente.') + `<div class="toolbar"><div class="tabs" role="tablist" aria-label="Tipo de cat�logo"><button role="tab" id="tab-cities" aria-controls="catalog-panel" aria-selected="${cities}">Ciudades</button><button role="tab" id="tab-districts" aria-controls="catalog-panel" aria-selected="${!cities}">Distritos</button></div>${button(`${icon('plus')} Registrar ${cities ? 'ciudad' : 'distrito'}`, 'id="new-catalog"', 'primary')}</div><section role="tabpanel" id="catalog-panel" aria-labelledby="${cities ? 'tab-cities' : 'tab-districts'}"><section class="card filters"><form id="catalog-search" class="search-line">${field('search', 'Buscar por descripci�n', { required: false, value: search })}<button type="submit" class="btn">Buscar</button></form></section>` + table(['Identificador', 'Descripci�n', 'Acciones'], records.map(x => [e(x[key]), e(x.descripcion), actionButtons(x[key], { detail: false })]), { title: cities ? 'Ciudades' : 'Distritos', page, total: records.length, paginated: true }) + `</section><div class="info">Los identificadores se generan autom�ticamente. Los elementos utilizados por proyectos no se pueden eliminar.</div>`;
    const localContext = { ...context, refresh: render };
    container.querySelector('#tab-cities').onclick = () => { type = 'ciudad_proyecto'; search = ''; page = 1; render(); };
    container.querySelector('#tab-districts').onclick = () => { type = 'distrito_proyecto'; search = ''; page = 1; render(); };
    container.querySelector('#new-catalog').onclick = () => editRecord(type, null, localContext);
    container.querySelector('#catalog-search').onsubmit = event => { event.preventDefault(); search = new FormData(event.currentTarget).get('search'); page = 1; render(); };
    container.querySelectorAll('[data-edit]').forEach(el => el.onclick = () => editRecord(type, el.dataset.edit, localContext));
    container.querySelectorAll('[data-delete]').forEach(el => el.onclick = () => deleteRecord(type, el.dataset.delete, records.find(x => String(x[key]) === el.dataset.delete).descripcion, localContext));
    bindPages(container, value => { page = value; render(); });
  };
  render();
}
