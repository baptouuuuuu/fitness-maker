import data from './exercises-data.js';

const categories = {back:'Dos',cardio:'Cardio',chest:'Pectoraux','lower arms':'Avant-bras','lower legs':'Mollets',neck:'Cou',shoulders:'Épaules','upper arms':'Bras','upper legs':'Jambes',waist:'Abdominaux'};
const muscles = {abductors:'Abducteurs',abs:'Abdominaux',adductors:'Adducteurs',biceps:'Biceps',calves:'Mollets','cardiovascular system':'Cardio',delts:'Épaules',forearms:'Avant-bras',glutes:'Fessiers',hamstrings:'Ischio-jambiers',lats:'Grand dorsal','levator scapulae':'Élévateur de la scapula',pectorals:'Pectoraux',quads:'Quadriceps','serratus anterior':'Dentelé antérieur',spine:'Rachis',traps:'Trapèzes',triceps:'Triceps','upper back':'Haut du dos'};
const equipmentNames = {'body weight':'Poids du corps',dumbbell:'Haltères',barbell:'Barre',weighted:'Lest',kettlebell:'Kettlebell',cable:'Poulie',band:'Élastique','resistance band':'Élastique de résistance','ez barbell':'Barre EZ','olympic barbell':'Barre olympique','trap bar':'Trap bar','medicine ball':'Medecine-ball','leverage machine':'Machine à levier','smith machine':'Machine Smith',assisted:'Assistance','stability ball':'Ballon de stabilité','bosu ball':'Bosu',roller:'Rouleau','wheel roller':'Roue abdominale',rope:'Corde',hammer:'Marteau','elliptical machine':'Vélo elliptique','stationary bike':'Vélo stationnaire','skierg machine':'SkiErg','sled machine':'Traîneau','stepmill machine':'Escalier','upper body ergometer':'Ergomètre bras',tire:'Pneu'};
const weighted = new Set(['dumbbell','barbell','weighted','kettlebell','ez barbell','olympic barbell','trap bar','medicine ball']);
export const legacyExercises = data.map(e => ({
  id:e.id, name:e.name, category:categories[e.category] || e.category,
  equipment:e.equipment === 'body weight' ? 'Sans poids' : weighted.has(e.equipment) ? 'Avec poids' : 'Autre matériel',
  equipmentDetail:equipmentNames[e.equipment] || e.equipment,
  muscles:[muscles[e.target] || e.target],
  movement:e.target, steps:e.steps,
  mediaUrl:`https://github.com/hasaneyldrm/exercises-dataset/blob/7455efae41b330c265e7cd4b78dfa848e7ce5ebd/${e.gif}`
}));
