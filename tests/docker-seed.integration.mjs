import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('SQL de Docker: datos iniciales, usuario sin privilegios y conexion por entorno', {timeout:120000}, async()=>{
  const runtime=mkdtempSync(resolve('tmp/docker-seed-'));
  const env={...process.env,APP_RUNTIME:runtime,APP_MANAGED_DATABASE:'1',APP_SEED_DEMO:'1',PG_PORT:'55488',PORT:'5188'};
  const server=spawn(process.execPath,['scripts/serve.mjs'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let log='';server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
  let managed;
  const pg=process.env.PG_BIN || 'D:/PostgreSQL/bin';
  try {
    let ready=false;
    for(let i=0;i<200;i++){
      try{ready=(await fetch('http://127.0.0.1:5188/api/health')).ok;}catch{}
      if(ready)break;if(server.exitCode!==null)throw new Error(log);
      await new Promise(r=>setTimeout(r,100));
    }
    assert.ok(ready,log);
    const config=Object.fromEntries(readFileSync(resolve(runtime,'database.ini'),'utf8').trim().split(/\r?\n/).map(line=>line.split('=')));
    const sql=readFileSync('deploy/docker/permissions.sql','utf8').replace('DATABASE proyecto_villa_horizonte','DATABASE villa_horizonte');
    const grants=spawnSync(resolve(pg,'psql.exe'),['-h','127.0.0.1','-p',config.port,'-U',config.user,'-d',config.database,'-v','ON_ERROR_STOP=1','-v','app_password='+config.password],{env:{...env,PGPASSWORD:config.password},input:sql,encoding:'utf8',windowsHide:true,timeout:10000});
    assert.equal(grants.status,0,grants.stderr);
    const secret=resolve(runtime,'app-secret');writeFileSync(secret,config.password);
    managed=spawn('C:/xampp/php/php.exe',['-d','extension=pdo_pgsql','-d','display_errors=0','-S','127.0.0.1:5189','-t','frontend','backend/router.php'],{env:{...env,DB_HOST:'127.0.0.1',DB_PORT:config.port,DB_NAME:config.database,DB_USER:'villa_app',DB_PASSWORD_FILE:secret},windowsHide:true,stdio:'ignore'});
    for(let i=0;i<100;i++){
      try{if((await fetch('http://127.0.0.1:5189/api/health')).ok)break;}catch{}
      await new Promise(r=>setTimeout(r,100));
    }
    const smoke=spawnSync(process.execPath,['tests/docker-api-smoke.mjs'],{env:{...env,VILLA_BASE_URL:'http://127.0.0.1:5189',VILLA_TEST_MUTATIONS:'1'},windowsHide:true,encoding:'utf8',timeout:20000});
    assert.equal(smoke.status,0,smoke.stdout+smoke.stderr);
    const data=(await (await fetch('http://127.0.0.1:5189/api/state')).json()).data;
    assert.equal(data.lote.length,9);
    assert.equal(data.nota_venta.length,5);
    assert.equal(data.cliente.length,4);
    assert.ok(data.nota_venta.some(x=>x.serie_numero==='NV01-000126'));
    const command=async(operation,args)=>{
      const response=await fetch('http://127.0.0.1:5189/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,args})});
      assert.equal(response.status,200,await response.clone().text());return response.json();
    };
    const released=await command('changeReservation',[6,'release']);
    assert.equal(released.data.lote.find(x=>x.id_lote===6).estado,'Disponible');
    assert.equal(released.data.nota_venta.length,5);
    await command('changeReservation',[2,'complete']);
    const privileges=spawnSync(resolve(pg,'psql.exe'),['-h','127.0.0.1','-p',config.port,'-U','villa_app','-d',config.database,'-tAc',"SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname=current_user"],{env:{...env,PGPASSWORD:config.password},windowsHide:true,encoding:'utf8',timeout:10000});
    assert.equal(privileges.stdout.trim(),'f');
    if(process.env.BROWSER_TEST==='1') {
      const browser=spawnSync(process.execPath,['tests/docker-browser.mjs'],{env:{...env,VILLA_BASE_URL:'http://127.0.0.1:5189'},windowsHide:true,encoding:'utf8',timeout:45000});
      assert.equal(browser.status,0,browser.stdout+browser.stderr);
    }
  }finally{
    managed?.kill();server.kill();
    spawnSync(resolve(pg,'pg_ctl.exe'),['-D',resolve(runtime,'postgres'),'-m','fast','-w','stop'],{windowsHide:true,timeout:10000,stdio:'ignore'});
  }
});
