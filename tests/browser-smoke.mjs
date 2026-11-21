import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

export async function browserSmoke(base, lotId, connection, expectedNote = 'NV01-000001') {
  mkdirSync(resolve('tmp'), {recursive:true});
  const profile = mkdtempSync(resolve('tmp/browser-'));
  const chrome = spawn(process.env.CHROME_BIN || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome'), ['--headless','--no-sandbox','--disable-gpu','--no-first-run','--remote-debugging-port=9227',`--user-data-dir=${profile}`,'about:blank'], {windowsHide:true,stdio:'ignore'});
  let socket;
  try {
    let pages;
    for(let i=0;i<100;i++) {
      try { pages = await (await fetch('http://127.0.0.1:9227/json/list')).json(); if(pages.length) break; } catch {}
      await new Promise(r=>setTimeout(r,100));
    }
    assert.ok(pages?.length,'Chrome no disponible');
    socket = new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
    await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
    let sequence=0;const pending=new Map();const errors=[];
    socket.onmessage = e => {const msg=JSON.parse(e.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p?.reject(new Error(msg.error.message)):p?.resolve(msg.result);} if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text);};
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>{const value=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(value.exceptionDetails)throw new Error(value.exceptionDetails.text);return value.result.value;};
    const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw new Error('No se cumplio: '+expression+'\n'+await evaluate('document.body.innerText'));};
    await send('Runtime.enable');
    if (connection) {
    // A native submission (without the JS handler) must show a readable error.
    await send('Page.navigate',{url:base+'/conexion.html'});
    await wait("document.querySelector('#connection-form')?.dataset.ready==='true'");
    await evaluate(`for(const [key,value] of Object.entries(${JSON.stringify({...connection,database:'bad;name'})})) document.querySelector('#connection-form').elements[key].value=value;HTMLFormElement.prototype.submit.call(document.querySelector('#connection-form'))`);
    await wait("document.querySelector('h1')?.textContent==='No se pudo conectar'");
    await evaluate("document.querySelector('a[href=\"/conexion.html\"]').click()");
    await wait("document.querySelector('#connection-form')?.dataset.ready==='true'");
    await evaluate(`for(const [key,value] of Object.entries(${JSON.stringify(connection)})) document.querySelector('#connection-form').elements[key].value=value;HTMLFormElement.prototype.submit.call(document.querySelector('#connection-form'))`);
    await wait("document.querySelector('h1')?.textContent === 'Inicio'");
    await send('Page.navigate',{url:base+'/conexion.html'});
    await wait("document.querySelector('#connection-form')?.dataset.ready==='true'");
    await evaluate(`for(const [key,value] of Object.entries(${JSON.stringify(connection)})) document.querySelector('#connection-form').elements[key].value=value;document.querySelector('#connection-form').requestSubmit()`);
    await wait("document.querySelector('h1')?.textContent === 'Inicio'");
    } else {
      await send('Page.navigate',{url:base+'/conexion.html'});
      await wait("document.querySelector('h1')?.textContent === 'Inicio'");
    }
    for(const route of ['proyectos','lotes','clientes','asesores','separaciones','reportes','catalogos']) {
      await evaluate(`location.hash='/${route}'`);
      await wait(`document.querySelector('[data-route="${route}"]')?.getAttribute('aria-current')==='page' && !!document.querySelector('h1') && !document.querySelector('.loading')`);
      assert.equal(await evaluate("document.body.innerText.includes('No se pudo abrir la pantalla')"),false,route);
    }
    await evaluate("document.querySelector('#new-catalog').click()");
    await evaluate(`document.querySelector('#modal [name=descripcion]').value='Ciudad interfaz ${Date.now().toString(36)}';document.querySelector('#modal form').requestSubmit()`);
    await wait("!document.querySelector('#modal').open && document.querySelector('main').innerText.includes('Ciudad interfaz')");
    await evaluate(`location.hash='/separaciones/nueva/${lotId}'`);
    await wait("!!document.querySelector('#reservation-form')");
    await evaluate("document.querySelector('[name=dni_cliente]').value='12345678';document.querySelector('#find-client').click();document.querySelector('[name=dni_asesor]').value='87654321';document.querySelector('[name=forma_pago]').value='Efectivo';document.querySelector('#reservation-form').requestSubmit()");
    await wait("document.querySelector('#modal').open");
    await evaluate("document.querySelector('#modal form').requestSubmit()");
    await wait("document.querySelector('h1')?.textContent==='Detalle de nota de venta'");
    assert.equal(await evaluate(`document.querySelector('main').innerText.includes(${JSON.stringify(expectedNote)})`),true);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await evaluate("location.hash='/inicio'");
    await wait("document.querySelector('h1')?.textContent==='Inicio'");
    await evaluate("document.querySelector('.mobile-toggle').click()");
    assert.equal(await evaluate("document.querySelector('#sidebar').classList.contains('open')"),true);
    const screenshot=await send('Page.captureScreenshot',{format:'png'});
    writeFileSync(resolve('tmp/mobile-smoke.png'),Buffer.from(screenshot.data,'base64'));
    assert.deepEqual(errors,[]);
  } finally {socket?.close();chrome.kill();}
}
