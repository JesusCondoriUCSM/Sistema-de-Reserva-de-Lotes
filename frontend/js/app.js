import { icon, toast } from './components/ui.js';
import { dateLabel, today, escapeHTML as e } from './lib/format.js';
import { repository } from './services/repository.js';

const routes = {
  inicio: ['Inicio', 'home', 'dashboard'], proyectos: ['Proyectos', 'grid', 'projects'],
  lotes: ['Lotes', 'grid', 'lots'], catalogos: ['Catálogos', 'grid', 'catalogs']
};
const app = document.getElementById('app');
app.innerHTML = `<div class="demo-bar"><span class="dot"></span><strong>Entorno de demostraci�n</strong><span>Datos ficticios � Sin conexi�n a PostgreSQL</span></div><div class="shell"><aside class="sidebar" id="sidebar"><a href="#/inicio" class="brand"><strong>Villa Horizonte</strong><small>Inmobiliaria � Gesti�n<br>interna</small></a><div class="menu-label">MEN� PRINCIPAL</div><nav class="nav" aria-label="Men� principal">${Object.entries(routes).map(([key, [name, symbol]]) => `<a href="#/${key}" data-route="${key}">${icon(symbol)}<span>${name}</span></a>`).join('')}</nav><div class="sidebar-bottom"><p>Un lugar para gestionar<br>nuevas oportunidades.</p><div class="user"><span class="avatar">VH</span><div>Sesi�n de demostraci�n<small>Gesti�n inmobiliaria</small></div></div></div></aside><div class="workspace"><header class="topbar"><button class="btn small mobile-toggle" aria-label="Abrir men�" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button><div><div class="eyebrow">SISTEMA DE RESERVAS DE LOTES</div><div class="topbar-title" id="topbar-title">Inicio</div></div><span class="date">${icon('clock')}${dateLabel(today())}</span></header><main id="main" class="content" tabindex="-1"></main><footer class="footer"><span>Villa Horizonte � Sistema interno de reservas de lotes</span><span>Frontend � Versi�n de demostraci�n</span></footer></div></div>`;
const toggle = document.querySelector('.mobile-toggle');
toggle.addEventListener('click', () => { const open = document.getElementById('sidebar').classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); });
let renderVersion = 0;
async function render() {
  const version = ++renderVersion;
  const [route = 'inicio', ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if (!routes[route]) { location.hash = '/inicio'; return; }
  document.getElementById('modal').close();
  document.querySelectorAll('[data-route]').forEach(link => { if (link.dataset.route === route) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  document.getElementById('topbar-title').textContent = routes[route][0];
  document.title = `${routes[route][0]} � Villa Horizonte`;
  document.getElementById('sidebar').classList.remove('open'); toggle.setAttribute('aria-expanded', 'false');
  const container = document.getElementById('main'); container.innerHTML = '<div class="loading" role="status">Cargando pantalla.</div>';
  try {
    const view = await import(`./views/${routes[route][2]}.js`);
    if (version !== renderVersion) return;
    await view.mount(container, { repository, params, navigate, refresh: render });
  } catch (error) {
    if (version !== renderVersion) return;
    container.innerHTML = `<div class="card card-body"><h1>No se pudo abrir la pantalla</h1><p>${e(error.message)}</p><a href="#/inicio">Volver al inicio</a></div>`;
    console.error(error);
  }
}
export function navigate(route) { const hash = `#/${route}`; if (location.hash === hash) render(); else location.hash = hash; }
window.addEventListener('hashchange', render);
window.addEventListener('storage', () => location.reload());
if (!location.hash) location.hash = '/inicio'; else render();
if (repository.warning) toast(repository.warning, true);
