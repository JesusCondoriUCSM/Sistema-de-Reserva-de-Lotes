import { icon, toast } from './components/ui.js';
import { dateLabel, today, escapeHTML as e } from './lib/format.js';
import { repository } from './services/repository.js';

const routes = {
  inicio: ['Inicio', 'home', 'dashboard'], proyectos: ['Proyectos', 'grid', 'projects'],
  lotes: ['Lotes', 'grid', 'lots'], clientes: ['Clientes', 'users', 'clients'],
  asesores: ['Asesores', 'users', 'advisors'], separaciones: ['Separaciones', 'note', 'reservations'],
  reportes: ['Reportes', 'chart', 'reports'], catalogos: ['Catálogos', 'grid', 'catalogs']
};
const app = document.getElementById('app');
app.innerHTML = `<div class="shell"><aside class="sidebar" id="sidebar" aria-label="Navegación principal"><div class="sidebar-brand"><a href="#/inicio" class="brand" aria-label="Villa Horizonte, inicio"><span class="brand-mark">${icon('home')}</span><span class="brand-copy"><strong>Villa Horizonte</strong><small>Gestión inmobiliaria</small></span></a><button class="icon-btn sidebar-close" type="button" aria-label="Cerrar menú">${icon('close')}</button></div><div class="menu-label">PRINCIPAL</div><nav class="nav" aria-label="Menú principal">${Object.entries(routes).map(([key, [name, symbol]]) => `<a href="#/${key}" data-route="${key}" aria-label="${name}" title="${name}">${icon(symbol)}<span class="nav-label">${name}</span></a>`).join('')}</nav><div class="sidebar-bottom"><div class="user"><span class="avatar" aria-hidden="true">VH</span><div class="user-copy">Villa Horizonte<small>Gestión inmobiliaria</small></div></div></div></aside><button class="sidebar-backdrop" type="button" aria-label="Cerrar menú" tabindex="-1" hidden></button><div class="workspace"><header class="topbar"><button class="btn small mobile-toggle sidebar-toggle" type="button" aria-label="Contraer menú" aria-controls="sidebar" aria-expanded="true">${icon('menu')}</button><div class="topbar-heading"><span class="eyebrow">Villa Horizonte</span><span class="topbar-title" id="topbar-title">Inicio</span></div><span class="date">${icon('clock')}${dateLabel(today())}</span></header><main id="main" class="content" tabindex="-1"></main></div></div>`;
const shell = document.querySelector('.shell');
const sidebar = document.getElementById('sidebar');
const workspace = document.querySelector('.workspace');
const toggle = document.querySelector('.sidebar-toggle');
const backdrop = document.querySelector('.sidebar-backdrop');
const mobile = window.matchMedia('(max-width: 800px)');
let collapsed = false;
try { collapsed = localStorage.getItem('villa-horizonte-sidebar-collapsed') === 'true'; } catch { /* Preferencia temporal si el almacenamiento no está disponible. */ }
function syncNavigation() {
  shell.classList.toggle('sidebar-collapsed', collapsed);
  const open = mobile.matches && sidebar.classList.contains('open');
  const expanded = mobile.matches ? open : !collapsed;
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.setAttribute('aria-label', mobile.matches ? (open ? 'Cerrar menú' : 'Abrir menú') : (collapsed ? 'Expandir menú' : 'Contraer menú'));
  toggle.title = toggle.getAttribute('aria-label');
  backdrop.hidden = !open;
  sidebar.inert = mobile.matches && !open;
  workspace.inert = open;
}
function closeMobileMenu(returnFocus = false) {
  sidebar.classList.remove('open');
  syncNavigation();
  if (returnFocus) toggle.focus();
}
toggle.addEventListener('click', () => {
  if (mobile.matches) {
    sidebar.classList.toggle('open');
    syncNavigation();
    if (sidebar.classList.contains('open')) sidebar.querySelector('[aria-current="page"]')?.focus();
  } else {
    collapsed = !collapsed;
    try { localStorage.setItem('villa-horizonte-sidebar-collapsed', String(collapsed)); } catch { /* Mantener la preferencia durante esta sesión. */ }
    syncNavigation();
  }
});
backdrop.addEventListener('click', () => closeMobileMenu(true));
document.querySelector('.sidebar-close').addEventListener('click', () => closeMobileMenu(true));
document.addEventListener('keydown', event => {
  if (!mobile.matches || !sidebar.classList.contains('open')) return;
  if (event.key === 'Escape') { event.preventDefault(); closeMobileMenu(true); }
  if (event.key === 'Tab') {
    const links = [...sidebar.querySelectorAll('a, button')].filter(el => el.getClientRects().length);
    const first = links[0], last = links[links.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
mobile.addEventListener('change', () => closeMobileMenu());
syncNavigation();
let renderVersion = 0;
async function render() {
  const version = ++renderVersion;
  const [route = 'inicio', ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if (!routes[route]) { location.hash = '/inicio'; return; }
  document.getElementById('modal').close();
  document.querySelectorAll('[data-route]').forEach(link => { if (link.dataset.route === route) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  document.getElementById('topbar-title').textContent = routes[route][0];
  document.title = `${routes[route][0]} · Villa Horizonte`;
  closeMobileMenu();
  const container = document.getElementById('main'); container.scrollTop = 0; container.innerHTML = '<div class="loading" role="status">Cargando pantalla…</div>';
  try {
    await repository.load();
    const view = await import(`./views/${routes[route][2]}.js`);
    if (version !== renderVersion) return;
    await view.mount(container, { repository, params, navigate, refresh: render });
  } catch (error) {
    if (version !== renderVersion) return;
    container.innerHTML = `<div class="card card-body"><h1>No se pudo abrir la pantalla</h1><p>${e(error.message)}</p><div class="actions"><button class="btn" id="retry-load">Reintentar</button><a class="btn primary" href="/conexion.html">Configurar conexión</a></div></div>`;
    container.querySelector('#retry-load').onclick = render;
    console.error(error);
  }
}
export function navigate(route) { const hash = `#/${route}`; if (location.hash === hash) render(); else location.hash = hash; }
window.addEventListener('hashchange', render);
window.addEventListener('focus', () => { if (!document.getElementById('modal').open && !document.querySelector('#reservation-form')) render(); });
if (!location.hash) location.hash = '/inicio'; else render();
if (repository.warning) toast(repository.warning, true);
