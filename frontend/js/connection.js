const form = document.querySelector('#connection-form');
const result = document.querySelector('#connection-result');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('[type=submit]');
  button.disabled = true; result.className = ''; result.textContent = 'Comprobando conexión…';
  try {
    const response = await fetch('/api/config', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
    let body;
    try { body = await response.json(); }
    catch { throw new Error('El servidor devolvió una respuesta inesperada. Reinicia el sistema con npm run dev e intenta de nuevo.'); }
    if (!response.ok) throw new Error(body.error || 'No se pudo conectar.');
    form.elements.password.value = '';
    result.className = 'info success'; result.textContent = `Conexión guardada: ${body.database}. Abriendo el sistema…`;
    location.replace('/#/inicio');
  } catch (error) {
    result.className = 'error-message';
    result.textContent = `${error.message} Comprueba que el servidor esté iniciado y que el puerto, usuario y contraseña coincidan con pgAdmin.`;
  } finally { button.disabled = false; }
});

form.dataset.ready = 'true';
fetch('/api/config', {cache:'no-store'}).then(response=>response.json()).then(config=>{
  if (config.managed) location.replace('/#/inicio');
}).catch(()=>{ /* El formulario sigue disponible si el servidor no responde. */ });
