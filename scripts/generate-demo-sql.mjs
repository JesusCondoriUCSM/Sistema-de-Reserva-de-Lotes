import { createSeed } from '../frontend/js/data/seed.js';
import { today, daysBetween } from '../frontend/js/lib/format.js';
import { writeFileSync } from 'node:fs';
const seed=createSeed();
const q=value=>typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
let sql='-- Datos ficticios autorizados para una instalacion Docker NUEVA.\n-- Cargar una sola vez, despues del esquema y antes de los triggers.\n';
for(const [table,rows] of Object.entries(seed)) {
 if(table==='sequences') continue;
 const keys=Object.keys(rows[0]);
 sql+=`INSERT INTO public.${table} (${keys.join(', ')}) ${['ciudad_proyecto','distrito_proyecto','lote'].includes(table)?'OVERRIDING SYSTEM VALUE ':''}VALUES\n`;
 sql+=rows.map(row=>'('+keys.map(key=>key==='fecha_emision'?`((CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date + ${daysBetween(today(),row[key])})`:q(row[key])).join(', ')+')').join(',\n')+';\n\n';
}
for(const [table,key] of [['ciudad_proyecto','id_ciudad'],['distrito_proyecto','id_distrito'],['lote','id_lote']])sql+=`SELECT setval(pg_get_serial_sequence('public.${table}', '${key}'), (SELECT max(${key}) FROM public.${table}));\n`;
writeFileSync(new URL('../backend/seed-demo.sql',import.meta.url),sql);
