# L’Atelier du Cœur et de la Circulation

Simulateur pédagogique et interactif de physiologie, physiopathologie et pharmacologie cardiovasculaire, conçu à trois échelles complémentaires : **Corps entier**, **Cœur (2D & 3D)** et **Vaisseau en coupe (2D & 3D)**.

---

## Liens d’accès direct

- **Dépôt GitHub officiel** : https://github.com/oumarmaiil-oss/lacirculation
- **Version GitHub Pages (après activation de Pages)** : https://oumarmaiil-oss.github.io/lacirculation/
- **Ouvrir l’application en ligne (Aperçu AI Studio)** : https://ais-pre-tqen3aesbw6bzfv4zrmynf-817968806978.europe-west2.run.app
- **Mode Cas cliniques (« Pathologies à soigner »)** : https://ais-pre-tqen3aesbw6bzfv4zrmynf-817968806978.europe-west2.run.app/?mode=cas
- **Environnement de développement local** : `http://localhost:3000`
- **Signaler une erreur ou suggérer une amélioration** : [Contacter Dr Oumar Sow](https://wa.me/221772030979)

---

## Fonctionnalités principales

### 1. Trois échelles synchronisées en temps réel
- **1 · Corps entier** : circulation systémique et pulmonaire, retour veineux, cibles d’organes (cerveau, cœur, reins, membres inférieurs), œdèmes périphériques et migration embolique.
- **2 · Cœur (2D & 3D WebGL)** : contraction auriculaire et ventriculaire synchrone, ouverture/fermeture des 4 valves, tissu nodal électrique (cyan, niveaux *Comprendre* et *Expert*), territoires coronaires (IVA, Cx, CD), diagramme de Wiggers et boucle Pression–Volume.
- **3 · Vaisseau en coupe (2D & 3D)** : endothélium, libération de NO, média élastique, progression de la plaque d’athérome (stades 0 à 6) et rupture avec thrombus occlusif.

### 2. Deux modes complémentaires
- **Exploration libre** : démarre dans un état physiologique normal (`120/80 mmHg`, `FC 70/min`, `0` pathologie active) puis permet d’explorer des exemples rapides ou de combiner maladies, valves et traitements à la demande.
- **Pathologies à soigner (7 cas cliniques évalués)** : HTA avec œdème sous Amlodipine, HTA résistante, insuffisance cardiaque à FE réduite, rétrécissement aortique serré avec défi d’auscultation à l’aveugle, fibrillation auriculaire à risque embolique, infarctus du myocarde (IVA) & plaque vulnérable, dysfonction ventriculaire droite.

### 3. Double trajectoire temporelle (« Sans traitement » ↔ « Avec traitement »)
- **Timeline chronologique en 5 étapes** : du départ sain ou aigu (`T0`) jusqu’aux complications ou au maintien à `5 ans`.
- **Alternance automatique des 2 issues** (`Alterner 2 issues : ON/OFF`) et pauses automatiques aux moments clés (`Pause auto`) pour observer comment la pathologie évolue sans traitement, puis comment le traitement agit jusqu’à la stabilisation.
- **Conduite & traitement ciblé** affiché directement sous l’explication clinique, avec application en un clic des protocoles de référence (dont la quadrithérapie post-IDM).

### 4. Lésions cliquables directement sur la scène & captures exportables
- **Lésions interactives** (2D et 3D) : cliquer sur un caillot (FA, coronaire, pulmonaire, veine cave, cérébral, fémoral), une plaque d’athérome ou une calcification valvulaire ouvre un menu d’actions directes (anticoagulation, désobstruction, protocole, coupe artérielle, remplacement valvulaire).
- **Audio Web Audio & export** : synthèse temps réel des bruits cardiaques (`B1`, `B2`, souffles systoliques et diastoliques) intégrée à la capture vidéo **WebM (vp9/vp8 + opus)** et export **PNG annoté** incluant les constantes hémodynamiques.

---

## Démarrage local

Prérequis : **Node.js 20+** et **npm**.

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de développement (port 3000)
npm run dev

# 3. Vérifier le typage TypeScript
npm run lint

# 4. Exécuter les tests unitaires du moteur physiologique et des scénarios
npx tsx --test src/engine/physiology.test.ts src/engine/clinicalCases.test.ts src/engine/storyboard.test.ts

# 5. Générer le build de production
npm run build
```

---

## Publier sur GitHub

Pour pousser ce projet vers votre dépôt `oumarmaiil-oss/lacirculation` depuis votre ordinateur (après téléchargement du projet) :

```bash
git init
git add .
git commit -m "feat: L'Atelier du Cœur et de la Circulation (2D/3D)"
git branch -M main
git remote add origin https://github.com/oumarmaiil-oss/lacirculation.git
git push -u origin main
```

> Si le dépôt `lacirculation` sur GitHub contient déjà un commit initial (README/Licence créé à la création), exécutez `git pull origin main --allow-unrelated-histories` avant `git push -u origin main` (ou `git push -u origin main --force-with-lease` pour le remplacer).  
> Un workflow `.github/workflows/deploy.yml` est inclus : dans **Settings → Pages → Source**, sélectionnez **GitHub Actions** pour publier automatiquement sur `https://oumarmaiil-oss.github.io/lacirculation/`.

---

## Architecture technique

- `src/engine/physiology.ts` — Moteur hémodynamique, calculs valvulaires, athérosclérose et pharmacodynamie.
- `src/engine/clinicalCases.ts` — 7 cas cliniques, évaluation multi-critères et projections temporelles (`T0` à `5 ans`).
- `src/engine/storyboard.ts` — Séquences visuelles en 5 moments clés pour chaque pathologie (avec et sans traitement).
- `src/engine/protocols.ts` — Protocoles thérapeutiques ciblés et fiches d’action sur lésions cliquables.
- `src/renderers/` — Rendus Canvas 2D haute densité (`corps2d.ts`, `coeur2d.ts`, `vaisseau2d.ts`, `charts.ts`) et scènes Three.js (`heart3d.ts`, `vessel3d.ts`).
- `src/audio/heartSounds.ts` — Synthèse Web Audio (`B1`, `B2`, souffles) et flux `MediaStreamAudioDestinationNode` pour l’enregistrement vidéo.

---

## Sources scientifiques & limites pédagogiques

Ce simulateur s’appuie sur les principes classiques de physiologie cardiovasculaire (diagramme de Wiggers, loi de Starling, couplage ventriculo-artériel, équation de Gorlin/Bernoulli) et sur les recommandations cliniques ESC/HAS pour l’HTA, l’insuffisance cardiaque, les valvulopathies, la fibrillation auriculaire et la maladie coronaire.

> **Avertissement** : outil strictement pédagogique destiné à la compréhension des mécanismes physiologiques et thérapeutiques. Il ne constitue ni un dispositif médical, ni une aide à la prescription réelle, et ne remplace pas un avis médical.

---

## Auteur & Licence

Conçu et développé par **Dr Oumar Sow**.  
Publié en open source sous **Licence MIT**.
