import { C, DC_N, MO, N, RES_N, actOf, activeTrt } from '../engine/physiology';
import {
  atriumContraction,
  beat,
  lvVolume,
  phaseName,
  pressures,
  valves,
  type CardiacClockState,
} from '../engine/clock';
import { fmt, type Point2D } from '../engine/geometry2d';
import type {
  ActionType,
  ComponentId,
  ComputedResult,
  DynamicState,
  ExampleItem,
  MaladieId,
  SimParams,
  TabId,
  TraitementId,
  ValveId,
  VesselSiteId,
} from '../engine/types';

export const UNSURE_BADGE = ' [à vérifier]';

export const HG = {
  RA: {
    c: [315, 262] as Point2D,
    pts: [
      [250, 215],
      [300, 190],
      [365, 198],
      [392, 240],
      [388, 300],
      [362, 336],
      [300, 340],
      [258, 318],
      [242, 268],
    ] as Point2D[],
  },
  LA: {
    c: [650, 250] as Point2D,
    pts: [
      [565, 205],
      [640, 185],
      [720, 196],
      [752, 238],
      [748, 292],
      [715, 334],
      [640, 340],
      [578, 328],
      [560, 268],
    ] as Point2D[],
  },
  RV: {
    c: [400, 455] as Point2D,
    pts: [
      [300, 370],
      [350, 362],
      [410, 364],
      [452, 330],
      [472, 330],
      [480, 380],
      [478, 470],
      [462, 545],
      [425, 592],
      [380, 560],
      [332, 500],
      [300, 430],
    ] as Point2D[],
  },
  LV: {
    c: [628, 478] as Point2D,
    pts: [
      [528, 380],
      [505, 335],
      [548, 332],
      [566, 366],
      [640, 364],
      [738, 370],
      [748, 450],
      [728, 540],
      [680, 612],
      [612, 668],
      [574, 612],
      [540, 530],
      [524, 450],
    ] as Point2D[],
  },
  outer: [
    [238, 200],
    [300, 172],
    [380, 178],
    [440, 150],
    [470, 150],
    [560, 160],
    [650, 160],
    [740, 170],
    [782, 230],
    [790, 330],
    [778, 430],
    [750, 540],
    [700, 630],
    [618, 705],
    [580, 694],
    [520, 640],
    [440, 620],
    [360, 590],
    [300, 520],
    [262, 440],
    [236, 370],
    [226, 280],
  ] as Point2D[],
};

export const VESSELS = {
  vcs: { nom: 'Veine cave supérieure', w: 44, pts: [[292, 20], [292, 120], [300, 198]] as Point2D[] },
  vci: { nom: 'Veine cave inférieure', w: 46, pts: [[212, 760], [212, 520], [220, 400], [262, 326]] as Point2D[] },
  ap: {
    nom: 'Artère pulmonaire',
    w: 44,
    pts: [[475, 318], [478, 250], [470, 175]] as Point2D[],
    branches: [
      [[470, 180], [380, 168], [280, 160], [170, 170]] as Point2D[],
      [[470, 180], [560, 140], [690, 128], [800, 150]] as Point2D[],
    ],
  },
  aorte: {
    nom: 'Aorte',
    w: 50,
    pts: [
      [528, 330],
      [528, 220],
      [530, 120],
      [570, 58],
      [660, 40],
      [760, 62],
      [830, 120],
      [846, 240],
      [846, 760],
    ] as Point2D[],
  },
  vp: {
    nom: 'Veines pulmonaires',
    w: 24,
    multi: [
      [[930, 205], [840, 210], [752, 232]] as Point2D[],
      [[930, 290], [840, 292], [750, 282]] as Point2D[],
      [[600, 92], [612, 150], [616, 190]] as Point2D[],
      [[680, 90], [690, 150], [694, 192]] as Point2D[],
    ],
  },
};

export const CORO = {
  cd: {
    nom: 'Artère coronaire droite',
    pts: [
      [508, 318],
      [455, 348],
      [390, 352],
      [300, 350],
      [250, 372],
      [246, 440],
      [290, 520],
      [350, 580],
      [430, 615],
    ] as Point2D[],
  },
  iva: {
    nom: 'Artère interventriculaire antérieure (IVA)',
    pts: [
      [552, 318],
      [548, 350],
      [536, 400],
      [548, 480],
      [566, 560],
      [588, 640],
      [600, 690],
    ] as Point2D[],
  },
  cx: {
    nom: 'Artère circonflexe',
    pts: [
      [552, 318],
      [600, 352],
      [680, 360],
      [752, 368],
      [780, 420],
      [772, 480],
    ] as Point2D[],
  },
};

export const NODAL = {
  sinusal: { nom: 'Nœud sinusal', p: [300, 206] as Point2D },
  nav: { nom: 'Nœud auriculo-ventriculaire', p: [488, 340] as Point2D },
  his: {
    nom: 'Faisceau de His et ses branches',
    pts: [[488, 340], [502, 370], [506, 395]] as Point2D[],
    bd: [[506, 395], [486, 470], [462, 545], [425, 590]] as Point2D[],
    bg: [[506, 395], [530, 470], [560, 560], [598, 650]] as Point2D[],
  },
};

export interface CompMeta {
  nom: string;
  k: string;
  hit: { poly?: 'RA' | 'LA' | 'RV' | 'LV'; seg?: Point2D[]; w?: number; pt?: Point2D; r?: number };
  role: string;
  fx: string;
  unsure?: boolean;
}

