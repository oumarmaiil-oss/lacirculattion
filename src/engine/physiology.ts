import { CONFIG_COEUR } from '../config/physiologie';
import { clamp, lerp } from './geometry2d';
import type {
  ActionType,
  AssociationId,
  ComponentId,
  ComputedResult,
  DynamicState,
  MaladieId,
  PresetConfig,
  RhythmType,
  SimParams,
  TraitementId,
  ValveId,
} from './types';

export const C = CONFIG_COEUR;
export const N = C.normal;
export const MO = C.moteur;
export const CY = C.cycle;

export const PAM_N = N.pad + (N.pas - N.pad) / 3; // ≈ 93.3 mmHg
export const DC_N = (N.fc * N.ves) / 1000; // ≈ 4.9 L/min
export const RES_N = (PAM_N - N.pvc) / DC_N; // Wood units

export const MAL_IDS: MaladieId[] = [
  'hta',
  'dyslipidemie',
  'rigidite',
  'idm',
  'ic',
  'ra',
  'im',
  'fa',
  'avc',
];

export const TRT_IDS: TraitementId[] = [
  'statine',
  'iec',
  'ara2',
  'arni',
  'ica',
  'diuretique',
  'isglt2',
  'betabloquant',
  'anticoagulant',
  'antiagregant',
];

export const BP_IDS: TraitementId[] = [
  'iec',
  'ara2',
  'arni',
  'ica',
  'diuretique',
  'isglt2',
  'betabloquant',
];
export const VALVE_IDS: ValveId[] = ['tricuspide', 'pulmonaire', 'mitrale', 'aortique'];

export function complF(r: number): number {
  return lerp(MO.complianceSouple, MO.complianceRigide, clamp(r, 0, 1));
}

export function defaultAct(k: ComponentId): ActionType {
  if (k === 'aortique') return 'stenose';
  if ((VALVE_IDS as string[]).includes(k)) return 'fuite';
  if (k === 'sinusal' || k === 'nav' || k === 'his') return 'bloque';
  if (k === 'od' || k === 'og' || k === 'vg' || k === 'vd') return 'faible';
  if (k === 'aorte') return 'rigide';
  return 'bouche';
}

export function actOf(k: ComponentId, p: SimParams): ActionType | null {
  return (p.act && p.act[k]) || (p.fail === k ? defaultAct(k) : null);
}

export function anyAct(p: SimParams): boolean {
  return !!p.fail || Object.values(p.act || {}).some(Boolean);
}

export function freshP(): SimParams {
  return {
    fc: N.fc,
    contract: 1,
    volume: N.volumeSanguin,
    resist: 1,
    rigidite: MO.rigiditeParDefaut,
    effort: false,
    extraRythme: null,
    mal: Object.fromEntries(MAL_IDS.map((k) => [k, false])) as Record<MaladieId, boolean>,
    trt: Object.fromEntries(TRT_IDS.map((k) => [k, false])) as Record<TraitementId, boolean>,
    asso: null,
    dose: Object.fromEntries(TRT_IDS.map((k) => [k, 1])) as Record<TraitementId, number>,
    pres: {},
    act: {},
    fail: null,
    plaque: 0,
    site: 'coronaire',
    dysEndo: false,
    ischJambe: false,
    fcAuto: null,
    ruptureTriggered: {},
  };
}

export interface ActiveTrtOverride {
  trt: Record<TraitementId, boolean>;
  asso: AssociationId | null;
  dose?: Record<TraitementId, number>;
}

export function activeTrt(
  p: SimParams,
  override?: ActiveTrtOverride
): {
  t: Record<TraitementId, boolean>;
  asso: AssociationId | null;
  dose: Record<TraitementId, number>;
} {
  const t = { ...(override ? override.trt : p.trt) };
  const asso = override ? override.asso : p.asso;
  const dose = { ...p.dose };
  if (asso && C.associations[asso]) {
    const A = C.associations[asso];
    A.composants.forEach((k) => {
      t[k as TraitementId] = true;
    });
    const pr =
      A.presentations.find((x) => x.id === (p.pres || {})[asso]) || A.presentations[0];
    if (pr) {
      Object.assign(dose, pr.doses);
    }
  }
  if (override?.dose) {
    Object.assign(dose, override.dose);
  }
  return { t, asso, dose };
}

