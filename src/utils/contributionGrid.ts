/**
 * Contribution-grid data helpers, ported from the original wallpaper page.
 *
 * A grid is a list of weeks (columns); each week holds 7 cells (Sun..Sat), and
 * each cell carries a 0..4 intensity level.
 */

import type { ContributionDay, ContributionGraph } from "../services/native";

export const WEEKS = 53;
export const DAYS = 7;

export interface GridCell {
  count: number;
  level: number;
  date: string | null;
}

export type WeekGrid = GridCell[][];

/** Deterministic pseudo-random in [0,1) so simulated data is stable. */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Build a plausible simulated year of contributions. */
export function simulateGrid(seed: number): WeekGrid {
  const weeks: WeekGrid = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: GridCell[] = [];
    for (let d = 0; d < DAYS; d++) {
      const n = w * DAYS + d + (seed || 0);
      const r = hash01(n);
      const weekend = d === 0 || d === 6 ? 0.55 : 1.0;
      const burst = hash01(n * 3.3) > 0.82 ? 1.35 : 1.0;
      let count = Math.floor(r * 9 * weekend * burst);
      if (hash01(n * 7.7) > 0.88) count = 0;
      const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;
      week.push({ count, level, date: null });
    }
    weeks.push(week);
  }
  return weeks;
}

/** Convert the backend "days" list into weeks of 7 (Sun..Sat). */
export function graphToWeeks(graph: ContributionGraph): WeekGrid {
  const raw: ContributionDay[] = (graph && graph.days) || [];
  if (!raw.length) return [];
  const days = raw.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const out: GridCell[] = [];
  const firstDow = days[0] && days[0].date
    ? new Date(days[0].date + "T00:00:00").getDay()
    : 0;
  for (let i = 0; i < firstDow; i++) out.push({ count: 0, level: 0, date: null });
  for (const d of days) {
    out.push({
      count: d.count || 0,
      level: Math.max(0, Math.min(4, d.level || 0)),
      date: d.date || null,
    });
  }
  while (out.length % DAYS !== 0) out.push({ count: 0, level: 0, date: null });

  const weeks: WeekGrid = [];
  for (let i = 0; i < out.length; i += DAYS) weeks.push(out.slice(i, i + DAYS));
  return weeks;
}

/** Total contributions across the grid. */
export function totalOf(weeks: WeekGrid): number {
  let t = 0;
  for (const w of weeks) for (const c of w) t += c.count || 0;
  return t;
}

/** Longest run of consecutive days with at least one contribution. */
export function longestStreak(weeks: WeekGrid): number {
  let best = 0, run = 0;
  for (const w of weeks) for (const c of w) {
    if ((c.count || 0) > 0) { run++; best = Math.max(best, run); }
    else run = 0;
  }
  return best;
}
