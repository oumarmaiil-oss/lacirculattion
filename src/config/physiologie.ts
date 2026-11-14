export interface DoseMap {
  [dose: number]: string;
}

export interface TraitementConfig {
  nom: string;
  classe: string;
  mecanisme: string;
  effetsIndesirables?: string;
  doses?: DoseMap;
  resistancesFois?: number;
  volumeFois?: number;
  volumeFoisSurcharge?: number;
  fcFois?: number;
  contractiliteFois?: number;
  contractiliteICLongTerme?: number;
  freineHVG?: number;
  ldlFois?: number;
  ldlFoisParDose?: Record<number, number>;
  oedemeParDose?: Record<number, number>;
  reductionAVC_FA?: number;
  stenoseRuptureAvec?: number;
}

export interface AssociationPresentation {
  id: string;
  nom: string;
  doses: Record<string, number>;
}

export interface AssociationConfig {
  nom: string;
  composants: string[];
  explication: string;
  reductionOedeme?: number;
  presentations: AssociationPresentation[];
}

export const CONFIG_COEUR = {
  avertissement:
    'Outil pédagogique. Ce simulateur simplifie la physiologie cardiovasculaire pour faciliter la compréhension ; il ne remplace jamais un avis médical ni une prescription.',

  // [ÉTABLI] Valeurs de référence d'un adulte sain au repos
  normal: {
    fc: 70,
    ves: 70,
    pas: 120,
    pad: 80,
    pvc: 3,
    ptdvg: 8,
    fe: 0.6,
    volumeSanguin: 5.0,
    surfaceAortique: 3.0,
    satArterielle: 98,
    ldl: 1.0,
  },

  // [MODÈLE] Paramètres du modèle compartimental
  moteur: {
    complianceNormale: 1.75, // 70 mL / 40 mmHg = 1.75 mL/mmHg
    complianceSouple: 2.25,
    complianceRigide: 0.62,
    rigiditeParDefaut: 0.25,
    remplissageExposantVolume: 1.55,
    remplissageExposantContract: 0.35,
    starlingPlafond: 1.55,
    starlingExposant: 0.45,
    postchargeExposant: 0.28,
    seuilTachycardie: 110,
    pertePerBattement: 0.0042,
    contributionAuriculaire: 0.24, // [SOURCE] StatPearls NBK482421 : 20-30 %
    seuilCongestionPulm: 15,
    seuilOAP: 22,
    seuilOedemeJambes: 8,
    seuilDebitBas: 3.8,
    seuilPAMHaute: 105,
    hvgSeuilPostcharge: 112,
    hvgConstanteTemps: 5.5,
    epaisseurParoiNormale: 10,
    epaisseurParoiMax: 17,
  },

  // [ÉTABLI / MODÈLE] Paramètres du cycle électrique et mécanique
  cycle: {
    intervallePR: 0.16,
    dureeP: 0.09,
    qtc: 0.39,
    contractionIsovolumique: 0.05,
    relaxationIsovolumique: 0.07,
    faIrregularite: 0.34,
    ampP: 0.16,
    ampQ: -0.1,
    ampR: 1.0,
    ampS: -0.22,
    ampT: 0.3,
  },

  maladies: {
    hta: {
      nom: 'Hypertension artérielle (HTA)',
      resistancesFois: 1.38,
      rigiditePlus: 0.22,
    },
    dyslipidemie: {
      nom: 'Dyslipidémie (LDL élevé)',
      ldl: 1.9,
      etapePlaque: 1,
    },
    rigidite: {
      nom: 'Rigidité artérielle',
      rigiditeFixe: 0.82,
    },
    idm: {
      nom: 'Infarctus du myocarde (IDM)',
      contractiliteFois: 0.62,
      arterePrincipale: 'iva' as const,
      susDecalageST: 0.32,
    },
    ic: {
      nom: 'Insuffisance cardiaque',
      contractiliteFois: 0.52,
      volumePlus: 0.85,
      resistancesFois: 1.18,
    },
    ra: {
      nom: 'Rétrécissement aortique serré',
      surface: 0.75, // [SOURCE] ESC/EACTS <= 1,0 cm²
    },
    im: {
      nom: 'Insuffisance mitrale',
      fractionRegurgitee: 0.45,
      pressionOGPlus: 12,
    },
    fa: {
      nom: 'Fibrillation auriculaire (FA)',
      fcVentriculaire: 105,
    },
    avc: {
      nom: 'AVC ischémique',
    },
  },

  traitements: {
    // [SOURCE] Law et al., BMJ 2003 : 80 % de l'effet à demi-dose, 120 % à double dose
    effetParDose: { 0.5: 0.8, 1: 1.0, 2: 1.2 } as Record<number, number>,
    statine: {
      nom: 'Statine (ex. atorvastatine)',
      classe: 'Hypolipémiant · stabilise la plaque',
      mecanisme:
        'Inhibe la synthèse hépatique du cholestérol (HMG-CoA réductase), baisse le LDL sanguin, réduit l’inflammation et épaissit la chape fibreuse.',
      doses: {
        0.5: 'Intensité modérée (ex. atorvastatine 10–20 mg) · LDL ≈ −38 %',
        1: 'Forte intensité (ex. atorvastatine 40–80 mg) · LDL ≈ −54 %',
      },
      ldlFois: 0.46,
      ldlFoisParDose: { 0.5: 0.62, 1: 0.46 },
      effetsIndesirables: 'Douleurs musculaires possibles (myalgies), élévation des transaminases (rare).',
    },
    iec: {
      nom: 'IEC (ex. périndopril, ramipril)',
      classe: 'Inhibiteur de l’enzyme de conversion',
      mecanisme:
        'Bloque la formation d’angiotensine II : dilate les artérioles (baisse la postcharge), protège le rein et freine le remodelage du ventricule.',
      doses: {
        0.5: 'Demi-dose (ex. périndopril 2,5 mg)',
        1: 'Dose standard (ex. périndopril 5 mg)',
        2: 'Double dose (ex. périndopril 10 mg)',
      },
      resistancesFois: 0.88,
      freineHVG: 0.5,
      effetsIndesirables:
        'Toux sèche (bradykinine), hyperkaliémie, hypotension, contre-indiqué pendant la grossesse.',
    },
    ara2: {
      nom: 'ARA II (ex. losartan, valsartan)',
      classe: 'Antagoniste des récepteurs de l’angiotensine II',
      mecanisme:
        'Bloque les récepteurs AT1 de l’angiotensine II : même voie que l’IEC, dilate les artérioles sans provoquer de toux.',
      doses: {
        0.5: 'Demi-dose (ex. losartan 25 mg)',
        1: 'Dose standard (ex. losartan 50 mg)',
        2: 'Double dose (ex. losartan 100 mg)',
      },
      resistancesFois: 0.88,
      effetsIndesirables: 'Hyperkaliémie, hypotension, contre-indiqué pendant la grossesse.',
    },
    arni: {
      nom: 'ARNI (sacubitril / valsartan)',
      classe: 'Inhibiteur néprilysine + ARA II (IC)',
      mecanisme:
        'Double action : bloque les récepteurs AT1 (valsartan) et protège les peptides natriurétiques (sacubitril). Dilate artères et veines, réduit la congestion pulmonaire et améliore la survie dans l’IC à FE réduite.',
      doses: {
        0.5: 'Palier d’initiation (24/26 mg ×2/j)',
        1: 'Palier intermédiaire (49/51 mg ×2/j)',
        2: 'Dose cible (97/103 mg ×2/j)',
      },
      resistancesFois: 0.85,
      volumeFois: 0.96,
      contractiliteICLongTerme: 1.08,
      effetsIndesirables:
        'Hypotension, hyperkaliémie ; JAMAIS associer à un IEC (risque d’angiœdème grave, respecter 36 h de fenêtre).',
    },
    ica: {
      nom: 'Inhibiteur calcique (amlodipine)',
      classe: 'Antagoniste calcique dihydropyridine',
      mecanisme:
        'Relâche le muscle lisse des artérioles en bloquant les canaux calciques : baisse directement les résistances périphériques.',
      doses: {
        0.5: 'Demi-dose (amlodipine 2,5 mg)',
        1: 'Dose standard (amlodipine 5 mg)',
        2: 'Double dose (amlodipine 10 mg)',
      },
      resistancesFois: 0.87,
      oedemeParDose: { 0.5: 0.35, 1: 1.0, 2: 1.85 },
      effetsIndesirables:
        'Œdème des chevilles (vasodilatation pré-capillaire, dose-dépendant), bouffées de chaleur, céphalées.',
    },
    diuretique: {
      nom: 'Diurétique (thiazidique / furosémide)',
      classe: 'Élimine sel et eau',
      mecanisme:
        'Augmente l’excrétion rénale de sodium et d’eau : réduit la surcharge de volume (congestion) et baisse les résistances à moyen terme.',
      doses: {
        0.5: 'Demi-dose',
        1: 'Dose standard',
        2: 'Double dose',
      },
      volumeFois: 0.96,
      volumeFoisSurcharge: 0.88,
      resistancesFois: 0.93,
      effetsIndesirables: 'Hypokaliémie, déshydratation, hypotension orthostatique, crampes.',
    },
    isglt2: {
      nom: 'iSGLT2 (dapagliflozine / empagliflozine)',
      classe: 'Gliflozine · cardio-néphroprotecteur',
      mecanisme:
        'Favorise une diurèse osmotique douce (glucose + sodium), baisse la pression de remplissage (POG) sans hypokaliémie, protège le rein et réduit fortement les hospitalisations pour insuffisance cardiaque.',
      doses: {
        1: 'Dose unique standard (10 mg/j)',
      },
      volumeFois: 0.96,
      volumeFoisSurcharge: 0.94,
      resistancesFois: 0.97,
      effetsIndesirables: 'Infections mycosiques génitales bénignes, baisse modérée de la volémie.',
    },
    betabloquant: {
      nom: 'Bêtabloquant (ex. bisoprolol)',
      classe: 'Freine l’adrénaline (récepteurs β1)',
      mecanisme:
        'Ralentit le nœud sinusal et la conduction dans le nœud AV ; diminue le travail et la consommation d’oxygène du cœur.',
      doses: {
        0.5: 'Petite dose (initiation IC)',
        1: 'Dose standard',
        2: 'Double dose',
      },
      fcFois: 0.8,
      contractiliteFois: 0.92,
      contractiliteICLongTerme: 1.18,
      effetsIndesirables:
        'Bradycardie, fatigue, extrémités froides ; contre-indiqué en cas de BAV sévère ou d’asthme non contrôlé.',
    },
    anticoagulant: {
      nom: 'Anticoagulant oral (AOD / AVK)',
      classe: 'Fluidifiant sanguin (cascade de coagulation)',
      mecanisme:
        'Empêche la formation de fibrine et de caillot dans l’oreillette gauche en fibrillation auriculaire (réduit le risque d’AVC d’environ 64 %).',
      reductionAVC_FA: 0.64,
      effetsIndesirables: 'Risque hémorragique (saignements digestifs, hématomes).',
    },
    antiagregant: {
      nom: 'Antiagrégant (aspirine faible dose)',
      classe: 'Bloque l’agrégation des plaquettes',
      mecanisme:
        'Limite la taille du caillot plaquettaire lors d’une rupture de plaque d’athérome (prévention secondaire coronaire/carotidienne).',
      reductionAVC_FA: 0.22,
      stenoseRuptureAvec: 65,
      effetsIndesirables: 'Irritation gastrique, saignements.',
    },
  },

  associations: {
    'amlo-peri': {
      nom: 'Amloperin® · Bithérapie (Amlodipine + Périndopril)',
      composants: ['ica', 'iec'],
      explication:
        'Bithérapie fixe : deux mécanismes complémentaires (antagoniste calcique + IEC). Les baisses de pression s’additionnent et le périndopril dilate aussi la veinule post-capillaire, ce qui atténue d’environ 55 % l’œdème des chevilles dû à l’amlodipine.',
      reductionOedeme: 0.55,
      presentations: [
        { id: '5-5', nom: '5 mg / 5 mg (standard)', doses: { ica: 1, iec: 1 } },
        { id: '10-5', nom: '10 mg / 5 mg', doses: { ica: 2, iec: 1 } },
        { id: '5-10', nom: '5 mg / 10 mg', doses: { ica: 1, iec: 2 } },
        { id: '10-10', nom: '10 mg / 10 mg (pleine dose)', doses: { ica: 2, iec: 2 } },
      ],
    },
    'peri-inda-amlo': {
      nom: 'Tensoplus® · Trithérapie (Périndopril + Indapamide + Amlodipine)',
      composants: ['iec', 'diuretique', 'ica'],
      explication:
        'Trithérapie fixe en un seul comprimé : IEC + diurétique apparenté thiazidique + inhibiteur calcique. Agit simultanément sur les résistances artériolaires, le système rénine-angiotensine et le sel/volume, tout en améliorant l’observance et en limitant l’œdème des chevilles.',
      reductionOedeme: 0.55,
      presentations: [
        { id: '5-1.25-5', nom: '5 / 1,25 / 5 mg', doses: { iec: 1, diuretique: 1, ica: 1 } },
        { id: '5-1.25-10', nom: '5 / 1,25 / 10 mg', doses: { iec: 1, diuretique: 1, ica: 2 } },
        { id: '10-2.5-5', nom: '10 / 2,5 / 5 mg', doses: { iec: 2, diuretique: 2, ica: 1 } },
        { id: '10-2.5-10', nom: '10 / 2,5 / 10 mg', doses: { iec: 2, diuretique: 2, ica: 2 } },
      ],
    },
  } satisfies Record<string, AssociationConfig>,

  actions: {
    stenose: {
      aortique: { surface: 0.75 },
      mitrale: { pressionOGPlus: 14, precharge: 0.82 },
      tricuspide: { pvcPlus: 8, precharge: 0.78 },
      pulmonaire: { pvcPlus: 7, precharge: 0.84 },
    },
    fuite: {
      aortique: { fraction: 0.42 },
      mitrale: { fraction: 0.45, pressionOGPlus: 12 },
      tricuspide: { pvcPlus: 8, precharge: 0.88 },
      pulmonaire: { pvcPlus: 3, precharge: 0.94 },
    },
  },

  atherome: {
    stenose: [0, 0, 5, 15, 35, 70, 95],
    etapes: [
      {
        titre: '0 · Artère saine',
        texte:
          'L’endothélium est intact et produit du monoxyde d’azote (NO) qui maintient la paroi détendue et empêche les plaquettes d’adhérer.',
      },
      {
        titre: '1 · Infiltration du LDL',
        texte:
          'Lorsque le LDL-cholestérol est élevé ou l’endothélium fragilisé (HTA, tabac, diabète), des particules de LDL traversent l’endothélium et s’accumulent dans l’intima.',
      },
      {
        titre: '2 · Oxydation du LDL',
        texte:
          'Piégé dans l’intima, le LDL s’oxyde. Ce LDL oxydé devient irritant : il déclenche un signal d’alerte inflammatoire sur les cellules endothéliales.',
      },
      {
        titre: '3 · Recrutement des monocytes',
        texte:
          'Attirés par l’inflammation, des globules blancs (monocytes) adhèrent à l’endothélium, s’infiltrent dans l’intima et se transforment en macrophages.',
      },
      {
        titre: '4 · Cellules spumeuses',
        texte:
          'Les macrophages absorbent sans limite le LDL oxydé et se gorgent de graisses : ce sont les cellules spumeuses, qui forment les premières stries lipidiques.',
      },
      {
        titre: '5 · Plaque constituée (cœur lipidique et chape fibreuse)',
        texte:
          'Un cœur lipidique nécrotique se forme sous une chape fibreuse. La lumière rétrécit (≈ 70 %) : le sang manque à l’effort (angor, claudication).',
      },
      {
        titre: '6 · Rupture de la chape et thrombose',
        texte:
          'Si la chape fibreuse est fine et fragile, elle se fissure : le sang entre en contact avec le cœur lipidique et forme un caillot (thrombus) qui obstrue l’artère.',
      },
    ],
  },

  curseurs: {
    fc: { min: 35, max: 180, pas: 1 },
    contractilite: { min: 0.3, max: 2.0, pas: 0.05 },
    volume: { min: 3.2, max: 6.5, pas: 0.1 },
    resistances: { min: 0.4, max: 2.0, pas: 0.05 },
    rigidite: { min: 0, max: 1, pas: 0.05 },
  },

  sons: {
    b1: { volume: 0.7 },
    b2: { volume: 0.6 },
    souffleRA: { frequence: 420, volume: 0.22 },
    souffleIM: { frequence: 520, volume: 0.2 },
    souffleIA: { frequence: 680, volume: 0.18 },
    roulementRM: { frequence: 140, volume: 0.25 },
  },
} as const;
