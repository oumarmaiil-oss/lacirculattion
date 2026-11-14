import * as THREE from 'three';
import { DC_N, actOf } from '../engine/physiology';
import {
  atriumContraction,
  beat,
  lastBefore,
  pressures,
  valves,
  ventContraction,
  type CardiacClockState,
} from '../engine/clock';
import { clamp, lerp } from '../engine/geometry2d';
import type {
  ComponentId,
  ComputedResult,
  DynamicState,
  Heart3DMode,
  SimParams,
  ViewLevel,
} from '../engine/types';
import {
  createTissueBumpTexture,
  make3D,
  makeTextSprite,
  type ThreeViewport,
} from './threeSetup';

export interface Heart3DInstance {
  viewport: ThreeViewport;
  setMode: (mode: Heart3DMode) => void;
  setHover: (id: ComponentId | null) => void;
  update: (
    clk: CardiacClockState,
    p: SimParams,
    d: DynamicState,
    r: ComputedResult,
    opts: { level: ViewLevel; showLabels: boolean; isLightParticles: boolean }
  ) => void;
  dispose: () => void;
}

function makeTube(
  pts: [number, number, number][],
  r: number,
  mat: THREE.Material,
  tubular = 28,
  radial = 12
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, tubular, r, radial, false);
  return new THREE.Mesh(geo, mat);
}

