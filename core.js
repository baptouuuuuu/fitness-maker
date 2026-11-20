export const STORAGE_KEY = 'fitness-maker-v1';

const normalize = text => text.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const frenchNames = [
  [/\bpush[ -]?ups?\b/i, 'pompe pompes'], [/\b(pull[ -]?ups?|chin[ -]?ups?)\b/i, 'traction tractions'],
  [/\bsquats?\b/i, 'squat flexion jambes'], [/\blunges?\b/i, 'fente fentes'],
  [/\bdeadlifts?\b/i, 'souleve de terre'], [/\bbench press\b/i, 'developpe couche'],
  [/\b(shoulder|overhead) press\b/i, 'developpe epaules militaire'],
  [/\brows?\b/i, 'tirage rowing'], [/\bplanks?\b/i, 'planche gainage'],
  [/\bcrunch(es)?\b/i, 'abdos abdominaux crunch'], [/\b(sit[ -]?ups?)\b/i, 'abdos releve buste'],
  [/\b(glute bridge|hip thrust)\b/i, 'pont fessier releve bassin'],
  [/\bcalf raises?\b/i, 'extension mollets'], [/\b(dips?)\b/i, 'dips repulsions'],
  [/\b(burpees?)\b/i, 'burpee'], [/\b(curls?)\b/i, 'flexion curl'],
  [/\b(fly|flyes|flies)\b/i, 'ecarte'], [/\b(leg raises?)\b/i, 'releve jambes'],
  [/\b(jumping jacks?)\b/i, 'saut etoile'], [/\b(mountain climbers?)\b/i, 'grimpeur'],
  [/\b(stretch|stretching)\b/i, 'etirement'], [/\b(press)\b/i, 'developpe'],
  [/\b(dumbbell)\b/i, 'haltere halteres'], [/\b(barbell)\b/i, 'barre'],
  [/\b(biceps)\b/i, 'biceps'], [/\b(triceps)\b/i, 'triceps']
];

export function matchesExercise(exercise, {search = '', category = '', equipment = '', equipmentGroups = [], mobility = 'all'} = {}) {
  const aliases = frenchNames.filter(([pattern]) => pattern.test(exercise.name)).map(([, words]) => words).join(' ');
  const text = normalize(`${exercise.name} ${exercise.category} ${exercise.muscles.join(' ')} ${exercise.equipmentDetail} ${exercise.mobility ? 'étirements mobilité' : ''} ${aliases}`);
  const terms = normalize(search).split(' ').filter(Boolean);
  return terms.every(term => text.includes(term)) &&
    (!category || exercise.category === category) &&
    (mobility === 'all' || (mobility === 'only' ? exercise.mobility : !exercise.mobility)) &&
    (!equipment || (equipment === 'Sans poids' ? exercise.equipment !== 'Avec poids' : exercise.equipment === equipment)) &&
    (!equipmentGroups.length || equipmentGroups.some(group => exercise.equipmentGroups.includes(group)));
}

export function generateSession(exercises, minutes, filters = {}) {
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) throw new Error('Choisissez une durée entière entre 5 et 120 minutes.');
  const matches = exercises.filter(exercise => matchesExercise(exercise, filters));
  if (!matches.length) throw new Error('Aucun exercice ne correspond à ces filtres. Modifiez-les avant de générer la séance.');
  const items = [];
  let remaining = minutes - 1;
  const slots = Math.min(minutes, Math.ceil((minutes - 1) / 3) + 1);
  while (remaining > 0) {
    const sets = Math.min(3, remaining - (slots - items.length - 2));
    items.push({exerciseId:matches[items.length % matches.length].id, sets, work:40, rest:20});
    remaining -= sets;
  }
  items.push({exerciseId:matches[items.length % matches.length].id, sets:1, work:60, rest:20});
  return items;
}

export function recommend(exercises, session) {
  const selected = session.map(item => exercises.find(exercise => exercise.id === item.exerciseId)).filter(Boolean);
  const ids = new Set(selected.map(exercise => exercise.id));
  const muscleCounts = new Map();
  for (const exercise of selected) for (const muscle of exercise.muscles) muscleCounts.set(muscle, (muscleCounts.get(muscle) || 0) + 1);
  return exercises.filter(exercise => !ids.has(exercise.id)).map(exercise => {
    const newMuscles = exercise.muscles.filter(muscle => !muscleCounts.has(muscle)).length;
    const repeatedMovement = selected.some(item => item.movement === exercise.movement);
    const sameCategory = selected.some(item => item.category === exercise.category);
    const score = selected.length ? newMuscles * 3 + (sameCategory ? 1 : 2) - (repeatedMovement ? 4 : 0) : 0;
    return { exercise, score, reason: !selected.length ? 'Pour bien commencer' : repeatedMovement ? 'Variante d’un mouvement choisi' : newMuscles ? 'Complète les muscles travaillés' : 'Varie les mouvements' };
  }).sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, 'fr'));
}

export function validateItem(item) {
  return item && typeof item.exerciseId === 'string' && Number.isInteger(item.work) && item.work >= 5 && item.work <= 600 && Number.isInteger(item.rest) && item.rest >= 0 && item.rest <= 300 && Number.isInteger(item.sets) && item.sets >= 1 && item.sets <= 10 && (item.reps === undefined || (Number.isInteger(item.reps) && item.reps >= 0 && item.reps <= 999));
}

export function exportSession(session) {
  return JSON.stringify({format:'fitness-maker-session', version:1, name:session.name, items:session.items.map(({exerciseId, sets, reps, work, rest}) => ({exerciseId, sets, ...(reps === undefined ? {} : {reps}), work, rest}))}, null, 2);
}

export function importSession(text, exerciseById) {
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('Ce fichier ne contient pas de JSON valide.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.format !== 'fitness-maker-session' || data.version !== 1 ||
      typeof data.name !== 'string' || !data.name.trim() || data.name.length > 80 ||
      !Array.isArray(data.items) || !data.items.length || !data.items.every(validateItem)) {
    throw new Error('Format de séance invalide ou non pris en charge.');
  }
  if (!data.items.every(item => exerciseById(item.exerciseId))) throw new Error('Cette séance contient des exercices inconnus dans ce catalogue.');
  return {name:data.name.trim(), items:data.items.map(({exerciseId, sets, reps, work, rest}) => ({exerciseId, sets, ...(reps === undefined ? {} : {reps}), work, rest}))};
}

export function makeTimeline(items) {
  const timeline = [];
  items.forEach((item, index) => {
    for (let set = 1; set <= item.sets; set++) {
      timeline.push({ type:'work', exerciseId:item.exerciseId, itemIndex:index, duration:item.work, set, sets:item.sets });
      if (item.rest && (set < item.sets || index < items.length - 1)) timeline.push({ type:'rest', exerciseId:item.exerciseId, itemIndex:index, duration:item.rest, set, sets:item.sets });
    }
  });
  return timeline;
}

export function formatTime(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

// Derive the active phase from elapsed wall-clock time, even after a background tab is throttled.
export function locatePhase(timeline, elapsed) {
  let remaining = Math.max(0, elapsed);
  for (let index = 0; index < timeline.length; index++) {
    if (remaining < timeline[index].duration) return { index, remaining: timeline[index].duration - remaining };
    remaining -= timeline[index].duration;
  }
  return { index: timeline.length, remaining: 0 };
}
