import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLINICAL_CASES,
  evaluateCaseTreatment,
  projectTimelineState,
} from './clinicalCases';
import { applyPresetToParams, compute, freshP } from './physiology';
import { clkExtend, createClock, ecg, samplePVLoop } from './clock';

test('Effort augmente fortement le gradient RA et la POG sur VG affaibli', () => {
  const raRest = applyPresetToParams({ mal: ['ra'] });
  const rRaRest = compute(raRest.params, raRest.d);
  raRest.params.effort = true;
  const rRaEff = compute(raRest.params, raRest.d);
  assert.ok(rRaEff.grad > rRaRest.grad + 15, 'À l’effort le gradient ΔP du RA serré doit exploser');

  const vgRest = applyPresetToParams({ act: { vg: 'faible' }, volume: 5.7 });
  const rVgRest = compute(vgRest.params, vgRest.d);
  vgRest.params.effort = true;
  const rVgEff = compute(vgRest.params, vgRest.d);
  assert.ok(rVgEff.pog > rVgRest.pog, 'À l’effort sur VG affaibli la POG doit augmenter');
});

test('ARNI + IEC déclenche alerte contre-indication et iSGLT2 préserve K+ et DFG', () => {
  const comboDanger = applyPresetToParams({ mal: ['ic'], trt: ['arni', 'iec'] });
  const rDanger = compute(comboDanger.params, comboDanger.d);
  assert.ok(rDanger.warns.some((w) => w.includes('ARNI + IEC')));
  assert.ok(rDanger.bio.alertesBio.some((a) => a.includes('ARNI + IEC')));

  const isglt2Case = applyPresetToParams({ mal: ['ic'], trt: ['isglt2', 'diuretique'] });
  const rGlif = compute(isglt2Case.params, isglt2Case.d);
  assert.ok(rGlif.bio.potassium >= 3.5 && rGlif.bio.potassium <= 5.0);
});

test('Rythmes ESV/Flutter et boucle Pression–Volume génèrent des tracés cohérents', () => {
  const clk = createClock();
  const pEsv = applyPresetToParams({ extraRythme: 'esv' }).params;
  const rEsv = compute(pEsv, { hvg: 0 });
  clkExtend(clk, rEsv, 10);
  assert.ok(clk.vEv.some((v) => v.isEsv && v.wide), 'ESV prématurée large attendue');

  const clkFl = createClock();
  const pFl = applyPresetToParams({ extraRythme: 'flutter' }).params;
  const rFl = compute(pFl, { hvg: 0 });
  clkExtend(clkFl, rFl, 10);
  assert.ok(clkFl.aEv.some((a) => a.isFlutter), 'Ondes F de flutter attendues');
  assert.ok(Math.abs(ecg(clkFl, rFl, { hvg: 0 }, 0.2)) >= 0);

  const pv = samplePVLoop(clk, compute(freshP(), { hvg: 0 }));
  assert.ok(pv.pts.length >= 60);
  assert.ok(pv.vtd > pv.vts + 40, 'VTD doit être nettement supérieur à VTS');
  assert.ok(pv.pMax > 95, 'Pic de pression VG attendu > 95 mmHg');
});

test('Cas 1 (HTA & œdème) : Amlodipine 10 mg solo = Échec, bascule Amloperin® = Succès', () => {
  const c1 = CLINICAL_CASES.find((c) => c.id === 'hta-oedeme')!;
  const init = applyPresetToParams(c1.preset);
  const rInit = compute(init.params, init.d);
  const evFail = evaluateCaseTreatment(c1, init.params, init.d, rInit);
  assert.equal(evFail.verdict, 'echec');

  const solved = applyPresetToParams({ ...c1.preset, trt: [], asso: 'amlo-peri', pres: { 'amlo-peri': '5-10' } });
  const rSolved = compute(solved.params, solved.d);
  const evOk = evaluateCaseTreatment(c1, solved.params, solved.d, rSolved);
  assert.equal(evOk.verdict, 'succes');
  assert.equal(evOk.score, 100);
});

test('Cas 2 (HTA résistante) : Tensoplus® obtient le succès thérapeutique', () => {
  const c2 = CLINICAL_CASES.find((c) => c.id === 'hta-resistante')!;
  const solved = applyPresetToParams({
    ...c2.preset,
    asso: 'peri-inda-amlo',
    pres: { 'peri-inda-amlo': '10-2.5-10' },
  });
  const rSolved = compute(solved.params, solved.d);
  const ev = evaluateCaseTreatment(c2, solved.params, solved.d, rSolved);
  assert.equal(ev.verdict, 'succes');
});

test('Cas 3 (VG affaibli) : ARNI + IEC = Échec ; quadrithérapie moderne = Succès', () => {
  const c3 = CLINICAL_CASES.find((c) => c.id === 'ic-vg-faible')!;
  const trap = applyPresetToParams({ ...c3.preset, trt: ['arni', 'iec', 'diuretique', 'betabloquant'] });
  const evTrap = evaluateCaseTreatment(c3, trap.params, trap.d, compute(trap.params, trap.d));
  assert.equal(evTrap.verdict, 'echec');

  const quad = applyPresetToParams({
    ...c3.preset,
    trt: ['arni', 'betabloquant', 'diuretique', 'isglt2'],
    dose: { betabloquant: 0.5, arni: 1, diuretique: 1 },
  });
  const evOk = evaluateCaseTreatment(c3, quad.params, quad.d, compute(quad.params, quad.d));
  assert.equal(evOk.verdict, 'succes');
});

test('Cas 4 (RA serré) : vasodilatateur = Échec ; identification aortique sans vasodilatateur = Succès', () => {
  const c4 = CLINICAL_CASES.find((c) => c.id === 'ra-serre')!;
  const trap = applyPresetToParams({ ...c4.preset, trt: ['ica'] });
  const evTrap = evaluateCaseTreatment(c4, trap.params, trap.d, compute(trap.params, trap.d), 'aortique');
  assert.equal(evTrap.verdict, 'echec');

  const base = applyPresetToParams(c4.preset);
  const evOk = evaluateCaseTreatment(c4, base.params, base.d, compute(base.params, base.d), 'aortique');
  assert.equal(evOk.verdict, 'succes');
});

test('Timeline des conséquences projette aggravation non traitée et stabilisation traitée', () => {
  const c2 = CLINICAL_CASES.find((c) => c.id === 'hta-resistante')!;
  const solved = applyPresetToParams({
    ...c2.preset,
    asso: 'peri-inda-amlo',
    pres: { 'peri-inda-amlo': '10-2.5-10' },
  });
  const projUntreated5y = projectTimelineState(solved.params, solved.d.hvg, c2, 4, 'untreated');
  const projTreated5y = projectTimelineState(solved.params, solved.d.hvg, c2, 4, 'treated');
  assert.ok(projUntreated5y.d.hvg > projTreated5y.d.hvg + 0.3, 'HVG non traitée à 5 ans doit être nettement plus élevée');
  assert.equal(projUntreated5y.severite, 'crit');
  assert.equal(projTreated5y.severite, 'ok');

  const c5 = CLINICAL_CASES.find((c) => c.id === 'fa-rapide')!;
  const faBase = applyPresetToParams(c5.preset);
  const faUntreated5y = projectTimelineState(faBase.params, faBase.d.hvg, c5, 4, 'untreated');
  assert.equal(faUntreated5y.params.mal.avc, true, 'FA non anticoagulée à 5 ans expose à un AVC');
});
