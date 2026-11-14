import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPresetToParams,
  compute,
  effetTraitements,
  freshP,
  setPlaqueStage,
  stenosePct,
} from './physiology';
import { beat, clkExtend, createClock, ecg, pressures, valves } from './clock';

test('sujet sain au repos produit ~120/80 mmHg, DC ~4.9 L/min, FE 60 %', () => {
  const p = freshP();
  const r = compute(p, { hvg: 0 });
  assert.ok(Math.abs(r.pas - 120) <= 2, `PAS attendue ~120, reçu ${r.pas}`);
  assert.ok(Math.abs(r.pad - 80) <= 2, `PAD attendue ~80, reçu ${r.pad}`);
  assert.ok(Math.abs(r.dc - 4.9) <= 0.15, `DC attendu ~4.9, reçu ${r.dc}`);
  assert.ok(Math.abs(r.fe - 0.6) <= 0.02, `FE attendue ~0.6, reçu ${r.fe}`);
  assert.equal(r.warns.length, 0);
});

test('HTA et double blocage IEC + ARA II déclenchent une alerte sans additionner la voie RAA', () => {
  const { params, d } = applyPresetToParams({ mal: ['hta'], trt: ['iec'] });
  const rIec = compute(params, d);
  params.trt.ara2 = true;
  const rDouble = compute(params, d);
  assert.ok(Math.abs(rIec.pas - rDouble.pas) < 0.1, 'IEC + ARA II ne doivent pas s’additionner');
  assert.ok(
    rDouble.warns.some((w) => w.includes('double blocage')),
    'Alerte double blocage attendue'
  );
});

test('bithérapie amlodipine + IEC additionne la baisse de PA et atténue l’œdème des chevilles', () => {
  const pSolo = applyPresetToParams({ mal: ['hta'], trt: ['ica'] }).params;
  const pAsso = applyPresetToParams({ mal: ['hta'], asso: 'amlo-peri' }).params;
  const rSolo = compute(pSolo, { hvg: 0 });
  const rAsso = compute(pAsso, { hvg: 0 });
  assert.ok(rAsso.pas < rSolo.pas - 5, 'La bithérapie doit baisser davantage la PAS');
  assert.ok(rAsso.oedemeICa < rSolo.oedemeICa, 'L’IEC doit atténuer l’œdème lié à l’amlodipine');
  const eff = effetTraitements(pAsso, { hvg: 0 }, rAsso);
  assert.equal(eff.each.length, 2);
});

test('bêtabloquant sur BAV complet ou RA serré sous vasodilatateur déclenche les alertes cliniques', () => {
  const bav = applyPresetToParams({ fail: 'nav', trt: ['betabloquant'] });
  const rBav = compute(bav.params, bav.d);
  assert.equal(rBav.rythme, 'bav3');
  assert.ok(rBav.warns.some((w) => w.includes('contre-indiqué')));

  const ra = applyPresetToParams({ mal: ['ra'], trt: ['ica'] });
  const rRa = compute(ra.params, ra.d);
  assert.ok(rRa.grad >= 40, `Gradient RA serré attendu >= 40, reçu ${rRa.grad}`);
  assert.ok(rRa.warns.some((w) => w.includes('Rétrécissement aortique serré')));
});

test('rupture de plaque étape 6 et retour à 0 nettoient fidèlement IDM, AVC et ischémie', () => {
  // Carotide : rupture -> AVC, retour à 0 -> AVC nettoyé
  const p0 = freshP();
  p0.site = 'carotide';
  const r6 = setPlaqueStage(p0, 6);
  assert.equal(r6.next.mal.avc, true);
  assert.ok(r6.triggeredEvent?.includes('AVC'));
  const rBack = setPlaqueStage(r6.next, 0);
  assert.equal(rBack.next.mal.avc, false);

  // Coronaire avec IDM préexistant : retour à 0 préserve l'IDM manuel
  const pManual = applyPresetToParams({ mal: ['idm'], site: 'coronaire', plaque: 5 }).params;
  const rStep6 = setPlaqueStage(pManual, 6);
  const rReset = setPlaqueStage(rStep6.next, 0);
  assert.equal(rReset.next.mal.idm, true);

  // Aspirine réduit la sténose thrombotique à l'étape 6
  const pAsp = applyPresetToParams({ plaque: 6, trt: ['antiagregant'] }).params;
  assert.ok(stenosePct(6, pAsp) < stenosePct(6, freshP()));
});

