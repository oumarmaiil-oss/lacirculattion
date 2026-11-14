import React from 'react';
import {
  Activity,
  ArrowUpRight,
  Crosshair,
  Pill,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { getLesionMeta, getTreatmentProtocol } from '../engine/protocols';
import type { ClinicalCaseDef } from '../engine/clinicalCases';
import type {
  AppMode,
  ComponentId,
  SceneLesionId,
  SimParams,
  ValveId,
  VesselSiteId,
} from '../engine/types';

interface SceneLesionPopoverProps {
  lesionId: SceneLesionId;
  params: SimParams;
  appMode: AppMode;
  activeCase: ClinicalCaseDef | null;
  onClose: () => void;
  onApplyProtocol: () => void;
  onAnticoagulate: () => void;
  onTriggerFAEmbol: () => void;
  onRemoveFA: () => void;
  onClearOcclusion: (lesion: SceneLesionId) => void;
  onOpenVesselSite: (site: VesselSiteId) => void;
  onAdvancePlaque: () => void;
  onDissolvePlaque: () => void;
  onToggleEffort: () => void;
  onRepairValve: (valve: ValveId) => void;
  onOpenComponentModal: (cid: ComponentId) => void;
}

export const SceneLesionPopover: React.FC<SceneLesionPopoverProps> = ({
  lesionId,
  params,
  appMode,
  activeCase,
  onClose,
  onApplyProtocol,
  onAnticoagulate,
  onTriggerFAEmbol,
  onRemoveFA,
  onClearOcclusion,
  onOpenVesselSite,
  onAdvancePlaque,
  onDissolvePlaque,
  onToggleEffort,
  onRepairValve,
  onOpenComponentModal,
}) => {
  const meta = getLesionMeta(lesionId, params);
  const proto = getTreatmentProtocol(params, appMode, activeCase);

  const renderValveId = (id: SceneLesionId): ValveId | null => {
    if (id === 'calc-aortique') return 'aortique';
    if (id === 'calc-mitrale') return 'mitrale';
    if (id === 'calc-tricuspide') return 'tricuspide';
    if (id === 'calc-pulmonaire') return 'pulmonaire';
    return null;
  };

  const valveId = renderValveId(lesionId);

  return (
    <div
      role="dialog"
      aria-label={meta.title}
      className="absolute bottom-3 left-3 z-20 w-[min(350px,calc(100%-24px))] rounded-xl border border-amber-400/60 bg-[#090e1c]/95 p-3 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
            {meta.subtitle}
          </div>
          <div className="text-[13.5px] font-semibold text-[var(--txt)] leading-snug">
            {meta.title}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer les actions sur la lésion"
          className="rounded border border-[var(--line)] bg-[var(--card)] p-1 text-[var(--muted)] hover:text-[var(--txt)] shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--muted)]">
        {meta.description}
      </p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {lesionId === 'fa-clot' && (
          <>
            <button
              type="button"
              onClick={onAnticoagulate}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-400/60 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/30"
            >
              <ShieldCheck className="h-3 w-3" />
              <span>Anticoaguler (lyse)</span>
            </button>
            <button
              type="button"
              onClick={onTriggerFAEmbol}
              className="inline-flex items-center gap-1 rounded-md border border-red-400/60 bg-red-500/20 px-2.5 py-1 text-[11px] font-semibold text-red-100 hover:bg-red-500/30"
            >
              <Zap className="h-3 w-3" />
              <span>Simuler migration → AVC</span>
            </button>
            <button
              type="button"
              onClick={onRemoveFA}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--line2)] bg-[var(--card)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--txt)]"
            >
              <span>Retirer FA</span>
            </button>
          </>
        )}

        {(lesionId === 'coro-iva' || lesionId === 'coro-cx' || lesionId === 'coro-cd') && (
          <>
            {proto && (
              <button
                type="button"
                onClick={onApplyProtocol}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-400/60 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/30"
              >
                <Pill className="h-3 w-3" />
                <span>Protocole IDM (4 piliers)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onClearOcclusion(lesionId)}
              className="inline-flex items-center gap-1 rounded-md border border-sky-400/60 bg-sky-500/20 px-2.5 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/30"
            >
              <Sparkles className="h-3 w-3" />
              <span>Désobstruer l’artère</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenVesselSite('coronaire')}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--line2)] bg-[var(--card)] px-2.5 py-1 text-[11px] font-semibold text-[var(--txt)] hover:border-sky-400/60"
            >
              <Crosshair className="h-3 w-3" />
              <span>Voir en coupe</span>
            </button>
          </>
        )}

        {(lesionId === 'vessel-plaque' || lesionId === 'vessel-thrombus') && (
          <>
            {proto && (
              <button
                type="button"
                onClick={onApplyProtocol}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-400/60 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/30"
              >
                <Pill className="h-3 w-3" />
                <span>Statine + Antiagrégant</span>
              </button>
            )}
            {params.plaque < 6 && (
              <button
                type="button"
                onClick={onAdvancePlaque}
                className="inline-flex items-center gap-1 rounded-md border border-amber-400/60 bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/30"
              >
                <ArrowUpRight className="h-3 w-3" />
                <span>Stade suivant ({params.plaque + 1}/6)</span>
              </button>
            )}
            <button
              type="button"
              onClick={onDissolvePlaque}
              className="inline-flex items-center gap-1 rounded-md border border-sky-400/60 bg-sky-500/20 px-2.5 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/30"
            >
              <Sparkles className="h-3 w-3" />
              <span>Revenir à l’artère saine</span>
            </button>
          </>
        )}

        {(lesionId === 'pulm-emb' || lesionId === 'ivc-clot') && (
          <>
            <button
              type="button"
              onClick={onAnticoagulate}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-400/60 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/30"
            >
              <ShieldCheck className="h-3 w-3" />
              <span>Anticoaguler (AOD)</span>
            </button>
            <button
              type="button"
              onClick={() => onClearOcclusion(lesionId)}
              className="inline-flex items-center gap-1 rounded-md border border-sky-400/60 bg-sky-500/20 px-2.5 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/30"
            >
              <Sparkles className="h-3 w-3" />
              <span>Lever l’obstruction</span>
            </button>
          </>
        )}

        {(lesionId === 'avc-clot' || lesionId === 'leg-clot') && (
          <>
            {proto && (
              <button
                type="button"
                onClick={onApplyProtocol}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-400/60 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/30"
              >
                <Pill className="h-3 w-3" />
                <span>Appliquer prévention</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onClearOcclusion(lesionId)}
              className="inline-flex items-center gap-1 rounded-md border border-sky-400/60 bg-sky-500/20 px-2.5 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/30"
            >
              <Sparkles className="h-3 w-3" />
              <span>Reperfuser / lever caillot</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenVesselSite(lesionId === 'avc-clot' ? 'carotide' : 'jambe')}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--line2)] bg-[var(--card)] px-2.5 py-1 text-[11px] font-semibold text-[var(--txt)] hover:border-sky-400/60"
            >
              <Crosshair className="h-3 w-3" />
              <span>Voir l’artère en coupe</span>
            </button>
          </>
        )}

        {valveId && (
          <>
            <button
              type="button"
              onClick={onToggleEffort}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                params.effort
                  ? 'border-sky-400 bg-sky-500/25 text-sky-100'
                  : 'border-[var(--line2)] bg-[var(--card)] text-[var(--txt)] hover:border-sky-400/60'
              }`}
            >
              <Activity className="h-3 w-3" />
              <span>{params.effort ? 'Arrêter l’effort' : 'Tester à l’effort'}</span>
            </button>
            <button
              type="button"
              onClick={() => onRepairValve(valveId)}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-400/60 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/30"
            >
              <Sparkles className="h-3 w-3" />
              <span>Remplacement / réparation</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenComponentModal(valveId)}
              className="ml-auto rounded-md border border-sky-400/45 bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/25"
            >
              Fiche valve →
            </button>
          </>
        )}
      </div>
    </div>
  );
};