export const COMP: Record<ComponentId, CompMeta> = {
  od: {
    nom: 'Oreillette droite',
    k: 'Cavité · cœur droit',
    hit: { poly: 'RA' },
    role: 'Reçoit le sang pauvre en oxygène qui revient du corps par les veines caves (et du cœur par le sinus coronaire). Sa contraction termine le remplissage du ventricule droit. Elle contient le nœud sinusal, le « chef d’orchestre » du cœur.',
    fx: 'Si les oreillettes ne se contractent plus (comme en fibrillation auriculaire), les ventricules se remplissent un peu moins : le débit cardiaque baisse d’environ 20 à 30 % chez le sujet sain, davantage si le ventricule est rigide.',
  },
  og: {
    nom: 'Oreillette gauche',
    k: 'Cavité · cœur gauche',
    hit: { poly: 'LA' },
    role: 'Reçoit le sang oxygéné qui revient des poumons par les quatre veines pulmonaires et le fait passer dans le ventricule gauche à travers la valve mitrale. Sa contraction apporte la fin du remplissage.',
    fx: 'Sans contraction auriculaire, le remplissage du ventricule gauche baisse et le débit diminue. Le sang stagne dans l’auricule gauche : un caillot peut s’y former et partir vers le cerveau (AVC).',
  },
  vd: {
    nom: 'Ventricule droit',
    k: 'Cavité · cœur droit',
    hit: { poly: 'RV' },
    role: 'Pompe le sang pauvre en oxygène vers les poumons, par l’artère pulmonaire. La petite circulation travaille à basse pression (environ 25/10 mmHg) : sa paroi est plus fine que celle du ventricule gauche.',
    fx: 'Le sang n’avance plus bien vers les poumons et s’accumule en amont, dans les veines : la pression veineuse centrale monte, les jugulaires se gonflent, le foie grossit et des œdèmes apparaissent aux jambes. Le ventricule gauche reçoit moins de sang : le débit baisse.',
  },
  vg: {
    nom: 'Ventricule gauche',
    k: 'Cavité · cœur gauche',
    hit: { poly: 'LV' },
    role: 'La pompe principale : il éjecte le sang oxygéné dans l’aorte, vers tout le corps, à haute pression (120 mmHg). C’est pourquoi sa paroi est la plus épaisse du cœur (environ 10 mm).',
    fx: 'C’est l’insuffisance ventriculaire gauche : le débit baisse (fatigue, reins moins irrigués) et le sang reflue vers les poumons. La pression monte dans les capillaires pulmonaires : essoufflement, puis œdème pulmonaire.',
  },
  tricuspide: {
    nom: 'Valve tricuspide',
    k: 'Valve auriculo-ventriculaire droite',
    hit: { seg: [[318, 344], [452, 344]], w: 14 },
    role: 'Entre l’oreillette droite et le ventricule droit. Elle s’ouvre pendant le remplissage et se ferme au début de la contraction des ventricules (bruit B1), pour empêcher le sang de refluer vers l’oreillette.',
    fx: 'Elle fuit (insuffisance tricuspide) : à chaque contraction, une partie du sang repart vers l’oreillette droite et les veines. La pression veineuse monte : jugulaires turgescentes, foie qui « bat », œdèmes des jambes.',
  },
  pulmonaire: {
    nom: 'Valve pulmonaire',
    k: 'Valve sigmoïde droite',
    hit: { seg: [[452, 318], [498, 312]], w: 12 },
    role: 'Entre le ventricule droit et l’artère pulmonaire. Elle s’ouvre pendant l’éjection et se ferme à la fin (composante P2 du bruit B2).',
    fx: 'Une fuite pulmonaire isolée est souvent bien tolérée longtemps : le ventricule droit se dilate peu à peu. Effet simulé modeste.',
    unsure: true,
  },
  mitrale: {
    nom: 'Valve mitrale',
    k: 'Valve auriculo-ventriculaire gauche',
    hit: { seg: [[566, 350], [716, 350]], w: 14 },
    role: 'Entre l’oreillette gauche et le ventricule gauche (deux feuillets, tenus par les cordages et les piliers). Elle se ferme au début de la systole (B1) et empêche le sang de refluer vers les poumons.',
    fx: 'C’est l’insuffisance mitrale : à chaque contraction, une partie du sang repart vers l’oreillette gauche (reflux visible en rose). Le débit vers l’aorte baisse, la pression monte dans l’oreillette et les poumons. Souffle holosystolique.',
  },
  aortique: {
    nom: 'Valve aortique',
    k: 'Valve sigmoïde gauche',
    hit: { seg: [[505, 330], [552, 328]], w: 12 },
    role: 'Entre le ventricule gauche et l’aorte (trois valvules sigmoïdes). Elle s’ouvre pendant l’éjection et se ferme à la fin (composante A2 du bruit B2). Juste au-dessus naissent les artères coronaires.',
    fx: 'Si elle ne s’ouvre plus bien (rétrécissement aortique, souvent par calcification) : le ventricule gauche doit forcer pour éjecter, sa pression dépasse largement celle de l’aorte, il s’épaissit. Souffle systolique éjectionnel ; essoufflement, douleur thoracique, malaise à l’effort.',
  },
  aorte: {
    nom: 'Aorte',
    k: 'Grosse artère élastique',
    hit: { seg: VESSELS.aorte.pts, w: 26 },
    role: 'La plus grosse artère du corps. Sa paroi élastique se distend à chaque éjection puis restitue l’énergie pendant la diastole : elle amortit les à-coups du cœur et maintient la pression entre deux battements (effet « Windkessel »).',
    fx: 'Si elle devient rigide, elle n’amortit plus : la pression systolique monte, la diastolique baisse (pression pulsée élevée) et le cœur doit forcer davantage. (Dissection et anévrisme ne sont pas simulés.)',
  },
  ap: {
    nom: 'Artère pulmonaire',
    k: 'Artère de la petite circulation',
    hit: { seg: VESSELS.ap.pts.concat(VESSELS.ap.branches[1]), w: 22 },
    role: 'Transporte le sang pauvre en oxygène du ventricule droit vers les poumons. C’est une artère qui transporte du sang « bleu » : ce n’est pas l’oxygène qui définit une artère, mais le sens du sang (elle part du cœur).',
    fx: 'Bouchée par un caillot (embolie pulmonaire) : le ventricule droit force contre l’obstacle et se dilate, la pression veineuse monte, le ventricule gauche reçoit moins de sang (le débit et la pression baissent) et le sang s’oxygène moins bien.',
    unsure: true,
  },
  vcaves: {
    nom: 'Veines caves',
    k: 'Grosses veines',
    hit: { seg: VESSELS.vcs.pts, w: 22 },
    role: 'La veine cave supérieure (tête, bras) et la veine cave inférieure (abdomen, jambes) ramènent le sang pauvre en oxygène vers l’oreillette droite.',
    fx: 'Si le retour veineux est bloqué, le cœur se remplit moins : le volume d’éjection, le débit et la pression baissent (loi de Frank-Starling). Le sang stagne en amont (visage gonflé dans le syndrome cave supérieur).',
    unsure: true,
  },
  vpulm: {
    nom: 'Veines pulmonaires',
    k: 'Veines de la petite circulation',
    hit: { seg: VESSELS.vp.multi[0], w: 16 },
    role: 'Quatre veines qui ramènent le sang oxygéné des poumons vers l’oreillette gauche. Ce sont des veines qui transportent du sang « rouge ».',
    fx: 'Si elles sont rétrécies (rare), le sang s’accumule dans les poumons : la pression capillaire pulmonaire monte et peut provoquer un œdème pulmonaire.',
    unsure: true,
  },
  cd: {
    nom: 'Artère coronaire droite',
    k: 'Artère du cœur',
    hit: { seg: CORO.cd.pts, w: 10 },
    role: 'Naît au-dessus de la valve aortique et irrigue le cœur droit et la face inférieure du ventricule gauche. Chez la plupart des personnes, elle irrigue aussi le nœud sinusal et le nœud auriculo-ventriculaire.',
    fx: 'Bouchée : infarctus inférieur. La zone irriguée devient grise et ne se contracte plus. Des troubles du rythme lents (bradycardie, blocs) sont possibles car elle irrigue souvent le tissu nodal.',
    unsure: true,
  },
  iva: {
    nom: 'Artère interventriculaire antérieure (IVA)',
    k: 'Artère du cœur · branche de la coronaire gauche',
    hit: { seg: CORO.iva.pts, w: 10 },
    role: 'Descend sur la face avant du cœur, le long du septum. Elle irrigue la paroi antérieure du ventricule gauche, la pointe et une grande partie du septum : c’est la coronaire qui irrigue le plus de muscle.',
    fx: 'Bouchée : infarctus antérieur, souvent étendu. La paroi antérieure et la pointe deviennent grises et immobiles, la contractilité chute, le débit baisse ; sus-décalage du segment ST à l’ECG.',
  },
  cx: {
    nom: 'Artère circonflexe',
    k: 'Artère du cœur · branche de la coronaire gauche',
    hit: { seg: CORO.cx.pts, w: 10 },
    role: 'Fait le tour du cœur dans le sillon auriculo-ventriculaire gauche et irrigue la paroi latérale du ventricule gauche.',
    fx: 'Bouchée : infarctus latéral. La paroi latérale ne se contracte plus ; la baisse de débit est en général moins forte qu’avec l’IVA.',
    unsure: true,
  },
  sinusal: {
    nom: 'Nœud sinusal',
    k: 'Tissu nodal · « pacemaker » naturel',
    hit: { pt: [300, 206], r: 24 },
    role: 'Petit amas de cellules dans la paroi de l’oreillette droite, près de la veine cave supérieure. Il se dépolarise spontanément 60 à 100 fois par minute et donne le rythme à tout le cœur (rythme sinusal). L’onde P de l’ECG correspond à la dépolarisation des oreillettes qu’il déclenche.',
    fx: 'Les oreillettes ne reçoivent plus de signal : plus d’onde P. Un « relais » de secours prend le rythme plus bas, dans la jonction auriculo-ventriculaire : rythme d’échappement jonctionnel lent (environ 40 à 60 batt/min) à QRS fins.',
  },
  nav: {
    nom: 'Nœud auriculo-ventriculaire',
    k: 'Tissu nodal',
    hit: { pt: [488, 340], r: 20 },
    role: 'Seul passage électrique entre oreillettes et ventricules. Il ralentit l’influx d’environ un dixième de seconde (intervalle PR) : les ventricules attendent que les oreillettes aient fini de les remplir.',
    fx: 'Bloc auriculo-ventriculaire complet (3ᵉ degré) : les oreillettes battent à leur rythme (ondes P régulières), les ventricules à un rythme d’échappement lent et indépendant. Le débit baisse : fatigue, malaises, syncopes ; un stimulateur cardiaque (pacemaker) est souvent nécessaire.',
  },
  his: {
    nom: 'Faisceau de His',
    k: 'Tissu nodal',
    hit: { seg: NODAL.his.pts.concat(NODAL.his.bg), w: 12 },
    role: 'Prolonge le nœud auriculo-ventriculaire dans le septum, puis se divise en branches droite et gauche et en réseau de Purkinje : l’influx atteint très vite tout le muscle ventriculaire, qui se contracte de façon coordonnée (QRS fin).',
    fx: 'Bloc complet sous le nœud : les ventricules ne battent plus qu’au rythme d’un foyer d’échappement ventriculaire, très lent (environ 30 à 40 batt/min), avec des QRS larges. C’est une situation grave qui nécessite un stimulateur cardiaque.',
  },
};

