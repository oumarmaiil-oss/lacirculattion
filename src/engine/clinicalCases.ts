import { clamp, fmt } from './geometry2d';
import { activeTrt, applyPresetToParams, compute, freshP, TRT_IDS } from './physiology';
import type {
  ComputedResult,
  DynamicState,
  PresetConfig,
  SimParams,
  TabId,
  TimelineBranch,
  TimelineHorizon,
  TraitementId,
  ValveId,
} from './types';

export interface TimelineHorizonNarrative {
  horizon: string;
  untreatedTitle: string;
  untreatedText: string;
  treatedTitle: string;
  treatedText: string;
}

export interface ClinicalCaseDef {
  id: string;
  titre: string;
  sousTitre: string;
  tabDefaut: TabId;
  patient: string;
  motif: string;
  objectif: string;
  indices: string[];
  auscultationValve?: ValveId;
  preset: PresetConfig;
  horaires: [
    TimelineHorizonNarrative,
    TimelineHorizonNarrative,
    TimelineHorizonNarrative,
    TimelineHorizonNarrative,
  ];
}

export interface CriterionResult {
  label: string;
  ok: boolean;
  detail: string;
}

export interface CaseEvaluation {
  verdict: 'succes' | 'partiel' | 'echec';
  titreVerdict: string;
  score: number;
  criteres: CriterionResult[];
  explicationGlobale: string;
  pisteCorrection: string | null;
}

export interface TimelineProjection {
  params: SimParams;
  d: DynamicState;
  titre: string;
  resume: string;
  severite: 'ok' | 'warn' | 'crit';
  consequences: string[];
}

export const TIMELINE_LABELS: { step: TimelineHorizon; short: string; full: string }[] = [
  { step: 0, short: 'T0 · Départ', full: 'Départ · État initial' },
  { step: 1, short: '2 sem.', full: 'À 2 semaines · Début d’évolution' },
  { step: 2, short: '6 mois', full: 'À 6 mois · Retentissement' },
  { step: 3, short: '2 ans', full: 'À 2 ans · Stade critique' },
  { step: 4, short: '5 ans', full: 'À 5 ans · Issue / maintien' },
];

