import { exercises, exerciseById } from './exercises.js';
import { STORAGE_KEY, GENERATOR_KEYWORDS, generateSession, recommend, validateItem, exportSession, importSession, makeTimeline, formatTime, locatePhase } from './core.js';
import { getAnimation, saveAnimation, deleteAnimation } from './animations.js';

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
const validItems = items => Array.isArray(items) && items.every(item => validateItem(item) && byId(item.exerciseId));
const state = {
  page:'library', search:'', category:'Toutes', equipment:'Tous', muscle:'Tous', sort:'name', onlyFavorites:false, limit:24,
  favorites:Array.isArray(saved.favorites) ? saved.favorites.filter(id => byId(id)) : [],
  sessions:Array.isArray(saved.sessions) ? saved.sessions.filter(session => session && typeof session.id === 'string' && typeof session.name === 'string' && validItems(session.items)) : [],
  draft:saved.draft && typeof saved.draft.name === 'string' && validItems(saved.draft.items) ? saved.draft : {id:null, name:'Ma séance', items:[]},
  sound:saved.sound !== false, detail:null, runner:null, animationUrl:null,
  generatorMinutes:'20', generatorText:'', generatorKeywords:[]
};
let timerId;

function clearAnimation() {
  if (state.animationUrl) URL.revokeObjectURL(state.animationUrl);
  state.animationUrl = null;
}
async function showDetail(id) {
  clearAnimation();
  state.detail = id;
  render();
  try {
    const file = await getAnimation(id);
    if (state.detail === id && file) { clearAnimation(); state.animationUrl = URL.createObjectURL(file); render(); }
  } catch {
    if (state.detail === id) notify('Impossible de lire les animations enregistrées dans ce navigateur.');
  }
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({favorites:state.favorites, sessions:state.sessions, draft:state.draft, sound:state.sound}));
  } catch {
    warning = 'Enregistrement impossible : le stockage local est indisponible ou plein.';
  }
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
  return `<div class="layout"><aside class="sidebar"><div class="brand"><span class="brand-mark">✳</span><div>fitness<span>maker</span><small>VOTRE ESPACE À VOUS</small></div></div><div class="nav-label">ESPACE PERSONNEL</div><nav aria-label="Navigation principale">${navButton('library','▦','Bibliothèque')}${navButton('session','◫','Ma séance')}${navButton('saved','♡','Mes séances')}</nav><div class="sidebar-bottom"><span>✦</span><div><strong>À votre rythme.</strong><p>Chaque mouvement compte.</p></div></div></aside><main><header class="topbar"><span>VOTRE ESPACE FITNESS</span><button class="sound-toggle" data-action="sound" aria-pressed="${state.sound}">${state.sound ? '♪ Son activé' : '♪ Son désactivé'}</button></header>${warning ? `<div class="notice" role="alert">${escapeHtml(warning)} <button data-action="dismiss" aria-label="Fermer">×</button></div>` : ''}<div class="content">${content}</div><footer>Conçu pour bouger à votre rythme · Données enregistrées dans ce navigateur · Exercise data by <a href="https://repdb.co" target="_blank" rel="noopener noreferrer">RepDB (repdb.co)</a></footer></main></div>${state.detail ? detailModal() : ''}${state.runner ? runnerModal() : ''}`;
}
function options(values, selected) {
  return values.map(value => `<option ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
}
function exerciseImage(exercise, className) {
  return `<div class="exercise-image ${className}">${exercise.images?.[0] ? `<img src="${escapeHtml(exercise.images[0])}" alt="" loading="lazy">` : ''}<span>Image indisponible</span></div>`;
}
function card(exercise, rec) {
  const favorite = state.favorites.includes(exercise.id);
  return `<article class="exercise-card"><div class="card-art"><span class="level">${escapeHtml(exercise.equipmentDetail)}</span><button class="favorite ${favorite ? 'selected' : ''}" data-action="favorite" data-id="${exercise.id}" aria-label="${favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} : ${escapeHtml(exercise.name)}" aria-pressed="${favorite}">${favorite ? '♥' : '♡'}</button><button class="art-button" data-action="detail" data-id="${exercise.id}" aria-label="Voir ${escapeHtml(exercise.name)}"><span class="art-symbol">✳</span><img class="card-image" src="${escapeHtml(exercise.images[0])}" alt="" loading="lazy"></button></div><div class="card-body"><div class="card-kicker">${exercise.category} <span>·</span> ${exercise.equipment}</div><h3>${escapeHtml(exercise.name)}</h3><div class="tags">${exercise.muscles.map(m => `<span>${escapeHtml(m)}</span>`).join('')}</div>${state.sort === 'relevance' ? `<p class="reason">✦ ${rec.reason}</p>` : ''}<div class="card-actions"><button class="text-button" data-action="detail" data-id="${exercise.id}">Voir l’exercice ↗</button><button class="add-button" data-action="add" data-id="${exercise.id}" aria-label="Ajouter ${escapeHtml(exercise.name)} à la séance">+</button></div></div></article>`;
}
function library() {
  const ranked = recommend(exercises, state.draft.items);
  const rank = new Map(ranked.map((entry,index) => [entry.exercise.id,{...entry,index}]));
  const filtered = exercises.filter(exercise => {
    const text = `${exercise.name} ${exercise.muscles.join(' ')} ${exercise.category}`.toLocaleLowerCase('fr');
    return text.includes(state.search.toLocaleLowerCase('fr').trim()) && (state.category === 'Toutes' || exercise.category === state.category) && (state.equipment === 'Tous' || exercise.equipment === state.equipment) && (state.muscle === 'Tous' || exercise.muscles.includes(state.muscle)) && (!state.onlyFavorites || state.favorites.includes(exercise.id));
  }).sort((a,b) => state.sort === 'relevance' ? (rank.get(a.id)?.index ?? 999) - (rank.get(b.id)?.index ?? 999) || a.name.localeCompare(b.name,'fr') : a.name.localeCompare(b.name,'fr'));
  const muscles = [...new Set(exercises.flatMap(e => e.muscles))].sort((a,b) => a.localeCompare(b,'fr'));
  return `<div class="eyebrow"><span></span> VOTRE ENTRAÎNEMENT COMMENCE ICI</div><div class="heading-row"><div><h1>Trouvez votre <em>mouvement.</em></h1><p class="intro">Explorez les exercices, composez une séance qui vous ressemble et avancez à votre rythme.</p></div><button class="primary heading-cta" data-page="session">Ma séance <span>↗</span></button></div><section class="library-section"><div class="section-heading"><div><div class="eyebrow muted">LA COLLECTION</div><h2>Bibliothèque <span class="count">${filtered.length}</span></h2></div><button class="filter-fav ${state.onlyFavorites ? 'selected' : ''}" data-action="filter-favorites" aria-pressed="${state.onlyFavorites}">♡ Favoris</button></div><div class="filters"><label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Rechercher (noms en anglais) ou muscle..." value="${escapeHtml(state.search)}" aria-label="Rechercher un exercice ou un muscle"></label><label><span class="sr-only">Catégorie</span><select data-filter="category">${options(['Toutes',...new Set(exercises.map(e => e.category))],state.category)}</select></label><label><span class="sr-only">Matériel</span><select data-filter="equipment">${options(['Tous','Sans poids','Avec poids','Autre matériel'],state.equipment)}</select></label><label><span class="sr-only">Muscle</span><select data-filter="muscle">${options(['Tous',...muscles],state.muscle)}</select></label><label><span class="sr-only">Trier par</span><select data-filter="sort"><option value="name" ${state.sort === 'name' ? 'selected' : ''}>Nom</option><option value="relevance" ${state.sort === 'relevance' ? 'selected' : ''}>Pertinence</option></select></label></div><div class="results-line"><span>${filtered.length} exercice${filtered.length > 1 ? 's' : ''} à découvrir</span><span>FAITES-VOUS PLAISIR ✳</span></div><div class="cards">${filtered.slice(0,state.limit).map(e => card(e,rank.get(e.id) || {reason:'Déjà dans votre séance'})).join('')}</div>${filtered.length > state.limit ? `<button class="secondary load-more" data-action="more">Afficher plus (${Math.min(state.limit,filtered.length)} / ${filtered.length})</button>` : ''}${filtered.length ? '' : '<div class="empty">Aucun exercice ne correspond à ces filtres.</div>'}</section>`;
}
function sessionPage() {
  const items = state.draft.items;
  const total = makeTimeline(items).reduce((sum, phase) => sum + phase.duration, 0);
  const suggestions = recommend(exercises,items).slice(0,3);
  return `<div class="eyebrow"><span></span> VOTRE PROGRAMME</div><div class="heading-row"><div><h1>À vous de <em>jouer.</em></h1><p class="intro">Composez votre séance, ajustez vos temps et lancez-vous.</p></div><button class="secondary" data-action="new">＋ Nouvelle séance</button></div>${generatorForm()}<section class="session-layout"><div><div class="panel session-header"><label for="session-name">NOM DE LA SÉANCE</label><input id="session-name" maxlength="80" value="${escapeHtml(state.draft.name)}" placeholder="Donnez un nom à votre séance"><div class="session-stats"><span><strong>${items.length}</strong> exercice${items.length > 1 ? 's' : ''}</span><span><strong>${formatTime(total)}</strong> durée estimée</span></div></div><div class="section-heading session-title"><h2>Votre séance <span class="count">${items.length}</span></h2><button class="text-button" data-page="library">＋ Ajouter des exercices</button></div>${items.length ? items.map((item,index) => {const e=byId(item.exerciseId); return `<article class="session-item"><div class="item-number">${String(index+1).padStart(2,'0')}</div>${exerciseImage(e,'item-image')}<div class="item-main"><div class="item-top"><div><div class="card-kicker">${e.category} · ${e.equipment}</div><h3>${e.name}</h3></div><div class="item-buttons"><button data-action="move-up" data-index="${index}" aria-label="Monter ${e.name}" ${index === 0 ? 'disabled' : ''}>↑</button><button data-action="move-down" data-index="${index}" aria-label="Descendre ${e.name}" ${index === items.length-1 ? 'disabled' : ''}>↓</button><button data-action="remove" data-index="${index}" aria-label="Retirer ${e.name}">×</button></div></div><div class="item-fields"><label>SÉRIES<input type="number" min="1" max="10" step="1" data-item="${index}" data-field="sets" value="${item.sets}"></label><label>EFFORT (SEC)<input type="number" min="5" max="600" step="1" data-item="${index}" data-field="work" value="${item.work}"></label><label>REPOS (SEC)<input type="number" min="0" max="300" step="1" data-item="${index}" data-field="rest" value="${item.rest}"></label></div></div></article>`;}).join('') : '<div class="empty"><strong>Votre séance prend forme ici.</strong><p>Choisissez vos premiers exercices dans la bibliothèque.</p><button class="secondary" data-page="library">Explorer les exercices ↗</button></div>'}</div><aside class="session-aside"><div class="panel launch-panel"><div class="eyebrow muted">PRÊT QUAND VOUS L’ÊTES</div><h2>On se lance ?</h2><p>Votre chronomètre vous accompagne à chaque étape.</p><button class="primary full" data-action="start" ${items.length ? '' : 'disabled'}>▶ &nbsp; Démarrer la séance</button><button class="secondary full" data-action="save" ${items.length ? '' : 'disabled'}>♡ &nbsp; Enregistrer la séance</button><button class="secondary full" data-action="export-draft" ${items.length ? '' : 'disabled'}>Exporter en JSON</button></div><div class="panel suggestion-panel"><div class="eyebrow muted">POUR ALLER PLUS LOIN</div><h2>À essayer <span>✦</span></h2><p>Des idées pour varier votre séance.</p>${suggestions.map(({exercise,reason}) => `<div class="suggestion"><div><strong>${exercise.name}</strong><small>${reason}</small></div><button class="add-button" data-action="add" data-id="${exercise.id}" aria-label="Ajouter ${exercise.name}">+</button></div>`).join('')}</div></aside></section>`;
}
function generatorForm() {
  return `<form class="panel generator" id="generator"><div class="eyebrow muted">VOTRE SÉANCE SUR MESURE</div><h2>Générer une séance ✦</h2><p>Choisissez une durée, repos compris, et vos objectifs. Vérifiez le matériel et adaptez les exercices à votre niveau.</p><div class="generator-fields"><label>Durée totale (minutes)<input id="generator-minutes" type="number" min="5" max="120" step="1" required value="${escapeHtml(state.generatorMinutes)}"></label><label>Autres mots-clés<input id="generator-text" type="text" value="${escapeHtml(state.generatorText)}" placeholder="Ex. squat, biceps, pull up"></label></div><p>Séparez les mots-clés par des virgules ; les noms d’exercices sont en anglais.</p><fieldset><legend>Mots-clés proposés</legend><div class="keyword-list">${GENERATOR_KEYWORDS.map(keyword => `<label><input type="checkbox" name="keyword" value="${keyword}" ${state.generatorKeywords.includes(keyword) ? 'checked' : ''}> ${keyword}</label>`).join('')}</div></fieldset><button class="primary" type="submit">Générer ma séance ↗</button></form>`;
}
function savedPage() {
  return `<div class="eyebrow"><span></span> VOTRE COLLECTION</div><div class="heading-row"><div><h1>Vos séances, <em>à retrouver.</em></h1><p class="intro">Tous vos programmes enregistrés, prêts à être repris.</p></div><div class="collection-actions"><label class="secondary import-session">Importer un JSON<input id="session-file" type="file" accept=".json,application/json"></label><button class="primary" data-action="new">＋ Nouvelle séance</button></div></div><div class="saved-grid">${state.sessions.length ? state.sessions.map(session => `<article class="panel saved-card"><div class="eyebrow muted">SÉANCE ENREGISTRÉE</div><h2>${escapeHtml(session.name)}</h2><p>${session.items.length} exercice${session.items.length > 1 ? 's' : ''} · ${formatTime(makeTimeline(session.items).reduce((sum,phase) => sum + phase.duration,0))}</p><div class="tags">${session.items.slice(0,3).map(item => `<span>${byId(item.exerciseId).name}</span>`).join('')}</div><div class="saved-actions"><button class="primary" data-action="load" data-id="${escapeHtml(session.id)}">Ouvrir ↗</button><button class="text-button" data-action="export-saved" data-id="${escapeHtml(session.id)}">Exporter JSON</button><button class="text-button danger" data-action="delete" data-id="${escapeHtml(session.id)}">Supprimer</button></div></article>`).join('') : '<div class="empty"><strong>Pas encore de séance enregistrée.</strong><p>Créez votre premier programme et retrouvez-le ici.</p><button class="secondary" data-page="library">Explorer les exercices ↗</button></div>'}</div>`;
}
function detailModal() {
  const exercise = byId(state.detail);
  return `<div class="overlay"><section class="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button class="close" data-action="close-detail" aria-label="Fermer">×</button><div class="detail-art">${state.animationUrl ? `<img class="exercise-animation" src="${state.animationUrl}" alt="Animation de ${escapeHtml(exercise.name)}">` : exercise.images?.length ? `<div class="detail-images">${exercise.images.map((image,index) => `<img src="${escapeHtml(image)}" alt="${escapeHtml(exercise.name)} : ${exercise.images.length > 1 ? index ? 'position finale' : 'position initiale' : 'position'}">`).join('')}</div>` : '<span class="art-symbol">✳</span>'}<label class="secondary upload-animation">Importer une animation<input id="animation-file" type="file" accept="image/gif,image/webp,image/png"></label>${state.animationUrl ? '<button class="text-button" data-action="delete-animation">Supprimer mon animation</button>' : ''}<span>Importez un fichier dont vous détenez les droits. Il reste dans ce navigateur.</span></div><div class="detail-content"><div class="eyebrow muted">${exercise.category} · ${exercise.equipmentDetail}</div><h2 id="detail-title">${escapeHtml(exercise.name)}</h2><div class="tags">${exercise.muscles.map(m => `<span>${escapeHtml(m)}</span>`).join('')}</div><h3>Le mouvement, étape par étape${exercise.images ? ' (en anglais)' : ''}</h3><ol>${exercise.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol><button class="primary full" data-action="add" data-id="${exercise.id}">＋ Ajouter à ma séance</button></div></section></div>`;
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
  return `<div class="overlay runner-overlay"><section class="modal runner" role="dialog" aria-modal="true" aria-labelledby="runner-title"><button class="close" data-action="stop" aria-label="Fermer le chronomètre">×</button><div class="eyebrow"><span></span> ${done ? 'SÉANCE TERMINÉE' : phase.type === 'work' ? 'C’EST À VOUS' : 'REPRENEZ VOTRE SOUFFLE'}</div><h2 id="runner-title">${done ? 'Bravo, vous l’avez fait !' : phase.type === 'work' ? escapeHtml(exercise.name) : 'Temps de repos'}</h2><p>${done ? 'Chaque mouvement compte. À bientôt !' : phase.type === 'work' ? `Série ${phase.set} sur ${phase.sets}` : next ? `À suivre : ${escapeHtml(byId(next.exerciseId).name)} · série ${next.set}/${next.sets}` : ''}</p>${exercise ? `<div class="runner-current">${exerciseImage(exercise,'runner-image')}<strong>${escapeHtml(exercise.name)}</strong></div>` : ''}<div class="timer-ring ${phase?.type === 'rest' ? 'rest' : ''}"><span id="timer-display" role="timer">${formatTime(runner.remaining)}</span><small>${done ? 'BIEN JOUÉ' : runner.paused ? 'EN PAUSE' : phase.type === 'work' ? 'EFFORT' : 'REPOS'}</small></div><div class="runner-progress"><label for="session-progress">Progression de la séance ${done ? '· terminée' : `· exercice ${phase.itemIndex + 1} / ${runner.items.length}`}</label><progress id="session-progress" max="${total}" value="${elapsed}"></progress><small>Étape ${done ? runner.timeline.length : runner.index + 1} / ${runner.timeline.length}</small></div>${done ? '<button class="primary" data-action="stop">Terminer</button>' : `<div class="runner-actions"><button class="secondary" data-action="pause">${runner.paused ? '▶ Reprendre' : 'Ⅱ Pause'}</button><button class="text-button" data-action="skip">Passer ↗</button></div>${upcoming.length ? `<div class="runner-upcoming"><h3>Exercices suivants</h3><div class="upcoming-list">${upcoming.map(item => { const e = byId(item.exerciseId); return `<div class="upcoming-item">${exerciseImage(e,'upcoming-image')}<span>${escapeHtml(e.name)}</span></div>`; }).join('')}</div></div>` : ''}`}</section></div>`;
}
function render() {
  app.innerHTML = shell(state.page === 'library' ? library() : state.page === 'session' ? sessionPage() : savedPage());
}
function add(id) {
  if (!byId(id)) return;
  state.draft.items.push({exerciseId:id,sets:3,work:40,rest:20});
  state.detail = null;
  clearAnimation();
  persist();
  render();
}
function save() {
  const name = state.draft.name.trim();
  if (!name) return notify('Donnez un nom à votre séance avant de l’enregistrer.');
  if (!state.draft.items.length) return notify('Ajoutez au moins un exercice avant d’enregistrer.');
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
  if (!session.items.length || !validItems(session.items)) return notify('Vérifiez les exercices avant d’exporter la séance.');
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
function start() {
  if (!state.draft.items.length || !validItems(state.draft.items)) return notify('Vérifiez les exercices et leurs durées avant de démarrer.');
  const timeline = makeTimeline(state.draft.items);
  state.runner = {timeline,items:structuredClone(state.draft.items),index:0,remaining:timeline[0].duration,elapsed:0,startedAt:Date.now(),paused:false};
  speak(`C'est parti ! ${byId(timeline[0].exerciseId).name}`);
  clearInterval(timerId);
  timerId = setInterval(tick, 200);
  render();
}
function announcePhase() {
  const r = state.runner;
  const phase = r.timeline[r.index];
  if (!phase) { clearInterval(timerId); speak('Bravo, séance terminée !'); }
  else if (phase.type === 'rest') speak('Pause, prenez votre souffle.');
  else speak(`C'est parti ! ${byId(phase.exerciseId).name}`);
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
    render();
  } else {
    r.remaining = current.remaining;
    const display = document.querySelector('#timer-display');
    if (display) display.textContent = formatTime(r.remaining);
    const progress = document.querySelector('#session-progress');
    if (progress) progress.value = r.timeline.slice(0,r.index).reduce((sum, phase) => sum + phase.duration, 0) + r.timeline[r.index].duration - r.remaining;
  }
}
app.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.page) { state.page = button.dataset.page; state.detail = null; clearAnimation(); render(); window.scrollTo(0,0); return; }
  const {action,id} = button.dataset;
  const index = Number(button.dataset.index);
  switch (action) {
    case 'dismiss': warning = ''; render(); break;
    case 'sound': state.sound = !state.sound; if (!state.sound && 'speechSynthesis' in window) window.speechSynthesis.cancel(); persist(); render(); break;
    case 'filter-favorites': state.onlyFavorites = !state.onlyFavorites; state.limit = 24; render(); break;
    case 'more': state.limit += 24; render(); break;
    case 'favorite': state.favorites = state.favorites.includes(id) ? state.favorites.filter(item => item !== id) : [...state.favorites,id]; persist(); render(); break;
    case 'detail': showDetail(id); break;
    case 'close-detail': state.detail = null; clearAnimation(); render(); break;
    case 'delete-animation': {
      const exerciseId = state.detail;
      deleteAnimation(exerciseId).then(() => {
        if (state.detail === exerciseId) { clearAnimation(); render(); }
      }).catch(() => notify('Impossible de supprimer cette animation du navigateur.'));
      break;
    }
    case 'add': add(id); break;
    case 'remove': state.draft.items.splice(index,1); persist(); render(); break;
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
    case 'start': start(); break;
    case 'pause': {
      const r = state.runner;
      if (!r.paused) { tick(); if (!state.runner.timeline[state.runner.index]) break; r.elapsed += (Date.now() - r.startedAt) / 1000; r.paused = true; speak('Pause.'); }
      else { r.startedAt = Date.now(); r.paused = false; speak('On reprend !'); }
      render(); break;
    }
    case 'skip': {
      const r = state.runner;
      r.index++;
      r.elapsed = r.timeline.slice(0,r.index).reduce((sum,phase) => sum + phase.duration,0);
      r.startedAt = Date.now();
      r.remaining = r.timeline[r.index]?.duration || 0;
      announcePhase(); render(); break;
    }
    case 'stop': clearInterval(timerId); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); state.runner = null; render(); break;
  }
});
app.addEventListener('input', event => {
  if (event.target.id === 'search') {
    state.search = event.target.value; state.limit = 24;
    const position = event.target.selectionStart;
    render();
    const input = document.querySelector('#search'); input.focus(); input.setSelectionRange(position,position);
  } else if (event.target.id === 'session-name') { state.draft.name = event.target.value; persist(); }
  else if (event.target.id === 'generator-minutes') state.generatorMinutes = event.target.value;
  else if (event.target.id === 'generator-text') state.generatorText = event.target.value;
});
app.addEventListener('submit', event => {
  if (event.target.id !== 'generator') return;
  event.preventDefault();
  const keywords = [...state.generatorKeywords, ...state.generatorText.split(/[,;]+/)];
  let items;
  try { items = generateSession(exercises, Number(state.generatorMinutes), keywords); }
  catch (error) { notify(error.message); return; }
  if (state.draft.items.length && !confirm('Remplacer la séance actuelle ? Les modifications non enregistrées seront perdues.')) return;
  state.draft = {id:null, name:'Séance générée', items};
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
  if (target.name === 'keyword') {
    state.generatorKeywords = target.checked ? [...state.generatorKeywords, target.value] : state.generatorKeywords.filter(keyword => keyword !== target.value);
  }
  if (target.id === 'animation-file' && target.files.length) {
    const file = target.files[0];
    const exerciseId = state.detail;
    if (!['image/gif', 'image/webp', 'image/png'].includes(file.type)) return notify('Choisissez une image GIF, WebP ou PNG.');
    saveAnimation(exerciseId, file).then(() => {
      if (state.detail === exerciseId) { clearAnimation(); state.animationUrl = URL.createObjectURL(file); render(); }
    }).catch(() => notify('Impossible d’enregistrer cette animation : stockage indisponible ou plein.'));
  }
  if (target.dataset.filter) { state[target.dataset.filter] = target.value; state.limit = 24; render(); }
  if (target.dataset.item !== undefined) {
    const item = state.draft.items[Number(target.dataset.item)];
    const field = target.dataset.field;
    const value = Number(target.value);
    const candidate = {...item,[field]:value};
    if (!target.value || !validateItem(candidate)) {
      target.value = item[field];
      notify('Valeurs autorisées : 1 à 10 séries, 5 à 600 secondes d’effort et 0 à 300 secondes de repos.');
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
  if (event.key === 'Escape' && state.detail) { state.detail = null; clearAnimation(); render(); }
});
render();