export function createHeart3D(
  container: HTMLElement,
  onPick: (id: string | null) => void,
  onHover: (id: ComponentId | null, clientX: number, clientY: number) => void
): Heart3DInstance {
  const vp = make3D({
    container,
    camPos: [0.3, 0.25, 6.2],
    target: [0, 0.05, 0],
    onPick: (id) => onPick(id),
    onHover: (id, x, y) => onHover(id && id.startsWith('lesion:') ? null : (id as ComponentId | null), x, y),
  });

  const bump = createTissueBumpTexture();
  const clipArr = [vp.clipPlane];

  const matMyo = new THREE.MeshPhysicalMaterial({
    color: 0x9f1239,
    roughness: 0.42,
    metalness: 0.02,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    bumpMap: bump,
    bumpScale: 0.02,
    side: THREE.DoubleSide,
    clippingPlanes: [],
  });
  const matInnerLV = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    roughness: 0.52,
    side: THREE.DoubleSide,
  });
  const matInnerRV = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    roughness: 0.52,
    side: THREE.DoubleSide,
  });
  const matAorta = new THREE.MeshPhysicalMaterial({
    color: 0xe11d48,
    roughness: 0.36,
    clearcoat: 0.28,
    bumpMap: bump,
    bumpScale: 0.012,
    side: THREE.DoubleSide,
    clippingPlanes: [],
  });
  const matAP = new THREE.MeshPhysicalMaterial({
    color: 0x2563eb,
    roughness: 0.42,
    clearcoat: 0.22,
    side: THREE.DoubleSide,
    clippingPlanes: [],
  });
  const matVein = new THREE.MeshPhysicalMaterial({
    color: 0x1d4ed8,
    roughness: 0.46,
    clearcoat: 0.18,
  });
  const matPV = new THREE.MeshPhysicalMaterial({
    color: 0xdc2626,
    roughness: 0.42,
  });
  const matFat = new THREE.MeshStandardMaterial({
    color: 0x8f4754,
    roughness: 0.78,
    metalness: 0.0,
    transparent: true,
    opacity: 0.55,
  });
  const matCoro = {
    iva: new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.35 }),
    cx: new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.35 }),
    cd: new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.35 }),
  };
  const matValve = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.32,
    side: THREE.DoubleSide,
  });
  const matClot = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    emissive: 0xd97706,
    emissiveIntensity: 0.42,
    roughness: 0.45,
  });
  const matIschemia = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.72,
    transparent: true,
    opacity: 0.9,
  });

  const clickable: Record<string, THREE.Object3D> = {};
  const tag = <T extends THREE.Object3D>(obj: T, id: ComponentId): T => {
    obj.userData.pickId = id;
    vp.pickTargets.push(obj);
    clickable[id] = obj;
    return obj;
  };

  // Outer myocardium shell (cuttable)
  const shellGroup = new THREE.Group();
  const lvShell = new THREE.Mesh(new THREE.SphereGeometry(1.12, 36, 28), matMyo);
  lvShell.scale.set(0.84, 1.24, 0.82);
  lvShell.position.set(0.32, -0.34, 0);
  tag(lvShell, 'vg');
  shellGroup.add(lvShell);

  const rvShell = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 24), matMyo);
  rvShell.scale.set(0.78, 1.05, 0.76);
  rvShell.position.set(-0.46, -0.26, 0.16);
  tag(rvShell, 'vd');
  shellGroup.add(rvShell);

  const raShell = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 22), matVein);
  raShell.scale.set(0.88, 0.95, 0.82);
  raShell.position.set(-0.68, 0.65, 0.04);
  tag(raShell, 'od');
  shellGroup.add(raShell);

  const laShell = new THREE.Mesh(new THREE.SphereGeometry(0.6, 28, 22), matAorta);
  laShell.scale.set(0.92, 0.88, 0.84);
  laShell.position.set(0.56, 0.68, -0.14);
  tag(laShell, 'og');
  shellGroup.add(laShell);
  vp.root.add(shellGroup);

  // Inner chambers (visible in coupe/transparent)
  const innerGroup = new THREE.Group();
  const lvCavity = new THREE.Mesh(new THREE.SphereGeometry(0.8, 30, 22), matInnerLV);
  lvCavity.scale.set(0.76, 1.22, 0.72);
  lvCavity.position.set(0.34, -0.34, -0.02);
  tag(lvCavity, 'vg');
  innerGroup.add(lvCavity);

  const rvCavity = new THREE.Mesh(new THREE.SphereGeometry(0.68, 28, 20), matInnerRV);
  rvCavity.scale.set(0.72, 1.02, 0.68);
  rvCavity.position.set(-0.46, -0.26, 0.12);
  tag(rvCavity, 'vd');
  innerGroup.add(rvCavity);

  const septum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.09, 1.55, 16),
    matMyo
  );
  septum.position.set(-0.04, -0.32, 0);
  septum.rotation.z = 0.08;
  innerGroup.add(septum);

  // HVG inner wall thickening sleeve
  const hvgSleeve = new THREE.Mesh(
    new THREE.TorusGeometry(0.56, 0.12, 16, 32),
    matMyo
  );
  hvgSleeve.position.set(0.34, -0.32, -0.02);
  hvgSleeve.rotation.x = Math.PI / 2;
  hvgSleeve.visible = false;
  innerGroup.add(hvgSleeve);
  vp.root.add(innerGroup);

  // Epicardial fat sulci
  const fatSulcus = makeTube(
    [
      [-0.25, 0.35, 0.68],
      [-0.08, -0.15, 0.82],
      [0.08, -0.75, 0.72],
    ],
    0.075,
    matFat,
    18,
    8
  );
  vp.root.add(fatSulcus);

  // Great vessels
  const aoGroup = new THREE.Group();
  const aoMesh = makeTube(
    [
      [0.18, 0.25, 0.1],
      [0.24, 0.95, 0.14],
      [0.12, 1.55, 0.02],
      [-0.22, 1.65, -0.22],
      [-0.4, 1.15, -0.52],
      [-0.35, -0.65, -0.58],
    ],
    0.2,
    matAorta,
    40,
    16
  );
  aoGroup.add(aoMesh);
  const aoB1 = makeTube([[0.18, 1.55, 0.02], [0.28, 2.0, 0.08]], 0.07, matAorta, 10, 10);
  const aoB2 = makeTube([[-0.02, 1.66, -0.1], [-0.02, 2.06, -0.1]], 0.065, matAorta, 10, 10);
  const aoB3 = makeTube([[-0.2, 1.62, -0.2], [-0.34, 2.0, -0.26]], 0.065, matAorta, 10, 10);
  aoGroup.add(aoB1, aoB2, aoB3);
  tag(aoGroup, 'aorte');
  vp.root.add(aoGroup);

  const apGroup = new THREE.Group();
  const apTrunk = makeTube(
    [
      [-0.36, 0.28, 0.4],
      [-0.14, 0.98, 0.36],
      [0.02, 1.24, 0.14],
    ],
    0.17,
    matAP,
    22,
    14
  );
  const apLeft = makeTube(
    [
      [0.02, 1.24, 0.14],
      [0.58, 1.26, -0.02],
      [1.15, 1.18, -0.18],
    ],
    0.11,
    matAP,
    16,
    12
  );
  const apRight = makeTube(
    [
      [0.02, 1.24, 0.14],
      [-0.56, 1.2, -0.04],
      [-1.12, 1.12, -0.2],
    ],
    0.11,
    matAP,
    16,
    12
  );
  apGroup.add(apTrunk, apLeft, apRight);
  tag(apGroup, 'ap');
  vp.root.add(apGroup);

  const vcGroup = new THREE.Group();
  const vcs = makeTube(
    [
      [-0.78, 1.85, -0.04],
      [-0.72, 1.05, 0.0],
    ],
    0.14,
    matVein,
    16,
    12
  );
  const vci = makeTube(
    [
      [-0.78, -0.02, -0.2],
      [-0.84, -1.45, -0.24],
    ],
    0.15,
    matVein,
    16,
    12
  );
  vcGroup.add(vcs, vci);
  tag(vcGroup, 'vcaves');
  vp.root.add(vcGroup);

  const vpGroup = new THREE.Group();
  [
    [[1.38, 0.85, -0.25], [0.82, 0.78, -0.18]],
    [[1.38, 0.56, -0.3], [0.84, 0.6, -0.2]],
    [[0.48, 1.05, -0.68], [0.5, 0.82, -0.35]],
  ].forEach(([a, b]) => {
    vpGroup.add(
      makeTube(
        [a as [number, number, number], b as [number, number, number]],
        0.075,
        matPV,
        10,
        10
      )
    );
  });
  tag(vpGroup, 'vpulm');
  vp.root.add(vpGroup);

  // Coronary arteries on epicardial surface
  const ivaMesh = makeTube(
    [
      [0.14, 0.36, 0.68],
      [-0.02, -0.08, 0.88],
      [0.08, -0.65, 0.84],
      [0.24, -1.25, 0.58],
    ],
    0.038,
    matCoro.iva,
    24,
    8
  );
  tag(ivaMesh, 'iva');
  vp.root.add(ivaMesh);

  const cxMesh = makeTube(
    [
      [0.14, 0.36, 0.68],
      [0.64, 0.28, 0.62],
      [1.06, 0.08, 0.24],
      [1.04, -0.34, -0.26],
    ],
    0.035,
    matCoro.cx,
    24,
    8
  );
  tag(cxMesh, 'cx');
  vp.root.add(cxMesh);

  const cdMesh = makeTube(
    [
      [-0.04, 0.36, 0.74],
      [-0.64, 0.2, 0.66],
      [-0.98, -0.18, 0.34],
      [-0.78, -0.68, -0.12],
    ],
    0.035,
    matCoro.cd,
    24,
    8
  );
  tag(cdMesh, 'cd');
  vp.root.add(cdMesh);

  // Ischemia patch (IDM)
  const ischPatch = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), matIschemia);
  ischPatch.scale.set(0.95, 1.3, 0.45);
  ischPatch.position.set(0.24, -0.88, 0.7);
  ischPatch.visible = false;
  vp.root.add(ischPatch);

  // Animated 4 valves
  const makeAVValve = (pos: [number, number, number], id: ComponentId) => {
    const grp = new THREE.Group();
    grp.position.set(...pos);
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.18), matValve);
    l1.geometry.translate(0.12, 0, 0);
    l1.position.set(-0.22, 0, 0);
    const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.18), matValve);
    l2.geometry.translate(-0.12, 0, 0);
    l2.position.set(0.22, 0, 0);
    grp.add(l1, l2);
    tag(grp, id);
    vp.root.add(grp);
    return { grp, l1, l2 };
  };
  const vMitral = makeAVValve([0.48, 0.28, -0.02], 'mitrale');
  const vTricuspid = makeAVValve([-0.52, 0.24, 0.08], 'tricuspide');

  const makeSLValve = (pos: [number, number, number], id: ComponentId) => {
    const grp = new THREE.Group();
    grp.position.set(...pos);
    const leaflets: THREE.Mesh[] = [];
    for (let k = 0; k < 3; k++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (k * Math.PI * 2) / 3;
      const lf = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.12), matValve);
      lf.geometry.translate(-0.06, 0, 0);
      lf.position.set(0.13, 0, 0);
      pivot.add(lf);
      grp.add(pivot);
      leaflets.push(lf);
    }
    tag(grp, id);
    vp.root.add(grp);
    return { grp, leaflets };
  };
  const vAortic = makeSLValve([0.19, 0.36, 0.1], 'aortique');
  const vPulm = makeSLValve([-0.33, 0.38, 0.36], 'pulmonaire');

  // Nodal conduction system (electric cyan so never confused with yellow clots)
  const makeNode = (pos: [number, number, number], rad: number, id: ComponentId) => {
    const m = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x22d3ee,
      emissiveIntensity: 0.35,
      roughness: 0.32,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 12), m);
    mesh.position.set(...pos);
    tag(mesh, id);
    vp.root.add(mesh);
    return { mesh, mat: m };
  };
  const nSinusal = makeNode([-0.74, 0.96, 0.24], 0.075, 'sinusal');
  const nNav = makeNode([-0.04, 0.28, 0.22], 0.065, 'nav');
  const hisMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x0891b2,
    emissiveIntensity: 0.25,
    roughness: 0.4,
  });
  const hisGrp = new THREE.Group();
  hisGrp.add(
    makeTube(
      [
        [-0.04, 0.28, 0.22],
        [-0.04, -0.1, 0.16],
        [-0.36, -0.68, 0.16],
      ],
      0.02,
      hisMat,
      14,
      6
    ),
    makeTube(
      [
        [-0.04, -0.1, 0.16],
        [0.34, -0.78, 0.08],
      ],
      0.02,
      hisMat,
      12,
      6
    )
  );
  tag(hisGrp, 'his');
  vp.root.add(hisGrp);

  const tagLesion = <T extends THREE.Object3D>(obj: T, lesionId: string): T => {
    obj.userData.pickId = `lesion:${lesionId}`;
    vp.pickTargets.push(obj);
    return obj;
  };

  // Clot indicators (FA LAA, PE, IVC, coronary) - directly clickable when visible
  const clotFA = tagLesion(new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), matClot), 'fa-clot');
  clotFA.position.set(0.84, 0.8, 0.16);
  clotFA.visible = false;
  vp.root.add(clotFA);

  const clotPE = tagLesion(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), matClot), 'pulm-emb');
  clotPE.position.set(0.55, 1.24, -0.02);
  clotPE.visible = false;
  vp.root.add(clotPE);

  const clotIVC = tagLesion(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), matClot), 'ivc-clot');
  clotIVC.position.set(-0.82, -0.8, -0.22);
  clotIVC.visible = false;
  vp.root.add(clotIVC);

  const clotCoro = tagLesion(new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), matClot), 'coro-iva');
  clotCoro.visible = false;
  vp.root.add(clotCoro);

  // 3D Regurgitation jets (MR & AR)
  const jetIMMat = new THREE.MeshBasicMaterial({
    color: 0xf472b6,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const jetIM = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.65, 18, 1, true), jetIMMat);
  jetIM.position.set(0.52, 0.58, -0.08);
  jetIM.visible = false;
  vp.root.add(jetIM);

  const jetIAMat = new THREE.MeshBasicMaterial({
    color: 0xfb923c,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const jetIA = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.72, 18, 1, true), jetIAMat);
  jetIA.position.set(0.25, -0.05, 0.06);
  jetIA.rotation.z = Math.PI - 0.18;
  jetIA.visible = false;
  vp.root.add(jetIA);

  // 3D Calcification rings for stenotic valves & turbulent stenotic jets
  const matCalc = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xb45309,
    emissiveIntensity: 0.45,
    roughness: 0.38,
  });
  const makeCalcRing = (pos: [number, number, number], rad: number, lesionId: string) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.042, 10, 22), matCalc);
    ring.position.set(...pos);
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    tagLesion(ring, lesionId);
    vp.root.add(ring);
    return ring;
  };
  const calcAo = makeCalcRing([0.19, 0.36, 0.1], 0.17, 'calc-aortique');
  const calcMi = makeCalcRing([0.48, 0.28, -0.02], 0.24, 'calc-mitrale');
  const calcPu = makeCalcRing([-0.33, 0.38, 0.36], 0.15, 'calc-pulmonaire');
  const calcTr = makeCalcRing([-0.52, 0.24, 0.08], 0.23, 'calc-tricuspide');

  const jetStenMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const jetAoSten = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.78, 16, 1, true), jetStenMat);
  jetAoSten.position.set(0.21, 0.78, 0.12);
  jetAoSten.visible = false;
  vp.root.add(jetAoSten);

  const jetMiSten = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.62, 16, 1, true), jetStenMat);
  jetMiSten.position.set(0.46, -0.06, -0.02);
  jetMiSten.rotation.z = Math.PI;
  jetMiSten.visible = false;
  vp.root.add(jetMiSten);

  // 3D Blood flow particles along CatmullRomCurve3 including BOTH pulmonary branches
  const flowRoutes = [
    {
      pts: [[-0.78, 1.85, -0.04], [-0.7, 0.75, 0.04], [-0.52, 0.2, 0.1]],
      col: 0x60a5fa,
      n: 5,
    },
    {
      pts: [[-0.84, -1.45, -0.24], [-0.75, 0.2, -0.1], [-0.56, 0.35, 0.08]],
      col: 0x60a5fa,
      n: 5,
    },
    {
      pts: [[-0.48, -0.35, 0.12], [-0.36, 0.3, 0.38], [0.02, 1.24, 0.14], [1.12, 1.18, -0.18]],
      col: 0x60a5fa,
      n: 6,
    },
    {
      pts: [[0.02, 1.24, 0.14], [-0.56, 1.2, -0.04], [-1.1, 1.12, -0.2]],
      col: 0x60a5fa,
      n: 4,
    },
    {
      pts: [[1.35, 0.75, -0.25], [0.6, 0.65, -0.12], [0.46, 0.12, -0.02]],
      col: 0xf87171,
      n: 5,
    },
    {
      pts: [
        [0.36, -0.45, 0],
        [0.2, 0.45, 0.1],
        [0.12, 1.55, 0.02],
        [-0.22, 1.65, -0.22],
        [-0.38, 0.85, -0.52],
        [-0.35, -0.65, -0.58],
      ],
      col: 0xf87171,
      n: 9,
    },
  ];
  const particleGeo = new THREE.SphereGeometry(0.042, 8, 8);
  const routeObjs = flowRoutes.map((rt) => {
    const curve = new THREE.CatmullRomCurve3(rt.pts.map((pt) => new THREE.Vector3(...pt)));
    const mat = new THREE.MeshBasicMaterial({ color: rt.col });
    const meshes: THREE.Mesh[] = [];
    for (let i = 0; i < rt.n; i++) {
      const m = new THREE.Mesh(particleGeo, mat);
      vp.root.add(m);
      meshes.push(m);
    }
    return { curve, meshes, offset: 0 };
  });

  // 3D Sprite Labels positioned cleanly around anatomy
  const labelsMeta: { id: ComponentId; text: string; pos: [number, number, number]; minLvl: ViewLevel; col?: string }[] = [
    { id: 'aorte', text: 'Aorte', pos: [0.55, 1.88, 0.12], minLvl: 1, col: '#fda4af' },
    { id: 'ap', text: 'Artère pulm.', pos: [-1.18, 1.48, 0.06], minLvl: 1, col: '#93c5fd' },
    { id: 'od', text: 'OD', pos: [-1.32, 0.68, 0.14], minLvl: 1, col: '#bfdbfe' },
    { id: 'og', text: 'OG', pos: [1.34, 0.74, -0.06], minLvl: 1, col: '#fecaca' },
    { id: 'vd', text: 'VD', pos: [-1.22, -0.46, 0.36], minLvl: 1, col: '#bfdbfe' },
    { id: 'vg', text: 'VG', pos: [1.18, -0.72, 0.32], minLvl: 1, col: '#fecaca' },
    { id: 'iva', text: 'IVA', pos: [0.3, -1.36, 0.76], minLvl: 2, col: '#fda4af' },
    { id: 'mitrale', text: 'Mitrale', pos: [1.02, 0.24, 0.25], minLvl: 2, col: '#fde68a' },
    { id: 'aortique', text: 'V. aortique', pos: [0.16, 0.56, 0.56], minLvl: 2, col: '#fde68a' },
    { id: 'sinusal', text: 'N. sinusal', pos: [-1.34, 1.06, 0.28], minLvl: 2, col: '#67e8f9' },
    { id: 'nav', text: 'NAV', pos: [-0.04, 0.2, 0.56], minLvl: 3, col: '#67e8f9' },
  ];
  const labelSprites = labelsMeta.map((lm) => {
    const sp = makeTextSprite(lm.text, lm.col);
    sp.position.set(...lm.pos);
    vp.labelsGroup.add(sp);
    return { ...lm, sp };
  });

  let currentMode: Heart3DMode = 'coupe';
  let hoverId: ComponentId | null = null;
  let lastT = 0;

  const setMode = (mode: Heart3DMode) => {
    currentMode = mode;
    const isCoupe = mode === 'coupe';
    const isTransp = mode === 'transparent';

    vp.setClip(isCoupe);
    matMyo.clippingPlanes = isCoupe ? clipArr : [];
    matAorta.clippingPlanes = isCoupe ? clipArr : [];
    matAP.clippingPlanes = isCoupe ? clipArr : [];

    matMyo.transparent = isTransp;
    matMyo.opacity = isTransp ? 0.34 : 1;
    matMyo.depthWrite = !isTransp;

    matAorta.transparent = isTransp;
    matAorta.opacity = isTransp ? 0.42 : 1;
    matAP.transparent = isTransp;
    matAP.opacity = isTransp ? 0.42 : 1;

    innerGroup.visible = isCoupe || isTransp;
    vMitral.grp.visible = isCoupe || isTransp;
    vTricuspid.grp.visible = isCoupe || isTransp;
    vAortic.grp.visible = isCoupe || isTransp;
    vPulm.grp.visible = isCoupe || isTransp;
    nSinusal.mesh.visible = true;
    nNav.mesh.visible = isCoupe || isTransp;
    hisGrp.visible = isCoupe || isTransp;

    vp.needRender = true;
  };

  setMode('coupe');

  const setHover = (id: ComponentId | null) => {
    if (hoverId === id) return;
    hoverId = id;
    vp.needRender = true;
  };

  const update = (
    clk: CardiacClockState,
    p: SimParams,
    d: DynamicState,
    r: ComputedResult,
    opts: { level: ViewLevel; showLabels: boolean; isLightParticles: boolean }
  ) => {
    const t = clk.t;
    const dt = clamp(t - lastT, -0.1, 0.1);
    lastT = t;

    const b = beat(clk, r, t);
    const vc = ventContraction(clk, r, t, b);
    const ac = atriumContraction(clk, r, t, b);
    const va = valves(clk, r, t, b);
    const pr = pressures(clk, r, t, b);

    // Ventricular & atrial contraction deformations
    const vgWeak = actOf('vg', p) === 'faible' || p.mal.ic;
    const vdWeak = actOf('vd', p) === 'faible';
    const vcLv = vgWeak ? vc * 0.45 : vc;
    const vcRv = vdWeak ? vc * 0.45 : vc;
    const lvScale = 1 - 0.13 * vcLv;
    const rvScale = 1 - 0.13 * vcRv;
    const hvgIn = 1 - 0.12 * d.hvg;
    const dilVG = vgWeak ? 1.13 : r.contract < 0.7 ? 1.07 : 1;
    const dilVD = vdWeak || r.pulmEmb ? 1.13 : 1;

    lvShell.scale.set(0.84 * lvScale * dilVG, 1.24 * (1 - 0.08 * vcLv) * dilVG, 0.82 * lvScale * dilVG);
    lvCavity.scale.set(
      0.76 * lvScale * hvgIn * dilVG,
      1.22 * (1 - 0.08 * vcLv) * hvgIn * dilVG,
      0.72 * lvScale * hvgIn * dilVG
    );
    rvShell.scale.set(0.78 * rvScale * dilVD, 1.05 * (1 - 0.07 * vcRv) * dilVD, 0.76 * rvScale * dilVD);
    rvCavity.scale.set(0.72 * rvScale * dilVD, 1.02 * (1 - 0.07 * vcRv) * dilVD, 0.68 * rvScale * dilVD);

    // Stressed/hypoperfused tint when LV or RV weakened + upstream vessel congestion swelling
    matMyo.color.setHex(vgWeak || vdWeak ? 0x7c2d3e : 0x9f1239);
    const vpSw = r.congestion > 0.25 ? 1 + clamp(r.congestion * 0.14, 0, 0.22) : 1;
    vpGroup.scale.set(vpSw, vpSw, vpSw);
    matPV.color.setHex(r.congestion > 0.35 ? 0xf97316 : 0xdc2626);
    const vcSw = r.pvc > 7 ? 1 + clamp((r.pvc - 7) * 0.025, 0, 0.22) : 1;
    vcGroup.scale.set(vcSw, 1, vcSw);

    const aScale = 1 - 0.08 * ac + (r.atriaOK ? 0 : 0.02 * Math.sin(t * 24));
    const raDil = actOf('tricuspide', p) === 'stenose' || r.pvc > 10 ? 1.1 : 1;
    raShell.scale.set(0.88 * aScale * raDil, 0.95 * aScale * raDil, 0.82 * aScale * raDil);
    const laDil = actOf('mitrale', p) === 'stenose' || r.rf > 0 ? 1.14 : 1;
    laShell.scale.set(0.92 * aScale * laDil, 0.88 * aScale * laDil, 0.84 * aScale * laDil);

    // HVG inner sleeve
    hvgSleeve.visible = d.hvg > 0.2 && currentMode !== 'exterieur';
    hvgSleeve.scale.setScalar(1 + 0.15 * d.hvg);

    // Aorta pulsatile expansion (attenuated by stiffness)
    const aoExp = 1 + (1 - 0.8 * r.rig) * clamp((pr.ao - 75) / 60, 0, 1) * 0.055;
    aoGroup.scale.set(aoExp, 1, aoExp);

    // Hover highlight tint
    matMyo.emissive.setHex(hoverId === 'vg' || hoverId === 'vd' ? 0x334155 : 0x000000);

    // Ischemia & coronaries
    (['iva', 'cx', 'cd'] as const).forEach((k) => {
      const blocked = r.zoneIDM === k || actOf(k, p) === 'bouche';
      matCoro[k].color.setHex(blocked ? 0x64748b : hoverId === k ? 0x38bdf8 : 0xf43f5e);
    });
    if (r.zoneIDM) {
      ischPatch.visible = true;
      if (r.zoneIDM === 'iva') ischPatch.position.set(0.24, -0.88, 0.7);
      else if (r.zoneIDM === 'cx') ischPatch.position.set(0.86, -0.25, 0.36);
      else ischPatch.position.set(-0.62, -0.5, 0.45);
      clotCoro.visible = true;
      clotCoro.userData.pickId = `lesion:coro-${r.zoneIDM}`;
      if (r.zoneIDM === 'iva') clotCoro.position.set(0.02, -0.06, 0.88);
      else if (r.zoneIDM === 'cx') clotCoro.position.set(0.64, 0.28, 0.62);
      else clotCoro.position.set(-0.64, 0.2, 0.66);
    } else {
      ischPatch.visible = false;
      clotCoro.visible = false;
    }

    // Clots (hidden completely when anticoagulated or absent)
    clotFA.visible = p.mal.fa && !r.tr.anticoagulant;
    clotPE.visible = r.pulmEmb;
    clotIVC.visible = r.ivcBlock;

    // Valve leaflet angles & calcification rings
    const aoSten = r.surfAo < 1.5 || actOf('aortique', p) === 'stenose';
    const miSten = actOf('mitrale', p) === 'stenose';
    const puSten = actOf('pulmonaire', p) === 'stenose';
    const trSten = actOf('tricuspide', p) === 'stenose';

    calcAo.visible = aoSten && currentMode !== 'exterieur';
    calcMi.visible = miSten && currentMode !== 'exterieur';
    calcPu.visible = puSten && currentMode !== 'exterieur';
    calcTr.visible = trSten && currentMode !== 'exterieur';

    const mo = miSten ? 0.14 : va.mitrale;
    vMitral.l1.rotation.z = -lerp(0.05, 1.05, mo);
    vMitral.l2.rotation.z = lerp(0.05, 1.05, r.rf > 0 ? Math.max(mo, 0.42) : mo);

    const to = trSten ? 0.14 : va.tricuspide;
    vTricuspid.l1.rotation.z = -lerp(0.05, 1.05, to);
    vTricuspid.l2.rotation.z = lerp(0.05, 1.05, actOf('tricuspide', p) === 'fuite' ? Math.max(to, 0.42) : to);

    const ao = aoSten ? va.aortique * 0.22 : va.aortique;
    vAortic.leaflets.forEach((lf, idx) => {
      lf.rotation.z = lerp(0.15, 1.05, idx === 0 && r.rfAo > 0 ? Math.max(ao, 0.42) : ao);
    });
    const po = puSten ? 0.14 : va.pulmonaire;
    vPulm.leaflets.forEach((lf) => {
      lf.rotation.z = lerp(0.15, 1.05, po);
    });

    // Turbulent stenotic 3D jets
    const showAoSten = aoSten && t >= b.ej0 && t < b.ej1 && currentMode !== 'exterieur';
    jetAoSten.visible = showAoSten;
    if (showAoSten) {
      const pulse = 0.88 + 0.18 * Math.sin(t * 32);
      jetAoSten.scale.set(pulse, 1, pulse);
    }
    const showMiSten = miSten && (t < b.sys || t >= b.ivr) && currentMode !== 'exterieur';
    jetMiSten.visible = showMiSten;
    if (showMiSten) {
      const pulse = 0.88 + 0.18 * Math.sin(t * 26);
      jetMiSten.scale.set(pulse, 1, pulse);
    }

    // Regurgitant 3D jets (IM & IA)
    const showIM = r.rf > 0 && t >= b.sys && t < b.ivr && currentMode !== 'exterieur';
    jetIM.visible = showIM;
    if (showIM) {
      const pulse = 0.85 + 0.18 * Math.sin(t * 28);
      jetIM.scale.set(pulse, 1, pulse);
    }
    const showIA = r.rfAo > 0 && t >= b.ej1 && currentMode !== 'exterieur';
    jetIA.visible = showIA;
    if (showIA) {
      const pulse = 0.85 + 0.18 * Math.sin(t * 24);
      jetIA.scale.set(pulse, 1, pulse);
    }

    // Nodal activation glow (cyan in L2/L3; hidden in Découvrir L1 unless blocked)
    const ia = lastBefore(clk.aEv, t);
    const laEv = ia >= 0 ? clk.aEv[ia] : null;
    const iv = lastBefore(clk.vEv, t);
    const lvEv = iv >= 0 ? clk.vEv[iv] : null;
    const pAge = laEv ? t - laEv.t : 9;
    const vAge = lvEv ? t - lvEv.t : 9;

    const nsBl = !!actOf('sinusal', p);
    const navBl = !!actOf('nav', p);
    const hisBl = !!actOf('his', p);

    nSinusal.mesh.visible = opts.level >= 2 || nsBl;
    nNav.mesh.visible = currentMode !== 'exterieur' && (opts.level >= 2 || navBl);
    hisGrp.visible = currentMode !== 'exterieur' && (opts.level >= 2 || hisBl);

    nSinusal.mat.color.setHex(nsBl ? 0x64748b : 0x06b6d4);
    nSinusal.mat.emissive.setHex(nsBl ? 0xef4444 : 0x22d3ee);
    nSinusal.mat.emissiveIntensity = nsBl ? 0.6 : r.rythme === 'sinus' && pAge < 0.14 ? 1.8 : 0.25;
    nNav.mat.color.setHex(navBl ? 0x64748b : 0x06b6d4);
    nNav.mat.emissive.setHex(navBl ? 0xef4444 : 0x22d3ee);
    nNav.mat.emissiveIntensity = navBl ? 0.6 : pAge >= 0.06 && pAge < 0.18 ? 1.8 : 0.25;
    hisMat.color.setHex(hisBl ? 0x64748b : 0x22d3ee);
    hisMat.emissive.setHex(hisBl ? 0xef4444 : 0x0891b2);
    hisMat.emissiveIntensity = hisBl ? 0.5 : vAge < 0.14 ? 1.5 : 0.2;

    // Blood particles along 3D CatmullRom curves
    const spd = 0.42 * clamp(r.dc / DC_N, 0.22, 2.4);
    routeObjs.forEach((ro, idx) => {
      const blocked = (idx <= 1 && r.ivcBlock) || ((idx === 2 || idx === 3) && r.pulmEmb);
      ro.offset = (((ro.offset + dt * (blocked ? 0 : spd)) % 1) + 1) % 1;
      const step = opts.isLightParticles ? 2 : 1;
      ro.meshes.forEach((m, mi) => {
        if (mi % step !== 0) {
          m.visible = false;
          return;
        }
        m.visible = true;
        const u = (ro.offset + mi / ro.meshes.length) % 1;
        ro.curve.getPointAt(u, m.position);
      });
    });

    // Labels visibility
    vp.labelsGroup.visible = opts.showLabels;
    if (opts.showLabels) {
      labelSprites.forEach((ls) => {
        ls.sp.visible = opts.level >= ls.minLvl;
      });
    }

    if (clk.playing || vp.needRender) {
      vp.renderNow();
    }
  };

  return {
    viewport: vp,
    setMode,
    setHover,
    update,
    dispose: () => vp.dispose(),
  };
}
