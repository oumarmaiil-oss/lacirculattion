import React from 'react';
import { X } from 'lucide-react';
import { CONFIG_COEUR } from '../config/physiologie';

interface WelcomeModalProps {
  open: boolean;
  onStart: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ open, onStart }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onStart();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="w-full max-w-md rounded-xl border border-[var(--line2)] bg-[var(--panel)] p-6 shadow-2xl"
      >
        <h2 id="welcome-title" className="mb-3 text-lg font-semibold text-[var(--txt)]">
          L’Atelier du Cœur et de la Circulation
        </h2>
        <p className="mb-2.5 text-[13px] leading-relaxed text-[var(--txt)]">
          Simulateur pédagogique de physiologie cardiovasculaire, de la circulation
          générale jusqu’à la paroi d’une artère en coupe.
        </p>
        <p className="mb-4 text-[13px] leading-relaxed text-[var(--muted)]">
          {CONFIG_COEUR.avertissement}
        </p>
        <div className="mb-5 rounded-lg border border-amber-400/30 bg-amber-950/20 px-3 py-2 text-[12px] text-amber-200">
          Les valeurs calculées illustrent des mécanismes physiologiques et
          pharmacologiques : elles ne constituent pas un diagnostic.
        </div>
        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-[13px] font-semibold text-slate-950 transition hover:brightness-110"
        >
          J’ai compris, commencer
        </button>
      </div>
    </div>
  );
};

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  if (!open) return null;
  const keys = [
    ['Espace', 'Lecture / Pause'],
    ['← / →', 'Image précédente / suivante (en pause)'],
    ['1 · 2 · 3', 'Changer de zoom (Corps / Cœur / Vaisseau)'],
    ['L', 'Afficher / masquer les légendes'],
    ['S', 'Activer / couper les bruits du cœur'],
    ['R', 'Tout remettre à la normale'],
    ['Échap', 'Fermer la fenêtre ouverte'],
  ];
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
        aria-labelledby="keys-title"
        className="w-full max-w-md rounded-xl border border-[var(--line2)] bg-[var(--panel)] p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="keys-title" className="text-base font-semibold text-[var(--txt)]">
            Raccourcis clavier
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line2)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--txt)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {keys.map(([k, desc]) => (
            <div key={k} className="flex items-center justify-between py-2 text-[13px]">
              <span className="text-[var(--muted)]">{desc}</span>
              <kbd className="mono rounded border border-[var(--line2)] bg-[var(--card)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                {k}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface SourcesModalProps {
  open: boolean;
  onClose: () => void;
}

export const SourcesModal: React.FC<SourcesModalProps> = ({ open, onClose }) => {
  if (!open) return null;
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
        aria-labelledby="sources-title"
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl border border-[var(--line2)] bg-[var(--panel)] p-5 shadow-2xl thin-scroll"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="sources-title" className="text-base font-semibold text-[var(--txt)]">
            À propos, limites et sources scientifiques
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line2)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--txt)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-[13px] leading-relaxed text-[var(--muted)]">
          <p className="text-[var(--txt)]">
            <strong className="font-semibold">Auteur & licence :</strong> L’Atelier du Cœur et de la
            Circulation — Dr Oumar Sow · Licence MIT.
          </p>
          <div>
            <div className="mb-1 font-semibold text-[var(--txt)]">
              Ce qui est établi (références physiologiques & cliniques)
            </div>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Hémodynamique :</strong> DC = FC × VES ; PAM = DC × RVS + PVC ; loi de
                Frank-Starling et courbe de pression aortique de Windkessel.
              </li>
              <li>
                <strong>Valvulopathies (ESC/EACTS 2021) :</strong> formule de Gorlin simplifiée pour
                le gradient transvalvulaire aortique (rétrécissement serré si surface ≤ 1,0 cm² ou
                gradient moyen ≥ 40 mmHg).
              </li>
              <li>
                <strong>Contribution auriculaire :</strong> 20 à 30 % du remplissage ventriculaire
                (StatPearls NBK482421), perdue en fibrillation auriculaire et augmentée en cas d’HVG.
              </li>
              <li>
                <strong>Pharmacologie (Law et al., BMJ 2003 ; ACC/AHA 2018) :</strong> effet
                dose-réponse ≈ 80 % à demi-dose et 120 % à double dose ; statine forte intensité LDL
                ≈ −50 % ; atténuation de l’œdème sous amlodipine par blocage du SRA.
              </li>
            </ul>
          </div>
          <div>
            <div className="mb-1 font-semibold text-[var(--txt)]">
              Limites du modèle pédagogique
            </div>
            <p>
              Ce modèle compartimental en régime stationnaire simplifie l’interaction cœur-poumons,
              les réflexes barorécepteurs à court terme, les valvulopathies droites isolées et les
              traitements d’urgence (angioplastie, thrombolyse, choc).
            </p>
          </div>
          <div className="pt-1">
            <a
              href="https://wa.me/221772030979?text=Bonjour%20Dr%20Oumar%20Sow%2C%20j%E2%80%99ai%20rep%C3%A9r%C3%A9%20une%20erreur%20dans%20L%E2%80%99Atelier%20du%20C%C5%93ur%20%3A%20"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 hover:bg-emerald-500/25"
            >
              Signaler une erreur ou suggérer une amélioration
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
