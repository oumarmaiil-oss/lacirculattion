import type { ClinicalCaseDef } from './clinicalCases';
import { activeTrt, actOf } from './physiology';
import type {
  AppMode,
  AssociationId,
  PresetConfig,
  SceneLesionId,
  SimParams,
  TraitementId,
} from './types';

export interface TreatmentProtocol {
  id: string;
  conditionTitle: string;
  summary: string;
  classes: string[];
  presetPatch: PresetConfig;
  isMechanical?: boolean;
  note?: string;
}

export function getTreatmentProtocol(
  params: SimParams,
  appMode: AppMode,
  activeCase: ClinicalCaseDef | null
): TreatmentProtocol | null {
  if (appMode === 'cas' && activeCase) {
    switch (activeCase.id) {
      case 'hta-oedeme':
        return {
          id: 'hta-oedeme',
          conditionTitle: 'HTA & œdème sous Amlodipine seule',
          summary:
            'Associer un IEC (Périndopril) à l’Amlodipine en 1 comprimé (Amloperin® 5/10) ouvre la veinule capillaire, réduit l’œdème d’≈ 55 % et normalise la PA.',
          classes: ['Amloperin® 5/10 (Périndopril 5 + Amlodipine 10)'],
          presetPatch: {
            trt: [],
            asso: 'amlo-peri',
            pres: { 'amlo-peri': '5-10' },
          },
        };
      case 'hta-resistante':
        return {
          id: 'hta-resistante',
          conditionTitle: 'HTA résistante sous bithérapie',
          summary:
            'Escalader vers la trithérapie en 1 comprimé (Tensoplus® : Périndopril + Indapamide + Amlodipine) agit sur 3 voies complémentaires.',
          classes: ['Tensoplus® 10/2,5/10 (IEC + Thiazidique + ICA)'],
          presetPatch: {
            trt: [],
            asso: 'peri-inda-amlo',
            pres: { 'peri-inda-amlo': '10-2.5-10' },
          },
        };
      case 'ic-vg-faible':
        return {
          id: 'ic-vg-faible',
          conditionTitle: 'Insuffisance cardiaque à FE réduite',
          summary:
            'La quadrithérapie moderne associe ARNI (ou IEC, jamais les deux), bêtabloquant, iSGLT2 et diurétique pour décongestionner le poumon et remonter la FE.',
          classes: [
            'ARNI (sacubitril/valsartan)',
            'Bêtabloquant (dose progressive)',
            'iSGLT2 (protection cardio-rénale)',
            'Diurétique (décongestion)',
          ],
          presetPatch: {
            trt: ['arni', 'betabloquant', 'isglt2', 'diuretique'],
            dose: { arni: 1, betabloquant: 0.5, diuretique: 1 },
          },
        };
      case 'ra-serre':
        return {
          id: 'ra-serre',
          conditionTitle: 'Rétrécissement aortique serré',
          summary:
            'Obstacle mécanique fixe : éviter tout vasodilatateur agressif qui effondrerait la PA et préparer le remplacement valvulaire (TAVI ou chirurgie).',
          classes: ['Respect hémodynamique (0 vasodilatateur)', 'Remplacement valvulaire (TAVI / chirurgie)'],
          presetPatch: { trt: [] },
          isMechanical: true,
        };
      case 'fa-rapide':
        return {
          id: 'fa-rapide',
          conditionTitle: 'Fibrillation auriculaire & risque embolique',
          summary:
            'Freiner le nœud AV par bêtabloquant et fluidifier par anticoagulant oral (AOD/AVK, −64 % d’AVC ; sans associer d’aspirine inutile).',
          classes: ['Anticoagulant oral (AOD / AVK)', 'Bêtabloquant (contrôle FC)'],
          presetPatch: { trt: ['anticoagulant', 'betabloquant'] },
        };
      case 'idm-plaque':
        return {
          id: 'idm-plaque',
          conditionTitle: 'Infarctus du myocarde (IDM) & plaque coronaire',
          summary:
            'Désobstruction en urgence puis quadrithérapie de prévention secondaire pour prévenir la récidive et le remodelage du ventricule gauche.',
          classes: [
            'Antiagrégant (aspirine)',
            'Statine forte (LDL −54 %)',
            'IEC (anti-remodelage)',
            'Bêtabloquant (épargne en O₂)',
          ],
          presetPatch: {
            trt: ['antiagregant', 'statine', 'iec', 'betabloquant'],
            dose: { statine: 1, iec: 1, betabloquant: 1 },
          },
        };
      case 'vd-htap':
        return {
          id: 'vd-htap',
          conditionTitle: 'Ventricule droit affaibli & surcharge cave',
          summary:
            'Décongestion prudente par diurétique faible dose + iSGLT2 afin de soulager la PVC sans priver le cœur gauche de précharge.',
          classes: ['Diurétique faible dose', 'iSGLT2', 'Éviter vasodilatateurs excessifs'],
          presetPatch: {
            trt: ['diuretique', 'isglt2'],
            dose: { diuretique: 0.5 },
          },
        };
    }
  }

  // Free exploration mode: detect active condition in clinical priority order
  if (params.mal.idm || actOf('iva', params) === 'bouche' || actOf('cx', params) === 'bouche' || actOf('cd', params) === 'bouche') {
    return {
      id: 'idm',
      conditionTitle: 'Infarctus du myocarde (IDM)',
      summary:
        'Après désobstruction rapide de l’artère coupable (angioplastie / thrombolyse), la quadrithérapie réduit la mortalité, stabilise la plaque et limite la dilatation du VG.',
      classes: ['Antiagrégant (aspirine)', 'Statine forte', 'IEC', 'Bêtabloquant'],
      presetPatch: {
        trt: ['antiagregant', 'statine', 'iec', 'betabloquant'],
        dose: { statine: 1, iec: 1, betabloquant: 1 },
      },
    };
  }

  if (actOf('ap', params) === 'bouche' || actOf('vcaves', params) === 'bouche') {
    return {
      id: 'embolie',
      conditionTitle: 'Thrombo-embolie veineuse / pulmonaire',
      summary:
        'L’anticoagulation curative immédiate bloque l’extension du caillot et permet la fibrinolyse progressive de l’obstacle.',
      classes: ['Anticoagulant oral / héparine'],
      presetPatch: { trt: ['anticoagulant'] },
    };
  }

  if (params.mal.avc) {
    return {
      id: 'avc',
      conditionTitle: 'AVC ischémique',
      summary:
        'Reperfusion en urgence dans la fenêtre thérapeutique puis prévention secondaire ciblée selon la cause (anticoagulant si FA, antiagrégant + statine si plaque carotidienne).',
      classes: params.mal.fa
        ? ['Anticoagulant oral (−64 % récidive)', 'Bêtabloquant']
        : ['Antiagrégant plaquettaire', 'Statine forte'],
      presetPatch: params.mal.fa
        ? { trt: ['anticoagulant', 'betabloquant'] }
        : { trt: ['antiagregant', 'statine'], dose: { statine: 1 } },
    };
  }

  if (params.mal.fa) {
    return {
      id: 'fa',
      conditionTitle: 'Fibrillation auriculaire',
      summary:
        'L’anticoagulant prévient la formation du caillot dans l’oreillette gauche (−64 % d’AVC) tandis que le bêtabloquant calme la fréquence ventriculaire.',
      classes: ['Anticoagulant oral (AOD / AVK)', 'Bêtabloquant'],
      presetPatch: { trt: ['anticoagulant', 'betabloquant'] },
    };
  }

  if (params.mal.ic || actOf('vg', params) === 'faible') {
    return {
      id: 'ic',
      conditionTitle: 'Insuffisance cardiaque / VG affaibli',
      summary:
        'Quadrithérapie de référence pour lever la congestion pulmonaire, abaisser la postcharge et restaurer progressivement la fraction d’éjection.',
      classes: ['ARNI (ou IEC)', 'Bêtabloquant', 'iSGLT2', 'Diurétique'],
      presetPatch: {
        trt: ['arni', 'betabloquant', 'isglt2', 'diuretique'],
        dose: { betabloquant: 0.5, arni: 1, diuretique: 1 },
      },
    };
  }

  if (actOf('vd', params) === 'faible') {
    return {
      id: 'vd',
      conditionTitle: 'Ventricule droit affaibli',
      summary:
        'Décongestion mesurée de la surcharge veineuse sans vasodilatation brutale.',
      classes: ['Diurétique faible dose', 'iSGLT2'],
      presetPatch: { trt: ['diuretique', 'isglt2'], dose: { diuretique: 0.5 } },
    };
  }

  if (params.mal.ra || actOf('aortique', params) === 'stenose') {
    return {
      id: 'ra',
      conditionTitle: 'Rétrécissement aortique serré',
      summary:
        'Traitement mécanique de référence : remplacement valvulaire (TAVI ou chirurgie). Éviter les vasodilatateurs qui chutent la PA devant l’obstacle.',
      classes: ['Remplacement valvulaire (TAVI / chirurgie)', '0 vasodilatateur agressif'],
      presetPatch: { trt: [] },
      isMechanical: true,
    };
  }

  if (params.mal.im || actOf('mitrale', params) === 'fuite') {
    return {
      id: 'im',
      conditionTitle: 'Insuffisance mitrale',
      summary:
        'Baisser la postcharge (IEC) et la congestion (diurétique) soulage le reflux en attendant la réparation ou le remplacement valvulaire.',
      classes: ['IEC (baisse postcharge)', 'Diurétique (si congestion)'],
      presetPatch: { trt: ['iec', 'diuretique'] },
    };
  }

  if (params.mal.dyslipidemie || params.plaque > 0) {
    return {
      id: 'dyslipidemie',
      conditionTitle: 'Dyslipidémie & plaque d’athérome',
      summary:
        'La statine forte abaisse le LDL de moitié et épaissit la chape fibreuse protectrice ; l’antiagrégant limite l’agrégation plaquettaire en cas de rupture.',
      classes: ['Statine forte (LDL −54 %)', 'Antiagrégant (si plaque avancée / rupture)'],
      presetPatch: {
        trt: params.plaque >= 5 ? ['statine', 'antiagregant'] : ['statine'],
        dose: { statine: 1 },
      },
    };
  }

  if (params.mal.hta || params.resist > 1.15) {
    const isSevere = params.resist >= 1.2;
    return {
      id: 'hta',
      conditionTitle: isSevere ? 'Hypertension artérielle sévère' : 'Hypertension artérielle',
      summary: isSevere
        ? 'Trithérapie synergique (Tensoplus®) pour abaisser rapidement les résistances et protéger cœur, reins et cerveau.'
        : 'Bithérapie fixe Amloperin® (Périndopril + Amlodipine) : baisse tensionnelle additive et réduction de 55 % des œdèmes de cheville.',
      classes: [
        isSevere
          ? 'Tensoplus® 10/2,5/10 (IEC + Indapamide + Amlodipine)'
          : 'Amloperin® 5/5 (IEC + Amlodipine)',
      ],
      presetPatch: isSevere
        ? { trt: [], asso: 'peri-inda-amlo', pres: { 'peri-inda-amlo': '10-2.5-10' } }
        : { trt: [], asso: 'amlo-peri', pres: { 'amlo-peri': '5-5' } },
    };
  }

  if (params.mal.rigidite || actOf('aorte', params) === 'rigide') {
    return {
      id: 'rigidite',
      conditionTitle: 'Rigidité artérielle',
      summary:
        'Freiner la pression systolique (IEC ou ICA) et protéger l’endothélium (statine) limite l’à-coup de pression pulsée sur le VG et le cerveau.',
      classes: ['IEC', 'Statine (protection endothéliale)'],
      presetPatch: { trt: ['iec', 'statine'] },
    };
  }

  return null;
}

