import data from './repdb-data.js';
import { legacyExercises } from './legacy-exercises.js';
import { EQUIPMENT_GROUPS, equipmentGroupsFor } from './equipment-audit.js';

export { EQUIPMENT_GROUPS };

const categories = {back:'Dos',chest:'Pectoraux',core:'Abdominaux',full_body:'Corps entier',lower_arms:'Avant-bras',lower_legs:'Mollets',shoulders:'Épaules',upper_arms:'Bras',upper_legs:'Jambes'};
const muscles = {abductors:'Abducteurs',adductors:'Adducteurs',anterior_deltoid:'Épaules',biceps_brachii:'Biceps',brachialis:'Bras',brachioradialis:'Avant-bras',erector_spinae:'Dos',forearm_extensors:'Avant-bras',forearm_flexors:'Avant-bras',gastrocnemius:'Mollets',gluteus_maximus:'Fessiers',gluteus_medius:'Fessiers',hamstrings:'Ischio-jambiers',hip_flexors:'Fléchisseurs de hanche',infraspinatus_teres_minor:'Épaules',lateral_deltoid:'Épaules',latissimus_dorsi:'Grand dorsal',obliques:'Abdominaux',pectoralis_major:'Pectoraux',posterior_deltoid:'Épaules',quadratus_lumborum:'Dos',quadriceps:'Quadriceps',rectus_abdominis:'Abdominaux',rhomboids:'Haut du dos',soleus:'Mollets',tibialis_anterior:'Jambes',transverse_abdominis:'Abdominaux',trapezius:'Trapèzes',triceps_brachii:'Triceps'};
const equipmentNames = new Map(EQUIPMENT_GROUPS);
const weighted = new Set(['barbell','dumbbell','kettlebell','ez_bar','trap_bar','plates','medicine_ball','sandbag']);
const mobilityExercises = new Set(['bow-pose','dancer-pose','extended-side-angle','downward-dog-to-upward-dog','three-legged-dog','warrior-one','warrior-two']);
const dynamicMobilityExercises = new Set(['90-90-switch','cat-cow','downward-dog-pedal','downward-dog-to-low-lunge','half-kneeling-hip-flexor-rock','lateral-leg-swing','leg-swing-front-to-back','low-lunge-to-half-split','pilates-roll-down','pilates-saw','pilates-spine-twist','standing-forward-fold-to-half-lift','standing-side-bend-flow','thread-the-needle-flow','torso-twists','worlds-greatest-stretch']);
const imageBase = 'https://raw.githubusercontent.com/RepDB/exercise-dataset/f12da458a90f353a86c953f204304d5a8bd98275/';

export const exercises = data.map(e => {
  const equipmentGroups = equipmentGroupsFor(e);
  return {
  id:`repdb:${e.id}`, name:e.name, category:e.category === 'cardio' ? 'Cardio' : categories[e.bodyPart] || e.bodyPart,
  equipment:equipmentGroups.includes('none') ? 'Sans matériel' : weighted.has(e.equipment) ? 'Avec poids' : 'Autre matériel',
  equipmentGroups,
  equipmentDetail:equipmentGroups.map(group => equipmentNames.get(group)).join(' · '),
  muscles:[...new Set(e.muscles.map(m => muscles[m] || m))],
  types:[...(e.category === 'stretching' ? ['stretching'] : []), ...(mobilityExercises.has(e.id) || dynamicMobilityExercises.has(e.id) ? ['mobility'] : []), ...(!mobilityExercises.has(e.id) && ['strength','plyometrics','olympic'].includes(e.category) ? ['strength'] : [])],
  mobility:e.category === 'stretching' || mobilityExercises.has(e.id),
  movement:e.muscles[0], steps:e.steps, images:[...new Set([e.images.start, e.images.peak, e.images.main].filter(Boolean))].map(path => imageBase + path)
  };
});

const catalogById = new Map([...legacyExercises, ...exercises].map(exercise => [exercise.id, exercise]));
export const exerciseById = id => catalogById.get(id);
