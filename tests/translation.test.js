import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translateInstructions } from '../translation.js';

test('traduit les étapes dans l’ordre et libère le traducteur', async () => {
  let destroyed = false;
  const api = {
    availability: async options => {
      assert.deepEqual(options, {sourceLanguage:'en', targetLanguage:'fr'});
      return 'available';
    },
    create: async () => ({
      translate: async text => ({'Step one':'Première étape', 'Step two':'Deuxième étape'})[text],
      destroy: () => { destroyed = true; }
    })
  };
  assert.deepEqual(await translateInstructions(['Step one', 'Step two'], api), ['Première étape', 'Deuxième étape']);
  assert.equal(destroyed, true);
});

test('signale une traduction indisponible ou incomplète', async () => {
  await assert.rejects(translateInstructions(['Step'], {availability: async () => 'unavailable'}), /indisponible/);
  let destroyed = false;
  const api = {
    availability: async () => 'available',
    create: async () => ({translate: async () => '', destroy: () => { destroyed = true; }})
  };
  await assert.rejects(translateInstructions(['Step'], api), /vide/);
  assert.equal(destroyed, true);
});
