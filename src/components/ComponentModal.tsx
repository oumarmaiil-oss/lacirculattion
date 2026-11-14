import React from 'react';
import { X } from 'lucide-react';
import {
  ACT_LBL,
  COMP,
  UNSURE_BADGE,
  actsFor,
  fxOf,
  nowHTML,
} from '../data/medicalContent';
import { actOf } from '../engine/physiology';
import type { CardiacClockState } from '../engine/clock';
import type {
  ActionType,
  ComponentId,
  ComputedResult,
  SimParams,
} from '../engine/types';

interface ComponentModalProps {
  id: ComponentId | null;
  clk: CardiacClockState;
  p: SimParams;
  r: ComputedResult;
  onClose: () => void;
  onSetAction: (id: ComponentId, action: ActionType | null) => void;
  onTogglePlay: () => void;
}

export const ComponentModal: React.FC<ComponentModalProps> = ({
  id,
  clk,
  p,
  r,
  onClose,
  onSetAction,
  onTogglePlay,
}) => {
  if (!id || !COMP[id]) return null;
  const meta = COMP[id];
  const cur = actOf(id, p);
  const avail = actsFor(id);
  const live = nowHTML(id, clk, p, r);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="comp-modal-title"
        className="w-full max-w-lg rounded-xl border border-[var(--line2)] bg-[var(--panel)] p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">
              {meta.k}
            </div>
            <h2 id="comp-modal-title" className="text-lg font-semibold text-[var(--txt)]">
              {meta.nom}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fiche"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line2)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--txt)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live state at current cycle instant */}
        <div className="mb-3 rounded-lg border border-sky-400/25 bg-sky-950/20 p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
              En ce moment · {live.phase}
            </span>
            <button
              type="button"
              onClick={onTogglePlay}
              className="rounded-md border border-[var(--line2)] bg-[var(--card)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--txt)] hover:border-sky-400"
            >
              {live.paused ? 'Reprendre' : 'Mettre en pause'}
            </button>
          </div>
          <p className="text-[13px] leading-relaxed text-[var(--txt)]">{live.what}</p>
          {live.vals.length > 0 && (
            <div className="mono mt-2 text-[12px] text-sky-200/90">
              {live.vals.join(' · ')}
            </div>
          )}
        </div>

        {/* Role */}
        <div className="mb-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Rôle physiologique
          </div>
          <p className="text-[13px] leading-relaxed text-[var(--txt)]">{meta.role}</p>
        </div>

        {/* Failure actions */}
        <div className="mb-3 flex flex-wrap gap-2">
          {avail.map((a) => {
            const active = cur === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => onSetAction(id, active ? null : a)}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
                  active
                    ? 'border-red-400/70 bg-red-500/20 text-red-100'
                    : 'border-[var(--line2)] bg-[var(--card)] text-[var(--txt)] hover:border-sky-400'
                }`}
              >
                {ACT_LBL[a]}
              </button>
            );
          })}
          {cur && (
            <button
              type="button"
              onClick={() => onSetAction(id, null)}
              className="rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-100 hover:bg-emerald-500/25"
            >
              Réparer (normal)
            </button>
          )}
        </div>

        {cur && (
          <div className="rounded-lg border border-red-400/35 bg-red-950/25 p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-red-300">
              Effet · {ACT_LBL[cur].toLowerCase()}
            </div>
            <p className="text-[13px] leading-relaxed text-red-100">
              {fxOf(id, cur)}
              {meta.unsure ? UNSURE_BADGE : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