export const SITES: Record<VesselSiteId, { nom: string; type: string; diam: string; lam: number }> = {
  aorte: { nom: 'Aorte', type: 'élastique', diam: '≈ 25 mm', lam: 9 },
  carotide: { nom: 'Artère carotide', type: 'élastique (de transition)', diam: '≈ 6 à 7 mm', lam: 6 },
  coronaire: { nom: 'Artère coronaire', type: 'musculaire', diam: '≈ 3 à 4 mm', lam: 2 },
  jambe: { nom: 'Artère fémorale (jambe)', type: 'musculaire', diam: '≈ 6 à 8 mm', lam: 3 },
};

export const SLIDERS = [
  {
    k: 'fc' as const,
    cfg: 'fc' as const,
    nom: 'Fréquence cardiaque',
    u: 'batt/min',
    d: 0,
    help: 'Rythme du nœud sinusal (ou fréquence moyenne des ventricules en fibrillation auriculaire).',
  },
  {
    k: 'contract' as const,
    cfg: 'contractilite' as const,
    nom: 'Contractilité',
    u: '× normale',
    d: 2,
    help: 'Force de contraction du muscle cardiaque, à remplissage égal.',
  },
  {
    k: 'volume' as const,
    cfg: 'volume' as const,
    nom: 'Volume sanguin',
    u: 'L',
    d: 1,
    help: 'Plus de volume → plus de remplissage → plus de débit (Frank-Starling), mais aussi plus de pression dans les veines et les poumons.',
  },
  {
    k: 'resist' as const,
    cfg: 'resistances' as const,
    nom: 'Pression artérielle : tonus des artérioles',
    u: '× normal',
    d: 2,
    help: 'La pression est un résultat : pression moyenne = débit × résistances. Ce curseur serre ou relâche les petites artères ; la pression affichée en découle.',
  },
  {
    k: 'rigidite' as const,
    cfg: 'rigidite' as const,
    nom: 'Grosses artères : souples ↔ rigides',
    u: '',
    d: 2,
    help: '0 = très souples (sujet jeune) ; 1 = très rigides (âge, HTA ancienne, diabète).',
  },
];

export const MAL_TXT: Record<MaladieId, string> = {
  hta: 'Résistances élevées ; le VG s’épaissit peu à peu',
  dyslipidemie: 'LDL élevé ; la plaque d’athérome se construit',
  rigidite: 'Grosses artères rigides ; la pression pulsée s’élargit',
  idm: 'L’IVA se bouche ; une zone du VG ne bat plus',
  ic: 'Le cœur pompe mal ; le sang stagne en amont',
  ra: 'La valve aortique s’ouvre mal',
  im: 'La valve mitrale fuit ; reflux vers l’oreillette',
  fa: 'Les oreillettes frémissent ; rythme irrégulier',
  avc: 'Un caillot bouche une artère du cerveau',
};

export const ACT_LBL: Record<ActionType, string> = {
  stenose: 'Rétrécir la valve (presque fermée)',
  fuite: 'Faire fuir la valve (ne ferme plus)',
  bloque: 'Bloquer le courant électrique',
  bouche: 'Boucher : bloquer le sang',
  faible: 'Affaiblir le muscle',
  rigide: 'Rendre l’aorte rigide',
};

export function actsFor(id: ComponentId): ActionType[] {
  const valvesList: ValveId[] = ['tricuspide', 'pulmonaire', 'mitrale', 'aortique'];
  if ((valvesList as string[]).includes(id)) return ['stenose', 'fuite'];
  if (id === 'aortique') return ['stenose', 'fuite'];
  if (id === 'sinusal' || id === 'nav' || id === 'his') return ['bloque'];
  if (id === 'od' || id === 'og' || id === 'vg' || id === 'vd') return ['faible'];
  if (id === 'aorte') return ['rigide'];
  return ['bouche'];
}