export function isProtocolApplied(params: SimParams, proto: TreatmentProtocol): boolean {
  const { t, asso } = activeTrt(params);
  if (proto.isMechanical) {
    return !asso && Object.values(t).every((v) => !v);
  }
  if (proto.presetPatch.asso) {
    return asso === proto.presetPatch.asso;
  }
  const required = proto.presetPatch.trt || [];
  if (required.length === 0) return false;
  return required.every((id) => Boolean(t[id]));
}

export function mergeProtocolOnParams(prev: SimParams, patch: PresetConfig): SimParams {
  const nextTrt = { ...prev.trt };
  const nextDose = { ...prev.dose };
  let nextAsso: AssociationId | null = prev.asso;
  const nextPres = { ...prev.pres };

  if (patch.asso) {
    (Object.keys(nextTrt) as TraitementId[]).forEach((k) => {
      nextTrt[k] = false;
    });
    nextAsso = patch.asso;
    if (patch.pres) Object.assign(nextPres, patch.pres);
  } else if (patch.trt) {
    nextAsso = null;
    (Object.keys(nextTrt) as TraitementId[]).forEach((k) => {
      nextTrt[k] = patch.trt!.includes(k);
    });
    if (patch.dose) Object.assign(nextDose, patch.dose);
  }

  return {
    ...prev,
    trt: nextTrt,
    asso: nextAsso,
    dose: nextDose,
    pres: nextPres,
  };
}

