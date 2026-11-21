import assert from 'node:assert/strict';
import { browserSmoke } from './browser-smoke.mjs';
const base=process.env.VILLA_BASE_URL || 'http://127.0.0.1:8080';
const health=await (await fetch(base+'/api/health')).json();
assert.equal(health.managed,true);
const {data}=await (await fetch(base+'/api/state')).json();
const command=async(operation,args)=>{
  const response=await fetch(base+'/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,args})});
  const payload=await response.json();assert.equal(response.status,200,payload.error);return payload;
};
if(!data.cliente.some(x=>x.dni_cliente==='12345678'))await command('save',['cliente',{dni_cliente:'12345678',nombres:'Cliente prueba',apellidos:'Interfaz',direccion:'Direccion ficticia'}]);
if(!data.asesor.some(x=>x.dni_asesor==='87654321'))await command('save',['asesor',{dni_asesor:'87654321',nombres:'Asesor prueba',apellidos:'Interfaz'}]);
const lot=(await command('save',['lote',{nombre_proyecto:'Los Girasoles',numero_lote:901,calle:'Calle ficticia',manzana:Date.now().toString(36),tipo_ubicacion:'Esquina',area:120,precio_metro:450}])).result;
const next=Math.max(0,...data.nota_venta.filter(x=>/^NV01-\d+$/.test(x.serie_numero)).map(x=>Number(x.serie_numero.split('-')[1])))+1;
await browserSmoke(base,lot,null,`NV01-${String(next).padStart(6,'0')}`);
console.log('Chrome: conexion automatica Docker, ocho modulos y registro completo de separacion verificados.');
