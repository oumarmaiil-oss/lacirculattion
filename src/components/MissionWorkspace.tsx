import React from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Crosshair,
  EyeOff,
  Film,
  HelpCircle,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Square,
  Stethoscope,
  XCircle,
} from 'lucide-react';
import type {
  CaseEvaluation,
  ClinicalCaseDef,
  TimelineProjection,
} from '../engine/clinicalCases';
import { TIMELINE_LABELS } from '../engine/clinicalCases';
import type { StoryboardMoment } from '../engine/storyboard';
import type {
  ComputedResult,
  TimelineBranch,
  TimelineHorizon,
  ValveId,
} from '../engine/types';

interface MissionBriefProps {
  cases: ClinicalCaseDef[];
  activeCase: ClinicalCaseDef;
  onSelectCase: (id: string) => void;
  computed: ComputedResult;
  evaluation: CaseEvaluation | null;
  showEvaluation: boolean;
  onValidate: () => void;
  hintIndex: number;
  onNextHint: () => void;
  auscultBlind: boolean;
  auscultGuess: ValveId | null;
  onToggleAuscultBlind: () => void;
  onGuessValve: (v: ValveId) => void;
  onToggleSound: () => void;
  soundEnabled: boolean;
}

const VALVE_CHOICES: { id: ValveId; lbl: string }[] = [
  { id: 'aortique', lbl: 'Aortique' },
  { id: 'mitrale', lbl: 'Mitrale' },
  { id: 'tricuspide', lbl: 'Tricuspide' },
  { id: 'pulmonaire', lbl: 'Pulmonaire' },
];