export interface LesionMeta {
  title: string;
  subtitle: string;
  description: string;
}

export function getLesionMeta(id: SceneLesionId, params: SimParams): LesionMeta {
  switch (id) {
    case 'fa-clot':
      return {
        title: 'Thrombus auriculaire gauche',
        subtitle: 'Complication de la fibrillation auriculaire',
        description:
          'Le sang stagne dans l’auricule gauche et forme un caillot qui risque de partir dans l’aorte vers le cerveau (AVC).',
      };
    case 'coro-iva':
    case 'coro-cx':
    case 'coro-cd':
      return {
        title:
          id === 'coro-iva'
            ? 'Caillot dans l’artère IVA'
            : id === 'coro-cx'
              ? 'Caillot dans la circonflexe'
              : 'Caillot dans la coronaire droite',
        subtitle: 'Occlusion coronaire · Infarctus du myocarde',
        description:
          'Le thrombus bloque l’apport d’oxygène au myocarde en aval : la paroi devient hypokinétique et le segment ST s’élève.',
      };
    case 'pulm-emb':
      return {
        title: 'Embolie pulmonaire',
        subtitle: 'Caillot dans l’artère pulmonaire',
        description:
          'Obstacle brutal devant le ventricule droit : pression veineuse en hausse, bas débit gauche et chute de SpO₂.',
      };
    case 'ivc-clot':
      return {
        title: 'Obstruction de la veine cave',
        subtitle: 'Frein au retour veineux',
        description:
          'Moins de sang revient au cœur droit : le remplissage ventriculaire et le débit chutent.',
      };
    case 'avc-clot':
      return {
        title: 'Caillot cérébral (AVC ischémique)',
        subtitle: 'Occlusion d’une artère du cerveau',
        description:
          'Un embole issu du cœur (FA) ou d’une plaque carotidienne bloque la perfusion d’un territoire cérébral.',
      };
    case 'leg-clot':
      return {
        title: 'Caillot artère fémorale',
        subtitle: 'Ischémie aiguë du membre inférieur',
        description:
          'Une plaque rompue dans l’artère de la jambe interrompt l’irrigation distale.',
      };
    case 'vessel-thrombus':
      return {
        title: 'Thrombus sur rupture de plaque',
        subtitle: 'Agrégation plaquettaire aiguë',
        description:
          'La fissure de la chape fibreuse expose le cœur lipidique : les plaquettes forment un caillot qui obstrue la lumière.',
      };
    case 'vessel-plaque':
      return {
        title: `Plaque d’athérome (stade ${params.plaque}/6)`,
        subtitle: 'Dépôt lipidique sous-endothélial',
        description:
          params.plaque >= 5
            ? 'Plaque volumineuse à chape fragile exposée au risque de rupture et de thrombose.'
            : 'Infiltration de LDL et réaction inflammatoire dans l’intima artérielle.',
      };
    case 'calc-aortique':
    case 'calc-mitrale':
    case 'calc-tricuspide':
    case 'calc-pulmonaire':
      return {
        title: `Calcification · ${
          id === 'calc-aortique'
            ? 'Valve aortique'
            : id === 'calc-mitrale'
              ? 'Valve mitrale'
              : id === 'calc-tricuspide'
                ? 'Valve tricuspide'
                : 'Valve pulmonaire'
        }`,
        subtitle: 'Rétrécissement valvulaire calcifié',
        description:
          'Les dépôts calcaires rigidifient les feuillets : la valve s’ouvre mal, créant un jet turbulent et un gradient de pression.',
      };
  }
}
