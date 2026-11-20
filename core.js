export const STORAGE_KEY = 'fitness-maker-v1';

export const GENERATOR_KEYWORDS = ['Abdos', 'Cuisses', 'Fessiers', 'Dos', 'Pectoraux', 'Bras', 'Épaules', 'Cardio', 'Tractions', 'Muscle-up'];

const keywordAliases = {
  abdos:['abdominaux'], abdominaux:['abdominaux'], cuisse:['quadriceps', 'ischio jambiers', 'adducteurs'],
  cuisses:['quadriceps', 'ischio jambiers', 'adducteurs'], fessiers:['fessiers'], dos:['dos', 'grand dorsal'],
  pectoraux:['pectoraux'], bras:['bras', 'biceps', 'triceps'], epaules:['epaules'], cardio:['cardio'],
  traction:['pull up', 'chin up'], tractions:['pull up', 'chin up'], 'muscle up':['muscle up']
};
const normalize = text => text.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function generateSession(exercises, minutes, keywords) {
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) throw new Error('Choisissez une durée entière entre 5 et 120 minutes.');
  const terms = [...new Set(keywords.map(normalize).filter(Boolean))];
  if (!terms.length) throw new Error('Choisissez ou saisissez au moins un mot-clé.');
  const groups = terms.map(term => {
    const aliases = keywordAliases[term] || [term];
    return exercises.filter(exercise => {
      const text = normalize(`${exercise.name} ${exercise.category} ${exercise.muscles.join(' ')} ${exercise.equipmentDetail}`);
      return aliases.some(alias => text.includes(alias));
    }).sort((a, b) => {
      const priority = exercise => (aliases.includes(normalize(exercise.name)) ? -4 : 0) +
        (/\bstretch\b/i.test(exercise.name) ? 2 : 0) + (exercise.equipment === 'Sans poids' ? 0 : 1);
      return priority(a) - priority(b) || a.name.localeCompare(b.name, 'fr');
    });
  });
  const missing = terms.filter((_, index) => !groups[index].length);
  if (missing.length) throw new Error(`Aucun exercice trouvé pour : ${missing.join(', ')}.`);
  if (terms.length > minutes) throw new Error('Choisissez au plus un mot-clé par minute.');
  const matches = [];
  const seen = new Set();
  for (let i = 0; groups.some(group => i < group.length); i++) {
    for (const group of groups) {
      const exercise = group[i];
      if (exercise && !seen.has(exercise.id)) { seen.add(exercise.id); matches.push(exercise); }
    }
  }
  const items = [];
  let remaining = minutes - 1;
  const slots = Math.min(minutes, Math.max(terms.length, Math.ceil((minutes - 1) / 3) + 1));
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
  return item && typeof item.exerciseId === 'string' && Number.isInteger(item.work) && item.work >= 5 && item.work <= 600 && Number.isInteger(item.rest) && item.rest >= 0 && item.rest <= 300 && Number.isInteger(item.sets) && item.sets >= 1 && item.sets <= 10;
}

export function makeTimeline(items) {
  const timeline = [];
  items.forEach((item, index) => {
    for (let set = 1; set <= item.sets; set++) {
      timeline.push({ type:'work', exerciseId:item.exerciseId, duration:item.work, set, sets:item.sets });
      if (item.rest && (set < item.sets || index < items.length - 1)) timeline.push({ type:'rest', exerciseId:item.exerciseId, duration:item.rest, set, sets:item.sets });
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
