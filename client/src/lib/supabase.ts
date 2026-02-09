import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function isGuestMode(): boolean {
  return !isSupabaseConfigured;
}

export interface GameSaveRow {
  telegram_id: number;
  username: string | null;
  muscle_points: number;
  level: number;
  current_energy: number;
  last_tap_timestamp: string;
  wallet_address: string | null;
  god_pack_expiry: string | null;
  high_score: number;
  created_at?: string;
  updated_at?: string;
}

const QUEUE_KEY = "mf-offline-queue";

interface QueuedSave {
  data: Partial<GameSaveRow> & { telegram_id: number };
  timestamp: number;
}

function getOfflineQueue(): QueuedSave[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setOfflineQueue(queue: QueuedSave[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function addToOfflineQueue(data: QueuedSave["data"]) {
  const queue = getOfflineQueue();
  queue.push({ data, timestamp: Date.now() });
  if (queue.length > 50) queue.splice(0, queue.length - 50);
  setOfflineQueue(queue);
}

export async function flushOfflineQueue() {
  if (!supabase) return;
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  const successes: number[] = [];
  for (let i = 0; i < queue.length; i++) {
    try {
      const { error } = await supabase
        .from("game_saves")
        .upsert(queue[i].data, { onConflict: "telegram_id" });
      if (!error) successes.push(i);
    } catch {}
  }

  if (successes.length > 0) {
    const remaining = queue.filter((_, idx) => !successes.includes(idx));
    setOfflineQueue(remaining);
  }
}

export async function loadGameSave(telegramId: number): Promise<GameSaveRow | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("game_saves")
      .select("*")
      .eq("telegram_id", telegramId)
      .single();

    if (error || !data) return null;
    return data as GameSaveRow;
  } catch {
    return null;
  }
}

export async function saveGameToSupabase(save: Partial<GameSaveRow> & { telegram_id: number }) {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("game_saves")
      .upsert(
        { ...save, updated_at: new Date().toISOString() },
        { onConflict: "telegram_id" }
      );

    if (error) {
      console.warn("Supabase save error, queuing offline:", error.message);
      addToOfflineQueue(save);
      return false;
    }

    await flushOfflineQueue();
    return true;
  } catch {
    addToOfflineQueue(save);
    return false;
  }
}

export async function updateHighScore(telegramId: number, newScore: number): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: existing } = await supabase
      .from("game_saves")
      .select("high_score")
      .eq("telegram_id", telegramId)
      .single();

    const currentHigh = existing?.high_score ?? 0;
    if (newScore <= currentHigh) return false;

    const { error } = await supabase
      .from("game_saves")
      .update({ high_score: newScore, updated_at: new Date().toISOString() })
      .eq("telegram_id", telegramId);

    return !error;
  } catch {
    return false;
  }
}
