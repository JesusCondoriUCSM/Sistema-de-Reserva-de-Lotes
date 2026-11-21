import assert from 'node:assert/strict';

export async function usageFlows({evaluate,wait,lotId,expectedNote}) {
  await evaluate("document.querySelector('#edit-note').click()");
  await evaluate("document.querySelector('#modal [name=forma_pago]').value='Transferencia';document.querySelector('#modal [name=descripcion]').value='Separacion revisada';document.querySelector('#modal form').requestSubmit()");
  await wait("!document.querySelector('#modal').open && document.querySelector('main').innerText.includes('Separacion revisada')");

  await evaluate("location.hash='/clientes/12345678'");
  await wait("!!document.querySelector('#edit-client')");
  await evaluate("document.querySelector('#edit-client').click()");
  assert.equal(await evaluate("document.querySelector('#modal [name=dni_cliente]').readOnly"),true);
  await evaluate("document.querySelector('#modal [name=direccion]').value='Direccion actualizada';document.querySelector('#modal form').requestSubmit()");
  await wait("!document.querySelector('#modal').open && document.querySelector('main').innerText.includes('Direccion actualizada')");
  await evaluate("document.querySelector('#add-phone').click()");
  await evaluate("document.querySelector('#modal [name=telefono]').value='000000007';document.querySelector('#modal form').requestSubmit()");
  await wait("!document.querySelector('#modal').open && !!document.querySelector('[data-phone-edit=\"000000007\"]')");
  await evaluate("document.querySelector('[data-phone-edit=\"000000007\"]').click()");
  await evaluate("document.querySelector('#modal [name=telefono]').value='000000008';document.querySelector('#modal form').requestSubmit()");
  await wait("!document.querySelector('#modal').open && !!document.querySelector('[data-phone-delete=\"000000008\"]')");
  await evaluate("document.querySelector('[data-phone-delete=\"000000008\"]').click();document.querySelector('#modal form').requestSubmit()");
  await wait("!document.querySelector('#modal').open && !document.querySelector('[data-phone-delete=\"000000008\"]')");

  await evaluate("location.hash='/clientes'");
  await wait("!!document.querySelector('#search-form')");
  await evaluate("document.querySelector('[name=search]').value='12345678';document.querySelector('#search-form').requestSubmit()");
  await evaluate("document.querySelector('[data-delete=\"12345678\"]').click();document.querySelector('#modal form').requestSubmit()");
  await wait("document.querySelector('#modal-error')?.textContent.includes('notas')");
  await evaluate("document.querySelector('#modal [data-close]').click()");
  assert.equal(await evaluate("!!document.querySelector('[data-detail=\"12345678\"]')"),true);

  const dni=String(Date.now()%100000000).padStart(8,'0');
  await evaluate("document.querySelector('#new-record').click()");
  await evaluate(`document.querySelector('#modal [name=dni_cliente]').value=${JSON.stringify(dni)};document.querySelector('#modal [name=nombres]').value='Cliente temporal';document.querySelector('#modal [name=apellidos]').value='Prueba';document.querySelector('#modal [name=direccion]').value='Direccion de prueba';document.querySelector('#modal form').requestSubmit()`);
  await wait("!document.querySelector('#modal').open");
  await evaluate(`document.querySelector('[name=search]').value=${JSON.stringify(dni)};document.querySelector('#search-form').requestSubmit()`);
  assert.equal(await evaluate(`!!document.querySelector('[data-edit="${dni}"]')`),true);
  await evaluate(`document.querySelector('[data-edit="${dni}"]').click()`);
  await evaluate("document.querySelector('#modal [name=nombres]').value='Cliente editado';document.querySelector('#modal form').requestSubmit()");
  await wait("!document.querySelector('#modal').open && document.querySelector('main').innerText.includes('Cliente editado')");
  await evaluate(`document.querySelector('[data-delete="${dni}"]').click();document.querySelector('#modal form').requestSubmit()`);
  await wait(`!document.querySelector('#modal').open && !document.querySelector('[data-detail="${dni}"]')`);

  await evaluate("location.hash='/reportes'");
  await wait("!!document.querySelector('[name=report]')");
  for(let report=1;report<=10;report++) {
    await evaluate(`document.querySelector('[name=report]').value='${report}';document.querySelector('[name=report]').dispatchEvent(new Event('change',{bubbles:true}))`);
    await evaluate(`{
      const form=document.querySelector('#report-filters');
      for(const name of ['lot','client','advisor','project','block']) {
        const select=form.elements[name];
        if(select && select.required) select.value=[...select.options].find(o=>o.value)?.value || '';
      }
      if(form.elements.lot)form.elements.lot.value='${lotId}';
      if(form.elements.client)form.elements.client.value='12345678';
      if(form.elements.advisor)form.elements.advisor.value='87654321';
      if(form.elements.from)form.elements.from.value='2020-01-01';
      if(form.elements.to)form.elements.to.value='2099-12-31';
      form.requestSubmit();
    }`);
    await wait("!!document.querySelector('#report-results .card')");
    assert.equal(await evaluate("!!document.querySelector('#report-results table') || document.querySelector('#report-results').innerText.includes('No se encontraron registros')"),true,`Reporte ${report}`);
  }

  await evaluate("location.hash='/separaciones'");
  await wait(`!!document.querySelector('[data-complete="${lotId}"]')`);
  await evaluate(`document.querySelector('[data-complete="${lotId}"]').click();document.querySelector('#modal form').requestSubmit()`);
  await wait(`!document.querySelector('#modal').open && !document.querySelector('[data-complete="${lotId}"]')`);
  await evaluate(`location.hash='/lotes/${lotId}'`);
  await wait("document.querySelector('h1')?.textContent==='Detalle de lote'");
  assert.equal(await evaluate("document.querySelector('main').innerText.includes('Vendido')"),true);
  assert.equal(await evaluate(`document.querySelector('main').innerText.includes(${JSON.stringify(expectedNote)})`),true);
}