const FXA: Record<string, string> = {
  'tricuspide:stenose':
    'Le sang passe mal de l’oreillette droite au ventricule droit : l’oreillette se dilate, le sang reflue dans les veines (foie gros, jambes gonflées) et le cœur gauche reçoit moins de sang.',
  'pulmonaire:stenose':
    'Le ventricule droit doit pousser très fort pour faire passer le sang vers les poumons : il s’épaissit puis se fatigue ; moins de sang arrive au cœur gauche. Souffle systolique.',
  'mitrale:stenose':
    'C’est le rétrécissement mitral : le sang a du mal à passer de l’oreillette gauche au ventricule gauche. La pression monte dans l’oreillette et les poumons (essoufflement, œdème pulmonaire), l’oreillette se dilate et fibrille souvent. Roulement diastolique grave. Souvent une séquelle du rhumatisme articulaire aigu.',
  'aortique:fuite':
    'C’est l’insuffisance aortique : pendant la diastole, le sang éjecté revient de l’aorte dans le ventricule gauche. La pression diastolique s’effondre (pression pulsée très large, pouls « bondissant »), le ventricule se dilate pour compenser, puis s’épuise. Souffle diastolique doux.',
};

export function fxOf(id: ComponentId, a: ActionType): string {
  return FXA[`${id}:${a}`] || COMP[id].fx;
}

export const EXPL: Record<
  'sain' | MaladieId,
  { t: string; corps: string; coeur: string; vaisseau: string; why: string }
> = {
  sain: {
    t: 'Sujet sain au repos',
    corps:
      'Le cœur gauche envoie environ 5 litres de sang par minute dans l’aorte. Le sang rouge, riche en oxygène, devient bleu en cédant son oxygène aux organes, puis revient par les veines au cœur droit, qui l’envoie se recharger dans les poumons.',
    coeur:
      'Un battement : le nœud sinusal donne le signal, les oreillettes se contractent (onde P), puis les ventricules (complexe QRS). La fermeture des valves mitrale et tricuspide fait le premier bruit (B1), celle des valves aortique et pulmonaire le second (B2).',
    vaisseau:
      'Une artère saine : l’endothélium, intact, libère du monoxyde d’azote (NO) qui relâche la média ; les fibres élastiques laissent l’artère se distendre à chaque éjection puis revenir.',
    why: 'Débit cardiaque = fréquence × volume d’éjection : 70 × 70 mL ≈ 4,9 L/min. La pression moyenne n’est pas « réglée » directement : elle résulte du débit et des résistances des artérioles.',
  },
  hta: {
    t: 'Hypertension artérielle',
    corps:
      'Les artérioles sont trop serrées : pour faire passer le même débit, la pression monte dans toutes les artères. À long terme, elle abîme les organes cibles : cerveau (AVC ischémique et hémorragique), cœur (hypertrophie, insuffisance cardiaque, infarctus), reins (néphroangiosclérose), artères et yeux.',
    coeur:
      'Le ventricule gauche pousse contre une pression plus élevée (postcharge). Il s’adapte en épaississant sa paroi : c’est l’hypertrophie ventriculaire gauche, qui progresse ici en accéléré. Un VG épais est plus rigide, se remplit moins bien et dépend davantage de la contraction des oreillettes.',
    vaisseau:
      'La paroi travaille sous une pression plus forte : la média s’épaissit, les grosses artères se rigidifient et l’endothélium fonctionne moins bien (moins de NO), ce qui favorise l’athérosclérose.',
    why: 'Pression moyenne = débit × résistances : à débit égal, des résistances 38 % plus élevées font monter la pression d’autant. Le muscle répond à une surcharge de pression par une hypertrophie « concentrique » (paroi épaisse, cavité normale).',
  },
  dyslipidemie: {
    t: 'Dyslipidémie et athérosclérose',
    corps:
      'Trop de LDL-cholestérol dans le sang. Il s’infiltre dans la paroi des artères et y construit, en des années, des plaques d’athérome qui rétrécissent les artères du cœur, du cou, des jambes… Va dans l’onglet 3 pour suivre la plaque étape par étape.',
    coeur:
      'Les plaques des artères coronaires rétrécissent le passage du sang vers le muscle cardiaque (angine de poitrine à l’effort). Si une plaque se rompt, un caillot bouche l’artère : c’est l’infarctus.',
    vaisseau:
      'Le LDL en excès traverse l’endothélium et s’accumule dans l’intima, où commence la plaque. Utilise la barre des étapes (0 à 6) ou le bouton « Étape suivante ».',
    why: 'Plus le LDL est élevé et longtemps, plus il entre dans la paroi : c’est pourquoi baisser le LDL (statines) réduit les infarctus et les AVC.',
  },
  rigidite: {
    t: 'Rigidité artérielle',
    corps:
      'Les grosses artères ont perdu leur élasticité (âge, HTA ancienne, diabète). Elles n’amortissent plus l’éjection : la pression systolique monte, la diastolique baisse, et le cœur force davantage.',
    coeur:
      'À chaque éjection, le ventricule gauche rencontre un « tuyau » dur : le pic de pression est plus haut, le travail du cœur augmente, et la pression diastolique plus basse irrigue moins bien les coronaires (qui se remplissent surtout en diastole).',
    vaisseau:
      'Les lames élastiques de la média sont fragmentées, remplacées par du collagène, parfois calcifiées. Le diamètre ne varie presque plus d’un battement à l’autre : regarde la différence avec une artère souple.',
    why: 'Pression pulsée ≈ volume d’éjection / compliance : une artère rigide (compliance basse) laisse monter la pression pour le même volume éjecté. De plus, l’onde de pression réfléchie par la périphérie revient plus vite et s’ajoute au pic systolique.',
  },
  idm: {
    t: 'Infarctus du myocarde',
    corps:
      'Une coronaire est bouchée : une partie du muscle cardiaque meurt. Le cœur pompe moins, la pression et le débit baissent ; si la zone est étendue, le sang reflue vers les poumons.',
    coeur:
      'L’artère interventriculaire antérieure (IVA) est bouchée par un caillot : la paroi antérieure et la pointe, privées d’oxygène, deviennent grises et ne se contractent plus. À l’ECG : sus-décalage du segment ST.',
    vaisseau:
      'L’infarctus commence presque toujours ici : une plaque coronaire à chape fine se rompt, un caillot se forme et bouche l’artère (étape 6).',
    why: 'Le muscle cardiaque ne tient que quelques dizaines de minutes sans oxygène : chaque minute compte, et la désobstruction rapide de l’artère (angioplastie ou thrombolyse) sauve du muscle. En prévention secondaire, la quadrithérapie ci-dessous (antiagrégant + statine forte + IEC + bêtabloquant) stabilise la plaque et protège le VG.',
  },
  ic: {
    t: 'Insuffisance cardiaque',
    corps:
      'Le cœur pompe mal. Le rein, moins irrigué, « croit » manquer de sang : il retient du sel et de l’eau. Le volume sanguin augmente et le sang stagne en amont du cœur : dans les poumons (essoufflement, œdème pulmonaire) et dans les veines (œdèmes des jambes).',
    coeur:
      'La contractilité est diminuée : le ventricule se dilate et éjecte une plus petite fraction de son contenu (fraction d’éjection basse). Les pressions de remplissage montent.',
    vaisseau:
      'Les artères reçoivent un débit plus faible ; une vasoconstriction réflexe tente de maintenir la pression, ce qui augmente encore le travail du cœur.',
    why: 'Loi de Frank-Starling : un ventricule plus rempli éjecte plus fort, mais la courbe d’un ventricule défaillant est aplatie : il faut beaucoup plus de pression de remplissage pour un volume d’éjection faible. Au-delà de 18 à 25 mmHg dans les capillaires pulmonaires, le liquide passe dans les poumons. Essaie le diurétique : le volume baisse, la congestion aussi.',
  },
  ra: {
    t: 'Rétrécissement aortique serré',
    corps:
      'Le débit ne peut pas augmenter normalement : à l’effort, essoufflement, douleur thoracique ou malaise. Le ventricule gauche, très épaissi, finit par s’épuiser.',
    coeur:
      'La valve aortique, calcifiée, s’ouvre mal. Le ventricule gauche doit monter sa pression bien au-dessus de celle de l’aorte pour éjecter (gradient de pression, voir les courbes) : souffle systolique « en losange », et la paroi du VG s’épaissit.',
    vaisseau: 'En aval de la valve, l’onde de pression monte lentement et reste petite (pouls « parvus et tardus »).',
    why: 'Gradient moyen ≈ (débit d’éjection / (44,3 × surface))² (formule de Gorlin simplifiée). Rétrécissement serré : surface ≤ 1 cm², gradient moyen ≥ 40 mmHg ou vitesse ≥ 4 m/s.',
  },
  im: {
    t: 'Insuffisance mitrale',
    corps: 'Moins de sang part vers le corps ; la pression monte dans les poumons (essoufflement).',
    coeur:
      'La valve mitrale ne ferme plus : à chaque systole, une partie du sang repart vers l’oreillette gauche (reflux visible en rose). L’oreillette se dilate, sa pression monte (grande onde « v » sur la courbe). Souffle holosystolique.',
    vaisseau: 'Le volume éjecté vers l’aorte est plus faible : la pression pulsée diminue.',
    why: 'Le ventricule éjecte un volume total plus grand, mais une fraction (ici ≈ 45 %) part en arrière. Le débit « utile » est le débit antérograde.',
  },
  fa: {
    t: 'Fibrillation auriculaire',
    corps:
      'Le cœur bat irrégulièrement. Le vrai danger est le caillot qui peut se former dans l’oreillette gauche et partir vers le cerveau : clique « Le caillot de l’oreillette gauche part… » pour le voir.',
    coeur:
      'Les oreillettes ne battent plus : elles frémissent, parcourues d’influx désordonnés. À l’ECG : pas d’onde P, une ligne de base qui tremble, des QRS irréguliers. Le sang stagne dans l’auricule gauche où un caillot peut se former.',
    vaisseau:
      'Le volume éjecté varie d’un battement à l’autre : la pression aussi (regarde l’onde de pression).',
    why: 'Le nœud auriculo-ventriculaire ne laisse passer qu’une partie des influx, au hasard : le rythme ventriculaire devient « irrégulièrement irrégulier ». Le remplissage perd la contribution des oreillettes (20 à 30 %).',
  },
  avc: {
    t: 'AVC ischémique',
    corps:
      'Un caillot bloque une artère du cerveau (ici l’artère cérébrale moyenne gauche) : la zone qu’elle irrigue ne reçoit plus d’oxygène. Selon la zone : paralysie d’un côté du corps, troubles de la parole, de la vision… C’est une urgence : appeler les secours, chaque minute compte.',
    coeur:
      'Le caillot vient souvent du cœur (oreillette gauche en fibrillation auriculaire) ou d’une plaque carotidienne.',
    vaisseau:
      'Une plaque carotidienne rompue (étape 6) peut lâcher un caillot qui monte vers le cerveau.',
    why: 'Les neurones sont les cellules les plus sensibles au manque d’oxygène. Les traitements de reperfusion (thrombolyse, thrombectomie) ne sont efficaces que dans les premières heures.',
  },
};

