import { DemoRepository } from './demo-repository.js';
let storage = null;
try { storage = window.localStorage; } catch { /* Navegaci�n con almacenamiento bloqueado: sesi�n temporal. */ }
export const repository = new DemoRepository(storage);
