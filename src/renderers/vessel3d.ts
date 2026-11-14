import * as THREE from 'three';
import { SITES } from '../data/medicalContent';
import { stenosePct } from '../engine/physiology';
import { pressures, type CardiacClockState } from '../engine/clock';
import { clamp } from '../engine/geometry2d';
import type { ComputedResult, SimParams, ViewLevel } from '../engine/types';
import {
  createTissueBumpTexture,
  make3D,
  makeTextSprite,
  type ThreeViewport,
} from './threeSetup';

export interface Vessel3DInstance {
  viewport: ThreeViewport;
  update: (
    clk: CardiacClockState,
    p: SimParams,
    r: ComputedResult,
    opts: { level: ViewLevel; showLabels: boolean; isLightParticles: boolean }
  ) => void;
  dispose: () => void;
}

export function createVessel3D(
  container: HTMLElement,
  onPickLayer?: (layer: string | null) => void
): Vessel3DInstance {
  const vp = make3D({
    container,
    camPos: [3.2, 2.2, 4.1],
    target: [0, 0, 0],
    onPick: onPickLayer,
  });

  const bump = createTissueBumpTexture();
  const len = 4.6;
  const arcStart = 0.55;
  const arcLen = 1.48 * Math.PI;

  const vesselGroup = new THREE.Group();
  vp.root.add(vesselGroup);

  const makeLayer = (
    rOut: number,
    rIn: number,
    col: number,
    rough: number,
    pickId: string
  ) => {
    const grp = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
      color: col,
      roughness: rough,
      metalness: 0.02,
      clearcoat: 0.18,
      bumpMap: bump,
      bumpScale: 0.015,
      side: THREE.DoubleSide,
    });
    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(rOut, rOut, len, 40, 1, true, arcStart, arcLen),
      mat
    );
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(rIn, rIn, len, 40, 1, true, arcStart, arcLen),
      mat
    );
    grp.add(outer, inner);

    // Cut wall faces at arcStart and arcStart + arcLen
    const capW = rOut - rIn;
    const capMid = (rOut + rIn) / 2;
    [arcStart, arcStart + arcLen].forEach((ang) => {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(capW, len, 0.02), mat);
      cap.position.set(Math.sin(ang) * capMid, 0, Math.cos(ang) * capMid);
      cap.rotation.y = ang + Math.PI / 2;
      grp.add(cap);
    });

    grp.rotation.z = Math.PI / 2;
    grp.userData.pickId = pickId;
    vp.pickTargets.push(grp);
    vesselGroup.add(grp);
    return { grp, mat };
  };

  const layerAdv = makeLayer(1.18, 1.08, 0x523b4e, 0.72, 'adventice');
  const layerMed = makeLayer(1.08, 0.88, 0x9f1239, 0.45, 'media');
  const layerInt = makeLayer(0.88, 0.81, 0xe11d48, 0.35, 'intima');
  const layerEndo = makeLayer(0.81, 0.78, 0x34d399, 0.25, 'endothelium');

  // Elastic lamellae rings inside media
  const lamellae: THREE.Mesh[] = [];
  const lamMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
  });
  for (let k = 0; k < 9; k++) {
    const r = 0.9 + (k / 8) * 0.15;
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, len * 0.96, 36, 1, true, arcStart + 0.04, arcLen - 0.08),
      lamMat
    );
    ring.rotation.z = Math.PI / 2;
    vesselGroup.add(ring);
    lamellae.push(ring);
  }

  // Stiffness calcification patches
  const calcGroup = new THREE.Group();
  const calcMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 });
  for (let i = 0; i < 6; i++) {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.16), calcMat);
    const a = arcStart + 0.4 + i * 0.55;
    patch.position.set(-1.3 + i * 0.52, Math.cos(a) * 0.96, Math.sin(a) * 0.96);
    calcGroup.add(patch);
  }
  vesselGroup.add(calcGroup);

  // Atherosclerotic plaque on inner floor
  const plaqueGroup = new THREE.Group();
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0xfacc15,
    roughness: 0.55,
    clearcoat: 0.15,
  });
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.68, 28, 20), coreMat);
  coreMesh.scale.set(1.5, 0.55, 0.92);
  coreMesh.position.set(0, -0.76, 0);
  coreMesh.userData.pickId = 'plaque';
  vp.pickTargets.push(coreMesh);

  const capMat = new THREE.MeshPhysicalMaterial({
    color: 0xfef3c7,
    roughness: 0.4,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const capMesh = new THREE.Mesh(new THREE.SphereGeometry(0.71, 28, 20), capMat);
  capMesh.scale.set(1.54, 0.58, 0.96);
  capMesh.position.set(0, -0.75, 0);

  // Plaque cellular particles (LDL, oxidized LDL, monocytes, foam cells)
  const cellGroup = new THREE.Group();
  const ldlMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 });
  const monoMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.4 });
  const foamMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.45 });
  const ldlCells: THREE.Mesh[] = [];
  const monoCells: THREE.Mesh[] = [];
  const foamCells: THREE.Mesh[] = [];

  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), ldlMat);
    m.position.set(-0.7 + (i % 6) * 0.28, -0.66 + (i % 2) * 0.08, -0.25 + (i % 3) * 0.22);
    cellGroup.add(m);
    ldlCells.push(m);
  }
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), monoMat);
    m.position.set(-0.55 + i * 0.22, -0.58, -0.18 + (i % 3) * 0.16);
    cellGroup.add(m);
    monoCells.push(m);
  }
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), foamMat);
    m.position.set(-0.6 + (i % 4) * 0.38, -0.62 + (i % 2) * 0.09, -0.18 + (i % 2) * 0.3);
    cellGroup.add(m);
    foamCells.push(m);
  }

  // Stage 6 thrombus
  const thrombusMat = new THREE.MeshPhysicalMaterial({
    color: 0x991b1b,
    roughness: 0.48,
    emissive: 0x450a0a,
    emissiveIntensity: 0.3,
  });
  const thrombus = new THREE.Mesh(new THREE.SphereGeometry(0.36, 22, 18), thrombusMat);
  thrombus.scale.set(1.35, 0.9, 1.05);
  thrombus.position.set(0.08, -0.22, 0);
  thrombus.userData.pickId = 'thrombus';
  vp.pickTargets.push(thrombus);

  plaqueGroup.add(coreMesh, capMesh, cellGroup, thrombus);
  vp.root.add(plaqueGroup);

  // Flowing RBCs & platelets in lumen
  const rbcGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.024, 14);
  const rbcMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 });
  const rbcs = Array.from({ length: 28 }, (_, i) => {
    const m = new THREE.Mesh(rbcGeo, rbcMat);
    m.rotation.set(i * 0.5, i * 0.7, Math.PI / 2);
    const yBase = -0.18 + ((i * 37) % 100) / 140;
    const zBase = -0.35 + ((i * 53) % 100) / 140;
    vp.root.add(m);
    return { m, x: -len / 2 + (i / 28) * len, yBase, zBase };
  });

  // NO endothelial diffusion particles
  const noMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.8 });
  const noGeo = new THREE.SphereGeometry(0.025, 8, 8);
  const noDots = Array.from({ length: 14 }, (_, i) => {
    const m = new THREE.Mesh(noGeo, noMat);
    m.position.set(-1.8 + (i / 13) * 3.6, 0.84, 0.25 * Math.sin(i));
    vp.root.add(m);
    return { m, phase: i / 14 };
  });

  // Labels
  const labels = [
    { sp: makeTextSprite('Adventice', '#cbd5e1'), pos: [-1.8, 1.38, 0] as [number, number, number], minLvl: 1 },
    { sp: makeTextSprite('Média', '#fda4af'), pos: [-0.9, 1.24, 0] as [number, number, number], minLvl: 1 },
    { sp: makeTextSprite('Endothélium (NO)', '#34d399'), pos: [0.3, 1.05, 0] as [number, number, number], minLvl: 1 },
    { sp: makeTextSprite('Plaque d’athérome', '#fde047'), pos: [0.1, -1.12, 0.68] as [number, number, number], minLvl: 1 },
  ];
  labels.forEach((l) => {
    l.sp.position.set(...l.pos);
    vp.labelsGroup.add(l.sp);
  });

  let lastT = 0;

  const update = (
    clk: CardiacClockState,
    p: SimParams,
    r: ComputedResult,
    opts: { level: ViewLevel; showLabels: boolean; isLightParticles: boolean }
  ) => {
    const t = clk.t;
    const dt = clamp(t - lastT, -0.1, 0.1);
    lastT = t;

    const pr = pressures(clk, r, t).ao;
    const dist = 1 + clamp((pr - 75) / 60, 0, 1.3) * 0.08 * (1 - 0.85 * r.rig);
    vesselGroup.scale.set(1, dist, dist);

    // Media thickness & endothelium color
    layerEndo.mat.color.setHex(r.dysEndo ? 0xfb923c : 0x34d399);
    const medScale = p.mal.hta ? 1.08 : 1;
    layerMed.grp.scale.set(1, medScale, medScale);

    // Elastic lamellae count & fragmentation
    const nLam = SITES[p.site].lam;
    lamellae.forEach((l, idx) => {
      l.visible = idx < nLam;
    });
    lamMat.opacity = r.rig > 0.55 ? 0.18 : 0.44;
    calcGroup.visible = r.rig > 0.55;

    // NO particles
    const noCount = Math.round(r.no * noDots.length);
    noDots.forEach((nd, i) => {
      nd.m.visible = i < noCount;
      if (nd.m.visible) {
        const ph = (t * 0.55 + nd.phase) % 1;
        nd.m.position.y = 0.78 + ph * 0.25;
      }
    });

    // Plaque stage geometry
    const st = p.plaque;
    plaqueGroup.visible = st > 0;
    if (st > 0) {
      const hScale =
        st === 1 ? 0.16 : st === 2 ? 0.28 : st === 3 ? 0.42 : st === 4 ? 0.68 : 1.04;
      coreMesh.scale.set(1.5, 0.55 * hScale, 0.92);
      capMesh.scale.set(1.54, 0.58 * hScale + (r.tr.statine ? 0.08 : 0), 0.96);
      capMat.color.setHex(r.tr.statine ? 0x34d399 : 0xfef3c7);
      capMat.opacity = r.tr.statine ? 0.5 : 0.36;

      ldlCells.forEach((m, i) => {
        m.visible = st >= 1 && i < (r.tr.statine ? 5 : 12);
      });
      monoCells.forEach((m) => {
        m.visible = st >= 3;
      });
      foamCells.forEach((m) => {
        m.visible = st >= 4;
      });
      thrombus.visible = st === 6;
      const tScale = r.tr.antiagregant ? 0.52 : 1;
      thrombus.scale.set(1.35 * tScale, 0.9 * tScale, 1.05 * tScale);
    }

    // Axial RBC flow with continuity acceleration over stenosis
    const sten = stenosePct(st, p) / 100;
    const flowBase = st === 6 ? (r.tr.antiagregant ? 0.55 : 0.16) : 1.65;
    const step = opts.isLightParticles ? 2 : 1;
    rbcs.forEach((rb, idx) => {
      if (idx % step !== 0) {
        rb.m.visible = false;
        return;
      }
      rb.m.visible = true;
      const inPlaque = st > 0 && Math.abs(rb.x) < 1.05 ? 1 - Math.abs(rb.x) / 1.05 : 0;
      const localSpeed = flowBase * (1 + inPlaque * sten * 1.6);
      rb.x += dt * localSpeed;
      if (rb.x > len / 2) rb.x -= len;
      if (rb.x < -len / 2) rb.x += len;
      const minY = -0.62 + inPlaque * (st >= 5 ? 0.72 : st * 0.11);
      rb.m.position.set(rb.x, Math.max(minY, rb.yBase), rb.zBase);
    });

    // Labels
    vp.labelsGroup.visible = opts.showLabels;
    if (opts.showLabels) {
      labels.forEach((l, i) => {
        if (i === 3) l.sp.visible = st > 0 && opts.level >= l.minLvl;
        else l.sp.visible = opts.level >= l.minLvl;
      });
    }

    if (clk.playing || vp.needRender) {
      vp.renderNow();
    }
  };

  return {
    viewport: vp,
    update,
    dispose: () => vp.dispose(),
  };
}
