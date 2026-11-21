import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildReport } from '../frontend/js/services/reports.js';
import { browserSmoke } from './browser-smoke.mjs';

// Explicit integration command; uses its own database, never the user's records.
test('API PHP y PostgreSQL: CRUD, reservas, rollback, reportes y persistencia', { timeout: 120000 }, async () => {
  const runtime = mkdtempSync(resolve('tmp/integration-'));
  const port = 5187;
  const env = { ...process.env, APP_RUNTIME:runtime, APP_MANAGED_DATABASE:'1', PG_PORT:'55487', PORT:String(port) };
  const server = spawn(process.execPath, ['scripts/serve.mjs'], {env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let log = '';
  server.stdout.on('data', data => { log += data; }); server.stderr.on('data', data => { log += data; });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i=0; i<200; i++) {
      try { ready = (await fetch(base + '/api/health')).ok; } catch {}
      if (ready) break;
      if (server.exitCode !== null) throw new Error(log);
      await new Promise(resolve => setTimeout(resolve,100));
    }
    assert.ok(ready, log);
    const connection = Object.fromEntries(readFileSync(resolve(runtime,'database.ini'),'utf8').trim().split(/\r?\n/).map(line=>line.split('=')));
    const configured = await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(connection)});
    assert.equal(configured.status,200,await configured.text());
    const invalidConfig = await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...connection,database:'bad;name'})});
    assert.equal(invalidConfig.status,422);
    const nativeConfig = await fetch(base+'/api/config',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:base},body:new URLSearchParams(connection)});
    assert.equal(nativeConfig.status,303);
    assert.equal(nativeConfig.headers.get('location'),'/#/inicio');
    const nativeError = await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:base},body:new URLSearchParams({...connection,database:'bad;name'})});
    assert.equal(nativeError.status,422);
    assert.match(nativeError.headers.get('content-type'),/text\/html/);
    const errorPage = await nativeError.text();
    assert.match(errorPage,/No se pudo conectar/);
    assert.match(errorPage,/Volver al formulario/);
    assert.equal(errorPage.includes(connection.password),false);
    const foreignForm = await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:'http://otro-sitio.example'},body:new URLSearchParams(connection)});
    assert.equal(foreignForm.status,422);
    const command = async (operation, args, status=200) => {
      const response = await fetch(base + '/api/command', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,args})});
      const body = await response.json();
      assert.equal(response.status,status,JSON.stringify(body));
      return body;
    };
    const city = (await command('save',['ciudad_proyecto',{descripcion:'Lima'}])).result;
    const district = (await command('save',['distrito_proyecto',{descripcion:'Ancón'}])).result;
    await command('save',['proyecto',{nombre_proyecto:'Proyecto Prueba',ciudad_proyecto:city,distrito_proyecto:district}]);
    await command('save',['cliente',{dni_cliente:'12345678',nombres:'Ana',apellidos:'Pérez',direccion:'Calle 1'}]);
    await command('save',['asesor',{dni_asesor:'87654321',nombres:'Luis',apellidos:'Ramos'}]);
    await command('savePhone',['12345678','999111222']);
    await command('savePhone',['12345678','999111223','999111222']);
    const lot = {nombre_proyecto:'Proyecto Prueba',numero_lote:1,calle:'Calle 1',manzana:'A',tipo_ubicacion:'Esquina',precio_metro:450,area:120};
    const lotId = (await command('save',['lote',lot])).result;
    await command('save',['lote',lot],409);
    await command('save',['lote',{...lot,area:0},lotId],422);
    await command('save',['cliente',{dni_cliente:'123',nombres:'X',apellidos:'Y',direccion:'Z'}],422);
    await command('remove',['proyecto','Proyecto Prueba'],422);
    const note = {serie_numero:'TEST-001',id_lote:lotId,dni_cliente:'12345678',dni_asesor:'87654321',forma_pago:'Efectivo',descripcion:'Separación'};
    await command('reserve',[{...note,dni_cliente:'00000000'}],422);
    let state = (await (await fetch(base+'/api/state')).json()).data;
    assert.equal(state.lote[0].estado,'Disponible'); assert.equal(state.nota_venta.length,0);
    const reserved = await command('reserve',[note]);
    assert.equal(reserved.data.lote[0].estado,'Separado');
    assert.equal(reserved.data.lote[0].precio_venta,54000);
    assert.equal(reserved.data.nota_venta[0].monto_pagado,100);
    await command('reserve',[{...note,serie_numero:'TEST-002'}],422);
    await command('changeReservation',[lotId,'release'],422);
    await command('remove',['cliente','12345678'],422);
    await command('remove',['nota_venta','TEST-001'],422);
    await command('updateNote',['TEST-001',{forma_pago:'Transferencia',descripcion:'Corregida'}]);
    state = (await command('changeReservation',[lotId,'complete'])).data;
    assert.equal(state.lote[0].estado,'Vendido');
    assert.equal(state.nota_venta[0].descripcion,'Corregida');
    const filters = {lot:lotId,client:'12345678',advisor:'87654321',project:'Proyecto Prueba',block:'A',from:'2020-01-01',to:'2099-12-31'};
    for (let id=1; id<=10; id++) assert.ok(Array.isArray(buildReport(state,id,filters).rows));
    const persisted = (await (await fetch(base+'/api/state')).json()).data;
    assert.deepEqual(persisted,state);
    assert.equal((await fetch(base+'/.runtime/database.ini')).status,404);
    assert.equal((await fetch(base+'/backend/bootstrap.php')).status,404);
    assert.equal((await fetch(base+'/js/app.js')).status,200);
    assert.equal((await fetch(base+'/api/missing')).status,404);
    await command('save',['cliente',{dni_cliente:'00000001',nombres:'Temporal',apellidos:'Prueba',direccion:'Calle'}]);
    await command('savePhone',['00000001','999222333']);
    const removed = await command('remove',['cliente','00000001']);
    assert.equal(removed.data.telefono_cliente.some(x=>x.dni_cliente==='00000001'),false);
    const concurrentLot = (await command('save',['lote',{...lot,numero_lote:3}])).result;
    const attempt = serie => new Promise((resolve,reject) => {
      const php = process.env.PHP_BIN || 'C:/xampp/php/php.exe';
      const code = `require 'backend/bootstrap.php'; try { $db=database(); $db->beginTransaction(); callProcedure($db,'sp_registrar_separacion',['${serie}',${concurrentLot},'12345678','87654321','Efectivo','Concurrencia']); $db->query('SELECT pg_sleep(0.4)'); $db->commit(); echo 'OK'; } catch (Throwable $e) { if(isset($db) && $db->inTransaction()) $db->rollBack(); echo 'RECHAZADO'; }`;
      const child = spawn(php,['-d','extension=pdo_pgsql','-r',code],{env,windowsHide:true});
      let output=''; child.stdout.on('data',data=>output+=data);
      child.on('error',reject);child.on('exit',()=>resolve(output));
    });
    const concurrent = await Promise.all([attempt('RACE-1'),attempt('RACE-2')]);
    assert.deepEqual(concurrent.sort(),['OK','RECHAZADO']);
    const afterRace = (await (await fetch(base+'/api/state')).json()).data;
    assert.equal(afterRace.nota_venta.filter(note=>note.id_lote===concurrentLot).length,1);
    if (process.env.BROWSER_TEST === '1') {
      const nextLot = (await command('save',['lote',{...lot,numero_lote:2}])).result;
      await browserSmoke(base,nextLot,connection);
    }
  } finally {
    server.kill();
    const pgBin = process.env.PG_BIN || 'D:/PostgreSQL/bin';
    spawnSync(resolve(pgBin,'pg_ctl.exe'),['-D',resolve(runtime,'postgres'),'-m','fast','-w','stop'],{windowsHide:true,timeout:10000,stdio:'ignore'});
  }
});
