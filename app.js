import { exercises, exerciseById } from './exercises.js';
import { EQUIPMENT_FILTERS } from './equipment-audit.js';
import { STORAGE_KEY, MAX_SETS, BODY_PART_FILTERS, matchesExercise, generateSession, automaticReplacement, validGenerationFilters, recommend, validateItem, exportSession, importSession, makeTimeline, formatTime, locatePhase } from './core.js';

const app = document.querySelector('#app');
const byId = exerciseById;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let warning = '';
let saved;
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  saved = raw ? JSON.parse(raw) : {};
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Données invalides');
} catch {
  saved = {};
  warning = 'Les données locales sont illisibles ou inaccessibles. Vérifiez le stockage de votre navigateur.';
}
const validItems = items => Array.isArray(items) && items.every(item => validateItem(item) && (item.exerciseId === null || byId(item.exerciseId)));
const itemName = item => item.exerciseId === null ? 'Chrono libre' : byId(item.exerciseId).name;
function restoreRunner(savedRunner) {
  if (!savedRunner || !validItems(savedRunner.items) || !Number.isFinite(savedRunner.elapsed) || savedRunner.elapsed < 0) return null;
  const items = structuredClone(savedRunner.items);
  const timeline = makeTimeline(items);
  const total = timeline.reduce((sum, phase) => sum + phase.duration, 0);
  if (!timeline.length) return null;
  const running = savedRunner.running === true && Number.isFinite(savedRunner.savedAt);
  const elapsed = Math.min(total, savedRunner.elapsed + (running ? Math.max(0, Date.now() - savedRunner.savedAt) / 1000 : 0));
  if (!running && elapsed >= total) return null;
  const phase = locatePhase(timeline, elapsed);
  return {timeline, items, name:typeof savedRunner.name === 'string' ? savedRunner.name : (saved.draft?.name || 'Séance'), index:phase.index, remaining:phase.remaining, elapsed, startedAt:Date.now(), paused:!running};
}
const validLog = log => log && typeof log.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(log.date) && typeof log.name === 'string' && Array.isArray(log.entries) && log.entries.every(entry => entry && byId(entry.exerciseId) && Array.isArray(entry.sets) && entry.sets.every(set => Number.isFinite(set.reps) && set.reps > 0 && (set.weight === null || Number.isFinite(set.weight))));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const formatDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
const restoredRunner = restoreRunner(saved.runner);
const state = {
  page:'library', search:'', bodyParts:[], equipmentGroups:['mat'], types:['strength'], sort:'name', onlyFavorites:false, limit:24,
  favorites:Array.isArray(saved.favorites) ? saved.favorites.filter(id => byId(id)) : [],
  sessions:Array.isArray(saved.sessions) ? saved.sessions.filter(session => session && typeof session.id === 'string' && typeof session.name === 'string' && validItems(session.items)) : [],
  draft:saved.draft && typeof saved.draft.name === 'string' && validItems(saved.draft.items) ? saved.draft : {id:null, name:'Ma séance', items:[]},
  logs:Array.isArray(saved.logs) ? saved.logs.filter(validLog) : [], logDraft:null, chart:null,
  sound:saved.sound !== false, detail:null, runner:restoredRunner && !restoredRunner.paused ? restoredRunner : null, resumeRunner:restoredRunner?.paused ? restoredRunner : null, runnerVisible:false, replaceIndex:null,
  generatorMinutes:'20', generatorFilters:{search:'', bodyParts:[], equipmentGroups:['mat'], types:['strength']}
};
let timerId;
let lastRunnerCheckpoint = 0;
function showDetail(id) {
  state.detail = id;
  render();
}
function persist() {
  try {
    const runner = state.runner ? snapshotRunner(state.runner) : state.resumeRunner ? snapshotRunner(state.resumeRunner) : null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({favorites:state.favorites, sessions:state.sessions, logs:state.logs, draft:state.draft, sound:state.sound, runner}));
  } catch {
    warning = 'Enregistrement impossible : le stockage local est indisponible ou plein.';
  }
}
function snapshotRunner(runner) {
  const elapsed = runner.paused ? runner.elapsed : runner.elapsed + (Date.now() - runner.startedAt) / 1000;
  const total = runner.timeline.reduce((sum, phase) => sum + phase.duration, 0);
  if (runner.paused && elapsed >= total) return null;
  return {items:runner.items, name:runner.name, elapsed:Math.min(elapsed,total), ...(runner.paused ? {} : {running:true, savedAt:Date.now()})};
}
function notify(message) {
  warning = message;
  render();
}
function speak(text) {
  if (!state.sound) return;
  if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }
}
function navButton(page, icon, label) {
  return `<button class="nav-link ${state.page === page ? 'active' : ''}" data-page="${page}" ${state.page === page ? 'aria-current="page"' : ''}><span aria-hidden="true">${icon}</span>${label}${page === 'session' ? `<span class="nav-count">${state.draft.items.length}</span>` : ''}</button>`;
}
function shell(content) {
  return `<div class="layout"><aside class="sidebar"><div class="brand"><span class="brand-mark">✳</span><div>fitness<span>maker</span><small>VOTRE ESPACE À VOUS</small></div></div><div class="nav-label">ESPACE PERSONNEL</div><nav aria-label="Navigation principale">${navButton('library','▦','Bibliothèque')}${navButton('session','◫','Ma séance')}${navButton('generator','✦','Générateur')}${navButton('saved','♡','Mes séances')}${navButton('tracking','↗','Suivi')}</nav><div class="sidebar-bottom"><span>✦</span><div><strong>À votre rythme.</strong><p>Chaque mouvement compte.</p></div></div></aside><main><header class="topbar"><span>VOTRE ESPACE FITNESS</span><button class="sound-toggle" data-action="sound" aria-pressed="${state.sound}">${state.sound ? '♪ Son activé' : '♪ Son désactivé'}</button></header>${warning ? `<div class="notice" role="alert">${escapeHtml(warning)} <button data-action="dismiss" aria-label="Fermer">×</button></div>` : ''}<div class="content">${content}</div><footer><div class="footer-dedication">Conçu pour Romane <span class="footer-heart" aria-hidden="true">♡</span></div><div>Bougez avec plaisir, cultivez votre énergie et prenez soin de vous.</div><div>Images des exercices : <a href="https://repdb.co" target="_blank" rel="noopener noreferrer">RepDB</a></div></footer></main></div>${state.detail ? detailModal() : ''}${state.chart ? chartModal() : ''}${state.runner && state.runnerVisible ? runnerModal() : ''}`;
}
function filtersUI(filters, scope) {
  return `<div class="filters"><label class="search"><span aria-hidden="true">⌕</span><input type="search" data-search="${scope}" placeholder="Rechercher en français ou en anglais..." value="${escapeHtml(filters.search)}" aria-label="Rechercher un exercice ou un muscle"></label></div><fieldset class="equipment-filters"><legend>Parties du corps <small>— plusieurs choix possibles</small></legend><div class="keyword-list">${BODY_PART_FILTERS.map(({id,label}) => `<label><input type="checkbox" data-body-part="${scope}" value="${id}" ${filters.bodyParts.includes(id) ? 'checked' : ''}> ${label}</label>`).join('')}</div><small>Sans sélection : toutes les parties du corps.</small></fieldset><fieldset class="equipment-filters"><legend>Type d’exercice <small>— plusieurs choix possibles</small></legend><div class="keyword-list">${[['strength','Renforcement'],['stretching','Étirement'],['mobility','Mobilité']].map(([value,label]) => `<label><input type="checkbox" data-exercise-type="${scope}" value="${value}" ${filters.types.includes(value) ? 'checked' : ''}> ${label}</label>`).join('')}</div><small>Sans sélection : tous les types d’exercice.</small></fieldset><fieldset class="equipment-filters"><legend>Matériel disponible <small>— plusieurs choix possibles</small></legend><div class="keyword-list">${EQUIPMENT_FILTERS.map(([value,label]) => `<label><input type="checkbox" data-equipment-group="${scope}" value="${value}" ${filters.equipmentGroups.includes(value) ? 'checked' : ''}> ${label}</label>`).join('')}</div><small>Sans sélection : exercices sans matériel. Seuls les exercices compatibles avec votre matériel sont affichés ; le tapis est facultatif. Machines regroupe les autres équipements de salle.</small></fieldset>`;
}
function itemField(index, field, label, value, min, max, increment) {
  return `<label>${label}<span class="stepper"><button type="button" data-action="adjust" data-index="${index}" data-field="${field}" data-delta="-${increment}" aria-label="Diminuer ${label.toLowerCase()}" ${value <= min ? 'disabled' : ''}>−</button><input type="number" min="${min}" max="${max}" step="1" data-item="${index}" data-field="${field}" value="${value}" aria-label="${label}"><button type="button" data-action="adjust" data-index="${index}" data-field="${field}" data-delta="${increment}" aria-label="Augmenter ${label.toLowerCase()}" ${value >= max ? 'disabled' : ''}>+</button></span></label>`;
}
function exerciseImage(exercise, className) {
  const images = exercise.images || [];
  return `<div class="exercise-images ${className}">${images.length ? images.map((image,index) => `<div class="exercise-image"><img src="${escapeHtml(image)}" alt="${escapeHtml(exercise.name)} : image ${index + 1} sur ${images.length}" loading="lazy"><span>Image indisponible</span></div>`).join('') : '<div class="exercise-image"><span>Image indisponible</span></div>'}</div>`;
}
function card(exercise, rec) {
  const favorite = state.favorites.includes(exercise.id);
  return `<article class="exercise-card"><div class="card-art"><span class="level">${escapeHtml(exercise.equipmentDetail)}</span><button class="favorite ${favorite ? 'selected' : ''}" data-action="favorite" data-id="${exercise.id}" aria-label="${favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} : ${escapeHtml(exercise.name)}" aria-pressed="${favorite}">${favorite ? '♥' : '♡'}</button><button class="art-button" data-action="detail" data-id="${exercise.id}" aria-label="Voir ${escapeHtml(exercise.name)}">${exerciseImage(exercise,'card-images')}</button></div><div class="card-body"><div class="card-kicker">${exercise.category} <span>·</span> ${exercise.equipment}</div><h3>${escapeHtml(exercise.name)}</h3><div class="tags">${exercise.muscles.map(m => `<span>${escapeHtml(m)}</span>`).join('')}${exercise.mobility ? '<span>Étirements / mobilité</span>' : ''}</div>${state.sort === 'relevance' ? `<p class="reason">✦ ${rec.reason}</p>` : ''}<div class="card-actions"><button class="text-button" data-action="detail" data-id="${exercise.id}">Voir l’exercice ↗</button><button class="add-button" data-action="add" data-id="${exercise.id}" aria-label="${state.replaceIndex !== null ? 'Choisir' : 'Ajouter'} ${escapeHtml(exercise.name)} ${state.replaceIndex !== null ? 'pour remplacer' : 'à la séance'}">${state.replaceIndex !== null ? '↺' : '+'}</button></div></div></article>`;
}
function library() {
  const ranked = recommend(exercises, state.draft.items);
  const rank = new Map(ranked.map((entry,index) => [entry.exercise.id,{...entry,index}]));
  const filtered = exercises.filter(exercise => {
    return matchesExercise(exercise, state) && (!state.onlyFavorites || state.favorites.includes(exercise.id));
  }).sort((a,b) => state.sort === 'relevance' ? (rank.get(a.id)?.index ?? 999) - (rank.get(b.id)?.index ?? 999) || a.name.localeCompare(b.name,'fr') : a.name.localeCompare(b.name,'fr'));
  return `<div class="eyebrow"><span></span> VOTRE ENTRAÎNEMENT COMMENCE ICI</div><div class="heading-row"><div><h1>Trouvez votre <em>mouvement.</em></h1><p class="intro">Explorez les exercices, composez une séance qui vous ressemble et avancez à votre rythme.</p></div><button class="primary heading-cta" data-page="session">Ma séance <span>↗</span></button></div>${state.replaceIndex !== null ? `<div class="panel replace-banner"><div><strong>Remplacer ${escapeHtml(byId(state.draft.items[state.replaceIndex].exerciseId).name)}</strong><p>Choisissez un exercice ; les séries et les temps seront conservés.</p></div><button class="secondary" data-action="cancel-replace">Annuler</button></div>` : ''}<section class="library-section"><div class="section-heading"><div><div class="eyebrow muted">LA COLLECTION</div><h2>Bibliothèque <span class="count">${filtered.length}</span></h2></div><button class="filter-fav ${state.onlyFavorites ? 'selected' : ''}" data-action="filter-favorites" aria-pressed="${state.onlyFavorites}">♡ Favoris</button></div>${filtersUI(state, 'library')}<div class="filters sort-filter"><label><span class="sr-only">Trier par</span><select data-filter="sort" data-scope="library"><option value="name" ${state.sort === 'name' ? 'selected' : ''}>Trier par nom</option><option value="relevance" ${state.sort === 'relevance' ? 'selected' : ''}>Trier par pertinence</option></select></label></div><div class="results-line"><span>${filtered.length} exercice${filtered.length > 1 ? 's' : ''} à découvrir</span><span>FAITES-VOUS PLAISIR ✳</span></div><div class="cards">${filtered.slice(0,state.limit).map(e => card(e,rank.get(e.id) || {reason:'Déjà dans votre séance'})).join('')}</div>${filtered.length > state.limit ? `<button class="secondary load-more" data-action="more">Afficher plus (${Math.min(state.limit,filtered.length)} / ${filtered.length})</button>` : ''}${filtered.length ? '' : '<div class="empty">Aucun exercice ne correspond à ces filtres.</div>'}</section>`;
}
function sessionPage() {
  const items = state.draft.items;
  const total = makeTimeline(items).reduce((sum, phase) => sum + phase.duration, 0);
  const sets = items.reduce((sum, item) => sum + item.sets, 0);
  const replacementsAvailable = validGenerationFilters(state.draft.generationFilters);
  const pending = state.runner || state.resumeRunner;
  const pendingTotal = pending ? pending.timeline.reduce((sum, phase) => sum + phase.duration, 0) : 0;
  const pendingElapsed = pending ? Math.min(pendingTotal, pending.elapsed + (pending.paused ? 0 : (Date.now() - pending.startedAt) / 1000)) : 0;
  const pendingDone = pending && pendingElapsed >= pendingTotal;
  return `<div class="heading-row"><h1>Ma <em>séance.</em></h1></div><section class="session-layout"><div><div class="section-heading session-title"><h2>Détails de la séance <span class="count">${items.length}</span></h2><div class="session-heading-actions"><button class="secondary danger clear-session-button" data-action="clear-all" ${items.length ? '' : 'disabled'}>Tout supprimer</button><div class="session-add"><button class="secondary session-add-button" data-action="add-timer">＋ Chrono libre</button><button class="secondary session-add-button" data-page="library">＋ Ajouter des exercices</button></div></div></div>${items.length ? items.map((item,index) => {const e=byId(item.exerciseId); const name=escapeHtml(itemName(item)); return `<article class="session-item ${e ? '' : 'timer-item'}"><div class="item-heading"><div class="item-number">${String(index+1).padStart(2,'0')}</div>${e ? exerciseImage(e,'item-image') : ''}<div class="item-title">${e ? `<div class="card-kicker">${e.category} · ${e.equipment}</div>` : ''}<h3>${name}</h3></div><div class="item-buttons"><button data-action="move-up" data-index="${index}" aria-label="Monter ${name}" ${index === 0 ? 'disabled' : ''}>↑</button><button data-action="move-down" data-index="${index}" aria-label="Descendre ${name}" ${index === items.length-1 ? 'disabled' : ''}>↓</button><button class="remove-item" data-action="remove" data-index="${index}" aria-label="Retirer ${name}">×</button></div></div><div class="item-main">${e ? `<div class="item-replacements"><button class="secondary replace-button" data-action="replace" data-index="${index}">↺ Remplacer cet exercice</button>${replacementsAvailable ? `<button class="primary replace-button" data-action="replace-auto" data-index="${index}">✦ Remplacement automatique</button>` : ''}</div>` : ''}<div class="item-fields">${itemField(index,'sets','SÉRIES',item.sets,1,MAX_SETS,1)}${itemField(index,'work','EFFORT (SEC)',item.work,5,600,10)}${itemField(index,'rest','REPOS (SEC)',item.rest,0,300,10)}</div></div></article>`;}).join('') : '<div class="empty"><strong>Ajoutez un exercice ou un chrono libre.</strong></div>'}</div><aside class="session-aside">${pending ? `<section class="panel launch-panel"><h2>Une séance en cours</h2><p>${pendingDone ? 'Terminée' : pending.paused ? 'En pause' : 'En arrière-plan'}</p><div class="session-stats"><span><strong id="pending-remaining">${formatTime(pendingTotal - pendingElapsed)}</strong> temps restant</span><span><strong>${formatTime(pendingTotal)}</strong> temps total</span></div><button class="primary full" data-action="resume">▶ &nbsp; ${pendingDone ? 'Voir la séance terminée' : pending.paused ? 'Reprendre' : 'Ouvrir la séance'}</button><button class="secondary full" data-action="restart-runner">↻ &nbsp; Redémarrer</button><button class="secondary danger full" data-action="delete-runner">Supprimer la progression</button></section>` : '<section class="panel launch-panel"><h2>Une séance en cours</h2><p>Aucune séance en cours.</p></section>'}<section class="panel launch-panel"><h2>Nouvelle séance</h2><div class="session-stats"><span><strong>${formatTime(total)}</strong> temps total</span><span><strong>${items.length}</strong> bloc${items.length > 1 ? 's' : ''}</span><span><strong>${sets}</strong> série${sets > 1 ? 's' : ''}</span></div><button class="primary full" data-action="start" ${items.length ? '' : 'disabled'}>▶ &nbsp; Démarrer</button><div class="session-utility-actions"><button class="secondary full" data-action="save" ${items.length ? '' : 'disabled'}>♡ &nbsp; Enregistrer</button><button class="secondary full" data-action="export-draft" ${items.length ? '' : 'disabled'}>Exporter JSON</button></div></section></aside></section>`;
}
function generatorForm() {
  return `<form class="panel generator" id="generator"><div class="eyebrow muted">VOTRE SÉANCE SUR MESURE</div><h2>Générer une séance ✦</h2><p>Choisissez une durée, repos compris, et filtrez les exercices. Adaptez la séance à votre niveau.</p><div class="generator-fields"><label>Durée totale (minutes)<input id="generator-minutes" type="number" min="5" max="120" step="1" required value="${escapeHtml(state.generatorMinutes)}"></label></div>${filtersUI(state.generatorFilters, 'generator')}<button class="primary" type="submit">Générer ma séance ↗</button></form>`;
}
function generatorPage() {
  return `<div class="eyebrow"><span></span> SÉANCE AUTOMATIQUE</div><div class="heading-row"><div><h1>Une séance <em>sur mesure.</em></h1><p class="intro">Choisissez vos objectifs, puis personnalisez votre séance avant de commencer.</p></div><button class="secondary" data-page="session">Retour à ma séance</button></div>${generatorForm()}`;
}
function savedPage() {
  return `<div class="eyebrow"><span></span> VOTRE COLLECTION</div><div class="heading-row"><div><h1>Vos séances, <em>à retrouver.</em></h1><p class="intro">Tous vos programmes enregistrés, prêts à être repris.</p></div><div class="collection-actions"><label class="secondary import-session">Importer un JSON<input id="session-file" type="file" accept=".json,application/json"></label><button class="primary" data-action="new">＋ Nouvelle séance</button></div></div><div class="saved-grid">${state.sessions.length ? state.sessions.map(session => `<article class="panel saved-card"><div class="eyebrow muted">SÉANCE ENREGISTRÉE</div><h2>${escapeHtml(session.name)}</h2><p>${session.items.length} bloc${session.items.length > 1 ? 's' : ''} · ${formatTime(makeTimeline(session.items).reduce((sum,phase) => sum + phase.duration,0))}</p><div class="tags">${session.items.slice(0,3).map(item => `<span>${escapeHtml(itemName(item))}</span>`).join('')}</div><div class="saved-actions"><button class="primary" data-action="load" data-id="${escapeHtml(session.id)}">Ouvrir ↗</button><button class="text-button" data-action="log-from-saved" data-id="${escapeHtml(session.id)}">Ajouter au suivi</button><button class="text-button" data-action="export-saved" data-id="${escapeHtml(session.id)}">Exporter JSON</button><button class="text-button danger" data-action="delete" data-id="${escapeHtml(session.id)}">Supprimer</button></div></article>`).join('') : '<div class="empty"><strong>Pas encore de séance enregistrée.</strong><p>Créez votre premier programme et retrouvez-le ici.</p><button class="secondary" data-page="library">Explorer les exercices ↗</button></div>'}</div>`;
}
function detailModal() {
  const exercise = byId(state.detail);
  return `<div class="overlay detail-overlay"><section class="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button class="close" data-action="close-detail" aria-label="Fermer">×</button><div class="detail-art">${exerciseImage(exercise,'detail-images')}</div><div class="detail-content"><div class="eyebrow muted">${exercise.category} · ${exercise.equipmentDetail}</div><h2 id="detail-title">${escapeHtml(exercise.name)}</h2><div class="tags">${exercise.muscles.map(m => `<span>${escapeHtml(m)}</span>`).join('')}${exercise.mobility ? '<span>Étirements / mobilité</span>' : ''}</div><h3>Le mouvement, étape par étape</h3><ol>${exercise.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>${state.runner && state.runnerVisible ? '<p>Le chronomètre continue pendant la consultation.</p>' : `<button class="primary full" data-action="add" data-id="${exercise.id}">${state.replaceIndex !== null ? '↺ Choisir cet exercice' : '＋ Ajouter à ma séance'}</button>`}</div></section></div>`;
}
function runnerModal() {
  const runner = state.runner;
  const phase = runner.timeline[runner.index];
  const done = !phase;
  const next = runner.timeline[runner.index + 1];
  const exercise = phase && byId(phase.exerciseId);
  const total = runner.timeline.reduce((sum, item) => sum + item.duration, 0);
  const elapsed = done ? total : runner.timeline.slice(0,runner.index).reduce((sum, item) => sum + item.duration, 0) + phase.duration - runner.remaining;
  const upcoming = phase ? runner.items.slice(phase.itemIndex + 1) : [];
  return `<div class="overlay runner-overlay"><section class="modal runner" role="dialog" aria-modal="true" aria-labelledby="runner-title"><button class="close" data-action="${done ? 'stop' : 'leave-runner'}" aria-label="${done ? 'Terminer la séance' : 'Quitter et reprendre plus tard'}">×</button><div class="eyebrow"><span></span> ${done ? 'SÉANCE TERMINÉE' : phase.type === 'work' ? 'C’EST À VOUS' : 'REPRENEZ VOTRE SOUFFLE'}</div><h2 id="runner-title">${done ? 'Bravo, vous l’avez fait !' : phase.type === 'work' ? escapeHtml(itemName(phase)) : 'Temps de repos'}</h2>${done ? '' : `<div class="runner-sets">${phase.type === 'work' ? `Série <strong>${phase.set} / ${phase.sets}</strong>` : `Séries terminées <strong>${phase.set} / ${phase.sets}</strong>`}</div>${phase.type === 'rest' && next ? `<p>À suivre : ${escapeHtml(itemName(next))} · série ${next.set} / ${next.sets}</p>` : ''}`}${exercise ? `<div class="runner-current">${exerciseImage(exercise,'runner-image')}<strong>${escapeHtml(exercise.name)}</strong><button class="text-button runner-detail" data-action="detail" data-id="${escapeHtml(exercise.id)}">Voir l’exercice ↗</button></div>` : ''}<div class="timer-ring ${phase?.type === 'rest' ? 'rest' : ''}"><span id="timer-display" role="timer">${formatTime(runner.remaining)}</span><small>${done ? 'BIEN JOUÉ' : runner.paused ? 'EN PAUSE' : phase.type === 'work' ? 'EFFORT' : 'REPOS'}</small></div><div class="runner-progress"><label for="session-progress">Progression de la séance ${done ? '· terminée' : `· bloc ${phase.itemIndex + 1} / ${runner.items.length}`}</label><progress id="session-progress" max="${total}" value="${elapsed}"></progress><small>Étape ${done ? runner.timeline.length : runner.index + 1} / ${runner.timeline.length}</small></div>${done ? '<button class="primary" data-action="log-from-runner">Ajouter au suivi</button><button class="secondary" data-action="stop">Terminer</button>' : `<div class="runner-actions"><button class="secondary" data-action="background-runner">Mettre en arrière-plan</button><button class="secondary" data-action="pause">${runner.paused ? '▶ Reprendre' : 'Ⅱ Pause'}</button><button class="text-button" data-action="skip">Passer l’étape ↗</button><button class="text-button" data-action="skip-exercise">Passer l’exercice ↗</button></div>${upcoming.length ? `<div class="runner-upcoming"><h3>Blocs suivants</h3><div class="upcoming-list">${upcoming.map(item => { const e = byId(item.exerciseId); return `<div class="upcoming-item">${e ? exerciseImage(e,'upcoming-image') : ''}<span>${escapeHtml(itemName(item))}</span></div>`; }).join('')}</div>` : ''}`}</section></div>`;
}
let exerciseOptions;
const exerciseDatalist = () => exerciseOptions ||= `<datalist id="exercise-names">${exercises.map(e => `<option value="${escapeHtml(e.name)}"></option>`).join('')}</datalist>`;
const emptySet = () => ({reps:'', weight:''});
function logForm() {
  const draft = state.logDraft;
  const editingEntry = draft.entryIndex !== null;
  const title = editingEntry ? 'Modifier un exercice' : draft.logId ? 'Modifier la séance' : 'Nouvelle séance';
  return `<form class="panel log-form" id="log-form"><h2>${title}</h2>${editingEntry ? '' : `<div class="generator-fields"><label>Date<input type="date" data-log="date" value="${escapeHtml(draft.date)}" max="${today()}"></label><label>Nom<input type="text" data-log="name" maxlength="80" value="${escapeHtml(draft.name)}"></label></div>`}${exerciseDatalist()}${draft.entries.map((entry,i) => `<div class="log-entry"><div class="log-entry-head"><input type="text" list="exercise-names" placeholder="Exercice…" data-entry-ex="${i}" value="${entry.exerciseId ? escapeHtml(byId(entry.exerciseId).name) : escapeHtml(entry.text || '')}" aria-label="Exercice"><button type="button" class="text-button" data-action="log-remove-entry" data-index="${i}" ${editingEntry ? 'hidden' : ''}>Retirer</button></div>${entry.sets.map((set,j) => `<div class="log-set"><span>Série ${j+1}</span><input type="number" min="1" max="999" step="1" inputmode="numeric" placeholder="Reps" data-entry="${i}" data-set="${j}" data-field="reps" value="${escapeHtml(set.reps)}" aria-label="Répétitions série ${j+1}"><input type="number" min="0" max="1000" step="0.5" inputmode="decimal" placeholder="Poids (kg)" data-entry="${i}" data-set="${j}" data-field="weight" value="${escapeHtml(set.weight)}" aria-label="Poids série ${j+1}"><button type="button" class="text-button" data-action="log-remove-set" data-index="${i}" data-set="${j}" aria-label="Retirer la série ${j+1}">×</button></div>`).join('')}<button type="button" class="text-button" data-action="log-add-set" data-index="${i}">+ Série</button></div>`).join('')}<div class="log-actions">${editingEntry ? '' : '<button type="button" class="secondary" data-action="log-add-entry">+ Exercice</button>'}<button type="submit" class="primary">Enregistrer</button><button type="button" class="text-button" data-action="log-cancel">Annuler</button></div></form>`;
}
function trackingPage() {
  const logs = [...state.logs].sort((a,b) => b.date.localeCompare(a.date));
  return `<div class="eyebrow"><span></span> VOTRE PROGRESSION</div><div class="heading-row"><div><h1>Suivi de vos <em>séances.</em></h1><p class="intro">Notez vos répétitions et vos charges, même pour les séances faites hors de l’application.</p></div>${state.logDraft ? '' : '<button class="primary" data-action="log-new">＋ Ajouter une séance</button>'}</div>${state.logDraft ? logForm() : ''}<section class="log-list">${logs.length ? logs.map(log => `<article class="panel log-card"><div class="log-card-head"><div><strong>${escapeHtml(log.name)}</strong><small>${formatDate(log.date)}</small></div><div class="log-actions"><button class="secondary" data-action="log-edit" data-id="${escapeHtml(log.id)}">Modifier la séance</button><button class="secondary danger" data-action="log-delete" data-id="${escapeHtml(log.id)}">Supprimer</button></div></div>${log.entries.map((entry,index) => `<div class="log-line"><div><strong>${escapeHtml(byId(entry.exerciseId).name)}</strong><span>${entry.sets.map(set => `${set.reps}${set.weight !== null ? ` × ${set.weight} kg` : ' reps'}`).join(' · ')}</span></div><div class="log-actions"><button class="text-button" data-action="log-edit-entry" data-id="${escapeHtml(log.id)}" data-entry-index="${index}">Modifier</button><button class="text-button" data-action="chart" data-id="${escapeHtml(entry.exerciseId)}">Voir le graphique ↗</button></div></div>`).join('')}</article>`).join('') : '<p class="empty">Aucune séance suivie pour l’instant.</p>'}</section>`;
}
function exerciseHistory(id) {
  return state.logs.map(log => {
    const sets = log.entries.filter(entry => entry.exerciseId === id).flatMap(entry => entry.sets);
    if (!sets.length) return null;
    const weights = sets.filter(set => set.weight !== null).map(set => set.weight);
    return {date:log.date, reps:sets.reduce((sum,set) => sum + set.reps, 0), weight:weights.length ? Math.max(...weights) : null};
  }).filter(Boolean).sort((a,b) => a.date.localeCompare(b.date));
}
function chartSvg(points, metric, color, side) {
  const W = 520, H = 240, L = 48, R = 48, T = 16, B = 36;
  const data = points.filter(p => p[metric] !== null);
  if (!data.length) return '';
  const times = points.map(p => new Date(`${p.date}T12:00:00`).getTime());
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const values = data.map(p => p[metric]);
  let lo = Math.min(...values), hi = Math.max(...values);
  if (lo === hi) { lo = Math.max(0, lo - 1); hi += 1; }
  const x = p => L + (t1 === t0 ? (W - L - R) / 2 : (new Date(`${p.date}T12:00:00`).getTime() - t0) / (t1 - t0) * (W - L - R));
  const y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ax = side === 'left' ? L : W - R;
  const anchor = side === 'left' ? 'end' : 'start';
  const dx = side === 'left' ? -6 : 6;
  const ticks = [lo, (lo + hi) / 2, hi];
  return `<g>${ticks.map(v => `<text x="${ax + dx}" y="${y(v) + 4}" text-anchor="${anchor}" fill="${color}" font-size="11">${Math.round(v * 10) / 10}</text>`).join('')}<polyline fill="none" stroke="${color}" stroke-width="2" points="${data.map(p => `${x(p)},${y(p[metric])}`).join(' ')}"/>${data.map(p => `<circle cx="${x(p)}" cy="${y(p[metric])}" r="4" fill="${color}"><title>${formatDate(p.date)} : ${p[metric]}</title></circle>`).join('')}</g>`;
}
function chartModal() {
  const exercise = byId(state.chart.id);
  const metric = state.chart.metric;
  const points = exerciseHistory(state.chart.id);
  const W = 520, H = 240, L = 48, R = 48, T = 16, B = 36;
  const showWeight = metric !== 'reps', showReps = metric !== 'weight';
  const hasWeight = points.some(p => p.weight !== null);
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Évolution de ${escapeHtml(exercise.name)}"><line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="#555"/><line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#555"/><line x1="${W - R}" y1="${T}" x2="${W - R}" y2="${H - B}" stroke="#555"/><text x="${L}" y="${H - 12}" font-size="11" fill="#aaa">${formatDate(points[0].date)}</text><text x="${W - R}" y="${H - 12}" font-size="11" text-anchor="end" fill="#aaa">${points.length > 1 ? formatDate(points[points.length - 1].date) : ''}</text>${showWeight ? chartSvg(points,'weight','#f2a65a','left') : ''}${showReps ? chartSvg(points,'reps','#7bd88f','right') : ''}</svg>`;
  const btn = (value,label) => `<button class="${metric === value ? 'primary' : 'secondary'}" data-action="chart-metric" data-id="${value}" aria-pressed="${metric === value}">${label}</button>`;
  return `<div class="overlay detail-overlay"><section class="modal chart-modal" role="dialog" aria-modal="true" aria-labelledby="chart-title"><button class="close" data-action="close-chart" aria-label="Fermer">×</button><div class="detail-content"><h2 id="chart-title">${escapeHtml(exercise.name)}</h2><div class="log-actions">${btn('both','Poids + reps')}${btn('weight','Poids')}${btn('reps','Reps')}</div>${points.length ? svg : '<p class="empty">Pas encore de données.</p>'}<p class="chart-legend"><span style="color:#f2a65a">● Poids max (kg)</span> <span style="color:#7bd88f">● Reps totales</span>${hasWeight ? '' : ' · aucun poids renseigné'}</p></div></section></div>`;
}
function render() {
  app.innerHTML = shell(state.page === 'library' ? library() : state.page === 'session' ? sessionPage() : state.page === 'generator' ? generatorPage() : state.page === 'tracking' ? trackingPage() : savedPage());
}
function add(id) {
  if (!byId(id)) return;
  if (state.replaceIndex !== null) {
    const item = state.draft.items[state.replaceIndex];
    if (!item) return notify('Cet exercice ne peut plus être remplacé.');
    item.exerciseId = id;
    state.replaceIndex = null;
    state.page = 'session';
  } else {
    state.draft.items.push({exerciseId:id,sets:3,work:40,rest:20});
  }
  state.detail = null;
  persist();
  render();
}
function submitLog() {
  const draft = state.logDraft;
  const editingEntry = draft.entryIndex !== null;
  const entries = [];
  for (const entry of draft.entries) {
    if (!entry.exerciseId && !entry.sets.some(set => set.reps !== '' || set.weight !== '')) continue;
    if (!entry.exerciseId) return notify('Choisissez un exercice de la liste pour chaque ligne.');
    const sets = [];
    for (const set of entry.sets) {
      if (set.reps === '' && set.weight === '') continue;
      const reps = Number(set.reps), weight = set.weight === '' ? null : Number(set.weight);
      if (!Number.isInteger(reps) || reps < 1 || reps > 999 || (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 1000))) return notify('Répétitions : 1 à 999. Poids : 0 à 1000 kg.');
      sets.push({reps, weight});
    }
    if (sets.length) entries.push({exerciseId:entry.exerciseId, sets});
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return notify('Choisissez une date.');
  if (!entries.length) return notify('Ajoutez au moins un exercice avec une série.');
  if (draft.logId) {
    const log = state.logs.find(item => item.id === draft.logId);
    if (!log) return notify('Cette séance n’existe plus dans le suivi.');
    if (editingEntry) {
      if (!log.entries[draft.entryIndex]) return notify('Cet exercice n’existe plus dans cette séance.');
      log.entries[draft.entryIndex] = entries[0];
    } else {
      log.date = draft.date;
      log.name = draft.name.trim().slice(0,80) || 'Séance';
      log.entries = entries;
    }
  } else {
    state.logs.push({id:uid(), date:draft.date, name:draft.name.trim().slice(0,80) || 'Séance', entries});
  }
  state.logDraft = null;
  warning = '';
  persist();
  notify(warning || (draft.logId ? 'Modifications enregistrées.' : 'Séance ajoutée au suivi.'));
}
function newLogDraft(name = '', entries = [{exerciseId:null, sets:[emptySet()]}]) {
  state.logDraft = {date:today(), name, entries, logId:null, entryIndex:null};
  state.page = 'tracking';
}
function trackingEntries(items) {
  return items.filter(item => item.exerciseId).map(item => ({
    exerciseId:item.exerciseId,
    sets:Array.from({length:item.sets}, () => ({reps:item.reps > 0 ? item.reps : '', weight:''}))
  }));
}
function editLogDraft(logId, entryIndex = null) {
  const log = state.logs.find(item => item.id === logId);
  if (!log) return;
  const draftEntry = entry => ({
    ...entry,
    sets:entry.sets.map(set => ({reps:String(set.reps), weight:set.weight === null ? '' : String(set.weight)}))
  });
  state.logDraft = {
    date:log.date,
    name:log.name,
    entries:entryIndex === null ? log.entries.map(draftEntry) : [draftEntry(log.entries[entryIndex])],
    logId,
    entryIndex
  };
}
function save() {
  if (!state.draft.items.length) return notify('Ajoutez un exercice ou un chrono avant d’enregistrer.');
  const input = prompt('Nom de la séance', state.draft.name);
  if (input === null) return;
  const name = input.trim();
  if (!name || name.length > 80) return notify('Choisissez un nom de séance entre 1 et 80 caractères.');
  if (!state.draft.id) state.draft.id = uid();
  state.draft.name = name;
  const session = structuredClone(state.draft);
  const index = state.sessions.findIndex(item => item.id === session.id);
  if (index >= 0) state.sessions[index] = session; else state.sessions.push(session);
  persist();
  notify(warning || 'Séance enregistrée dans ce navigateur.');
}
function downloadSession(session) {
  if (!session.name.trim()) return notify('Donnez un nom à votre séance avant de l’exporter.');
  if (!session.items.length || !validItems(session.items)) return notify('Vérifiez les blocs avant d’exporter la séance.');
  const url = URL.createObjectURL(new Blob([exportSession({...session, name:session.name.trim()})], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'fitness-maker-seance.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function loadSessionFile(file) {
  try {
    if (file.size > 1024 * 1024) throw new Error('Le fichier dépasse la limite de 1 Mo.');
    const session = importSession(await file.text(), byId);
    state.sessions.push({id:uid(), ...session});
    warning = '';
    persist();
    notify(warning || 'Séance importée dans Mes séances.');
  } catch (error) {
    notify(error.message || 'Impossible de lire ce fichier.');
  }
}
function start(items = state.draft.items, name = state.draft.name) {
  if (!items.length || !validItems(items)) return notify('Vérifiez les blocs et leurs durées avant de démarrer.');
  const timeline = makeTimeline(items);
  state.runner = {timeline,items:structuredClone(items),name,index:0,remaining:timeline[0].duration,elapsed:0,startedAt:Date.now(),paused:false};
  state.runnerVisible = true;
  state.resumeRunner = null;
  lastRunnerCheckpoint = Date.now();
  speak(`C'est parti ! ${itemName(timeline[0])}`);
  clearInterval(timerId);
  timerId = setInterval(tick, 200);
  persist();
  render();
}
function announcePhase() {
  const r = state.runner;
  const phase = r.timeline[r.index];
  if (!phase) { clearInterval(timerId); speak('Bravo, séance terminée !'); }
  else if (phase.type === 'rest') speak('Pause, prenez votre souffle.');
  else speak(`C'est parti ! ${itemName(phase)}`);
}
function advanceRunner(index) {
  const runner = state.runner;
  if (!runner) return;
  runner.index = Math.min(index, runner.timeline.length);
  runner.elapsed = runner.timeline.slice(0,runner.index).reduce((sum,phase) => sum + phase.duration,0);
  runner.startedAt = Date.now();
  runner.remaining = runner.timeline[runner.index]?.duration || 0;
  announcePhase();
  persist();
  render();
}
function tick() {
  const r = state.runner;
  if (!r || r.paused) return;
  const elapsed = r.elapsed + (Date.now() - r.startedAt) / 1000;
  const current = locatePhase(r.timeline, elapsed);
  if (current.index !== r.index) {
    r.index = current.index;
    r.remaining = current.remaining;
    announcePhase();
    if (state.runnerVisible || (!r.timeline[r.index] && state.page === 'session')) render();
  } else {
    r.remaining = current.remaining;
    const display = document.querySelector('#timer-display');
    if (display) display.textContent = formatTime(r.remaining);
    const progress = document.querySelector('#session-progress');
    if (progress && r.timeline[r.index]) progress.value = r.timeline.slice(0,r.index).reduce((sum, phase) => sum + phase.duration, 0) + r.timeline[r.index].duration - r.remaining;
  }
  const pendingRemaining = document.querySelector('#pending-remaining');
  if (pendingRemaining) pendingRemaining.textContent = formatTime(r.timeline.reduce((sum, phase) => sum + phase.duration, 0) - elapsed);
  if (Date.now() - lastRunnerCheckpoint >= 1000) {
    lastRunnerCheckpoint = Date.now();
    persist();
  }
}
app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.page) { state.page = button.dataset.page; state.replaceIndex = null; state.detail = null; render(); window.scrollTo(0,0); return; }
  const {action,id} = button.dataset;
  const index = Number(button.dataset.index);
  switch (action) {
    case 'log-new': newLogDraft(); render(); break;
    case 'log-edit': editLogDraft(id); render(); break;
    case 'log-edit-entry': editLogDraft(id, Number(button.dataset.entryIndex)); render(); break;
    case 'log-cancel': state.logDraft = null; render(); break;
    case 'log-add-entry': state.logDraft.entries.push({exerciseId:null, sets:[emptySet()]}); render(); break;
    case 'log-remove-entry': state.logDraft.entries.splice(index,1); render(); break;
    case 'log-add-set': state.logDraft.entries[index]?.sets.push(emptySet()); render(); break;
    case 'log-remove-set': state.logDraft.entries[index]?.sets.splice(Number(button.dataset.set),1); render(); break;
    case 'log-delete': if (confirm('Supprimer cette séance du suivi ?')) { state.logs = state.logs.filter(log => log.id !== id); if (state.logDraft?.logId === id) state.logDraft = null; persist(); render(); } break;
    case 'chart': if (byId(id)) { state.chart = {id, metric:'both'}; render(); } break;
    case 'chart-metric': state.chart.metric = id; render(); break;
    case 'close-chart': state.chart = null; render(); break;
    case 'log-from-runner': {
      const entries = trackingEntries(state.runner.items);
      const name = state.runner.name;
      clearInterval(timerId); state.runner = null; state.resumeRunner = null;
      newLogDraft(name, entries.length ? entries : undefined);
      persist(); render(); window.scrollTo(0,0); break;
    }
    case 'log-from-saved': {
      const session = state.sessions.find(item => item.id === id);
      if (!session) break;
      const entries = trackingEntries(session.items);
      newLogDraft(session.name, entries.length ? entries : undefined);
      render(); window.scrollTo(0,0); break;
    }
    case 'dismiss': warning = ''; render(); break;
    case 'sound': state.sound = !state.sound; if (!state.sound && 'speechSynthesis' in window) window.speechSynthesis.cancel(); persist(); render(); break;
    case 'filter-favorites': state.onlyFavorites = !state.onlyFavorites; state.limit = 24; render(); break;
    case 'more': state.limit += 24; render(); break;
    case 'favorite': state.favorites = state.favorites.includes(id) ? state.favorites.filter(item => item !== id) : [...state.favorites,id]; persist(); render(); break;
    case 'detail': showDetail(id); break;
    case 'close-detail': state.detail = null; render(); break;
    case 'add': add(id); break;
    case 'add-timer':
      state.draft.items.push({exerciseId:null,sets:8,work:20,rest:10});
      persist(); render(); break;
    case 'replace':
      if (!state.draft.items[index]) break;
      state.replaceIndex = index;
      state.search = ''; state.bodyParts = []; state.equipmentGroups = ['mat']; state.types = ['strength']; state.onlyFavorites = false; state.limit = 24;
      state.page = 'library'; render(); window.scrollTo(0,0); break;
    case 'replace-auto': {
      if (!validGenerationFilters(state.draft.generationFilters) || !state.draft.items[index]) break;
      try {
        state.draft.items[index].exerciseId = automaticReplacement(exercises, state.draft.items, index, state.draft.generationFilters);
      } catch (error) {
        notify(error.message);
        break;
      }
      warning = '';
      persist(); render(); break;
    }
    case 'cancel-replace': state.replaceIndex = null; state.page = 'session'; state.detail = null; render(); break;
    case 'resume': {
      if (state.resumeRunner) {
        state.runner = state.resumeRunner;
        state.resumeRunner = null;
      }
      if (!state.runner) break;
      if (state.runner.paused) {
        state.runner.paused = false;
        state.runner.startedAt = Date.now();
        lastRunnerCheckpoint = Date.now();
        speak('On reprend !');
        clearInterval(timerId);
        timerId = setInterval(tick, 200);
      } else if (state.runner.timeline[state.runner.index]) {
        tick();
      }
      state.runnerVisible = true;
      persist(); render(); break;
    }
    case 'adjust': {
      const item = state.draft.items[index];
      const field = button.dataset.field;
      const bounds = {sets:[1,MAX_SETS], work:[5,600], rest:[0,300]};
      if (!item || !bounds[field]) break;
      const [min,max] = bounds[field];
      item[field] = Math.max(min, Math.min(max, (item[field] ?? 0) + Number(button.dataset.delta)));
      persist(); render(); break;
    }
    case 'remove': state.draft.items.splice(index,1); persist(); render(); break;
    case 'clear-all':
      if (!state.draft.items.length || !confirm('Supprimer tous les blocs de cette séance ?')) break;
      state.draft.items = [];
      state.replaceIndex = null;
      persist(); render(); break;
    case 'move-up': case 'move-down': {
      const target = index + (action === 'move-up' ? -1 : 1);
      if (target >= 0 && target < state.draft.items.length) [state.draft.items[index],state.draft.items[target]] = [state.draft.items[target],state.draft.items[index]];
      persist(); render(); break;
    }
    case 'new':
      if (state.draft.items.length && !confirm('Créer une nouvelle séance ? Les modifications non enregistrées de la séance actuelle seront perdues.')) break;
      state.draft = {id:null,name:'Ma séance',items:[]}; state.page = 'session'; persist(); render(); break;
    case 'save': save(); break;
    case 'export-draft': downloadSession(state.draft); break;
    case 'export-saved': {
      const session = state.sessions.find(item => item.id === id);
      if (session) downloadSession(session);
      break;
    }
    case 'load': {
      const session = state.sessions.find(item => item.id === id);
      if (!session) break;
      if (state.draft.items.length && !confirm('Ouvrir cette séance ? Les modifications non enregistrées de la séance actuelle seront perdues.')) break;
      state.draft = structuredClone(session); state.page = 'session'; persist(); render(); break;
    }
    case 'delete':
      if (confirm('Supprimer définitivement cette séance enregistrée ?')) { state.sessions = state.sessions.filter(item => item.id !== id); if (state.draft.id === id) state.draft.id = null; persist(); render(); } break;
    case 'start':
      if ((state.runner || state.resumeRunner) && !confirm('Démarrer une nouvelle séance ? La progression de la séance en cours sera perdue.')) break;
      start(); break;
    case 'restart-runner': {
      const runner = state.runner || state.resumeRunner;
      if (!runner || !confirm('Redémarrer cette séance ? Sa progression actuelle sera perdue.')) break;
      start(runner.items, runner.name); break;
    }
    case 'delete-runner':
      if (!(state.runner || state.resumeRunner) || !confirm('Supprimer la progression de cette séance ?')) break;
      clearInterval(timerId);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      state.runner = null;
      state.resumeRunner = null;
      state.runnerVisible = false;
      persist(); render(); break;
    case 'pause': {
      const r = state.runner;
      if (!r.paused) { tick(); if (!state.runner.timeline[state.runner.index]) break; r.elapsed += (Date.now() - r.startedAt) / 1000; r.paused = true; speak('Pause.'); }
      else { r.startedAt = Date.now(); r.paused = false; speak('On reprend !'); }
      persist(); render(); break;
    }
    case 'skip': {
      const r = state.runner;
      advanceRunner(r.index + 1); break;
    }
    case 'skip-exercise': {
      const r = state.runner;
      const phase = r.timeline[r.index];
      if (!phase) break;
      const nextIndex = r.timeline.findIndex((item,i) => i > r.index && item.itemIndex > phase.itemIndex);
      advanceRunner(nextIndex === -1 ? r.timeline.length : nextIndex); break;
    }
    case 'leave-runner':
      if (!state.runner.paused) {
        tick();
        if (!state.runner.timeline[state.runner.index]) { render(); break; }
        state.runner.elapsed += (Date.now() - state.runner.startedAt) / 1000;
        state.runner.paused = true;
      }
      clearInterval(timerId);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      state.resumeRunner = restoreRunner(snapshotRunner(state.runner));
      state.runner = null;
      state.runnerVisible = false;
      persist(); render(); break;
    case 'background-runner':
      state.runnerVisible = false;
      persist(); render(); break;
    case 'stop': clearInterval(timerId); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); state.runner = null; state.resumeRunner = null; state.runnerVisible = false; persist(); render(); break;
  }
});
app.addEventListener('input', event => {
  if (event.target.dataset.search) {
    const scope = event.target.dataset.search;
    const filters = scope === 'generator' ? state.generatorFilters : state;
    filters.search = event.target.value; state.limit = 24;
    const position = event.target.selectionStart;
    render();
    const input = document.querySelector(`[data-search="${scope}"]`); input.focus(); input.setSelectionRange(position,position);
  } else if (event.target.id === 'generator-minutes') state.generatorMinutes = event.target.value;
});
app.addEventListener('submit', event => {
  if (event.target.id === 'log-form') { event.preventDefault(); submitLog(); return; }
  if (event.target.id !== 'generator') return;
  event.preventDefault();
  let items;
  try { items = generateSession(exercises, Number(state.generatorMinutes), state.generatorFilters); }
  catch (error) { notify(error.message); return; }
  if (state.draft.items.length && !confirm('Remplacer la séance actuelle ? Les modifications non enregistrées seront perdues.')) return;
  state.draft = {id:null, name:'Séance générée', items, generationFilters:structuredClone(state.generatorFilters)};
  state.page = 'session';
  persist();
  render();
});
app.addEventListener('change', event => {
  const target = event.target;
  if (target.id === 'session-file' && target.files.length) {
    const file = target.files[0];
    target.value = '';
    loadSessionFile(file);
    return;
  }
  if (state.logDraft && target.dataset.log) { state.logDraft[target.dataset.log] = target.value; return; }
  if (state.logDraft && target.dataset.entryEx !== undefined) {
    const entry = state.logDraft.entries[Number(target.dataset.entryEx)];
    const match = exercises.find(e => e.name === target.value.trim());
    entry.exerciseId = match ? match.id : null; entry.text = target.value;
    return;
  }
  if (state.logDraft && target.dataset.set !== undefined) {
    state.logDraft.entries[Number(target.dataset.entry)].sets[Number(target.dataset.set)][target.dataset.field] = target.value;
    return;
  }
  if (target.dataset.bodyPart) {
    const filters = target.dataset.bodyPart === 'generator' ? state.generatorFilters : state;
    filters.bodyParts = target.checked ? [...filters.bodyParts, target.value] : filters.bodyParts.filter(bodyPart => bodyPart !== target.value);
    state.limit = 24; render(); return;
  }
  if (target.dataset.equipmentGroup) {
    const filters = target.dataset.equipmentGroup === 'generator' ? state.generatorFilters : state;
    filters.equipmentGroups = target.checked ? [...filters.equipmentGroups, target.value] : filters.equipmentGroups.filter(group => group !== target.value);
    state.limit = 24; render(); return;
  }
  if (target.dataset.exerciseType) {
    const filters = target.dataset.exerciseType === 'generator' ? state.generatorFilters : state;
    filters.types = target.checked ? [...filters.types, target.value] : filters.types.filter(type => type !== target.value);
    state.limit = 24; render(); return;
  }
  if (target.dataset.filter) { const filters = target.dataset.scope === 'generator' ? state.generatorFilters : state; filters[target.dataset.filter] = target.value; state.limit = 24; render(); }
  if (target.dataset.item !== undefined) {
    const item = state.draft.items[Number(target.dataset.item)];
    const field = target.dataset.field;
    const value = Number(target.value);
    const candidate = {...item,[field]:value};
    if (!target.value || !validateItem(candidate)) {
      target.value = item[field];
      notify(`Valeurs autorisées : 1 à ${MAX_SETS} séries, 5 à 600 secondes d’effort et 0 à 300 secondes de repos.`);
    } else { item[field] = value; persist(); render(); }
  }
});
app.addEventListener('error', event => {
  if (event.target.matches?.('.card-image')) event.target.hidden = true;
  else if (event.target.matches?.('.exercise-image img')) event.target.hidden = true;
  else if (event.target.matches?.('.detail-images img')) {
    event.target.alt = 'Image indisponible : vérifiez votre connexion Internet.';
    event.target.classList.add('image-unavailable');
  }
}, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && (state.chart || state.detail)) { if (state.chart) state.chart = null; else state.detail = null; render(); }
});
window.addEventListener('pagehide', () => {
  if (!state.runner) return;
  persist();
});
if (state.runner && state.runner.timeline[state.runner.index]) {
  lastRunnerCheckpoint = Date.now();
  timerId = setInterval(tick, 200);
}
render();