export function doseEffect(k: TraitementId, d: number): number {
  const tab = C.traitements.effetParDose;
  return tab[d] !== undefined ? tab[d] : 1;
}

const lessBy = (f: number, m: number) => 1 - (1 - f) * m;

export function compute(
  p: SimParams,
  d: DynamicState,
  override?: ActiveTrtOverride
): ComputedResult {
  const m = p.mal;
  const T = C.traitements;
  const MA = C.maladies;
  const { t: tr, asso, dose } = activeTrt(p, override);
  const acts: Partial<Record<ComponentId, ActionType | null>> = { ...p.act };
  if (p.fail && !acts[p.fail]) acts[p.fail] = defaultAct(p.fail);

  const AC = C.actions;
  const notes: string[] = [];
  const warns: string[] = [];

  let contract = p.contract;
  let resist = p.resist;
  let volume = p.volume;
  let rig = p.rigidite;
  let fc = p.fc;
  let rythme: RhythmType = 'sinus';
  let atriaOK = true;
  let pvcPlus = 0;
  let pogPlus = 0;
  let preloadF = 1;
  let satArt: number = N.satArterielle;
  let surfAo: number = N.surfaceAortique;
  let rf = 0;
  let rfAo = 0;
  let zoneIDM: 'iva' | 'cx' | 'cd' | null = null;
  let fcA = fc;
  let ivcBlock = false;
  let pulmEmb = false;
  let ptdvgPlus = 0;
  let ptdvgF = 1;
  let heartBlock: 'nav' | 'his' | null = null;

  if (m.hta) {
    resist *= MA.hta.resistancesFois;
    rig += MA.hta.rigiditePlus;
  }
  if (m.rigidite) rig = Math.max(rig, MA.rigidite.rigiditeFixe);
  if (m.ic) {
    contract *= MA.ic.contractiliteFois;
    volume += MA.ic.volumePlus;
    resist *= MA.ic.resistancesFois;
  }
  if (m.idm) {
    contract *= MA.idm.contractiliteFois;
    zoneIDM = MA.idm.arterePrincipale;
  }
  if (m.ra) {
    surfAo = MA.ra.surface;
  }
  if (m.im) {
    rf = MA.im.fractionRegurgitee;
    pogPlus += MA.im.pressionOGPlus;
  }
  if (m.fa) {
    rythme = 'fa';
    atriaOK = false;
  } else if (p.extraRythme === 'flutter') {
    rythme = 'flutter';
    atriaOK = false;
    fc = Math.max(fc, 138);
  } else if (p.extraRythme === 'esv') {
    rythme = 'esv';
  }

  for (const [kRaw, a] of Object.entries(acts)) {
    if (!a) continue;
    const k = kRaw as ComponentId;
    if ((VALVE_IDS as string[]).includes(k)) {
      const valveKey = k as ValveId;
      const actionMap = AC[a as 'stenose' | 'fuite'];
      if (!actionMap) continue;
      if (valveKey === 'aortique') {
        if (a === 'stenose') surfAo = Math.min(surfAo, AC.stenose.aortique.surface);
        else rfAo = Math.max(rfAo, AC.fuite.aortique.fraction);
      } else if (valveKey === 'mitrale') {
        if (a === 'stenose') {
          pogPlus += AC.stenose.mitrale.pressionOGPlus;
          preloadF *= AC.stenose.mitrale.precharge;
          ptdvgF *= 0.8;
        } else {
          rf = Math.max(rf, AC.fuite.mitrale.fraction);
          pogPlus = Math.max(pogPlus, AC.fuite.mitrale.pressionOGPlus);
        }
      } else if (valveKey === 'tricuspide') {
        const tv = actionMap.tricuspide;
        pvcPlus += tv.pvcPlus;
        preloadF *= tv.precharge;
      } else if (valveKey === 'pulmonaire') {
        const pv = actionMap.pulmonaire;
        pvcPlus += pv.pvcPlus;
        preloadF *= pv.precharge;
      }
      continue;
    }

    switch (k) {
      case 'od':
      case 'og':
        atriaOK = false;
        break;
      case 'vg':
        contract *= 0.45;
        volume += 0.45;
        pogPlus += 6;
        break;
      case 'vd':
        pvcPlus += 10;
        preloadF *= 0.74;
        break;
      case 'aorte':
        rig = Math.max(rig, 0.9);
        break;
      case 'ap':
        pulmEmb = true;
        pvcPlus += 8;
        preloadF *= 0.72;
        satArt = 89;
        break;
      case 'vcaves':
        ivcBlock = true;
        preloadF *= 0.7;
        break;
      case 'vpulm':
        ptdvgPlus += 14;
        preloadF *= 0.85;
        break;
      case 'iva':
        contract *= MA.idm.contractiliteFois;
        zoneIDM = 'iva';
        break;
      case 'cx':
        contract *= 0.82;
        zoneIDM = zoneIDM || 'cx';
        break;
      case 'cd':
        contract *= 0.86;
        zoneIDM = zoneIDM || 'cd';
        break;
      case 'sinusal':
        if (rythme !== 'fa') rythme = 'jonctionnel';
        break;
      case 'nav':
        rythme = 'bav3';
        heartBlock = heartBlock || 'nav';
        break;
      case 'his':
        rythme = 'bav3';
        heartBlock = 'his';
        break;
    }
  }
  if (acts.sinusal && (acts.nav || acts.his)) {
    heartBlock = acts.his ? 'his' : 'nav';
  }

  // Traitements (loi de Law BMJ 2003 sur les doses et additivité)
  const raa = (tr.iec ? 1 : 0) + (tr.ara2 ? 1 : 0) + (tr.arni ? 1 : 0);
  const icChron = m.ic || acts.vg === 'faible' || m.idm;
  if (raa > 0) {
    const mult = Math.max(
      tr.iec ? doseEffect('iec', dose.iec) : 0,
      tr.ara2 ? doseEffect('ara2', dose.ara2) : 0,
      tr.arni ? doseEffect('arni', dose.arni) * 1.15 : 0
    );
    resist *= lessBy(T.iec.resistancesFois, mult);
  }
  if (tr.iec && tr.arni) {
    warns.push(
      'ARNI + IEC simultanés : contre-indication absolue (risque d’angiœdème grave — respecter 36 h d’intervalle après arrêt de l’IEC).'
    );
  } else if (tr.ara2 && tr.arni) {
    warns.push(
      'ARNI + ARA II : double blocage AT1 redondant (le sacubitril/valsartan contient déjà un ARA II).'
    );
  } else if (tr.iec && tr.ara2) {
    warns.push(
      'IEC + ARA II : double blocage du système rénine-angiotensine, non recommandé (peu de baisse de pression en plus, plus d’effets indésirables rénaux et d’hyperkaliémie).'
    );
  }
  if (tr.arni) {
    const ma = doseEffect('arni', dose.arni);
    volume *= lessBy(T.arni.volumeFois ?? 0.96, ma);
    if (icChron) {
      pogPlus -= 2.5 * ma;
      contract *= 1 + 0.06 * ma;
      notes.push(
        'ARNI (sacubitril/valsartan) : réduit davantage la pression de remplissage pulmonaire (POG) et améliore la survie dans l’IC à FE réduite.'
      );
    }
  }
  if (raa > 0 && icChron) {
    volume *= 0.97;
    notes.push(
      'Insuffisance cardiaque : IEC/ARA II/ARNI baissent la postcharge et l’aldostérone ; ils freinent le remodelage du ventricule.'
    );
  }
  if (tr.ica) {
    resist *= lessBy(T.ica.resistancesFois, doseEffect('ica', dose.ica));
  }
  if (tr.diuretique) {
    const md = doseEffect('diuretique', dose.diuretique);
    const surch = volume > N.volumeSanguin * 1.05 && !!T.diuretique.volumeFoisSurcharge;
    volume *= surch ? T.diuretique.volumeFoisSurcharge : lessBy(T.diuretique.volumeFois, md);
    resist *= lessBy(T.diuretique.resistancesFois, md);
    if (p.volume < N.volumeSanguin * 0.85) {
      warns.push(
        'Diurétique alors que le volume sanguin est déjà bas (hémorragie, déshydratation) : risque d’effondrement de la pression et d’insuffisance rénale.'
      );
    }
  }
  if (tr.isglt2) {
    const surch = volume > N.volumeSanguin * 1.04;
    volume *= surch ? (T.isglt2.volumeFoisSurcharge ?? 0.94) : (T.isglt2.volumeFois ?? 0.96);
    resist *= T.isglt2.resistancesFois ?? 0.97;
    if (icChron) {
      pogPlus -= 2.8;
      notes.push(
        'iSGLT2 : décongestionne doucement le poumon sans hypokaliémie et protège le rein à moyen et long terme.'
      );
    }
  }
  if (tr.betabloquant) {
    const mb = doseEffect('betabloquant', dose.betabloquant);
    fc *= lessBy(T.betabloquant.fcFois, mb);
    contract *= lessBy(T.betabloquant.contractiliteFois, mb);
    if (icChron && (m.ic || acts.vg === 'faible')) {
      contract *= T.betabloquant.contractiliteICLongTerme;
      notes.push(
        'Insuffisance cardiaque à FE réduite : à long terme, le bêtabloquant ralentit le cœur, le protège de l’adrénaline et améliore la FE et la survie (simulé « après quelques mois »). On le démarre à petite dose, une fois le patient stabilisé.'
      );
    }
  }

  // Test d'effort dynamique (Repos -> Effort)
  if (p.effort) {
    const fcMult = tr.betabloquant ? 1.24 : 1.52;
    fc *= fcMult;
    const contractReserve = m.ic || acts.vg === 'faible' || m.idm ? 1.06 : 1.28;
    contract *= contractReserve;
    resist *= m.hta || rig > 0.65 ? 0.84 : 0.72;
    volume += 0.22;
    if (surfAo < 1.1) {
      notes.push(
        'À l’effort, le rétrécissement aortique serré empêche le débit d’augmenter : le gradient ΔP et la pression dans le VG grimpent brutalement.'
      );
    } else if (icChron) {
      notes.push(
        'À l’effort avec un VG affaibli, le retour veineux augmente plus vite que la capacité d’éjection : la pression pulmonaire (POG) monte.'
      );
    }
  }

  const sDose = dose.statine >= 1 ? 1 : 0.5;
  const ldlBase = m.dyslipidemie ? MA.dyslipidemie.ldl : N.ldl;
  const statinMul = tr.statine
    ? T.statine.ldlFoisParDose[sDose as 0.5 | 1] ?? T.statine.ldlFois
    : 1;
  const ldl = ldlBase * statinMul;

  rig = clamp(rig, 0, 1);
  const compliance = (MO.complianceNormale * complF(rig)) / complF(MO.rigiditeParDefaut);

  // Rythme et fréquence ventriculaire effective
  let fcEff = fc;
  if (rythme === 'jonctionnel') fcEff = 45 * (tr.betabloquant ? 0.88 : 1);
  if (rythme === 'bav3') {
    fcA = fc;
    fcEff = heartBlock === 'his' ? 32 : 40;
    if (acts.sinusal) fcA = 0;
  }
  if (tr.betabloquant && (rythme === 'jonctionnel' || rythme === 'bav3' || fcEff < 50)) {
    warns.push(
      'Bêtabloquant avec un cœur déjà lent ou un bloc de conduction : contre-indiqué (risque de bradycardie extrême). Il faut un avis cardiologique, parfois un pacemaker.'
    );
  }
  if ((rythme === 'fa' || rythme === 'flutter') && tr.betabloquant) {
    notes.push(
      `${rythme === 'flutter' ? 'Flutter' : 'FA'} : le bêtabloquant ralentit la conduction dans le nœud AV, donc la fréquence des ventricules (contrôle de la fréquence).`
    );
  }

  // Précharge et pressions de remplissage
  const vRel = volume / N.volumeSanguin;
  const fpi =
    Math.pow(vRel, MO.remplissageExposantVolume) *
    Math.pow(1 / Math.max(0.2, contract), MO.remplissageExposantContract);
  let ptdvg = N.ptdvg * fpi * (1 + 0.35 * d.hvg) * ptdvgF + ptdvgPlus;
  if (surfAo < 1.5) ptdvg += 4;
  if (ivcBlock || pulmEmb) ptdvg *= 0.7;
  const pog = ptdvg + pogPlus * 0.7;
  const pvc =
    N.pvc * Math.pow(vRel, MO.remplissageExposantVolume) +
    pvcPlus +
    0.25 * Math.max(0, pog - N.ptdvg);

  const starling = Math.min(MO.starlingPlafond, Math.pow(fpi * preloadF, MO.starlingExposant));
  const fill = 1 - Math.max(0, fcEff - MO.seuilTachycardie) * MO.pertePerBattement;
  const kick = MO.contributionAuriculaire * (1 + 0.4 * d.hvg);
  const kickF = atriaOK ? (rythme === 'bav3' ? 1 - kick * 0.5 : 1) : 1 - kick;
  const hrF = fcEff < N.fc ? Math.min(1.4, Math.pow(N.fc / fcEff, 0.35)) : 1;

  let svtot0 = N.ves * contract * starling * fill * kickF * hrF;
  if (rf > 0) svtot0 *= 1.2;
  if (rfAo > 0) svtot0 *= 1.35;

  // Postcharge itérative
  let svtot = svtot0;
  let svf = svtot * (1 - rf);
  let dc = 0;
  let pam = PAM_N;
  let grad = 0;
  let tej = 0.3;
  let after = PAM_N;

  for (let i = 0; i < 8; i++) {
    svf = svtot * (1 - rf) * (1 - rfAo);
    dc = (fcEff * svf) / 1000;
    pam = dc * RES_N * resist + pvc;
    tej = clamp(0.3 * Math.pow(60 / fcEff / 0.857, 0.4), 0.18, 0.42);
    const q = svtot / tej;
    grad = Math.pow(q / (44.3 * surfAo), 2);
    after = pam + grad;
    svtot = svtot0 * Math.pow(PAM_N / after, MO.postchargeExposant);
  }

  const svEj = svtot * (1 - rf);
  const pp = (svEj / compliance) * Math.sqrt(0.3 / tej);
  const pas = pam + (2 * pp) / 3;
  const pad = Math.max(20, pam - pp / 3 - 12 * rfAo);

  // Couplage cohérent FE / VTD / VTS
  const feTarget = clamp(
    N.fe * Math.pow(contract, 0.85) * Math.pow(PAM_N / after, 0.25) * (rf > 0 ? 1.08 : 1),
    0.08,
    0.8
  );
  const vtdPreload =
    (N.ves / N.fe) *
    starling *
    fill *
    kickF *
    hrF *
    (rf > 0 ? 1.2 : 1) *
    (rfAo > 0 ? 1.35 : 1);
  const vtd = Math.max(svtot / feTarget, vtdPreload);
  const vts = Math.max(10, vtd - svtot);
  const fe = clamp(svtot / vtd, 0.08, 0.82);

  const gradPic = grad * 1.6;
  const vmax = Math.sqrt(gradPic / 4);
  const lvSys = pas + gradPic;

  // Organes cibles & alertes
  const congestion = clamp(
    (pog - MO.seuilCongestionPulm) / (MO.seuilOAP - MO.seuilCongestionPulm),
    0,
    1.5
  );
  const oedemeVeineux = clamp((pvc - MO.seuilOedemeJambes) / 6, 0, 1);
  const redOedeme = C.associations['amlo-peri']?.reductionOedeme ?? 0.55;
  const oedemeICa = tr.ica
    ? clamp(
        0.45 *
          ((T.ica.oedemeParDose as Record<number, number>)[dose.ica] ?? 1) *
          (raa > 0 ? 1 - redOedeme : 1),
        0,
        1
      )
    : 0;

  const vaso = tr.ica || raa > 0;
  if (surfAo < 1 && (vaso || tr.diuretique)) {
    warns.push(
      'Rétrécissement aortique serré : vasodilatateurs et diurétiques à manier avec prudence (le débit est bloqué par la valve ; la pression peut chuter, avec malaise ou syncope). Le vrai traitement est le remplacement de la valve.'
    );
  }
  if (tr.ica && icChron && m.ic) {
    notes.push(
      'Insuffisance cardiaque : l’amlodipine est neutre sur la survie (essais PRAISE) ; on l’utilise seulement si la pression reste haute. Pas de vérapamil ni de diltiazem si la FE est basse.'
    );
  }
  if ((m.fa || acts.og) && !tr.anticoagulant) {
    notes.push(
      tr.antiagregant
        ? 'FA : l’aspirine protège peu (≈ −22 % d’AVC) ; un anticoagulant protège beaucoup mieux (≈ −64 %).'
        : 'FA : le sang stagne dans l’oreillette et peut coaguler. Un anticoagulant (risque évalué par le score CHA₂DS₂-VASc) réduit le risque d’AVC d’environ deux tiers.'
    );
  }
  if (tr.anticoagulant && tr.antiagregant) {
    warns.push(
      'Anticoagulant + aspirine : le risque de saignement s’additionne ; association réservée à des cas précis.'
    );
  }
  if (m.idm && !(tr.antiagregant && tr.statine && tr.betabloquant && raa > 0)) {
    notes.push(
      'Après un infarctus, le traitement de base associe : antiagrégant (aspirine), statine forte, bêtabloquant et IEC (prévention secondaire).'
    );
  }
  if (m.dyslipidemie && !tr.statine) {
    notes.push('LDL élevé : une statine baisse le LDL et ralentit la plaque.');
  }

  const debitBas = clamp((MO.seuilDebitBas - dc) / 1.5, 0, 1);
  const pamHaute = clamp((pam - MO.seuilPAMHaute) / 20, 0, 1);
  const reinRaw = Math.max(debitBas, pamHaute * 0.8);
  const rein = clamp(reinRaw * (tr.isglt2 ? 0.78 : 1), 0, 1);
  const dysEndo = p.dysEndo || m.hta || m.dyslipidemie;
  const no = clamp(
    1 - (dysEndo ? 0.6 : 0) + (dysEndo && tr.statine ? 0.12 : 0) + (dysEndo && raa > 0 ? 0.12 : 0),
    0.2,
    1
  );
  const hvgCible = clamp((after - MO.hvgSeuilPostcharge) / 35, 0, 1);

  // Biologie & Tolérance
  const kDelta =
    (tr.iec ? 0.35 * doseEffect('iec', dose.iec) : 0) +
    (tr.ara2 ? 0.35 * doseEffect('ara2', dose.ara2) : 0) +
    (tr.arni ? 0.38 * doseEffect('arni', dose.arni) : 0) -
    (tr.diuretique ? 0.48 * doseEffect('diuretique', dose.diuretique) : 0) +
    (rein > 0.3 ? 0.35 * rein : 0) +
    (raa >= 2 ? 0.45 : 0);
  const potassium = +clamp(4.2 + kDelta, 2.7, 6.4).toFixed(2);
  const dfg = Math.round(
    clamp(
      90 -
        rein * 30 -
        (m.hta ? 6 : 0) -
        (raa > 0 ? 4 : 0) +
        (tr.isglt2 ? 5 : 0) -
        (tr.diuretique && p.volume < 4.5 ? 12 : 0) -
        (raa >= 2 ? 12 : 0),
      18,
      115
    )
  );
  const creatinine = Math.round(82 * (90 / Math.max(20, dfg)));
  const risqueToux = Boolean(tr.iec);
  const assoComps = asso && C.associations[asso] ? C.associations[asso].composants : [];
  const extraPills = TRT_IDS.filter((k) => tr[k] && !assoComps.includes(k)).length;
  const observanceComprimes = (asso ? 1 : 0) + extraPills;
  const alertesBio: string[] = [];
  if (potassium > 5.2) {
    alertesBio.push(`Hyperkaliémie (K⁺ ${potassium.toFixed(1)} mmol/L) : risque rythmique.`);
  } else if (potassium < 3.5) {
    alertesBio.push(`Hypokaliémie (K⁺ ${potassium.toFixed(1)} mmol/L) sous diurétique : risque de crampes/ESV.`);
  }
  if (dfg < 50) {
    alertesBio.push(`DFG abaissé (${dfg} mL/min) : fonction rénale fragilisée.`);
  }
  if (tr.iec && tr.arni) {
    alertesBio.push('Danger : ARNI + IEC simultanés formellement contre-indiqués.');
  } else if (raa >= 2) {
    alertesBio.push('Double blocage RAA : surrisque rénal et hyperkaliémique.');
  }
  if (risqueToux) {
    alertesBio.push('Surveillance : toux sèche possible sous IEC (bascule vers ARA II si gênante).');
  }

  return {
    rythme,
    atriaOK,
    effort: Boolean(p.effort),
    fcEff,
    fcA,
    svtot,
    svf,
    dc,
    pam,
    pas,
    pad,
    pp,
    ptdvg,
    pog,
    pvc,
    fe,
    vtd,
    vts,
    grad,
    gradPic,
    vmax,
    lvSys,
    tej,
    compliance,
    rig,
    contract,
    resist,
    volume,
    rf,
    rfAo,
    surfAo,
    kick,
    acts,
    heartBlock,
    dose,
    zoneIDM,
    satArt,
    ldl,
    congestion,
    oedemeVeineux,
    oedemeICa,
    oedeme: Math.max(oedemeVeineux, oedemeICa),
    debitBas,
    pamHaute,
    rein,
    dysEndo,
    no,
    hvgCible,
    tr,
    asso,
    raa,
    bio: {
      potassium,
      creatinine,
      dfg,
      risqueToux,
      observanceComprimes,
      alertesBio,
    },
    notes,
    warns,
    pulmEmb,
    ivcBlock,
  };
}

