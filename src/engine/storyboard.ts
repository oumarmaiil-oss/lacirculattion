import type { ClinicalCaseDef, TimelineProjection } from './clinicalCases';
import { clamp } from './geometry2d';
import { activeTrt } from './physiology';
import type {
  DynamicState,
  FocusZoneId,
  SimParams,
  TabId,
  TimelineBranch,
  TimelineHorizon,
  VisualStoryOverlay,
} from './types';

export interface StoryboardMoment {
  step: TimelineHorizon;
  label: string;
  title: string;
  whatHappens: string;
  focusTab: TabId;
  focusZone: FocusZoneId;
  focusLabel: string;
  embolDetached: boolean;
  clotProgress: number;
  treatmentHeal: number;
}

function detectFreePathologyTheme(p: SimParams): 'dyslipidemie' | 'idm' | 'fa' | 'hta' | 'ic' | 'ra' | 'vd' | 'general' {
  if (p.mal.dyslipidemie || p.plaque > 0) return 'dyslipidemie';
  if (p.mal.idm) return 'idm';
  if (p.mal.fa) return 'fa';
  if (p.mal.ra || p.act.aortique === 'stenose') return 'ra';
  if (p.mal.ic || p.act.vg === 'faible') return 'ic';
  if (p.act.vd === 'faible') return 'vd';
  if (p.mal.hta) return 'hta';
  return 'general';
}

