import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY } from '../core.js';

test('la séance en cours reste indépendante du brouillon', async t => {
  const handlers = {};
  const app = {
    innerHTML:'',
    addEventListener(type, handler) { handlers[type] = handler; }
  };
  const saved = {
    sound:false,
    draft:{id:null, name:'Brouillon', items:[{exerciseId:'repdb:muscle-ups', sets:3, work:30, rest:10}]},
    runner:{items:[{exerciseId:'0001', sets:2, work:20, rest:10}], elapsed:15}
  };
  let stored = JSON.stringify(saved);
  const globals = {
    document:{querySelector:() => app, addEventListener() {}},
    window:{scrollTo() {}, addEventListener() {}},
    localStorage:{getItem:key => key === STORAGE_KEY ? stored : null, setItem(key, value) { if (key === STORAGE_KEY) stored = value; }},
    confirm:() => true,
    setInterval:() => 1,
    clearInterval:() => {}
  };
  for (const [key,value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {value, configurable:true, writable:true});
    t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  await import('../app.js');
  const click = dataset => handlers.click({target:{closest:() => ({dataset})}});
  click({page:'session'});
  assert.match(app.innerHTML, /00:35<\/strong> temps restant/);
  assert.match(app.innerHTML, /00:50<\/strong> temps total/);
  assert.match(app.innerHTML, /01:50<\/strong> temps total/);
  assert.match(app.innerHTML, /3<\/strong> séries/);

  click({action:'restart-runner'});
  let state = JSON.parse(stored);
  assert.equal(state.runner.items[0].exerciseId, '0001');
  assert.ok(state.runner.elapsed < 1);
  assert.equal(state.draft.items[0].exerciseId, 'repdb:muscle-ups');

  click({action:'leave-runner'});
  click({action:'delete-runner'});
  state = JSON.parse(stored);
  assert.equal(state.runner, null);
  assert.equal(state.draft.items[0].exerciseId, 'repdb:muscle-ups');
  assert.doesNotMatch(app.innerHTML, /Une séance en cours/);
});