export function effetTraitements(p: SimParams, d: DynamicState, r: ComputedResult) {
  const noBpTrt = Object.fromEntries(
    TRT_IDS.map((k) => [k, !BP_IDS.includes(k) && p.trt[k]])
  ) as Record<TraitementId, boolean>;
  const zeroTrt = Object.fromEntries(TRT_IDS.map((k) => [k, false])) as Record<
    TraitementId,
    boolean
  >;
  const none = compute(p, d, { trt: noBpTrt, asso: null });
  const baseline = compute(p, d, { trt: zeroTrt, asso: null });
  const { t, dose } = activeTrt(p);
  const each = BP_IDS.filter((k) => t[k]).map((k) => {
    const single = Object.fromEntries(TRT_IDS.map((j) => [j, j === k])) as Record<
      TraitementId,
      boolean
    >;
    const o = compute(p, d, { trt: single, asso: null, dose });
    return { k, dPas: o.pas - none.pas, dPad: o.pad - none.pad };
  });
  let oedemeSoloICa = 0;
  if (t.ica) {
    const soloIca = Object.fromEntries(TRT_IDS.map((j) => [j, j === 'ica'])) as Record<
      TraitementId,
      boolean
    >;
    oedemeSoloICa = compute(p, d, { trt: soloIca, asso: null, dose }).oedemeICa;
  }
  return {
    none,
    baseline,
    each,
    all: r,
    oedemeSoloICa,
  };
}

