# Guide d'utilisation — Interface Admin PhysioQuiz

Ce guide explique comment utiliser chaque onglet et fonctionnalité de l'interface d'administration.

---

## Table des matières

1. [Dashboard](#1-dashboard)
2. [Base de données — Onglet Questions](#2-base-de-données--onglet-questions)
3. [Base de données — Onglets Cours, Vidéos, Fichiers](#3-base-de-données--onglets-cours-vidéos-fichiers)
4. [Import](#4-import)
5. [Flux de travail courants](#5-flux-de-travail-courants)

---

## 1. Dashboard

Le Dashboard affiche une vue d'ensemble agrégée de la plateforme. **Aucune donnée individuelle d'étudiant n'est affichée** — toutes les métriques sont anonymisées et agrégées.

### Cartes métriques

| Carte | Ce qu'elle affiche | Calcul |
|-------|-------------------|--------|
| **Questions** | `X / Y` | X = questions actives, Y = total de questions (actives + inactives) |
| **Chapitres** | Nombre | Nombre de chapitres actifs (niveau 1) |
| **Étudiants** | Nombre | Nombre total d'étudiants inscrits. Le tooltip montre : DAU (actifs aujourd'hui), WAU (actifs cette semaine), MAU (actifs ce mois) |
| **Sessions / sem.** | Nombre + tendance | Sessions terminées cette semaine. La flèche verte/rouge montre la variation en % par rapport à la semaine précédente : `(cette_semaine - semaine_précédente) / semaine_précédente × 100` |
| **Score moyen** | Pourcentage | Score moyen global sur toutes les sessions terminées. Le tooltip montre le nombre total de sessions |
| **Durée moy.** | Minutes | Durée moyenne par session, arrondie à la minute. Calculée à partir de `avg_session_duration_seconds / 60` |

### Alertes qualité

Deux types d'alertes apparaissent automatiquement :

- **Sans propositions** (bordure rouge) : questions qui ont 0 proposition/choix — elles ne peuvent pas être jouées par les étudiants.
- **Taux d'erreur élevé** (bordure orange) : questions avec un score moyen < 30% et au moins 1 tentative. Les alertes sont triées par impact : `nombre_tentatives × taux_erreur` (les plus problématiques en premier).

**Action :** Cliquer sur une alerte ouvre directement la question dans Base de données pour la corriger.

### Graphiques

- **Sessions par jour** : courbe sur 30 jours. Utilisez la barre de défilement en bas pour zoomer sur une période. Le tooltip montre le nombre de sessions et le score moyen du jour.
- **Performance par chapitre** : barres horizontales montrant le score moyen + le taux de couverture par chapitre. Trié du chapitre le plus difficile au plus facile. Le tooltip montre le nombre de sessions, les questions tentées vs total.

---

## 2. Base de données — Onglet Questions

C'est le coeur de l'administration : un **tableur Excel** (AG Grid) où chaque ligne est une question. Vous modifiez les questions directement dans le tableur, pas via un formulaire séparé.

### Colonnes du tableur

| Colonne | Comment modifier | Détail |
|---------|-----------------|--------|
| ☐ (case à cocher) | Cliquer | Sélectionner des questions pour les actions groupées |
| **Chapitre** | Double-cliquer → menu déroulant | Choisir parmi les chapitres existants |
| **Sous-chapitre** | Double-cliquer → menu déroulant | Choisir parmi les sous-chapitres du chapitre sélectionné |
| **Q#** | Lecture seule | Numéro de la question |
| **Énoncé** | Cliquer → popup | Modifier le texte de la question + gérer les images associées |
| **Propositions** | Cliquer → popup | Modifier les choix A, B, C, D, E |
| **Rép.** | Cliquer → popup | Cocher les bonnes réponses |
| **Expl.** | Cliquer → éditeur riche | Éditeur WYSIWYG pour l'explication (gras, italique, listes, images) |
| **Difficulté** | Double-cliquer → menu | Facile / Moyen / Difficile |
| **Active** | Cliquer la pastille | Basculer entre Actif (vert) et Inactif (gris) |
| **Tentatives** | Lecture seule | Nombre total de tentatives par les étudiants |
| **Score** | Lecture seule | Score moyen en %. Affiché en rouge si < 30% |
| **Vérifié** | Cliquer la pastille | Basculer entre « À vérifier » (orange) et « Vérifié » (vert) |

### Sauvegarde automatique

**Chaque modification est sauvegardée immédiatement** dans la base de données. Vous verrez brièvement « Enregistrement... » en haut. La question passe automatiquement en mode **brouillon** (ligne légèrement mise en évidence).

**Important :** les modifications ne sont PAS visibles par les étudiants tant que vous n'avez pas cliqué sur **Synchroniser**.

### Filtres

- **Chapitre** : filtre par chapitre (menu déroulant en haut)
- **Sous-chapitre** : filtre par sous-chapitre (apparaît après avoir choisi un chapitre)
- **Rechercher** : recherche plein texte dans les énoncés (avec un délai de 400ms)

Les filtres ne montrent que les chapitres/sous-chapitres qui contiennent au moins une question.

### Menu Actions (⋮)

Le menu en haut à droite (trois points) donne accès à :

- **+ Question** : ouvre un panneau latéral pour créer une nouvelle question de zéro
- **+ Chapitre / Sous-chapitre** : ouvre un formulaire pour créer un nouveau chapitre et/ou ses sous-chapitres (voir section 5)
- **Historique** : journal de toutes les modifications (qui a modifié quoi, quand), paginé par 50
- **Gérer chapitres** : voir tous les chapitres et sous-chapitres avec le nombre de questions dans chacun. Possibilité de supprimer ceux qui n'ont aucune question
- **Corbeille** : questions supprimées, récupérables pendant 7 jours. Après 7 jours, suppression définitive automatique
- **Détecter les doublons** : lance l'analyse de doublons (voir section 5.1)

### Synchroniser (publier les brouillons)

Le badge bleu en haut montre le nombre de modifications en attente (ex : « 5 modifications — Synchroniser »).

**Quand vous cliquez sur Synchroniser :**
1. Une fenêtre de confirmation s'ouvre listant toutes les modifications en attente
2. Les éléments marqués « À vérifier » (orange) sont signalés
3. Vous avez deux options :
   - **Publier** : publie uniquement les éléments marqués « Vérifié » (les non-vérifiés sont ignorés)
   - **Tout publier** : publie tout, y compris les non-vérifiés

Une fois publié, le badge passe à « À jour ✓ ».

---

## 3. Base de données — Onglets Cours, Vidéos, Fichiers

Les onglets **Cours** (résumés), **Vidéos** et **Fichiers** (fiches de révision) fonctionnent comme l'onglet Questions :

- Tableur AG Grid avec modification inline
- Filtres par chapitre/sous-chapitre et recherche
- Actions groupées : Activer, Désactiver, Supprimer, Modifier (déplacer vers un autre chapitre)
- Corbeille avec récupération pendant 7 jours
- Historique des modifications
- Système brouillon + Synchroniser indépendant par onglet
- Colonne « Vérifié » pour marquer les éléments relus

Chaque onglet a son propre compteur de brouillons et son propre bouton Synchroniser.

---

## 4. Import

L'onglet Import permet d'ajouter du contenu pédagogique en masse. Il a 4 sous-onglets :

### 4.1 Import de Questions

**Format attendu :** fichier `.docx` (Word) **standardisé** — c'est-à-dire passé au préalable par le script de prétraitement Python. Pour limiter les erreurs lors du traitement, structurez clairement votre document Word : chapitres bien séparés, sous-chapitres identifiés, chaque question avec son énoncé, ses propositions (A, B, C...), la ligne de réponses et l'explication.

**Étapes :**
1. Glissez le fichier `.docx` dans la zone de dépôt (ou cliquez pour le sélectionner)
2. Le fichier est analysé côté client — un aperçu s'affiche avec les statistiques :
   - Nombre de questions, questions actives, sous-chapitres, questions avec explication, images, chapitres
3. Les éventuels avertissements (questions sans réponse, format non standard) sont listés en orange
4. Cliquez **Importer X questions**
5. Les questions sont importées comme **inactives** et marquées **« À vérifier »** et en mode **brouillon**

**Après l'import :** allez dans Base de données, vérifiez les questions importées, activez-les, marquez-les comme vérifiées, puis synchronisez.

### 4.2 Import de Résumés (Cours)

1. Glissez un fichier `.docx`
2. Le contenu est converti en HTML avec aperçu
3. Modifiez le titre si nécessaire
4. Cliquez **Importer**
5. Le résumé est importé en mode brouillon + à vérifier

### 4.3 Import de Vidéos

Deux options :
- **Lien YouTube** : collez l'URL YouTube, donnez un titre, un aperçu de la vidéo s'affiche
- **Fichier vidéo** : uploadez un fichier `.mp4`, `.mov` ou `.webm`

Dans les deux cas, la vidéo est importée en mode brouillon + à vérifier.

### 4.4 Import de Fiches (Fiches de révision)

Même fonctionnement que les Résumés : fichier `.docx` → aperçu HTML → import.

---

## 5. Flux de travail courants

### 5.1 Vérifier les doublons après un import

Après avoir importé de nouvelles questions, il est conseillé de vérifier les doublons :

1. Allez dans **Base de données** > onglet **Questions**
2. Cliquez le menu **⋮** > **Détecter les doublons**
3. L'analyse parcourt **toutes** les questions (pas seulement celles filtrées). Deux questions sont considérées doublons si elles ont le même énoncé ET les mêmes propositions (insensible à la casse, aux accents et à l'ordre des propositions)
4. Si des doublons sont trouvés, une bannière orange apparaît : « X doublons détectés (Y groupes) »
5. Les questions doublons sont affichées avec des couleurs alternées par groupe pour les distinguer visuellement
6. **Pour traiter les doublons :** sélectionnez ceux à supprimer via les cases à cocher, puis utilisez le bouton **Supprimer** dans la barre d'actions groupées
7. Quand tous les doublons sont traités, le mode se désactive automatiquement. Vous pouvez aussi cliquer **Retirer le filtre** pour sortir manuellement

**Note :** pendant le mode doublons, les filtres (chapitre, sous-chapitre, recherche) sont désactivés car l'analyse porte sur toute la base.

### 5.2 Changer le chapitre/sous-chapitre de questions en masse

#### Cas 1 : Le chapitre et le sous-chapitre de destination existent déjà

1. Sélectionnez les questions à déplacer (cases à cocher à gauche)
2. La barre d'actions groupées apparaît avec le nombre de questions sélectionnées
3. Cliquez **Modifier...**
4. **Étape 1** : choisissez le chapitre de destination dans la liste
5. **Étape 2** : choisissez le sous-chapitre de destination
6. Les questions sont déplacées immédiatement
7. Une barre verte de confirmation apparaît : « X questions déplacées vers [sous-chapitre] »
8. Vous avez deux options :
   - **Valider** : confirmer le déplacement
   - **Annuler** : remettre toutes les questions dans leur chapitre d'origine

#### Cas 2 : Le chapitre ou sous-chapitre de destination n'existe pas encore

Vous devez d'abord créer le chapitre/sous-chapitre :

1. Cliquez le menu **⋮** > **+ Chapitre / Sous-chapitre**
2. Le formulaire permet deux choses :
   - **Créer un chapitre** : entrez le nom. Si un chapitre avec le même nom existe déjà (insensible à la casse), il sera réutilisé au lieu d'être créé en double
   - **Créer des sous-chapitres** : ajoutez un ou plusieurs sous-chapitres d'un coup. Les sous-chapitres qui existent déjà sous le même chapitre sont ignorés automatiquement
3. Une fois créé, revenez au tableur et utilisez **Modifier...** comme dans le Cas 1

**Astuce :** Vous pouvez aussi modifier le chapitre d'une question individuelle en double-cliquant sur la cellule Chapitre ou Sous-chapitre directement dans le tableur, mais uniquement pour sélectionner un chapitre/sous-chapitre qui existe déjà.

### 5.3 Modifier le chapitre/sous-chapitre directement dans le filtre

Quand vous avez sélectionné un chapitre dans le filtre, un petit crayon apparaît à droite du filtre. Cliquez dessus pour ouvrir le formulaire de modification du chapitre (renommer, désactiver, changer le parent).

### 5.4 Gérer les chapitres

Via le menu **⋮** > **Gérer chapitres** :

- Vous voyez tous les chapitres et sous-chapitres avec le nombre de questions dans chacun
- Vous pouvez **supprimer** un chapitre ou sous-chapitre uniquement s'il n'a aucune question ET aucune session associée
- Si un chapitre a des questions, le bouton Supprimer n'apparaît pas (le texte « a des questions » s'affiche)
- Si un chapitre a des sessions mais pas de questions, un message vous demande de le désactiver plutôt que de le supprimer

### 5.5 Créer une question manuellement

1. Menu **⋮** > **+ Question**
2. Un panneau latéral s'ouvre
3. Remplissez les champs : énoncé, propositions, réponses correctes, chapitre, difficulté, explication
4. Sauvegardez — la question est ajoutée au tableur

### 5.6 Activer / Désactiver des questions en masse

1. Sélectionnez les questions via les cases à cocher
2. Dans la barre d'actions :
   - **Activer** : rend les questions visibles aux étudiants (après synchronisation)
   - **Désactiver** : rend les questions invisibles. Un toast apparaît pendant 5 secondes pour annuler (« Restaurer »). Après 5 secondes, la désactivation est définitive (mais récupérable en filtrant les questions inactives)

### 5.7 Supprimer des questions

1. Sélectionnez les questions > **Supprimer**
2. Les questions sont mises à la **corbeille** (pas supprimées définitivement)
3. Récupérables pendant 7 jours via le menu **⋮** > **Corbeille**
4. Après 7 jours : suppression automatique définitive
5. **Protection anti-erreur** : si vous sélectionnez 50 questions ou plus, il faut taper le nombre exact pour confirmer

### 5.8 Vérifier et publier les modifications

Le flux de travail recommandé après un import ou des modifications :

1. Modifiez les questions dans le tableur
2. Marquez chaque question relue en cliquant sur **« À vérifier »** → elle passe à **« Vérifié »**
3. Quand vous êtes satisfaite, cliquez **Synchroniser**
4. La fenêtre montre la liste de toutes les modifications en attente, avec les éléments non vérifiés signalés en orange
5. Choisissez :
   - **Publier** : ne publie que les éléments vérifiés
   - **Tout publier** : publie tout
6. Les modifications deviennent visibles pour les étudiants

### 5.9 Modifier une question signalée dans les alertes qualité

1. Sur le Dashboard, dans la section **Alertes qualité**, cliquez sur l'alerte
2. Vous êtes redirigée automatiquement vers la question dans Base de données
3. Corrigez le problème (ajouter des propositions, reformuler la question, etc.)
4. La correction est sauvegardée automatiquement en brouillon
5. Synchronisez quand vous êtes prête

### 5.10 Consulter l'historique des modifications

Menu **⋮** > **Historique** : affiche le journal de toutes les modifications, classé par date (du plus récent au plus ancien).

Chaque entrée montre :
- Le champ modifié
- L'ancienne valeur → la nouvelle valeur
- Un aperçu du texte de la question
- Pour les déplacements groupés : la liste détaillée des questions déplacées avec leur chapitre d'origine

Le journal se charge par lots de 50 (cliquez « Charger plus » pour voir la suite).
