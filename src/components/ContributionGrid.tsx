/**
 * `ContributionGrid` - renders the GitHub-style contribution heatmap on a
 * canvas. Shared by the floating ContributionWidget. Fully transparent
 * background: only the coloured squares (and optional headline) are drawn.
 *
 * Data comes from the settings store (`contributions`): either a live GitHub
 * profile (via the backend) or a locally-generated demo pattern.
 */

import { useEffect, useRef } from "react";
import type { ContributionSettings } from "../types";
import { simulateGrid, graphToWeeks, type WeekGrid } from "../utils/contributionGrid";

interface Props {
  settings: ContributionSettings;
  /**
   * Base colour of the lit squares. Derived from the same effective theme
   * colour as the clock (`useEffectiveThemeColors`), so the grid always
   * matches the clock.
   */
  color: string;
  /** The real contribution graph (when source is github), or null. */
  graph: import("../services/native").ContributionGraph | null;
  /** True while the live data is loading (keeps the last frame). */
  loading?: boolean;
}

function hexToRgb(hex: string | undefined): [number, number, number] {
  const m = String(hex || "").match(/^#([0-9a-f]{6})$/i);
  if (!m) return [57, 211, 83];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const DAYS = 7;

export default function ContributionGrid({ settings, color, graph, loading }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    weeks: simulateGrid(Math.floor(Date.now() / 8.64e7)) as WeekGrid,
    sweep: 0,
    lastFrame: 0,
    needResize: true,
  });

  // Rebuild the grid data whenever the source/graph changes.
  useEffect(() => {
    const st = stateRef.current;
    if (settings.source === "github" && graph && graph.days && graph.days.length) {
      const weeks = graphToWeeks(graph);
      if (weeks.length) {
        st.weeks = weeks;
        return;
      }
    }
    if (settings.source !== "github" || !graph) {
      st.weeks = simulateGrid(Math.floor(Date.now() / 8.64e7));
    }
  }, [settings.source, graph]);

  // Recompute on host resize.
  useEffect(() => {
    const onResize = () => { stateRef.current.needResize = true; };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let raf = 0;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const st = stateRef.current;

    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      canvas.width = Math.max(1, Math.floor(W * dpr));
      canvas.height = Math.max(1, Math.floor(H * dpr));
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      st.needResize = false;
    };

    const litHex = color;
    const base = hexToRgb(litHex);
    const dim: [number, number, number] = [
      Math.round(base[0] * 0.18),
      Math.round(base[1] * 0.18),
      Math.round(base[2] * 0.18),
    ];
    const glow: [number, number, number] = [
      Math.min(255, Math.round(base[0] * 1.6)),
      Math.min(255, Math.round(base[1] * 1.6)),
      Math.min(255, Math.round(base[2] * 1.6)),
    ];

    const levelScale = [0.34, 0.55, 0.78, 1.0];

    const draw = (ts: number) => {
      if (st.needResize) fit();
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;

      ctx.clearRect(0, 0, W, H);
      const cols = st.weeks.length || 53;
      const rows = DAYS;

      // Edge-to-edge layout: NO side padding at all. The grid spans the full
      // viewport width, so the first square starts exactly at x=0 and the last
      // square ends exactly at x=W. A gap is chosen from the ideal cell size,
      // then the cell size is solved so the total width equals W exactly.
      const gapRatio = 0.18;

      // Vertical placement: headline (if any) occupies the top band; the grid
      // is centred in the remaining space.
      const headlineBand = settings.headline ? Math.round(H * 0.2) : 0;
      const gridArea = Math.max(1, H - headlineBand);
      const vPad = Math.max(0, Math.round(gridArea * 0.04));

      let size = W / (cols + (cols - 1) * gapRatio);
      let gap = Math.max(1, Math.round(size * gapRatio));
      size = (W - (cols - 1) * gap) / cols;

      let originX: number;
      let originY: number;
      let totalW: number;
      let totalH: number;

      // Safety net for pathologically shallow viewports (e.g. an ultrawide
      // window opened in a plain browser): if the width-driven grid cannot
      // fit the band height, shrink the cells and centre instead of clipping
      // the squares. On the desktop widget the band height always tracks the
      // monitor width (see fit_contrib_to_monitor), so this never triggers.
      const maxSizeByH = (gridArea - vPad * 2) / (rows + (rows - 1) * gapRatio);
      if (size > maxSizeByH && maxSizeByH >= 3) {
        size = Math.max(3, Math.floor(maxSizeByH));
        gap = Math.max(1, Math.round(size * gapRatio));
        totalW = cols * size + (cols - 1) * gap;
        totalH = rows * size + (rows - 1) * gap;
        originX = (W - totalW) / 2;
        originY = Math.round(headlineBand + (gridArea - totalH) / 2);
      } else {
        size = Math.max(3, size);
        totalW = cols * size + (cols - 1) * gap;
        totalH = rows * size + (rows - 1) * gap;
        originX = 0; // first square flush against the left edge
        originY = Math.round(headlineBand + (gridArea - totalH) / 2);
      }

      // Advance the sweep.
      const dt = Math.min(50, ts - st.lastFrame || 16);
      st.lastFrame = ts;
      if (settings.animate) {
        const cellsPerSec = 2 + settings.speed * 2.2;
        st.sweep += (cellsPerSec * dt) / 1000;
        if (st.sweep >= cols + 6) st.sweep -= cols + 6;
      }

      const FALLOFF = 5.0;
      const r = Math.max(1, size * 0.18);

      for (let c = 0; c < cols; c++) {
        const x = originX + c * (size + gap);
        const distHead = st.sweep - c;
        const nearHead = distHead >= -0.5 && distHead <= FALLOFF;
        for (let rr = 0; rr < rows; rr++) {
          const cell = (st.weeks[c] && st.weeks[c]![rr]) || { level: 0, count: 0 };
          const level = cell.level || 0;
          if (level <= 0 && !settings.grid) continue;
          const y = originY + rr * (size + gap);

          let cr: number, cg: number, cb: number, alpha: number;
          if (level <= 0) {
            cr = dim[0]; cg = dim[1]; cb = dim[2]; alpha = 0.10;
          } else {
            const f = levelScale[Math.min(4, level) - 1] ?? 1.0;
            cr = Math.round(base[0] * f);
            cg = Math.round(base[1] * f);
            cb = Math.round(base[2] * f);
            alpha = 0.3 + level * 0.16;
          }

          ctx.fillStyle = "rgba(" + cr + "," + cg + "," + cb + "," + alpha.toFixed(3) + ")";
          roundRect(ctx, x, y, size, size, r);
          ctx.fill();

          if (nearHead && level > 0) {
            const glowA = Math.max(0, 1 - distHead / FALLOFF) * 0.9;
            if (glowA > 0.01) {
              ctx.fillStyle = "rgba(" + glow[0] + "," + glow[1] + "," + glow[2] + "," + glowA.toFixed(3) + ")";
              roundRect(ctx, x, y, size, size, r);
              ctx.fill();
            }
          }
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [settings, color, loading]);

  return (
    <div ref={wrapRef} className="contrib-canvas-wrap">
      <canvas ref={canvasRef} className="contrib-canvas" />
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