export const EX: Record<TabId, ExampleItem[]> = {
  corps: [
    { grp: 'Repères', id: 'sain', t: 'Sujet sain au repos', w: '5 litres par minute, 120/80 mmHg.', p: {} },
    {
      id: 'effort',
      t: 'Effort physique',
      w: 'Le cœur bat plus vite et plus fort, les veines renvoient plus de sang, les muscles ouvrent leurs artérioles : le débit grimpe, la PAS monte.',
      p: { fc: 130, contract: 1.8, resist: 0.45, volume: 5.6 },
    },
    {
      id: 'hemorragie',
      t: 'Hémorragie (perte de sang)',
      w: 'Moins de volume : moins de remplissage, le débit chute.',
      p: { volume: 3.7, fc: 110 },
    },
    {
      grp: 'Maladies',
      id: 'hta',
      t: 'Hypertension artérielle',
      w: 'Organes cibles : cerveau, cœur, reins.',
      p: { mal: ['hta'], hvg: 0.5 },
    },
    { id: 'ic', t: 'Insuffisance cardiaque', w: 'Congestion pulmonaire et œdèmes.', p: { mal: ['ic'] } },
    {
      id: 'oap',
      t: 'Œdème pulmonaire',
      w: 'Insuffisance cardiaque décompensée, trop de volume.',
      p: { mal: ['ic'], volume: 6.1 },
    },
    {
      id: 'fa-avc',
      t: 'FA : du caillot à l’AVC',
      w: 'Clique ensuite « Le caillot de l’oreillette gauche part… ».',
      p: { mal: ['fa'] },
    },
    { id: 'embolie', t: 'Embolie pulmonaire', w: 'L’artère pulmonaire est bouchée.', p: { fail: 'ap' } },
    {
      grp: 'Traitements',
      id: 'ic-diur',
      t: 'Insuffisance cardiaque + diurétique',
      w: 'Le volume baisse, la congestion aussi (en pratique : surtout le furosémide).',
      p: { mal: ['ic'], volume: 6.1, trt: ['diuretique'] },
    },
    {
      id: 'hta-asso',
      t: 'HTA + Amloperin® 5/5 (bithérapie)',
      w: 'Amlodipine + Périndopril : baisse de PA additive et œdème atténué de 55 %.',
      p: { mal: ['hta'], asso: 'amlo-peri', hvg: 0.5 },
    },
    {
      id: 'hta-asso-10',
      t: 'HTA + Amloperin® 10/10 (pleine dose)',
      w: 'Effet maximal sur la PA · à comparer avec amlodipine 10 mg seule.',
      p: { mal: ['hta'], asso: 'amlo-peri', pres: { 'amlo-peri': '10-10' }, hvg: 0.5 },
    },
    {
      id: 'hta-tri',
      t: 'HTA + Tensoplus® 5/1,25/5 (trithérapie)',
      w: 'Périndopril + Indapamide + Amlodipine : 3 mécanismes en 1 comprimé.',
      p: { mal: ['hta'], asso: 'peri-inda-amlo', hvg: 0.5 },
    },
    {
      id: 'hta-tri-max',
      t: 'HTA résistante + Tensoplus® 10/2,5/10',
      w: 'Trithérapie pleine dose : contrôle renforcé de la postcharge et du sel.',
      p: { mal: ['hta'], resist: 1.25, asso: 'peri-inda-amlo', pres: { 'peri-inda-amlo': '10-2.5-10' }, hvg: 0.65 },
    },
    {
      id: 'ica-dose',
      t: 'Amlodipine seule : 2,5, 5 ou 10 mg',
      w: 'Change la dose et compare l’œdème avec Amloperin®.',
      p: { mal: ['hta'], trt: ['ica'], hvg: 0.5 },
    },
    {
      id: 'fa-aco',
      t: 'FA + anticoagulant',
      w: 'Le caillot ne se forme presque plus (−64 % d’AVC).',
      p: { mal: ['fa'], trt: ['anticoagulant', 'betabloquant'] },
    },
    {
      id: 'ic-complet',
      t: 'Insuffisance cardiaque : traitement de fond',
      w: 'IEC + bêtabloquant + diurétique.',
      p: { mal: ['ic'], volume: 6.1, trt: ['iec', 'betabloquant', 'diuretique'] },
    },
  ],
  coeur: [
    { grp: 'Le cycle cardiaque', id: 'sain', t: 'Cœur normal, 70 batt/min', w: 'Onde P, QRS, T ; B1 et B2.', p: {} },
    {
      id: 'lent',
      t: 'Au ralenti (×0,25)',
      w: 'Pour voir chaque valve s’ouvrir et se fermer.',
      p: {},
      speed: 0.25,
    },
    { id: 'tachy', t: 'Tachycardie à 150', w: 'La diastole raccourcit, le remplissage baisse.', p: { fc: 150 } },
    { id: 'brady', t: 'Bradycardie à 45', w: 'Remplissage plus long, mais débit plus faible.', p: { fc: 45 } },
    { grp: 'Maladies', id: 'idm', t: 'Infarctus antérieur (IVA)', w: 'Zone grise immobile, sus-décalage ST.', p: { mal: ['idm'] } },
    {
      id: 'ra',
      t: 'Rétrécissement aortique serré',
      w: 'Gradient de pression et souffle.',
      p: { mal: ['ra'], hvg: 0.7 },
    },
    { id: 'im', t: 'Insuffisance mitrale', w: 'Reflux visible vers l’oreillette gauche.', p: { mal: ['im'] } },
    { id: 'fa', t: 'Fibrillation auriculaire', w: 'Oreillettes qui frémissent, ECG irrégulier.', p: { mal: ['fa'] } },
    {
      id: 'ia',
      t: 'Insuffisance aortique',
      w: 'La valve aortique fuit : PAD effondrée, souffle diastolique.',
      p: { act: { aortique: 'fuite' } },
    },
    {
      id: 'rm',
      t: 'Rétrécissement mitral',
      w: 'Valve obstruée : oreillette gauche dilatée, roulement diastolique.',
      p: { act: { mitrale: 'stenose' } },
    },
    {
      id: 'vg-faible',
      t: 'Ventricule gauche affaibli',
      w: 'VG dilaté, contraction faible, congestion des poumons.',
      p: { act: { vg: 'faible' } },
    },
    {
      id: 'vd-faible',
      t: 'Ventricule droit affaibli',
      w: 'VD dilaté, stase veineuse et moindre remplissage gauche.',
      p: { act: { vd: 'faible' } },
    },
    { id: 'hvg', t: 'HTA ancienne : VG épaissi', w: 'Paroi épaisse, grands QRS.', p: { mal: ['hta'], hvg: 0.9 } },
    {
      grp: 'Troubles de la conduction',
      id: 'sinusal',
      t: 'Nœud sinusal en panne',
      w: 'Échappement jonctionnel lent, pas d’onde P.',
      p: { fail: 'sinusal' },
    },
    {
      id: 'bav3',
      t: 'Bloc auriculo-ventriculaire complet',
      w: 'P et QRS indépendants.',
      p: { fail: 'nav' },
    },
    {
      id: 'his',
      t: 'Bloc du faisceau de His',
      w: 'Échappement ventriculaire très lent, QRS larges.',
      p: { act: { his: 'bloque' } },
    },
    {
      id: 'bb-bav',
      t: 'Bêtabloquant sur un bloc : contre-indiqué',
      w: 'Le modèle signale la contre-indication.',
      p: { fail: 'nav', trt: ['betabloquant'] },
    },
    { grp: 'Traitements', id: 'bb', t: 'Bêtabloquant', w: 'Le cœur ralentit et bat un peu moins fort.', p: { trt: ['betabloquant'] } },
    {
      id: 'fa-bb',
      t: 'FA rapide + bêtabloquant',
      w: 'Contrôle de la fréquence.',
      p: { mal: ['fa'], fc: 140, trt: ['betabloquant'] },
    },
  ],
  vaisseau: [
    {
      grp: 'La paroi artérielle',
      id: 'sain',
      t: 'Aorte saine et souple',
      w: 'L’artère se distend à chaque battement.',
      p: { site: 'aorte', rigidite: 0 },
    },
    {
      id: 'rigide',
      t: 'Aorte rigide (sujet âgé)',
      w: 'Le diamètre ne varie plus ; la PAS monte.',
      p: { site: 'aorte', mal: ['rigidite'] },
    },
    { id: 'coro', t: 'Coronaire saine', w: 'Une artère musculaire.', p: { site: 'coronaire' } },
    {
      id: 'dysendo',
      t: 'Dysfonction endothéliale',
      w: 'Moins de NO, moins de vasodilatation.',
      p: { site: 'coronaire', dysEndo: true },
    },
    {
      grp: 'Athérosclérose étape par étape',
      id: 'ath1',
      t: '1. Le LDL s’infiltre',
      w: 'LDL élevé, sous l’endothélium.',
      p: { site: 'coronaire', mal: ['dyslipidemie'], plaque: 1 },
    },
    {
      id: 'ath3',
      t: '3. Les monocytes entrent',
      w: 'Puis deviennent macrophages.',
      p: { site: 'coronaire', mal: ['dyslipidemie'], plaque: 3 },
    },
    {
      id: 'ath5',
      t: '5. La plaque rétrécit l’artère',
      w: 'Cœur lipidique, chape fibreuse fine.',
      p: { site: 'coronaire', mal: ['dyslipidemie'], plaque: 5 },
    },
    {
      id: 'ath6',
      t: '6. Rupture : infarctus',
      w: 'Le caillot bouche la coronaire.',
      p: { site: 'coronaire', mal: ['dyslipidemie', 'idm'], plaque: 6 },
    },
    {
      grp: 'Traitements',
      id: 'statine',
      t: 'Plaque sous statine',
      w: 'LDL −50 %, chape épaisse : plaque stabilisée.',
      p: { site: 'coronaire', mal: ['dyslipidemie'], plaque: 5, trt: ['statine'] },
    },
    {
      id: 'hta-ica',
      t: 'HTA + amlodipine',
      w: 'Les artérioles se relâchent, la pression baisse.',
      p: { site: 'aorte', mal: ['hta'], trt: ['ica'] },
    },
    {
      id: 'aspirine',
      t: 'Rupture de plaque sous aspirine',
      w: 'Le caillot est plus petit : l’artère n’est pas totalement bouchée.',
      p: { site: 'coronaire', mal: ['dyslipidemie'], plaque: 6, trt: ['antiagregant', 'statine'] },
    },
  ],
};

