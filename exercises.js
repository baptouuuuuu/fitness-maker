import data from './repdb-data.js';
import { legacyExercises } from './legacy-exercises.js';

const categories = {back:'Dos',chest:'Pectoraux',core:'Abdominaux',full_body:'Corps entier',lower_arms:'Avant-bras',lower_legs:'Mollets',shoulders:'Épaules',upper_arms:'Bras',upper_legs:'Jambes'};
const muscles = {abductors:'Abducteurs',adductors:'Adducteurs',anterior_deltoid:'Épaules',biceps_brachii:'Biceps',brachialis:'Bras',brachioradialis:'Avant-bras',erector_spinae:'Dos',forearm_extensors:'Avant-bras',forearm_flexors:'Avant-bras',gastrocnemius:'Mollets',gluteus_maximus:'Fessiers',gluteus_medius:'Fessiers',hamstrings:'Ischio-jambiers',hip_flexors:'Fléchisseurs de hanche',infraspinatus_teres_minor:'Épaules',lateral_deltoid:'Épaules',latissimus_dorsi:'Grand dorsal',obliques:'Abdominaux',pectoralis_major:'Pectoraux',posterior_deltoid:'Épaules',quadratus_lumborum:'Dos',quadriceps:'Quadriceps',rectus_abdominis:'Abdominaux',rhomboids:'Haut du dos',soleus:'Mollets',tibialis_anterior:'Jambes',transverse_abdominis:'Abdominaux',trapezius:'Trapèzes',triceps_brachii:'Triceps'};
const equipmentNames = {barbell:'Barre',dumbbell:'Haltères',kettlebell:'Kettlebell',cable:'Poulie',pull_up_bar:'Barre de traction',resistance_band:'Élastique',loop_band:'Élastique',bodyweight:'Poids du corps',rings:'Anneaux',smith_machine:'Machine Smith',ez_bar:'Barre EZ'};
const weighted = new Set(['barbell','dumbbell','kettlebell','ez_bar','trap_bar','plates','medicine_ball','sandbag']);
const imageBase = 'https://raw.githubusercontent.com/RepDB/exercise-dataset/f12da458a90f353a86c953f204304d5a8bd98275/';

export const exercises = data.map(e => ({
  id:`repdb:${e.id}`, name:e.name, category:e.category === 'cardio' ? 'Cardio' : categories[e.bodyPart] || e.bodyPart,
  equipment:!e.equipment ? 'Sans poids' : weighted.has(e.equipment) ? 'Avec poids' : 'Autre matériel',
  equipmentDetail:equipmentNames[e.equipment] || (e.equipment ? e.equipment.replaceAll('_',' ') : 'Poids du corps'),
  muscles:[...new Set(e.muscles.map(m => muscles[m] || m))],
  movement:e.muscles[0], steps:e.steps, images:[e.images.main, e.images.start, e.images.peak].filter(Boolean).map(path => imageBase + path)
}));

const catalogById = new Map([...legacyExercises, ...exercises].map(exercise => [exercise.id, exercise]));
export const exerciseById = id => catalogById.get(id);
