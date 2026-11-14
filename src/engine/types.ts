export type TabId = 'corps' | 'coeur' | 'vaisseau';
export type ViewLevel = 1 | 2 | 3;
export type DisplayProfile = 'complet' | 'equilibre' | 'leger';
export type Heart3DMode = 'exterieur' | 'coupe' | 'transparent';
export type VesselSiteId = 'aorte' | 'carotide' | 'coronaire' | 'jambe';
export type AppMode = 'cas' | 'libre';
export type TimelineHorizon = 0 | 1 | 2 | 3 | 4;
export type TimelineBranch = 'treated' | 'untreated';
export type HeartChartMode = 'wiggers' | 'pv' | 'both';

export type MaladieId =
  | 'hta'
  | 'dyslipidemie'
  | 'rigidite'
  | 'idm'
  | 'ic'
  | 'ra'
  | 'im'
  | 'fa'
  | 'avc';

export type TraitementId =
  | 'statine'
  | 'iec'
  | 'ara2'
  | 'arni'
  | 'ica'
  | 'diuretique'
  | 'isglt2'
  | 'betabloquant'
  | 'anticoagulant'
  | 'antiagregant';

export type AssociationId = 'amlo-peri' | 'peri-inda-amlo';

export type ValveId = 'tricuspide' | 'pulmonaire' | 'mitrale' | 'aortique';
export type ComponentId =
  | 'od'
  | 'og'
  | 'vd'
  | 'vg'
  | ValveId
  | 'aorte'
  | 'ap'
  | 'vcaves'
  | 'vpulm'
  | 'cd'
  | 'iva'
  | 'cx'
  | 'sinusal'
  | 'nav'
  | 'his';

export type ActionType = 'stenose' | 'fuite' | 'bloque' | 'bouche' | 'faible' | 'rigide';
export type RhythmType = 'sinus' | 'fa' | 'jonctionnel' | 'bav3' | 'esv' | 'flutter';
export type ExtraRhythmMode = 'esv' | 'flutter' | null;

export interface SimParams {
  fc: number;
  contract: number;
  volume: number;
  resist: number;
  rigidite: number;
  effort: boolean;
  extraRythme: ExtraRhythmMode;
  mal: Record<MaladieId, boolean>;
  trt: Record<TraitementId, boolean>;
  asso: AssociationId | null;
  dose: Record<TraitementId, number>;
  pres: Partial<Record<AssociationId, string>>;
  act: Partial<Record<ComponentId, ActionType | null>>;
  fail: ComponentId | null;
  plaque: number;
  site: VesselSiteId;
  dysEndo: boolean;
  ischJambe: boolean;
  fcAuto: number | null;
  ruptureTriggered: {
    idm?: boolean;
    avc?: boolean;
    ischJambe?: boolean;
  };
}

export interface DynamicState {
  hvg: number;
}

export interface BioTolerance {
  potassium: number;
  creatinine: number;
  dfg: number;
  risqueToux: boolean;
  observanceComprimes: number;
  alertesBio: string[];
}

export interface ComputedResult {
  rythme: RhythmType;
  atriaOK: boolean;
  effort: boolean;
  fcEff: number;
  fcA: number;
  svtot: number;
  svf: number;
  dc: number;
  pam: number;
  pas: number;
  pad: number;
  pp: number;
  ptdvg: number;
  pog: number;
  pvc: number;
  fe: number;
  vtd: number;
  vts: number;
  grad: number;
  gradPic: number;
  vmax: number;
  lvSys: number;
  tej: number;
  compliance: number;
  rig: number;
  contract: number;
  resist: number;
  volume: number;
  rf: number;
  rfAo: number;
  surfAo: number;
  kick: number;
  acts: Partial<Record<ComponentId, ActionType | null>>;
  heartBlock: 'nav' | 'his' | null;
  dose: Record<TraitementId, number>;
  zoneIDM: 'iva' | 'cx' | 'cd' | null;
  satArt: number;
  ldl: number;
  congestion: number;
  oedemeVeineux: number;
  oedemeICa: number;
  oedeme: number;
  debitBas: number;
  pamHaute: number;
  rein: number;
  dysEndo: boolean;
  no: number;
  hvgCible: number;
  tr: Record<TraitementId, boolean>;
  asso: AssociationId | null;
  raa: number;
  bio: BioTolerance;
  notes: string[];
  warns: string[];
  pulmEmb: boolean;
  ivcBlock: boolean;
}

export interface VentricularEvent {
  t: number;
  wide: boolean;
  svf: number;
  isEsv?: boolean;
}

export interface AtrialEvent {
  t: number;
  isFlutter?: boolean;
}

export interface BeatTiming {
  v: VentricularEvent;
  nx: VentricularEvent;
  rr: number;
  qt: number;
  sys: number;
  ej0: number;
  ej1: number;
  ivr: number;
  a: AtrialEvent | null;
  svf: number;
  i: number;
}

export interface PresetConfig {
  fc?: number;
  contract?: number;
  volume?: number;
  resist?: number;
  rigidite?: number;
  effort?: boolean;
  extraRythme?: ExtraRhythmMode;
  site?: VesselSiteId;
  plaque?: number;
  dysEndo?: boolean;
  asso?: AssociationId;
  fail?: ComponentId;
  act?: Partial<Record<ComponentId, ActionType>>;
  dose?: Partial<Record<TraitementId, number>>;
  pres?: Partial<Record<AssociationId, string>>;
  mal?: MaladieId[];
  trt?: TraitementId[];
  hvg?: number;
}

export interface ExampleItem {
  grp?: string;
  id: string;
  t: string;
  w: string;
  p: PresetConfig;
  speed?: number;
}

export type FocusZoneId =
  | 'plaque'
  | 'embole'
  | 'cerveau'
  | 'coronaire'
  | 'rein'
  | 'hta-organes'
  | 'og'
  | 'vg'
  | 'vd'
  | 'aortique'
  | 'cheville'
  | 'poumons'
  | null;

export interface VisualStoryOverlay {
  focusZone: FocusZoneId;
  focusLabel: string;
  embolDetached: boolean;
  clotProgress: number;
  treatmentHeal: number;
  inspectionPaused: boolean;
}

export type SceneLesionId =
  | 'fa-clot'
  | 'coro-iva'
  | 'coro-cx'
  | 'coro-cd'
  | 'pulm-emb'
  | 'ivc-clot'
  | 'avc-clot'
  | 'leg-clot'
  | 'calc-aortique'
  | 'calc-mitrale'
  | 'calc-tricuspide'
  | 'calc-pulmonaire'
  | 'vessel-plaque'
  | 'vessel-thrombus';