export const CLINICAL_CASES: ClinicalCaseDef[] = [
  {
    id: 'hta-oedeme',
    titre: '1 · HTA & œdème sous Amlodipine',
    sousTitre: 'Optimiser une monothérapie mal tolérée',
    tabDefaut: 'corps',
    patient: 'M. Diallo, 58 ans · HTA traitée par Amlodipine 10 mg seule',
    motif: 'Pression artérielle toujours au-dessus de la cible (≈ 140/92 mmHg) et chevilles très gonflées en fin de journée.',
    objectif: 'Normaliser la PA (< 138/86 mmHg) tout en faisant régresser l’œdème des chevilles et en préservant le rein.',
    indices: [
      'L’amlodipine seule dilate surtout l’artériole en amont : le sang pousse dans les capillaires de la cheville.',
      'Associer un IEC (Amloperin®) dilate aussi la veinule de sortie et réduit l’œdème d’environ 55 %.',
    ],
    preset: {
      mal: ['hta'],
      trt: ['ica'],
      dose: { ica: 2 },
      resist: 1.05,
      hvg: 0.25,
    },
    horaires: [
      {
        horizon: 'J0 · Crise',
        untreatedTitle: 'Surpression capillaire des chevilles',
        untreatedText: 'PA mal contrôlée et œdème malléolaire douloureux dû à l’amlodipine 10 mg isolée.',
        treatedTitle: 'Rééquilibrage artériolo-veineux',
        treatedText: 'La bithérapie ouvre les résistances artériolaires et soulage la pression capillaire.',
      },
      {
        horizon: '2 sem.',
        untreatedTitle: 'Œdèmes persistants & mauvaise observance',
        untreatedText: 'Le patient risque d’arrêter son traitement à cause du gonflement des chevilles.',
        treatedTitle: 'Chevilles dégonflées (−55 %) & PA maîtrisée',
        treatedText: 'L’œdème recule nettement, la tolérance est bonne et la kaliémie reste stable.',
      },
      {
        horizon: '6 mois',
        untreatedTitle: 'Épaississement progressif du VG (HVG)',
        untreatedText: 'La postcharge élevée oblige le ventricule gauche à s’hypertrophier et rigidifie les artères.',
        treatedTitle: 'Cœur protégé & paroi souple',
        treatedText: 'La baisse durable de la PA freine l’hypertrophie ventriculaire et protège l’endothélium.',
      },
      {
        horizon: '5 ans',
        untreatedTitle: 'Risque d’AVC, d’IC et d’atteinte rénale',
        untreatedText: 'L’HTA chronique et l’HVG favorisent une insuffisance cardiaque diastolique ou un AVC.',
        treatedTitle: 'Risque cardiovasculaire nettement abaissé',
        treatedText: 'Un seul comprimé bien toléré préserve cœur, cerveau et néphrons sur le long terme.',
      },
    ],
  },
  {
    id: 'hta-resistante',
    titre: '2 · HTA résistante sous bithérapie',
    sousTitre: 'Escalade thérapeutique vers la trithérapie',
    tabDefaut: 'corps',
    patient: 'Mme Ndiaye, 64 ans · HTA ancienne avec rigidité artérielle',
    motif: 'PA persistante au-dessus de 140/85 mmHg malgré une bithérapie modérée, avec début d’HVG.',
    objectif: 'Atteindre < 130/80 mmHg avec un comprimé optimisé, sans hypokaliémie ni hyperkaliémie sévère.',
    indices: [
      'Trois voies complémentaires valent mieux que de doubler un seul mécanisme.',
      'Tensoplus® associe Périndopril + Indapamide + Amlodipine en 1 seul comprimé.',
    ],
    preset: {
      mal: ['hta'],
      asso: 'amlo-peri',
      pres: { 'amlo-peri': '5-5' },
      resist: 1.08,
      rigidite: 0.38,
      hvg: 0.45,
    },
    horaires: [
      {
        horizon: 'J0 · Crise',
        untreatedTitle: 'Postcharge élevée malgré 2 molécules',
        untreatedText: 'La rigidité artérielle et la rétention hydrosodée maintiennent la PAS > 150 mmHg.',
        treatedTitle: 'Action synergique sur 3 cibles',
        treatedText: 'Vasodilatation calcique + blocage RAA + élimination sodée agissent ensemble.',
      },
      {
        horizon: '2 sem.',
        untreatedTitle: 'Pression non contrôlée & céphalées',
        untreatedText: 'Le rein subit une hyperpression glomérulaire continue.',
        treatedTitle: 'Objectif < 130/80 mmHg atteint',
        treatedText: 'La synergie IEC + diurétique maintient le potassium dans la zone sûre (≈ 4,1 mmol/L).',
      },
      {
        horizon: '6 mois',
        untreatedTitle: 'HVG marquée & souffrance rénale',
        untreatedText: 'Le VG s’épaissit, la PTDVG grimpe et le DFG commence à baisser.',
        treatedTitle: 'Régression de l’hypertrophie VG',
        treatedText: 'La diminution soutenue de la postcharge allège le travail cardiaque.',
      },
      {
        horizon: '5 ans',
        untreatedTitle: 'Complications majeures (AVC / IC / néphropathie)',
        untreatedText: 'Le risque d’accident vasculaire cérébral et d’insuffisance cardiaque explose.',
        treatedTitle: 'Protection multi-organes durable',
        treatedText: 'Réduction majeure de la morbidité vasculaire avec une observance simplifiée (1 comprimé).',
      },
    ],
  },
  {
    id: 'ic-vg-faible',
    titre: '3 · VG affaibli & congestion pulmonaire',
    sousTitre: 'Quadrithérapie de l’insuffisance cardiaque',
    tabDefaut: 'coeur',
    patient: 'M. Bernard, 67 ans · Dyspnée d’effort puis de repos, FE ≈ 32 %',
    motif: 'Ventricule gauche dilaté avec stase apicale, pression pulmonaire élevée (POG > 19 mmHg).',
    objectif: 'Décongestionner les poumons (POG < 15 mmHg), améliorer la FE et protéger cœur + rein (éviter ARNI+IEC).',
    indices: [
      'Associer un bloqueur RAA (ARNI ou IEC) + Bêtabloquant + Diurétique + iSGLT2.',
      'Attention : ne jamais associer ARNI et IEC en même temps (risque d’angiœdème).',
    ],
    preset: {
      act: { vg: 'faible' },
      contract: 1.18,
      volume: 5.7,
      resist: 1.55,
      hvg: 0.3,
    },
    horaires: [
      {
        horizon: 'J0 · Crise',
        untreatedTitle: 'Surcharge pulmonaire & bas débit',
        untreatedText: 'Le VG peine à se vider : le sang reflue vers les veines pulmonaires (essoufflement).',
        treatedTitle: 'Décharge rapide de la congestion',
        treatedText: 'Diurétique et iSGLT2 diminuent la surcharge ; l’ARNI/IEC abaisse la postcharge.',
      },
      {
        horizon: '2 sem.',
        untreatedTitle: 'Orthopnée & risque d’OAP aigu',
        untreatedText: 'Le moindre effort fait grimper la POG au-delà de 22 mmHg (œdème aigu du poumon).',
        treatedTitle: 'Respiration libérée & rein protégé',
        treatedText: 'La POG repasse sous 15 mmHg ; le patient tolère de nouveau l’effort modéré.',
      },
      {
        horizon: '6 mois',
        untreatedTitle: 'Dilatation irréversible du VG',
        untreatedText: 'L’hyper-stimulation adrénergique continue épuise les fibres myocardiques.',
        treatedTitle: 'Remodelage inverse : la FE remonte',
        treatedText: 'Le bêtabloquant et l’ARNI/IEC réduisent le volume VG et améliorent la fraction d’éjection.',
      },
      {
        horizon: '5 ans',
        untreatedTitle: 'Réhospitalisations répétées & choc cardiogénique',
        untreatedText: 'Bas débit chronique, souffrance rénale (syndrome cardio-rénal) et mortalité élevée.',
        treatedTitle: 'Survie prolongée & autonomie préservée',
        treatedText: 'La quadrithérapie stabilise durablement la pompe cardiaque et les poumons.',
      },
    ],
  },
  {
    id: 'ra-serre',
    titre: '4 · Valve obstruée (Rétrécissement aortique)',
    sousTitre: 'Auscultation, test d’effort & piège des vasodilatateurs',
    tabDefaut: 'coeur',
    patient: 'Mme Martin, 76 ans · Souffle systolique & vertiges à la marche',
    motif: 'Valve aortique calcifiée (0,75 cm²). Cliquez sur « Effort » et écoutez le cœur pour identifier la valve.',
    objectif: 'Identifier la valve atteinte à l’auscultation et ÉVITER les vasodilatateurs agressifs qui effondrent la PA.',
    indices: [
      'Un obstacle mécanique fixe empêche le débit d’augmenter : les vasodilatateurs font chuter la pression sans lever le barrage.',
      'Utilisez « Défi auscultation » pour désigner la valve responsable (aortique) et maintenez une PA stable.',
    ],
    auscultationValve: 'aortique',
    preset: {
      mal: ['ra'],
      act: { aortique: 'stenose' },
      hvg: 0.55,
    },
    horaires: [
      {
        horizon: 'J0 · Crise',
        untreatedTitle: 'Gradient ΔP élevé derrière l’obstacle',
        untreatedText: 'Le VG doit générer > 170 mmHg pour forcer le passage à travers la valve calcifiée.',
        treatedTitle: 'Hémodynamique respectée avant remplacement',
        treatedText: 'Sans vasodilatation brutale, la pression de perfusion coronaire et cérébrale reste sûre.',
      },
      {
        horizon: '2 sem.',
        untreatedTitle: 'Syncopes d’effort si vasodilatateur donné',
        untreatedText: 'Une chute de résistances périphériques devant une valve bloquée provoque un malaise.',
        treatedTitle: 'Absence de collapsus iatrogène',
        treatedText: 'Le bilan pré-TAVI / chirurgie valvulaire peut se faire en sécurité.',
      },
      {
        horizon: '6 mois',
        untreatedTitle: 'HVG concentrique sévère & angor',
        untreatedText: 'La paroi épaissie souffre d’ischémie sous-endocardique, surtout à l’effort.',
        treatedTitle: 'Indication valvulaire posée à temps',
        treatedText: 'La levée mécanique de l’obstacle (TAVI ou chirurgie) normalise le gradient ΔP.',
      },
      {
        horizon: '5 ans',
        untreatedTitle: 'Défaillance du VG sur obstacle négligé',
        untreatedText: 'Le muscle épuisé se dilate, la FE chute et une congestion pulmonaire s’installe.',
        treatedTitle: 'Fonction ventriculaire préservée',
        treatedText: 'Après remplacement valvulaire, le gradient disparaît et l’HVG régresse.',
      },
    ],
  },
  {
    id: 'fa-rapide',
    titre: '5 · Fibrillation auriculaire & risque d’AVC',
    sousTitre: 'Contrôle de fréquence & prévention embolique',
    tabDefaut: 'corps',
    patient: 'M. Koné, 71 ans · Pouls irrégulier à 115/min, stase auriculaire',
    motif: 'Oreillettes désynchronisées : le sang tourbillonne dans l’oreillette gauche et menace le cerveau.',
    objectif: 'Ralentir les ventricules (< 92/min) et protéger le cerveau avec un anticoagulant oral (pas seulement aspirine).',
    indices: [
      'Un bêtabloquant freine la conduction dans le nœud AV et calme le rythme ventriculaire.',
      'Seul un anticoagulant oral (AOD/AVK) réduit le risque d’AVC embolique d’environ 64 % en FA.',
    ],
    preset: {
      mal: ['fa'],
      fc: 112,
    },
    horaires: [
      {
        horizon: 'J0 · Crise',
        untreatedTitle: 'Tachycardie irrégulière & stase dans l’OG',
        untreatedText: 'Le remplissage rapide perd en efficacité et des micro-thrombus peuvent naître dans l’auricule.',
        treatedTitle: 'Cadence ralentie & sang fluidifié',
        treatedText: 'Le nœud AV filtre mieux les impulsions ; la cascade de coagulation est freinée.',
      },
      {
        horizon: '2 sem.',
        untreatedTitle: 'Palpitations & fatigue persistante',
        untreatedText: 'Le cœur bat trop vite et se fatigue inutilement.',
        treatedTitle: 'Fréquence maîtrisée (< 90/min)',
        treatedText: 'Le remplissage diastolique s’améliore et le débit cardiaque gagne en stabilité.',
      },
      {
        horizon: '6 mois',
        untreatedTitle: 'Risque croissant d’embolie cérébrale',
        untreatedText: 'Un caillot formé dans l’oreillette gauche peut partir à tout moment vers une artère cérébrale.',
        treatedTitle: 'Protection thromboembolique efficace',
        treatedText: 'Le risque d’AVC ischémique est réduit des deux tiers sans surrisque d’association aspirine+AOD.',
      },
      {
        horizon: '5 ans',
        untreatedTitle: 'AVC ischémique & cardiomyopathie rythmique',
        untreatedText: 'La tachycardie prolongée finit par affaiblir le VG, avec menace d’AVC grave.',
        treatedTitle: 'Cerveau et muscle cardiaque sauvegardés',
        treatedText: 'La fonction systolique reste normale et l’évènement embolique est évité.',
      },
    ],
  },
  {
    id: 'idm-plaque',
    titre: '6 · Infarctus (IVA) & plaque vulnérable',
    sousTitre: 'Prévention secondaire post-infarctus',
    tabDefaut: 'vaisseau',
    patient: 'Mme Sow, 61 ans · Plaque coronaire stade 5 + infarctus antérieur récent',
    motif: 'LDL élevé (1,90 g/L), sus-décalage ST et zone hypokinétique sur le territoire de l’IVA.',
    objectif: 'Stabiliser la plaque (LDL < 0,95 g/L), bloquer les plaquettes et protéger le VG du remodelage.',
    indices: [
      'La base post-IDM associe 4 piliers : Statine forte + Antiagrégant + IEC (ou ARA II) + Bêtabloquant.',
    ],
    preset: {
      mal: ['idm', 'dyslipidemie'],
      site: 'coronaire',
      plaque: 5,
      dysEndo: true,
    },
    horaires: [
      {
        horizon: 'J0 · Crise',
        untreatedTitle: 'Plaque inflammatoire à chape fragile',
        untreatedText: 'Le LDL oxydé entretient l’inflammation et les plaquettes menacent de boucher la coronaire.',
        treatedTitle: 'Quadrithérapie protectrice instaurée',
        treatedText: 'Statine + antiagrégant + IEC + bêtabloquant réduisent la demande en O₂ et le risque thrombotique.',
      },
      {
        horizon: '2 sem.',
        untreatedTitle: 'Nouvelle thrombose coronaire possible',
        untreatedText: 'Sans antiagrégant ni statine, le vaisseau reste hyper-réactif.',
        treatedTitle: 'Endothélium apaisé & LDL en chute (−54 %)',
        treatedText: 'La production de NO remonte et la plaque commence à se stabiliser.',
      },
      {
        horizon: '6 mois',
        untreatedTitle: 'Remodelage dilatatif post-infarctus',
        untreatedText: 'La cicatrice s’étire sous la contrainte, entraînant une baisse progressive de la FE.',
        treatedTitle: 'Chape fibreuse consolidée & VG préservé',
        treatedText: 'L’IEC et le bêtabloquant limitent la dilatation cavitaire.',
      },
      {
        horizon: '5 ans',
        untreatedTitle: 'Récidive d’infarctus & IC terminale',
        untreatedText: 'La plaque progresse vers la rupture occlusive (stade 6) et l’insuffisance cardiaque.',
        treatedTitle: 'Plaque stabilisée, pas de récidive',
        treatedText: 'Le contrôle strict du LDL et de la contrainte pariétale évite le deuxième accident.',
      },
    ],
  },
  {
    id: 'vd-htap',
    titre: '7 · Ventricule droit affaibli & surcharge veineuse',
    sousTitre: 'Alléger la congestion droite sans effondrer le débit',
    tabDefaut: 'coeur',
    patient: 'M. Leroy, 69 ans · PVC à 13 mmHg, jugulaires gonflées, œdèmes',
    motif: 'Le ventricule droit pousse difficilement vers les poumons : congestion veineuse systémique et bas remplissage gauche.',
    objectif: 'Faire redescendre la surcharge veineuse (PVC < 10 mmHg) tout en gardant un débit > 3,4 L/min et PAS > 95 mmHg.',
    indices: [
      'Un diurétique (ou iSGLT2) décharge la congestion veineuse.',
      'Attention à ne pas surdoser les vasodilatateurs qui feraient chuter la PA systémique.',
    ],
    preset: {
      act: { vd: 'faible' },
      volume: 5.5,
    },
    horaires: [
      {
        horizon: 'J0 · Crise',
        untreatedTitle: 'Stase dans les veines caves & le foie',
        untreatedText: 'La pression veineuse centrale élevée bloque le retour sanguin et gonfle les jambes.',
        treatedTitle: 'Décongestion prudente amorcée',
        treatedText: 'Le volume excédentaire diminue doucement sans priver le VD de sa précharge utile.',
      },
      {
        horizon: '2 sem.',
        untreatedTitle: 'Œdèmes massifs & ascite naissante',
        untreatedText: 'La surcharge droite retentit sur le foie et les reins.',
        treatedTitle: 'PVC abaissée & meilleure perfusion',
        treatedText: 'Les veines caves dégonflent et le ventricule gauche retrouve un remplissage correct.',
      },
      {
        horizon: '6 mois',
        untreatedTitle: 'Bas débit chronique & insuffisance rénale',
        untreatedText: 'La congestion veineuse rénale freine la filtration glomérulaire.',
        treatedTitle: 'Équilibre volémique stabilisé',
        treatedText: 'Le rein reste perfusé avec un DFG préservé.',
      },
      {
        horizon: '5 ans',
        untreatedTitle: 'Cœur pulmonaire décompensé',
        untreatedText: 'Épuisement du ventricule droit et congestion systémique réfractaire.',
        treatedTitle: 'Tolérance fonctionnelle maintenue',
        treatedText: 'La gestion mesurée de la volémie évite les hospitalisations répétées.',
      },
    ],
  },
];