export function getStoryboardMoment(
  appMode: 'cas' | 'libre',
  activeCase: ClinicalCaseDef | null,
  params: SimParams,
  branch: TimelineBranch,
  step: TimelineHorizon
): StoryboardMoment {
  const { t, asso } = activeTrt(params);
  const hasAnyTrt = Boolean(asso) || Object.values(t).some(Boolean);
  const effectiveUntreated = branch === 'untreated' || (!hasAnyTrt && activeCase?.id !== 'ra-serre');
  const isFreeHealthyStart = appMode === 'libre' && branch === 'untreated';

  const theme =
    appMode === 'cas' && activeCase
      ? activeCase.id === 'idm-plaque'
        ? 'dyslipidemie'
        : activeCase.id === 'fa-rapide'
          ? 'fa'
          : activeCase.id === 'ic-vg-faible'
            ? 'ic'
            : activeCase.id === 'ra-serre'
              ? 'ra'
              : activeCase.id === 'vd-htap'
                ? 'vd'
                : 'hta'
      : detectFreePathologyTheme(params);

  const siteTargetLabel =
    params.site === 'carotide'
      ? 'l’artère cérébrale (AVC)'
      : params.site === 'jambe'
        ? 'l’artère de la jambe'
        : 'la coronaire (infarctus)';

  const siteFocusZone: FocusZoneId = params.site === 'carotide' ? 'cerveau' : 'embole';

  if (theme === 'idm') {
    if (effectiveUntreated) {
      const seq: StoryboardMoment[] = [
        isFreeHealthyStart
          ? {
              step: 0,
              label: '0 · Coronaire saine',
              title: 'État normal de départ',
              whatHappens: 'Artère coronaire perméable, paroi antérieure du VG bien irriguée et contractile.',
              focusTab: 'coeur',
              focusZone: 'vg',
              focusLabel: 'Myocarde antérieur normal',
              embolDetached: false,
              clotProgress: 0,
              treatmentHeal: 0,
            }
          : {
              step: 0,
              label: '0 · Occlusion IVA',
              title: 'Caillot dans l’artère coronaire',
              whatHappens: 'Un thrombus bouche l’IVA : le territoire antérieur manque brutalement d’oxygène.',
              focusTab: 'coeur',
              focusZone: 'vg',
              focusLabel: 'Zone antérieure ischémique',
              embolDetached: false,
              clotProgress: 0.75,
              treatmentHeal: 0,
            },
        {
          step: 1,
          label: '1 · Rupture & caillot',
          title: 'Formation du thrombus sur l’IVA',
          whatHappens: 'Les plaquettes bouchent la coronaire : sus-décalage ST visible sur le tracé ECG.',
          focusTab: 'coeur',
          focusZone: 'vg',
          focusLabel: 'Occlusion IVA · sus-décalage ST',
          embolDetached: false,
          clotProgress: 0.9,
          treatmentHeal: 0,
        },
        {
          step: 2,
          label: '2 · Zone immobile',
          title: 'Ischémie puis nécrose antérieure',
          whatHappens: 'La paroi grise ne se contracte plus : la fraction d’éjection et le débit chutent.',
          focusTab: 'coeur',
          focusZone: 'vg',
          focusLabel: 'Paroi antérieure akinétique',
          embolDetached: false,
          clotProgress: 0.95,
          treatmentHeal: 0,
        },
        {
          step: 3,
          label: '3 · Remodelage dilatatif',
          title: 'Dilatation du ventricule gauche',
          whatHappens: 'Sans traitement, la cicatrice s’étire et la pression pulmonaire monte.',
          focusTab: 'coeur',
          focusZone: 'vg',
          focusLabel: 'Dilatation post-infarctus',
          embolDetached: false,
          clotProgress: 1,
          treatmentHeal: 0,
        },
        {
          step: 4,
          label: '4 · Insuffisance cardiaque',
          title: 'Complication extrême : récidive & congestion pulmonaire',
          whatHappens: 'Le VG affaibli n’assure plus le débit, provoquant congestion pulmonaire ou nouvelle occlusion.',
          focusTab: 'corps',
          focusZone: 'poumons',
          focusLabel: 'Poumons congestionnés post-IDM',
          embolDetached: false,
          clotProgress: 1,
          treatmentHeal: 0,
        },
      ];
      return seq[step];
    }

    const seqTreated: StoryboardMoment[] = [
      {
        step: 0,
        label: '0 · IDM aigu',
        title: 'Territoire coronaire à protéger',
        whatHappens: 'Après désobstruction d’urgence, la quadrithérapie protège le myocarde restant.',
        focusTab: 'coeur',
        focusZone: 'vg',
        focusLabel: 'Territoire IVA ciblé',
        embolDetached: false,
        clotProgress: 0.65,
        treatmentHeal: 0.1,
      },
      {
        step: 1,
        label: '1 · Antiagrégant + Statine',
        title: 'Blocage plaquettaire & chute du LDL',
        whatHappens: 'L’aspirine empêche la ré-occlusion immédiate ; la statine forte stabilise la plaque.',
        focusTab: 'vaisseau',
        focusZone: 'plaque',
        focusLabel: 'Plaque coronaire stabilisée',
        embolDetached: false,
        clotProgress: 0.25,
        treatmentHeal: 0.38,
      },
      {
        step: 2,
        label: '2 · IEC + Bêtabloquant',
        title: 'Épargne en O₂ & anti-remodelage',
        whatHappens: 'Le cœur ralentit (demande en O₂ ↓) et l’IEC abaisse la contrainte sur la paroi.',
        focusTab: 'coeur',
        focusZone: 'vg',
        focusLabel: 'VG soulagé',
        embolDetached: false,
        clotProgress: 0.08,
        treatmentHeal: 0.68,
      },
      {
        step: 3,
        label: '3 · Cicatrisation contrôlée',
        title: 'Pas de dilatation ventriculaire',
        whatHappens: 'La fraction d’éjection se stabilise et les poumons restent libres de congestion.',
        focusTab: 'coeur',
        focusZone: 'vg',
        focusLabel: 'Remodelage évité',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0.9,
      },
      {
        step: 4,
        label: '4 · Maintien protecteur',
        title: 'Cœur stabilisé · Récidive évitée',
        whatHappens: 'La quadrithérapie poursuivie maintient une perfusion coronaire stable sans nouvelle rupture.',
        focusTab: 'corps',
        focusZone: 'coronaire',
        focusLabel: 'Myocarde protégé durablement',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 1,
      },
    ];
    return seqTreated[step];
  }

  if (theme === 'dyslipidemie') {
    if (effectiveUntreated) {
      const seq: StoryboardMoment[] = [
        isFreeHealthyStart
          ? {
              step: 0,
              label: '0 · Artère saine',
              title: 'État normal de départ',
              whatHappens:
                'Endothélium intact, flux libre et taux de LDL normal avant toute surcharge lipidique.',
              focusTab: 'vaisseau',
              focusZone: 'plaque',
              focusLabel: 'Paroi artérielle normale',
              embolDetached: false,
              clotProgress: 0,
              treatmentHeal: 0,
            }
          : {
              step: 0,
              label: '1 · Excès de LDL',
              title: 'Infiltration lipidique dans la paroi',
              whatHappens:
                'Le LDL-cholestérol en excès pénètre sous l’endothélium et lance une plaque athéromateuse.',
              focusTab: 'vaisseau',
              focusZone: 'plaque',
              focusLabel: 'Dépôt initial de LDL',
              embolDetached: false,
              clotProgress: 0.1,
              treatmentHeal: 0,
            },
        {
          step: 1,
          label: '1 · Dépôt de LDL',
          title: 'Infiltration sous-endothéliale',
          whatHappens:
            'Les particules LDL s’accumulent dans l’intima et déclenchent une inflammation locale.',
          focusTab: 'vaisseau',
          focusZone: 'plaque',
          focusLabel: 'Strie lipidique & LDL oxydé',
          embolDetached: false,
          clotProgress: 0.2,
          treatmentHeal: 0,
        },
        {
          step: 2,
          label: '2 · Plaque vulnérable',
          title: 'Amincissement de la chape fibreuse',
          whatHappens:
            'Les macrophages s’accumulent, la lumière rétrécit et la chape fibreuse devient fine et fragile.',
          focusTab: 'vaisseau',
          focusZone: 'plaque',
          focusLabel: 'Chape fibreuse fragile',
          embolDetached: false,
          clotProgress: 0.45,
          treatmentHeal: 0,
        },
        {
          step: 3,
          label: '3 · Rupture & caillot',
          title: 'Thrombus obstructif sur plaque fissurée',
          whatHappens:
            'La plaque se fissure : les plaquettes s’agrègent brutalement et forment un caillot qui bloque le flux.',
          focusTab: 'vaisseau',
          focusZone: 'plaque',
          focusLabel: 'Thrombus obstructif',
          embolDetached: false,
          clotProgress: 0.94,
          treatmentHeal: 0,
        },
        {
          step: 4,
          label: '4 · Détachement & embolie',
          title: `Migration du caillot vers ${siteTargetLabel}`,
          whatHappens:
            `Complication extrême : un fragment du caillot se détache, part dans le flux et bouche ${siteTargetLabel}.`,
          focusTab: 'corps',
          focusZone: siteFocusZone,
          focusLabel: 'Embole migrant vers l’organe cible',
          embolDetached: true,
          clotProgress: 1,
          treatmentHeal: 0,
        },
      ];
      return seq[step];
    }

    const hasStatin = t.statine;
    const hasAap = t.antiagregant;
    const seqTreated: StoryboardMoment[] = [
      {
        step: 0,
        label: '0 · Avant traitement',
        title: 'Plaque active à stabiliser',
        whatHappens: 'La paroi présente une plaque instable exposée au risque de thrombose.',
        focusTab: 'vaisseau',
        focusZone: 'plaque',
        focusLabel: 'Lésion initiale ciblée',
        embolDetached: false,
        clotProgress: hasAap ? 0.55 : 0.78,
        treatmentHeal: 0.08,
      },
      {
        step: 1,
        label: '1 · Mise sous traitement',
        title: hasStatin ? 'Statine démarrée : frein du LDL' : 'Prise en charge amorcée',
        whatHappens: hasStatin
          ? 'La statine bloque la synthèse hépatique du cholestérol ; le LDL circulant commence à chuter.'
          : 'Ajoutez une statine (et un antiagrégant) pour réduire et stabiliser directement la plaque.',
        focusTab: 'vaisseau',
        focusZone: 'plaque',
        focusLabel: 'Chute du LDL sanguin',
        embolDetached: false,
        clotProgress: hasAap ? 0.35 : 0.6,
        treatmentHeal: hasStatin ? 0.32 : 0.14,
      },
      {
        step: 2,
        label: '2 · Lyse du caillot',
        title: hasAap ? 'Réduction nette du caillot & inflammation' : 'Apaisement de l’endothélium',
        whatHappens:
          'Les plaquettes n’adhèrent plus sur la lésion, le thrombus régresse et le NO protecteur remonte.',
        focusTab: 'vaisseau',
        focusZone: 'plaque',
        focusLabel: 'Caillot en régression',
        embolDetached: false,
        clotProgress: hasAap ? 0.12 : 0.3,
        treatmentHeal: hasStatin ? 0.65 : 0.32,
      },
      {
        step: 3,
        label: '3 · Chape consolidée',
        title: 'Épaississement fibreux protecteur',
        whatHappens:
          'La chape fibreuse verte s’épaissit : la plaque est scellée et ne peut plus libérer de caillot.',
        focusTab: 'vaisseau',
        focusZone: 'plaque',
        focusLabel: 'Chape fibreuse consolidée',
        embolDetached: false,
        clotProgress: 0.02,
        treatmentHeal: hasStatin ? 0.9 : 0.45,
      },
      {
        step: 4,
        label: '4 · Artère sécurisée',
        title: 'Flux rétabli · Maintien protecteur durable',
        whatHappens:
          'La plaque est cicatrisée et stabilisée à un niveau sûr : cœur et cerveau restent protégés tant que le traitement est suivi.',
        focusTab: 'corps',
        focusZone: 'coronaire',
        focusLabel: 'Organes cibles protégés',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: hasStatin ? 1 : 0.55,
      },
    ];
    return seqTreated[step];
  }

  if (theme === 'fa') {
    if (effectiveUntreated) {
      const seq: StoryboardMoment[] = [
        isFreeHealthyStart
          ? {
              step: 0,
              label: '0 · Rythme sinusal',
              title: 'État normal de départ',
              whatHappens: 'Oreillettes synchronisées, flux fluide sans stase ni caillot.',
              focusTab: 'coeur',
              focusZone: 'og',
              focusLabel: 'Oreillette gauche normale',
              embolDetached: false,
              clotProgress: 0,
              treatmentHeal: 0,
            }
          : {
              step: 0,
              label: '0 · Chaos auriculaire',
              title: 'Oreillette gauche désynchronisée',
              whatHappens: 'Les oreillettes fibrillent : le sang stagne dans l’auricule gauche.',
              focusTab: 'coeur',
              focusZone: 'og',
              focusLabel: 'Stase dans l’oreillette gauche',
              embolDetached: false,
              clotProgress: 0.15,
              treatmentHeal: 0,
            },
        {
          step: 1,
          label: '1 · Stase & tachycardie',
          title: 'Tourbillon sanguin dans l’oreillette',
          whatHappens: 'La fibrillation auriculaire accélère les ventricules et ralentit la vidange de l’oreillette gauche.',
          focusTab: 'coeur',
          focusZone: 'og',
          focusLabel: 'Stase auriculaire gauche',
          embolDetached: false,
          clotProgress: 0.35,
          treatmentHeal: 0,
        },
        {
          step: 2,
          label: '2 · Naissance du caillot',
          title: 'Formation d’un thrombus auriculaire',
          whatHappens: 'La stase active la coagulation : un caillot se forme contre la paroi de l’oreillette gauche.',
          focusTab: 'coeur',
          focusZone: 'og',
          focusLabel: 'Thrombus en formation (OG)',
          embolDetached: false,
          clotProgress: 0.8,
          treatmentHeal: 0,
        },
        {
          step: 3,
          label: '3 · Départ vers l’aorte',
          title: 'Détachement du caillot vers la carotide',
          whatHappens: 'Le thrombus quitte l’oreillette, traverse le ventricule gauche et monte vers les carotides.',
          focusTab: 'corps',
          focusZone: 'embole',
          focusLabel: 'Embole quittant le cœur',
          embolDetached: true,
          clotProgress: 1,
          treatmentHeal: 0,
        },
        {
          step: 4,
          label: '4 · Complication extrême (AVC)',
          title: 'Occlusion d’une artère cérébrale',
          whatHappens: 'Le caillot bouche une artère du cerveau : le territoire en aval souffre d’un AVC ischémique.',
          focusTab: 'corps',
          focusZone: 'cerveau',
          focusLabel: 'Zone cérébrale ischémique',
          embolDetached: true,
          clotProgress: 1,
          treatmentHeal: 0,
        },
      ];
      return seq[step];
    }

    const seqTreated: StoryboardMoment[] = [
      {
        step: 0,
        label: '0 · FA active',
        title: 'Rythme irrégulier à maîtriser',
        whatHappens: 'Sans frein ni fluidifiant, l’oreillette gauche reste exposée à la formation de thrombus.',
        focusTab: 'coeur',
        focusZone: 'og',
        focusLabel: 'Oreillette gauche à protéger',
        embolDetached: false,
        clotProgress: 0.55,
        treatmentHeal: 0.1,
      },
      {
        step: 1,
        label: '1 · Frein & fluidification',
        title: 'Anticoagulant actif + nœud AV apaisé',
        whatHappens: 'Le bêtabloquant calme la cadence ventriculaire et l’AOD bloque les facteurs de coagulation.',
        focusTab: 'coeur',
        focusZone: 'og',
        focusLabel: 'Action anticoagulante (OG)',
        embolDetached: false,
        clotProgress: 0.3,
        treatmentHeal: 0.35,
      },
      {
        step: 2,
        label: '2 · Dissolution du caillot',
        title: 'Le thrombus auriculaire se résorbe',
        whatHappens: 'Sans nouvelle fibrine, la fibrinolyse naturelle dissout le caillot naissant dans l’oreillette.',
        focusTab: 'coeur',
        focusZone: 'og',
        focusLabel: 'Résorption du thrombus',
        embolDetached: false,
        clotProgress: 0.08,
        treatmentHeal: 0.68,
      },
      {
        step: 3,
        label: '3 · Prévention embolique',
        title: 'Aucun départ de caillot vers la carotide',
        whatHappens: 'Le flux sortant vers l’aorte et les carotides reste propre, le risque d’AVC chute d’≈ 64 %.',
        focusTab: 'corps',
        focusZone: 'cerveau',
        focusLabel: 'Carotide & cerveau libres',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0.9,
      },
      {
        step: 4,
        label: '4 · Maintien protecteur',
        title: 'Cerveau et pompe cardiaque préservés',
        whatHappens: 'La fréquence maîtrisée et l’anticoagulation poursuivie maintiennent un état sûr sans AVC.',
        focusTab: 'corps',
        focusZone: 'cerveau',
        focusLabel: 'Protection cérébrale maintenue',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 1,
      },
    ];
    return seqTreated[step];
  }

  if (theme === 'ic') {
    if (effectiveUntreated) {
      const seq: StoryboardMoment[] = [
        isFreeHealthyStart
          ? {
              step: 0,
              label: '0 · Pompe normale',
              title: 'État normal de départ',
              whatHappens: 'Ventricule gauche tonique (FE 60 %) et poumons libres avant toute surcharge.',
              focusTab: 'coeur',
              focusZone: 'vg',
              focusLabel: 'Ventricule gauche normal',
              embolDetached: false,
              clotProgress: 0,
              treatmentHeal: 0,
            }
          : {
              step: 0,
              label: '0 · VG affaibli',
              title: 'Baisse de contractilité initiale',
              whatHappens: 'Le muscle gauche pousse faiblement : du sang stagne en fin de systole.',
              focusTab: 'coeur',
              focusZone: 'vg',
              focusLabel: 'Ventricule gauche affaibli',
              embolDetached: false,
              clotProgress: 0,
              treatmentHeal: 0,
            },
        {
          step: 1,
          label: '1 · Stase ventriculaire',
          title: 'Montée des pressions de remplissage',
          whatHappens: 'La pression télédiastolique augmente dans le ventricule gauche et freine le retour pulmonaire.',
          focusTab: 'coeur',
          focusZone: 'vg',
          focusLabel: 'Surcharge du VG',
          embolDetached: false,
          clotProgress: 0,
          treatmentHeal: 0,
        },
        {
          step: 2,
          label: '2 · Reflux pulmonaire',
          title: 'Congestion des poumons',
          whatHappens: 'La pression remonte dans l’oreillette gauche et engorge les capillaires pulmonaires (POG ↑).',
          focusTab: 'corps',
          focusZone: 'poumons',
          focusLabel: 'Congestion veineuse pulmonaire',
          embolDetached: false,
          clotProgress: 0,
          treatmentHeal: 0,
        },
        {
          step: 3,
          label: '3 · Dilatation critique',
          title: 'Épuisement adrénergique & souffrance rénale',
          whatHappens: 'Le VG s’étire, le débit baisse et la perfusion rénale diminue.',
          focusTab: 'coeur',
          focusZone: 'vg',
          focusLabel: 'Remodelage dilatatif',
          embolDetached: false,
          clotProgress: 0,
          treatmentHeal: 0,
        },
        {
          step: 4,
          label: '4 · Complication extrême (OAP)',
          title: 'Œdème aigu du poumon & bas débit',
          whatHappens: 'Le liquide inonde les alvéoles (POG ≥ 22) et les reins souffrent du bas débit chronique.',
          focusTab: 'corps',
          focusZone: 'poumons',
          focusLabel: 'Poumons inondés (OAP)',
          embolDetached: false,
          clotProgress: 0,
          treatmentHeal: 0,
        },
      ];
      return seq[step];
    }
    const seqTreated: StoryboardMoment[] = [
      {
        step: 0,
        label: '0 · Avant traitement',
        title: 'Congestion pulmonaire active',
        whatHappens: 'Le VG est dilaté avec une pression pulmonaire élevée.',
        focusTab: 'coeur',
        focusZone: 'vg',
        focusLabel: 'VG surchargé',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0.08,
      },
      {
        step: 1,
        label: '1 · Décharge rapide',
        title: 'Soulagement de la pression pulmonaire',
        whatHappens: 'Diurétique et iSGLT2 réduisent la surcharge ; l’ARNI/IEC ouvre la sortie artérielle.',
        focusTab: 'coeur',
        focusZone: 'vg',
        focusLabel: 'Postcharge abaissée',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0.3,
      },
      {
        step: 2,
        label: '2 · Poumons dégagés',
        title: 'POG sous 15 mmHg',
        whatHappens: 'Les capillaires pulmonaires se désengorgent : la respiration redevient fluide.',
        focusTab: 'corps',
        focusZone: 'poumons',
        focusLabel: 'Poumons décongestionnés',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0.62,
      },
      {
        step: 3,
        label: '3 · Remodelage inverse',
        title: 'Le ventricule retrouve du tonus',
        whatHappens: 'Le bêtabloquant protège le myocarde de l’adrénaline : le volume VG diminue et la FE remonte.',
        focusTab: 'coeur',
        focusZone: 'vg',
        focusLabel: 'Reprise contractile du VG',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0.86,
      },
      {
        step: 4,
        label: '4 · Équilibre maintenu',
        title: 'Pompe cardiaque et rein stabilisés',
        whatHappens: 'La quadrithérapie maintient un débit satisfaisant sans œdème pulmonaire ni réhospitalisation.',
        focusTab: 'corps',
        focusZone: 'poumons',
        focusLabel: 'Équilibre cardio-rénal maintenu',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 1,
      },
    ];
    return seqTreated[step];
  }

  if (theme === 'ra') {
    if (effectiveUntreated) {
      const seq: StoryboardMoment[] = [
        isFreeHealthyStart
          ? {
              step: 0,
              label: '0 · Valve souple',
              title: 'État normal de départ',
              whatHappens: 'La valve aortique s’ouvre largement (3 cm²), sans gradient de pression.',
              focusTab: 'coeur',
              focusZone: 'aortique',
              focusLabel: 'Valve aortique normale',
              embolDetached: false,
              clotProgress: 0,
              treatmentHeal: 0,
            }
          : {
              step: 0,
              label: '0 · Valve calcifiée',
              title: 'Obstacle serré à l’éjection',
              whatHappens: 'La valve aortique ne s’ouvre qu’à 0,75 cm² : le sang accélère en jet turbulent (ΔP élevé).',
              focusTab: 'coeur',
              focusZone: 'aortique',
              focusLabel: 'Valve aortique obstruée',
              embolDetached: false,
              clotProgress: 0,
              treatmentHeal: 0,
            },
        {
          step: 1,
          label: '1 · Rétrécissement',
          title: 'Montée du gradient de pression ΔP',
          whatHappens: 'Le VG force pour franchir l’orifice calcifié : un souffle systolique net apparaît.',
          focusTab: 'coeur',
          focusZone: 'aortique',
          focusLabel: 'Jet turbulent aortique',
          embolDetached: false,
          clotProgress: 0,
          treatmentHeal: 0,
        },
        {
          step: 2,
          label: '2 · Risque syncopal',
          title: 'Chute de perfusion si vasodilatation',
          whatHappens: 'Devant un obstacle mécanique fixe, baisser la résistance périphérique effondre la pression cérébrale.',
          focusTab: 'coeur',
          focusZone: 'aortique',
          focusLabel: 'Gradient critique à l’effort',
          embolDetached: false,
          clotProgress: 0,
          treatmentHeal: 0,
        },
        {
          step: 3,
          label: '3 · HVG concentrique',
          title: 'Épaississement rigide de la paroi VG',
          whatHappens: 'À force de pousser > 180 mmHg, le muscle s’épaissit et souffre d’ischémie à l’effort.',
          focusTab: 'coeur',
          focusZone: 'vg',
          focusLabel: 'Hypertrophie VG serrée',
          embolDetached: false,
          clotProgress: 0,
          treatmentHeal: 0,
        },
        {
          step: 4,
          label: '4 · Défaillance ultime',
          title: 'Épuisement du VG sur obstacle négligé',
          whatHappens: 'Le muscle finit par lâcher : la FE chute et la congestion pulmonaire s’installe.',
          focusTab: 'coeur',
          focusZone: 'vg',
          focusLabel: 'Décompensation tardive',
          embolDetached: false,
          clotProgress: 0,
          treatmentHeal: 0,
        },
      ];
      return seq[step];
    }
    const seqTreated: StoryboardMoment[] = [
      {
        step: 0,
        label: '0 · Diagnostic posé',
        title: 'Obstacle mécanique identifié',
        whatHappens: 'Aucun médicament ne dissout le calcaire valvulaire : l’objectif est de stabiliser sans danger.',
        focusTab: 'coeur',
        focusZone: 'aortique',
        focusLabel: 'Valve identifiée',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0.15,
      },
      {
        step: 1,
        label: '1 · Respect hémodynamique',
        title: 'Pression de perfusion préservée',
        whatHappens: 'En évitant les vasodilatateurs agressifs, la pression aortique perfuse cerveau et coronaires.',
        focusTab: 'coeur',
        focusZone: 'aortique',
        focusLabel: 'PA préservée',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0.38,
      },
      {
        step: 2,
        label: '2 · Bilan pré-intervention',
        title: 'Pas de malaise iatrogène',
        whatHappens: 'Le patient arrive en sécurité vers la réparation mécanique (TAVI ou chirurgie).',
        focusTab: 'coeur',
        focusZone: 'aortique',
        focusLabel: 'Stabilité avant TAVI',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0.6,
      },
      {
        step: 3,
        label: '3 · Remplacement valvulaire',
        title: 'Muscle encore tonique au geste',
        whatHappens: 'La valve est remplacée avant l’épuisement du ventricule gauche.',
        focusTab: 'coeur',
        focusZone: 'aortique',
        focusLabel: 'Ouverture restaurée',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0.85,
      },
      {
        step: 4,
        label: '4 · Guérison mécanique',
        title: 'Obstacle levé & cœur soulagé',
        whatHappens: 'Après remplacement valvulaire, le gradient ΔP disparaît et l’hypertrophie du VG régresse.',
        focusTab: 'coeur',
        focusZone: 'aortique',
        focusLabel: 'Valve fonctionnelle',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 1,
      },
    ];
    return seqTreated[step];
  }

  if (theme === 'vd') {
    const seq: StoryboardMoment[] = effectiveUntreated
      ? [
          isFreeHealthyStart
            ? {
                step: 0,
                label: '0 · Retour normal',
                title: 'État normal de départ',
                whatHappens: 'Le ventricule droit pousse librement vers les poumons sans stase cave.',
                focusTab: 'coeur',
                focusZone: 'vd',
                focusLabel: 'Ventricule droit normal',
                embolDetached: false,
                clotProgress: 0,
                treatmentHeal: 0,
              }
            : {
                step: 0,
                label: '0 · Stase droite',
                title: 'Pression veineuse centrale élevée',
                whatHappens: 'Le VD pousse difficilement : le sang stagne dans les veines caves.',
                focusTab: 'coeur',
                focusZone: 'vd',
                focusLabel: 'Ventricule droit surchargé',
                embolDetached: false,
                clotProgress: 0,
                treatmentHeal: 0,
              },
          {
            step: 1,
            label: '1 · Surcharge cave',
            title: 'Frein au retour veineux',
            whatHappens: 'La pression veineuse centrale (PVC) dépasse 12 mmHg en amont du cœur droit.',
            focusTab: 'coeur',
            focusZone: 'vd',
            focusLabel: 'Stase en amont du VD',
            embolDetached: false,
            clotProgress: 0,
            treatmentHeal: 0,
          },
          {
            step: 2,
            label: '2 · Œdèmes périphériques',
            title: 'Congestion des jambes et du foie',
            whatHappens: 'Le retour freiné fait gonfler les chevilles et engorge le système veineux.',
            focusTab: 'corps',
            focusZone: 'cheville',
            focusLabel: 'Congestion veineuse systémique',
            embolDetached: false,
            clotProgress: 0,
            treatmentHeal: 0,
          },
          {
            step: 3,
            label: '3 · Bas débit & rein',
            title: 'Sous-remplissage gauche & stase rénale',
            whatHappens: 'Moins de sang traverse les poumons vers le VG, réduisant la filtration rénale.',
            focusTab: 'corps',
            focusZone: 'rein',
            focusLabel: 'Congestion veineuse rénale',
            embolDetached: false,
            clotProgress: 0,
            treatmentHeal: 0,
          },
          {
            step: 4,
            label: '4 · Décompensation droite',
            title: 'Cœur pulmonaire décompensé',
            whatHappens: 'Congestion veineuse majeure, œdèmes importants et hypotension.',
            focusTab: 'corps',
            focusZone: 'cheville',
            focusLabel: 'Surcharge veineuse sévère',
            embolDetached: false,
            clotProgress: 0,
            treatmentHeal: 0,
          },
        ]
      : [
          {
            step: 0,
            label: '0 · Avant traitement',
            title: 'Surcharge veineuse droite',
            whatHappens: 'La PVC élevée fatigue les veines caves et les membres inférieurs.',
            focusTab: 'coeur',
            focusZone: 'vd',
            focusLabel: 'VD à décharger',
            embolDetached: false,
            clotProgress: 0,
            treatmentHeal: 0.1,
          },
          {
            step: 1,
            label: '1 · Décharge mesurée',
            title: 'Réduction douce de la surcharge cave',
            whatHappens: 'Le diurétique ou l’iSGLT2 allège la PVC sans priver le VG de précharge.',
            focusTab: 'coeur',
            focusZone: 'vd',
            focusLabel: 'Décongestion du VD',
            embolDetached: false,
            clotProgress: 0,
            treatmentHeal: 0.35,
          },
          {
            step: 2,
            label: '2 · Retour fluide',
            title: 'Veines caves & chevilles soulagées',
            whatHappens: 'La PVC repasse sous 10 mmHg et les œdèmes diminuent.',
            focusTab: 'corps',
            focusZone: 'cheville',
            focusLabel: 'Dégonflement veineux',
            embolDetached: false,
            clotProgress: 0,
            treatmentHeal: 0.65,
          },
          {
            step: 3,
            label: '3 · Rein protégé',
            title: 'Débit & filtration stables',
            whatHappens: 'Les reins ne subissent plus la contre-pression veineuse.',
            focusTab: 'corps',
            focusZone: 'rein',
            focusLabel: 'Rein décongestionné',
            embolDetached: false,
            clotProgress: 0,
            treatmentHeal: 0.88,
          },
          {
            step: 4,
            label: '4 · Maintien durable',
            title: 'Tolérance fonctionnelle préservée',
            whatHappens: 'La volémie maîtrisée évite les poussées œdémateuses à long terme.',
            focusTab: 'corps',
            focusZone: 'cheville',
            focusLabel: 'Équilibre veineux maintenu',
            embolDetached: false,
            clotProgress: 0,
            treatmentHeal: 1,
          },
        ];
    return seq[step];
  }

  if (theme === 'general') {
    const seqNormal: StoryboardMoment[] = [
      {
        step: 0,
        label: '0 · État normal',
        title: params.effort ? 'Effort physiologique contrôlé' : 'Circulation et pression normales (120/80 mmHg)',
        whatHappens: params.effort
          ? 'Le cœur bat plus vite et éjecte davantage de sang vers les muscles actifs sans souffrance d’organe.'
          : 'Cœur, cerveau, reins et artères fonctionnent à l’équilibre. Activez une pathologie ou un exemple pour lancer une évolution.',
        focusTab: 'corps',
        focusZone: 'hta-organes',
        focusLabel: 'Cerveau · Cœur · Reins normaux',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0,
      },
      {
        step: 1,
        label: '1 · Adaptation vasculaire',
        title: 'Artères souples & régulation fine',
        whatHappens: 'L’endothélium libère du NO et ajuste le tonus artériolaire à la demande des organes.',
        focusTab: 'vaisseau',
        focusZone: 'plaque',
        focusLabel: 'Paroi artérielle intacte',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0,
      },
      {
        step: 2,
        label: '2 · Pompe cardiaque régulière',
        title: 'Rythme sinusal & valves étanches',
        whatHappens: 'Le ventricule gauche maintient une fraction d’éjection autour de 60 % sans hypertrophie.',
        focusTab: 'coeur',
        focusZone: 'vg',
        focusLabel: 'Ventricule gauche équilibré',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0,
      },
      {
        step: 3,
        label: '3 · Reins bien perfusés',
        title: 'Filtration glomérulaire préservée',
        whatHappens: 'La pression dans les glomérules reste physiologique, maintenant un DFG normal.',
        focusTab: 'corps',
        focusZone: 'rein',
        focusLabel: 'Reins perfusés normalement',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0,
      },
      {
        step: 4,
        label: '4 · Équilibre durable',
        title: 'Cerveau, cœur et reins préservés',
        whatHappens: 'En l’absence de facteur de risque actif, la réserve cardiovasculaire reste intacte à long terme.',
        focusTab: 'corps',
        focusZone: 'hta-organes',
        focusLabel: 'Équilibre des 3 organes maintenu',
        embolDetached: false,
        clotProgress: 0,
        treatmentHeal: 0,
      },
    ];
    return seqNormal[step];
  }

  // HTA (« ACHA ») : cible explicitement les 3 organes (Cœur, Rein, Cerveau)
  if (effectiveUntreated) {
    const seq: StoryboardMoment[] = [
      isFreeHealthyStart
        ? {
            step: 0,
            label: '0 · État normal',
            title: 'Pression artérielle normale (120/80 mmHg)',
            whatHappens:
              'Avant l’HTA : artères souples, cœur calme, reins bien perfusés et cerveau protégé.',
            focusTab: 'corps',
            focusZone: 'hta-organes',
            focusLabel: 'Cerveau · Cœur · Reins sains',
            embolDetached: false,
            clotProgress: 0,
            treatmentHeal: 0,
          }
        : {
            step: 0,
            label: '0 · HTA installée',
            title: 'Surpression artérielle & capillaires sous tension',
            whatHappens:
              'Les artérioles serrées élèvent la PA ; l’amlodipine seule peut aussi gonfler les chevilles.',
            focusTab: 'corps',
            focusZone: 'cheville',
            focusLabel: 'Hypertension & œdème capillaire',
            embolDetached: false,
            clotProgress: 0,
            treatmentHeal: 0,
          },
      {
        step: 1,
        label: '1 · Montée de pression',
        title: 'Résistances vasculaires augmentées',
        whatHappens:
          'Les artérioles se resserrent et imposent une contrainte permanente sur la paroi artérielle.',
        focusTab: 'corps',
        focusZone: 'hta-organes',
        focusLabel: '3 cibles exposées : Cœur · Reins · Cerveau',
        embolDetached: false,
        clotProgress: 0.05,
        treatmentHeal: 0,
      },
      {
        step: 2,
        label: '2 · Cible 1 · Cœur (HVG)',
        title: 'Hypertrophie du ventricule gauche',
        whatHappens:
          'Pour vaincre la pression élevée, le muscle du VG s’épaissit (HVG) et perd en souplesse de remplissage.',
        focusTab: 'coeur',
        focusZone: 'vg',
        focusLabel: 'Cœur · Hypertrophie du VG',
        embolDetached: false,
        clotProgress: 0.1,
        treatmentHeal: 0,
      },
      {
        step: 3,
        label: '3 · Cible 2 · Rein atteint',
        title: 'Hyperpression glomérulaire & baisse du DFG',
        whatHappens:
          'L’onde de pression abîme les petits vaisseaux du rein (néphroangiosclérose) : le DFG baisse progressivement.',
        focusTab: 'corps',
        focusZone: 'rein',
        focusLabel: 'Rein · hyperpression & DFG en baisse',
        embolDetached: false,
        clotProgress: 0.2,
        treatmentHeal: 0,
      },
      {
        step: 4,
        label: '4 · Cible 3 · Cerveau (AVC) & organes',
        title: 'Complication extrême : AVC + souffrance rénale & cardiaque',
        whatHappens:
          'L’HTA non soignée finit par frapper les 3 cibles : AVC cérébral, insuffisance rénale et défaillance du VG.',
        focusTab: 'corps',
        focusZone: 'hta-organes',
        focusLabel: 'Atteinte Cerveau · Cœur · Reins',
        embolDetached: false,
        clotProgress: 0.3,
        treatmentHeal: 0,
      },
    ];
    return seq[step];
  }

  const seqTreated: StoryboardMoment[] = [
    {
      step: 0,
      label: '0 · Avant traitement',
      title: 'Hypertension artérielle active',
      whatHappens: 'La pression artérielle dépasse la cible ; cœur, reins et cerveau subissent la surpression.',
      focusTab: 'corps',
      focusZone: 'hta-organes',
      focusLabel: '3 organes à protéger',
      embolDetached: false,
      clotProgress: 0,
      treatmentHeal: 0.08,
    },
    {
      step: 1,
      label: '1 · Ouverture vasculaire',
      title: 'Vasodilatation équilibrée (IEC / Amloperin® / Tensoplus®)',
      whatHappens: 'Le traitement relâche les résistances artériolaires et équilibre la pression capillaire.',
      focusTab: 'corps',
      focusZone: 'cheville',
      focusLabel: 'Rééquilibrage artériolo-veineux',
      embolDetached: false,
      clotProgress: 0,
      treatmentHeal: 0.34,
    },
    {
      step: 2,
      label: '2 · Reins & chevilles protégés',
      title: 'Œdèmes résorbés (−55 %) & filtration rénale préservée',
      whatHappens: 'La pression dans les glomérules du rein se normalise : le DFG reste stable et les chevilles dégonflent.',
      focusTab: 'corps',
      focusZone: 'rein',
      focusLabel: 'Reins protégés · DFG préservé',
      embolDetached: false,
      clotProgress: 0,
      treatmentHeal: 0.65,
    },
    {
      step: 3,
      label: '3 · Cœur soulagé',
      title: 'Régression de l’hypertrophie du VG',
      whatHappens: 'La postcharge abaissée permet au ventricule gauche de travailler sans surcharge ni fatigue.',
      focusTab: 'coeur',
      focusZone: 'vg',
      focusLabel: 'Cœur · HVG en recul',
      embolDetached: false,
      clotProgress: 0,
      treatmentHeal: 0.88,
    },
    {
      step: 4,
      label: '4 · Maintien acceptable à 5 ans',
      title: 'Cerveau, cœur et reins préservés sous traitement',
      whatHappens:
        'L’HTA est maintenue dans une zone sûre (< 130/80 mmHg) : le risque d’AVC, d’IC et d’insuffisance rénale reste faible.',
      focusTab: 'corps',
      focusZone: 'hta-organes',
      focusLabel: 'Cerveau · Cœur · Reins sauvegardés',
      embolDetached: false,
      clotProgress: 0,
      treatmentHeal: 1,
    },
  ];
  return seqTreated[step];
}

