import React, { useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import {
  COMP,
  EX,
  MAL_TXT,
  SITES,
  SLIDERS,
} from '../data/medicalContent';
import {
  C,
  MAL_IDS,
  TRT_IDS,
  actOf,
  activeTrt,
  effetTraitements,
  stenosePct,
} from '../engine/physiology';
import { fmt } from '../engine/geometry2d';
import type {
  ActionType,
  AppMode,
  AssociationId,
  ComponentId,
  ComputedResult,
  DynamicState,
  MaladieId,
  SimParams,
  TabId,
  TraitementId,
  VesselSiteId,
  ViewLevel,
} from '../engine/types';

const COMP_GROUPS: { title: string; ids: ComponentId[] }[] = [
  { title: 'Cavités', ids: ['od', 'og', 'vd', 'vg'] },
  { title: 'Valves', ids: ['tricuspide', 'pulmonaire', 'mitrale', 'aortique'] },
  { title: 'Vaisseaux', ids: ['aorte', 'ap', 'vcaves', 'vpulm'] },
  { title: 'Coronaires', ids: ['iva', 'cx', 'cd'] },
  { title: 'Tissu nodal', ids: ['sinusal', 'nav', 'his'] },
];

const DOSE_BTNS = [
  { v: 0.5, lbl: '½ dose' },
  { v: 1, lbl: 'Standard' },
  { v: 2, lbl: '×2' },
];

const CORE_MED_IDS: TraitementId[] = [
  'statine',
  'iec',
  'betabloquant',
  'diuretique',
  'anticoagulant',
  'antiagregant',
];

interface ControlPanelProps {
  appMode: AppMode;
  pane: 'ex' | 'ctl';
  onChangePane: (p: 'ex' | 'ctl') => void;
  tab: TabId;
  level: ViewLevel;
  p: SimParams;
  d: DynamicState;
  r: ComputedResult;
  activeExId: string;
  onSelectExample: (id: string) => void;
  onUpdateSlider: (k: 'fc' | 'contract' | 'volume' | 'resist' | 'rigidite', val: number) => void;
  onToggleMaladie: (id: MaladieId) => void;
  onToggleTraitement: (id: TraitementId) => void;
  onSetDose: (id: TraitementId, dose: number) => void;
  onSelectAsso: (id: AssociationId | null) => void;
  onSelectPres: (asso: AssociationId, presId: string) => void;
  onTriggerEmbol: () => void;
  onSelectSite: (site: VesselSiteId) => void;
  onToggleDysEndo: () => void;
  onSetPlaque: (stage: number) => void;
  onPickComponent: (id: ComponentId) => void;
  onQuickAction: (id: ComponentId, action: ActionType | null) => void;
  onToggleExtraRythme: (mode: 'esv' | 'flutter') => void;
  onToggleEffort: () => void;
  onResetAll: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  appMode,
  pane,
  onChangePane,
  tab,
  level,
  p,
  d,
  r,
  activeExId,
  onSelectExample,
  onUpdateSlider,
  onToggleMaladie,
  onToggleTraitement,
  onSetDose,
  onSelectAsso,
  onSelectPres,
  onTriggerEmbol,
  onSelectSite,
  onToggleDysEndo,
  onSetPlaque,
  onPickComponent,
  onQuickAction,
  onToggleExtraRythme,
  onToggleEffort,
  onResetAll,
}) => {
  const [openSec, setOpenSec] = useState<'cibles' | 'params' | 'meds' | null>('meds');
  const [showSoloMeds, setShowSoloMeds] = useState(true);

  const visibleMeds = level === 1 ? CORE_MED_IDS : TRT_IDS;

  const examples = EX[tab];
  const { t: trActive, asso: activeAsso } = activeTrt(p);
  const trtActiveList = TRT_IDS.filter((k) => trActive[k]);
  const fxComp = trtActiveList.length > 0 ? effetTraitements(p, d, r) : null;

  const doseTrtIds = trtActiveList.filter(
    (k) =>
      'doses' in C.traitements[k] &&
      !(activeAsso && C.associations[activeAsso]?.composants.includes(k))
  );
  const sten = stenosePct(p.plaque, p);
  const activeMalCount = MAL_IDS.filter((m) => p.mal[m]).length;
  const activeActCount = (Object.keys(p.act) as ComponentId[]).filter((k) => p.act[k]).length + (p.fail ? 1 : 0);

  const toggleSec = (sec: 'cibles' | 'params' | 'meds') => {
    setOpenSec((cur) => (cur === sec ? null : sec));
  };

  return (
    <aside className="flex flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)] lg:max-h-[calc(100vh-118px)]">
      {/* Pane switch (desktop; mobile uses Scène / Exemples / Réglages bar above) */}
      {appMode === 'libre' ? (
        <div className="hidden lg:grid grid-cols-2 border-b border-[var(--line)] p-1.5 gap-1">
          <button
            type="button"
            onClick={() => onChangePane('ex')}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
              pane === 'ex'
                ? 'bg-[var(--card2)] text-[var(--accent)] border border-sky-400/35'
                : 'text-[var(--muted)] hover:text-[var(--txt)]'
            }`}
          >
            Exemples
          </button>
          <button
            type="button"
            onClick={() => onChangePane('ctl')}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
              pane === 'ctl'
                ? 'bg-[var(--card2)] text-[var(--accent)] border border-sky-400/35'
                : 'text-[var(--muted)] hover:text-[var(--txt)]'
            }`}
          >
            Réglages
            {(trtActiveList.length > 0 || activeMalCount > 0 || activeActCount > 0) && (
              <span className="mono ml-1.5 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-200">
                {trtActiveList.length + activeMalCount + activeActCount}
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className="hidden lg:flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
          <span className="text-[12px] font-semibold text-[var(--accent)]">
            Prescription & tolérance
          </span>
          {trtActiveList.length > 0 && (
            <span className="mono rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
              {trtActiveList.length} actif{trtActiveList.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-2.5 thin-scroll space-y-2.5">
        {appMode === 'libre' && pane === 'ex' ? (
          <div className="space-y-1.5">
            {examples.map((ex) => {
              const active = activeExId === ex.id;
              return (
                <React.Fragment key={ex.id}>
                  {ex.grp && (
                    <div className="pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dim)] first:pt-0">
                      {ex.grp}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectExample(ex.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      active
                        ? 'border-sky-400/60 bg-sky-950/35 text-[var(--txt)]'
                        : 'border-[var(--line)] bg-[var(--card)] text-[var(--txt)] hover:border-[var(--line2)]'
                    }`}
                  >
                    <div className="text-[12.5px] font-semibold leading-snug">{ex.t}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                      {ex.w}
                    </div>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <>
            {/* SECTION 1: Quick Pathologies & Targets (Exploration libre uniquement, pour éviter les doublons en mode Cas) */}
            {appMode === 'libre' ? (
              <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSec('cibles')}
                  className="flex w-full items-center justify-between px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--txt)]">
                      1 · Pathologies & cibles
                    </span>
                    {(activeMalCount > 0 || activeActCount > 0) && (
                      <span className="mono rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-200">
                        {activeMalCount + activeActCount}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--muted)] transition-transform ${
                      openSec === 'cibles' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {openSec === 'cibles' && (
                  <div className="border-t border-[var(--line)] p-2.5 space-y-3">
                    {/* Direct 1-click valve & ventricle shortcuts */}
                    <div>
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">
                        Valves & ventricules
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(
                          [
                            { id: 'aortique', act: 'stenose', lbl: 'V. aortique obstruée' },
                            { id: 'mitrale', act: 'stenose', lbl: 'V. mitrale obstruée' },
                            { id: 'vg', act: 'faible', lbl: 'VG affaibli' },
                            { id: 'vd', act: 'faible', lbl: 'VD affaibli' },
                          ] as { id: ComponentId; act: ActionType; lbl: string }[]
                        ).map((q) => {
                          const isOn = actOf(q.id, p) === q.act;
                          return (
                            <button
                              key={`${q.id}-${q.act}`}
                              type="button"
                              onClick={() => onQuickAction(q.id, isOn ? null : q.act)}
                              className={`rounded-md border px-2 py-1.5 text-[11px] font-semibold text-left transition ${
                                isOn
                                  ? 'border-amber-400/70 bg-amber-500/20 text-amber-100'
                                  : 'border-[var(--line)] bg-[var(--panel)] text-[var(--txt)] hover:border-sky-400/60'
                              }`}
                            >
                              {q.lbl}
                            </button>
                          );
                        })}
                      </div>
                      {level === 3 && (
                        <div className="mt-1.5 grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            onClick={() => onToggleExtraRythme('esv')}
                            className={`rounded-md border px-1.5 py-1 text-[10.5px] font-semibold transition ${
                              p.extraRythme === 'esv'
                                ? 'border-amber-400/70 bg-amber-500/20 text-amber-100'
                                : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--txt)]'
                            }`}
                          >
                            ESV
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleExtraRythme('flutter')}
                            className={`rounded-md border px-1.5 py-1 text-[10.5px] font-semibold transition ${
                              p.extraRythme === 'flutter'
                                ? 'border-amber-400/70 bg-amber-500/20 text-amber-100'
                                : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--txt)]'
                            }`}
                          >
                            Flutter
                          </button>
                          <button
                            type="button"
                            onClick={onToggleEffort}
                            className={`rounded-md border px-1.5 py-1 text-[10.5px] font-semibold transition ${
                              p.effort
                                ? 'border-sky-400/70 bg-sky-500/20 text-sky-100'
                                : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--txt)]'
                            }`}
                          >
                            {p.effort ? 'Effort ON' : 'Repos'}
                          </button>
                        </div>
                      )}
                    </div>

                  {/* Tab-specific */}
                  {tab === 'vaisseau' && (
                    <div className="space-y-2 pt-1 border-t border-[var(--line)]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">
                        Territoire & plaque ({fmt(sten)} %)
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {(Object.keys(SITES) as VesselSiteId[]).map((sid) => {
                          const active = p.site === sid;
                          const shortName = SITES[sid].nom.replace('Artère ', '');
                          const label = shortName.charAt(0).toUpperCase() + shortName.slice(1);
                          return (
                            <button
                              key={sid}
                              type="button"
                              onClick={() => onSelectSite(sid)}
                              className={`rounded border px-2 py-1 text-[11px] font-semibold transition ${
                                active
                                  ? 'border-sky-400/60 bg-sky-500/20 text-sky-200'
                                  : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--txt)]'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[var(--muted)]">Endothélium (NO)</span>
                        <button
                          type="button"
                          onClick={onToggleDysEndo}
                          className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${
                            p.dysEndo || r.dysEndo
                              ? 'border-orange-400/60 bg-orange-500/20 text-orange-200'
                              : 'border-[var(--line2)] bg-[var(--panel)] text-[var(--muted)]'
                          }`}
                        >
                          {r.dysEndo ? 'Altéré' : 'Intact'}
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {[0, 1, 2, 3, 4, 5, 6].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => onSetPlaque(st)}
                            className={`mono rounded border py-1 text-[11px] font-semibold ${
                              p.plaque === st
                                ? st === 6
                                  ? 'border-red-400 bg-red-500/25 text-red-100'
                                  : 'border-sky-400 bg-sky-500/25 text-sky-100'
                                : 'border-[var(--line)] bg-[var(--panel)] text-[var(--muted)]'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {tab === 'coeur' && level === 3 && (
                    <div className="space-y-1.5 pt-1 border-t border-[var(--line)]">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">
                        <span>Composants du cœur</span>
                        <span>Cliquer</span>
                      </div>
                      {COMP_GROUPS.map((g) => (
                        <div key={g.title} className="space-y-1">
                          <div className="text-[10px] text-[var(--dim)]">{g.title}</div>
                          <div className="flex flex-wrap gap-1">
                            {g.ids.map((cid) => {
                              const failed = !!actOf(cid, p);
                              return (
                                <button
                                  key={cid}
                                  type="button"
                                  onClick={() => onPickComponent(cid)}
                                  className={`rounded border px-2 py-0.5 text-[11px] font-medium transition ${
                                    failed
                                      ? 'border-red-400/70 bg-red-500/20 text-red-100'
                                      : 'border-[var(--line)] bg-[var(--panel)] text-[var(--txt)] hover:border-sky-400/60'
                                  }`}
                                >
                                  {COMP[cid].nom
                                    .replace('Artère ', '')
                                    .replace('Valve ', 'V. ')
                                    .replace('Nœud ', 'N. ')}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Compact pathologies list */}
                  <div className="space-y-1 pt-1 border-t border-[var(--line)]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">
                      Maladies simulées
                    </div>
                    {MAL_IDS.map((mid) => {
                      const active = p.mal[mid];
                      return (
                        <button
                          key={mid}
                          type="button"
                          onClick={() => onToggleMaladie(mid)}
                          className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition ${
                            active
                              ? 'border-red-400/65 bg-red-950/35 text-red-100'
                              : 'border-[var(--line)] bg-[var(--panel)] text-[var(--txt)] hover:border-[var(--line2)]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-[11.5px] font-semibold truncate">{C.maladies[mid].nom}</div>
                            {level >= 2 && (
                              <div className="text-[10.5px] text-[var(--muted)] truncate">{MAL_TXT[mid]}</div>
                            )}
                          </div>
                          <span
                            className={`mono shrink-0 text-[10px] font-bold ${
                              active ? 'text-red-300' : 'text-[var(--dim)]'
                            }`}
                          >
                            {active ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {p.mal.fa && tab === 'corps' && (
                    <button
                      type="button"
                      onClick={onTriggerEmbol}
                      className="w-full rounded-lg border border-amber-400/60 bg-amber-500/20 px-3 py-1.5 text-[11.5px] font-semibold text-amber-100 hover:bg-amber-500/30"
                    >
                      Le caillot de l’oreillette gauche part vers le cerveau →
                    </button>
                  )}
                </div>
              )}
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[11.5px] text-[var(--muted)]">
                Pathologie du patient verrouillée sur le cas sélectionné · Ajustez votre prescription ci-dessous.
              </div>
            )}

            {/* SECTION 2: 5 Physiology Sliders (Niveau 2 Comprendre & 3 Expert) */}
            {appMode === 'libre' && level >= 2 && (
              <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSec('params')}
                  className="flex w-full items-center justify-between px-3 py-2 text-left"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--txt)]">
                    2 · Paramètres physiologiques
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--muted)] transition-transform ${
                      openSec === 'params' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {openSec === 'params' && (
                  <div className="border-t border-[var(--line)] p-2.5 space-y-2">
                    {SLIDERS.map((s) => {
                      const cfg = C.curseurs[s.cfg];
                      const val = p[s.k];
                      return (
                        <div
                          key={s.k}
                          className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-2"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-[11.5px] font-semibold text-[var(--txt)]">{s.nom}</span>
                            <span className="mono shrink-0 whitespace-nowrap text-[11.5px] font-semibold text-[var(--accent)]">
                              {fmt(val, s.d)} {s.u}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              aria-label={`Diminuer ${s.nom}`}
                              onClick={() =>
                                onUpdateSlider(s.k, Math.max(cfg.min, +(val - cfg.pas).toFixed(3)))
                              }
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--line2)] bg-[var(--card)] text-xs font-bold text-[var(--muted)] hover:text-[var(--txt)]"
                            >
                              −
                            </button>
                            <input
                              type="range"
                              className="atelier-range"
                              aria-label={s.nom}
                              min={cfg.min}
                              max={cfg.max}
                              step={cfg.pas}
                              value={val}
                              onChange={(e) => onUpdateSlider(s.k, parseFloat(e.target.value))}
                            />
                            <button
                              type="button"
                              aria-label={`Augmenter ${s.nom}`}
                              onClick={() =>
                                onUpdateSlider(s.k, Math.min(cfg.max, +(val + cfg.pas).toFixed(3)))
                              }
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--line2)] bg-[var(--card)] text-xs font-bold text-[var(--muted)] hover:text-[var(--txt)]"
                            >
                              +
                            </button>
                          </div>
                          {level >= 2 && (
                            <p className="mt-1 text-[10.5px] leading-snug text-[var(--dim)]">{s.help}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 3: Medications — Amloperin®, Tensoplus® & Impact */}
            <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSec('meds')}
                className="flex w-full items-center justify-between px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--txt)]">
                    3 · Médicaments & associations
                  </span>
                  {trtActiveList.length > 0 && (
                    <span className="mono rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
                      {activeAsso === 'amlo-peri'
                        ? 'Amloperin®'
                        : activeAsso === 'peri-inda-amlo'
                          ? 'Tensoplus®'
                          : `${trtActiveList.length}`}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-[var(--muted)] transition-transform ${
                    openSec === 'meds' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openSec === 'meds' && (
                <div className="border-t border-[var(--line)] p-2.5 space-y-2.5">
                  {/* Fixed combinations first: Amloperin® & Tensoplus® */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/90">
                      Associations fixes (1 comprimé)
                    </div>
                    {(['amlo-peri', 'peri-inda-amlo'] as AssociationId[]).map((aid) => {
                      const A = C.associations[aid];
                      const active = activeAsso === aid;
                      const curPres = p.pres[aid] || A.presentations[0].id;
                      return (
                        <div
                          key={aid}
                          className={`rounded-lg border p-2 transition ${
                            active
                              ? 'border-emerald-400/65 bg-emerald-950/30'
                              : 'border-[var(--line)] bg-[var(--panel)]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectAsso(active ? null : aid)}
                            className="flex w-full items-center justify-between gap-2 text-left"
                          >
                            <div>
                              <div className="text-[12px] font-semibold text-[var(--txt)]">
                                {A.nom.split(' · ')[0]}
                              </div>
                              <div className="text-[10.5px] text-[var(--muted)]">
                                {A.nom.split(' · ')[1]}
                              </div>
                            </div>
                            <span
                              className={`mono shrink-0 text-[10.5px] font-bold ${
                                active ? 'text-emerald-300' : 'text-[var(--dim)]'
                              }`}
                            >
                              {active ? 'ACTIF' : 'OFF'}
                            </span>
                          </button>

                          {active && (
                            <div className="mt-2 space-y-1.5">
                              <div className="grid grid-cols-2 gap-1">
                                {A.presentations.map((pr) => (
                                  <button
                                    key={pr.id}
                                    type="button"
                                    onClick={() => onSelectPres(aid, pr.id)}
                                    className={`rounded border px-2 py-1 text-[10.5px] font-medium transition ${
                                      curPres === pr.id
                                        ? 'border-emerald-400 bg-emerald-500/25 text-emerald-100'
                                        : 'border-[var(--line)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--txt)]'
                                    }`}
                                  >
                                    {pr.nom}
                                  </button>
                                ))}
                              </div>
                              <p className="text-[10.5px] leading-snug text-emerald-100/80">
                                {A.explication}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Impact summary card whenever any treatment is active */}
                  {fxComp && level >= 2 && (
                    <div className="space-y-1.5 rounded-lg border border-emerald-400/35 bg-emerald-950/20 p-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-emerald-200">Impact mesuré</span>
                        <span className="mono font-semibold text-emerald-300">
                          {fmt(fxComp.baseline.pas)}/{fmt(fxComp.baseline.pad)} → {fmt(fxComp.all.pas)}/
                          {fmt(fxComp.all.pad)}
                        </span>
                      </div>
                      {fxComp.each.map((e) => {
                        const drop = Math.max(0, -e.dPas);
                        const pct = Math.min(100, (drop / 35) * 100);
                        return (
                          <div key={e.k} className="space-y-0.5">
                            <div className="flex justify-between text-[10.5px] text-[var(--muted)]">
                              <span>{C.traitements[e.k].nom.split(' (')[0]}</span>
                              <span className="mono text-emerald-300">
                                {fmt(e.dPas)} / {fmt(e.dPad)} mmHg
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--panel)]">
                              <div
                                className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {fxComp.oedemeSoloICa > 0.05 && r.raa > 0 && (
                        <div className="flex items-center justify-between pt-1 border-t border-emerald-400/20 text-[10.5px] text-sky-200">
                          <span>Œdème chevilles (IEC vs ICA seul)</span>
                          <span className="mono font-semibold">−55 %</span>
                        </div>
                      )}
                      {r.tr.statine && (
                        <div className="flex items-center justify-between text-[10.5px] text-amber-200">
                          <span>LDL-cholestérol</span>
                          <span className="mono font-semibold">
                            {fmt(fxComp.baseline.ldl, 2)} → {fmt(r.ldl, 2)} g/L
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Biologie & Tolérance live readout (Niveau 2+) */}
                  {level >= 2 && (
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">
                        Biologie & tolérance
                      </div>
                      <div className="mono flex items-center justify-between text-[11px]">
                        <span className="text-[var(--muted)]">Kaliémie (K⁺)</span>
                        <span
                          className={
                            r.bio.potassium > 5.2 || r.bio.potassium < 3.5
                              ? 'font-bold text-amber-300'
                              : 'text-[var(--txt)]'
                          }
                        >
                          {r.bio.potassium.toFixed(1)} mmol/L
                        </span>
                      </div>
                      <div className="mono flex items-center justify-between text-[11px]">
                        <span className="text-[var(--muted)]">Rein (DFG · Créat)</span>
                        <span className={r.bio.dfg < 55 ? 'font-bold text-amber-300' : 'text-[var(--txt)]'}>
                          {r.bio.dfg} mL/min · {r.bio.creatinine} µmol/L
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--muted)]">Toux sèche (IEC)</span>
                        <span className={r.bio.risqueToux ? 'text-amber-300' : 'text-emerald-300'}>
                          {r.bio.risqueToux ? 'Possible' : 'Non'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Collapsible solo classes so the panel stays uncluttered */}
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowSoloMeds((v) => !v)}
                      className="flex w-full items-center justify-between rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--txt)]"
                    >
                      <span>
                        {level === 1
                          ? `Traitements essentiels (${visibleMeds.length})`
                          : `Molécules individuelles (${visibleMeds.length})`}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          showSoloMeds ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {(showSoloMeds || (!activeAsso && trtActiveList.length > 0)) && (
                      <div className="mt-1.5 space-y-1">
                        {visibleMeds.map((tid) => {
                          const active = trActive[tid];
                          const tMeta = C.traitements[tid];
                          const fromAsso =
                            activeAsso && C.associations[activeAsso]?.composants.includes(tid);
                          return (
                            <button
                              key={tid}
                              type="button"
                              onClick={() => onToggleTraitement(tid)}
                              className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition ${
                                active
                                  ? 'border-emerald-400/60 bg-emerald-950/30 text-emerald-100'
                                  : 'border-[var(--line)] bg-[var(--panel)] text-[var(--txt)] hover:border-[var(--line2)]'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-[11.5px] font-semibold truncate">{tMeta.nom}</div>
                                {level >= 2 && (
                                  <div className="text-[10px] text-[var(--muted)] truncate">
                                    {tMeta.classe}
                                  </div>
                                )}
                              </div>
                              <span
                                className={`mono shrink-0 text-[10px] font-bold ${
                                  active ? 'text-emerald-300' : 'text-[var(--dim)]'
                                }`}
                              >
                                {fromAsso ? 'ASSO' : active ? 'ON' : 'OFF'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Individual Doses when applicable (Niveau 3 Expert) */}
                  {level === 3 && doseTrtIds.length > 0 && (
                    <div className="space-y-1.5 rounded-md border border-[var(--line)] bg-[var(--panel)] p-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">
                        Doses individuelles
                      </div>
                      {doseTrtIds.map((tid) => {
                        const tMeta = C.traitements[tid];
                        const dosesMap =
                          'doses' in tMeta ? (tMeta.doses as Record<number, string>) : {};
                        const curD = p.dose[tid] ?? 1;
                        const availableDoses = DOSE_BTNS.filter((b) => Boolean(dosesMap[b.v]));
                        return (
                          <div key={tid} className="space-y-1 pt-1 first:pt-0">
                            <div className="text-[11px] font-semibold text-[var(--txt)]">
                              {tMeta.nom.split(' (')[0]}
                            </div>
                            <div className="flex gap-1">
                              {availableDoses.map((b) => (
                                <button
                                  key={b.v}
                                  type="button"
                                  onClick={() => onSetDose(tid, b.v)}
                                  className={`flex-1 rounded border py-0.5 text-[10.5px] font-semibold ${
                                    curD === b.v
                                      ? 'border-emerald-400 bg-emerald-500/25 text-emerald-100'
                                      : 'border-[var(--line)] bg-[var(--card)] text-[var(--muted)]'
                                  }`}
                                >
                                  {b.lbl}
                                </button>
                              ))}
                            </div>
                            {dosesMap[curD] && (
                              <div className="text-[10px] text-[var(--dim)]">{dosesMap[curD]}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clinical warnings & notes */}
            {r.warns.map((w, idx) => (
              <div
                key={`w-${idx}`}
                className="rounded-lg border border-red-400/45 bg-red-950/35 p-2 text-[11.5px] leading-snug text-red-100"
              >
                {w}
              </div>
            ))}
            {r.notes.map((n, idx) => (
              <div
                key={`n-${idx}`}
                className="rounded-lg border border-sky-400/35 bg-sky-950/25 p-2 text-[11.5px] leading-snug text-sky-100"
              >
                {n}
              </div>
            ))}

            <button
              type="button"
              onClick={onResetAll}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--line2)] bg-[var(--card)] py-1.5 text-[11.5px] font-semibold text-[var(--muted)] hover:text-[var(--txt)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Tout remettre à la normale
            </button>
          </>
        )}
      </div>
    </aside>
  );
};
