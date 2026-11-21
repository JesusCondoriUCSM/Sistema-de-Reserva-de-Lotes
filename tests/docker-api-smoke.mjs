import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildReport } from '../frontend/js/services/reports.js';

const base=process.env.VILLA_BASE_URL || 'http://127.0.0.1:8080';
const response=await fetch(base+'/api/health');
assert.equal(response.status,200);
assert.equal((await response.json()).managed,true);
const stateResponse=await fetch(base+'/api/state');
assert.equal(stateResponse.status,200);
const {data}=await stateResponse.json();
for(const table of ['proyecto','lote','cliente','asesor','nota_venta'])assert.ok(Array.isArray(data[table]));
if(process.env.VILLA_EXPECT_EMPTY==='1')for(const rows of Object.values(data))assert.equal(rows.length,0,'Una instalacion nueva debe iniciar vacia.');
const filters={lot:data.lote[0]?.id_lote || 1,client:data.cliente[0]?.dni_cliente || '00000000',advisor:data.asesor[0]?.dni_asesor || '00000000',project:data.proyecto[0]?.nombre_proyecto || 'Proyecto',block:'A',from:'2020-01-01',to:'2099-12-31'};
for(let id=1;id<=10;id++)assert.ok(Array.isArray(buildReport(data,id,filters).rows));
assert.equal((await (await fetch(base+'/api/config')).json()).managed,true);
const config=await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
assert.equal(config.status,409);
for(const path of ['/backend/bootstrap.php','/.docker/secrets/db_app_password.txt','/.runtime/database.json','/js/data/seed.js']) {
 const r=await fetch(base+path);
 // The development test server includes the unit-test fixture; the image excludes it.
 if(path!=='/js/data/seed.js' || process.env.VILLA_CHECK_IMAGE==='1')assert.equal(r.status,404);
}
const proofPath=resolve('tmp/docker-smoke-proof.json');
if(process.env.VILLA_TEST_MUTATIONS==='1') {
  const suffix=Date.now().toString(36);
  const command=async(operation,args,status=200)=>{
    const r=await fetch(base+'/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,args})});
    const body=await r.json();assert.equal(r.status,status,body.error);return body;
  };
  const city=(await command('save',['ciudad_proyecto',{descripcion:'Ciudad CI '+suffix}])).result;
  const district=(await command('save',['distrito_proyecto',{descripcion:'Distrito CI '+suffix}])).result;
  const project='Proyecto CI '+suffix;
  await command('save',['proyecto',{nombre_proyecto:project,ciudad_proyecto:city,distrito_proyecto:district}]);
  let number=Date.now()%100000000;
  while(data.cliente.some(x=>x.dni_cliente===String(number).padStart(8,'0')))number=(number+1)%100000000;
  const dni=String(number).padStart(8,'0');
  await command('save',['cliente',{dni_cliente:dni,nombres:'Cliente prueba',apellidos:'CI',direccion:'Direccion de prueba'}]);
  await command('save',['asesor',{dni_asesor:dni,nombres:'Asesor prueba',apellidos:'CI'}]);
  const lot=(await command('save',['lote',{nombre_proyecto:project,numero_lote:1,calle:'Prueba automatica',manzana:'A',tipo_ubicacion:'Intermedio',precio_metro:450,area:120}])).result;
  const serie='CI-'+suffix;
  const values={id_lote:lot,dni_cliente:dni,dni_asesor:dni,serie_numero:serie,forma_pago:'Efectivo',descripcion:'Prueba automatica Docker'};
  await command('reserve',[{...values,dni_cliente:'99999999'}],422);
  const reserved=await command('reserve',[values]);
  assert.equal(reserved.data.lote.find(x=>x.id_lote===lot).estado,'Separado');
  await command('reserve',[{...values,serie_numero:serie+'B'}],422);
  await command('changeReservation',[lot,'release'],422);
  const completed=await command('changeReservation',[lot,'complete']);
  assert.equal(completed.data.lote.find(x=>x.id_lote===lot).estado,'Vendido');
  mkdirSync(resolve('tmp'),{recursive:true});
  writeFileSync(proofPath,JSON.stringify({base,lot,serie}));
} else if(existsSync(proofPath)) {
  const proof=JSON.parse(readFileSync(proofPath,'utf8'));
  if(proof.base===base){assert.equal(data.lote.find(x=>x.id_lote===proof.lot)?.estado,'Vendido');assert.ok(data.nota_venta.some(x=>x.serie_numero===proof.serie));}
}
console.log('Docker: conexion automatica, reportes y persistencia verificados.');
