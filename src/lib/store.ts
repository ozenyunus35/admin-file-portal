"use client";

import { useSyncExternalStore } from "react";
import { clearBlobs } from "./blobs";
import { createSeed, STATE_VERSION } from "./seed";
import type { DemoState, User } from "./types";

/**
 * Browser-side persistence for the mock backend. State is one JSON document in
 * localStorage, shared across tabs through the `storage` event. On the server
 * (static export) the snapshot is null and pages render their loading state.
 */

const STATE_KEY = "atlas:state";
const SESSION_KEY = "atlas:session";

interface Snapshot {
  state: DemoState | null;
  session: string | null;
}

const SERVER_SNAPSHOT: Snapshot = { state: null, session: null };
let snap: Snapshot | null = null;
const listeners = new Set<() => void>();

function readState(): DemoState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.version === STATE_VERSION) return parsed;
    }
  } catch {
    // Corrupt or blocked storage: fall through to a fresh seed.
  }
  const fresh = createSeed();
  write(STATE_KEY, JSON.stringify(fresh));
  return fresh;
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or full storage: the demo keeps working in memory.
  }
}

function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function emit() {
  for (const l of listeners) l();
}

function getSnapshot(): Snapshot {
  if (!snap) snap = { state: readState(), session: readSession() };
  return snap;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STATE_KEY || e.key === SESSION_KEY || e.key === null) {
      snap = { state: readState(), session: readSession() };
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setState(next: DemoState) {
  snap = { ...getSnapshot(), state: next };
  write(STATE_KEY, JSON.stringify(next));
  emit();
}

export const getState = () => getSnapshot().state!;

/** Applies a mock-API call. Throws the call's ApiError unchanged. */
export function mutate(fn: (s: DemoState) => DemoState) {
  setState(fn(getState()));
}

export function setSession(userId: string | null) {
  snap = { ...getSnapshot(), session: userId };
  write(SESSION_KEY, userId);
  emit();
}

export async function resetDemo(keepSession: string | null) {
  await clearBlobs().catch(() => undefined);
  setState(createSeed());
  setSession(keepSession);
}

export function useStore(): { state: DemoState | null; user: User | null; ready: boolean } {
  const s = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
  const user = s.state && s.session ? (s.state.users.find((u) => u.id === s.session && u.status !== "disabled") ?? null) : null;
  return { state: s.state, user, ready: s.state !== null };
}
