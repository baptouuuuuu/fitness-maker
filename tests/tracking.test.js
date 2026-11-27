import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY } from '../core.js';

test('suivi : secondes, poids et graphiques à partir de zéro sans mélanger les anciennes répétitions', async t => {
  const handlers = {};
  const app = {innerHTML:'', addEventListener(type, handler) { handlers[type] = handler; }};
  let stored = JSON.stringify({
    sound:false,
    logs:[
      {id:'old',date:'2026-01-01',name:'Ancien',entries:[{exerciseId:'repdb:plank',sets:[{reps:8,weight:null}]}]},
      {id:'new',date:'2026-01-02',name:'Nouveau',entries:[{exerciseId:'repdb:plank',unit:'seconds',sets:[{seconds:30,weight:20},{seconds:15,weight:0}]}]}
    ]
  });
  const globals = {
    document:{querySelector:selector => selector === '#app' ? app : null, addEventListener() {}},
    window:{scrollTo() {}, addEventListener() {}},
    localStorage:{getItem:key => key === STORAGE_KEY ? stored : null, setItem(key, value) { if (key === STORAGE_KEY) stored = value; }},
    confirm:() => true
  };
  for (const [key,value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {value, configurable:true, writable:true});
    t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  await import('../app.js?tracking-test');
  const click = dataset => handlers.click({target:{closest:() => ({dataset})}});
  click({page:'tracking'});
  assert.match(app.innerHTML, /8 reps/);
  assert.match(app.innerHTML, /30 s × 20 kg/);
  click({action:'chart',id:'repdb:plank',unit:'seconds'});
  assert.match(app.innerHTML, /Secondes totales/);
  assert.match(app.innerHTML, /2026 : 45/);
  assert.doesNotMatch(app.innerHTML, /2026 : 8/);
  assert.match(app.innerHTML, /x="42" y="208"[^>]*>0<\/text>/);
  assert.match(app.innerHTML, /x="478" y="208"[^>]*>0<\/text>/);
  click({action:'chart-unit',id:'reps'});
  assert.match(app.innerHTML, /Reps totales/);
  assert.match(app.innerHTML, /2026 : 8/);
  assert.doesNotMatch(app.innerHTML, /2026 : 45/);

  click({action:'close-chart'});
  click({action:'log-edit-entry',id:'new',entryIndex:'0'});
  assert.match(app.innerHTML, /placeholder="Secondes"/);
  handlers.submit({target:{id:'log-form'}, preventDefault() {}});
  const log = JSON.parse(stored).logs.find(item => item.id === 'new');
  assert.deepEqual(log.entries[0], {exerciseId:'repdb:plank',unit:'seconds',sets:[{seconds:30,weight:20},{seconds:15,weight:0}]});
});
