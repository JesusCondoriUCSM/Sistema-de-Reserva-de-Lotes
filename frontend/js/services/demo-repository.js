import { createSeed } from '../data/seed.js';
import { today, addDays, daysBetween } from '../lib/format.js';

const KEY = 'villa-horizonte-demo-v1';
const pk = { cliente: 'dni_cliente', asesor: 'dni_asesor', proyecto: 'nombre_proyecto', lote: 'id_lote', ciudad_proyecto: 'id_ciudad', distrito_proyecto: 'id_distrito', nota_venta: 'serie_numero' };
const limits = { nombres: 80, apellidos: 80, direccion: 150, nombre_proyecto: 100, calle: 50, manzana: 10, tipo_ubicacion: 20, descripcion: 200, forma_pago: 25, serie_numero: 20 };
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };

export function latestNote(data, lotId) {
  return data.nota_venta.filter(note => note.id_lote === Number(lotId)).sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision) || b.serie_numero.localeCompare(a.serie_numero))[0];
}
export function reservationStatus(note, date = today()) {
  const expires = addDays(note.fecha_emision, 8);
  return { expires, expired: date >= expires, future: date < note.fecha_emision, remaining: Math.max(daysBetween(date, expires), 0) };
}
export function availability(data) {
  return data.proyecto.map(project => {
    const lots = data.lote.filter(lot => lot.nombre_proyecto === project.nombre_proyecto);
    return { ...project, total: lots.length, disponibles: lots.filter(lot => lot.estado === 'Disponible').length, separados: lots.filter(lot => lot.estado === 'Separado').length, vendidos: lots.filter(lot => lot.estado === 'Vendido').length };
  });
}

