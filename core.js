export const STORAGE_KEY = 'fitness-maker-v1';

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