export function interpolateTimelineProjection(
  from: TimelineProjection,
  to: TimelineProjection,
  alphaRaw: number
): { params: SimParams; d: DynamicState } {
  const a = clamp(alphaRaw, 0, 1);
  if (a >= 0.999) return { params: to.params, d: to.d };
  if (a <= 0.001) return { params: from.params, d: from.d };

  const lerpNum = (x: number, y: number) => +(x + (y - x) * a).toFixed(2);
  const plaqueFloat = from.params.plaque + (to.params.plaque - from.params.plaque) * a;

  return {
    params: {
      ...to.params,
      fc: lerpNum(from.params.fc, to.params.fc),
      contract: lerpNum(from.params.contract, to.params.contract),
      volume: lerpNum(from.params.volume, to.params.volume),
      resist: lerpNum(from.params.resist, to.params.resist),
      rigidite: lerpNum(from.params.rigidite, to.params.rigidite),
      plaque: Math.round(plaqueFloat),
    },
    d: {
      hvg: clamp(from.d.hvg + (to.d.hvg - from.d.hvg) * a, 0, 1),
    },
  };
}

export function buildVisualStoryOverlay(
  moment: StoryboardMoment,
  inspectionPaused: boolean
): VisualStoryOverlay {
  return {
    focusZone: moment.focusZone,
    focusLabel: moment.focusLabel,
    embolDetached: moment.embolDetached,
    clotProgress: moment.clotProgress,
    treatmentHeal: moment.treatmentHeal,
    inspectionPaused,
  };
}
