"use client";

import type { PublicTicketView } from "@boothq/shared";
import { useCallback, useEffect, useRef, useState } from "react";

// Opt-in sound + vibration on the customer page (PRD C9, docs/UI.md → Customer).
// Fires when the heads-up first appears and when the customer is called
// (including a recall, i.e. a new `calledAt`). Never fires for what the page
// already showed when it loaded. The preference is per device; browsers need a
// tap to unlock audio, so after a reload the first tap anywhere re-unlocks it.
const STORAGE_KEY = "boothq.alerts";

type AlertKind = "headsUp" | "called";

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
  }
  return audioContext;
}

function unlockAudio(): void {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
}

function chime(kind: AlertKind): void {
  const ctx = getContext();
  if (!ctx || ctx.state !== "running") return;
  // Two rising notes for the heads-up, three for "it's your turn".
  const notes = kind === "called" ? [660, 880, 1320] : [660, 880];
  notes.forEach((freq, i) => {
    const start = ctx.currentTime + i * 0.22;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.45);
  });
}

function buzz(kind: AlertKind): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  navigator.vibrate(kind === "called" ? [250, 120, 250, 120, 450] : [200, 100, 200]);
}

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // private mode: the choice just lasts until reload
  }
}

export function useCustomerAlerts(view: PublicTicketView | undefined) {
  const [enabled, setEnabled] = useState(false);
  const enabledRef = useRef(false);
  const previous = useRef<{ almostUp: boolean; calledAt: string | null } | null>(null);

  useEffect(() => {
    const stored = readEnabled();
    enabledRef.current = stored;
    setEnabled(stored);
    if (!stored) return;
    const onTap = () => unlockAudio();
    window.addEventListener("pointerdown", onTap, { once: true });
    return () => window.removeEventListener("pointerdown", onTap);
  }, []);

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    writeEnabled(next);
    if (next) {
      unlockAudio(); // must run inside this tap
      chime("headsUp");
      buzz("headsUp");
    }
  }, []);

  useEffect(() => {
    if (!view) return;
    const fromPhoto = view.mode === "FROM_PHOTO";
    const now = {
      almostUp: view.status === "WAITING" && view.almostUp,
      calledAt: view.status === "CALLED" && !fromPhoto ? view.calledAt : null,
    };
    const before = previous.current;
    previous.current = now;
    if (!before || !enabledRef.current) return; // first load: don't alert for what's already on screen

    let kind: AlertKind | null = null;
    if (now.calledAt && now.calledAt !== before.calledAt) kind = "called";
    else if (now.almostUp && !before.almostUp) kind = "headsUp";
    if (kind) {
      chime(kind);
      buzz(kind);
    }
  }, [view]);

  const vibrationSupported = typeof navigator !== "undefined" && "vibrate" in navigator;
  return { enabled, toggle, vibrationSupported };
}
