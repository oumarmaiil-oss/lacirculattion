import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  HelpCircle,
  Keyboard,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Pill,
  Play,
  RotateCcw,
  Share2,
  Tag,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { createAudioEngine, getAudioCaptureTracks, initAudio, sndTick } from './audio/heartSounds';
import { ComponentModal } from './components/ComponentModal';
import { ControlPanel } from './components/ControlPanel';
import { ShortcutsModal, SourcesModal, WelcomeModal } from './components/InfoModals';
import { ConsequenceTimelineDock, MissionBriefCard } from './components/MissionWorkspace';
import { SceneLesionPopover } from './components/SceneLesionPopover';
import { ACT_LBL, COMP, EX, SITES, actsFor, explain, nowHTML } from './data/medicalContent';
import {
  beat,
  clkExtend,
  clkRegen,
  clkTrim,
  createClock,
  phaseName,
  rythmeName,
  tlInfo,
} from './engine/clock';
import {
  CLINICAL_CASES,
  type TimelineProjection,
  evaluateCaseTreatment,
  projectTimelineState,
} from './engine/clinicalCases';
import { clamp, fmt, lerp } from './engine/geometry2d';
import {
  C,
  TRT_IDS,
  actOf,
  activeTrt,
  applyPresetToParams,
  compute,
  effetTraitements,
  freshP,
  setPlaqueStage,
} from './engine/physiology';
import {
  getTreatmentProtocol,
  isProtocolApplied,
  mergeProtocolOnParams,
} from './engine/protocols';
import {
  buildVisualStoryOverlay,
  getStoryboardMoment,
  interpolateTimelineProjection,
} from './engine/storyboard';
import type {
  ActionType,
  AppMode,
  ComponentId,
  ComputedResult,
  DisplayProfile,
  DynamicState,
  Heart3DMode,
  HeartChartMode,
  SceneLesionId,
  SimParams,
  TabId,
  TimelineBranch,
  TimelineHorizon,
  TraitementId,
  ValveId,
  VesselSiteId,
  ViewLevel,
  VisualStoryOverlay,
} from './engine/types';
import { drawOnde, drawPVLoop, drawWiggers } from './renderers/charts';
import { coeurHit, coeurLesionHit, createCoeurState, drawCoeur } from './renderers/coeur2d';
import { corpsHit, corpsLesionHit, createCorpsState, drawCorps } from './renderers/corps2d';
import { createHeart3D, type Heart3DInstance } from './renderers/heart3d';
import { createVaisseauState, drawVaisseau, vaisseauLesionHit } from './renderers/vaisseau2d';
import { createVessel3D, type Vessel3DInstance } from './renderers/vessel3d';

const SPEEDS = [0.25, 0.5, 1, 1.5];

const LERP_KEYS = [
  'fcEff',
  'svtot',
  'svf',
  'dc',
  'pam',
  'pas',
  'pad',
  'pp',
  'ptdvg',
  'pog',
  'pvc',
  'fe',
  'vtd',
  'vts',
  'grad',
  'gradPic',
  'vmax',
  'lvSys',
  'compliance',
  'rig',
  'contract',
  'resist',
  'volume',
  'congestion',
  'oedemeVeineux',
  'oedemeICa',
  'oedeme',
  'debitBas',
  'pamHaute',
  'rein',
  'no',
  'ldl',
] as const;

function lerpComputedResult(cur: ComputedResult, target: ComputedResult, alpha: number): boolean {
  let moving = false;
  for (const k of LERP_KEYS) {
    const a = cur[k];
    const b = target[k];
    if (Math.abs(b - a) > 0.004) {
      (cur[k] as number) = lerp(a, b, alpha);
      moving = true;
    } else {
      (cur[k] as number) = b;
    }
  }
  // Copy discrete/categorical state directly
  cur.rythme = target.rythme;
  cur.atriaOK = target.atriaOK;
  cur.effort = target.effort;
  cur.fcA = target.fcA;
  cur.tej = target.tej;
  cur.rf = target.rf;
  cur.rfAo = target.rfAo;
  cur.surfAo = target.surfAo;
  cur.kick = target.kick;
  cur.acts = target.acts;
  cur.heartBlock = target.heartBlock;
  cur.dose = target.dose;
  cur.zoneIDM = target.zoneIDM;
  cur.satArt = target.satArt;
  cur.dysEndo = target.dysEndo;
  cur.hvgCible = target.hvgCible;
  cur.tr = target.tr;
  cur.asso = target.asso;
  cur.raa = target.raa;
  cur.bio = target.bio;
  cur.notes = target.notes;
  cur.warns = target.warns;
  cur.pulmEmb = target.pulmEmb;
  cur.ivcBlock = target.ivcBlock;
  return moving;
}

