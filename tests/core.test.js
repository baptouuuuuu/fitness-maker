import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exercises } from '../exercises.js';
import { generateSession, recommend, validateItem, makeTimeline, locatePhase, formatTime } from '../core.js';

test('catalogue complet, identifiants uniques et consignes françaises', () => {
  assert.equal(exercises.length, 1324);
  assert.equal(new Set(exercises.map(e => e.id)).size, exercises.length);
  assert.ok(exercises.every(e => e.steps.length && e.mediaUrl.startsWith('https://github.com/hasaneyldrm/exercises-dataset/blob/')));
});
test('chronologie : séries, repos intermédiaires et aucun repos final', () => {
  const items = [{exerciseId:'a',sets:2,work:10,rest:5},{exerciseId:'b',sets:1,work:20,rest:0}];
  assert.deepEqual(makeTimeline(items).map(p => [p.type,p.duration]), [['work',10],['rest',5],['work',10],['rest',5],['work',20]]);
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
  assert.ok(generateSession(exercises, 5, ['squat']).every(item => /squat/i.test(exercises.find(e => e.id === item.exerciseId).name)));
  assert.throws(() => generateSession(exercises, 4, ['abdos']), /durée/);
  assert.throws(() => generateSession(exercises, 5.5, ['abdos']), /durée/);
  assert.throws(() => generateSession(exercises, 5, []), /mot-clé/);
  assert.throws(() => generateSession(exercises, 5, ['abdos', 'introuvablexyz']), /introuvablexyz/);
});
