# Fitness Maker

Une application statique pour composer et suivre des séances à son rythme.

## Utilisation

- Parcourez les 708 exercices RepDB et filtrez par une ou plusieurs parties du corps (dos, abdos, fessiers, mollets, cuisses, bras, épaules et pectoraux), matériel ou favoris. Sans partie sélectionnée, elles sont toutes incluses. La recherche accepte les noms anglais, les muscles et des termes français courants comme « pompes », « tractions » ou « développé couché » ; les noms restent en anglais. Le tri par pertinence privilégie la variété et ne constitue pas un conseil médical.
- Dans la bibliothèque et le générateur, filtrez par renforcement, étirement et/ou mobilité. Sans sélection, tous les types d'exercice sont affichés, y compris le cardio. Certains mouvements combinent étirement et mobilité.
- Ajoutez des exercices depuis la bibliothèque, réglez les séries et les temps d'effort et de repos dans « Ma séance » avec les boutons +/− ou les champs, puis nommez et enregistrez la séance. Le bouton « Remplacer cet exercice » ouvre la bibliothèque et conserve ses réglages ; l'opération peut être annulée.
- Dans « Générateur », créez un brouillon de 5 à 120 minutes, repos compris, avec les mêmes filtres que la bibliothèque. Sélectionnez le matériel disponible : un exercice ne correspond que si tout son matériel obligatoire est disponible. Les exercices sans matériel sont toujours inclus ; sans sélection, ils sont les seuls affichés. Par défaut, seul le tapis est sélectionné ; il est facultatif pour les exercices au sol. Les filtres « Barres de musculation » (barre droite, EZ et trap) et « Barres de traction et dips » sont distincts. « Machines » regroupe les autres équipements de salle. La génération remplace le brouillon après confirmation et ouvre « Ma séance » pour le modifier ; vérifiez le matériel et adaptez la séance à votre niveau.
- Dans une séance générée, « Remplacer automatiquement » choisit un exercice absent de la séance qui respecte les filtres utilisés lors de sa génération, en conservant les réglages. Si aucun autre exercice ne convient, la séance reste inchangée. Ces filtres sont conservés dans le brouillon, les séances enregistrées et les exports JSON.
- Lancez le chronomètre : pause, reprise et passage à l'étape suivante sont disponibles. La synthèse vocale française dépend du navigateur et peut être désactivée. Le minuteur utilise l'heure réelle même si l'onglet est en arrière-plan ; les annonces intermédiaires ne sont pas garanties si le navigateur suspend l'onglet.
- Pendant la séance, retrouvez les illustrations et le compteur de séries de l'exercice en cours, les exercices suivants et une barre de progression calculée sur la durée totale, repos compris. « Voir l’exercice » ouvre sa fiche sans interrompre le chronomètre. Les positions sont affichées dans l'ordre de départ puis de fin lorsqu'elles sont disponibles.
- Dans la fiche d'exercice, les instructions sont affichées en anglais.
- Exportez le brouillon depuis « Ma séance » ou une séance enregistrée depuis « Mes séances » au format JSON. Importez ce fichier dans « Mes séances » sur un autre appareil : une nouvelle copie est créée sans remplacer vos séances existantes. Le fichier contient le nom, les paramètres des exercices et les éventuels filtres de génération, pas les favoris ; les exercices doivent exister dans le catalogue de l'application.
- Les séances, le brouillon, les favoris et la progression d'une séance en cours sont stockés uniquement dans le navigateur, sans synchronisation ni sauvegarde en ligne. Une séance interrompue peut être reprise depuis « Ma séance ». Effacer les données du navigateur les supprime.
- Les séances et brouillons créés avant le changement de catalogue restent accessibles avec leurs exercices d'origine ; les anciens favoris restent stockés, mais ne figurent plus dans la bibliothèque RepDB.
- Les anciens objectifs de répétitions restent conservés dans les séances et exports existants, mais ne sont plus affichés ni utilisés.

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

## Données et images

Exercise data by [RepDB (repdb.co)](https://repdb.co). Le catalogue et les images fixes proviennent de [RepDB/exercise-dataset](https://github.com/RepDB/exercise-dataset), révision `f12da458a90f353a86c953f204304d5a8bd98275`, sous la [licence gratuite RepDB](https://github.com/RepDB/exercise-dataset/blob/f12da458a90f353a86c953f204304d5a8bd98275/LICENSE-DATA.md). Elle autorise l'utilisation dans une application avec attribution, mais interdit notamment la redistribution sous forme de jeu de données. Les illustrations sont chargées depuis GitHub et nécessitent une connexion Internet. Pour actualiser le catalogue, télécharger `exercises.json` de la révision choisie, exécuter `node generate-data.mjs chemin/vers/exercises.json` et actualiser la révision des images dans `exercises.js`.

Les anciennes séances conservent leurs données issues de [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) sous licence MIT ; voir [LICENSE-DATA](LICENSE-DATA). Elles ne chargent pas d'images Gym visual.

Les animations premium de RepDB ne sont pas incluses dans la licence gratuite.
