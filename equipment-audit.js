// RepDB equipment identifiers remain distinct, including the two kinds of band.
export const EQUIPMENT_GROUPS = [
  ['none','Sans matériel'], ['mat','Tapis'],
  ['ab_crunch_machine','Machine à abdominaux'], ['ab_wheel','Roue abdominale'],
  ['air_bike','Air bike'], ['assisted_pullup_machine','Machine à tractions assistées'],
  ['back_extension_machine','Machine à extensions lombaires'], ['barbell','Barre de musculation'],
  ['battle_rope','Cordes ondulatoires'], ['bicep_curl_machine','Machine à biceps'],
  ['bicycle','Vélo'], ['bosu_ball','Bosu'], ['cable','Poulie'],
  ['chest_fly_machine','Machine à écartés'], ['chest_press_machine','Machine à pectoraux'],
  ['captains_chair','Chaise romaine'],
  ['climbing_rope','Corde à grimper'], ['dip_machine','Machine à dips'],
  ['dip_station','Station à dips'], ['donkey_calf_raise_machine','Machine à mollets donkey'],
  ['dumbbell','Haltères'], ['elliptical','Vélo elliptique'], ['ez_bar','Barre EZ'],
  ['flat_bench','Banc'], ['glute_ham_developer','Banc à ischio-jambiers'],
  ['hack_squat','Machine hack squat'], ['hip_abduction_machine','Machine à abducteurs'],
  ['hip_adduction_machine','Machine à adducteurs'], ['hip_thrust_machine','Machine à hip thrust'],
  ['jump_rope','Corde à sauter'], ['kettlebell','Kettlebell'],
  ['lat_pulldown_machine','Machine à tirage vertical'], ['leg_curl','Machine à leg curl'],
  ['leg_extension','Machine à leg extension'], ['leg_press','Presse à cuisses'],
  ['loop_band','Élastique en boucle'], ['medicine_ball','Médecine-ball'],
  ['parallettes','Parallettes'], ['pec_deck','Pec deck'], ['plate_loaded_dip_machine','Machine à dips à disques'],
  ['plate_loaded_lateral_raise_machine','Machine à élévations latérales à disques'],
  ['plates','Disques'], ['plyo_box','Box'], ['preacher_curl_machine','Machine à pupitre'],
  ['pull_up_bar','Barre de traction'], ['resistance_band','Élastique de résistance'],
  ['reverse_fly_machine','Machine à écartés inversés'], ['rings','Anneaux'],
  ['rower','Rameur'], ['sandbag','Sac lesté'], ['seated_calf_raise_machine','Machine à mollets assis'],
  ['seated_row_machine','Machine à tirage horizontal'], ['shoulder_press_machine','Machine à épaules'],
  ['shrug_machine','Machine à shrug'], ['ski_erg','SkiErg'], ['slam_ball','Slam ball'],
  ['sled','Traîneau'], ['smith_machine','Machine Smith'], ['stability_ball','Ballon de stabilité'],
  ['stair_climber','Escalier'], ['standing_calf_raise_machine','Machine à mollets debout'],
  ['stationary_bike','Vélo stationnaire'], ['suspension_trainer','Sangles de suspension'],
  ['trap_bar','Trap bar'], ['treadmill','Tapis de course'],
  ['tricep_extension_machine','Machine à triceps'], ['wall','Mur'], ['wall_ball','Wall ball'],
  ['wrist_roller','Rouleau à poignets']
];

export const EQUIPMENT_FILTERS = [
  ['dumbbell','Haltères'], ['kettlebell','Kettlebell'], ['barbell','Barres de musculation'],
  ['pull_up_dip_bar','Barres de traction et dips'],
  ['flat_bench','Banc'], ['mat','Tapis'], ['ball','Ballon'],
  ['band','Élastiques'], ['machines','Machines']
];

const equipmentFilterGroups = {
  dumbbell:'dumbbell', kettlebell:'kettlebell',
  barbell:'barbell', ez_bar:'barbell', trap_bar:'barbell',
  pull_up_bar:'pull_up_dip_bar', dip_station:'pull_up_dip_bar',
  flat_bench:'flat_bench', mat:'mat',
  medicine_ball:'ball', slam_ball:'ball', stability_ball:'ball', wall_ball:'ball', bosu_ball:'ball',
  loop_band:'band', resistance_band:'band'
};

export function equipmentFilterFor(group) {
  return equipmentFilterGroups[group] || 'machines';
}