export const MissionBriefCard: React.FC<MissionBriefProps> = ({
  cases,
  activeCase,
  onSelectCase,
  computed,
  evaluation,
  showEvaluation,
  onValidate,
  hintIndex,
  onNextHint,
  auscultBlind,
  auscultGuess,
  onToggleAuscultBlind,
  onGuessValve,
  onToggleSound,
  soundEnabled,
}) => {
  const { bio } = computed;
  const kWarn = bio.potassium > 5.2 || bio.potassium < 3.5;
  const dfgWarn = bio.dfg < 55;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 space-y-2.5">
      {/* Wrapped compact 7-case selector so every case is visible without horizontal clipping */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Cas cliniques">
        {cases.map((c) => {
          const active = c.id === activeCase.id;
          const shortTitle = c.titre.split(' (')[0].replace(/ sous .*| & congestion.*| & risque.*| & surcharge.*| & plaque.*/i, '');
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              title={c.titre}
              onClick={() => onSelectCase(c.id)}
              className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                active
                  ? 'border-sky-400/70 bg-sky-500/20 text-[var(--txt)]'
                  : 'border-[var(--line)] bg-[var(--card)] text-[var(--muted)] hover:border-[var(--line2)] hover:text-[var(--txt)]'
              }`}
            >
              {shortTitle}
            </button>
          );
        })}
      </div>

      {/* Patient brief + Biology + Primary Validate CTA */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--muted)]">
            <span className="font-semibold text-sky-300">{activeCase.patient}</span>
            <span aria-hidden="true">·</span>
            <span className="mono tabular-nums">
              K⁺{' '}
              <strong className={kWarn ? 'text-amber-300' : 'text-[var(--txt)]'}>
                {bio.potassium.toFixed(1)}
              </strong>{' '}
              mmol/L
            </span>
            <span aria-hidden="true">·</span>
            <span className="mono tabular-nums">
              DFG{' '}
              <strong className={dfgWarn ? 'text-amber-300' : 'text-[var(--txt)]'}>
                {bio.dfg}
              </strong>{' '}
              mL/min
            </span>
            <span aria-hidden="true">·</span>
            <span className="mono tabular-nums">
              {bio.observanceComprimes} comprimé{bio.observanceComprimes > 1 ? 's' : ''}/j
            </span>
          </div>

          <p className="text-[12.5px] leading-snug text-[var(--txt)]">{activeCase.motif}</p>
          <p className="text-[12px] leading-snug text-emerald-200/90">
            <span className="font-semibold">Objectif : </span>
            {activeCase.objectif}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleAuscultBlind}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold whitespace-nowrap transition ${
              auscultBlind
                ? 'border-amber-400/70 bg-amber-500/20 text-amber-100'
                : 'border-[var(--line2)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--txt)]'
            }`}
          >
            {auscultBlind ? <EyeOff className="h-3.5 w-3.5" /> : <Stethoscope className="h-3.5 w-3.5" />}
            <span>Défi auscultation</span>
          </button>

          <button
            type="button"
            onClick={onNextHint}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--line2)] bg-[var(--card)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--muted)] hover:text-[var(--txt)] whitespace-nowrap"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Indice</span>
          </button>

          <button
            type="button"
            onClick={onValidate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-bold text-slate-950 hover:bg-sky-300 transition whitespace-nowrap"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Valider le traitement</span>
          </button>
        </div>
      </div>

      {/* Progressive Hint */}
      {hintIndex > 0 && (
        <div className="rounded-lg border border-sky-400/35 bg-sky-950/25 px-3 py-2 text-[12px] text-sky-100">
          <span className="font-semibold text-sky-300">Indice {hintIndex} : </span>
          {activeCase.indices[(hintIndex - 1) % activeCase.indices.length]}
        </div>
      )}

      {/* Blind Auscultation Challenge Strip */}
      {auscultBlind && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/45 bg-amber-950/25 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-amber-100">
            <span className="font-semibold">
              Repères masqués — écoutez les souffles et désignez la valve atteinte :
            </span>
            {!soundEnabled && (
              <button
                type="button"
                onClick={onToggleSound}
                className="rounded border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-100"
              >
                Activer le son
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {VALVE_CHOICES.map((vc) => {
              const picked = auscultGuess === vc.id;
              const isExpected = activeCase.auscultationValve === vc.id;
              return (
                <button
                  key={vc.id}
                  type="button"
                  onClick={() => onGuessValve(vc.id)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${
                    picked
                      ? activeCase.auscultationValve
                        ? isExpected
                          ? 'border-emerald-400 bg-emerald-500/25 text-emerald-100'
                          : 'border-red-400 bg-red-500/25 text-red-100'
                        : 'border-sky-400 bg-sky-500/25 text-sky-100'
                      : 'border-[var(--line2)] bg-[var(--card)] text-[var(--txt)] hover:border-sky-400/60'
                  }`}
                >
                  {vc.lbl}
                </button>
              );
            })}
            {auscultGuess && activeCase.auscultationValve && (
              <span
                className={`ml-1 text-[11px] font-semibold ${
                  auscultGuess === activeCase.auscultationValve
                    ? 'text-emerald-300'
                    : 'text-red-300'
                }`}
              >
                {auscultGuess === activeCase.auscultationValve
                  ? 'Exact !'
                  : 'Réécoutez le temps du cycle (systole vs diastole).'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Biological Safety Alerts (if any) */}
      {bio.alertesBio.length > 0 && (
        <div className="flex flex-wrap gap-2 text-[11px] text-amber-200">
          {bio.alertesBio.map((a, idx) => (
            <span key={idx} className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0 text-amber-300" />
              <span>{a}</span>
            </span>
          ))}
        </div>
      )}

      {/* Verdict & Clinical Explanation */}
      {showEvaluation && evaluation && (
        <div
          className={`rounded-lg border p-3 space-y-2 ${
            evaluation.verdict === 'succes'
              ? 'border-emerald-400/55 bg-emerald-950/30'
              : evaluation.verdict === 'partiel'
                ? 'border-amber-400/55 bg-amber-950/30'
                : 'border-red-400/60 bg-red-950/35'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {evaluation.verdict === 'succes' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
              ) : evaluation.verdict === 'partiel' ? (
                <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-300 shrink-0" />
              )}
              <span className="text-[13px] font-bold text-[var(--txt)]">
                {evaluation.titreVerdict}
              </span>
            </div>
            <span className="mono text-[12px] font-bold text-[var(--txt)]">
              Score clinique : {evaluation.score} / 100
            </span>
          </div>

          <p className="text-[12.5px] leading-relaxed text-[var(--txt)]">
            {evaluation.explicationGlobale}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
            {evaluation.criteres.map((cr, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-2 rounded-md border border-[var(--line)] bg-[var(--bg)]/70 px-2.5 py-1.5 text-[11.5px]"
              >
                <div className="flex items-start gap-1.5 min-w-0">
                  {cr.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <span className="text-[var(--txt)]">{cr.label}</span>
                </div>
                <span className="mono shrink-0 text-[11px] text-[var(--muted)]">{cr.detail}</span>
              </div>
            ))}
          </div>

          {evaluation.pisteCorrection && (
            <div className="text-[11.5px] text-amber-200 pt-0.5">
              <span className="font-semibold">Piste : </span>
              {evaluation.pisteCorrection}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ConsequenceTimelineDockProps {
  step: TimelineHorizon;
  branch: TimelineBranch;
  projection: TimelineProjection;
  moment: StoryboardMoment;
  storyPlaying: boolean;
  storyAutoPause: boolean;
  storyAlternate: boolean;
  inspectionPaused: boolean;
  isRecordingVideo: boolean;
  recordingSeconds: number;
  onChangeStep: (s: TimelineHorizon) => void;
  onChangeBranch: (b: TimelineBranch) => void;
  onStepPrev: () => void;
  onStepNext: () => void;
  onToggleStoryPlay: () => void;
  onToggleAutoPause: () => void;
  onToggleAlternate: () => void;
  onInspectZone: () => void;
  onCapturePng: () => void;
  onToggleVideoRecord: () => void;
}

export const ConsequenceTimelineDock: React.FC<ConsequenceTimelineDockProps> = ({
  step,
  branch,
  projection,
  moment,
  storyPlaying,
  storyAutoPause,
  storyAlternate,
  inspectionPaused,
  isRecordingVideo,
  recordingSeconds,
  onChangeStep,
  onChangeBranch,
  onStepPrev,
  onStepNext,
  onToggleStoryPlay,
  onToggleAutoPause,
  onToggleAlternate,
  onInspectZone,
  onCapturePng,
  onToggleVideoRecord,
}) => {
  const sevClass =
    projection.severite === 'ok'
      ? 'text-emerald-300'
      : projection.severite === 'warn'
        ? 'text-amber-300'
        : 'text-red-300';
  const sevLabel =
    projection.severite === 'ok'
      ? '● État stabilisé'
      : projection.severite === 'warn'
        ? '▲ Vigilance / surcharge'
        : '✖ Complication sévère';

  const formatRecTime = (sec: number) => {
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 space-y-2.5">
      {/* Header + Treated vs Untreated toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--accent)]" />
          <span className="text-[12px] font-bold text-[var(--txt)]">
            Timeline & film clinique
          </span>
          <span aria-hidden="true" className="text-[var(--dim)]">·</span>
          <span className={`text-[11.5px] font-semibold ${sevClass}`}>{sevLabel}</span>
          {inspectionPaused && (
            <>
              <span aria-hidden="true" className="text-[var(--dim)]">·</span>
              <span className="text-[11px] font-semibold text-sky-300">
                Pause d’inspection : {moment.focusLabel}
              </span>
            </>
          )}
        </div>

        <div
          className="flex items-center rounded-lg border border-[var(--line)] bg-[var(--bg)] p-0.5 text-[11px]"
          role="group"
          aria-label="Trajectoire temporelle"
        >
          <button
            type="button"
            onClick={() => onChangeBranch('treated')}
            className={`rounded-md px-2.5 py-1 font-semibold whitespace-nowrap shrink-0 transition ${
              branch === 'treated'
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'text-[var(--muted)] hover:text-[var(--txt)]'
            }`}
          >
            Avec traitement
          </button>
          <button
            type="button"
            onClick={() => onChangeBranch('untreated')}
            className={`rounded-md px-2.5 py-1 font-semibold whitespace-nowrap shrink-0 transition ${
              branch === 'untreated'
                ? 'bg-red-500/20 text-red-200'
                : 'text-[var(--muted)] hover:text-[var(--txt)]'
            }`}
          >
            Sans traitement
          </button>
        </div>
      </div>

      {/* Storyboard Transport, Auto-Pause, Zone Inspection & Capture Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onStepPrev}
            disabled={step === 0}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-[11px] font-semibold text-[var(--txt)] hover:border-sky-400/60 disabled:opacity-40 whitespace-nowrap shrink-0"
            title="Étape précédente"
          >
            <SkipBack className="h-3 w-3" />
            <span>Précédent</span>
          </button>

          <button
            type="button"
            onClick={onToggleStoryPlay}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold whitespace-nowrap shrink-0 transition ${
              storyPlaying
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'bg-[var(--accent)] text-slate-950 hover:bg-sky-300'
            }`}
          >
            {storyPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            <span>{storyPlaying ? 'Pause film' : step === 4 ? 'Rejouer le film' : 'Lancer le film'}</span>
          </button>

          <button
            type="button"
            onClick={onStepNext}
            disabled={step === 4}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-[11px] font-semibold text-[var(--txt)] hover:border-sky-400/60 disabled:opacity-40 whitespace-nowrap shrink-0"
            title="Moment clé suivant"
          >
            <span>Suivant</span>
            <SkipForward className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={onToggleAutoPause}
            aria-pressed={storyAutoPause}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0 transition ${
              storyAutoPause
                ? 'border-sky-400/60 bg-sky-500/15 text-sky-200'
                : 'border-[var(--line)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--txt)]'
            }`}
            title="Marquer une pause à chaque moment clé pour observer la zone"
          >
            Pause auto : {storyAutoPause ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={onToggleAlternate}
            aria-pressed={storyAlternate}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0 transition ${
              storyAlternate
                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                : 'border-[var(--line)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--txt)]'
            }`}
            title="Alterner automatiquement Sans traitement puis Avec traitement pendant le film"
          >
            <Repeat className="h-3 w-3" />
            <span>Alterner 2 issues : {storyAlternate ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onInspectZone}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0 transition ${
              inspectionPaused
                ? 'border-sky-400/70 bg-sky-500/20 text-sky-100'
                : 'border-[var(--line2)] bg-[var(--card)] text-[var(--txt)] hover:border-sky-400/60'
            }`}
          >
            <Crosshair className="h-3 w-3" />
            <span>Inspecter la zone</span>
          </button>

          <button
            type="button"
            onClick={onCapturePng}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--line2)] bg-[var(--card)] px-2 py-1 text-[11px] font-semibold text-[var(--txt)] hover:border-sky-400/60 whitespace-nowrap shrink-0"
            title="Enregistrer l’image clinique annotée (PNG)"
          >
            <Camera className="h-3 w-3" />
            <span>Image</span>
          </button>

          <button
            type="button"
            onClick={onToggleVideoRecord}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0 transition ${
              isRecordingVideo
                ? 'border-red-400 bg-red-500/25 text-red-100'
                : 'border-[var(--line2)] bg-[var(--card)] text-[var(--txt)] hover:border-rose-400/60'
            }`}
            title="Enregistrer une vidéo de la scène"
          >
            {isRecordingVideo ? <Square className="h-3 w-3 fill-current" /> : <Film className="h-3 w-3" />}
            <span>
              {isRecordingVideo ? `Stop · ${formatRecTime(recordingSeconds)}` : 'Enregistrer vidéo'}
            </span>
          </button>
        </div>
      </div>

      {/* 5 chronological key-moment horizon buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {TIMELINE_LABELS.map((item) => {
          const active = step === item.step;
          return (
            <button
              key={item.step}
              type="button"
              onClick={() => onChangeStep(item.step)}
              className={`rounded-lg border px-2.5 py-1.5 text-left transition ${
                active
                  ? branch === 'untreated' && item.step > 0
                    ? 'border-red-400/70 bg-red-950/35 text-[var(--txt)]'
                    : 'border-sky-400/70 bg-sky-500/20 text-[var(--txt)]'
                  : 'border-[var(--line)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--txt)]'
              }`}
            >
              <div className="mono text-[11.5px] font-bold">{item.short}</div>
              <div className="text-[10px] text-[var(--dim)] truncate">
                {item.full.split(' · ')[1] || item.short}
              </div>
            </button>
          );
        })}
      </div>

      {/* Key Moment Clinical Focus & Projected Organ Consequences */}
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] md:items-center gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[12px]">
        <div className="space-y-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-sky-300">
            <span>{moment.label}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--txt)]">{moment.title}</span>
          </div>
          <p className="text-[11.5px] text-[var(--muted)] leading-snug">
            {moment.whatHappens}
          </p>
        </div>
        <div className="mono flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--txt)] md:justify-end">
          {projection.consequences.map((c, i) => (
            <span
              key={i}
              className={projection.severite === 'crit' ? 'text-red-200 font-medium' : ''}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
