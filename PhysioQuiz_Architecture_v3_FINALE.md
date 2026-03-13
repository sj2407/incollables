# Architecture du Prototype — PhysioQuiz

## Document de spécifications techniques et fonctionnelles — v3 FINALE

### Destiné à servir de cahier des charges pour l'implémentation par Claude Code

---

## TABLE DES MATIÈRES

1. Vue d'ensemble du projet
2. Pipeline de gestion du contenu
3. Stack technique
4. Structure de la base de données
5. Algorithme de sélection intelligente des questions
5bis. Règles de notation (scoring partiel)
5ter. Pause / Resume (mode entraînement uniquement)
6. Indice de confiance
7. Mode examen blanc
8. Carte de chaleur des connaissances
9. Écrans de l'application
10. Statistiques et suivi de progression
11. Structure des fichiers du projet
12. Sécurité et bonnes pratiques
13. Workflow de développement et qualité
14. Plan de développement (Sprints détaillés)
15. Évolutions futures

---

## 1. Vue d'ensemble du projet

**PhysioQuiz** est une Progressive Web App (PWA) de révision par QCM destinée aux
étudiants en médecine, spécialisée en Physiologie. L'application s'appuie sur les
sciences cognitives (retrieval practice, spaced repetition, dual coding) pour
maximiser la rétention à long terme.

### 1.1 Périmètre du prototype (Phase 1)

- Inscription/connexion obligatoire des étudiants
- Navigation dans une hiérarchie de cours à 4+ niveaux
- 3 modes de session :
  - Session courte (10 ou 25 questions) avec sélection pondérée intelligente
  - Toutes les questions (ordre aléatoire uniforme)
  - Examen blanc (chronomètre strict, correction à la fin, aléatoire uniforme)