export function lastAct(p: SimParams): ComponentId | null {
  const active = (Object.keys(p.act) as ComponentId[]).filter((k) => p.act[k]);
  return active[active.length - 1] || p.fail;
}

export function mainCondition(p: SimParams): 'fail' | 'sain' | MaladieId {
  if (lastAct(p)) return 'fail';
  const order: MaladieId[] = ['avc', 'idm', 'ic', 'ra', 'im', 'fa', 'hta', 'rigidite', 'dyslipidemie'];
  for (const k of order) {
    if (p.mal[k]) return k;
  }
  return 'sain';
}

export function explain(tab: TabId, p: SimParams, d: DynamicState, r: ComputedResult) {
  const k = mainCondition(p);
  const { t } = activeTrt(p);
  const others = (Object.keys(p.mal) as MaladieId[])
    .filter((m) => p.mal[m] && m !== k)
    .map((m) => C.maladies[m].nom.toLowerCase());

  let title = '';
  let short = '';
  let why = '';

  if (k === 'fail') {
    const id = lastAct(p)!;
    const a = actOf(id, p)!;
    const c = COMP[id];
    title = `${c.nom} : ${ACT_LBL[a].toLowerCase()}`;
    short = fxOf(id, a) + (c.unsure ? UNSURE_BADGE : '');
    why = c.role;
  } else {
    const e = EXPL[k];
    title = e.t;
    short = e[tab];
    why = e.why;
  }

  if (
    k === 'sain' &&
    (Math.abs(p.fc - N.fc) > 0.5 ||
      Math.abs(p.contract - 1) > 0.01 ||
      Math.abs(p.volume - N.volumeSanguin) > 0.05 ||
      Math.abs(p.resist - 1) > 0.01 ||
      Math.abs(p.rigidite - MO.rigiditeParDefaut) > 0.01)
  ) {
    title = 'Réglages modifiés';
    short =
      'Observe comment chaque réglage se répercute partout : débit cardiaque = fréquence × volume d’éjection ; pression moyenne = débit × résistances ; plus le cœur est rempli, plus il éjecte (loi de Frank-Starling).';
  }

  if (tab === 'vaisseau' && p.plaque > 0) {
    const s = C.atherome.etapes[p.plaque];
    short =
      `${s.titre} — ${s.texte}` +
      (t.statine
        ? ' Sous statine, le LDL baisse, la plaque grossit moins et sa chape fibreuse s’épaissit : elle est plus stable (la rupture reste possible, mais moins probable).'
        : '');
  }
  if (tab === 'vaisseau' && p.plaque === 0 && k === 'sain') {
    short = `${EXPL.sain.vaisseau} ${SITES[p.site].nom} : artère de type ${SITES[p.site].type}.`;
  }

  const extraParagraphs: string[] = [short];
  if (others.length) {
    extraParagraphs.push(`Associé : ${others.join(', ')}.`);
  }
  const trts = (Object.keys(t) as TraitementId[])
    .filter((x) => t[x])
    .map((x) => `${C.traitements[x].nom} : ${C.traitements[x].mecanisme}`);
  if (trts.length) {
    extraParagraphs.push(...trts);
  }
  if (p.asso && C.associations[p.asso]) {
    extraParagraphs.push(`${C.associations[p.asso].nom} : ${C.associations[p.asso].explication}`);
  }

  const st: string[] = [];
  if (r.pog >= MO.seuilOAP) st.push(`Œdème pulmonaire : pression capillaire ≈ ${fmt(r.pog)} mmHg`);
  else if (r.congestion > 0) st.push(`Congestion pulmonaire (pression capillaire ≈ ${fmt(r.pog)} mmHg)`);
  if (r.dc < 3.5) st.push(`Débit cardiaque bas : ${fmt(r.dc, 1)} L/min`);
  if (r.pas >= 140 || r.pad >= 90) st.push(`PA élevée : ${fmt(r.pas)}/${fmt(r.pad)} mmHg`);
  if (r.pas < 95) st.push(`PA basse : ${fmt(r.pas)}/${fmt(r.pad)} mmHg`);
  if (d.hvg > 0.25) {
    st.push(
      `VG épaissi : paroi ≈ ${fmt(
        MO.epaisseurParoiNormale + d.hvg * (MO.epaisseurParoiMax - MO.epaisseurParoiNormale)
      )} mm`
    );
  }

  const xpLines = [
    `DC = FC × VES = ${fmt(r.fcEff)} × ${fmt(r.svf)} mL = ${fmt(r.dc, 2)} L/min`,
    `PAM = DC × R + PVC = ${fmt(r.dc, 2)} × ${fmt(RES_N * r.resist, 1)} + ${fmt(r.pvc, 1)} = ${fmt(r.pam)} mmHg`,
    `PP = VES / C = ${fmt(r.svf)} / ${fmt(r.compliance, 2)} = ${fmt(r.pp)} mmHg → PAS = ${fmt(r.pas)} ; PAD = ${fmt(r.pad)}`,
    `PTDVG ≈ ${fmt(r.ptdvg)} mmHg · POG ≈ ${fmt(r.pog)} · PVC ≈ ${fmt(r.pvc, 1)} · FE ≈ ${fmt(r.fe * 100)} % · VTD ${fmt(r.vtd)} mL · VTS ${fmt(r.vts)} mL`,
  ];
  if (r.surfAo < 2) {
    xpLines.push(
      `Valve aortique ${fmt(r.surfAo, 2)} cm² : gradient moyen ${fmt(r.grad)} mmHg, Vmax ≈ ${fmt(r.vmax, 1)} m/s`
    );
  }
  if (r.rf > 0) {
    xpLines.push(
      `Fraction régurgitée mitrale ${fmt(r.rf * 100)} % : VES total ${fmt(r.svtot)} mL, antérograde ${fmt(r.svf)} mL`
    );
  }

  return {
    title,
    short,
    paragraphs: extraParagraphs,
    why,
    status: st.join(' · '),
    xpLines,
  };
}