test('horloge cardiaque, valves, pressions de Wiggers et sus-décalage ST sur IDM', () => {
  const clk = createClock();
  const p = freshP();
  const d = { hvg: 0 };
  const r = compute(p, d);
  clkExtend(clk, r, 8);
  const b = beat(clk, r, 0.5);
  const vEj = valves(clk, r, (b.ej0 + b.ej1) / 2, b);
  assert.ok(vEj.aortique > 0.5 && vEj.mitrale < 0.2);

  const prEj = pressures(clk, r, (b.ej0 + b.ej1) / 2, b);
  assert.ok(prEj.lv >= prEj.ao - 0.1, 'En éjection, P(VG) >= P(Aorte)');

  const pIdm = applyPresetToParams({ mal: ['idm'] }).params;
  const rIdm = compute(pIdm, d);
  const tST = b.v.t + 0.14;
  assert.ok(ecg(clk, rIdm, d, tST) > ecg(clk, r, d, tST) + 0.1, 'Sus-décalage ST attendu');
});

test('trithérapie Tensoplus® 5/1.25/10 et 10/2.5/10 abaisse davantage la PA que la bithérapie Amloperin®', () => {
  const pBi = applyPresetToParams({ mal: ['hta'], asso: 'amlo-peri', pres: { 'amlo-peri': '5-5' } }).params;
  const pTri = applyPresetToParams({ mal: ['hta'], asso: 'peri-inda-amlo', pres: { 'peri-inda-amlo': '5-1.25-10' } }).params;
  const pTriMax = applyPresetToParams({ mal: ['hta'], asso: 'peri-inda-amlo', pres: { 'peri-inda-amlo': '10-2.5-10' } }).params;

  const rBi = compute(pBi, { hvg: 0.5 });
  const rTri = compute(pTri, { hvg: 0.5 });
  const rTriMax = compute(pTriMax, { hvg: 0.5 });

  assert.ok(rTri.pas < rBi.pas - 4, 'Tensoplus doit abaisser davantage la PAS qu’Amloperin 5/5');
  assert.ok(rTriMax.pas <= rTri.pas, 'Tensoplus 10/2.5/10 doit être au moins aussi puissant que 5/1.25/10');

  const eff = effetTraitements(pTriMax, { hvg: 0.5 }, rTriMax);
  assert.equal(eff.each.length, 3);
  assert.ok(eff.oedemeSoloICa > rTriMax.oedemeICa, 'L’IEC de Tensoplus doit réduire l’œdème lié à l’amlodipine');
});

test('ventricules affaiblis et valves obstruées reproduisent congestion, baisse de FE/DC et gradient', () => {
  const rBase = compute(freshP(), { hvg: 0 });
  const rVg = compute(applyPresetToParams({ act: { vg: 'faible' } }).params, { hvg: 0 });
  const rVd = compute(applyPresetToParams({ act: { vd: 'faible' } }).params, { hvg: 0 });
  const rRm = compute(applyPresetToParams({ act: { mitrale: 'stenose' } }).params, { hvg: 0 });

  assert.ok(rVg.fe < 0.4, `FE VG affaibli attendue < 40 %, reçu ${(rVg.fe * 100).toFixed(1)} %`);
  assert.ok(rVg.dc < rBase.dc - 1.0, 'Débit cardiaque doit chuter si VG affaibli');
  assert.ok(rVg.pog > rBase.pog + 8, 'Pression OG / poumons doit monter si VG affaibli');

  assert.ok(rVd.pvc > rBase.pvc + 7, 'PVC doit monter fortement si VD affaibli');
  assert.ok(rVd.dc < rBase.dc - 0.5, 'Moindre remplissage gauche quand VD affaibli');

  assert.ok(rRm.pog > rBase.pog + 5, 'Rétrécissement mitral doit faire monter POG');
});

