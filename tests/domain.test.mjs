import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoRepository, reservationStatus, latestNote, availability } from '../frontend/js/services/demo-repository.js';
import { buildReport } from '../frontend/js/services/reports.js';
import { addDays, today, escapeHTML } from '../frontend/js/lib/format.js';

const reserve = repository => repository.reserve({ id_lote: 1, dni_cliente: '00000001', dni_asesor: '00000011', serie_numero: 'TEST-001', forma_pago: 'Efectivo', descripcion: 'Separación de prueba' });

test('registra nota y separa el lote; rechaza la segunda separación', () => {
  const repository = new DemoRepository(); const initial = repository.snapshot().nota_venta.length;
  reserve(repository); const state = repository.snapshot();
  assert.equal(state.nota_venta.length, initial + 1);
  assert.equal(state.lote.find(x => x.id_lote === 1).estado, 'Separado');
  assert.equal(state.nota_venta.find(x => x.serie_numero === 'TEST-001').monto_pagado, 100);
  assert.throws(() => reserve(repository), /no está disponible/);
  assert.equal(repository.snapshot().nota_venta.length, initial + 1);
});

test('la operación rechazada no cambia el lote ni agrega una nota', () => {
  const repository = new DemoRepository(); const before = repository.snapshot();
  assert.throws(() => repository.reserve({ id_lote: 1, dni_cliente: '00000000', dni_asesor: '00000011', serie_numero: 'T-1', forma_pago: 'Efectivo', descripcion: 'Prueba' }), /cliente válido/);
  assert.deepEqual(repository.snapshot(), before);
});

test('el vencimiento comienza al inicio del octavo día calendario', () => {
  const note = { fecha_emision: '2026-11-01' };
  assert.equal(reservationStatus(note, '2026-11-08').expired, false);
  assert.equal(reservationStatus(note, '2026-11-09').expired, true);
  assert.equal(reservationStatus(note, '2026-11-09').remaining, 0);
  assert.equal(addDays('2026-12-28', 8), '2027-01-05');
});

test('libera solo vencidas, conserva historial y permite una nueva separación', () => {
  const repository = new DemoRepository(); const previous = repository.snapshot().nota_venta.length;
  assert.throws(() => repository.changeReservation(2, 'release'), /dentro del plazo/);
  repository.changeReservation(6, 'release');
  assert.equal(repository.snapshot().lote.find(x => x.id_lote === 6).estado, 'Disponible');
  assert.equal(repository.snapshot().nota_venta.length, previous);
  repository.reserve({ id_lote: 6, dni_cliente: '00000001', dni_asesor: '00000011', serie_numero: 'TEST-002', forma_pago: 'Transferencia', descripcion: 'Nueva separación' });
  assert.equal(latestNote(repository.snapshot(), 6).serie_numero, 'TEST-002');
  const report = buildReport(repository.snapshot(), 5);
  assert.equal(report.rows.filter(row => row[5] === dateForToday()).length, 1);
});
function dateForToday() { const [y, m, d] = today().split('-'); return `${d}/${m}/${y}`; }

test('concreta dentro del plazo y rechaza una separación vencida', () => {
  const repository = new DemoRepository();
  assert.throws(() => repository.changeReservation(6, 'complete'), /ya venció/);
  repository.changeReservation(2, 'complete');
  assert.equal(repository.snapshot().lote.find(x => x.id_lote === 2).estado, 'Vendido');
});

test('protege dependencias y permite borrar clientes sin operaciones', () => {
  const repository = new DemoRepository();
  assert.throws(() => repository.remove('cliente', '00000001'), /notas de venta/);
  assert.throws(() => repository.remove('proyecto', 'Los Girasoles'), /lotes asociados/);
  assert.throws(() => repository.remove('ciudad_proyecto', 1), /utilizado/);
  assert.throws(() => repository.remove('nota_venta', 'NV01-000125'), /No se permite/);
  repository.remove('cliente', '00000002');
  assert.equal(repository.snapshot().cliente.some(x => x.dni_cliente === '00000002'), false);
});

test('valida campos, teléfonos y ubicación única del lote', () => {
  const repository = new DemoRepository();
  assert.throws(() => repository.save('cliente', { dni_cliente: '12345678' }), /obligatorios/);
  assert.throws(() => repository.savePhone('00000001', '123'), /nueve dígitos/);
  assert.throws(() => repository.savePhone('00000001', '000000001'), /ya tiene/);
  repository.savePhone('00000002', '000000005');
  repository.savePhone('00000002', '000000006', '000000005');
  assert.equal(repository.snapshot().telefono_cliente.find(x => x.dni_cliente === '00000002').telefono, '000000006');
  const lot = repository.snapshot().lote[0];
  const { id_lote, ...values } = lot;
  assert.throws(() => repository.save('lote', values), /Ya existe ese lote/);
  assert.throws(() => repository.save('lote', { ...values, numero_lote: 22, precio_metro: 1000 }), /rango/);
});

test('proyectos nuevos aparecen con cero lotes y los reportes incluyen clientes sin teléfono', () => {
  const repository = new DemoRepository(); repository.save('proyecto', { nombre_proyecto: 'Nuevo', ciudad_proyecto: 1, distrito_proyecto: 1 });
  const state = repository.snapshot();
  assert.equal(availability(state).find(x => x.nombre_proyecto === 'Nuevo').total, 0);
  assert.equal(buildReport(state, 7).rows.find(x => x[0] === '00000002')[4], 'Sin teléfono');
});

test('los diez reportes responden y los filtros de periodo son inclusivos', () => {
  const data = new DemoRepository().snapshot();
  const filters = { project: 'Los Girasoles', block: 'A', lot: '1', client: '00000001', advisor: '00000011', from: addDays(today(), -100), to: today() };
  for (let id = 1; id <= 10; id++) { const report = buildReport(data, id, filters); assert.ok(report.headers.length); assert.ok(Array.isArray(report.rows)); }
  const date = data.nota_venta[0].fecha_emision;
  const report = buildReport(data, 10, { from: date, to: date });
  assert.equal(report.rows.length, 1); assert.equal(report.rows[0][1], 1);
  assert.throws(() => buildReport(data, 10, { from: '2026-12-01', to: '2026-01-01' }), /inicial/);
});

test('fallar al persistir no confirma cambios; escapa contenido HTML', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('Quota'); } };
  const repository = new DemoRepository(storage); const before = repository.snapshot();
  assert.throws(() => reserve(repository), /No se pudo guardar/);
  assert.deepEqual(repository.snapshot(), before);
  assert.equal(escapeHTML('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});

test('persistencia local permite recuperar cambios en una nueva sesión', () => {
  const memory = new Map(); const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const repository = new DemoRepository(storage); reserve(repository);
  assert.equal(new DemoRepository(storage).snapshot().lote.find(x => x.id_lote === 1).estado, 'Separado');
});