function parseInitialUrl(): {
  tab: TabId;
  exId: string;
  level: ViewLevel;
  autostart: boolean;
  mode: AppMode;
  caseId: string;
} {
  let tab: TabId = 'corps';
  let exId = 'sain';
  let level: ViewLevel = 1;
  let mode: AppMode = 'libre';
  let caseId = CLINICAL_CASES[0].id;
  const search = new URLSearchParams(window.location.search);
  const autostart = search.get('autostart') === '1';
  if (search.get('mode') === 'cas') mode = 'cas';

  const rawHash = window.location.hash.replace(/^#/, '');
  if (rawHash) {
    const parts = rawHash.split('&');
    const first = parts[0];
    if (first === 'corps' || first === 'coeur' || first === 'vaisseau') {
      tab = first;
    }
    for (const part of parts) {
      const [k, v] = part.split('=');
      if (k === 'ex' && v) exId = decodeURIComponent(v);
      if (k === 'n' && (v === '1' || v === '2' || v === '3')) {
        level = Number(v) as ViewLevel;
      }
      if (k === 'mode' && (v === 'cas' || v === 'libre')) {
        mode = v;
      }
      if (k === 'cas' && v) {
        const decoded = decodeURIComponent(v);
        if (CLINICAL_CASES.some((c) => c.id === decoded)) {
          caseId = decoded;
        }
      }
    }
  }
  return { tab, exId, level, autostart, mode, caseId };
}

export default function App() {
  const initial = useMemo(() => parseInitialUrl(), []);
  const initialCase = useMemo(
    () => CLINICAL_CASES.find((c) => c.id === initial.caseId) || CLINICAL_CASES[0],
    [initial.caseId]
  );

  const [appMode, setAppMode] = useState<AppMode>(initial.mode);
  const [activeCaseId, setActiveCaseId] = useState<string>(initialCase.id);
  const [timelineStep, setTimelineStep] = useState<TimelineHorizon>(0);
  const [timelineBranch, setTimelineBranch] = useState<TimelineBranch>('treated');
  const [storyPlaying, setStoryPlaying] = useState<boolean>(false);
  const [storyAutoPause, setStoryAutoPause] = useState<boolean>(true);
  const [storyAlternate, setStoryAlternate] = useState<boolean>(true);
  const [inspectionPaused, setInspectionPaused] = useState<boolean>(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [activeLesionId, setActiveLesionId] = useState<SceneLesionId | null>(null);
  const alternateDoneRef = useRef<boolean>(false);
  const [showEvaluation, setShowEvaluation] = useState<boolean>(false);
  const [hintIndex, setHintIndex] = useState<number>(0);
  const [auscultBlind, setAuscultBlind] = useState<boolean>(false);
  const [auscultGuess, setAuscultGuess] = useState<ValveId | null>(null);
  const [heartChartMode, setHeartChartMode] = useState<HeartChartMode>('both');

  const [tab, setTab] = useState<TabId>(
    initial.mode === 'cas' ? initialCase.tabDefaut : initial.tab
  );
  const [level, setLevel] = useState<ViewLevel>(initial.level);
  const [profile, setProfile] = useState<DisplayProfile>('complet');
  const [pane, setPane] = useState<'ex' | 'ctl'>(initial.mode === 'cas' ? 'ctl' : 'ex');
  const [mobileSheet, setMobileSheet] = useState<'scene' | 'ex' | 'ctl'>('scene');
  const [activeExId, setActiveExId] = useState<string>(initial.exId);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [heart3dMode, setHeart3dMode] = useState<Heart3DMode>('coupe');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [playing, setPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [params, setParams] = useState<SimParams>(() => {
    if (initial.mode === 'cas') {
      return applyPresetToParams(initialCase.preset).params;
    }
    const preset = EX[initial.tab].find((e) => e.id === initial.exId);
    return preset ? applyPresetToParams(preset.p).params : freshP();
  });
  const [dynHvg, setDynHvg] = useState<number>(() => {
    if (initial.mode === 'cas') {
      return applyPresetToParams(initialCase.preset).d.hvg;
    }
    const preset = EX[initial.tab].find((e) => e.id === initial.exId);
    return preset ? applyPresetToParams(preset.p).d.hvg : 0;
  });

  const [modalCompId, setModalCompId] = useState<ComponentId | null>(null);
  const [quickCompId, setQuickCompId] = useState<ComponentId | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [compareUntreated, setCompareUntreated] = useState<boolean>(false);
  const [hoverCompId, setHoverCompId] = useState<ComponentId | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    if (initial.autostart || window.location.hash.includes('ex=')) return false;
    try {
      return sessionStorage.getItem('atelierCoeurSeen') !== '1';
    } catch {
      return true;
    }
  });
  const [showKeys, setShowKeys] = useState<boolean>(false);
  const [showSources, setShowSources] = useState<boolean>(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const activeCase = useMemo(
    () => CLINICAL_CASES.find((c) => c.id === activeCaseId) || CLINICAL_CASES[0],
    [activeCaseId]
  );

  const activeProtocol = useMemo(
    () => getTreatmentProtocol(params, appMode, appMode === 'cas' ? activeCase : null),
    [params, appMode, activeCase]
  );

  const protocolApplied = useMemo(
    () => (activeProtocol ? isProtocolApplied(params, activeProtocol) : false),
    [params, activeProtocol]
  );

  const hasAnyTrt = useMemo(() => {
    const { t, asso } = activeTrt(params);
    return Boolean(asso) || Object.values(t).some(Boolean);
  }, [params]);

  const timelineEffectiveInputParams = useMemo(() => {
    if (
      storyAlternate &&
      storyPlaying &&
      timelineBranch === 'treated' &&
      !hasAnyTrt &&
      activeProtocol &&
      !activeProtocol.isMechanical
    ) {
      return mergeProtocolOnParams(params, activeProtocol.presetPatch);
    }
    return params;
  }, [storyAlternate, storyPlaying, timelineBranch, hasAnyTrt, activeProtocol, params]);

  const timelineProjection = useMemo(
    () =>
      projectTimelineState(
        timelineEffectiveInputParams,
        dynHvg,
        appMode === 'cas' ? activeCase : null,
        timelineStep,
        timelineBranch
      ),
    [timelineEffectiveInputParams, dynHvg, appMode, activeCase, timelineStep, timelineBranch]
  );

  const effectiveParams: SimParams = useMemo(() => {
    const base = timelineProjection.params;
    if (!compareUntreated) return base;
    const offTrt = Object.fromEntries(TRT_IDS.map((k) => [k, false])) as Record<
      TraitementId,
      boolean
    >;
    return { ...base, trt: offTrt, asso: null };
  }, [timelineProjection.params, compareUntreated]);

  const dynState: DynamicState = useMemo(
    () => ({ hvg: timelineProjection.d.hvg }),
    [timelineProjection.d.hvg]
  );
  const computed: ComputedResult = useMemo(
    () => compute(effectiveParams, dynState),
    [effectiveParams, dynState]
  );
  const treatedComputed: ComputedResult = useMemo(
    () => compute(params, { hvg: dynHvg }),
    [params, dynHvg]
  );
  const trtImpact = useMemo(() => {
    const { t } = activeTrt(params);
    if (!TRT_IDS.some((k) => t[k])) return null;
    return effetTraitements(params, { hvg: dynHvg }, treatedComputed);
  }, [params, dynHvg, treatedComputed]);
  const caseEvaluation = useMemo(() => {
    if (appMode !== 'cas') return null;
    return evaluateCaseTreatment(activeCase, params, { hvg: dynHvg }, treatedComputed, auscultGuess);
  }, [appMode, activeCase, params, dynHvg, treatedComputed, auscultGuess]);

  const storyMoment = useMemo(
    () =>
      getStoryboardMoment(
        appMode,
        appMode === 'cas' ? activeCase : null,
        timelineEffectiveInputParams,
        timelineBranch,
        timelineStep
      ),
    [appMode, activeCase, timelineEffectiveInputParams, timelineBranch, timelineStep]
  );

  const storyOverlay = useMemo(
    () => buildVisualStoryOverlay(storyMoment, inspectionPaused),
    [storyMoment, inspectionPaused]
  );

  // Sync URL hash cleanly & listen to hashchange
  useEffect(() => {
    const modePart =
      appMode === 'cas'
        ? `&mode=cas&cas=${encodeURIComponent(activeCaseId)}`
        : '&mode=libre';
    const nextHash = `#${tab}&ex=${encodeURIComponent(activeExId)}&n=${level}${modePart}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }, [tab, activeExId, level, appMode, activeCaseId]);

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseInitialUrl();
      setAppMode(parsed.mode);
      setActiveCaseId(parsed.caseId);
      setTab(parsed.tab);
      setLevel(parsed.level);
      setActiveExId(parsed.exId);
      if (parsed.mode === 'cas') {
        const cdef = CLINICAL_CASES.find((c) => c.id === parsed.caseId) || CLINICAL_CASES[0];
        const { params: np, d: nd } = applyPresetToParams(cdef.preset);
        setParams(np);
        setDynHvg(nd.hvg);
      } else {
        const preset = EX[parsed.tab].find((e) => e.id === parsed.exId);
        if (preset) {
          const { params: np, d: nd } = applyPresetToParams(preset.p);
          setParams(np);
          setDynHvg(nd.hvg);
        }
      }
      if (parsed.tab === 'corps') setViewMode('2d');
      need2DRenderRef.current = true;
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Refs for smooth 60fps RAF without React re-render overhead
  const clkRef = useRef(createClock());
  const corpsStateRef = useRef(createCorpsState());
  const coeurStateRef = useRef(createCoeurState());
  const vaisseauStateRef = useRef(createVaisseauState());
  const audioRef = useRef(createAudioEngine());

  const paramsRef = useRef(effectiveParams);
  paramsRef.current = effectiveParams;
  const dynRef = useRef(dynState);
  dynRef.current = dynState;
  const resRef = useRef(computed);
  resRef.current = computed;
  const smoothResRef = useRef<ComputedResult>({ ...computed });
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const levelRef = useRef(level);
  levelRef.current = level;
  const showLabelsRef = useRef(showLabels && !auscultBlind);
  showLabelsRef.current = showLabels && !auscultBlind;
  const heartChartModeRef = useRef(heartChartMode);
  heartChartModeRef.current = heartChartMode;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;
  const hoverIdRef = useRef(hoverCompId);
  hoverIdRef.current = hoverCompId;
  const storyOverlayRef = useRef<VisualStoryOverlay>(storyOverlay);
  storyOverlayRef.current = storyOverlay;
  const smoothStoryRef = useRef<VisualStoryOverlay>({ ...storyOverlay });
  const prevProjRef = useRef<TimelineProjection>(timelineProjection);
  const stepAnimRef = useRef<{
    active: boolean;
    from: TimelineProjection;
    to: TimelineProjection;
    progress: number;
  }>({
    active: false,
    from: timelineProjection,
    to: timelineProjection,
    progress: 1,
  });
  const lastStepBranchRef = useRef<{ step: TimelineHorizon; branch: TimelineBranch }>({
    step: timelineStep,
    branch: timelineBranch,
  });

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const canvas2dRef = useRef<HTMLCanvasElement | null>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pvCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stage3dRef = useRef<HTMLDivElement | null>(null);
  const heart3dInstRef = useRef<Heart3DInstance | null>(null);
  const vessel3dInstRef = useRef<Vessel3DInstance | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  const tlInputRef = useRef<HTMLInputElement | null>(null);
  const tlPhaseRef = useRef<HTMLSpanElement | null>(null);
  const liveReadoutRef = useRef<HTMLSpanElement | null>(null);
  const need2DRenderRef = useRef<boolean>(true);

  // Trigger smooth timeline interpolation whenever step or branch changes
  useEffect(() => {
    if (
      lastStepBranchRef.current.step !== timelineStep ||
      lastStepBranchRef.current.branch !== timelineBranch
    ) {
      stepAnimRef.current = {
        active: true,
        from: prevProjRef.current,
        to: timelineProjection,
        progress: 0,
      };
      lastStepBranchRef.current = { step: timelineStep, branch: timelineBranch };
    }
    prevProjRef.current = timelineProjection;
  }, [timelineStep, timelineBranch, timelineProjection]);

  // Regenerate cardiac events and request 2D/3D redraw whenever state changes
  useEffect(() => {
    clkRef.current.playing = playing;
    clkRef.current.speed = speed;
    clkRegen(clkRef.current, computed);
    need2DRenderRef.current = true;
    if (heart3dInstRef.current) heart3dInstRef.current.viewport.needRender = true;
    if (vessel3dInstRef.current) vessel3dInstRef.current.viewport.needRender = true;
  }, [
    computed,
    storyOverlay,
    playing,
    speed,
    tab,
    viewMode,
    level,
    showLabels,
    auscultBlind,
    heartChartMode,
    profile,
    hoverCompId,
    sidebarOpen,
  ]);

  // Toast helper
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 2400);
  }, []);

  // Initialize / dispose Three.js scenes when tab or viewMode switches
  useEffect(() => {
    const host = stage3dRef.current;
    if (!host) return;

    if (heart3dInstRef.current) {
      heart3dInstRef.current.dispose();
      heart3dInstRef.current = null;
    }
    if (vessel3dInstRef.current) {
      vessel3dInstRef.current.dispose();
      vessel3dInstRef.current = null;
    }

    if (viewMode === '3d' && tab === 'coeur') {
      const inst = createHeart3D(
        host,
        (id) => {
          if (!id) {
            setQuickCompId(null);
            setActiveLesionId(null);
            return;
          }
          if (id.startsWith('lesion:')) {
            setQuickCompId(null);
            setActiveLesionId(id.slice(7) as SceneLesionId);
          } else {
            setActiveLesionId(null);
            setQuickCompId(id as ComponentId);
          }
        },
        (id, cx, cy) => {
          const comp = id && !id.startsWith('lesion:') ? (id as ComponentId) : null;
          setHoverCompId(comp);
          setHoverPos(id ? { x: cx, y: cy } : null);
          if (host) host.style.cursor = id ? 'pointer' : 'grab';
        }
      );
      inst.setMode(heart3dMode);
      heart3dInstRef.current = inst;
      return () => {
        inst.dispose();
        heart3dInstRef.current = null;
      };
    }

    if (viewMode === '3d' && tab === 'vaisseau') {
      const inst = createVessel3D(host, (layer) => {
        if (layer === 'plaque') {
          setActiveLesionId('vessel-plaque');
        } else if (layer === 'thrombus') {
          setActiveLesionId('vessel-thrombus');
        } else if (layer) {
          setActiveLesionId(null);
          showToast(`Couche sélectionnée : ${layer}`);
        }
      });
      vessel3dInstRef.current = inst;
      return () => {
        inst.dispose();
        vessel3dInstRef.current = null;
      };
    }
    return undefined;
  }, [tab, viewMode, showToast]);

  // Update 3D heart mode
  useEffect(() => {
    heart3dInstRef.current?.setMode(heart3dMode);
  }, [heart3dMode]);

  // Update 3D hover state
  useEffect(() => {
    heart3dInstRef.current?.setHover(hoverCompId);
  }, [hoverCompId]);

  // Apply HVG adaptive drift gently when playing
  const hvgTimerRef = useRef(0);

  // Main Animation Loop
  useEffect(() => {
    let rafId = 0;
    let prevTs = performance.now();
    let uiSyncAccum = 0;
    let sw3dAccum = 0;

    const frame = (ts: number) => {
      const realDt = clamp((ts - prevTs) / 1000, 0, 0.08);
      prevTs = ts;

      const clk = clkRef.current;
      let p = paramsRef.current;
      let d = dynRef.current;
      let targetR = resRef.current;
      let stepAnimating = false;

      const sAnim = stepAnimRef.current;
      if (sAnim.active) {
        sAnim.progress = clamp(sAnim.progress + realDt / 0.9, 0, 1);
        const interp = interpolateTimelineProjection(sAnim.from, sAnim.to, sAnim.progress);
        p = interp.params;
        d = interp.d;
        targetR = compute(p, d);
        stepAnimating = sAnim.progress < 1;
        if (!stepAnimating) sAnim.active = false;
      }

      const sr = smoothResRef.current;
      const isLerping = lerpComputedResult(sr, targetR, 1 - Math.exp(-realDt * 9));
      const r = sr;

      const targetOverlay = storyOverlayRef.current;
      const curOverlay = smoothStoryRef.current;
      const ovAlpha = 1 - Math.exp(-realDt * 6);
      const ovMoving =
        Math.abs(targetOverlay.clotProgress - curOverlay.clotProgress) > 0.004 ||
        Math.abs(targetOverlay.treatmentHeal - curOverlay.treatmentHeal) > 0.004;
      curOverlay.clotProgress = ovMoving
        ? lerp(curOverlay.clotProgress, targetOverlay.clotProgress, ovAlpha)
        : targetOverlay.clotProgress;
      curOverlay.treatmentHeal = ovMoving
        ? lerp(curOverlay.treatmentHeal, targetOverlay.treatmentHeal, ovAlpha)
        : targetOverlay.treatmentHeal;
      curOverlay.focusZone = targetOverlay.focusZone;
      curOverlay.focusLabel = targetOverlay.focusLabel;
      curOverlay.embolDetached = targetOverlay.embolDetached;
      curOverlay.inspectionPaused = targetOverlay.inspectionPaused;

      const curTab = tabRef.current;
      const mode = viewModeRef.current;
      const isLight = profileRef.current === 'leger';

      if (clk.playing) {
        clk.t += realDt * clk.speed;
        clkExtend(clk, r, clk.t + 6);
        clkTrim(clk);
        hvgTimerRef.current += realDt * clk.speed;
        if (hvgTimerRef.current > 0.35) {
          hvgTimerRef.current = 0;
          const target = targetR.hvgCible;
          if (Math.abs(target - d.hvg) > 0.015) {
            const nextHvg = clamp(d.hvg + (target - d.hvg) * 0.08, 0, 1);
            setDynHvg(nextHvg);
          }
        }
      }

      sndTick(audioRef.current, clk, p, targetR, soundRef.current);

      const shouldDraw2D =
        clk.playing || need2DRenderRef.current || isLerping || stepAnimating || ovMoving;
      if (shouldDraw2D) {
        const cv = canvas2dRef.current;
        if (cv && (curTab === 'corps' || mode === '2d')) {
          if (curTab === 'corps') {
            drawCorps({
              cv,
              clk,
              p,
              r,
              state: corpsStateRef.current,
              level: levelRef.current,
              showLabels: showLabelsRef.current,
              isLightParticles: isLight,
              story: curOverlay,
              onEmbolArrived: () => {
                setParams((prev) => ({
                  ...prev,
                  mal: { ...prev.mal, avc: true },
                }));
                setBannerMsg(
                  'Le caillot parti de l’oreillette gauche a bouché une artère du cerveau : AVC ischémique.'
                );
              },
            });
          } else if (curTab === 'coeur') {
            drawCoeur({
              cv,
              clk,
              p,
              d,
              r,
              state: coeurStateRef.current,
              level: levelRef.current,
              showLabels: showLabelsRef.current,
              isLightParticles: isLight,
              hoverId: hoverIdRef.current,
              story: curOverlay,
            });
          } else if (curTab === 'vaisseau') {
            drawVaisseau({
              cv,
              clk,
              p,
              r,
              state: vaisseauStateRef.current,
              level: levelRef.current,
              showLabels: showLabelsRef.current,
              story: curOverlay,
            });
          }
        }

        const chartCv = chartCanvasRef.current;
        const pvCv = pvCanvasRef.current;
        if (curTab === 'coeur') {
          if (chartCv && (heartChartModeRef.current === 'wiggers' || heartChartModeRef.current === 'both')) {
            drawWiggers(chartCv, clk, r, d);
          }
          if (pvCv && (heartChartModeRef.current === 'pv' || heartChartModeRef.current === 'both')) {
            drawPVLoop(pvCv, clk, r);
          }
        } else if (curTab === 'vaisseau' && chartCv) {
          drawOnde(chartCv, clk, p, r);
        }
        need2DRenderRef.current = false;
      }

      if (mode === '3d') {
        const opts = {
          level: levelRef.current,
          showLabels: showLabelsRef.current,
          isLightParticles: isLight,
        };
        sw3dAccum += realDt;
        const h3 = heart3dInstRef.current;
        const v3 = vessel3dInstRef.current;
        const isSw = h3?.viewport.isSoftwareGl || v3?.viewport.isSoftwareGl || false;
        const dirty3d = h3?.viewport.needRender || v3?.viewport.needRender || isLerping || false;
        if (!isSw || dirty3d || !clk.playing || sw3dAccum >= 0.042) {
          sw3dAccum = 0;
          if (curTab === 'coeur' && h3) {
            h3.update(clk, p, d, r, opts);
          } else if (curTab === 'vaisseau' && v3) {
            v3.update(clk, p, r, opts);
          }
        }
      }

      // Sync timeline scrubber & compact telemetry DOM without React re-renders
      uiSyncAccum += realDt;
      if (uiSyncAccum >= 0.08) {
        uiSyncAccum = 0;
        const info = tlInfo(clk, r);
        if (tlInputRef.current) {
          const u = clamp((clk.t - info.w0) / Math.max(0.1, info.w1 - info.w0), 0, 1);
          tlInputRef.current.value = String(Math.round(u * 1000));
        }
        const b = beat(clk, r, clk.t);
        const ph = phaseName(clk, r, clk.t, b);
        if (tlPhaseRef.current) tlPhaseRef.current.textContent = ph;
        if (liveReadoutRef.current) {
          liveReadoutRef.current.textContent = `FC ${fmt(r.fcEff)}/min · PA ${fmt(
            r.pas
          )}/${fmt(r.pad)} mmHg · DC ${fmt(r.dc, 1)} L/min · FE ${fmt(r.fe * 100)} %`;
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Handlers
  const handleSelectExample = useCallback((id: string) => {
    const ex = EX[tab].find((e) => e.id === id);
    if (!ex) return;
    const { params: np, d: nd } = applyPresetToParams(ex.p);
    setParams(np);
    setDynHvg(nd.hvg);
    setActiveExId(id);
    setTimelineStep(0);
    setTimelineBranch('treated');
    setStoryPlaying(false);
    alternateDoneRef.current = false;
    setInspectionPaused(false);
    setCompareUntreated(false);
    setQuickCompId(null);
    setActiveLesionId(null);
    setBannerMsg(null);
    corpsStateRef.current.embolActive = false;
    corpsStateRef.current.embolArrived = false;
    if (ex.speed !== undefined) setSpeed(ex.speed);
    else setSpeed(1);
    setPlaying(true);
  }, [tab]);

  const handleSwitchTab = useCallback((nextTab: TabId) => {
    setTab(nextTab);
    setHoverCompId(null);
    setHoverPos(null);
    setQuickCompId(null);
    setActiveLesionId(null);
    setModalCompId(null);
    if (nextTab === 'corps' && viewMode === '3d') {
      setViewMode('2d');
    }
    if (mobileSheet !== 'scene') setMobileSheet('scene');
  }, [viewMode, mobileSheet]);

  const handleSelectCase = useCallback(
    (caseId: string) => {
      const cdef = CLINICAL_CASES.find((c) => c.id === caseId);
      if (!cdef) return;
      const { params: np, d: nd } = applyPresetToParams(cdef.preset);
      setActiveCaseId(caseId);
      setParams(np);
      setDynHvg(nd.hvg);
      setTimelineStep(0);
      setTimelineBranch('treated');
      setStoryPlaying(false);
      alternateDoneRef.current = false;
      setInspectionPaused(false);
      setShowEvaluation(false);
      setHintIndex(0);
      setAuscultBlind(false);
      setAuscultGuess(null);
      setCompareUntreated(false);
      setQuickCompId(null);
      setActiveLesionId(null);
      setBannerMsg(null);
      setTab(cdef.tabDefaut);
      if (cdef.tabDefaut === 'corps') setViewMode('2d');
      setPane('ctl');
      setPlaying(true);
    },
    []
  );

  const handleSwitchAppMode = useCallback(
    (nextMode: AppMode) => {
      setAppMode(nextMode);
      setCompareUntreated(false);
      setTimelineStep(0);
      setTimelineBranch('treated');
      setStoryPlaying(false);
      alternateDoneRef.current = false;
      setInspectionPaused(false);
      setShowEvaluation(false);
      setAuscultBlind(false);
      setActiveLesionId(null);
      if (nextMode === 'cas') {
        const cdef = CLINICAL_CASES.find((c) => c.id === activeCaseId) || CLINICAL_CASES[0];
        const { params: np, d: nd } = applyPresetToParams(cdef.preset);
        setParams(np);
        setDynHvg(nd.hvg);
        setTab(cdef.tabDefaut);
        if (cdef.tabDefaut === 'corps') setViewMode('2d');
        setPane('ctl');
      } else {
        setParams(freshP());
        setDynHvg(0);
        setActiveExId('sain');
        setSpeed(1);
        setBannerMsg(null);
        corpsStateRef.current.embolActive = false;
        corpsStateRef.current.embolArrived = false;
        setPane('ex');
      }
    },
    [activeCaseId]
  );

  const handleResetAll = useCallback(() => {
    if (appMode === 'cas') {
      handleSelectCase(activeCaseId);
      showToast('Cas réinitialisé au point de départ');
      return;
    }
    setParams(freshP());
    setDynHvg(0);
    setActiveExId('sain');
    setTimelineStep(0);
    setTimelineBranch('treated');
    setStoryPlaying(false);
    alternateDoneRef.current = false;
    setInspectionPaused(false);
    setCompareUntreated(false);
    setQuickCompId(null);
    setActiveLesionId(null);
    setSpeed(1);
    setPlaying(true);
    setBannerMsg(null);
    corpsStateRef.current.embolActive = false;
    corpsStateRef.current.embolArrived = false;
    showToast('Paramètres remis à la normale');
  }, [appMode, activeCaseId, handleSelectCase, showToast]);

  const handleQuickAction = useCallback((id: ComponentId, action: ActionType | null) => {
    setParams((prev) => ({
      ...prev,
      fail: prev.fail === id && !action ? null : prev.fail,
      act: { ...prev.act, [id]: action },
    }));
  }, []);

  const handleSetPlaque = useCallback((st: number) => {
    setParams((prev) => {
      const { next, triggeredEvent } = setPlaqueStage(prev, st);
      if (triggeredEvent) setBannerMsg(triggeredEvent);
      else if (st === 0) setBannerMsg(null);
      return next;
    });
  }, []);

  const handleTogglePlay = useCallback(() => {
    setPlaying((prev) => !prev);
  }, []);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next) {
        const ctx = initAudio(audioRef.current);
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  const handleStepFrame = useCallback((dir: -1 | 1) => {
    setPlaying(false);
    clkRef.current.t += dir * 0.035;
    clkExtend(clkRef.current, resRef.current, clkRef.current.t + 4);
    need2DRenderRef.current = true;
    if (heart3dInstRef.current) heart3dInstRef.current.viewport.needRender = true;
    if (vessel3dInstRef.current) vessel3dInstRef.current.viewport.needRender = true;
  }, []);

  const handleJumpPhaseKey = useCallback((idx: number) => {
    const info = tlInfo(clkRef.current, resRef.current);
    const target = info.keys[idx];
    if (target !== null && target !== undefined) {
      setPlaying(false);
      clkRef.current.t = target + 0.002;
      need2DRenderRef.current = true;
      if (heart3dInstRef.current) heart3dInstRef.current.viewport.needRender = true;
      if (vessel3dInstRef.current) vessel3dInstRef.current.viewport.needRender = true;
    }
  }, []);

  const handleScrub = useCallback((u: number) => {
    const info = tlInfo(clkRef.current, resRef.current);
    setPlaying(false);
    clkRef.current.t = info.w0 + clamp(u, 0, 1) * (info.w1 - info.w0);
    need2DRenderRef.current = true;
    if (heart3dInstRef.current) heart3dInstRef.current.viewport.needRender = true;
    if (vessel3dInstRef.current) vessel3dInstRef.current.viewport.needRender = true;
  }, []);

  const handleApplyTargetedProtocol = useCallback(() => {
    if (!activeProtocol) return;
    if (activeProtocol.isMechanical) {
      setParams((prev) => {
        const cleanTrt = Object.fromEntries(TRT_IDS.map((k) => [k, false])) as Record<
          TraitementId,
          boolean
        >;
        return { ...prev, trt: cleanTrt, asso: null };
      });
      setTimelineBranch('treated');
      setCompareUntreated(false);
      showToast('Conduite respectée : vasodilatateurs évités (préparation TAVI)');
      return;
    }
    setParams((prev) => mergeProtocolOnParams(prev, activeProtocol.presetPatch));
    setTimelineBranch('treated');
    setCompareUntreated(false);
    showToast(`Protocole appliqué : ${activeProtocol.conditionTitle}`);
  }, [activeProtocol, showToast]);

  // Storyboard key-moment playback, auto-pause & dual-outcome alternation
  useEffect(() => {
    if (!storyPlaying) return;
    const delayMs = storyAutoPause ? 1200 : 2300;
    const id = window.setTimeout(() => {
      if (timelineStep >= 4) {
        if (storyAlternate && !alternateDoneRef.current && activeProtocol) {
          alternateDoneRef.current = true;
          const nextBranch: TimelineBranch =
            timelineBranch === 'untreated' ? 'treated' : 'untreated';
          if (
            nextBranch === 'treated' &&
            appMode === 'libre' &&
            !hasAnyTrt &&
            !activeProtocol.isMechanical
          ) {
            setParams((prev) => mergeProtocolOnParams(prev, activeProtocol.presetPatch));
          }
          setTimelineBranch(nextBranch);
          setTimelineStep(0);
          setInspectionPaused(false);
          showToast(
            nextBranch === 'treated'
              ? 'Issue 2/2 : Avec traitement'
              : 'Issue 1/2 : Sans traitement'
          );
          return;
        }
        setStoryPlaying(false);
        if (storyAutoPause) setInspectionPaused(true);
        return;
      }
      const nextStep = (timelineStep + 1) as TimelineHorizon;
      setTimelineStep(nextStep);
      if (storyAutoPause) {
        setStoryPlaying(false);
        setInspectionPaused(true);
      }
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [
    storyPlaying,
    storyAutoPause,
    storyAlternate,
    timelineStep,
    timelineBranch,
    activeProtocol,
    appMode,
    hasAnyTrt,
    showToast,
  ]);

  const handleChangeTimelineStep = useCallback((s: TimelineHorizon) => {
    setStoryPlaying(false);
    setInspectionPaused(false);
    setTimelineStep(s);
    need2DRenderRef.current = true;
  }, []);

  const handleChangeTimelineBranch = useCallback(
    (b: TimelineBranch) => {
      setStoryPlaying(false);
      alternateDoneRef.current = false;
      setInspectionPaused(false);
      if (
        b === 'treated' &&
        appMode === 'libre' &&
        !hasAnyTrt &&
        activeProtocol &&
        !activeProtocol.isMechanical
      ) {
        setParams((prev) => mergeProtocolOnParams(prev, activeProtocol.presetPatch));
        showToast(`Traitement appliqué : ${activeProtocol.classes[0]}`);
      }
      setTimelineBranch(b);
      need2DRenderRef.current = true;
    },
    [appMode, hasAnyTrt, activeProtocol, showToast]
  );

  const handleStepPrev = useCallback(() => {
    setStoryPlaying(false);
    setInspectionPaused(false);
    setTimelineStep((s) => Math.max(0, s - 1) as TimelineHorizon);
    need2DRenderRef.current = true;
  }, []);

  const handleStepNext = useCallback(() => {
    setStoryPlaying(false);
    setTimelineStep((s) => {
      const next = Math.min(4, s + 1) as TimelineHorizon;
      if (storyAutoPause && next > s) {
        setInspectionPaused(true);
      } else {
        setInspectionPaused(false);
      }
      return next;
    });
    need2DRenderRef.current = true;
  }, [storyAutoPause]);

  const handleToggleStoryPlay = useCallback(() => {
    setStoryPlaying((prev) => {
      if (prev) return false;
      setInspectionPaused(false);
      setPlaying(true);
      if (timelineStep === 4) {
        alternateDoneRef.current = false;
        setTimelineStep(0);
      } else if (timelineStep === 0) {
        alternateDoneRef.current = false;
      }
      return true;
    });
  }, [timelineStep]);

  const handleInspectZone = useCallback(() => {
    const targetTab = storyMoment.focusTab;
    const alreadyInspecting = inspectionPaused && tab === targetTab && viewMode === '2d';
    if (alreadyInspecting) {
      setInspectionPaused(false);
      need2DRenderRef.current = true;
      return;
    }
    setStoryPlaying(false);
    setInspectionPaused(true);
    if (tab !== targetTab) {
      handleSwitchTab(targetTab);
    }
    if (viewMode === '3d') {
      setViewMode('2d');
    }
    need2DRenderRef.current = true;
    showToast(`Zone ciblée : ${storyMoment.focusLabel}`);
  }, [storyMoment, inspectionPaused, tab, viewMode, handleSwitchTab, showToast]);

  const handleCapturePng = useCallback(() => {
    const cv =
      viewMode === '3d' && tab === 'coeur' && heart3dInstRef.current
        ? heart3dInstRef.current.viewport.renderer.domElement
        : viewMode === '3d' && tab === 'vaisseau' && vessel3dInstRef.current
          ? vessel3dInstRef.current.viewport.renderer.domElement
          : canvas2dRef.current;
    if (!cv) return;
    if (viewMode === '3d') {
      heart3dInstRef.current?.viewport.renderNow();
      vessel3dInstRef.current?.viewport.renderNow();
    }

    const barH = 64;
    const out = document.createElement('canvas');
    out.width = cv.width;
    out.height = cv.height + barH;
    const octx = out.getContext('2d');
    let url: string;
    if (octx) {
      octx.fillStyle = '#070b14';
      octx.fillRect(0, 0, out.width, out.height);
      octx.drawImage(cv, 0, 0);
      octx.strokeStyle = '#1e293b';
      octx.lineWidth = 2;
      octx.beginPath();
      octx.moveTo(0, cv.height);
      octx.lineTo(out.width, cv.height);
      octx.stroke();

      const headerTitle = `${appMode === 'cas' ? activeCase.titre : storyMoment.title} · ${storyMoment.label}`;
      const metricsLine = `FC ${fmt(computed.fcEff)}/min · PA ${fmt(computed.pas)}/${fmt(
        computed.pad
      )} mmHg · FE ${fmt(computed.fe * 100)} % · LDL ${fmt(computed.ldl, 2)} g/L · ${
        timelineBranch === 'untreated' ? 'Sans traitement' : 'Sous traitement'
      }`;
      octx.fillStyle = '#f8fafc';
      octx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      octx.fillText(headerTitle.slice(0, 74), 16, cv.height + 24);
      octx.fillStyle = '#94a3b8';
      octx.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace';
      octx.fillText(metricsLine, 16, cv.height + 46);
      octx.fillStyle = 'rgba(148, 163, 184, 0.72)';
      octx.font = '11px system-ui, -apple-system, sans-serif';
      octx.textAlign = 'right';
      octx.fillText('Atelier du Cœur · Dr O. Sow (Open Source MIT)', out.width - 16, cv.height + 24);
      octx.textAlign = 'left';
      url = out.toDataURL('image/png');
    } else {
      url = cv.toDataURL('image/png');
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = `atelier-coeur-${tab}-etape${timelineStep + 1}.png`;
    a.click();
    showToast('Image clinique annotée enregistrée (PNG)');
  }, [
    tab,
    viewMode,
    appMode,
    activeCase.titre,
    storyMoment,
    computed.fcEff,
    computed.pas,
    computed.pad,
    computed.fe,
    computed.ldl,
    timelineBranch,
    timelineStep,
    showToast,
  ]);

  const stopVideoRecorder = useCallback(() => {
    if (recordTimerRef.current !== null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
    }
    setIsRecordingVideo(false);
  }, []);

  const handleToggleVideoRecord = useCallback(() => {
    if (isRecordingVideo) {
      stopVideoRecorder();
      return;
    }

    const cv =
      viewMode === '3d' && tab === 'coeur' && heart3dInstRef.current
        ? heart3dInstRef.current.viewport.renderer.domElement
        : viewMode === '3d' && tab === 'vaisseau' && vessel3dInstRef.current
          ? vessel3dInstRef.current.viewport.renderer.domElement
          : canvas2dRef.current;
    if (!cv || typeof cv.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      showToast('Enregistrement vidéo non disponible sur ce navigateur');
      return;
    }

    try {
      const videoStream = cv.captureStream(30);
      const audioTracks = getAudioCaptureTracks(audioRef.current);
      if (audioTracks.length > 0 && !soundEnabled) {
        setSoundEnabled(true);
      }
      const combinedStream =
        audioTracks.length > 0
          ? new MediaStream([...videoStream.getVideoTracks(), ...audioTracks])
          : videoStream;

      const candidates =
        audioTracks.length > 0
          ? [
              'video/webm;codecs=vp9,opus',
              'video/webm;codecs=vp8,opus',
              'video/webm;codecs=vp9',
              'video/webm;codecs=vp8',
              'video/webm',
            ]
          : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m));

      let recorder: MediaRecorder;
      try {
        recorder = mimeType
          ? new MediaRecorder(combinedStream, { mimeType })
          : new MediaRecorder(combinedStream);
      } catch {
        recorder = new MediaRecorder(videoStream);
      }

      recordChunksRef.current = [];
      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          recordChunksRef.current.push(ev.data);
        }
      };
      recorder.onstop = () => {
        videoStream.getTracks().forEach((tr) => tr.stop());
        const chunks = recordChunksRef.current;
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `atelier-coeur-${tab}-etape${timelineStep + 1}.webm`;
          a.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 4000);
          showToast(
            audioTracks.length > 0
              ? 'Vidéo WebM avec son cardiaque enregistrée'
              : 'Vidéo WebM enregistrée'
          );
        }
        mediaRecorderRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecordingSeconds(0);
      setIsRecordingVideo(true);
      recordTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
      showToast(
        audioTracks.length > 0
          ? 'Enregistrement vidéo + audio cardiaque démarré'
          : 'Enregistrement vidéo démarré'
      );
    } catch {
      showToast('Impossible de démarrer l’enregistrement vidéo');
      setIsRecordingVideo(false);
    }
  }, [isRecordingVideo, stopVideoRecorder, viewMode, tab, timelineStep, soundEnabled, showToast]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current !== null) {
        window.clearInterval(recordTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleShare = useCallback(() => {
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        () => showToast('Lien copié dans le presse-papiers'),
        () => showToast('Lien prêt dans la barre d’adresse')
      );
    } else {
      showToast('Lien prêt dans la barre d’adresse');
    }
  }, [showToast]);

  const handleFullscreen = useCallback(() => {
    const el = stageWrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === 'Escape') {
        setModalCompId(null);
        setQuickCompId(null);
        setActiveLesionId(null);
        setShowKeys(false);
        setShowSources(false);
        setShowWelcome(false);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleStepFrame(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleStepFrame(1);
      } else if (e.key === '1') {
        handleSwitchTab('corps');
      } else if (e.key === '2') {
        handleSwitchTab('coeur');
      } else if (e.key === '3') {
        handleSwitchTab('vaisseau');
      } else if (e.key === 'l' || e.key === 'L') {
        setShowLabels((v) => !v);
      } else if (e.key === 's' || e.key === 'S') {
        handleToggleSound();
      } else if (e.key === 'r' || e.key === 'R') {
        handleResetAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleTogglePlay,
    handleStepFrame,
    handleSwitchTab,
    handleToggleSound,
    handleResetAll,
  ]);

  // 2D canvas pointer mapping (exact object-fit: contain projection)
  const toCanvasCoords = (
    e: React.MouseEvent<HTMLCanvasElement>,
    w: number,
    h: number
  ): [number, number] => {
    const cv = e.currentTarget;
    const rect = cv.getBoundingClientRect();
    const scale = Math.min(rect.width / w, rect.height / h);
    const drawnW = w * scale;
    const drawnH = h * scale;
    const ox = rect.left + (rect.width - drawnW) / 2;
    const oy = rect.top + (rect.height - drawnH) / 2;
    return [
      ((e.clientX - ox) / drawnW) * w,
      ((e.clientY - oy) / drawnH) * h,
    ];
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tab === 'corps') {
      const [x, y] = toCanvasCoords(e, 760, 560);
      const lesion = corpsLesionHit(x, y, effectiveParams, computed, storyOverlayRef.current);
      if (lesion) {
        setActiveLesionId(lesion);
        setQuickCompId(null);
        return;
      }
      const hit = corpsHit(x, y);
      if (!hit) {
        setActiveLesionId(null);
        return;
      }
      if (hit.kind === 'heart') {
        handleSwitchTab('coeur');
      } else {
        setParams((prev) => ({ ...prev, site: hit.site }));
        handleSwitchTab('vaisseau');
      }
    } else if (tab === 'coeur' && viewMode === '2d') {
      const [x, y] = toCanvasCoords(e, 1000, 800);
      const lesion = coeurLesionHit(x, y, effectiveParams, computed, storyOverlayRef.current);
      if (lesion) {
        setActiveLesionId(lesion);
        setQuickCompId(null);
        return;
      }
      setActiveLesionId(null);
      const id = coeurHit(x, y, level, effectiveParams);
      setQuickCompId(id);
    } else if (tab === 'vaisseau' && viewMode === '2d') {
      const [x, y] = toCanvasCoords(e, 880, 560);
      const lesion = vaisseauLesionHit(x, y, effectiveParams, storyOverlayRef.current);
      setActiveLesionId(lesion);
    }
  };

  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tab === 'corps') {
      const [x, y] = toCanvasCoords(e, 760, 560);
      const lesion = corpsLesionHit(x, y, effectiveParams, computed, storyOverlayRef.current);
      const hit = lesion || corpsHit(x, y);
      e.currentTarget.style.cursor = hit ? 'pointer' : 'default';
      return;
    }
    if (tab === 'coeur' && viewMode === '2d') {
      const [x, y] = toCanvasCoords(e, 1000, 800);
      const lesion = coeurLesionHit(x, y, effectiveParams, computed, storyOverlayRef.current);
      if (lesion) {
        setHoverCompId(null);
        setHoverPos(null);
        e.currentTarget.style.cursor = 'pointer';
        return;
      }
      const id = coeurHit(x, y, level, effectiveParams);
      setHoverCompId(id);
      setHoverPos(id ? { x: e.clientX, y: e.clientY } : null);
      e.currentTarget.style.cursor = id ? 'pointer' : 'default';
    } else if (tab === 'vaisseau' && viewMode === '2d') {
      const [x, y] = toCanvasCoords(e, 880, 560);
      const lesion = vaisseauLesionHit(x, y, effectiveParams, storyOverlayRef.current);
      e.currentTarget.style.cursor = lesion ? 'pointer' : 'default';
    } else {
      e.currentTarget.style.cursor = 'default';
    }
  };

  const expl = useMemo(
    () => explain(tab, effectiveParams, dynState, computed),
    [tab, effectiveParams, dynState, computed]
  );

  const canvasDims =
    tab === 'corps'
      ? { w: 760, h: 560 }
      : tab === 'coeur'
        ? { w: 1000, h: 800 }
        : { w: 880, h: 560 };

  const phaseBtns = [
    { lbl: 'P', idx: 0, title: 'Onde P (contraction oreillettes)' },
    { lbl: 'B1', idx: 1, title: 'Fermeture mitrale & tricuspide (B1)' },
    { lbl: 'Éj', idx: 2, title: 'Ouverture aortique & éjection' },
    { lbl: 'B2', idx: 3, title: 'Fermeture aortique & pulmonaire (B2)' },
    { lbl: 'Rem', idx: 4, title: 'Remplissage ventriculaire' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--txt)]">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[#0b1120]/95 px-3 py-2">
        <div className="mx-auto flex max-w-[1460px] flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-400/35 text-sm font-bold"
              aria-hidden="true"
            >
              ♥
            </span>
            <div>
              <h1 className="text-[14px] font-semibold tracking-tight text-[var(--txt)] leading-tight">
                L’Atelier du Cœur et de la Circulation
              </h1>
              <p className="hidden sm:block text-[11px] text-[var(--muted)] leading-tight">
                De la circulation générale à la paroi d’une artère en coupe
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Level Switch */}
            <div
              className="flex items-center rounded-lg border border-[var(--line)] bg-[var(--panel)] p-0.5"
              role="group"
              aria-label="Niveau de détail"
            >
              {([1, 2, 3] as ViewLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                    level === lvl
                      ? 'bg-[var(--card2)] text-[var(--accent)]'
                      : 'text-[var(--muted)] hover:text-[var(--txt)]'
                  }`}
                >
                  {lvl === 1 ? '1 · Découvrir' : lvl === 2 ? '2 · Comprendre' : '3 · Expert'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowLabels((v) => !v)}
              title="Afficher/masquer les repères (L)"
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                showLabels
                  ? 'border-sky-400/45 bg-sky-500/15 text-sky-200'
                  : 'border-[var(--line)] bg-[var(--card)] text-[var(--muted)]'
              }`}
            >
              <Tag className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Repères</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              title="Copier le lien vers ce scénario"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--card)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--txt)]"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Partager</span>
            </button>

            <button
              type="button"
              onClick={handleCapturePng}
              title="Enregistrer une image PNG de la scène"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--card)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--txt)]"
            >
              <Camera className="h-3.5 w-3.5" />
              <span className="hidden md:inline">PNG</span>
            </button>

            <button
              type="button"
              onClick={() => setShowKeys(true)}
              aria-label="Raccourcis clavier"
              className="inline-flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--card)] p-1.5 text-[var(--muted)] hover:text-[var(--txt)]"
            >
              <Keyboard className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowSources(true)}
              aria-label="À propos et sources"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--card)] px-2 py-1.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--txt)]"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sources</span>
            </button>
          </div>
        </div>
      </header>

      {/* Zoom tabs, Mode Switcher & mobile sheet tabs */}
      <div className="border-b border-[var(--line)] bg-[var(--panel)] px-3 py-1.5">
        <div className="mx-auto flex max-w-[1460px] flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* App Mode Switch: Pathologies à soigner vs Exploration libre */}
            <div
              className="flex items-center rounded-lg border border-[var(--line2)] bg-[var(--bg)] p-0.5"
              role="group"
              aria-label="Mode de travail"
            >
              <button
                type="button"
                onClick={() => handleSwitchAppMode('cas')}
                className={`rounded-md px-2.5 py-1 text-[11.5px] font-bold whitespace-nowrap transition ${
                  appMode === 'cas'
                    ? 'bg-[var(--accent)] text-slate-950'
                    : 'text-[var(--muted)] hover:text-[var(--txt)]'
                }`}
              >
                Pathologies à soigner
              </button>
              <button
                type="button"
                onClick={() => handleSwitchAppMode('libre')}
                className={`rounded-md px-2.5 py-1 text-[11.5px] font-bold whitespace-nowrap transition ${
                  appMode === 'libre'
                    ? 'bg-[var(--card2)] text-sky-200'
                    : 'text-[var(--muted)] hover:text-[var(--txt)]'
                }`}
              >
                Exploration libre
              </button>
            </div>

            <nav className="flex flex-wrap gap-1" aria-label="Échelle d'observation">
              {(
                [
                  { id: 'corps', lbl: '1 · Corps entier' },
                  { id: 'coeur', lbl: '2 · Cœur' },
                  { id: 'vaisseau', lbl: '3 · Vaisseau' },
                ] as { id: TabId; lbl: string }[]
              ).map((tItem) => (
                <button
                  key={tItem.id}
                  type="button"
                  onClick={() => handleSwitchTab(tItem.id)}
                  className={`rounded-lg border px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap transition ${
                    tab === tItem.id
                      ? 'border-sky-400/70 bg-sky-500/20 text-[var(--txt)]'
                      : 'border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--txt)]'
                  }`}
                >
                  {tItem.lbl}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center rounded-lg border border-[var(--line)] bg-[var(--bg)] p-0.5 text-[11px]">
              {(['complet', 'equilibre', 'leger'] as DisplayProfile[]).map((pr) => (
                <button
                  key={pr}
                  type="button"
                  onClick={() => setProfile(pr)}
                  className={`rounded-md px-2 py-0.5 font-medium capitalize transition ${
                    profile === pr
                      ? 'bg-[var(--card)] text-[var(--txt)]'
                      : 'text-[var(--dim)] hover:text-[var(--muted)]'
                  }`}
                >
                  {pr === 'equilibre' ? 'Équilibré' : pr === 'leger' ? 'Léger' : 'Complet'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile/Tablet switcher so canvas stays immediately accessible */}
        <div
          className={`mt-1.5 grid gap-1 lg:hidden ${
            appMode === 'libre' ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          {(appMode === 'libre'
            ? ([
                { id: 'scene', lbl: 'Scène' },
                { id: 'ex', lbl: 'Exemples' },
                { id: 'ctl', lbl: 'Réglages' },
              ] as const)
            : ([
                { id: 'scene', lbl: 'Scène' },
                { id: 'ctl', lbl: 'Prescription' },
              ] as const)
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setMobileSheet(s.id);
                if (s.id === 'ex' || s.id === 'ctl') setPane(s.id);
              }}
              className={`rounded-md border py-1 text-[11px] font-semibold ${
                mobileSheet === s.id
                  ? 'border-sky-400/60 bg-sky-500/20 text-sky-100'
                  : 'border-[var(--line)] bg-[var(--card)] text-[var(--muted)]'
              }`}
            >
              {s.lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace */}
      <main
        className={`mx-auto grid w-full max-w-[1460px] flex-1 grid-cols-1 gap-3 p-3 ${
          sidebarOpen ? 'lg:grid-cols-[340px_1fr]' : 'lg:grid-cols-1'
        }`}
      >
        {/* Left Control Panel */}
        <div
          className={
            mobileSheet === 'scene'
              ? sidebarOpen
                ? 'hidden lg:block'
                : 'hidden'
              : 'block'
          }
        >
          <ControlPanel
            appMode={appMode}
            pane={pane}
            onChangePane={setPane}
            tab={tab}
            level={level}
            p={params}
            d={dynState}
            r={computed}
            activeExId={activeExId}
            onSelectExample={(id) => {
              handleSelectExample(id);
              setMobileSheet('scene');
            }}
            onUpdateSlider={(k, val) => {
              if (appMode === 'libre') setActiveExId('personnalise');
              setParams((prev) => ({ ...prev, [k]: val }));
            }}
            onToggleMaladie={(mid) => {
              if (appMode === 'libre') setActiveExId('personnalise');
              setParams((prev) => {
                const nextVal = !prev.mal[mid];
                const nextMal = { ...prev.mal, [mid]: nextVal };
                let nextFc = prev.fc;
                if (mid === 'fa') {
                  if (nextVal && prev.fc === C.normal.fc) {
                    nextFc = C.maladies.fa.fcVentriculaire;
                  } else if (!nextVal && prev.fc === C.maladies.fa.fcVentriculaire) {
                    nextFc = C.normal.fc;
                  }
                }
                const nextPlaque =
                  mid === 'dyslipidemie' && nextVal && prev.plaque === 0
                    ? 1
                    : prev.plaque;
                return { ...prev, mal: nextMal, fc: nextFc, plaque: nextPlaque };
              });
            }}
            onToggleTraitement={(tid) => {
              if (appMode === 'libre') setActiveExId('personnalise');
              setParams((prev) => {
                setCompareUntreated(false);
                if (prev.asso && C.associations[prev.asso]) {
                  const A = C.associations[prev.asso];
                  if (A.composants.includes(tid)) {
                    // Unpack fixed association cleanly into individual meds when toggling one of its components
                    const unpacked = { ...prev.trt };
                    const unpackedDose = { ...prev.dose };
                    const pr =
                      A.presentations.find((x) => x.id === (prev.pres || {})[prev.asso!]) ||
                      A.presentations[0];
                    A.composants.forEach((k) => {
                      unpacked[k as TraitementId] = true;
                    });
                    if (pr) Object.assign(unpackedDose, pr.doses);
                    unpacked[tid] = false;
                    return { ...prev, asso: null, trt: unpacked, dose: unpackedDose };
                  }
                }
                return {
                  ...prev,
                  trt: { ...prev.trt, [tid]: !prev.trt[tid] },
                };
              });
            }}
            onSetDose={(tid, dose) => {
              if (appMode === 'libre') setActiveExId('personnalise');
              setParams((prev) => ({
                ...prev,
                dose: { ...prev.dose, [tid]: dose },
              }));
            }}
            onSelectAsso={(aid) => {
              if (appMode === 'libre') setActiveExId('personnalise');
              setCompareUntreated(false);
              setParams((prev) => ({ ...prev, asso: aid }));
            }}
            onSelectPres={(aid, presId) => {
              if (appMode === 'libre') setActiveExId('personnalise');
              setCompareUntreated(false);
              setParams((prev) => ({
                ...prev,
                pres: { ...prev.pres, [aid]: presId },
              }));
            }}
            onTriggerEmbol={() => {
              corpsStateRef.current.embolActive = true;
              corpsStateRef.current.embolProgress = 0;
              corpsStateRef.current.embolArrived = false;
              setPlaying(true);
              setMobileSheet('scene');
            }}
            onSelectSite={(site: VesselSiteId) => {
              if (appMode === 'libre') setActiveExId('personnalise');
              setParams((prev) => ({ ...prev, site }));
            }}
            onToggleDysEndo={() => {
              if (appMode === 'libre') setActiveExId('personnalise');
              setParams((prev) => ({ ...prev, dysEndo: !prev.dysEndo }));
            }}
            onSetPlaque={(st) => {
              if (appMode === 'libre') setActiveExId('personnalise');
              handleSetPlaque(st);
            }}
            onPickComponent={(cid) => setQuickCompId(cid)}
            onQuickAction={(id, action) => {
              if (appMode === 'libre') setActiveExId('personnalise');
              handleQuickAction(id, action);
            }}
            onToggleExtraRythme={(mode) => {
              if (appMode === 'libre') setActiveExId('personnalise');
              setParams((prev) => ({
                ...prev,
                extraRythme: prev.extraRythme === mode ? null : mode,
              }));
            }}
            onToggleEffort={() => {
              if (appMode === 'libre') setActiveExId('personnalise');
              setParams((prev) => ({ ...prev, effort: !prev.effort }));
            }}
            onResetAll={handleResetAll}
          />
        </div>

        {/* Right Stage + Telemetry */}
        <section
          className={`flex flex-col gap-2.5 ${
            mobileSheet !== 'scene' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Clinical Mission Briefing & Verdict (Pathologies à soigner mode) */}
          {appMode === 'cas' && (
            <MissionBriefCard
              cases={CLINICAL_CASES}
              activeCase={activeCase}
              onSelectCase={handleSelectCase}
              computed={treatedComputed}
              evaluation={caseEvaluation}
              showEvaluation={showEvaluation}
              onValidate={() => {
                setShowEvaluation(true);
                setTimelineBranch('treated');
              }}
              hintIndex={hintIndex}
              onNextHint={() => setHintIndex((i) => i + 1)}
              auscultBlind={auscultBlind}
              auscultGuess={auscultGuess}
              onToggleAuscultBlind={() => {
                setAuscultBlind((v) => !v);
                if (!auscultBlind && tab !== 'coeur') handleSwitchTab('coeur');
              }}
              onGuessValve={(v) => setAuscultGuess(v)}
              onToggleSound={handleToggleSound}
              soundEnabled={soundEnabled}
            />
          )}

          {/* Triggered Event Banner */}
          {bannerMsg && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-400/50 bg-amber-950/35 px-3 py-2 text-[12px] text-amber-100">
              <span>{bannerMsg}</span>
              <button
                type="button"
                onClick={() => setBannerMsg(null)}
                className="shrink-0 text-[11px] font-semibold text-amber-300 hover:underline"
              >
                Masquer
              </button>
            </div>
          )}

          {/* Main Interactive Stage */}
          <div
            ref={stageWrapRef}
            className="relative flex flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]"
          >
            <div className="stage-grid-bg relative h-[360px] sm:h-[420px] lg:h-[440px] w-full flex items-center justify-center overflow-hidden">
              {(tab === 'corps' || viewMode === '2d') && (
                <canvas
                  ref={canvas2dRef}
                  onClick={handleCanvasClick}
                  onMouseMove={handleCanvasMove}
                  onMouseLeave={() => {
                    setHoverCompId(null);
                    setHoverPos(null);
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                  width={canvasDims.w}
                  height={canvasDims.h}
                />
              )}

              {viewMode === '3d' && tab !== 'corps' && (
                <div ref={stage3dRef} className="h-full w-full" />
              )}

              {/* Sidebar Collapse Toggle + 3D Heart mode bar */}
              <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSidebarOpen((v) => !v)}
                  title={sidebarOpen ? 'Replier le panneau latéral' : 'Afficher le panneau latéral'}
                  className="hidden lg:inline-flex items-center gap-1 rounded-lg border border-[var(--line2)] bg-[#090e1c]/95 px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--txt)]"
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  ) : (
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                  )}
                  <span>{sidebarOpen ? 'Panneau' : 'Ouvrir panneau'}</span>
                </button>

                {viewMode === '3d' && tab === 'coeur' && (
                  <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--line2)] bg-[#090e1c]/95 p-1">
                    {(
                      [
                        { id: 'exterieur', lbl: 'Extérieur' },
                        { id: 'coupe', lbl: 'Coupe' },
                        { id: 'transparent', lbl: 'Transparent' },
                      ] as { id: Heart3DMode; lbl: string }[]
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setHeart3dMode(m.id)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                          heart3dMode === m.id
                            ? 'bg-[var(--accent)] text-slate-950'
                            : 'text-[var(--muted)] hover:text-[var(--txt)]'
                        }`}
                      >
                        {m.lbl}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        heart3dInstRef.current?.viewport.setView([0.3, 0.25, 6.2], [0, 0.05, 0])
                      }
                      className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--txt)]"
                    >
                      Recentrer
                    </button>
                  </div>
                )}
              </div>

              {/* Hover tooltip for clickable heart parts */}
              {tab === 'coeur' && hoverCompId && hoverPos && COMP[hoverCompId] && !quickCompId && (
                <div
                  className="pointer-events-none fixed z-40 rounded-md border border-sky-400/50 bg-[#070b14]/95 px-2.5 py-1 text-[11px] font-semibold text-sky-100 shadow-lg"
                  style={{ left: hoverPos.x + 12, top: hoverPos.y - 26 }}
                >
                  {COMP[hoverCompId].nom} · cliquer pour agir
                </div>
              )}

              {/* Quick-Action Floating Popover on clicked heart part */}
              {tab === 'coeur' && quickCompId && COMP[quickCompId] && (
                <div className="absolute bottom-3 left-3 z-20 w-[min(320px,calc(100%-24px))] rounded-xl border border-sky-400/50 bg-[#090e1c]/95 p-3 shadow-2xl">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                        {COMP[quickCompId].k}
                      </div>
                      <div className="text-[13px] font-semibold text-[var(--txt)]">
                        {COMP[quickCompId].nom}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuickCompId(null)}
                      aria-label="Fermer l’action rapide"
                      className="rounded border border-[var(--line)] bg-[var(--card)] p-1 text-[var(--muted)] hover:text-[var(--txt)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-1.5 text-[11px] text-[var(--muted)] leading-snug">
                    {nowHTML(quickCompId, clkRef.current, effectiveParams, computed).vals.join(' · ')}
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {actsFor(quickCompId).map((a) => {
                      const active = actOf(quickCompId, params) === a;
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => handleQuickAction(quickCompId, active ? null : a)}
                          className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${
                            active
                              ? 'border-red-400/70 bg-red-500/25 text-red-100'
                              : 'border-[var(--line2)] bg-[var(--card)] text-[var(--txt)] hover:border-amber-400/60'
                          }`}
                        >
                          {ACT_LBL[a]}
                        </button>
                      );
                    })}
                    {actOf(quickCompId, params) && (
                      <button
                        type="button"
                        onClick={() => handleQuickAction(quickCompId, null)}
                        className="rounded-md border border-emerald-400/60 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100"
                      >
                        Réparer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setModalCompId(quickCompId);
                        setQuickCompId(null);
                      }}
                      className="ml-auto rounded-md border border-sky-400/45 bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/25"
                    >
                      Fiche →
                    </button>
                  </div>
                </div>
              )}

              {/* Direct Clickable Lesion / Clot Action Popover */}
              {activeLesionId && (
                <SceneLesionPopover
                  lesionId={activeLesionId}
                  params={effectiveParams}
                  appMode={appMode}
                  activeCase={appMode === 'cas' ? activeCase : null}
                  onClose={() => setActiveLesionId(null)}
                  onApplyProtocol={() => {
                    handleApplyTargetedProtocol();
                    setActiveLesionId(null);
                  }}
                  onAnticoagulate={() => {
                    setParams((prev) => ({
                      ...prev,
                      trt: { ...prev.trt, anticoagulant: true },
                    }));
                    setTimelineBranch('treated');
                    setCompareUntreated(false);
                    showToast('Anticoagulant activé : résorption du caillot en cours');
                    setActiveLesionId(null);
                  }}
                  onTriggerFAEmbol={() => {
                    setActiveLesionId(null);
                    if (tab !== 'corps') handleSwitchTab('corps');
                    corpsStateRef.current.embolActive = true;
                    corpsStateRef.current.embolProgress = 0;
                    corpsStateRef.current.embolArrived = false;
                    setPlaying(true);
                    showToast('Migration du caillot vers le cerveau déclenchée');
                  }}
                  onRemoveFA={() => {
                    setParams((prev) => ({
                      ...prev,
                      fc: prev.fc === C.maladies.fa.fcVentriculaire ? C.normal.fc : prev.fc,
                      mal: { ...prev.mal, fa: false },
                    }));
                    setActiveLesionId(null);
                    showToast('Fibrillation auriculaire arrêtée');
                  }}
                  onClearOcclusion={(lesion) => {
                    setParams((prev) => {
                      if (lesion === 'coro-iva' || lesion === 'coro-cx' || lesion === 'coro-cd') {
                        const k = lesion.replace('coro-', '') as 'iva' | 'cx' | 'cd';
                        return {
                          ...prev,
                          mal: { ...prev.mal, idm: false },
                          act: { ...prev.act, [k]: null },
                          plaque: prev.plaque >= 6 ? 4 : prev.plaque,
                        };
                      }
                      if (lesion === 'pulm-emb') {
                        return {
                          ...prev,
                          fail: prev.fail === 'ap' ? null : prev.fail,
                          act: { ...prev.act, ap: null },
                        };
                      }
                      if (lesion === 'ivc-clot') {
                        return {
                          ...prev,
                          fail: prev.fail === 'vcaves' ? null : prev.fail,
                          act: { ...prev.act, vcaves: null },
                        };
                      }
                      if (lesion === 'avc-clot') {
                        return { ...prev, mal: { ...prev.mal, avc: false } };
                      }
                      if (lesion === 'leg-clot') {
                        return {
                          ...prev,
                          ischJambe: false,
                          plaque: prev.plaque >= 6 ? 4 : prev.plaque,
                        };
                      }
                      return prev;
                    });
                    setBannerMsg(null);
                    setActiveLesionId(null);
                    showToast('Artère / vaisseau reperfusé');
                  }}
                  onOpenVesselSite={(site) => {
                    setParams((prev) => ({ ...prev, site }));
                    setActiveLesionId(null);
                    handleSwitchTab('vaisseau');
                  }}
                  onAdvancePlaque={() => {
                    handleSetPlaque(Math.min(6, params.plaque + 1));
                  }}
                  onDissolvePlaque={() => {
                    handleSetPlaque(0);
                    setActiveLesionId(null);
                    showToast('Artère revenue à l’état sain (stade 0)');
                  }}
                  onToggleEffort={() => {
                    setParams((prev) => ({ ...prev, effort: !prev.effort }));
                  }}
                  onRepairValve={(valve) => {
                    setParams((prev) => ({
                      ...prev,
                      mal: valve === 'aortique' ? { ...prev.mal, ra: false } : prev.mal,
                      act: { ...prev.act, [valve]: null },
                    }));
                    setActiveLesionId(null);
                    showToast(`Valve ${valve} réparée / remplacée`);
                  }}
                  onOpenComponentModal={(cid) => {
                    setModalCompId(cid);
                    setActiveLesionId(null);
                  }}
                />
              )}

              {/* Legend toggle */}
              <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowLegend((v) => !v)}
                  className="rounded-md border border-[var(--line2)] bg-[#090e1c]/95 px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--txt)]"
                >
                  {showLegend ? 'Masquer légende' : 'Légende'}
                </button>
                {showLegend && (
                  <div className="w-60 rounded-lg border border-[var(--line2)] bg-[#090e1c]/95 p-2.5 text-[11px] space-y-1 text-[var(--muted)] shadow-xl">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                      <span>Sang oxygéné (artériel)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      <span>Sang pauvre en O₂ (veineux)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                      <span>Tissu nodal électrique (niv. 2–3)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-800 ring-1 ring-amber-400" />
                      <span>Caillot / plaque / calcification (cliquable)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                      <span>Vasodilatation / NO / ECG</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Vaisseau quick-step strip (Niveau 2+) */}
            {tab === 'vaisseau' && level >= 2 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--card)] px-3 py-1.5">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-semibold text-[var(--muted)]">Athérosclérose :</span>
                  {[0, 1, 2, 3, 4, 5, 6].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleSetPlaque(st)}
                      className={`mono h-6 w-6 rounded border text-[11px] font-semibold ${
                        params.plaque === st
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
                <button
                  type="button"
                  onClick={() =>
                    handleSetPlaque(params.plaque >= 6 ? 0 : params.plaque + 1)
                  }
                  className="rounded-md border border-sky-400/50 bg-sky-500/20 px-2.5 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/30"
                >
                  {params.plaque >= 6 ? 'Revenir à l’artère saine (0)' : 'Étape suivante →'}
                </button>
              </div>
            )}

            {/* Timeline Beat Scrubber (Niveau 2+) */}
            {(tab === 'coeur' || tab === 'vaisseau') && level >= 2 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[#0b1120] px-3 py-1.5">
                <div className="flex items-center gap-1">
                  {phaseBtns.map((pb) => (
                    <button
                      key={pb.lbl}
                      type="button"
                      title={pb.title}
                      onClick={() => handleJumpPhaseKey(pb.idx)}
                      className="mono rounded border border-[var(--line)] bg-[var(--card)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)] hover:border-sky-400/50 hover:text-[var(--txt)]"
                    >
                      {pb.lbl}
                    </button>
                  ))}
                </div>

                <div className="flex flex-1 items-center gap-1.5 min-w-[160px]">
                  <button
                    type="button"
                    aria-label="Image précédente"
                    onClick={() => handleStepFrame(-1)}
                    className="rounded border border-[var(--line)] bg-[var(--card)] p-1 text-[var(--muted)] hover:text-[var(--txt)]"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <input
                    ref={tlInputRef}
                    type="range"
                    aria-label="Position dans le battement cardiaque"
                    className="atelier-range flex-1"
                    min={0}
                    max={1000}
                    defaultValue={0}
                    onChange={(e) => handleScrub(Number(e.target.value) / 1000)}
                  />
                  <button
                    type="button"
                    aria-label="Image suivante"
                    onClick={() => handleStepFrame(1)}
                    className="rounded border border-[var(--line)] bg-[var(--card)] p-1 text-[var(--muted)] hover:text-[var(--txt)]"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <span
                  ref={tlPhaseRef}
                  className="text-[11px] font-medium text-[var(--accent)] min-w-[175px] text-right"
                >
                  Cycle cardiaque
                </span>
              </div>
            )}

            {/* Transport & Readout Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--panel)] px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {tab !== 'corps' && (
                  <div
                    className="flex rounded-lg border border-[var(--line)] bg-[var(--bg)] p-0.5"
                    role="group"
                    aria-label="Mode 2D ou 3D"
                  >
                    {(['2d', '3d'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setViewMode(m)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-bold uppercase ${
                          viewMode === m
                            ? 'bg-[var(--accent)] text-slate-950'
                            : 'text-[var(--muted)] hover:text-[var(--txt)]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line2)] bg-[var(--card)] px-3 py-1 text-[12px] font-semibold text-[var(--txt)] hover:border-sky-400 whitespace-nowrap"
                >
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {playing ? 'Pause' : 'Lecture'}
                </button>

                <button
                  type="button"
                  onClick={handleToggleSound}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] font-semibold transition whitespace-nowrap ${
                    soundEnabled
                      ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                      : 'border-[var(--line)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--txt)]'
                  }`}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" />
                  )}
                  <span>Son</span>
                </button>

                <div className="flex items-center rounded-lg border border-[var(--line)] bg-[var(--bg)] p-0.5">
                  {SPEEDS.map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => setSpeed(sp)}
                      className={`mono rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                        speed === sp
                          ? 'bg-[var(--card2)] text-[var(--accent)]'
                          : 'text-[var(--dim)] hover:text-[var(--muted)]'
                      }`}
                    >
                      ×{String(sp).replace('.', ',')}
                    </button>
                  ))}
                </div>

                {appMode === 'libre' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveExId('personnalise');
                      setParams((prev) => ({ ...prev, effort: !prev.effort }));
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition whitespace-nowrap ${
                      params.effort
                        ? 'border-sky-400/70 bg-sky-500/25 text-sky-100'
                        : 'border-[var(--line)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--txt)]'
                    }`}
                  >
                    {params.effort ? 'Effort actif' : 'Repos ↔ Effort'}
                  </button>
                )}

                {trtImpact && (
                  <button
                    type="button"
                    onClick={() => setCompareUntreated((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition whitespace-nowrap ${
                      compareUntreated
                        ? 'border-amber-400/70 bg-amber-500/25 text-amber-100'
                        : 'border-sky-400/45 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    <span>{compareUntreated ? 'Vue : Sans traitement' : 'Comparer sans trt'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResetAll}
                  title="Réinitialiser (R)"
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--card)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--txt)] whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Réinitialiser</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span
                  ref={liveReadoutRef}
                  className="mono text-[12px] font-medium text-[var(--txt)]"
                >
                  FC {fmt(computed.fcEff)}/min · PA {fmt(computed.pas)}/{fmt(computed.pad)} mmHg · DC{' '}
                  {fmt(computed.dc, 1)} L/min · FE {fmt(computed.fe * 100)} %
                </span>
                <button
                  type="button"
                  onClick={handleFullscreen}
                  aria-label="Plein écran"
                  className="rounded-md border border-[var(--line)] bg-[var(--card)] p-1 text-[var(--muted)] hover:text-[var(--txt)]"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Chronological Consequence Timeline & Clinical Storyboard */}
          <ConsequenceTimelineDock
            step={timelineStep}
            branch={timelineBranch}
            projection={timelineProjection}
            moment={storyMoment}
            storyPlaying={storyPlaying}
            storyAutoPause={storyAutoPause}
            storyAlternate={storyAlternate}
            inspectionPaused={inspectionPaused}
            isRecordingVideo={isRecordingVideo}
            recordingSeconds={recordingSeconds}
            onChangeStep={handleChangeTimelineStep}
            onChangeBranch={handleChangeTimelineBranch}
            onStepPrev={handleStepPrev}
            onStepNext={handleStepNext}
            onToggleStoryPlay={handleToggleStoryPlay}
            onToggleAutoPause={() => setStoryAutoPause((v) => !v)}
            onToggleAlternate={() => {
              setStoryAlternate((v) => !v);
              alternateDoneRef.current = false;
            }}
            onInspectZone={handleInspectZone}
            onCapturePng={handleCapturePng}
            onToggleVideoRecord={handleToggleVideoRecord}
          />

          {/* Bottom Explanation + Targeted Treatment / Vitals / Charts Deck */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_1fr]">
            <div className="flex flex-col gap-3">
              {/* Explanation Card */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[15px] font-semibold text-[var(--txt)]">{expl.title}</h2>
                  <span className="mono text-[11px] text-[var(--accent)]">
                    {rythmeName(computed)}
                  </span>
                </div>

                {expl.status && (
                  <div className="rounded-md border border-amber-400/35 bg-amber-950/25 px-2.5 py-1.5 text-[12px] font-medium text-amber-200">
                    {expl.status}
                  </div>
                )}

                <div className="space-y-1.5 text-[13px] leading-relaxed text-[var(--txt)]">
                  {expl.paragraphs.map((para, idx) => (
                    <p key={idx} className={idx > 0 ? 'text-[var(--muted)]' : ''}>
                      {para}
                    </p>
                  ))}
                </div>

                {level >= 2 && expl.why && (
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-2.5 text-[12px] leading-relaxed text-[var(--muted)]">
                    <span className="font-semibold text-sky-300">Pourquoi ? </span>
                    {expl.why}
                  </div>
                )}

                {level === 3 && (
                  <div className="mono space-y-0.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2.5 text-[11px] text-[var(--muted)]">
                    {expl.xpLines.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Targeted Treatment Card Directly Under Explanation */}
              {activeProtocol && (
                <div className="rounded-xl border border-emerald-400/35 bg-[var(--panel)] p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Pill className="h-4 w-4 text-emerald-300 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-300">
                          Conduite & traitement ciblé
                        </div>
                        <div className="text-[13px] font-semibold text-[var(--txt)] truncate">
                          {activeProtocol.conditionTitle}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyTargetedProtocol}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-bold whitespace-nowrap shrink-0 transition ${
                        protocolApplied
                          ? 'border border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                          : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>
                        {protocolApplied ? 'Protocole actif ✓' : 'Appliquer le protocole'}
                      </span>
                    </button>
                  </div>

                  <p className="text-[12px] leading-relaxed text-[var(--muted)]">
                    {activeProtocol.summary}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {activeProtocol.classes.map((cls, idx) => (
                        <span
                          key={idx}
                          className="rounded-md border border-[var(--line)] bg-[var(--card)] px-2 py-0.5 font-medium text-[var(--txt)]"
                        >
                          {cls}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] shrink-0">
                      <button
                        type="button"
                        onClick={() => handleChangeTimelineBranch('untreated')}
                        className={`rounded-md border px-2 py-1 font-semibold whitespace-nowrap ${
                          timelineBranch === 'untreated'
                            ? 'border-red-400/60 bg-red-500/20 text-red-100'
                            : 'border-[var(--line)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--txt)]'
                        }`}
                      >
                        Voir sans traitement
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeTimelineBranch('treated')}
                        className={`rounded-md border px-2 py-1 font-semibold whitespace-nowrap ${
                          timelineBranch === 'treated'
                            ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                            : 'border-[var(--line)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--txt)]'
                        }`}
                      >
                        Voir avec traitement
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Telemetry / Live Graph Card */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5 flex flex-col justify-between gap-2.5">
              {/* Crisp Avant -> Après Treatment Impact Banner (when any medication is active) */}
              {trtImpact && !compareUntreated && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-400/40 bg-emerald-950/25 px-2.5 py-1.5 text-[11px]">
                  <span className="font-semibold text-emerald-200">
                    Impact du traitement :
                  </span>
                  <div className="mono flex flex-wrap items-center gap-x-3 gap-y-0.5 text-emerald-100">
                    <span>
                      PA {fmt(trtImpact.baseline.pas)}/{fmt(trtImpact.baseline.pad)} →{' '}
                      <strong>
                        {fmt(trtImpact.all.pas)}/{fmt(trtImpact.all.pad)}
                      </strong>{' '}
                      mmHg
                    </span>
                    {trtImpact.oedemeSoloICa > 0.05 && trtImpact.all.raa > 0 && (
                      <span className="text-sky-200">Œdème −55 %</span>
                    )}
                    {Math.abs(trtImpact.all.congestion - trtImpact.baseline.congestion) > 0.08 && (
                      <span className="text-amber-200">
                        POG {fmt(trtImpact.baseline.pog)} → {fmt(trtImpact.all.pog)}
                      </span>
                    )}
                    {trtImpact.all.tr.statine && (
                      <span className="text-amber-200">
                        LDL {fmt(trtImpact.baseline.ldl, 2)} → {fmt(trtImpact.all.ldl, 2)} g/L
                      </span>
                    )}
                  </div>
                </div>
              )}

              {tab === 'corps' ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-2.5">
                      <div className="text-[11px] text-[var(--muted)]">Pression artérielle</div>
                      <div className="mono mt-0.5 text-[16px] font-semibold text-[var(--txt)]">
                        {fmt(computed.pas)}/{fmt(computed.pad)}{' '}
                        <span className="text-[11px] font-normal text-[var(--dim)]">mmHg</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-2.5">
                      <div className="text-[11px] text-[var(--muted)]">Débit cardiaque</div>
                      <div className="mono mt-0.5 text-[16px] font-semibold text-[var(--txt)]">
                        {fmt(computed.dc, 1)}{' '}
                        <span className="text-[11px] font-normal text-[var(--dim)]">L/min</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-2.5">
                      <div className="text-[11px] text-[var(--muted)]">Fraction d’éjection</div>
                      <div className="mono mt-0.5 text-[16px] font-semibold text-[var(--txt)]">
                        {fmt(computed.fe * 100)} %
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-2.5">
                      <div className="text-[11px] text-[var(--muted)]">LDL-cholestérol</div>
                      <div className="mono mt-0.5 text-[15px] font-semibold text-[var(--txt)]">
                        {fmt(computed.ldl, 2)}{' '}
                        <span className="text-[11px] font-normal text-[var(--dim)]">g/L</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-2.5">
                      <div className="text-[11px] text-[var(--muted)]">O₂ artériel (SpO₂)</div>
                      <div className="mono mt-0.5 text-[15px] font-semibold text-[var(--txt)]">
                        {fmt(computed.satArt)} %
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-2.5">
                      <div className="text-[11px] text-[var(--muted)]">Congestion (POG)</div>
                      <div className="mono mt-0.5 text-[15px] font-semibold text-[var(--txt)]">
                        {fmt(computed.pog)} mmHg
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-2.5 text-[12px] text-[var(--muted)]">
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--dim)]">
                      Organes cibles
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        Cerveau :{' '}
                        <span className={params.mal.avc ? 'text-red-300 font-semibold' : 'text-emerald-300'}>
                          {params.mal.avc ? 'AVC ischémique' : 'Normal'}
                        </span>
                      </div>
                      <div>
                        Poumons :{' '}
                        <span
                          className={
                            computed.pog >= C.moteur.seuilOAP
                              ? 'text-red-300 font-semibold'
                              : computed.congestion > 0.25
                                ? 'text-amber-300 font-semibold'
                                : 'text-emerald-300'
                          }
                        >
                          {computed.pog >= C.moteur.seuilOAP
                            ? 'Œdème pulmonaire'
                            : computed.congestion > 0.25
                              ? 'Congestion'
                              : 'Clairs'}
                        </span>
                      </div>
                      <div>
                        Reins :{' '}
                        <span className={computed.rein > 0.25 ? 'text-orange-300 font-semibold' : 'text-emerald-300'}>
                          {computed.rein > 0.25 ? 'Souffrance' : 'Normaux'}
                        </span>
                      </div>
                      <div>
                        Chevilles :{' '}
                        <span className={computed.oedeme > 0.15 ? 'text-sky-300 font-semibold' : 'text-emerald-300'}>
                          {computed.oedeme > 0.15 ? 'Œdèmes' : 'Normales'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                    <span className="font-semibold text-[var(--txt)]">
                      {tab === 'coeur'
                        ? heartChartMode === 'pv'
                          ? 'Boucle Pression–Volume VG'
                          : 'Diagramme de Wiggers & Boucle P–V'
                        : `Onde de pression · ${SITES[params.site].nom}`}
                    </span>
                    <div className="flex items-center gap-2">
                      {tab === 'coeur' && (
                        <div className="flex items-center rounded-md border border-[var(--line)] bg-[var(--bg)] p-0.5 text-[10.5px]">
                          {(
                            [
                              { id: 'wiggers', lbl: 'Wiggers' },
                              { id: 'pv', lbl: 'Boucle P–V' },
                              { id: 'both', lbl: 'Les 2' },
                            ] as { id: HeartChartMode; lbl: string }[]
                          ).map((cm) => (
                            <button
                              key={cm.id}
                              type="button"
                              onClick={() => setHeartChartMode(cm.id)}
                              className={`rounded px-1.5 py-0.5 font-semibold transition ${
                                heartChartMode === cm.id
                                  ? 'bg-[var(--card2)] text-[var(--accent)]'
                                  : 'text-[var(--dim)] hover:text-[var(--txt)]'
                              }`}
                            >
                              {cm.lbl}
                            </button>
                          ))}
                        </div>
                      )}
                      <span className="mono text-[11px] text-[var(--muted)]">
                        {tab === 'coeur'
                          ? `VTD ${fmt(computed.vtd)} · VTS ${fmt(computed.vts)} mL`
                          : `PAM ${fmt(computed.pam)} · PP ${fmt(computed.pp)} mmHg`}
                      </span>
                    </div>
                  </div>
                  {(tab === 'vaisseau' || heartChartMode === 'wiggers' || heartChartMode === 'both') && (
                    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[#070b14]">
                      <canvas
                        ref={chartCanvasRef}
                        width={500}
                        height={190}
                        style={{ width: '100%', height: '190px', display: 'block' }}
                      />
                    </div>
                  )}
                  {tab === 'coeur' && (heartChartMode === 'pv' || heartChartMode === 'both') && (
                    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[#070b14]">
                      <canvas
                        ref={pvCanvasRef}
                        width={500}
                        height={190}
                        style={{ width: '100%', height: '190px', display: 'block' }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-[11px] text-[var(--dim)]">
        <div className="mx-auto flex max-w-[1460px] flex-wrap items-center justify-between gap-2">
          <span>
            Outil pédagogique — ne remplace pas un avis médical · L’Atelier du Cœur et de la
            Circulation (Dr Oumar Sow · MIT)
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSources(true)}
              className="hover:text-[var(--txt)] underline-offset-2 hover:underline"
            >
              Sources & limites
            </button>
            <a
              href="https://wa.me/221772030979?text=Bonjour%20Dr%20Oumar%20Sow%2C%20j%E2%80%99ai%20rep%C3%A9r%C3%A9%20une%20erreur%20dans%20L%E2%80%99Atelier%20du%20C%C5%93ur%20%3A%20"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300/90 hover:text-emerald-200 underline-offset-2 hover:underline"
            >
              Signaler une erreur
            </a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ComponentModal
        id={modalCompId}
        clk={clkRef.current}
        p={effectiveParams}
        r={computed}
        onClose={() => setModalCompId(null)}
        onSetAction={handleQuickAction}
        onTogglePlay={handleTogglePlay}
      />

      <WelcomeModal
        open={showWelcome}
        onStart={() => {
          setShowWelcome(false);
          try {
            sessionStorage.setItem('atelierCoeurSeen', '1');
          } catch {
            // ignore
          }
        }}
      />

      <ShortcutsModal open={showKeys} onClose={() => setShowKeys(false)} />
      <SourcesModal open={showSources} onClose={() => setShowSources(false)} />

      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-lg border border-emerald-400/50 bg-[#07131d]/95 px-3 py-2 text-[12px] font-medium text-emerald-100 shadow-2xl"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
