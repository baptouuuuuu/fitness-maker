import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exercises, exerciseById, EQUIPMENT_GROUPS } from '../exercises.js';
import data from '../repdb-data.js';
import { matchesExercise, generateSession, recommend, validateItem, exportSession, importSession, makeTimeline, locatePhase, formatTime } from '../core.js';

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
  const session = {id:'local',name:'Séance',items:[{exerciseId:'0001',sets:2,work:30,rest:10},{exerciseId:'repdb:muscle-ups',sets:1,reps:12,work:45,rest:0}]};
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
  assert.ok(validateItem({...item,reps:0}));
  assert.ok(!validateItem({...item,reps:-1}));
  assert.ok(!validateItem({...item,reps:1000}));
});
test('recommandation exclut les exercices déjà choisis et favorise la variété', () => {
  const catalog = [{id:'a',name:'A',muscles:['dos'],category:'haut',movement:'tirage'},{id:'b',name:'B',muscles:['dos'],category:'haut',movement:'tirage'},{id:'c',name:'C',muscles:['jambes'],category:'bas',movement:'squat'}];
  assert.deepEqual(recommend(catalog,[{exerciseId:'a'}]).map(x => x.exercise.id),['c','b']);
});
test('recherche française et anglaise, accents et matériel', () => {
  const search = term => exercises.filter(exercise => matchesExercise(exercise, {search:term}));
  assert.ok(search('pompes').some(exercise => /push.up/i.test(exercise.name)));
  assert.ok(search('développé couché').some(exercise => /bench press/i.test(exercise.name)));
  assert.ok(search('tractions').some(exercise => /pull.up/i.test(exercise.name)));
  assert.ok(search('push up').some(exercise => /push.up/i.test(exercise.name)));
  assert.ok(search('epaules').length);
  assert.ok(exercises.filter(exercise => matchesExercise(exercise, {equipment:'Sans matériel'})).every(exercise => exercise.equipmentGroups.includes('none')));
  assert.ok(exercises.filter(exercise => matchesExercise(exercise, {equipment:'Sans poids'})).every(exercise => exercise.equipment !== 'Avec poids'));
});
test('filtres de matériel multiples : union des choix et intersection avec la partie du corps', () => {
  const filters = {category:'Dos', equipmentGroups:['none','pull_up_bar']};
  const matches = exercises.filter(exercise => matchesExercise(exercise, filters));
  assert.ok(matches.some(exercise => exercise.equipmentGroups.includes('none')));
  assert.ok(matches.some(exercise => exercise.equipmentGroups.includes('pull_up_bar')));
  assert.ok(matches.every(exercise => exercise.category === 'Dos' && exercise.equipmentGroups.some(group => filters.equipmentGroups.includes(group))));
  assert.ok(exerciseById('repdb:pull-up').equipmentGroups.includes('pull_up_bar'));
  assert.ok(exerciseById('repdb:barbell-box-squat').equipmentGroups.includes('barbell'));
});
test('matériels distincts, étiquettes multiples et couverture du catalogue', () => {
  const groups = new Set(EQUIPMENT_GROUPS.map(([id]) => id));
  assert.equal(groups.size, EQUIPMENT_GROUPS.length);
  for (const entry of data) {
    const exercise = exerciseById(`repdb:${entry.id}`);
    assert.ok(exercise.equipmentGroups.length, entry.id);
    assert.ok(exercise.equipmentGroups.every(group => groups.has(group)), entry.id);
    if (entry.equipment) assert.ok(exercise.equipmentGroups.includes(entry.equipment), entry.id);
  }
  const filter = (id, group) => matchesExercise(exerciseById(`repdb:${id}`), {equipmentGroups:[group]});
  assert.ok(filter('db-bench-press', 'dumbbell'));
  assert.ok(!filter('db-bench-press', 'kettlebell'));
  assert.ok(filter('db-bench-press', 'flat_bench'));
  assert.ok(filter('kettlebell-swing', 'kettlebell'));
  assert.ok(!filter('kettlebell-swing', 'dumbbell'));
  assert.ok(filter('plank', 'mat'));
  assert.ok(!filter('kettlebell-swing', 'mat'));
  assert.ok(filter('captains-chair-leg-raise', 'captains_chair'));
  assert.ok(!filter('captains-chair-leg-raise', 'none'));
  assert.ok(filter('handstand-push-ups', 'parallettes'));
  assert.ok(filter('wall-sit', 'wall'));
});
test('étirements et mobilité : inclusion, exclusion et sélection seule', () => {
  const stretch = exerciseById('repdb:childs-pose');
  const mobility = exerciseById('repdb:warrior-one');
  const strength = exerciseById('repdb:push-up');
  assert.ok(stretch.mobility);
  assert.ok(mobility.mobility);
  assert.ok(!strength.mobility);
  assert.ok(matchesExercise(stretch));
  assert.ok(!matchesExercise(stretch, {mobility:'exclude'}));
  assert.ok(matchesExercise(strength, {mobility:'exclude'}));
  assert.ok(matchesExercise(mobility, {mobility:'only'}));
  assert.ok(!matchesExercise(strength, {mobility:'only'}));
  assert.ok(matchesExercise(stretch, {search:'mobilité'}));
  assert.ok(generateSession(exercises, 5, {mobility:'only'}).every(item => exerciseById(item.exerciseId).mobility));
  assert.ok(generateSession(exercises, 5, {mobility:'exclude'}).every(item => !exerciseById(item.exerciseId).mobility));
});
test('générateur : filtres, durée exacte avec repos et paramètres valides', () => {
  const filters = {category:'Dos', equipmentGroups:['none','pull_up_bar']};
  for (const minutes of [5, 20, 120]) {
    const items = generateSession(exercises, minutes, filters);
    assert.ok(items.every(validateItem));
    assert.ok(items.every(item => !('reps' in item)));
    assert.equal(makeTimeline(items).reduce((sum, phase) => sum + phase.duration, 0), minutes * 60);
    const selected = items.map(item => exercises.find(exercise => exercise.id === item.exerciseId));
    assert.ok(selected.every(exercise => matchesExercise(exercise, filters)));
  }
});
test('générateur : recherche libre, filtres facultatifs et erreurs explicites', () => {
  assert.ok(generateSession(exercises, 5).length);
  assert.ok(generateSession(exercises, 5, {search:'pompes'}).every(item => /push.up/i.test(exercises.find(e => e.id === item.exerciseId).name)));
  assert.throws(() => generateSession(exercises, 4), /durée/);
  assert.throws(() => generateSession(exercises, 5.5), /durée/);
  assert.throws(() => generateSession(exercises, 5, {search:'introuvablexyz'}), /Aucun exercice/);
});
