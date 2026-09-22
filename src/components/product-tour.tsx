"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { XIcon } from "./icons";

export interface TourStep {
  /** `data-tour` values to highlight; the first one visible on screen wins. */
  readonly targets: readonly string[];
  readonly title: string;
  readonly body: string;
}

interface ProductTourProps {
  readonly steps: readonly TourStep[];
  /** Called when the tour ends; `completed` is false when skipped. */
  readonly onClose: (completed: boolean) => void;
}

interface Box {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

const PAD = 8;
const CARD_W = 320;

function findTarget(step: TourStep | undefined): HTMLElement | null {
  if (step === undefined) return null;
  for (const t of step.targets) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${t}"]`);
    if (el === null) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * Lightweight guided tour: dims the page, spotlights one element per step and
 * shows a card beside it. Steps whose targets aren't on screen are skipped.
 */
export function ProductTour({ steps, onClose }: ProductTourProps): ReactNode {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const step = steps[index];

  // Measure from rAF / event callbacks only, so no setState runs synchronously
  // inside the effect body.
  useEffect(() => {
    const el = findTarget(step);
    el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    let frame = 0;
    const measure = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setViewport({ w: window.innerWidth, h: window.innerHeight });
        const target = findTarget(step);
        if (target === null) {
          setBox(null);
          return;
        }
        const r = target.getBoundingClientRect();
        setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
      });
    };
    measure();
    // Smooth scrolling moves the target for a moment; re-measure as it settles.
    const settle = window.setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  const go = useCallback(
    (dir: 1 | -1): void => {
      let next = index + dir;
      while (next >= 0 && next < steps.length && findTarget(steps[next]) === null) {
        next += dir;
      }
      if (next >= steps.length) onClose(true);
      else if (next >= 0) setIndex(next);
    },
    [index, steps, onClose],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose(false);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "Tab") {
      // Keep focus inside the card while the page is dimmed.
      const focusable = cardRef.current?.querySelectorAll<HTMLElement>("button");
      if (focusable === undefined || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  if (step === undefined) return null;

  const narrow = viewport.w > 0 && viewport.w < 640;
  const cardStyle = ((): CSSProperties => {
    if (box === null || narrow) return {};
    const below = box.top + box.height + PAD + 12;
    const fitsBelow = below + 200 < viewport.h;
    const left = Math.min(
      Math.max(16, box.left + box.width / 2 - CARD_W / 2),
      viewport.w - CARD_W - 16,
    );
    return fitsBelow
      ? { top: below, left, width: CARD_W }
      : { top: Math.max(16, box.top - PAD - 12 - 200), left, width: CARD_W };
  })();
  const centered = box === null && !narrow;
  const isLast = steps.slice(index + 1).every((s) => findTarget(s) === null);

  return (
    <div className="fixed inset-0 z-50" onKeyDown={onKeyDown}>
      {box !== null ? (
        <div
          aria-hidden="true"
          className="tour-spotlight pointer-events-none fixed rounded-2xl transition-all duration-300"
          style={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
          }}
        />
      ) : (
        <div aria-hidden="true" className="tour-backdrop fixed inset-0" />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={cardStyle}
        className={`popover rise fixed rounded-2xl p-4 outline-none ${
          narrow
            ? "inset-x-4 bottom-4"
            : centered
              ? "left-1/2 top-1/2 w-80 -translate-x-1/2 -translate-y-1/2"
              : ""
        }`}
      >
        <div className="flex items-start gap-2">
          <p className="accent text-[11px] font-bold uppercase tracking-widest">
            Step {index + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="Skip tour"
            className="t3 hover-soft -mr-1 -mt-1 ml-auto grid h-7 w-7 place-items-center rounded-lg"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <p id={titleId} className="t1 mt-1 text-sm font-bold">
          {step.title}
        </p>
        <p className="t2 mt-1 text-xs leading-relaxed">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <span className="flex gap-1" aria-hidden="true">
            {steps.map((s, n) => (
              <span
                key={s.title}
                className={`h-1.5 rounded-full transition-all ${
                  n === index ? "w-4 bg-amber-400" : "w-1.5 bg-current opacity-25"
                }`}
              />
            ))}
          </span>
          {index > 0 && (
            <button
              type="button"
              onClick={() => go(-1)}
              className="chip ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => go(1)}
            className={`btn-gold rounded-lg px-3 py-1.5 text-xs ${index > 0 ? "" : "ml-auto"}`}
          >
            {isLast ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
