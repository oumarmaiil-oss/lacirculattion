import test from 'node:test';
import assert from 'node:assert/strict';
import { CLINICAL_CASES, projectTimelineState } from './clinicalCases';
import { applyPresetToParams } from './physiology';
import {
  getLesionMeta,
  getTreatmentProtocol,
  isProtocolApplied,
  mergeProtocolOnParams,
} from './protocols';
import { getStoryboardMoment, interpolateTimelineProjection } from './storyboard';

test('Dyslipidémie non traitée : départ sain T0 -> infiltration -> rupture -> détachement du caillot', () => {
  const { params, d } = applyPresetToParams({ mal: ['dyslipidemie'], site: 'carotide' });
  const p0 = projectTimelineState(params, d.hvg, null, 0, 'untreated');
  const p2 = projectTimelineState(params, d.hvg, null, 2, 'untreated');
  const p3 = projectTimelineState(params, d.hvg, null, 3, 'untreated');
  const p4 = projectTimelineState(params, d.hvg, null, 4, 'untreated');

  assert.equal(p0.params.plaque, 0, 'En mode libre sans traitement, T0 doit être sain (plaque 0)');
  assert.equal(p0.params.mal.dyslipidemie, false);
  assert.equal(p2.params.plaque, 4);
  assert.equal(p3.params.plaque, 6);
  assert.equal(p4.params.mal.avc, true, 'À 5 ans en carotide, le caillot détaché provoque un AVC');

  const m3 = getStoryboardMoment('libre', null, params, 'untreated', 3);
  const m4 = getStoryboardMoment('libre', null, params, 'untreated', 4);
  assert.equal(m3.focusTab, 'vaisseau');
  assert.equal(m3.embolDetached, false);
  assert.equal(m4.embolDetached, true);
});

test('HTA (ACHA) non traitée : départ normal -> Cœur (HVG) -> Rein -> Cerveau/3 organes', () => {
  const { params, d } = applyPresetToParams({ mal: ['hta'] });
  const p0 = projectTimelineState(params, d.hvg, null, 0, 'untreated');
  const p3 = projectTimelineState(params, d.hvg, null, 3, 'untreated');
  const p4 = projectTimelineState(params, d.hvg, null, 4, 'untreated');

  assert.equal(p0.params.mal.hta, false, 'À T0 en mode libre, aucune HTA active');
  assert.ok(p3.d.hvg > 0.5, 'Atteinte cardiaque (HVG) progressive');
  assert.equal(p4.params.mal.avc, true, 'Complication extrême HTA atteint le cerveau');

  const m2 = getStoryboardMoment('libre', null, params, 'untreated', 2);
  const m3 = getStoryboardMoment('libre', null, params, 'untreated', 3);
  const m4 = getStoryboardMoment('libre', null, params, 'untreated', 4);
  assert.equal(m2.focusTab, 'coeur');
  assert.equal(m3.focusTab, 'corps');
  assert.equal(m3.focusZone, 'rein');
  assert.equal(m4.focusTab, 'corps');
  assert.equal(m4.focusZone, 'hta-organes');
});

test('Dyslipidémie + Statine + Antiagrégant : lyse du caillot et chape consolidée jusqu’au maintien', () => {
  const c6 = CLINICAL_CASES.find((c) => c.id === 'idm-plaque')!;
  const { params, d } = applyPresetToParams({
    ...c6.preset,
    trt: ['statine', 'antiagregant', 'iec', 'betabloquant'],
  });
  const p0 = projectTimelineState(params, d.hvg, c6, 0, 'treated');
  const p4 = projectTimelineState(params, d.hvg, c6, 4, 'treated');
  assert.ok(p4.params.plaque < p0.params.plaque, 'La plaque doit régresser/se stabiliser sous statine');

  const m2 = getStoryboardMoment('cas', c6, params, 'treated', 2);
  const m4 = getStoryboardMoment('cas', c6, params, 'treated', 4);
  assert.ok(m2.treatmentHeal > 0.5);
  assert.equal(m4.treatmentHeal, 1);
  assert.equal(m4.embolDetached, false);
});

test('Généralisation : FA non traitée enchaîne état normal -> stase -> caillot -> embole -> AVC', () => {
  const c5 = CLINICAL_CASES.find((c) => c.id === 'fa-rapide')!;
  const { params } = applyPresetToParams(c5.preset);
  const m1 = getStoryboardMoment('cas', c5, params, 'untreated', 1);
  const m2 = getStoryboardMoment('cas', c5, params, 'untreated', 2);
  const m3 = getStoryboardMoment('cas', c5, params, 'untreated', 3);
  const m4 = getStoryboardMoment('cas', c5, params, 'untreated', 4);

  assert.equal(m1.focusZone, 'og');
  assert.equal(m2.focusZone, 'og');
  assert.equal(m3.embolDetached, true);
  assert.equal(m4.focusZone, 'cerveau');

  const { params: treatedP } = applyPresetToParams({ ...c5.preset, trt: ['anticoagulant', 'betabloquant'] });
  const tm3 = getStoryboardMoment('cas', c5, treatedP, 'treated', 3);
  assert.equal(tm3.embolDetached, false);
  assert.ok(tm3.treatmentHeal >= 0.85);
});

test('interpolateTimelineProjection interpole progressivement plaque, rigidité et HVG', () => {
  const c6 = CLINICAL_CASES.find((c) => c.id === 'idm-plaque')!;
  const { params, d } = applyPresetToParams({ ...c6.preset, trt: ['statine', 'antiagregant'] });
  const p0 = projectTimelineState(params, d.hvg, c6, 0, 'treated');
  const p4 = projectTimelineState(params, d.hvg, c6, 4, 'treated');
  const mid = interpolateTimelineProjection(p0, p4, 0.5);
  assert.ok(mid.params.plaque <= p0.params.plaque && mid.params.plaque >= p4.params.plaque);
  assert.ok(mid.d.hvg >= 0 && mid.d.hvg <= 1);
});

test('IDM : protocole thérapeutique ciblé 4 piliers et storyboard dédié', () => {
  const { params } = applyPresetToParams({ mal: ['idm'] });
  const proto = getTreatmentProtocol(params, 'libre', null);
  assert.ok(proto, 'Un protocole ciblé doit exister pour l’IDM');
  assert.equal(proto!.id, 'idm');
  assert.equal(proto!.classes.length, 4);
  assert.equal(isProtocolApplied(params, proto!), false);

  const merged = mergeProtocolOnParams(params, proto!.presetPatch);
  assert.equal(isProtocolApplied(merged, proto!), true);
  assert.equal(merged.mal.idm, true, 'La pathologie sous-jacente reste active');

  const mUntreated = getStoryboardMoment('libre', null, params, 'untreated', 2);
  const mTreated = getStoryboardMoment('libre', null, merged, 'treated', 4);
  assert.equal(mUntreated.focusTab, 'coeur');
  assert.equal(mTreated.treatmentHeal, 1);
});

test('getLesionMeta fournit un titre et une description pour chaque lésion cliquable', () => {
  const { params } = applyPresetToParams({ mal: ['fa'], plaque: 5 });
  assert.match(getLesionMeta('fa-clot', params).title, /Thrombus auriculaire/);
  assert.match(getLesionMeta('coro-iva', params).title, /IVA/);
  assert.match(getLesionMeta('vessel-plaque', params).title, /stade 5\/6/);
  assert.match(getLesionMeta('calc-aortique', params).title, /Valve aortique/);
});