export function nowHTML(
  id: ComponentId,
  clk: CardiacClockState,
  p: SimParams,
  r: ComputedResult
) {
  const t = clk.t;
  const b = beat(clk, r, t);
  const pr = pressures(clk, r, t, b);
  const va = valves(clk, r, t, b);
  const ph = phaseName(clk, r, t, b);
  const vol = lvVolume(clk, r, t, b);
  const ac = atriumContraction(clk, r, t, b);
  const sys = t >= b.sys && t < b.ivr;
  const ej = t >= b.ej0 && t < b.ej1;
  const ouv = (k: ValveId) => (va[k] > 0.5 ? 'ouverte' : 'fermée');
  const rvP = (pr.lv - 2) * 0.2 + 2 + (actOf('ap', p) ? 18 : 0);
  const raP = r.pvc - 1 + 3 * ac;
  const blocked = actOf(id, p);

  let what = '';
  let vals: string[] = [];

  switch (id) {
    case 'vg': {
      const vgWeak = actOf('vg', p) === 'faible' || p.mal.ic;
      what = vgWeak
        ? 'Ventricule gauche affaibli et dilaté : la contraction peine à vider la cavité, le volume résiduel monte et le sang reflue en amont vers les poumons.'
        : ej
          ? 'Le ventricule gauche se contracte : sa pression dépasse celle de l’aorte, la valve aortique est ouverte, le sang est éjecté.'
          : sys
            ? t < b.ej0
              ? 'Le ventricule se contracte valves fermées : la pression monte vite sans que le volume change (contraction isovolumique).'
              : 'Le ventricule se relâche valves fermées : la pression chute (relaxation isovolumique).'
            : 'Le ventricule est relâché : la valve mitrale est ouverte, il se remplit avec le sang de l’oreillette gauche' +
              (ac > 0.05 ? ', qui se contracte pour compléter le remplissage.' : '.');
      vals = [
        `pression ${fmt(pr.lv)} mmHg`,
        `volume ${fmt(vol)} mL`,
        `FE ${fmt(r.fe * 100)} %`,
        `mitrale ${ouv('mitrale')}`,
        `aortique ${ouv('aortique')}`,
      ];
      break;
    }
    case 'vd': {
      const vdWeak = actOf('vd', p) === 'faible';
      what = vdWeak
        ? 'Ventricule droit affaibli : il peine à pousser le sang vers les poumons. La pression veineuse monte en amont (veines caves, foie, chevilles) et le VG reçoit moins de sang.'
        : ej
          ? 'Le ventricule droit éjecte le sang pauvre en oxygène dans l’artère pulmonaire (basse pression).'
          : sys
            ? 'Contraction ou relaxation à valves fermées.'
            : 'Le ventricule droit se remplit par la valve tricuspide ouverte.';
      vals = [
        `pression ≈ ${fmt(Math.max(0, rvP))} mmHg`,
        `PVC ${fmt(r.pvc, 1)} mmHg`,
        `tricuspide ${ouv('tricuspide')}`,
        `pulmonaire ${ouv('pulmonaire')}`,
      ];
      break;
    }
    case 'og':
    case 'od':
      what = !r.atriaOK
        ? 'L’oreillette ne se contracte pas efficacement (elle « tremble ») : le remplissage du ventricule se fait seulement de façon passive.'
        : ac > 0.05
          ? 'L’oreillette se contracte (onde P sur l’ECG) : elle pousse les derniers 20 % du sang dans le ventricule.'
          : sys
            ? 'Valve fermée : l’oreillette se remplit avec le sang qui revient ' +
              (id === 'og' ? 'des poumons.' : 'du corps.')
            : 'Valve ouverte : le sang traverse l’oreillette et coule vers le ventricule.';
      vals =
        id === 'og'
          ? [`pression ${fmt(pr.la)} mmHg`, `mitrale ${ouv('mitrale')}`]
          : [`pression ≈ ${fmt(raP)} mmHg`, `tricuspide ${ouv('tricuspide')}`];
      break;
    case 'mitrale':
    case 'tricuspide': {
      const sten = actOf(id, p) === 'stenose';
      const leak = actOf(id, p) === 'fuite' || (id === 'mitrale' && r.rf > 0);
      what = sten
        ? 'Obstruée (rétrécissement) : les feuillets calcifiés s’ouvrent très peu pendant la diastole, freinant le remplissage du ventricule et faisant monter la pression en amont.'
        : va[id] > 0.5
          ? 'Ouverte : le ventricule est relâché, sa pression est plus basse que celle de l’oreillette, le sang passe.'
          : 'Fermée : le ventricule se contracte, sa pression dépasse celle de l’oreillette ; la valve empêche le retour du sang' +
            (leak ? ' … mais ici elle fuit !' : '.');
      vals = [sten ? 'ouverture réduite' : ouv(id), ph];
      break;
    }
    case 'aortique':
    case 'pulmonaire': {
      const sten = actOf(id, p) === 'stenose' || (id === 'aortique' && r.surfAo < 1.5);
      const leak = actOf(id, p) === 'fuite' || (id === 'aortique' && r.rfAo > 0);
      what = sten
        ? id === 'aortique'
          ? `Obstruée (${fmt(r.surfAo, 2)} cm²) : les sigmoïdes calcifiées résistent à l’éjection ; le VG doit monter sa pression bien au-dessus de l’aorte (gradient moyen ${fmt(r.grad)} mmHg).`
          : 'Obstruée (sténose pulmonaire) : le ventricule droit force contre un orifice rétréci pour pousser le sang vers les poumons.'
        : va[id] > 0.5
          ? 'Ouverte : pendant l’éjection, la pression du ventricule dépasse celle de l’artère.'
          : 'Fermée : elle empêche le sang de revenir de l’artère vers le ventricule' +
            (leak ? ' … mais ici elle fuit !' : ' (sa fermeture fait le bruit B2).');
      vals = [
        sten ? 'obstruée' : ouv(id),
        ph,
        id === 'aortique' ? `aorte ${fmt(pr.ao)} mmHg` : '',
        id === 'aortique' && r.grad >= 5 ? `ΔP ${fmt(r.grad)} mmHg` : '',
      ];
      break;
    }
    case 'sinusal':
      what = blocked
        ? 'Bloqué : il n’envoie plus d’influx. Un autre tissu prend le relais, plus lentement (le nœud AV, ≈ 45/min : rythme d’échappement).'
        : `Il se dépolarise tout seul (automatisme) ${fmt(r.fcA || r.fcEff)} fois par minute ; chaque décharge déclenche une onde P.`;
      vals = [
        r.rythme === 'jonctionnel'
          ? `échappement ${fmt(r.fcEff)}/min`
          : `${fmt(r.fcA)}/min`,
      ];
      break;
    case 'nav':
    case 'his':
      what = blocked
        ? 'Bloqué : l’influx des oreillettes ne passe plus aux ventricules (bloc complet). Les ventricules battent à leur propre rythme d’échappement, lent et sans lien avec les ondes P.'
        : id === 'nav'
          ? 'Il retarde l’influx d’environ 0,1 s (segment PR) pour laisser les oreillettes finir de remplir les ventricules.'
          : 'Il conduit l’influx très vite dans le septum puis aux deux ventricules (QRS fin).';
      vals = [
        `ventricules ${fmt(r.fcEff)}/min`,
        r.rythme === 'bav3' ? `oreillettes ${fmt(r.fcA)}/min` : '',
      ];
      break;
    default:
      what = blocked
        ? 'Bloqué : regarde les conséquences ci-dessous et dans l’onglet « Le corps entier ».'
        : ph;
      vals = [ph];
  }

  return {
    phase: ph,
    paused: !clk.playing,
    what,
    vals: vals.filter(Boolean),
  };
}

export { DC_N };
