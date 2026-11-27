import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exercises, exerciseById, EQUIPMENT_GROUPS } from '../exercises.js';
import { EQUIPMENT_FILTERS, equipmentFilterFor } from '../equipment-audit.js';
import data from '../repdb-data.js';
import { BODY_PART_FILTERS, matchesExercise, generateSession, automaticReplacement, recommend, validateItem, exportSession, importSession, makeTimeline, locatePhase, formatTime } from '../core.js';

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
test('chrono libre : intervalles, repos final omis et export/import', () => {
  const timer = {exerciseId:null,sets:3,work:20,rest:10};
  assert.ok(validateItem(timer));
  assert.deepEqual(makeTimeline([timer]).map(p => [p.type,p.duration]), [['work',20],['rest',10],['work',20],['rest',10],['work',20]]);
  assert.deepEqual(makeTimeline([timer,{exerciseId:'0001',sets:1,work:30,rest:0}]).map(p => p.type), ['work','rest','work','rest','work','rest','work']);
  const session = {name:'Intervalles',items:[timer,{exerciseId:'0001',sets:1,work:30,rest:0}]};
  assert.deepEqual(importSession(exportSession(session), exerciseById), session);
  assert.ok(!validateItem({...timer,exerciseId:undefined}));
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
  const search = term => exercises.filter(exercise => matchesExercise(exercise, {search:term, equipmentGroups:EQUIPMENT_FILTERS.map(([id]) => id)}));
  assert.ok(search('pompes').some(exercise => /push.up/i.test(exercise.name)));
  assert.ok(search('développé couché').some(exercise => /bench press/i.test(exercise.name)));
  assert.ok(search('tractions').some(exercise => /pull.up/i.test(exercise.name)));
  assert.ok(search('push up').some(exercise => /push.up/i.test(exercise.name)));
  assert.ok(search('epaules').length);
});
test('matériel disponible : tous les équipements nécessaires et intersection avec la partie du corps', () => {
  const filters = {category:'Dos', equipmentGroups:['dumbbell','flat_bench']};
  const matches = exercises.filter(exercise => matchesExercise(exercise, filters));
  assert.ok(matches.some(exercise => exercise.equipmentGroups.includes('none')));
  assert.ok(matches.some(exercise => exercise.equipmentGroups.includes('dumbbell')));
  assert.ok(matches.every(exercise => exercise.category === 'Dos' && exercise.equipmentGroups.every(group => ['none','mat'].includes(group) || filters.equipmentGroups.includes(equipmentFilterFor(group)))));
  const benchPress = exerciseById('repdb:db-bench-press');
  assert.ok(!matchesExercise(benchPress, {equipmentGroups:['dumbbell']}));
  assert.ok(matchesExercise(benchPress, {equipmentGroups:['dumbbell','flat_bench']}));
});
test('matériels distincts, étiquettes multiples et couverture du catalogue', () => {
  const groups = new Set(EQUIPMENT_GROUPS.map(([id]) => id));
  const filterGroups = new Set(EQUIPMENT_FILTERS.map(([id]) => id));
  assert.equal(groups.size, EQUIPMENT_GROUPS.length);
  assert.deepEqual([...filterGroups], ['dumbbell','kettlebell','barbell','pull_up_dip_bar','flat_bench','mat','ball','band','machines']);
  for (const entry of data) {
    const exercise = exerciseById(`repdb:${entry.id}`);
    assert.ok(exercise.equipmentGroups.length, entry.id);
    assert.ok(exercise.equipmentGroups.every(group => groups.has(group)), entry.id);
    assert.ok(exercise.equipmentGroups.filter(group => group !== 'none').every(group => filterGroups.has(equipmentFilterFor(group))), entry.id);
    if (entry.equipment) assert.ok(exercise.equipmentGroups.includes(entry.equipment), entry.id);
  }
  const filter = (id, groups) => matchesExercise(exerciseById(`repdb:${id}`), {equipmentGroups:groups});
  assert.ok(filter('plank', []));
  assert.ok(filter('plank', ['mat']));
  assert.ok(!filter('kettlebell-swing', ['mat']));
  assert.ok(filter('kettlebell-swing', ['kettlebell']));
  assert.ok(!filter('captains-chair-leg-raise', []));
  assert.ok(filter('captains-chair-leg-raise', ['machines']));
  assert.ok(filter('handstand-push-ups', ['machines']));
  assert.ok(filter('wall-sit', ['machines']));
  assert.ok(filter('barbell-curl', ['barbell']));
  assert.ok(!filter('barbell-curl', ['pull_up_dip_bar']));
  assert.ok(filter('pull-up', ['pull_up_dip_bar']));
  assert.ok(!filter('pull-up', ['barbell']));
  assert.ok(filter('dips', ['pull_up_dip_bar']));
  assert.ok(!filter('dips', ['machines']));
  assert.ok(exercises.filter(exercise => matchesExercise(exercise)).every(exercise => exercise.equipmentGroups.every(group => ['none','mat'].includes(group))));
  assert.ok(exercises.filter(exercise => matchesExercise(exercise, {equipmentGroups:[]})).every(exercise => exercise.equipmentGroups.every(group => ['none','mat'].includes(group))));
});
test('types : renforcement, étirement et mobilité combinables', () => {
  const stretch = exerciseById('repdb:childs-pose');
  const mobility = exerciseById('repdb:warrior-one');
  const strength = exerciseById('repdb:push-up');
  assert.ok(stretch.mobility);
  assert.ok(mobility.mobility);
  assert.ok(!strength.mobility);
  assert.ok(matchesExercise(stretch, {types:['stretching']}));
  assert.ok(!matchesExercise(stretch, {types:['strength']}));
  assert.ok(matchesExercise(strength, {types:['strength']}));
  assert.ok(matchesExercise(mobility, {types:['mobility']}));
  assert.ok(!matchesExercise(strength, {types:['mobility']}));
  assert.ok(matchesExercise(strength, {types:['strength','mobility']}));
  assert.ok(matchesExercise(mobility, {types:['strength','mobility']}));
  assert.ok(matchesExercise(exerciseById('repdb:cat-cow'), {types:['stretching','mobility']}));
  assert.ok(matchesExercise(stretch, {search:'mobilité'}));
  assert.ok(generateSession(exercises, 5, {types:['mobility']}).every(item => exerciseById(item.exerciseId).types.includes('mobility')));
  assert.ok(generateSession(exercises, 5, {types:['strength']}).every(item => exerciseById(item.exerciseId).types.includes('strength')));
});
test('générateur : filtres, durée exacte avec repos et paramètres valides', () => {
  const filters = {category:'Dos', equipmentGroups:['machines']};
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
test('parties du corps combinées dans les filtres et la génération', () => {
  const filters = {categories:['Dos','Jambes'], equipmentGroups:['machines']};
  const selected = exercises.filter(exercise => matchesExercise(exercise, filters));
  assert.ok(selected.some(exercise => exercise.category === 'Dos'));
  assert.ok(selected.some(exercise => exercise.category === 'Jambes'));
  assert.ok(selected.every(exercise => filters.categories.includes(exercise.category)));
  assert.ok(generateSession(exercises, 20, filters).every(item => matchesExercise(exerciseById(item.exerciseId), filters)));
  assert.ok(matchesExercise(exerciseById('repdb:push-up'), {categories:[]}));
  assert.ok(!matchesExercise(exerciseById('repdb:push-up'), {categories:['Dos']}));
});
test('filtres dédiés aux parties du corps couvrent les zones demandées', () => {
  assert.deepEqual(BODY_PART_FILTERS.map(part => part.label), ['Dos','Abdos','Fessiers','Mollets','Cuisses','Bras','Épaules','Pecs']);
  for (const {id,label} of BODY_PART_FILTERS) {
    assert.ok(exercises.some(exercise => matchesExercise(exercise, {bodyParts:[id]})), `Aucun exercice trouvé pour ${label}`);
  }
  const glutes = exercises.filter(exercise => matchesExercise(exercise, {bodyParts:['glutes']}));
  assert.ok(glutes.every(exercise => exercise.muscles.includes('Fessiers')));
  const selected = exercises.filter(exercise => matchesExercise(exercise, {bodyParts:['glutes','calves']}));
  assert.ok(selected.some(exercise => exercise.muscles.includes('Fessiers')));
  assert.ok(selected.some(exercise => exercise.muscles.includes('Mollets')));
  assert.ok(selected.every(exercise => exercise.muscles.includes('Fessiers') || exercise.muscles.includes('Mollets')));
});
test('remplacement automatique respecte les filtres et exclut les exercices de la séance', () => {
  const filters = {search:'', bodyParts:['back'], types:['strength'], equipmentGroups:['machines']};
  const eligible = exercises.filter(exercise => matchesExercise(exercise, filters));
  assert.ok(eligible.length >= 3);
  const items = eligible.slice(0, 2).map(exercise => ({exerciseId:exercise.id, sets:2, work:30, rest:10}));
  for (let i = 0; i < 20; i++) {
    const replacement = automaticReplacement(exercises, items, 0, filters);
    assert.ok(matchesExercise(exerciseById(replacement), filters));
    assert.ok(items.every(item => item.exerciseId !== replacement));
  }
  assert.throws(() => automaticReplacement(eligible.slice(0, 2), items, 0, filters), /Aucun autre exercice/);
});
test('les filtres de génération survivent à un export et import, les anciens fichiers restent valides', () => {
  const filters = {search:'pompes', bodyParts:['back','thighs'], equipmentGroups:[], types:['strength']};
  const session = {name:'Séance', items:[{exerciseId:'0001', sets:1, work:30, rest:0}], generationFilters:filters};
  assert.deepEqual(importSession(exportSession(session), exerciseById), session);
  const malformed = JSON.parse(exportSession(session));
  malformed.generationFilters.bodyParts = ['unknown'];
  assert.throws(() => importSession(JSON.stringify(malformed), exerciseById), /invalide/);
  const legacySession = {...session,generationFilters:{search:'',categories:['Dos'],equipmentGroups:[],types:[]}};
  assert.deepEqual(importSession(exportSession(legacySession), exerciseById), legacySession);
});
