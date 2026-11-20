import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exercises, exerciseById } from '../exercises.js';
import data from '../repdb-data.js';
import { GENERATOR_KEYWORDS, generateSession, recommend, validateItem, exportSession, importSession, makeTimeline, locatePhase, formatTime } from '../core.js';

test('catalogue RepDB complet et séances précédentes conservées', () => {
  assert.equal(exercises.length, 708);
  assert.equal(new Set(exercises.map(e => e.id)).size, exercises.length);
  assert.ok(exercises.every(e => e.steps.length && e.images.length && e.images.every(url => url.startsWith('https://raw.githubusercontent.com/RepDB/exercise-dataset/f12da458a90f353a86c953f204304d5a8bd98275/images/flat/'))));
  assert.equal(exerciseById('0001').name, '3/4 sit-up');
  assert.equal(exerciseById('repdb:muscle-ups').name, 'Muscle Ups');
});
test('images du catalogue : positions de départ et de fin dans le bon ordre', () => {
  for (const entry of data) {
    const images = exerciseById(`repdb:${entry.id}`).images;
    const expected = [...new Set([entry.images.start, entry.images.peak, entry.images.main].filter(Boolean))];
    assert.deepEqual(images.map(url => new URL(url).pathname.split('/').slice(-2).join('/')), expected.map(path => path.replace('images/', '')));
  }
});
test('chronologie : séries, repos intermédiaires et aucun repos final', () => {
  const items = [{exerciseId:'a',sets:2,work:10,rest:5},{exerciseId:'b',sets:1,work:20,rest:0}];
  assert.deepEqual(makeTimeline(items).map(p => [p.type,p.duration]), [['work',10],['rest',5],['work',10],['rest',5],['work',20]]);
});
test('chronologie distingue les occurrences répétées du même exercice', () => {
  const items = [{exerciseId:'a',sets:2,work:10,rest:5},{exerciseId:'a',sets:1,work:20,rest:0}];
  assert.deepEqual(makeTimeline(items).map(p => p.itemIndex), [0,0,0,0,1]);
});
test('export et import de séance conservent les paramètres sans identifiant local', () => {
  const session = {id:'local',name:'Séance',items:[{exerciseId:'0001',sets:2,work:30,rest:10},{exerciseId:'repdb:muscle-ups',sets:1,work:45,rest:0}]};
  const json = exportSession(session);
  assert.deepEqual(importSession(json, exerciseById), {name:session.name,items:session.items});
  assert.equal(JSON.parse(json).id, undefined);
});
test('import refuse les fichiers invalides et les exercices inconnus', () => {
  const valid = JSON.parse(exportSession({name:'Séance',items:[{exerciseId:'0001',sets:1,work:30,rest:0}]}));
  assert.throws(() => importSession('{', exerciseById), /JSON valide/);
  assert.throws(() => importSession(JSON.stringify({...valid,version:2}), exerciseById), /non pris en charge/);
  assert.throws(() => importSession(JSON.stringify({...valid,items:[]}), exerciseById), /invalide/);
  assert.throws(() => importSession(JSON.stringify({...valid,items:[{...valid.items[0],work:4}]}), exerciseById), /invalide/);
  assert.throws(() => importSession(JSON.stringify({...valid,items:[{...valid.items[0],exerciseId:'inconnu'}]}), exerciseById), /inconnus/);
});
test('chronomètre : limites de phase et dépassement après inactivité', () => {
  const timeline = makeTimeline([{exerciseId:'a',sets:2,work:10,rest:5}]);
  assert.deepEqual(locatePhase(timeline,10),{index:1,remaining:5});
  assert.deepEqual(locatePhase(timeline,27),{index:3,remaining:0});
  assert.equal(formatTime(60.2),'01:01');
});
test('validation des paramètres', () => {
  const item = {exerciseId:'a',sets:1,work:5,rest:0};
  assert.ok(validateItem(item));
  assert.ok(!validateItem({...item,work:4}));
  assert.ok(!validateItem({...item,sets:1.5}));
  assert.ok(!validateItem({...item,rest:301}));
});
test('recommandation exclut les exercices déjà choisis et favorise la variété', () => {
  const catalog = [{id:'a',name:'A',muscles:['dos'],category:'haut',movement:'tirage'},{id:'b',name:'B',muscles:['dos'],category:'haut',movement:'tirage'},{id:'c',name:'C',muscles:['jambes'],category:'bas',movement:'squat'}];
  assert.deepEqual(recommend(catalog,[{exerciseId:'a'}]).map(x => x.exercise.id),['c','b']);
});
test('générateur : mots-clés français, durée exacte avec repos et paramètres valides', () => {
  for (const minutes of [5, 20, 120]) {
    const items = generateSession(exercises, minutes, ['abdos', 'cuisse', 'muscle-up', 'tractions']);
    assert.ok(items.every(validateItem));
    assert.equal(makeTimeline(items).reduce((sum, phase) => sum + phase.duration, 0), minutes * 60);
    const selected = items.map(item => exercises.find(exercise => exercise.id === item.exerciseId));
    assert.ok(selected.some(e => e.muscles.includes('Abdominaux')));
    assert.ok(selected.some(e => e.muscles.includes('Quadriceps') || e.muscles.includes('Ischio-jambiers')));
    assert.ok(selected.some(e => /muscle[ -]up/i.test(e.name)));
    assert.ok(selected.some(e => /pull[ -]up|chin[ -]up/i.test(e.name)));
  }
});
test('générateur : termes libres et erreurs explicites', () => {
  for (const keyword of GENERATOR_KEYWORDS) assert.ok(generateSession(exercises, 5, [keyword]).length, keyword);
  assert.ok(generateSession(exercises, 5, ['squat']).every(item => /squat/i.test(exercises.find(e => e.id === item.exerciseId).name)));
  assert.throws(() => generateSession(exercises, 4, ['abdos']), /durée/);
  assert.throws(() => generateSession(exercises, 5.5, ['abdos']), /durée/);
  assert.throws(() => generateSession(exercises, 5, []), /mot-clé/);
  assert.throws(() => generateSession(exercises, 5, ['abdos', 'introuvablexyz']), /introuvablexyz/);
});
