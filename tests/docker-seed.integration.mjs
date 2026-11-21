import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync,readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { stopServer } from './stop-server.mjs';
import { freePort } from './free-port.mjs';

const localSeed=resolve('.docker/seed-demo.sql');
for(const seeded of [false,...(existsSync(localSeed)?[true]:[])]) {
test(`SQL de Docker: ${seeded?'datos solo locales':'base vacia'}, permisos y conexion automatica`, {timeout:120000}, async()=>{
  const dbPort=String(await freePort());
  const port=String(await freePort());
  const managedPort=String(await freePort());
  const base='http://127.0.0.1:'+port;
  const managedBase='http://127.0.0.1:'+managedPort;
  const runtime=mkdtempSync(resolve('tmp/docker-seed-'));
  const env={...process.env,APP_RUNTIME:runtime,APP_MANAGED_DATABASE:'1',APP_SEED_DEMO:seeded?'1':'0',APP_TEST_SEED_FILE:localSeed,PG_PORT:dbPort,PORT:port};
  const server=spawn(process.execPath,['scripts/serve.mjs'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let log='';server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
  let managed;
  const pg=process.env.PG_BIN || 'D:/PostgreSQL/bin';
  try {
    let ready=false;
    for(let i=0;i<200;i++){
      try{ready=(await fetch(base+'/api/health')).ok;}catch{}
      if(ready)break;if(server.exitCode!==null)throw new Error(log);
      await new Promise(r=>setTimeout(r,100));
    }
    assert.ok(ready,log);
    const config=Object.fromEntries(readFileSync(resolve(runtime,'database.ini'),'utf8').trim().split(/\r?\n/).map(line=>line.split('=')));
    const sql=readFileSync('deploy/docker/permissions.sql','utf8').replace('DATABASE proyecto_villa_horizonte','DATABASE villa_horizonte');
    const grants=spawnSync(resolve(pg,'psql.exe'),['-h','127.0.0.1','-p',config.port,'-U',config.user,'-d',config.database,'-v','ON_ERROR_STOP=1','-v','app_password='+config.password],{env:{...env,PGPASSWORD:config.password},input:sql,encoding:'utf8',windowsHide:true,timeout:10000});
    assert.equal(grants.status,0,grants.stderr);
    const secret=resolve(runtime,'app-secret');writeFileSync(secret,config.password);
    managed=spawn('C:/xampp/php/php.exe',['-d','extension=pdo_pgsql','-d','display_errors=0','-S','127.0.0.1:'+managedPort,'-t','frontend','backend/router.php'],{env:{...env,DB_HOST:'127.0.0.1',DB_PORT:config.port,DB_NAME:config.database,DB_USER:'villa_app',DB_PASSWORD_FILE:secret},windowsHide:true,stdio:'ignore'});
    for(let i=0;i<100;i++){
      try{if((await fetch(managedBase+'/api/health')).ok)break;}catch{}
      await new Promise(r=>setTimeout(r,100));
    }
    const smoke=spawnSync(process.execPath,['tests/docker-api-smoke.mjs'],{env:{...env,VILLA_BASE_URL:managedBase,VILLA_TEST_MUTATIONS:'1',VILLA_EXPECT_EMPTY:seeded?'0':'1'},windowsHide:true,encoding:'utf8',timeout:20000});
    assert.equal(smoke.status,0,smoke.stdout+smoke.stderr);
    const data=(await (await fetch(managedBase+'/api/state')).json()).data;
    assert.equal(data.lote.length,seeded?9:1);
    assert.equal(data.nota_venta.length,seeded?5:1);
    assert.equal(data.cliente.length,seeded?5:1);
    if(seeded)assert.ok(data.nota_venta.some(x=>x.serie_numero==='NV01-000126'));
    const command=async(operation,args)=>{
      const response=await fetch(managedBase+'/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,args})});
      assert.equal(response.status,200,await response.clone().text());return response.json();
    };
    if(seeded) {
    const released=await command('changeReservation',[6,'release']);
    assert.equal(released.data.lote.find(x=>x.id_lote===6).estado,'Disponible');
    assert.equal(released.data.nota_venta.length,5);
    await command('changeReservation',[2,'complete']);
    }
    const privileges=spawnSync(resolve(pg,'psql.exe'),['-h','127.0.0.1','-p',config.port,'-U','villa_app','-d',config.database,'-tAc',"SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname=current_user"],{env:{...env,PGPASSWORD:config.password},windowsHide:true,encoding:'utf8',timeout:10000});
    assert.equal(privileges.stdout.trim(),'f');
    if(process.env.BROWSER_TEST==='1') {
      const browser=spawnSync(process.execPath,['tests/docker-browser.mjs'],{env:{...env,VILLA_BASE_URL:managedBase},windowsHide:true,encoding:'utf8',timeout:45000});
      assert.equal(browser.status,0,browser.stdout+browser.stderr);
    }
  }finally{
    stopServer(managed);
    spawnSync(resolve(pg,'pg_ctl.exe'),['-D',resolve(runtime,'postgres'),'-m','fast','-w','stop'],{windowsHide:true,timeout:10000,stdio:'ignore'});
    stopServer(server);
  }
});

}
