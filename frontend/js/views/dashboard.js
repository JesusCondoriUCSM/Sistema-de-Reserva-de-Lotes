import { heading } from '../components/ui.js';
export function mount(container) {
  container.innerHTML = heading('Inicio', 'Sistema de gestión interna de lotes.', 'RESUMEN GENERAL') + '<section class="card card-body"><h2>Villa Horizonte</h2><p>La estructura de navegación y los estilos compartidos están preparados.</p></section>';
}
