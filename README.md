# Fitness Maker

Une application statique pour composer et suivre des séances à son rythme.

## Utilisation

- Parcourez les 1 324 exercices et filtrez par catégorie, matériel, muscle ou favoris. Les noms du jeu de données sont en anglais ; les instructions sont en français.
- Ajoutez des exercices, réglez les séries et les temps d'effort et de repos, puis nommez et enregistrez la séance. Les suggestions privilégient la variété des muscles et catégories ; elles ne constituent pas un conseil médical ou un programme personnalisé.
- Dans « Ma séance », générez un brouillon de 5 à 120 minutes, repos compris, à partir de mots-clés proposés ou de termes libres séparés par des virgules (les noms d'exercices sont en anglais). La génération remplace le brouillon après confirmation. Les séries et temps sont modifiables ; vérifiez le matériel et adaptez la séance à votre niveau.
- Lancez le chronomètre : pause, reprise et passage à l'étape suivante sont disponibles. La synthèse vocale française dépend du navigateur et peut être désactivée. Le minuteur utilise l'heure réelle même si l'onglet est en arrière-plan ; les annonces intermédiaires ne sont pas garanties si le navigateur suspend l'onglet.
- Les séances, le brouillon et les favoris sont stockés uniquement dans le navigateur, sans synchronisation ni sauvegarde en ligne. Effacer les données du navigateur les supprime.

Adaptez l'effort à vos capacités, arrêtez en cas de douleur et demandez conseil à un professionnel de santé si nécessaire.

## Démarrage local

Avec Node.js 22 ou plus récent :

```sh
python3 -m http.server 8000
```

Ouvrir http://localhost:8000. Pour les tests : `npm test`. Aucune dépendance npm n'est nécessaire.

## Publication GitHub Pages

Après fusion sur `main`, le workflow `.github/workflows/pages.yml` exécute les tests et déploie le site via GitHub Actions. Dans **Settings → Pages**, sélectionner **GitHub Actions** comme source. Une première activation peut nécessiter les droits d'administration du dépôt.

Le dépôt est privé : GitHub Pages pour les dépôts privés dépend de l'offre GitHub et des réglages de l'organisation. La visibilité du dépôt ne garantit pas celle du site : vérifier les paramètres et les conditions de publication avant d'activer Pages. Si Pages n'est pas disponible pour ce dépôt, adapter l'offre ou choisir un hébergement adapté.

## Données et animations

Les données proviennent de [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), révision `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`. Les données et instructions sont sous licence MIT ; voir [LICENSE-DATA](LICENSE-DATA). Pour actualiser les données, télécharger le fichier `data/exercises.json` de cette révision et exécuter `node generate-data.mjs chemin/vers/exercises.json`.

Chaque fiche permet d'importer et d'afficher une animation GIF, WebP ou PNG dont vous détenez les droits. Le fichier est conservé dans le stockage local du navigateur (IndexedDB), sans synchronisation ; effacer les données du navigateur le supprime. Il peut aussi être supprimé depuis la fiche.

Les animations du catalogue d'origine ne sont pas incluses : elles appartiennent à **© Gym visual — https://gymvisual.com/** et nécessitent une autorisation distincte pour leur réutilisation, même dans un projet personnel. Chaque fiche conserve un lien vers l'animation d'origine. Pour les importer, obtenir les droits nécessaires auprès de Gym visual et respecter ses conditions.
