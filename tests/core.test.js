import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exercises } from '../exercises.js';
import { recommend, validateItem, makeTimeline, locatePhase, formatTime } from '../core.js';

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