- Correction immédiate avec explication riche (texte + tableaux + images)
- Notation partielle (score proportionnel aux bonnes réponses cochées, annulé si une mauvaise est cochée)
- Pause/Resume en mode entraînement (pas en examen blanc)
- Indice de confiance optionnel (incité par les statistiques)
- Carte de chaleur des connaissances
- Statistiques de session et progression dans le temps
- Panneau d'administration (métriques agrégées, pas de tracking individuel)
- PWA installable sur mobile (iOS & Android)
- Orientation internationale (pas de suivi individuel des étudiants par l'admin)

### 1.2 Phase 2 (future)

- Vidéos de cours intégrées avec timestamps liés aux questions

---

## 2. Pipeline de gestion du contenu

### 2.1 Vue d'ensemble du pipeline

```
Documents originaux (.doc/.docx)
  Vos fichiers actuels — JAMAIS MODIFIÉS
        │
        ▼  Script de preprocessing (Python) → crée une COPIE
Documents standardisés (.docx)
  Copie avec format uniforme, images et tableaux préservés
  Nom : [original]_standardise.docx
        │
        ▼  Relecture humaine (par vous)
        │  Comparer l'original et la copie côte à côte
Documents validés (.docx)
  Source de vérité, éditables dans Word
        │
        ▼  Script d'import (Python)
Base de données (Supabase/PostgreSQL)
  + images extraites → Supabase Storage
```

**Principe fondamental** : le document original n'est jamais touché. Le script
crée toujours une copie à côté (ex: `PCEM_II_s_def3_standardise.docx`).
Vous comparez les deux côte à côte, puis validez la copie.

### 2.2 Format Word standardisé

```
═══════════════════════════════════════════════════════════
SECTION DE CHAPITRE
═══════════════════════════════════════════════════════════

[Titre du chapitre]                        ← Style Titre 1
[Titre du sous-chapitre]                   ← Style Titre 2
[Titre du sous-sous-chapitre]              ← Style Titre 3
(autant de niveaux que nécessaire)

═══════════════════════════════════════════════════════════
BLOC QUESTION (se répète pour chaque question)
═══════════════════════════════════════════════════════════

Question 1                                 ← Style Titre 4

Énoncé de la question

A.  Texte de la proposition A              ← JAMAIS en gras
B.  Texte de la proposition B
C.  Texte de la proposition C
D.  Texte de la proposition D
E.  Texte de la proposition E

Réponse : A, C, E                          ← Lettres majuscules, virgules, jamais en gras

Explication :                               ← Optionnel, absent si pas d'explication
Texte de l'explication...
Peut contenir des tableaux et des images (préservés tels quels).

---                                         ← Séparateur entre les questions
```

### 2.3 Règles de standardisation (preprocessing en 2 passes)

**PASSE 1 — Compléter les réponses manquantes grâce au gras :**

Le gras dans les propositions indique les bonnes réponses dans le document original.
Le script utilise cette information AVANT de la supprimer.

| Étape | Action |
|-------|--------|
| 1a | Détecter les questions avec "Réponse : ........." (réponses manquantes) |
| 1b | Pour celles-ci, lire quelles propositions sont en gras |
| 1c | Reconstituer la ligne de réponse à partir du gras (ex: A en gras + C en gras → "Réponse : A, C") |
| 1d | Marquer ⚠️ les questions où ni la ligne Réponse ni le gras ne donnent d'information |

**PASSE 2 — Standardisation du format :**

| Problème dans l'original | Transformation appliquée |
|--------------------------|--------------------------|
| Bonnes réponses en gras dans les propositions | Gras supprimé sur toutes les propositions (les réponses sont déjà dans la ligne Réponse grâce à la Passe 1) |
| Formats de réponse variés ("ACE", "A et C", etc.) | Normalisé en "Réponse : A, C, E" |
| Numérotation incohérente ou absente | Renumérotation séquentielle dans l'ordre d'apparition dans le document (Point 4 : le document est dans l'ordre) |
| "Question" sans numéro | Numéro attribué selon la position dans le document |
| Explications sans délimiteur | Ajout du marqueur "Explication :" |
| Images et tableaux | Préservés intacts |
| Titres de chapitres avec compteurs "(30)" | Compteur supprimé |

### 2.4 Gestion des images et tableaux

Lors de l'import dans la base de données :

```
Document Word
    ├── Texte de la question     → champ question_text (texte brut)
    ├── Propositions A-E         → table choices (texte brut)
    ├── Réponse                  → champ is_correct sur chaque choice
    └── Explication              → bloc HTML riche :
         ├── Texte               → HTML (<p>, <strong>, <sup>...)
         ├── Tableaux            → HTML (<table>)
         └── Images              → extraites → Supabase Storage → <img src="...">
```

Le champ `explanation_html` contient du HTML sanitisé, affiché dans l'app
via DOMPurify + dangerouslySetInnerHTML.

---

## 3. Stack technique

### 3.1 Frontend (PWA)

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| Framework | **Next.js 14** (React) | SSR, PWA-ready, écosystème riche |
| Style | **Tailwind CSS** | Développement rapide, responsive natif |
| État global | **Zustand** | Léger, simple, adapté à la taille du projet |
| PWA | **next-pwa** | Service worker automatique, installation mobile |
| Graphiques stats | **Recharts** | Graphiques de progression, carte de chaleur |
| Rendu HTML explications | **DOMPurify** | Affichage sécurisé du HTML des explications |

### 3.2 Backend & Base de données

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| Backend | **Supabase** | Auth, BDD, API REST automatique, stockage |
| Base de données | **PostgreSQL** (via Supabase) | Requêtes complexes pour les stats et pondération |
| Authentification | **Supabase Auth** | Email/mot de passe, Google |
| Stockage images | **Supabase Storage** | Images des explications |
| Hébergement | **Vercel** | Gratuit pour Next.js, CI/CD automatique |

### 3.3 Scripts de preprocessing et import

| Script | Technologie | Rôle |
|--------|-------------|------|
| preprocessing.py | Python + python-docx | .doc/.docx original → .docx standardisé |
| import_to_db.py | Python + python-docx + mammoth | .docx standardisé → HTML + Supabase |

### 3.4 Coût initial : 0€

- Supabase Free : 500 Mo BDD, 1 Go Storage, 50 000 auth/mois
- Vercel Free : 100 Go bandwidth, déploiements illimités
- Suffisant pour ~1000 questions et quelques centaines d'étudiants

---

## 4. Structure de la base de données

### 4.1 Tables principales

```
┌─────────────────────────────────────────────────────┐
│  profiles (extension de Supabase Auth)              │
│─────────────────────────────────────────────────────│
│  id              UUID  PK (= auth.users.id)         │
│  email           TEXT  UNIQUE                       │
│  full_name       TEXT                               │
│  role            ENUM('student','admin')            │
│  university      TEXT  (optionnel)                  │
│  year_of_study   INT   (optionnel)                  │
│  created_at      TIMESTAMP  DEFAULT now()           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  topics (hiérarchie des cours, auto-référencée)     │
│─────────────────────────────────────────────────────│
│  id              UUID  PK                           │
│  parent_id       UUID  FK → topics.id (NULL=racine) │
│  title           TEXT  NOT NULL                     │
│  description     TEXT                               │
│  level           INT  (1=matière, 2=chapitre…)      │
│  sort_order      INT                                │
│  is_active       BOOLEAN  DEFAULT true              │
│  created_at      TIMESTAMP  DEFAULT now()           │
└─────────────────────────────────────────────────────┘
```

**Exemple de hiérarchie :**
```
Physiologie (level 1)
├── Physiologie du système nerveux (level 2)
│   ├── Transmission synaptique (level 3)
│   │   ├── Le PA (level 4)
│   │   ├── Les canaux voltage-dépendants (level 4)
│   │   ├── La synapse (level 4)
│   │   └── Les PPS (level 4)
│   ├── Plaque motrice (level 3)
│   ├── Réflexes médullaires (level 3)
│   ├── Équilibration (level 3)
│   └── Noyaux gris de la base (level 3)
├── Endocrinologie (level 2)
│   ├── La glande thyroïde (level 3)
│   ├── La médullosurrénale (level 3)
│   └── Régulation de la glycémie (level 3)
└── Physiologie digestive (level 2)
    └── ...
```

```
┌─────────────────────────────────────────────────────┐
│  questions                                          │
│─────────────────────────────────────────────────────│
│  id              UUID  PK                           │
│  topic_id        UUID  FK → topics.id  NOT NULL     │
│  question_number INT   (numéro dans le topic)       │
│  question_text   TEXT  NOT NULL                     │
│  explanation_html TEXT  (HTML riche, peut être NULL) │
│  difficulty      ENUM('easy','medium','hard')       │
│                  DEFAULT 'medium'                    │
│  is_active       BOOLEAN  DEFAULT true              │
│  video_url       TEXT  (Phase 2, NULL pour l'instant)│
│  video_timestamp INT   (Phase 2, en secondes)       │
│  created_at      TIMESTAMP  DEFAULT now()           │
│  updated_at      TIMESTAMP  DEFAULT now()           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  choices (propositions de réponse, 2 à 5 par Q)    │
│─────────────────────────────────────────────────────│
│  id              UUID  PK                           │
│  question_id     UUID  FK → questions.id  NOT NULL  │
│  label           CHAR(1)  NOT NULL (A, B, C, D, E)  │
│  choice_text     TEXT  NOT NULL                     │
│  is_correct      BOOLEAN  NOT NULL                  │
│  sort_order      INT  (A=1, B=2, C=3…)             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  question_images (images des explications)          │
│─────────────────────────────────────────────────────│
│  id              UUID  PK                           │
│  question_id     UUID  FK → questions.id            │
│  storage_path    TEXT  (chemin Supabase Storage)     │
│  original_name   TEXT  (nom dans le Word)           │
│  sort_order      INT                                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  sessions                                           │
│─────────────────────────────────────────────────────│
│  id              UUID  PK                           │
│  user_id         UUID  FK → profiles.id  NOT NULL   │
│  topic_id        UUID  FK → topics.id  NOT NULL     │
│  session_type    ENUM('short','all','exam')         │
│                  NOT NULL                            │
│  question_count  INT  (10, 25, ou total)            │
│  correct_count   INT  DEFAULT 0                     │
│  wrong_count     INT  DEFAULT 0                     │
│  partial_count   INT  DEFAULT 0                     │
│                  (nombre de réponses partiellement   │
│                   correctes)                         │
│  score_percent   DECIMAL                            │
│  duration_seconds INT                               │
│  time_limit_seconds INT  (NULL sauf examen blanc)   │
│  include_subtopics BOOLEAN  DEFAULT false           │
│  current_question_index INT  DEFAULT 0              │
│                  (index de la question en cours,     │
│                   pour pause/resume en entraînement) │
│  is_paused       BOOLEAN  DEFAULT false             │
│                  (session en pause — entraînement    │
│                   uniquement, jamais examen blanc)   │
│  paused_at       TIMESTAMP  NULLABLE                │
│                  (heure de la dernière mise en pause) │
│  total_pause_seconds INT  DEFAULT 0                 │
│                  (temps total passé en pause,        │
│                   soustrait de la durée effective)    │
│  started_at      TIMESTAMP  DEFAULT now()           │
│  completed_at    TIMESTAMP                          │
│  is_completed    BOOLEAN  DEFAULT false             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  session_answers                                    │
│─────────────────────────────────────────────────────│
│  id              UUID  PK                           │
│  session_id      UUID  FK → sessions.id  NOT NULL   │
│  question_id     UUID  FK → questions.id  NOT NULL  │
│  is_correct      BOOLEAN  NOT NULL                  │
│                  (TRUE uniquement si 100% : toutes   │
│                   les bonnes cochées, aucune mauvaise)│
│  is_partially_correct  BOOLEAN  NOT NULL            │
│                  (TRUE si score > 0% mais < 100% :   │
│                   quelques bonnes cochées, aucune     │
│                   mauvaise)                           │
│  score_percent   DECIMAL  NOT NULL                  │
│                  (score exact de la question :        │
│                   0, 33.3, 50, 66.7, 100, etc.       │
│                   = nb_bonnes_cochées / nb_total_bonnes│
│                   → 0 si au moins 1 mauvaise cochée) │
│  confidence      DECIMAL(2,1)  NULLABLE             │
│                  (NULL=non renseigné, 0.0=je devine, │
│                   0.5=hésitant, 1.0=sûr)            │
│  time_spent_sec  INT                                │
│  is_flagged      BOOLEAN  DEFAULT false             │
│                  (marqué pour revue en examen blanc) │
│  answered_at     TIMESTAMP  DEFAULT now()           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  session_answer_choices (choix cochés par l'étudiant)│
│─────────────────────────────────────────────────────│
│  id              UUID  PK                           │
│  session_answer_id  UUID FK → session_answers.id    │
│  choice_id       UUID  FK → choices.id              │
└─────────────────────────────────────────────────────┘
```

### 4.2 Vues SQL

**vue : question_user_stats** — Statistiques par question par étudiant (utilisée par l'algorithme) :

```sql
CREATE OR REPLACE VIEW question_user_stats AS
SELECT
    q.id AS question_id,
    q.topic_id,
    s.user_id,
    COUNT(sa.id) AS attempts,
    COALESCE(
        SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END)::DECIMAL
        / NULLIF(COUNT(sa.id), 0),
        0
    ) AS success_rate,
    EXTRACT(EPOCH FROM (NOW() - MAX(sa.answered_at))) / 86400.0
        AS days_since_last,
    AVG(sa.confidence) FILTER (WHERE sa.confidence IS NOT NULL)
        AS avg_confidence,
    COUNT(sa.confidence) FILTER (WHERE sa.confidence IS NOT NULL)
        AS confidence_count,
    -- Détection fausse certitude : dernière réponse incorrecte + confiance "sûr"
    (
        SELECT sa2.is_correct = false AND sa2.confidence = 1.0
        FROM session_answers sa2
        JOIN sessions s2 ON s2.id = sa2.session_id
        WHERE sa2.question_id = q.id AND s2.user_id = s.user_id
        ORDER BY sa2.answered_at DESC LIMIT 1
    ) AS last_was_false_certainty
FROM questions q
CROSS JOIN (SELECT DISTINCT user_id FROM sessions) s
LEFT JOIN session_answers sa ON sa.question_id = q.id
    AND sa.session_id IN (SELECT id FROM sessions WHERE user_id = s.user_id)
WHERE q.is_active = true
GROUP BY q.id, q.topic_id, s.user_id;
```

**vue : question_error_rate** — Questions classées par taux d'erreur global (admin) :

```sql
CREATE OR REPLACE VIEW question_error_rate AS
SELECT
    q.id, q.question_text, q.topic_id, t.title AS topic_title,
    COUNT(sa.id) AS total_attempts,
    SUM(CASE WHEN sa.is_correct = false THEN 1 ELSE 0 END) AS total_errors,
    ROUND(100.0 * SUM(CASE WHEN sa.is_correct = false THEN 1 ELSE 0 END)
          / NULLIF(COUNT(sa.id), 0), 1) AS error_rate_percent,
    -- Compteur de fausses certitudes
    SUM(CASE WHEN sa.is_correct = false AND sa.confidence = 1.0 THEN 1 ELSE 0 END)
        AS false_certainty_count
FROM questions q
JOIN topics t ON t.id = q.topic_id
LEFT JOIN session_answers sa ON sa.question_id = q.id
GROUP BY q.id, q.question_text, q.topic_id, t.title
ORDER BY error_rate_percent DESC;
```

**vue : user_progress_over_time** — Progression d'un étudiant :

```sql
CREATE OR REPLACE VIEW user_progress_over_time AS
SELECT
    s.user_id,
    DATE(s.completed_at) AS session_date,
    s.session_type,
    AVG(s.score_percent) AS avg_score,
    COUNT(s.id) AS sessions_count,
    SUM(s.question_count) AS questions_answered
FROM sessions s
WHERE s.is_completed = true
GROUP BY s.user_id, DATE(s.completed_at), s.session_type
ORDER BY session_date;
```

**vue : topic_mastery** — Maîtrise par chapitre pour la carte de chaleur :

```sql
CREATE OR REPLACE VIEW topic_mastery AS
SELECT
    s.user_id,
    t.id AS topic_id,
    t.title,
    t.parent_id,
    t.level,
    COUNT(DISTINCT q.id) AS total_questions,
    COUNT(DISTINCT sa.question_id) AS attempted_questions,
    -- Couverture : % de questions tentées au moins 1 fois
    ROUND(100.0 * COUNT(DISTINCT sa.question_id)
          / NULLIF(COUNT(DISTINCT q.id), 0), 1) AS coverage_percent,
    -- Score moyen sur les 3 dernières tentatives par question
    ROUND(AVG(recent_scores.recent_success_rate) * 100, 1) AS avg_mastery_percent,
    -- Maîtrise = score moyen × couverture
    ROUND(
        COALESCE(AVG(recent_scores.recent_success_rate), 0)
        * (COUNT(DISTINCT sa.question_id)::DECIMAL / NULLIF(COUNT(DISTINCT q.id), 0))
        * 100, 1
    ) AS mastery_percent
FROM topics t
JOIN questions q ON q.topic_id = t.id AND q.is_active = true
CROSS JOIN (SELECT DISTINCT user_id FROM sessions) s
LEFT JOIN session_answers sa ON sa.question_id = q.id
    AND sa.session_id IN (SELECT id FROM sessions WHERE user_id = s.user_id)
LEFT JOIN LATERAL (
    SELECT AVG(CASE WHEN sa3.is_correct THEN 1.0 ELSE 0.0 END) AS recent_success_rate
    FROM session_answers sa3
    JOIN sessions s3 ON s3.id = sa3.session_id
    WHERE sa3.question_id = q.id AND s3.user_id = s.user_id
    ORDER BY sa3.answered_at DESC
    LIMIT 3
) recent_scores ON true
GROUP BY s.user_id, t.id, t.title, t.parent_id, t.level;
```

---

## 5. Algorithme de sélection intelligente des questions

### 5.1 Trois modes de sélection

```
┌────────────────────────────────────────────────────────────────┐
│                   MODE SESSION COURTE (10/25)                  │
│                                                                │
│  Sélection pondérée :                                          │
│  1. Calculer le poids brut de chaque question                  │
│  2. Normaliser (somme des probabilités = 1)                    │
│  3. Tirage pondéré sans remise de N questions                  │
│  4. Chaque question sélectionnée apparaît exactement 1 fois   │
│  5. Mélanger l'ordre des N questions                           │
│  6. Pour chaque question, mélanger l'ordre des propositions    │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│               MODE TOUTES LES QUESTIONS                        │
│                                                                │
│  Pas de tirage probabiliste.                                   │
│  Toutes les questions sont incluses.                           │
│  Ordre aléatoire uniforme (shuffle simple).                    │
│  Chaque question apparaît exactement 1 fois.                  │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                   MODE EXAMEN BLANC                            │
│                                                                │
│  Si sous-ensemble (ex: 40 sur 100) :                           │
│    Tirage aléatoire uniforme (pas de pondération).             │
│    Chaque question a la même probabilité = 1/N.                │
│  Si toutes les questions :                                     │
│    Toutes incluses, ordre aléatoire uniforme.                  │
│  Chaque question apparaît exactement 1 fois.                  │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 Formule de calcul du poids brut (session courte uniquement)

```
POUR CHAQUE QUESTION Q ET ÉTUDIANT E :

CAS 1 — Question jamais tentée par E :
    poids_brut = 0.70

CAS 2 — Question déjà tentée, confiance renseignée (au moins 1 fois) :
    poids_brut = 0.40 × difficulté
              + 0.35 × oubli
              + 0.25 × incertitude

CAS 3 — Question déjà tentée, confiance jamais renseignée :
    poids_brut = 0.53 × difficulté
              + 0.47 × oubli
    (redistribution proportionnelle des 25% de la composante incertitude)

COMPOSANTES :

    difficulté = 1 - taux_de_réussite
        taux_de_réussite = nb_réponses_correctes / nb_tentatives
        Plage : [0.0, 1.0]

    oubli = 1 - e^(-jours_depuis_dernière_tentative / demi_vie)
        demi_vie = 5 + 3 × nb_tentatives × taux_de_réussite
        Interprétation : plus l'étudiant a réussi souvent, plus la
        demi-vie est longue → la question met plus de temps à remonter
        Plage : [0.0, ~1.0]

    incertitude = 1 - confiance_moyenne
        confiance_moyenne = moyenne des indices de confiance
        sur toutes les tentatives où la confiance a été renseignée
        "sûr" = 1.0, "hésitant" = 0.5, "je devine" = 0.0
        Plage : [0.0, 1.0]

BONUS FAUSSE CERTITUDE :
    SI la dernière réponse était incorrecte
    ET la dernière confiance était "sûr" (1.0) :
        poids_brut = min(poids_brut × 1.5, 1.0)
```

### 5.3 Normalisation et tirage

```
ÉTAPE 1 — Pool de questions
    Récupérer toutes les questions actives du topic choisi
    (+ sous-topics si l'option "inclure sous-chapitres" est cochée)
    Soit M questions dans le pool.

ÉTAPE 2 — Calcul des poids bruts
    Pour chaque question Qi (i = 1 à M), calculer poids_brut(Qi)

ÉTAPE 3 — Normalisation
    somme = Σ poids_brut(Qi) pour i = 1 à M
    P(Qi) = poids_brut(Qi) / somme
    Vérification : Σ P(Qi) = 1.0

ÉTAPE 4 — Tirage pondéré sans remise (pour N questions, N < M)
    Répéter N fois :
        a. Tirer une question selon la distribution P
        b. La retirer du pool
        c. Renormaliser : P(Qj) = poids_brut(Qj) / nouvelle_somme
           pour toutes les questions restantes
    Résultat : N questions sélectionnées, chacune apparaît 1 fois.

ÉTAPE 5 — Mélange de l'ordre
    Shuffle aléatoire des N questions sélectionnées.
    Pour chaque question, shuffle des propositions A-E.
```

### 5.4 Exemples concrets

Soit un chapitre de 30 questions pour un étudiant donné :

| # | Statut | Réussite | Jours | Tentatives | Confiance | Poids brut | P(Qi) |
|---|--------|----------|-------|------------|-----------|------------|-------|
| Q1 | Jamais vue | — | — | 0 | — | 0.70 | 4.4% |
| Q2 | Jamais vue | — | — | 0 | — | 0.70 | 4.4% |
| Q3 | Maîtrisée | 90% | 2j | 5 | sûr | 0.08 | 0.5% |
| Q4 | Ratée, fausse certitude | 20% | 3j | 2 | sûr | 1.00 | 6.3% |
| Q5 | En cours | 50% | 7j | 3 | hésitant | 0.49 | 3.1% |
| ... | ... | ... | ... | ... | ... | ~0.53 | ~3.3% |
| **Somme** | | | | | | **~15.9** | **100%** |

Interprétation : Q4 (ratée + fausse certitude) a 6.3% de chances d'être dans
la session, Q3 (maîtrisée) seulement 0.5%. Les questions jamais vues (0.70)
sont au-dessus de la moyenne (~0.53) mais en dessous des questions problématiques.

### 5.5 Implémentation (fonction Supabase Edge ou côté serveur)

```typescript
interface QuestionWeight {
  question_id: string;
  weight: number;
}

function calculateWeights(
  questions: QuestionWithStats[],
  userId: string
): QuestionWeight[] {
  return questions.map(q => {
    // Cas 1 : jamais tentée
    if (q.attempts === 0) {
      return { question_id: q.id, weight: 0.70 };
    }

    const successRate = q.correct_count / q.attempts;
    const difficulty = 1 - successRate;

    const halfLife = 5 + 3 * q.attempts * successRate;
    const forgetting = 1 - Math.exp(-q.days_since_last / halfLife);

    let weight: number;

    if (q.confidence_count > 0) {
      // Cas 2 : confiance renseignée
      const uncertainty = 1 - q.avg_confidence;
      weight = 0.40 * difficulty + 0.35 * forgetting + 0.25 * uncertainty;
    } else {
      // Cas 3 : confiance jamais renseignée
      weight = 0.53 * difficulty + 0.47 * forgetting;
    }

    // Bonus fausse certitude
    if (q.last_was_false_certainty) {
      weight = Math.min(weight * 1.5, 1.0);
    }

    return { question_id: q.id, weight };
  });
}

function weightedSampleWithoutReplacement(
  items: QuestionWeight[],
  n: number
): string[] {
  const selected: string[] = [];
  const remaining = [...items];

  for (let i = 0; i < n && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (let j = 0; j < remaining.length; j++) {
      random -= remaining[j].weight;
      if (random <= 0) {
        selected.push(remaining[j].question_id);
        remaining.splice(j, 1);
        break;
      }
    }
  }

  // Shuffle final
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }

  return selected;
}
```

---

## 5bis. Règles de notation (scoring partiel)

### 5bis.1 Principe

Une question QCM peut avoir plusieurs bonnes réponses (ex: A, C, E sur 5 propositions).
La notation tient compte des réponses partielles, mais une seule mauvaise réponse
cochée annule tout le score.

### 5bis.2 Formule de scoring

```
Soit :
  bonnes_totales = nombre de propositions correctes (ex: 3 pour A, C, E)
  bonnes_cochées = nombre de propositions correctes cochées par l'étudiant
  mauvaises_cochées = nombre de propositions incorrectes cochées par l'étudiant

SI mauvaises_cochées > 0 :
    score_percent = 0%
    is_correct = FALSE
    is_partially_correct = FALSE

SINON SI bonnes_cochées = bonnes_totales :
    score_percent = 100%
    is_correct = TRUE
    is_partially_correct = FALSE

SINON SI bonnes_cochées > 0 :
    score_percent = (bonnes_cochées / bonnes_totales) × 100
    is_correct = FALSE
    is_partially_correct = TRUE

SINON (rien coché) :
    score_percent = 0%
    is_correct = FALSE
    is_partially_correct = FALSE
```

### 5bis.3 Exemples concrets

Bonne réponse : A, C, E (3 bonnes sur 5 propositions)

| L'étudiant coche | bonnes_cochées | mauvaises_cochées | score | is_correct | is_partially |
|-------------------|---------------|-------------------|-------|-----------|-------------|
| A | 1 | 0 | 33.3% | FALSE | TRUE |
| A, C | 2 | 0 | 66.7% | FALSE | TRUE |
| A, C, E | 3 | 0 | 100% | TRUE | FALSE |
| A, B | 1 | 1 (B) | **0%** | FALSE | FALSE |
| A, C, B | 2 | 1 (B) | **0%** | FALSE | FALSE |
| B, D | 0 | 2 | **0%** | FALSE | FALSE |
| (rien) | 0 | 0 | 0% | FALSE | FALSE |

### 5bis.4 Impact sur l'algorithme de sélection

Pour le calcul du `taux_de_réussite` dans l'algorithme de sélection (section 5),
seul `is_correct = TRUE` (score 100%) compte comme une réussite. Les réponses
partielles comptent comme incorrectes dans le poids, ce qui fait revenir
la question plus souvent — logique car l'étudiant n'a pas encore la maîtrise
complète.

### 5bis.5 Implémentation (Edge Function validate-answer)

```typescript
function scoreAnswer(
  selectedChoiceIds: string[],
  allChoices: { id: string; is_correct: boolean }[]
): { is_correct: boolean; is_partially_correct: boolean; score_percent: number } {

  const correctChoices = allChoices.filter(c => c.is_correct);
  const totalCorrect = correctChoices.length;
  const correctChoiceIds = new Set(correctChoices.map(c => c.id));

  let correctSelected = 0;
  let incorrectSelected = 0;

  for (const choiceId of selectedChoiceIds) {
    if (correctChoiceIds.has(choiceId)) {
      correctSelected++;
    } else {
      incorrectSelected++;
    }
  }

  // Une mauvaise réponse cochée annule tout
  if (incorrectSelected > 0) {
    return { is_correct: false, is_partially_correct: false, score_percent: 0 };
  }

  const score = totalCorrect > 0
    ? Math.round((correctSelected / totalCorrect) * 1000) / 10
    : 0;

  return {
    is_correct: correctSelected === totalCorrect,
    is_partially_correct: correctSelected > 0 && correctSelected < totalCorrect,
    score_percent: score,
  };
}
```

---

## 5ter. Pause / Resume (mode entraînement uniquement)

### 5ter.1 Principe

En mode entraînement (session courte ou toutes les questions), l'étudiant peut
mettre sa session en pause et la reprendre plus tard. En examen blanc, la pause
n'existe pas : le chronomètre tourne toujours.

### 5ter.2 Comportement

```
PAUSE :
  1. L'étudiant clique [⏸ Pause] ou ferme l'app / navigue ailleurs
  2. L'app enregistre : is_paused = TRUE, paused_at = NOW()
  3. Le chronomètre informatif s'arrête (côté client)
  4. La session apparaît dans "Sessions en cours" sur le tableau de bord

RESUME :
  1. L'étudiant revient sur sa session (via le tableau de bord ou lien direct)
  2. L'app calcule : total_pause_seconds += (NOW() - paused_at)
  3. L'app enregistre : is_paused = FALSE, paused_at = NULL
  4. Le quiz reprend à current_question_index
  5. Le chronomètre informatif repart

DURÉE EFFECTIVE :
  durée_effective = (completed_at - started_at) - total_pause_seconds
  C'est cette durée qui est affichée dans les stats, pas le temps total écoulé.
```

### 5ter.3 Cas limites

- **Fermeture de l'app sans cliquer Pause** : le beforeunload event ou le
  visibilitychange event détecte la sortie et met en pause automatiquement.
- **Session en pause depuis plus de 7 jours** : la session est marquée comme
  abandonnée (is_completed = false, un message invite à en commencer une nouvelle).
- **Examen blanc** : le bouton Pause n'apparaît pas. Si l'étudiant ferme l'app,
  le chrono côté serveur continue. À son retour, le temps restant est recalculé
  depuis started_at + time_limit_seconds.

### 5ter.4 Interface

En mode entraînement, un bouton Pause apparaît dans le header du quiz :

```
┌──────────────────────────────────────────┐
│  Question 7/25    ⏱ 04:12   [⏸ Pause]  │
│  ████████████████░░░░░░░░░░ 28%          │
```

Sur le tableau de bord, les sessions en pause apparaissent :

```
┌──────────────────────────────────────────┐
│  ⏸ Session en cours                      │
│  Transmission synaptique — 7/25 (28%)    │
│  En pause depuis 2h                      │
│  [▶ Reprendre]                          │
└──────────────────────────────────────────┘
```

---

## 6. Indice de confiance

### 6.1 Principe

L'indice de confiance est **optionnel** : le bouton "Valider" est actif même sans
choix de confiance. L'étudiant est incité à le remplir par les statistiques de
calibration qui ne se débloquent qu'avec suffisamment de données.

### 6.2 Interface

Les 3 boutons de confiance apparaissent entre les propositions et le bouton Valider :

```
┌─────────────────────────────────────────────┐
│                                             │
│  ☑ B. obéit à la loi du tout ou rien       │
│  ☑ E. est indispensable à la neuro...      │
│                                             │
│  Confiance (optionnel) :                    │
│  [ Je devine ]  [ Hésitant ]  [ Sûr ]      │
│     (gris)        (gris)       (gris)       │
│  → cliquer sur un bouton le met en surbrillance │
│  → cliquer à nouveau le désélectionne       │
│                                             │
│  [       Valider ma réponse       ]         │
│  (actif même sans choix de confiance)       │
│                                             │
└─────────────────────────────────────────────┘
```

### 6.3 Valeurs stockées

| Niveau | Valeur dans session_answers.confidence | Signification |
|--------|----------------------------------------|---------------|
| Non renseigné | NULL | Pas de données |
| Je devine | 0.0 | Aucune idée |
| Hésitant | 0.5 | Connaissance partielle |
| Sûr | 1.0 | Confiant |

### 6.4 Matrice confiance × résultat

| | Bonne réponse | Mauvaise réponse |
|---|---|---|
| **Sûr** | Maîtrisé → poids minimal | **FAUSSE CERTITUDE** → poids × 1.5 |
| **Hésitant** | En cours d'acquisition | À travailler, normal |
| **Je devine** | Coup de chance → question revient | Lacune identifiée |
| **Non renseigné** | Formule à 2 composantes | Formule à 2 composantes |

### 6.5 Incitation par les statistiques

Sur le tableau de bord de l'étudiant, un encart "Calibration" :

```
SI < 30% des réponses ont un indice de confiance :
    Afficher : "Indiquez votre confiance lors des quiz
                pour débloquer votre graphique de calibration"
    + Barre de progression vers les 30%

SI ≥ 30% des réponses ont un indice de confiance :
    Afficher le graphique de calibration :
    - Axe X : confiance déclarée (je devine / hésitant / sûr)
    - Axe Y : taux de réussite réel
    - Un étudiant bien calibré a :
        ~20-30% de réussite quand "je devine"
        ~50-60% quand "hésitant"
        ~85-95% quand "sûr"
    + Liste des "fausses certitudes" (sûr + mauvaise réponse)
```

---

## 7. Mode examen blanc

### 7.1 Différences avec le mode entraînement

| Aspect | Entraînement (short/all) | Examen blanc |
|--------|--------------------------|--------------|
| session_type | 'short' ou 'all' | 'exam' |
| Correction | Immédiate après chaque Q | À la fin uniquement |
| Explication | Affichée après chaque Q | Disponible dans la revue finale |
| Chronomètre | Informatif, pas de limite | Compte à rebours strict |
| Fin de temps | N/A | L'examen se termine, questions non répondues = fausses |
| Navigation | Séquentielle uniquement | Libre (aller-retour) |
| Marquage | Non | Oui (drapeau pour revue) |
| Indice de confiance | Optionnel, affiché | Non affiché |
| Sélection | Pondérée (short) ou toutes (all) | Aléatoire uniforme |
| Résultat | Score + détail immédiat | Score + revue complète |

### 7.2 Configuration

L'étudiant configure :
- **Topic** : quel chapitre (+ option sous-chapitres)
- **Nombre de questions** : 20 / 40 / 60 / personnalisé / toutes
- **Durée** : 30 min / 1h / 2h / personnalisé

### 7.3 Écran pendant l'examen

```
┌──────────────────────────────────────────┐
│  ⏱ 45:23 restantes    Question 12/40    │
│  ████████████░░░░░░░░░░░░░░ 30%          │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Le potentiel d'action (PA) :      │  │
│  │                                    │  │
│  │ □ A. nait au niveau du soma       │  │
│  │ ☑ B. obéit à la loi du tout      │  │
│  │      ou rien                       │  │
│  │ □ C. a une amplitude variable     │  │
│  │ □ D. est sommable                 │  │
│  │ ☑ E. est indispensable à la      │  │
│  │      neurotransmission in vivo     │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [🚩 Marquer pour revue]                │
│                                          │
│  [← Précédente]  [Suivante →]           │
│                                          │
│  ── Navigation rapide ──                │
│  [1][2][3]…[🚩11][12]…[40]             │
│  ● répondu  ○ non répondu  🚩 marqué    │
│                                          │
│  [Terminer l'examen]                     │
└──────────────────────────────────────────┘
```

Détails techniques :
- Le chronomètre est géré côté client avec sync serveur périodique
- "Terminer l'examen" demande confirmation ("Il reste 5 questions sans réponse")
- Quand le temps expire, l'examen se termine automatiquement
- Questions non répondues à la fin = is_correct: false, confidence: NULL
- Le champ is_flagged dans session_answers indique les questions marquées

### 7.4 Écran de résultat

```
┌──────────────────────────────────────────┐
│       RÉSULTAT DE L'EXAMEN BLANC        │
│                                          │
│  🎯 Score : 32/40 (80%)                 │
│  ⏱ Durée effective : 38 min / 60 min   │
│                                          │
│  📊 Résumé :                             │
│  ✅ Correctes : 32                       │
│  ❌ Incorrectes : 6                      │
│  ⬜ Non répondues : 2                    │
│                                          │
│  📈 Évolution examens blancs :           │
│  [Graphique : 65% → 72% → 80%]          │
│                                          │
│  ❌ Revue des erreurs (8) :              │
│  Chaque question affiche :               │
│  - L'énoncé                              │
│  - Ce que l'étudiant a coché             │
│  - La bonne réponse                      │
│  - L'explication (HTML riche)            │
│                                          │
│  [🔄 Refaire cet examen]               │
│  [📋 Nouvel examen blanc]               │
│  [🏠 Retour au tableau de bord]         │
└──────────────────────────────────────────┘
```

---

## 8. Carte de chaleur des connaissances

### 8.1 Concept

Vue en treemap colorée de la maîtrise de l'étudiant sur l'ensemble du programme.
Chaque rectangle représente un topic (chapitre ou sous-chapitre), sa taille est
proportionnelle au nombre de questions, et sa couleur indique le niveau de maîtrise.

### 8.2 Échelle de couleurs

| Couleur | Maîtrise | Interprétation |
|---------|----------|----------------|
| Gris (#BDC3C7) | Pas tenté | Aucune question vue |
| Rouge foncé (#C0392B) | 0-20% | Lacune grave |
| Rouge clair (#E74C3C) | 20-40% | En difficulté |
| Orange (#F39C12) | 40-60% | En progression |
| Jaune-vert (#F1C40F) | 60-75% | Correct |
| Vert clair (#2ECC71) | 75-90% | Bon |
| Vert foncé (#27AE60) | 90-100% | Maîtrisé |

### 8.3 Calcul de la maîtrise

```
POUR CHAQUE QUESTION Q (vue par l'étudiant au moins 1 fois) :

    maîtrise(Q) =
        0.50 × taux_réussite_récent (3 dernières tentatives)
      + 0.30 × (1.0 si dernière réponse correcte, 0.0 sinon)
      + 0.20 × confiance_moyenne_récente (ou 0.5 si non renseignée)

POUR CHAQUE TOPIC T :

    couverture(T) = nb_questions_tentées / nb_questions_total

    maîtrise(T) = moyenne(maîtrise de chaque question tentée) × couverture(T)

    Interprétation : un étudiant qui a répondu correctement à 5/30 questions
    a une maîtrise de (1.0 × 5/30) = 17%, pas 100% sur les 5 réussies.
```

### 8.4 Implémentation avec Recharts

Utiliser un composant Treemap de Recharts :

```typescript
// Données pour le Treemap
interface HeatmapNode {
  name: string;          // Nom du topic
  size: number;          // Nombre de questions
  mastery: number;       // 0-100
  coverage: number;      // 0-100
  color: string;         // Couleur dérivée de mastery
  children?: HeatmapNode[];
}

// Le treemap affiche les topics level 3 et 4
// Regroupés par topic level 2
// Cliquable : cliquer sur un rectangle navigue vers ce topic
```

### 8.5 Maquette

```
┌──────────────────────────────────────────────────────────┐
│  🗺️ CARTE DES CONNAISSANCES                             │
│                                                          │
│  ┌─── Système nerveux ───────────────────────────────┐  │
│  │ ┌──────────┐ ┌──────┐ ┌────────────────────────┐ │  │
│  │ │ Transm.  │ │Plaque│ │ Réflexes médullaires   │ │  │
│  │ │ synaptiq.│ │motr. │ │        88% 🟢          │ │  │
│  │ │  72% 🟢  │ │ 45%  │ │  33 questions           │ │  │
│  │ │ 30 quest.│ │ 🟠   │ └────────────────────────┘ │  │
│  │ │          │ │ 12 q.│ ┌─────────┐ ┌────────────┐ │  │
│  │ └──────────┘ └──────┘ │Équilib. │ │Noyaux gris │ │  │
│  │                       │  ░░ 0%  │ │   62% 🟡   │ │  │
│  │                       │ gris    │ │  16 quest.  │ │  │
│  │                       └─────────┘ └────────────┘ │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌─── Endocrinologie ────────────────────────────────┐  │
│  │ ┌──────────────┐ ┌──────────┐ ┌────────────────┐ │  │
│  │ │ Thyroïde     │ │ Médullo- │ │ Régulation     │ │  │
│  │ │   35% 🔴     │ │ surrénal │ │ glycémie       │ │  │
│  │ │  24 quest.   │ │  ░░ 0%   │ │   51% 🟠      │ │  │
│  │ └──────────────┘ └──────────┘ └────────────────┘ │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ── Légende ──                                           │
│  🔴 0-40%  🟠 40-60%  🟡 60-75%  🟢 75-100%  ░░ Non tenté │
└──────────────────────────────────────────────────────────┘
```

Interaction : cliquer sur un rectangle ouvre la page du topic pour démarrer
une session de révision.

---

## 9. Écrans de l'application

### 9.1 Parcours étudiant

```
[Inscription/Connexion]
  Email + mot de passe ou Google
  Nom, université, année (inscription)
        │
        ▼
[Tableau de bord]
  • Score moyen cette semaine
  • Graphique de progression (30 jours)
  • Dernières sessions (topic, score, date)
  • Points faibles (top 5 questions les + ratées)
  • Encart calibration (si confiance renseignée > 30%)
  • Carte de chaleur miniature (cliquable vers vue complète)
  • Boutons : [Commencer une session] [Examen blanc] [Carte des connaissances]
        │
        ▼
[Navigation des cours]
  • Arborescence des topics (4 niveaux, accordéon)
  • Par topic : nombre de questions, barre de maîtrise colorée
  • Cliquer sur un topic → Configuration de session
        │
        ▼
[Configuration de la session]
  • Topic sélectionné + nombre de questions disponibles
  • Choix du nombre : [10] [25] [Toutes]
  • Option : inclure les sous-chapitres [oui/non]
  • Bouton séparé : [Mode examen blanc →]
  • [Démarrer la session]
        │
        ▼
[Quiz en cours — mode entraînement]
  • Barre de progression (question X/N)
  • Chronomètre informatif
  • Énoncé + propositions (cases à cocher)
  • 3 boutons de confiance optionnels (je devine / hésitant / sûr)
  • Bouton [Valider] (actif sans confiance)
  • Après validation :
    - Propositions colorées (vert = correct, rouge = incorrect)
    - Réponses de l'étudiant marquées
    - Explication HTML (texte + tableaux + images)
  • Bouton [Question suivante]
        │
        ▼
[Résumé de la session]
  • Score : X/N (%)
  • Durée totale et temps moyen par question
  • Comparaison avec sessions précédentes sur ce topic
  • Liste des questions ratées (cliquable pour revoir la correction)
  • [Recommencer les ratées] [Voir ma progression] [Retour]
```

### 9.2 Parcours administrateur

```
[Dashboard admin]
  • Compteurs : questions actives, chapitres, étudiants inscrits, sessions/semaine
  • Alertes : questions sans réponse définie, taux d'erreur > 80%, chapitres vides
  • [Gérer les topics] [Gérer les questions] [Importer Word] [Statistiques]
        │
        ▼
[Gestion des topics]
  • Arborescence éditable (ajouter/renommer/déplacer/supprimer)
  • Drag & drop pour réorganiser
        │
        ▼
[Gestion des questions]
  • Liste filtrée par topic, recherche textuelle
  • Par question : énoncé (tronqué), nb propositions, nb tentatives, taux d'erreur
  • CRUD complet : créer, éditer, supprimer, activer/désactiver
  • Éditeur de question : énoncé, propositions (2-5), cocher bonnes réponses,
    éditeur HTML riche pour l'explication
        │
        ▼
[Import depuis Word]
  • Upload du fichier .docx standardisé
  • Preview : nombre de questions détectées, alertes
  • Choix du topic cible
  • [Confirmer l'import]
        │
        ▼
[Statistiques globales — AGRÉGÉES, PAS DE TRACKING INDIVIDUEL]
  • Nombre d'utilisateurs inscrits et actifs (jour/semaine/mois)
  • Temps moyen passé sur l'app par session
  • Score moyen par chapitre (identifier les chapitres les plus difficiles)
  • Taux d'erreur par question (améliorer les explications)
  • Nombre de sessions par jour (tendance d'utilisation)
  • Pas de tableau listant des étudiants individuels
```

---

## 10. Statistiques et suivi de progression

### 10.1 Par session

| Métrique | Source |
|----------|--------|
| Score (%) | correct_count / question_count |
| Durée effective | duration_seconds - total_pause_seconds |
| Temps moyen / question | durée_effective / question_count |
| Questions correctes (100%) | COUNT WHERE is_correct = true |
| Questions partiellement correctes | COUNT WHERE is_partially_correct = true |
| Questions incorrectes | COUNT WHERE is_correct = false AND is_partially_correct = false |
| Répartition confiance | COUNT par valeur de confidence |

### 10.2 Par étudiant (tableau de bord)

| Métrique | Visualisation |
|----------|---------------|
| Progression | Graphique linéaire : score moyen par session sur 30/90 jours |
| Maîtrise par topic | Barres colorées par chapitre (vue topic_mastery) |
| Points faibles | Top 10 questions les plus ratées |
| Réponses partielles | Nombre de questions où l'étudiant a trouvé une partie des réponses |
| Régularité | Sessions par semaine (barres) |
| Temps total d'étude | Somme des durées effectives |
| Sessions en cours | Sessions en pause reprennables |
| Calibration | Graphique confiance déclarée vs réussite réelle |
| Fausses certitudes | Liste des questions "sûr + incorrect" |
| Carte de chaleur | Treemap de maîtrise (section 8) |

### 10.3 Vue admin (métriques agrégées uniquement — pas de tracking individuel)

**Orientation internationale : aucune donnée nominative affichée.**
L'admin ne voit jamais de tableau listant des étudiants individuels avec leurs scores.
Toutes les métriques sont agrégées et anonymes.

| Métrique | Utilité pédagogique |
|----------|---------------------|
| Nombre d'utilisateurs inscrits | Mesurer l'adoption |
| Utilisateurs actifs (jour/semaine/mois) | Mesurer l'engagement |
| Temps moyen passé par session | Comprendre l'usage |
| Score moyen par chapitre | Identifier les chapitres les plus difficiles qui méritent plus d'explications |
| Taux d'erreur par question | Améliorer la formulation ou l'explication |
| Taux de réponses partielles par question | Identifier les questions où les étudiants trouvent "presque" |
| Nombre de sessions par jour | Tendance d'utilisation |

---

## 11. Structure des fichiers du projet

```
physioquiz/
├── public/
│   ├── manifest.json              (Configuration PWA)
│   ├── service-worker.js          (Cache hors-ligne)
│   └── icons/                     (Icônes PWA 192x192, 512x512)
│
├── src/
│   ├── app/                       (Pages Next.js App Router)
│   │   ├── layout.tsx             (Layout global + providers)
│   │   ├── page.tsx               (Landing / redirection)
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   │
│   │   ├── (student)/
│   │   │   ├── dashboard/page.tsx          (Tableau de bord)
│   │   │   ├── topics/page.tsx             (Navigation arborescence)
│   │   │   ├── heatmap/page.tsx            (Carte de chaleur)
│   │   │   ├── quiz/
│   │   │   │   ├── setup/[topicId]/page.tsx    (Config session)
│   │   │   │   ├── play/[sessionId]/page.tsx   (Quiz entraînement)
│   │   │   │   └── results/[sessionId]/page.tsx (Résumé)
│   │   │   ├── exam/
│   │   │   │   ├── setup/[topicId]/page.tsx    (Config examen blanc)
│   │   │   │   ├── play/[sessionId]/page.tsx   (Examen en cours)
│   │   │   │   └── results/[sessionId]/page.tsx (Résultat + revue)
│   │   │   └── progress/page.tsx           (Stats + calibration)
│   │   │
│   │   └── (admin)/
│   │       ├── admin/page.tsx              (Dashboard admin)
│   │       ├── admin/topics/page.tsx       (Gestion arborescence)
│   │       ├── admin/questions/page.tsx    (Liste questions)
│   │       ├── admin/questions/[id]/page.tsx (Éditeur question)
│   │       ├── admin/import/page.tsx       (Import Word)
│   │       └── admin/stats/page.tsx        (Statistiques globales)
│   │
│   ├── components/
│   │   ├── ui/                    (Composants génériques)
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── TopicTree.tsx      (Arborescence navigable)
│   │   │   ├── Countdown.tsx      (Chronomètre examen blanc)
│   │   │   └── ConfidenceSelector.tsx (3 boutons de confiance)
│   │   │
│   │   ├── quiz/
│   │   │   ├── QuestionCard.tsx   (Énoncé + propositions)
│   │   │   ├── ChoiceList.tsx     (Cases à cocher A-E)
│   │   │   ├── CorrectionView.tsx (Correction + explication HTML)
│   │   │   └── SessionSummary.tsx (Résumé fin de session)
│   │   │
│   │   ├── exam/
│   │   │   ├── ExamQuestionCard.tsx (Question sans correction)
│   │   │   ├── ExamNavigator.tsx    (Navigation rapide Q1-Q40)
│   │   │   ├── FlagButton.tsx       (Marquer pour revue)
│   │   │   └── ExamResults.tsx      (Résultat + revue erreurs)
│   │   │
│   │   ├── stats/
│   │   │   ├── ProgressChart.tsx  (Courbe de progression)
│   │   │   ├── TopicMastery.tsx   (Barres par chapitre)
│   │   │   ├── WeakPoints.tsx     (Questions les + ratées)
│   │   │   ├── CalibrationChart.tsx (Confiance vs réussite)
│   │   │   ├── Heatmap.tsx        (Treemap carte de chaleur)
│   │   │   └── ActivityChart.tsx  (Sessions par semaine)
│   │   │
│   │   └── admin/
│   │       ├── QuestionEditor.tsx
│   │       ├── RichTextEditor.tsx
│   │       ├── WordImporter.tsx
│   │       └── AdminStats.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          (Client Browser)
│   │   │   ├── server.ts          (Client Server)
│   │   │   └── middleware.ts      (Auth middleware)
│   │   ├── quiz-engine.ts         (Algorithme de sélection pondérée)
│   │   ├── scoring.ts             (Notation partielle : scoreAnswer)
│   │   ├── pause-manager.ts       (Pause/resume sessions entraînement)
│   │   ├── exam-engine.ts         (Logique examen blanc)
│   │   ├── mastery.ts             (Calcul maîtrise pour heatmap)
│   │   └── utils.ts
│   │
│   ├── hooks/
│   │   ├── useQuiz.ts             (État du quiz entraînement)
│   │   ├── useExam.ts             (État de l'examen blanc)
│   │   ├── useProgress.ts         (Données de progression)
│   │   ├── useHeatmap.ts          (Données carte de chaleur)
│   │   ├── useTopics.ts           (Navigation arborescence)
│   │   └── useAuth.ts             (Session utilisateur)
│   │
│   └── types/
│       └── index.ts               (Types TypeScript globaux)
│
├── supabase/
│   ├── functions/
│   │   ├── select-questions/      (Edge function : algorithme pondéré)
│   │   └── validate-answer/       (Edge function : validation côté serveur)
│   ├── migrations/
│   │   ├── 001_create_profiles.sql
│   │   ├── 002_create_topics.sql
│   │   ├── 003_create_questions.sql
│   │   ├── 004_create_sessions.sql
│   │   ├── 005_create_views.sql
│   │   └── 006_create_rls_policies.sql
│   └── seed.sql
│
├── scripts/
│   ├── preprocessing.py
│   ├── import_to_db.py
│   └── requirements.txt          (python-docx, mammoth, supabase-py)
│
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 12. Sécurité et bonnes pratiques

### Authentification et autorisation

- Supabase Auth gère les tokens JWT et les sessions
- Row Level Security (RLS) : chaque étudiant ne voit que ses propres données
- Rôle admin vérifié côté serveur pour toutes les opérations d'écriture

### Anti-triche

- Les réponses correctes ne sont JAMAIS envoyées au client avant validation
- La validation se fait via une Supabase Edge Function côté serveur
- L'Edge Function reçoit : session_id, question_id, choices sélectionnés, confidence
- Elle compare aux réponses en base et retourne : is_correct + explanation_html
- Le temps de réponse est enregistré

### Sécurité du contenu

- Explications HTML sanitisées avec DOMPurify avant affichage
- Images servies depuis Supabase Storage avec URLs signées
- Protection CSRF via headers Next.js

### Examen blanc — anti-triche supplémentaire

- Le chronomètre est vérifié côté serveur (started_at + time_limit_seconds)
- Si le client envoie une réponse après expiration du temps, elle est rejetée
- Les questions de l'examen sont envoyées au client SANS les réponses correctes
- La correction complète n'est envoyée qu'après soumission de l'examen

---

## 13. Workflow de développement et qualité

### 13.1 Ressources disponibles

| Ressource | Type | Usage |
|-----------|------|-------|
| **Supabase MCP** | MCP Server | Interaction directe avec la BDD Supabase depuis Claude Code (créer tables, tester requêtes, gérer le storage). Déjà configuré. |
| **Skill frontend-design** | Skill Claude Code | Consulter avant de créer les composants UI pour obtenir un design de qualité production. Ne pas charger en permanence — invoquer à la demande : "Consulte le skill frontend-design avant de créer ce composant." |
| **docs/ARCHITECTURE.md** | Document de référence | Ce document. Le plan maître. Toujours vérifier la conformité contre ce document. |
| **docs/PROGRESS.md** | Document vivant | Suivi de progression mis à jour après chaque sprint (voir 13.3). |

### 13.2 Linting et formatage (qualité automatique)

Le linting est géré par des outils déterministes, pas par l'agent. Ces outils sont
configurés une fois au Sprint 1 et tournent automatiquement.

**Configuration au Sprint 1 :**

```json
// package.json — scripts
{
  "scripts": {
    "lint": "eslint src/ --ext .ts,.tsx",
    "lint:fix": "eslint src/ --ext .ts,.tsx --fix",
    "format": "prettier --write 'src/**/*.{ts,tsx,css,json}'",
    "type-check": "tsc --noEmit",
    "validate": "npm run type-check && npm run lint"
  }
}
```

**Outils :**

| Outil | Rôle | Configuration |
|-------|------|---------------|
| **ESLint** | Qualité du code, erreurs courantes | `eslint-config-next` + règles strictes TypeScript |
| **Prettier** | Formatage uniforme (indentation, guillemets, etc.) | Tabulations 2 espaces, simple quotes, trailing commas |
| **TypeScript strict** | Vérification des types | `strict: true` dans tsconfig.json |

**Règle : ne jamais mettre les règles de style dans CLAUDE.md.** Les linters font
ce travail mieux et plus vite. Claude Code doit juste exécuter `npm run validate`
après chaque modification.

### 13.3 Suivi de progression (PROGRESS.md)

Après chaque sprint, le document `docs/PROGRESS.md` est mis à jour. Ce document
permet de savoir exactement où en est le projet à tout moment.

**Format de PROGRESS.md :**

```markdown
# PhysioQuiz — Suivi de progression

## État actuel
- **Sprint en cours** : Sprint 2
- **Dernière mise à jour** : 2026-04-15
- **Statut global** : En cours

## Sprint 0 — Preprocessing ✅ TERMINÉ
- [x] Script preprocessing.py fonctionnel
- [x] 469 questions extraites de PCEM_II_s_def3.doc
- [x] 12 questions marquées ⚠️ → corrigées manuellement
- [x] Document standardisé validé
- **Notes** : 3 questions avaient des réponses manquantes reconstituées
  via le gras. 2 images manquantes dans le chapitre Endocrinologie.

## Sprint 1 — Fondations ✅ TERMINÉ
- [x] Next.js + Tailwind + TypeScript initialisé
- [x] Supabase configuré (tables, vues, RLS)
- [x] Auth fonctionnel (email + Google)
- [x] PWA configuré
- [x] Linting (ESLint + Prettier + TypeScript strict)
- **Notes** : RLS testé avec 2 comptes. PWA installable sur Android,
  iOS nécessite HTTPS (ok avec Vercel).

## Sprint 2 — Quiz entraînement 🔄 EN COURS
- [x] Import des questions dans Supabase
- [x] Navigation des topics (arborescence)
- [ ] Algorithme de sélection pondérée
- [ ] Composant QuestionCard
- [ ] Notation partielle
- [ ] Pause/Resume
- **Blockers** : aucun
- **Décisions prises en cours de route** : aucune

## Sprint 3 — Examen blanc ⬜ À FAIRE
## Sprint 4 — Statistiques ⬜ À FAIRE
## Sprint 5 — Admin ⬜ À FAIRE
## Sprint 6 — Polish ⬜ À FAIRE
```

**Règle : après chaque sprint terminé, avant de passer au suivant :**
1. Relire le plan initial de ce sprint dans ARCHITECTURE.md
2. Mettre à jour PROGRESS.md avec ce qui a été fait, ce qui a changé
3. Noter les décisions prises en cours de route qui diffèrent de l'architecture
4. Lancer le processus de review (voir 13.4)

### 13.4 Review obligatoire après chaque sprint

Après chaque sprint terminé, **deux agents de review** sont invoqués avant de
passer au sprint suivant. Ils tournent dans des contextes frais pour ne pas
être biaisés par le code qu'ils viennent d'écrire.

**Agent 1 — Reviewer technique :**

```markdown
# Fichier : .claude/agents/tech-reviewer.md
---
name: tech-reviewer
description: Reviews code quality and spec compliance after each sprint
tools: Read, Grep, Glob, Bash
model: opus
---
Vous êtes un reviewer technique senior. Vous vérifiez le code produit
pendant le sprint qui vient de se terminer.

Checklist :
1. CONFORMITÉ : Comparer le code avec docs/ARCHITECTURE.md section par section.
   Lister tout écart entre le plan et l'implémentation.
2. ANTI-TRICHE : Vérifier que les réponses correctes ne sont JAMAIS envoyées
   au client avant validation (grep pour is_correct dans les API routes).
3. NOTATION : Vérifier que la logique de scoring partiel est correcte
   (1 mauvaise = 0%, partiel = bonnes/total, 100% = toutes les bonnes).
4. SÉCURITÉ : Vérifier que DOMPurify est utilisé pour tout HTML dynamique.
   Vérifier que les politiques RLS sont en place.
5. TYPES : Exécuter `npm run type-check` et rapporter les erreurs.
6. LINT : Exécuter `npm run lint` et rapporter les erreurs.

Format de sortie : liste des problèmes classés par sévérité
(bloquant / important / mineur), avec le fichier et la ligne concernés.
```

**Agent 2 — Reviewer UX/accessibilité :**

```markdown
# Fichier : .claude/agents/ux-reviewer.md
---
name: ux-reviewer
description: Reviews UI/UX quality and mobile responsiveness
tools: Read, Grep, Glob
model: sonnet
---
Vous êtes un reviewer UX spécialisé en applications éducatives mobiles.

Checklist :
1. RESPONSIVE : Vérifier que tous les composants utilisent des classes
   Tailwind responsive (sm:, md:, lg:). Aucune largeur fixe en px
   sur les containers principaux.
2. ACCESSIBILITÉ : Vérifier les labels sur les inputs, le contraste
   des couleurs, les aria-labels sur les boutons d'action.
3. UX QUIZ : Vérifier que le flow question → confiance → valider →
   correction → suivante est fluide et logique.
4. UX EXAMEN : Vérifier que la navigation libre fonctionne (précédent,
   suivant, saut direct, marquage).
5. MOBILE : Vérifier que les boutons sont assez grands pour le toucher
   (min 44px), que les textes sont lisibles (min 14px).

Format de sortie : liste des problèmes classés par sévérité,
avec captures d'écran du code problématique.
```

**Processus de review :**

```
Sprint N terminé
        │
        ▼
Mettre à jour PROGRESS.md
        │
        ▼
Lancer tech-reviewer (contexte frais)
  "Use the tech-reviewer agent to review all code from Sprint N"
        │
        ▼
Lancer ux-reviewer (contexte frais)
  "Use the ux-reviewer agent to review all UI from Sprint N"
        │
        ▼
Corriger les problèmes bloquants et importants
        │
        ▼
Commit : "review(sprint-N): fix issues from tech and ux review"
        │
        ▼
Passer au Sprint N+1
```

### 13.5 CLAUDE.md recommandé

Ce fichier doit rester **sous 200 lignes** et ne contenir que ce qui est
universellement applicable. Les règles de style sont gérées par les linters.

```markdown
# PhysioQuiz

## Projet
Application PWA de quiz médical (Physiologie) pour étudiants en médecine.
Stack : Next.js 14 + Tailwind CSS + Supabase + TypeScript.

## Documents de référence
- Architecture complète : docs/ARCHITECTURE.md (LE document de référence)
- Progression : docs/PROGRESS.md (mis à jour après chaque sprint)

## Ressources
- Supabase MCP disponible pour interagir avec la BDD
- Pour les composants UI complexes, consulter le skill frontend-design
- Agents de review disponibles : tech-reviewer, ux-reviewer

## Règles critiques (NON NÉGOCIABLES)
- JAMAIS envoyer les réponses correctes au client avant validation
- La validation se fait UNIQUEMENT via Edge Functions côté serveur
- Notation partielle : 1 mauvaise réponse cochée = score 0%
- Examen blanc : chrono côté serveur, PAS de pause possible
- Vue admin : métriques agrégées UNIQUEMENT, pas de tracking individuel
- Tout HTML dynamique DOIT passer par DOMPurify
- Document Word original JAMAIS modifié (toujours une copie)

## Commandes
- npm run dev — dev server
- npm run build — build production
- npm run validate — type-check + lint (EXÉCUTER après chaque modification)
- npm run format — formatter le code avec Prettier
- npx supabase db push — appliquer les migrations

## Workflow après chaque sprint
1. Exécuter npm run validate
2. Mettre à jour docs/PROGRESS.md
3. Lancer le tech-reviewer agent
4. Lancer le ux-reviewer agent
5. Corriger les problèmes bloquants
6. Commit et passer au sprint suivant

## Patterns à suivre
- Composants React : suivre les patterns dans src/components/
- Edge Functions : suivre le pattern de supabase/functions/validate-answer/
- État global : Zustand (stores dans src/hooks/)
- Ne JAMAIS mettre de règles de style ici — les linters s'en chargent
```

### 13.6 Structure des fichiers de configuration

```
physioquiz/
├── .claude/
│   ├── agents/
│   │   ├── tech-reviewer.md       (Agent review technique)
│   │   └── ux-reviewer.md         (Agent review UX)
│   └── settings.json              (Permissions Claude Code)
├── CLAUDE.md                      (< 200 lignes, voir 13.5)
├── docs/
│   ├── ARCHITECTURE.md            (Ce document — plan maître)
│   └── PROGRESS.md                (Suivi de progression vivant)
├── .eslintrc.json                 (Config ESLint)
├── .prettierrc                    (Config Prettier)
├── tsconfig.json                  (TypeScript strict)
└── ...
```

---

## 14. Plan de développement (Sprints détaillés)

### Sprint 0 — Preprocessing du contenu (Semaine 1)

**Objectif** : Créer une copie standardisée du fichier Word original (l'original n'est jamais modifié).

**Tâches** :
- [ ] Script preprocessing.py :
  - Entrée : fichier original (ex: PCEM_II_s_def3.doc)
  - Sortie : copie standardisée (ex: PCEM_II_s_def3_standardise.docx)
  - L'original n'est JAMAIS touché
  - Convertir .doc en .docx (LibreOffice) si nécessaire
  - Parser le document : détecter questions, propositions, réponses, explications
  - **PASSE 1 — Compléter les réponses manquantes** :
    - Détecter les questions avec "Réponse : ........." ou réponse absente
    - Pour celles-ci, lire quelles propositions sont en gras
    - Reconstituer la ligne Réponse à partir du gras
    - Marquer ⚠️ les questions où ni la ligne Réponse ni le gras ne donnent d'info
  - **PASSE 2 — Standardiser le format** :
    - Normaliser toutes les réponses en "Réponse : A, C, E"
    - Supprimer le gras des propositions (les réponses sont déjà dans la ligne Réponse)
    - Renuméroter séquentiellement dans l'ordre d'apparition dans le document
    - Ajouter "Explication :" quand absent
    - Préserver images et tableaux intacts
    - Supprimer les compteurs dans les titres de chapitres "(30)"
  - Générer le .docx standardisé
- [ ] Tester sur PCEM_II_s_def3.doc (~469 questions)
- [ ] Comparer l'original et la copie côte à côte
- [ ] Relecture et validation de la copie standardisée par vous
- [ ] Corriger manuellement les cas marqués ⚠️

**Livrable** : Document Word standardisé validé, prêt pour l'import.
L'original est intact pour comparaison.

---

### Sprint 1 — Fondations techniques (Semaines 2-3)

**Objectif** : Projet fonctionnel avec authentification et structure de base.

**Tâches** :
- [ ] Initialiser Next.js 14 + Tailwind CSS + TypeScript
- [ ] Configurer Supabase :
  - Créer le projet
  - Migrations SQL : tables profiles, topics, questions, choices,
    question_images, sessions, session_answers, session_answer_choices
  - Vues SQL : question_user_stats, question_error_rate,
    user_progress_over_time, topic_mastery
  - Politiques RLS
- [ ] Authentification :
  - Page inscription (email, mot de passe, nom, université, année)
  - Page connexion
  - Middleware de protection des routes
  - Gestion du rôle admin
- [ ] Layout de base :
  - Header avec navigation
  - Sidebar (desktop) / bottom nav (mobile)
  - Routing étudiant vs admin
- [ ] Configuration PWA :
  - manifest.json (nom, icônes, couleurs)
  - Service worker basique
  - Meta tags pour iOS
- [ ] Linting et formatage (voir section 13.2) :
  - Installer et configurer ESLint (eslint-config-next + TypeScript strict)
  - Installer et configurer Prettier
  - Configurer tsconfig.json avec strict: true
  - Ajouter les scripts npm : lint, lint:fix, format, type-check, validate
  - Vérifier que `npm run validate` passe sans erreur
- [ ] Workflow de développement (voir section 13) :
  - Créer CLAUDE.md à la racine (voir section 13.5)
  - Créer docs/ARCHITECTURE.md (copie de ce document)
  - Créer docs/PROGRESS.md (voir section 13.3)
  - Créer .claude/agents/tech-reviewer.md (voir section 13.4)
  - Créer .claude/agents/ux-reviewer.md (voir section 13.4)

**Livrable** : App déployée sur Vercel, inscription/connexion fonctionnelle,
navigation vide mais routée. Linting et workflow de review en place.

---

### Sprint 2 — Quiz entraînement (Semaines 4-5)

**Objectif** : Parcours complet de quiz en mode entraînement avec notation partielle et pause/resume.

**Tâches** :
- [ ] Script import_to_db.py :
  - Parser le .docx standardisé
  - Extraire les images → upload Supabase Storage
  - Convertir explications en HTML (via mammoth)
  - Insérer topics, questions, choices dans la base
- [ ] Navigation des cours :
  - Composant TopicTree (arborescence 4 niveaux, accordéon)
  - Compteur de questions par topic
  - Barre de maîtrise colorée par topic
- [ ] Configuration de session :
  - Choix du nombre de questions (10 / 25 / toutes)
  - Option inclure sous-chapitres
  - Bouton [Démarrer]
- [ ] Algorithme de sélection (quiz-engine.ts) :
  - Supabase Edge Function select-questions
  - Calcul des poids bruts (3 cas : jamais vue, avec confiance, sans confiance)
  - Bonus fausse certitude (×1.5)
  - Normalisation (somme probabilités = 1)
  - Tirage pondéré sans remise (session courte)
  - Shuffle simple (toutes les questions)
  - Shuffle des propositions par question
- [ ] Composant QuestionCard :
  - Affichage de l'énoncé
  - Cases à cocher pour les propositions
  - ConfidenceSelector (3 boutons optionnels)
  - Bouton Valider (actif sans confiance)
- [ ] Notation partielle (scoring.ts) :
  - Implémenter la fonction scoreAnswer (section 5bis)
  - Si au moins 1 mauvaise cochée → score = 0%, is_correct = false, is_partially_correct = false
  - Si seulement des bonnes cochées mais pas toutes → score = bonnes_cochées/total_bonnes, is_partially_correct = true
  - Si toutes les bonnes et aucune mauvaise → score = 100%, is_correct = true
- [ ] Supabase Edge Function validate-answer :
  - Reçoit : session_id, question_id, selected_choices, confidence
  - Applique la notation partielle (scoring.ts)
  - Enregistre session_answer (is_correct, is_partially_correct, score_percent)
    + session_answer_choices
  - Met à jour sessions (correct_count, wrong_count, partial_count)
  - Retourne : is_correct, is_partially_correct, score_percent,
    correct_choices, explanation_html
- [ ] CorrectionView :
  - Propositions colorées (vert = correcte cochée, rouge = incorrecte cochée,
    vert pâle = correcte non cochée par l'étudiant)
  - Affichage du score partiel si applicable ("Vous avez trouvé 2/3 bonnes réponses")
  - Message si une mauvaise réponse a annulé le score
  - Explication HTML rendue via DOMPurify
- [ ] Pause / Resume (pause-manager.ts) :
  - Bouton [⏸ Pause] dans le header du quiz (mode entraînement uniquement)
  - Pause : enregistre is_paused=true, paused_at=NOW()
  - Resume : calcule total_pause_seconds, reprend à current_question_index
  - Détection automatique de sortie (visibilitychange/beforeunload → pause auto)
  - Sessions en pause > 7 jours → marquées abandonnées
  - Affichage "Sessions en cours" sur le tableau de bord avec bouton [▶ Reprendre]
  - Durée effective = temps total - temps en pause
- [ ] SessionSummary :
  - Score, durée effective, temps moyen
  - Répartition : ✅ correctes / 🟡 partielles / ❌ incorrectes
  - Liste des questions ratées et partielles (cliquable)
  - Bouton [Recommencer les ratées et partielles]

**Livrable** : Parcours complet de quiz fonctionnel avec sélection intelligente,
notation partielle et pause/resume.

**Review de fin de sprint (obligatoire avant Sprint 3) :**
- [ ] Exécuter `npm run validate` — zéro erreur
- [ ] Mettre à jour docs/PROGRESS.md
- [ ] Lancer tech-reviewer : vérifier anti-triche, scoring, conformité architecture
- [ ] Lancer ux-reviewer : vérifier responsive, accessibilité, flow quiz
- [ ] Corriger les problèmes bloquants

---

### Sprint 3 — Examen blanc (Semaine 6)

**Objectif** : Mode examen blanc complet.

**Tâches** :
- [ ] Page configuration examen blanc :
  - Choix topic, nombre de questions, durée
  - Option inclure sous-chapitres
  - Avertissement "correction à la fin uniquement"
- [ ] Sélection aléatoire uniforme :
  - Si sous-ensemble : tirage uniforme sans remise
  - Si toutes : shuffle simple
  - Envoi des questions SANS réponses correctes
- [ ] ExamQuestionCard :
  - Comme QuestionCard mais SANS correction immédiate
  - Pas de bouton de confiance
  - Bouton FlagButton (marquer pour revue)
- [ ] ExamNavigator :
  - Grille de numéros cliquables (Q1, Q2, …, Q40)
  - Visuellement : ● répondu, ○ non répondu, 🚩 marqué
  - Navigation libre (précédent/suivant + saut direct)
- [ ] Countdown :
  - Chronomètre décomptant
  - Vérification côté serveur (started_at + time_limit)
  - Alerte à 5 minutes restantes
  - Fin automatique au temps imparti
  - Questions non répondues = incorrectes
- [ ] Soumission de l'examen :
  - Confirmation si questions non répondues
  - Edge Function qui corrige toutes les réponses d'un coup
    (applique la notation partielle sur chaque question)
  - Retourne les résultats complets
- [ ] ExamResults :
  - Score, durée effective
  - Résumé (✅ correctes / 🟡 partielles / ❌ incorrectes / ⬜ non répondues)
  - Évolution des examens blancs (graphique)
  - Revue complète des erreurs et partielles avec explications
  - Pas de bouton Pause (le chrono ne s'arrête jamais)

**Livrable** : Mode examen blanc fonctionnel de bout en bout.

**Review de fin de sprint (obligatoire avant Sprint 4) :**
- [ ] Exécuter `npm run validate` — zéro erreur
- [ ] Mettre à jour docs/PROGRESS.md
- [ ] Lancer tech-reviewer : vérifier chrono serveur, anti-triche examen, scoring
- [ ] Lancer ux-reviewer : vérifier navigation libre, marquage, countdown
- [ ] Corriger les problèmes bloquants

---

### Sprint 4 — Statistiques et carte de chaleur (Semaine 7)

**Objectif** : Tableau de bord riche et carte de chaleur.

**Tâches** :
- [ ] Tableau de bord étudiant :
  - Score moyen cette semaine (metric card)
  - ProgressChart : graphique linéaire Recharts (30/90 jours)
  - Dernières sessions (liste avec topic, score, date)
  - Sessions en pause : encart [⏸ Session en cours — Reprendre] si applicable
  - WeakPoints : top 5 questions les plus ratées
  - Réponses partielles : nombre de questions partiellement réussies
  - ActivityChart : sessions par semaine (barres)
  - Temps total d'étude (durées effectives, hors pause)
- [ ] Carte de chaleur (Heatmap.tsx) :
  - Requête sur la vue topic_mastery
  - Treemap Recharts coloré selon l'échelle de couleurs
  - Taille des rectangles proportionnelle au nombre de questions
  - Clic sur un rectangle → page du topic
  - Légende des couleurs
- [ ] Calibration (CalibrationChart.tsx) :
  - SI < 30% des réponses ont une confiance :
    afficher message d'incitation + barre de progression
  - SI ≥ 30% :
    graphique barres groupées :
    axe X = confiance (je devine / hésitant / sûr)
    axe Y = taux de réussite réel
    + ligne de référence "calibration parfaite"
    + liste des fausses certitudes

**Livrable** : Tableau de bord complet avec carte de chaleur et calibration.

**Review de fin de sprint (obligatoire avant Sprint 5) :**
- [ ] Exécuter `npm run validate` — zéro erreur
- [ ] Mettre à jour docs/PROGRESS.md
- [ ] Lancer tech-reviewer : vérifier calculs de maîtrise, vues SQL, conformité
- [ ] Lancer ux-reviewer : vérifier lisibilité graphiques, carte de chaleur sur mobile
- [ ] Corriger les problèmes bloquants

---

### Sprint 5 — Panneau admin (Semaines 8-9)

**Objectif** : Interface d'administration complète.

**Tâches** :
- [ ] Dashboard admin :
  - Compteurs (questions, chapitres, étudiants, sessions/semaine)
  - Alertes qualité (questions sans réponse, taux erreur > 80%)
- [ ] Gestion des topics :
  - CRUD complet
  - Arborescence éditable avec drag & drop
- [ ] Gestion des questions :
  - Liste filtrée par topic avec recherche
  - QuestionEditor :
    - Champ énoncé (textarea)
    - Propositions dynamiques (2-5, ajouter/supprimer)
    - Checkboxes pour les bonnes réponses
    - RichTextEditor pour l'explication (basé sur TipTap ou similaire)
  - Suppression / activation / désactivation
- [ ] Import Word (WordImporter.tsx) :
  - Upload du .docx standardisé
  - Appel à un endpoint qui parse le fichier
  - Preview : nombre de questions, alertes
  - Choix du topic cible
  - Confirmation et import
- [ ] Statistiques admin (AdminStats.tsx) — AGRÉGÉES UNIQUEMENT :
  - Nombre d'utilisateurs inscrits et actifs (jour/semaine/mois)
  - Temps moyen passé sur l'app par session
  - Score moyen par chapitre (identifier les chapitres difficiles
    qui méritent plus d'explications)
  - Taux d'erreur par question (améliorer la formulation)
  - Taux de réponses partielles par question
  - Nombre de sessions par jour (tendance d'utilisation)
  - PAS de tableau listant des étudiants individuels
  - PAS de tracking nominatif (orientation internationale)

**Livrable** : Panneau admin fonctionnel, import Word opérationnel.

**Review de fin de sprint (obligatoire avant Sprint 6) :**
- [ ] Exécuter `npm run validate` — zéro erreur
- [ ] Mettre à jour docs/PROGRESS.md
- [ ] Lancer tech-reviewer : vérifier CRUD admin, import Word, métriques agrégées
- [ ] Lancer ux-reviewer : vérifier éditeur de questions, import UX
- [ ] Corriger les problèmes bloquants

---

### Sprint 6 — Polish, tests et déploiement (Semaine 10)

**Objectif** : Application prête pour les premiers utilisateurs.

**Tâches** :
- [ ] Tests mobile :
  - iOS Safari
  - Android Chrome
  - Installation PWA sur les deux
- [ ] Responsive design :
  - Toutes les pages testées sur 320px, 768px, 1024px
  - Carte de chaleur lisible sur mobile
  - ExamNavigator utilisable au toucher
- [ ] Performance :
  - Lazy loading des images dans les explications
  - Pagination des listes de questions (admin)
  - Cache des données de progression (Zustand persist)
- [ ] Mode hors-ligne basique :
  - Cache des questions déjà consultées
  - Message clair quand hors-ligne
- [ ] Corrections de bugs
- [ ] Déploiement production sur Vercel + Supabase

**Livrable** : Application déployée, testée, prête à être partagée aux étudiants.

---

## 15. Évolutions futures

### Phase 2 — Vidéos de cours

- Champs video_url + video_timestamp déjà dans la table questions
- Après correction, bouton "Voir le cours" → vidéo au timestamp exact
- Player vidéo intégré (YouTube/Vimeo embed)

---

## Annexe A : Résumé des décisions techniques

| Décision | Choix | Raison |
|----------|-------|--------|
| Format source | Word (.docx) standardisé (copie) | Original jamais touché, comparaison côte à côte |
| Preprocessing | 2 passes (compléter réponses via gras, puis standardiser) | Exploite le gras pour combler les réponses manquantes |
| Explications | HTML riche en base | Préserve tableaux et images |
| Images | Supabase Storage | Intégré, CDN, gratuit 1 Go |
| Framework | Next.js 14 + React | PWA + SSR + écosystème |
| BDD | PostgreSQL via Supabase | Gratuit, requêtes complexes, RLS |
| Auth | Supabase Auth | Email + Google |
| Hébergement | Vercel | Gratuit, CI/CD |
| Mobile | PWA | Un seul code, installable |
| Sélection questions | Pondérée (3 composantes) | Basé sur les sciences cognitives |
| Questions jamais vues | Poids fixe = 0.70 | Priorité haute à la découverte |
| Mode toutes/examen | Aléatoire uniforme | Pas de pondération, toutes les questions |
| Notation | Partielle, annulée par 1 mauvaise | Récompense le savoir partiel, pénalise le hasard |
| Flags réponse | is_correct + is_partially_correct + score_percent | Distinguer 100%, partiel et 0% |
| Confiance | Optionnelle, incitée par stats | Pas de friction, mais valeur ajoutée |
| Pause/Resume | Entraînement uniquement, jamais examen blanc | L'étudiant peut reprendre sa session |
| Vue admin | Métriques agrégées uniquement | Orientation internationale, pas de tracking individuel |
| Coût initial | 0€ | Offres gratuites Supabase + Vercel |

## Annexe B : Résumé des décisions de design pédagogique

| Stratégie cognitive | Implémentation dans PhysioQuiz |
|--------------------|-------------------------------|
| Retrieval practice | QCM interactif (coeur de l'app) |
| Spaced repetition | Algorithme de sélection pondérée avec composante oubli |
| Dual coding | Explications avec schémas et tableaux (texte + visuel) |
| Metacognition | Indice de confiance + graphique de calibration |
| Testing effect | Correction immédiate avec explication détaillée |
| Desirable difficulties | Questions ratées reviennent plus souvent |