// A mat is optional for sustained contact with the floor, or mentioned explicitly.
// Standing positions do not acquire a mat merely because the feet touch the floor.
const matExercises = new Set(`
90-90-hold 90-90-switch ab-wheel-rollout balance-dome-glute-bridge ball-leg-curl
banded-adductor-stretch banded-calf-stretch banded-clamshell banded-figure-4-stretch
banded-fire-hydrant banded-glute-bridge banded-hamstring-stretch banded-it-band-stretch
banded-kneeling-hip-thrust barbell-glute-bridge bear-plank-hold bicycle-crunch bird-dog
bird-dog-hold boat-pose bow-pose butterfly-stretch cable-crunch camel-pose cat-cow cat-stretch
childs-pose clamshells clamshells-hold cobra-stretch cocoons cow-face-pose crescent-lunge
cross-body-crunch crunches dead-bug dead-bug-hold dolphin-pose dumbbell-floor-press easy-pose
fire-hydrant fish-pose floor-ez-bar-press floor-kettlebell-pullover floor-press flutter-kicks
frog-stretch glute-bridge glute-bridge-hold glute-kickback glute-kickback-hold
half-kneeling-hip-flexor-rock happy-baby head-to-knee-pose heel-touches hero-pose
hollow-body-hold jackknife-sit-up kettlebell-close-grip-floor-press kettlebell-floor-press
kettlebell-russian-twist kettlebell-skull-crusher kettlebell-turkish-get-ups
knee-push-ups knee-to-chest-stretch kneeling-hip-flexor-stretch kneeling-wrist-stretch
lean-back-90-90-hold legs-up-the-wall locust-pose low-lunge low-lunge-to-half-split
lying-leg-raise lying-quad-stretch one-arm-kettlebell-floor-glute-bridge-press
one-arm-kettlebell-floor-press pigeon-stretch pilates-kneeling-side-kick pilates-roll-over
pilates-saw pilates-side-bend pilates-spine-stretch-forward pilates-spine-twist plank
plow-pose puppy-pose pyramid-pose reclined-butterfly reverse-crunches reverse-nordic-curl
revolved-crescent-lunge russian-twist savasana scissor-kicks seated-forward-fold
seated-spinal-twist seated-straddle-stretch side-lying-hip-abduction
side-lying-hip-abduction-hold side-lying-hip-adduction side-lying-hip-adduction-hold
side-plank side-plank-leg-lift side-plank-leg-lift-hold single-leg-glute-bridge
single-leg-glute-bridge-hold sit-ups six-inch-hold sphinx-pose stability-ball-hip-bridge
superman supine-spinal-twist supine-windshield-wipers supported-shoulderstand
thread-the-needle thread-the-needle-flow trx-hamstring-curl trx-side-plank upward-dog
v-sit v-ups wall-hamstring-stretch warrior-one weighted-wall-crunch
`.trim().split(/\s+/));

// Optional alternatives do not make a box, chair or raised step into a bench.
const notFlatBench = new Set(`
banded-seated-hip-abduction barbell-box-squat box-squat db-step-up-to-balance incline-push-ups
kb-step-up-to-balance
single-leg-box-squat step-up-to-balance step-ups
`.trim().split(/\s+/));

const extraEquipment = {
  captains_chair: ['captains-chair-knee-raise','captains-chair-leg-raise'],
  parallettes: ['handstand-push-ups'],
  wall: ['legs-up-the-wall','wall-push-ups','wall-sit'],
  plyo_box: ['barbell-box-squat','box-squat','step-ups'],
  flat_bench: ['db-preacher-curl'],
  pull_up_bar: ['band-assisted-pull-ups'],
  plates: ['barbell-ab-rollout','landmine-press','plate-loaded-donkey-calf-raise',
    'plate-loaded-glute-drive','plate-loaded-lateral-raise','plate-loaded-seated-dip-machine',
    'plate-loaded-shrug','single-arm-plate-loaded-lateral-raise','weighted-dips','weighted-pull-up']
};
const extraById = new Map();
for (const [group, ids] of Object.entries(extraEquipment)) {
  for (const id of ids) extraById.set(id, [...(extraById.get(id) || []), group]);
}

export function equipmentGroupsFor(entry) {
  const groups = new Set(entry.equipment ? [entry.equipment] : []);
  for (const group of extraById.get(entry.id) || []) groups.add(group);
  if (!notFlatBench.has(entry.id) && /\bbench\b/i.test([entry.name, ...entry.steps].join(' '))) groups.add('flat_bench');
  if (!groups.size) groups.add('none');
  if (matExercises.has(entry.id)) groups.add('mat');
  return [...groups];
}