export function evaluateCaseTreatment(
  cdef: ClinicalCaseDef,
  params: SimParams,
  _dyn: DynamicState,
  r: ComputedResult,
  auscultGuess?: ValveId | null
): CaseEvaluation {
  const { t, asso } = activeTrt(params);
  const criteres: CriterionResult[] = [];
  let fatalTrap = false;
  const trapReasons: string[] = [];

  // Universal iatrogenic safety guards
  if (t.iec && t.arni) {
    fatalTrap = true;
    trapReasons.push('Association formellement contre-indiquée : ARNI + IEC simultanés (risque d’angiœdème grave).');
  } else if (t.ara2 && t.arni) {
    fatalTrap = true;
    trapReasons.push('Double blocage AT1 inutile : ARNI contient déjà un ARA II (valsartan).');
  } else if (t.iec && t.ara2) {
    fatalTrap = true;
    trapReasons.push('Double blocage IEC + ARA II déconseillé (hyperkaliémie et risque rénal).');
  }

  if (r.bio.potassium > 5.4) {
    fatalTrap = true;
    trapReasons.push(`Hyperkaliémie sévère (K⁺ = ${r.bio.potassium.toFixed(1)} mmol/L).`);
  } else if (r.bio.potassium < 3.4) {
    fatalTrap = true;
    trapReasons.push(`Hypokaliémie sévère (K⁺ = ${r.bio.potassium.toFixed(1)} mmol/L).`);
  }

  if (r.bio.dfg < 42) {
    fatalTrap = true;
    trapReasons.push(`Dégradation rénale sévère (DFG = ${r.bio.dfg} mL/min).`);
  }

  switch (cdef.id) {
    case 'hta-oedeme': {
      const paOk = r.pas <= 138 && r.pad <= 88;
      const oedOk = r.oedeme < 0.4;
      const comboOk = r.raa > 0 && t.ica;
      criteres.push({
        label: 'Pression artérielle maîtrisée (< 138/88)',
        ok: paOk,
        detail: `${fmt(r.pas)}/${fmt(r.pad)} mmHg`,
      });
      criteres.push({
        label: 'Œdème des chevilles résolu (−55 %)',
        ok: oedOk,
        detail: oedOk ? 'Œdème réduit' : 'Œdème encore marqué (amlodipine sans IEC/ARA II)',
      });
      criteres.push({
        label: 'Association protectrice (ex. Amloperin®)',
        ok: comboOk || (r.raa > 0 && !t.ica && paOk),
        detail:
          asso === 'amlo-peri'
            ? 'Amloperin® actif (1 comprimé)'
            : comboOk
              ? 'ICA + bloqueur RAA actifs'
              : 'Ajouter un IEC (ou basculer vers Amloperin®)',
      });
      criteres.push({
        label: 'Sécurité biologique (K⁺ & rein)',
        ok: !fatalTrap,
        detail: `K⁺ ${r.bio.potassium.toFixed(1)} mmol/L · DFG ${r.bio.dfg} mL/min`,
      });
      break;
    }

    case 'hta-resistante': {
      const paOk = r.pas <= 132 && r.pad <= 84;
      const triOk = r.raa > 0 && t.ica && t.diuretique;
      const onePill = asso === 'peri-inda-amlo';
      criteres.push({
        label: 'Objectif tensionnel (< 132/84 mmHg)',
        ok: paOk,
        detail: `${fmt(r.pas)}/${fmt(r.pad)} mmHg`,
      });
      criteres.push({
        label: 'Trithérapie synergique (IEC/ARA II + Diurétique + ICA)',
        ok: triOk,
        detail: onePill
          ? 'Tensoplus® en 1 comprimé'
          : triOk
            ? '3 classes actives'
            : 'Escalader vers la trithérapie (ex. Tensoplus®)',
      });
      criteres.push({
        label: 'Tolérance K⁺ et DFG sous contrôle',
        ok: !fatalTrap && r.bio.potassium >= 3.5 && r.bio.potassium <= 5.2,
        detail: `K⁺ ${r.bio.potassium.toFixed(1)} mmol/L · DFG ${r.bio.dfg} mL/min`,
      });
      break;
    }

    case 'ic-vg-faible': {
      const pogOk = r.pog < 16;
      const hasRaaOrArni = t.arni || t.iec || t.ara2;
      const hasBb = t.betabloquant;
      const hasDecong = t.diuretique || t.isglt2;
      const quadriCount =
        (hasRaaOrArni ? 1 : 0) + (hasBb ? 1 : 0) + (t.isglt2 ? 1 : 0) + (t.diuretique ? 1 : 0);
      criteres.push({
        label: 'Décongestion pulmonaire (POG < 16 mmHg)',
        ok: pogOk,
        detail: `POG ${fmt(r.pog)} mmHg`,
      });
      criteres.push({
        label: 'Socle neuro-hormonal (ARNI/IEC + Bêtabloquant)',
        ok: hasRaaOrArni && hasBb,
        detail: `${t.arni ? 'ARNI' : t.iec ? 'IEC' : t.ara2 ? 'ARA II' : 'Aucun RAA'} · ${
          hasBb ? 'Bêtabloquant' : 'Sans bêtabloquant'
        }`,
      });
      criteres.push({
        label: 'Protection cardio-rénale (iSGLT2 + Diurétique adapté)',
        ok: quadriCount >= 3 && hasDecong,
        detail: `${quadriCount}/4 piliers actifs`,
      });
      criteres.push({
        label: 'Sécurité (pas d’ARNI + IEC, PA ≥ 90 mmHg)',
        ok: !fatalTrap && r.pas >= 90,
        detail: r.pas < 90 ? `Hypotension (PAS ${fmt(r.pas)} mmHg)` : `PAS ${fmt(r.pas)} · K⁺ ${r.bio.potassium.toFixed(1)}`,
      });
      break;
    }

    case 'ra-serre': {
      const noDangerousVaso = !(t.ica || t.iec || t.ara2 || t.arni || asso);
      const paStable = r.pas >= 102 && r.dc >= 3.5;
      const valveIdentified = auscultGuess === 'aortique';
      if (!noDangerousVaso) {
        fatalTrap = true;
        trapReasons.push('Vasodilatateur artériel sur RA serré : risque de chute de pression et syncope.');
      }
      criteres.push({
        label: 'Valve identifiée à l’auscultation (Aortique)',
        ok: valveIdentified,
        detail: valveIdentified ? 'Valve aortique identifiée' : 'Utiliser le Défi auscultation (ou écouter B1–B2)',
      });
      criteres.push({
        label: 'Éviter les vasodilatateurs agressifs / associations HTA',
        ok: noDangerousVaso,
        detail: noDangerousVaso ? 'Aucun vasodilatateur dangereux' : 'Vasodilatateur actif sur obstacle fixe !',
      });
      criteres.push({
        label: 'Pression de perfusion préservée (PAS ≥ 102 mmHg)',
        ok: paStable,
        detail: `PAS ${fmt(r.pas)} mmHg · ΔP ${fmt(r.grad)} mmHg`,
      });
      break;
    }

    case 'fa-rapide': {
      const rateOk = r.fcEff <= 94;
      const anticoagOk = t.anticoagulant;
      if (t.anticoagulant && t.antiagregant) {
        trapReasons.push('Éviter d’associer anticoagulant + aspirine sans indication coronaire récente (surrisque hémorragique).');
      }
      criteres.push({
        label: 'Contrôle de la fréquence (FC ≤ 94/min)',
        ok: rateOk,
        detail: `FC ${fmt(r.fcEff)} /min`,
      });
      criteres.push({
        label: 'Prévention de l’AVC par anticoagulant oral (AOD/AVK)',
        ok: anticoagOk,
        detail: anticoagOk
          ? 'Risque d’AVC réduit d’≈ 64 %'
          : t.antiagregant
            ? 'Aspirine insuffisante en FA (−22 % seulement)'
            : 'Aucun anticoagulant actif !',
      });
      criteres.push({
        label: 'Absence de surrisque hémorragique (pas d’association AOD + aspirine)',
        ok: !(t.anticoagulant && t.antiagregant) && !fatalTrap,
        detail: t.anticoagulant && t.antiagregant ? 'Double risque de saignement' : 'Tolérance correcte',
      });
      break;
    }

    case 'idm-plaque': {
      const ldlOk = r.ldl <= 0.95;
      const aapOk = t.antiagregant;
      const protectVgOk = (t.iec || t.ara2 || t.arni) && t.betabloquant;
      criteres.push({
        label: 'Statine forte (LDL ≤ 0,95 g/L)',
        ok: ldlOk,
        detail: `LDL ${fmt(r.ldl, 2)} g/L`,
      });
      criteres.push({
        label: 'Antiagrégant plaquettaire (aspirine)',
        ok: aapOk,
        detail: aapOk ? 'Plaque protégée contre la thrombose' : 'Antiagrégant manquant',
      });
      criteres.push({
        label: 'Protection anti-remodelage (IEC + Bêtabloquant)',
        ok: protectVgOk,
        detail: protectVgOk ? 'Postcharge et FC maîtrisées' : 'Associer IEC et bêtabloquant',
      });
      criteres.push({
        label: 'Sécurité biologique & absence de saignement double',
        ok: !fatalTrap && !(t.anticoagulant && t.antiagregant),
        detail: `K⁺ ${r.bio.potassium.toFixed(1)} · DFG ${r.bio.dfg}`,
      });
      break;
    }

    case 'vd-htap': {
      const pvcOk = r.pvc <= 10.5;
      const perfOk = r.pas >= 96 && r.dc >= 3.4;
      const deconOk = t.diuretique || t.isglt2;
      criteres.push({
        label: 'Congestion veineuse soulagée (PVC ≤ 10,5 mmHg)',
        ok: pvcOk,
        detail: `PVC ${fmt(r.pvc)} mmHg`,
      });
      criteres.push({
        label: 'Débit gauche et PA préservés (PAS ≥ 96, DC ≥ 3,4)',
        ok: perfOk,
        detail: `PAS ${fmt(r.pas)} mmHg · DC ${fmt(r.dc, 1)} L/min`,
      });
      criteres.push({
        label: 'Décharge volémique adaptée sans excès vasodilatateur',
        ok: deconOk && !fatalTrap,
        detail: deconOk ? 'Décongestion active' : 'Utiliser un diurétique (ou iSGLT2) avec prudence',
      });
      break;
    }
  }

  const passed = criteres.filter((c) => c.ok).length;
  const total = Math.max(1, criteres.length);
  const rawScore = Math.round((passed / total) * 100);
  const score = fatalTrap ? Math.min(40, rawScore) : rawScore;

  let verdict: 'succes' | 'partiel' | 'echec';
  if (!fatalTrap && passed === total) {
    verdict = 'succes';
  } else if (!fatalTrap && passed >= Math.ceil(total / 2)) {
    verdict = 'partiel';
  } else {
    verdict = 'echec';
  }

  const titreVerdict =
    verdict === 'succes'
      ? 'Succès thérapeutique'
      : verdict === 'partiel'
        ? 'Contrôle partiel — traitement à affiner'
        : 'Échec ou danger iatrogène';

  let explicationGlobale = '';
  if (verdict === 'succes') {
    explicationGlobale = `Conduite optimale : toutes les cibles sont atteintes (PA ${fmt(r.pas)}/${fmt(r.pad)} mmHg, FC ${fmt(r.fcEff)}/min, FE ${fmt(r.fe * 100)} %, K⁺ ${r.bio.potassium.toFixed(1)} mmol/L). Explorez maintenant la timeline ci-dessous jusqu’à 5 ans pour observer les complications évitées.`;
  } else if (trapReasons.length > 0) {
    explicationGlobale = `${trapReasons.join(' ')} Ce choix expose le patient à une complication aiguë malgré l’intention thérapeutique.`;
  } else {
    const failedLabels = criteres.filter((c) => !c.ok).map((c) => c.label).join(' · ');
    explicationGlobale = `Des objectifs clés restent hors cible (${failedLabels}). Ajustez les molécules ou dosages dans le panneau de droite puis revalidez.`;
  }

  const pisteCorrection =
    verdict === 'succes'
      ? null
      : trapReasons.length > 0
        ? trapReasons[0]
        : cdef.indices[0] || null;

  return {
    verdict,
    titreVerdict,
    score,
    criteres,
    explicationGlobale,
    pisteCorrection,
  };
}

