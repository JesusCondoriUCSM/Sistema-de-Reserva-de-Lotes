import assert from 'node:assert/strict';
import { buildReport } from '../frontend/js/services/reports.js';

// Safe for the dedicated Docker test installation. Mutations require explicit flag.
const base=process.env.VILLA_BASE_URL || 'http://127.0.0.1:8080';
const response=await fetch(base+'/api/health');
assert.equal(response.status,200);
assert.equal((await response.json()).managed,true);
const stateResponse=await fetch(base+'/api/state');
assert.equal(stateResponse.status,200);
const {data}=await stateResponse.json();
assert.ok(data.proyecto.length>=3);
assert.ok(data.lote.length>=8);
assert.ok(data.nota_venta.length>=4);
const filters={lot:1,client:'00000001',advisor:'00000011',project:'Los Girasoles',block:'A',from:'2020-01-01',to:'2099-12-31'};
for(let id=1;id<=10;id++)assert.ok(Array.isArray(buildReport(data,id,filters).rows));
assert.equal((await (await fetch(base+'/api/config')).json()).managed,true);
const config=await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
assert.equal(config.status,409);
for(const path of ['/backend/bootstrap.php','/.docker/secrets/db_app_password.txt','/.runtime/database.json'])assert.equal((await fetch(base+path)).status,404);
if(process.env.VILLA_TEST_MUTATIONS==='1') {
  const suffix=Date.now().toString(36);
  const command=async(operation,args,status=200)=>{
    const r=await fetch(base+'/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,args})});
    const body=await r.json();assert.equal(r.status,status,body.error);return body;
  };
  const lot=(await command('save',['lote',{nombre_proyecto:'Los Girasoles',numero_lote:900,calle:'Prueba automatica',manzana:suffix,tipo_ubicacion:'Intermedio',precio_metro:450,area:120}])).result;
  const serie='CI-'+suffix;
  const values={id_lote:lot,dni_cliente:'00000001',dni_asesor:'00000011',serie_numero:serie,forma_pago:'Efectivo',descripcion:'Prueba automatica Docker'};
  await command('reserve',[{...values,dni_cliente:'99999999'}],422);
  const reserved=await command('reserve',[values]);
  assert.equal(reserved.data.lote.find(x=>x.id_lote===lot).estado,'Separado');
  await command('reserve',[{...values,serie_numero:serie+'B'}],422);
  await command('changeReservation',[lot,'release'],422);
  const completed=await command('changeReservation',[lot,'complete']);
  assert.equal(completed.data.lote.find(x=>x.id_lote===lot).estado,'Vendido');
}
console.log('Docker: conexion automatica, datos de prueba, reportes y operaciones verificados.');