export function stenosePct(st: number, p: SimParams): number {
  return st === 6 && activeTrt(p).t.antiagregant
    ? C.traitements.antiagregant.stenoseRuptureAvec
    : C.atherome.stenose[st] ?? 0;
}

export function applyPresetToParams(o: PresetConfig): { params: SimParams; d: DynamicState } {
  const p = freshP();
  if (o.fc !== undefined) p.fc = o.fc;
  if (o.contract !== undefined) p.contract = o.contract;
  if (o.volume !== undefined) p.volume = o.volume;
  if (o.resist !== undefined) p.resist = o.resist;
  if (o.rigidite !== undefined) p.rigidite = o.rigidite;
  if (o.effort !== undefined) p.effort = o.effort;
  if (o.extraRythme !== undefined) p.extraRythme = o.extraRythme;
  if (o.site !== undefined) p.site = o.site;
  if (o.plaque !== undefined) p.plaque = o.plaque;
  if (o.dysEndo !== undefined) p.dysEndo = o.dysEndo;
  if (o.asso !== undefined) p.asso = o.asso;
  if (o.fail) p.act[o.fail] = defaultAct(o.fail);
  if (o.act) Object.assign(p.act, o.act);
  if (o.dose) Object.assign(p.dose, o.dose);
  if (o.pres) Object.assign(p.pres, o.pres);
  (o.mal || []).forEach((k) => {
    p.mal[k] = true;
  });
  (o.trt || []).forEach((k) => {
    p.trt[k] = true;
  });
  if (p.mal.fa && o.fc === undefined) p.fc = C.maladies.fa.fcVentriculaire;
  return { params: p, d: { hvg: o.hvg || 0 } };
}