export class DemoRepository {
  constructor(storage = null) {
    this.storage = storage;
    this.warning = '';
    this.data = createSeed();
    try {
      const raw = storage?.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        requireThat(saved.version === 1 && Object.keys(this.data).every(key => key === 'sequences' ? saved.data[key] && typeof saved.data[key] === 'object' : Array.isArray(saved.data[key])), 'Los datos locales no tienen el formato esperado.');
        this.data = saved.data;
      }
    } catch { this.warning = 'No se pudieron recuperar los datos locales. Se muestra una demostraci�n temporal.'; this.storage = null; }
  }
  snapshot() { return structuredClone(this.data); }
  transaction(change) {
    // Releer antes de escribir permite detectar cambios de otra pesta�a en esta demo.
    if (this.storage) {
      const raw = this.storage.getItem(KEY);
      if (raw) this.data = JSON.parse(raw).data;
    }
    const next = this.snapshot();
    const result = change(next);
    if (this.storage) {
      try { this.storage.setItem(KEY, JSON.stringify({ version: 1, data: next })); }
      catch { throw new Error('No se pudo guardar la demostraci�n en este navegador. Libera espacio o habilita almacenamiento local.'); }
    }
    this.data = next;
    return result;
  }
  save(table, values, originalKey = null) {
    requireThat(['cliente', 'asesor', 'proyecto', 'lote', 'ciudad_proyecto', 'distrito_proyecto'].includes(table), 'Operaci�n no permitida.');
    return this.transaction(data => {
      const key = pk[table];
      const record = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, typeof value === 'string' ? value.trim() : value]));
      const required = {
        cliente: ['dni_cliente', 'nombres', 'apellidos', 'direccion'],
        asesor: ['dni_asesor', 'nombres', 'apellidos'],
        proyecto: ['nombre_proyecto', 'ciudad_proyecto', 'distrito_proyecto'],
        lote: ['nombre_proyecto', 'numero_lote', 'calle', 'manzana', 'tipo_ubicacion', 'area', 'precio_metro'],
        ciudad_proyecto: ['descripcion'], distrito_proyecto: ['descripcion']
      }[table];
      requireThat(required.every(name => record[name] !== '' && record[name] !== null && record[name] !== undefined), 'Completa todos los campos obligatorios.');
      for (const [name, value] of Object.entries(record)) {
        requireThat(value !== '' && value !== null && value !== undefined, 'Completa todos los campos obligatorios.');
        if (typeof value === 'string') requireThat(value.length <= (limits[name] || 60), `El campo ${name} excede la longitud permitida.`);
      }
      if (table === 'cliente' || table === 'asesor') requireThat(/^\d{8}$/.test(record[key]), 'El DNI debe contener exactamente ocho d�gitos.');
      if (table === 'proyecto') {
        record.ciudad_proyecto = Number(record.ciudad_proyecto); record.distrito_proyecto = Number(record.distrito_proyecto);
        requireThat(data.ciudad_proyecto.some(x => x.id_ciudad === record.ciudad_proyecto) && data.distrito_proyecto.some(x => x.id_distrito === record.distrito_proyecto), 'Selecciona una ciudad y un distrito registrados.');
      }
      const existing = originalKey === null ? null : data[table].find(x => String(x[key]) === String(originalKey));
      if (originalKey !== null) requireThat(existing, 'El registro ya no existe. Actualiza el listado.');
      if (existing) requireThat(String(record[key] ?? existing[key]) === String(existing[key]), 'El identificador no se puede modificar.');
      if (table === 'lote') {
        for (const name of ['numero_lote', 'area', 'precio_metro']) { record[name] = Number(record[name]); requireThat(Number.isFinite(record[name]) && record[name] > 0, 'N�mero de lote, �rea y precio deben ser positivos.'); }
        requireThat(Number.isInteger(record.numero_lote) && record.numero_lote <= 999, 'El n�mero de lote debe ser un entero entre 1 y 999.');
        requireThat(record.area <= 9999.99 && record.precio_metro <= 999.99, '�rea o precio por m� fuera del rango del modelo.');
        record.area = Math.round(record.area * 100) / 100; record.precio_metro = Math.round(record.precio_metro * 100) / 100;
        record.precio_venta = Math.round(record.area * record.precio_metro * 100) / 100;
        requireThat(record.precio_venta > 0 && record.precio_venta <= 999999.99, 'El precio total est� fuera del rango del modelo.');
        requireThat(data.proyecto.some(x => x.nombre_proyecto === record.nombre_proyecto), 'Selecciona un proyecto registrado.');
        requireThat(['Esquina', 'Frentera', 'Intermedio'].includes(record.tipo_ubicacion), 'Selecciona una ubicaci�n comercial v�lida.');
        requireThat(!data.lote.some(x => x !== existing && x.nombre_proyecto === record.nombre_proyecto && x.manzana === record.manzana && x.numero_lote === record.numero_lote), 'Ya existe ese lote en el proyecto y manzana.');
        record.estado = existing?.estado || 'Disponible';
      }
      if (table.endsWith('_proyecto')) requireThat(record.descripcion.length <= 60 && !data[table].some(x => x !== existing && x.descripcion === record.descripcion), 'La descripci�n ya existe o supera 60 caracteres.');
      if (existing) { Object.assign(existing, record); return existing[key]; }
      if (data.sequences[table]) {
        const next = data.sequences[table];
        requireThat(next <= (table === 'lote' ? 999 : 999999), 'Se alcanz� el l�mite de identificadores del modelo.');
        record[key] = next; data.sequences[table] += 1;
      }
      requireThat(!data[table].some(x => String(x[key]) === String(record[key])), 'Ya existe un registro con ese identificador.');
      data[table].push(record); return record[key];
    });
  }
  remove(table, value) {
    requireThat(['cliente', 'asesor', 'proyecto', 'lote', 'ciudad_proyecto', 'distrito_proyecto'].includes(table), 'No se permite eliminar notas de venta.');
    return this.transaction(data => {
      const key = pk[table]; const record = data[table].find(x => String(x[key]) === String(value));
      requireThat(record, 'El registro ya no existe.');
      if (['cliente', 'asesor', 'lote'].includes(table)) requireThat(!data.nota_venta.some(x => String(x[key]) === String(value)), 'No se puede eliminar: tiene notas de venta asociadas.');
      if (table === 'lote') requireThat(record.estado === 'Disponible', 'Solo se eliminan lotes disponibles y sin historial.');
      if (table === 'proyecto') requireThat(!data.lote.some(x => x.nombre_proyecto === value), 'No se puede eliminar: el proyecto tiene lotes asociados.');
      if (table.endsWith('_proyecto')) requireThat(!data.proyecto.some(x => Number(x[table]) === Number(value)), 'No se puede eliminar: est� utilizado por un proyecto.');
      if (table === 'cliente') data.telefono_cliente = data.telefono_cliente.filter(x => x.dni_cliente !== value);
      data[table] = data[table].filter(x => x !== record);
    });
  }
  savePhone(dni, phone, oldPhone = null) {
    return this.transaction(data => {
      requireThat(data.cliente.some(x => x.dni_cliente === dni), 'El cliente ya no existe.');
      requireThat(/^\d{9}$/.test(phone), 'El tel�fono debe contener nueve d�gitos.');
      requireThat(!data.telefono_cliente.some(x => x.dni_cliente === dni && x.telefono === phone && x.telefono !== oldPhone), 'El cliente ya tiene ese tel�fono.');
      if (oldPhone !== null) { const existing = data.telefono_cliente.find(x => x.dni_cliente === dni && x.telefono === oldPhone); requireThat(existing, 'El tel�fono ya no existe.'); existing.telefono = phone; }
      else data.telefono_cliente.push({ dni_cliente: dni, telefono: phone });
    });
  }
  removePhone(dni, phone) { return this.transaction(data => { requireThat(data.telefono_cliente.some(x => x.dni_cliente === dni && x.telefono === phone), 'El tel�fono ya no existe.'); data.telefono_cliente = data.telefono_cliente.filter(x => !(x.dni_cliente === dni && x.telefono === phone)); }); }
  reserve(values) {
    return this.transaction(data => {
      const lot = data.lote.find(x => x.id_lote === Number(values.id_lote));
      requireThat(lot && lot.estado === 'Disponible', 'El lote ya no est� disponible. Selecciona otro.');
      requireThat(data.cliente.some(x => x.dni_cliente === values.dni_cliente), 'Busca o registra un cliente v�lido.');
      requireThat(data.asesor.some(x => x.dni_asesor === values.dni_asesor), 'Selecciona un asesor registrado.');
      const serie = String(values.serie_numero || '').trim();
      requireThat(serie && serie.length <= 20, 'La serie y n�mero deben tener entre 1 y 20 caracteres.');
      requireThat(!data.nota_venta.some(x => x.serie_numero === serie), 'Ya existe una nota con esa serie y n�mero.');
      requireThat(values.forma_pago?.trim() && values.forma_pago.length <= 25, 'Selecciona una forma de pago v�lida.');
      requireThat(values.descripcion?.trim() && values.descripcion.trim().length <= 200, 'La descripci�n es obligatoria y admite hasta 200 caracteres.');
      const last = latestNote(data, lot.id_lote);
      requireThat(!last || last.fecha_emision < today(), 'La nueva separaci�n debe ser posterior a las notas anteriores del lote.');
      data.nota_venta.push({ serie_numero: serie, id_lote: lot.id_lote, dni_cliente: values.dni_cliente, dni_asesor: values.dni_asesor, fecha_emision: today(), tipo_comprobante: 'Nota de venta', total_pagar: 100, monto_pagado: 100, forma_pago: values.forma_pago.trim(), descripcion: values.descripcion.trim(), unidad: 'UND', cantidad: 1, precio_unitario: 100 });
      lot.estado = 'Separado'; return serie;
    });
  }
  changeReservation(lotId, action) {
    return this.transaction(data => {
      const lot = data.lote.find(x => x.id_lote === Number(lotId));
      requireThat(lot?.estado === 'Separado', 'El lote ya no est� separado. Actualiza la pantalla.');
      const note = latestNote(data, lot.id_lote); requireThat(note, 'No hay una nota asociada al lote.');
      const status = reservationStatus(note);
      requireThat(!status.future, 'La fecha de la nota requiere revisi�n.');
      requireThat(['release', 'complete'].includes(action), 'Acci�n no v�lida.');
      requireThat(action === 'release' ? status.expired : !status.expired, action === 'release' ? 'La separaci�n todav�a est� dentro del plazo.' : 'La separaci�n ya venci�.');
      lot.estado = action === 'release' ? 'Disponible' : 'Vendido';
    });
  }
  updateNote(serie, values) {
    return this.transaction(data => {
      const note = data.nota_venta.find(x => x.serie_numero === serie); requireThat(note, 'La nota no existe.');
      requireThat(values.forma_pago?.trim() && values.forma_pago.trim().length <= 25 && values.descripcion?.trim() && values.descripcion.trim().length <= 200, 'Completa forma de pago y descripci�n dentro de sus l�mites.');
      note.forma_pago = values.forma_pago.trim(); note.descripcion = values.descripcion.trim();
    });
  }
}
