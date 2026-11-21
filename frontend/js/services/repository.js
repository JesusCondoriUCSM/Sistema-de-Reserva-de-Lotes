export class ApiRepository {
  constructor() { this.data = null; this.warning = ''; }
  snapshot() {
    if (!this.data) throw new Error('Los datos aun no se han cargado.');
    return structuredClone(this.data);
  }
  async request(path, options) {
    let response;
    try { response = await fetch(path, { cache: 'no-store', ...options }); }
    catch { throw new Error('No se pudo conectar con el servidor. Revisa la conexion e intenta de nuevo.'); }
    let payload;
    try { payload = await response.json(); }
    catch { throw new Error('El servidor no devolvio una respuesta valida.'); }
    if (!response.ok) throw new Error(payload.error || 'No se pudo completar la operacion.');
    this.data = payload.data;
    return payload.result;
  }
  load() { return this.request('/api/state'); }
  command(operation, args) {
    return this.request('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation, args }) });
  }
  save(...args) { return this.command('save', args); }
  remove(...args) { return this.command('remove', args); }
  savePhone(...args) { return this.command('savePhone', args); }
  removePhone(...args) { return this.command('removePhone', args); }
  reserve(...args) { return this.command('reserve', args); }
  changeReservation(...args) { return this.command('changeReservation', args); }
  updateNote(...args) { return this.command('updateNote', args); }
}
export const repository = new ApiRepository();