export function setPlaqueStage(
  p: SimParams,
  st: number
): { next: SimParams; triggeredEvent: string | null } {
  const nextStage = clamp(st, 0, 6);
  const next: SimParams = {
    ...p,
    mal: { ...p.mal },
    ruptureTriggered: { ...p.ruptureTriggered },
    plaque: nextStage,
  };
  let triggeredEvent: string | null = null;

  if (nextStage === 6) {
    if (next.site === 'coronaire' && !next.mal.idm) {
      next.mal.idm = true;
      next.ruptureTriggered.idm = true;
      triggeredEvent =
        'Rupture de plaque dans une coronaire : un caillot bouche l’artère → infarctus du myocarde.';
    } else if (next.site === 'carotide' && !next.mal.avc) {
      next.mal.avc = true;
      next.ruptureTriggered.avc = true;
      triggeredEvent =
        'Rupture de plaque carotidienne : un fragment de caillot part vers le cerveau → AVC ischémique.';
    } else if (next.site === 'jambe' && !next.ischJambe) {
      next.ischJambe = true;
      next.ruptureTriggered.ischJambe = true;
      triggeredEvent = 'Rupture de plaque dans l’artère de la jambe : ischémie aiguë du membre.';
    }
  } else if (nextStage === 0) {
    if (next.ruptureTriggered.idm) next.mal.idm = false;
    if (next.ruptureTriggered.avc) next.mal.avc = false;
    if (next.ruptureTriggered.ischJambe) next.ischJambe = false;
    next.ruptureTriggered = {};
  }

  return { next, triggeredEvent };
}