export function projectTimelineState(
  currentParams: SimParams,
  baseHvg: number,
  cdef: ClinicalCaseDef | null,
  step: TimelineHorizon,
  branch: TimelineBranch
): TimelineProjection {
  const zeroTrt = Object.fromEntries(TRT_IDS.map((k) => [k, false])) as Record<TraitementId, boolean>;

  // En Exploration libre, la trajectoire "Sans traitement" démarre d'un sujet sain (tout normal à T0)
  // afin de visualiser sans chevauchement l'apparition -> l'évolution -> la complication extrême.
  if (!cdef && branch === 'untreated' && step === 0) {
    const clean = freshP();
    clean.site = currentParams.site;
    const rClean = compute(clean, { hvg: 0 });
    return {
      params: clean,
      d: { hvg: 0 },
      titre: 'État normal de départ (aucune pathologie active)',
      resume: 'Cœur, artères, reins et cerveau fonctionnent à l’équilibre avant le début du scénario.',
      severite: 'ok',
      consequences: [
        `Hémodynamique normale · PA ${fmt(rClean.pas)}/${fmt(rClean.pad)} mmHg · FE ${fmt(rClean.fe * 100)} %`,
      ],
    };
  }

  const baseSim: SimParams =
    branch === 'untreated'
      ? cdef
        ? applyPresetToParams(cdef.preset).params
        : { ...currentParams, trt: zeroTrt, asso: null }
      : { ...currentParams };

  if (branch === 'untreated') {
    baseSim.trt = { ...zeroTrt };
    baseSim.asso = null;
  }

  const { t } = activeTrt(baseSim);
  const p: SimParams = {
    ...baseSim,
    mal: { ...baseSim.mal },
    trt: { ...baseSim.trt },
    act: { ...baseSim.act },
    dose: { ...baseSim.dose },
    pres: { ...baseSim.pres },
    ruptureTriggered: { ...baseSim.ruptureTriggered },
  };
  let hvg = baseHvg;

  if (step > 0) {
    const k = step === 1 ? 1 : step === 2 ? 1.8 : step === 3 ? 2.5 : 3.2;
    const rNow = compute(p, { hvg });
    const hasRaa = rNow.raa > 0;
    const htaUncontrolled = (p.mal.hta || rNow.pas > 142) && rNow.pas > 136;

    if (htaUncontrolled) {
      hvg = clamp(
        hvg + (step === 1 ? 0.18 : step === 2 ? 0.36 : step === 3 ? 0.58 : 0.78),
        0,
        1
      );
      p.rigidite = clamp(p.rigidite + 0.08 * k, 0, 1);
      if (step >= 2) p.resist = +(p.resist * (1 + 0.06 * (step - 1))).toFixed(2);
      if (step >= 3 && !t.statine && p.plaque < 4) p.plaque = step === 3 ? 4 : 5;
      if (step === 4) {
        p.contract = +(p.contract * 0.94).toFixed(2);
        p.mal.avc = true;
      }
    } else if (hasRaa && rNow.pas <= 135) {
      hvg = clamp(hvg * (step === 1 ? 0.92 : step === 2 ? 0.72 : step === 3 ? 0.5 : 0.35), 0, 1);
    }

    if (p.mal.ic || p.act.vg === 'faible') {
      const wellTreatedIC = hasRaa && t.betabloquant && (t.isglt2 || t.diuretique);
      if (wellTreatedIC && branch === 'treated') {
        if (step >= 2) {
          p.contract = +(p.contract * (step === 2 ? 1.08 : step === 3 ? 1.16 : 1.24)).toFixed(2);
          p.volume = clamp(p.volume - (step === 2 ? 0.25 : step === 3 ? 0.42 : 0.55), 4.6, 6.5);
        }
      } else {
        p.volume = clamp(p.volume + 0.22 * k, 4.5, 6.5);
        p.contract = +(p.contract * (1 - 0.07 * k)).toFixed(2);
      }
    }

    if (p.mal.ra || p.act.aortique === 'stenose') {
      if (branch === 'untreated' || t.ica || rNow.raa > 0) {
        hvg = clamp(hvg + 0.13 * k, 0, 1);
        if (step >= 3) p.contract = +(p.contract * (step === 4 ? 0.78 : 0.88)).toFixed(2);
      } else if (step >= 3 && branch === 'treated') {
        if (step === 4) {
          p.mal.ra = false;
          p.act.aortique = null;
          hvg = clamp(hvg * 0.45, 0, 1);
        } else {
          hvg = clamp(hvg * 0.85, 0, 1);
        }
      }
    }

    if (p.mal.dyslipidemie || p.plaque > 0) {
      if (t.statine && branch === 'treated') {
        if (step === 1 && t.antiagregant && p.plaque >= 5) p.plaque = 4;
        else if (step >= 2 && p.plaque > 2) {
          p.plaque = Math.max(2, p.plaque - (step >= 4 ? 3 : step === 3 ? 2 : 1));
        }
      } else if (!t.statine) {
        if (p.plaque === 0 && p.mal.dyslipidemie) {
          p.plaque = step === 1 ? 2 : step === 2 ? 4 : 6;
        } else {
          p.plaque = clamp(p.plaque + (step === 1 ? 1 : step === 2 ? 2 : 3), 0, 6);
        }
        if (p.plaque === 6 && step === 4) {
          if (p.site === 'carotide') p.mal.avc = true;
          else p.mal.idm = true;
        }
      }
    }

    if (p.mal.fa && !t.anticoagulant && step === 4) {
      p.mal.avc = true;
    }
  }

  const rProj = compute(p, { hvg });
  const consequences: string[] = [];
  if (rProj.pog >= 22) consequences.push('Œdème aigu du poumon (POG ≥ 22 mmHg)');
  else if (rProj.congestion > 0.25) consequences.push(`Congestion pulmonaire (POG ${fmt(rProj.pog)} mmHg)`);
  if (rProj.oedeme > 0.45) consequences.push('Œdèmes des membres inférieurs marqués');
  if (p.mal.avc) consequences.push('Atteinte cérébrale · AVC ischémique');
  if (p.mal.idm) consequences.push('Nécrose myocardique (IDM)');
  if (hvg >= 0.55) consequences.push('Cœur · Hypertrophie du VG (HVG)');
  if (rProj.rein > 0.25 || rProj.bio.dfg < 65) {
    consequences.push(`Rein · hyperpression / DFG ${rProj.bio.dfg} mL/min`);
  }
  if (consequences.length === 0) {
    consequences.push(
      `Équilibre maintenu · PA ${fmt(rProj.pas)}/${fmt(rProj.pad)} mmHg · FE ${fmt(rProj.fe * 100)} %`
    );
  }

  const hasAnyTrt = TRT_IDS.some((k) => t[k]);
  const hasProtectivePlan = hasAnyTrt || cdef?.id === 'ra-serre';
  const hIdx: 0 | 1 | 2 | 3 = step === 0 ? 0 : step === 1 ? 1 : step <= 3 ? 2 : 3;
  const hMeta = cdef?.horaires[hIdx];
  const titre = hMeta
    ? branch === 'untreated' || !hasProtectivePlan
      ? hMeta.untreatedTitle
      : rProj.warns.length > 0
        ? 'Alerte thérapeutique / iatrogénie'
        : hMeta.treatedTitle
    : `${TIMELINE_LABELS[step].full}`;
  const resume = hMeta
    ? branch === 'untreated' || !hasProtectivePlan
      ? hMeta.untreatedText
      : rProj.warns.length > 0
        ? rProj.warns[0]
        : hMeta.treatedText
    : consequences[0];

  const hasCrit =
    p.mal.avc ||
    p.mal.idm ||
    p.plaque >= 6 ||
    (p.mal.fa && !t.anticoagulant && step >= 3) ||
    rProj.pog >= 21 ||
    rProj.fe < 0.35 ||
    rProj.pas > 152 ||
    rProj.pas < 90 ||
    rProj.warns.length > 0 ||
    rProj.bio.potassium > 5.4;
  const hasWarn =
    rProj.congestion > 0.25 ||
    rProj.oedeme > 0.45 ||
    rProj.pas > 138 ||
    hvg >= 0.45 ||
    rProj.rein > 0.22 ||
    rProj.bio.dfg < 65 ||
    p.plaque >= 3 ||
    rProj.fe < 0.5 ||
    rProj.ldl > 1.3 ||
    rProj.fcEff > 105 ||
    (p.mal.fa && !t.anticoagulant) ||
    p.mal.ra ||
    rProj.pvc > 10.5;

  return {
    params: p,
    d: { hvg },
    titre,
    resume,
    severite: hasCrit ? 'crit' : hasWarn ? 'warn' : 'ok',
    consequences,
  };
}
