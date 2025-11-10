import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * 5G PL — React Block Diagram Editor (Preview ⟷ Mermaid split)
 * rev: v15.3
 *
 * Fixes in v15.3:
 * - Fixed JSX className quotes in Toolbar (syntax error).
 * - Completed Toolbar prop typing and rendering (no stray tokens).
 * - Added solid export fallbacks (anchor/new-tab/clipboard) with status lines.
 * - Added "Test Export" (tiny PNG) to validate downloads in constrained envs.
 * - Kept previous fixes: toMermaid() newline, SVG header newline, label escaping,
 *   legacy label migration, draggable edge labels, panning with space/middle-click.
 */

// ---------- Types ----------
type NodeShape = "rect" | "cloud";

type NodeMeta = { label: string; shape: NodeShape };

type EdgeStyle = "bold" | "solid" | "dashed";

type EdgeDef = { from: string; to: string; label?: string; style?: EdgeStyle };

type Point = { x: number; y: number };

type Size = { w: number; h: number };

// ---------- Constants ----------
const VERSION = "15.3";
const GRID = 10;
const MIN_W = 60;
const MIN_H = 28;
const CANVAS_W = 1800;
const CANVAS_H = 900;

// Status helper
function useStatus() {
  const [msg, setMsg] = useState<string>("");
  const ok = (t: string) => setMsg(t);
  const err = (t: string) => setMsg("Error: " + t);
  return { msg, ok, err };
}

const DEFAULT_SIZE: Record<NodeShape, Size> = {
  rect: { w: 140, h: 44 },
  cloud: { w: 180, h: 72 },
};

const INITIAL_POS: Record<string, Point> = {
  UE: { x: 80, y: 260 },
  PGW: { x: 560, y: 260 },
  PCRF: { x: 560, y: 80 },
  TDF: { x: 960, y: 260 }, // visual block labeled SG; grouped as "TDF (SG + SMP)"
  OCS: { x: 960, y: 80 },
  Internet: { x: 1280, y: 260 },
  // Fixed-access nodes (lower half)
  BNG: { x: 700, y: 540 },
  SMP: { x: 700, y: 360 }, // SMP (Fixed)
  SMPM: { x: 960, y: 360 }, // SMP (Mobile)
};

const NODE_META_DEFAULT: Record<string, NodeMeta> = {
  UE: { label: "UE/CPE", shape: "rect" },
  PGW: { label: "P-GW (PCEF)", shape: "rect" },
  PCRF: { label: "PCRF", shape: "rect" },
  TDF: { label: "SG", shape: "rect" },
  OCS: { label: "OCS", shape: "rect" },
  Internet: { label: "Internet", shape: "cloud" },
  BNG: { label: "BNG/BRAS", shape: "rect" },
  SMP: { label: "SMP (Fixed)", shape: "rect" },
  SMPM: { label: "SMP (Mobile)", shape: "rect" },
};

const EDGES_DEFAULT: EdgeDef[] = [
  // Mobile user plane
  { from: "UE", to: "PGW", label: "EPS Bearer (Default/Dedicated GBR)", style: "bold" },
  { from: "PGW", to: "TDF", label: "SGi", style: "solid" },
  { from: "TDF", to: "Internet", label: "SGi", style: "solid" },
  // Mobile control/charging
  { from: "PCRF", to: "PGW", label: "Gx (PCC)", style: "dashed" },
  { from: "PCRF", to: "SMPM", label: "Sd (ADC)", style: "dashed" },
  { from: "SMPM", to: "OCS", label: "Gyn (Mobile)", style: "dashed" },
  // Fixed visibility/control/charging
  { from: "UE", to: "BNG", label: "Access (FTTx)", style: "solid" },
  { from: "BNG", to: "SMP", label: "RADIUS", style: "dashed" },
  { from: "SMP", to: "PCRF", label: "Gxn", style: "dashed" },
  { from: "SMP", to: "OCS", label: "Gyn (Fixed)", style: "dashed" },
  { from: "BNG", to: "TDF", label: "SGi", style: "solid" },
];

// ---------- Utilities ----------
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const snap = (v: number, g = GRID) => Math.round(v / g) * g;
const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const isObject = (x: any) => x !== null && typeof x === "object" && !Array.isArray(x);

function coerceEdges(val: any): EdgeDef[] {
  if (Array.isArray(val)) return val as EdgeDef[];
  if (isObject(val)) {
    const arr: EdgeDef[] = [];
    Object.keys(val).forEach((k) => {
      const i = Number(k);
      if (!Number.isNaN(i)) arr[i] = (val as any)[k] as EdgeDef;
    });
    return arr.filter(Boolean);
  }
  return [];
}

function cloudPath(w: number, h: number) {
  const r = Math.min(w, h) / 6;
  const x = 0, y = 0;
  return `M ${x + r},${y + h * 0.6}
          C ${x - r},${y + h * 0.6} ${x - r},${y + h * 0.2} ${x + w * 0.2},${y + h * 0.2}
          C ${x + w * 0.2},${y} ${x + w * 0.5},${y} ${x + w * 0.5},${y + h * 0.2}
          C ${x + w * 0.7},${y} ${x + w},${y + h * 0.2} ${x + w * 0.8},${y + h * 0.4}
          C ${x + w * 1.1},${y + h * 0.5} ${x + w * 0.9},${y + h} ${x + w * 0.5},${y + h}
          C ${x + w * 0.3},${y + h} ${x + w * 0.15},${y + h * 0.8} ${x + r},${y + h * 0.6} Z`;
}

const escLabel = (s: string) => String(s).replace(/"/g, '\\"');

function toMermaid(nodeMeta: Record<string, NodeMeta>, edges: EdgeDef[]) {
  const lines: string[] = [];
  lines.push("flowchart LR");
  Object.keys(nodeMeta).forEach((id) => {
    const label = escLabel(nodeMeta[id]?.label ?? id);
    lines.push(`${id}["${label}"]`);
  });
  (edges || []).forEach((e) => {
    const lbl = e.label ? `|${escLabel(e.label)}|` : "";
    lines.push(`${e.from} ---${lbl} ${e.to}`);
  });
  return lines.join('\n');
}

// ---------- Local storage ----------
function useLocalValue<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw);
    } catch {}
    return initial;
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }, [key, v]);
  return [v, setV];
}

// ---------- Pan & Zoom ----------
function usePanZoom() {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const dragging = useRef<null | { x: number; y: number; ox: number; oy: number }>(null);
  const spaceHeld = useRef(false);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); spaceHeld.current = true; } };
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') { spaceHeld.current = false; } };

    // Prevent browser zoom with Ctrl+wheel anywhere on the page
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', kd, { passive: false } as any);
    window.addEventListener('keyup', ku);
    window.addEventListener('wheel', preventBrowserZoom, { passive: false });

    return () => {
      window.removeEventListener('keydown', kd as any);
      window.removeEventListener('keyup', ku as any);
      window.removeEventListener('wheel', preventBrowserZoom as any);
    };
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => clamp(s + delta, 0.4, 3));
  };

  const beginPan = (e: React.MouseEvent) => {
    const isBackground = (e.target as HTMLElement)?.id === 'pan-surface';
    if (e.button === 1 || spaceHeld.current || isBackground) {
      e.preventDefault();
      dragging.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    }
  };
  const movePan = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    setOffset({ x: dragging.current.ox + dx, y: dragging.current.oy + dy });
  };
  const endPan = () => { dragging.current = null; };

  return { scale, setScale, offset, setOffset, onWheel, beginPan, movePan, endPan };
}

// ---------- Node component ----------
function Node({
  id,
  meta,
  pos,
  size,
  onMove,
  onResize,
  onEditLabel,
  snapToGrid,
}: {
  id: string;
  meta: NodeMeta;
  pos: Point;
  size: Size;
  onMove: (id: string, p: Point) => void;
  onResize: (id: string, sz: Size) => void;
  onEditLabel: (id: string, label: string) => void;
  snapToGrid: boolean;
}) {
  const [drag, setDrag] = useState<null | { x: number; y: number; ox: number; oy: number }>(null);
  const [resizing, setResizing] = useState<null | { sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; handle: 'nw'|'ne'|'se'|'sw' }>(null);
  const [hover, setHover] = useState(false);

  const s = size || DEFAULT_SIZE[meta.shape];

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement)?.dataset?.handle) return; // resizing takes precedence
    setDrag({ x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y });
    (e.currentTarget as any).setPointerCapture?.((e as any).pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      const nx = snapToGrid ? snap(drag.ox + dx) : drag.ox + dx;
      const ny = snapToGrid ? snap(drag.oy + dy) : drag.oy + dy;
      onMove(id, { x: nx, y: ny });
    } else if (resizing) {
      const dx = e.clientX - resizing.sx;
      const dy = e.clientY - resizing.sy;
      let w = resizing.ow;
      let h = resizing.oh;
      let x = resizing.ox;
      let y = resizing.oy;
      switch (resizing.handle) {
        case 'se': w = Math.max(MIN_W, resizing.ow + dx); h = Math.max(MIN_H, resizing.oh + dy); break;
        case 'ne': w = Math.max(MIN_W, resizing.ow + dx); h = Math.max(MIN_H, resizing.oh - dy); y = resizing.oy + (resizing.oh - h); break;
        case 'sw': w = Math.max(MIN_W, resizing.ow - dx); h = Math.max(MIN_H, resizing.oh + dy); x = resizing.ox + (resizing.ow - w); break;
        case 'nw': w = Math.max(MIN_W, resizing.ow - dx); h = Math.max(MIN_H, resizing.oh - dy); x = resizing.ox + (resizing.ow - w); y = resizing.oy + (resizing.oh - h); break;
      }
      onResize(id, { w, h });
      onMove(id, { x, y });
    }
  };
  const onPointerUp = () => { setDrag(null); setResizing(null); };

  const HANDLE = 6;
  const corner: Record<'nw'|'ne'|'se'|'sw', { x:number; y:number; cursor:string }> = {
    nw: { x: -HANDLE/2, y: -HANDLE/2, cursor: 'nwse-resize' },
    ne: { x: s.w - HANDLE/2, y: -HANDLE/2, cursor: 'nesw-resize' },
    se: { x: s.w - HANDLE/2, y: s.h - HANDLE/2, cursor: 'nwse-resize' },
    sw: { x: -HANDLE/2, y: s.h - HANDLE/2, cursor: 'nesw-resize' },
  };

  const handleRect = (key: 'nw'|'ne'|'se'|'sw') => (
    <rect key={key} x={corner[key].x} y={corner[key].y} width={HANDLE} height={HANDLE} rx={1} ry={1}
      data-handle={key} fill="#111827" fillOpacity={hover ? 0.25 : 0} stroke="#111827" strokeOpacity={hover ? 0.25 : 0} strokeWidth={0.75}
      style={{ cursor: corner[key].cursor }}
      onPointerDown={(e) => {
        e.stopPropagation();
        setResizing({ handle: key, sx: (e as any).clientX, sy: (e as any).clientY, ox: pos.x, oy: pos.y, ow: s.w, oh: s.h });
        (e.currentTarget as any).setPointerCapture?.((e as any).pointerId);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );

  return (
    <g transform={`translate(${pos.x},${pos.y})`}
       onPointerDown={onPointerDown}
       onPointerMove={onPointerMove}
       onPointerUp={onPointerUp}
       onMouseEnter={() => setHover(true)}
       onMouseLeave={() => setHover(false)}
       style={{ cursor: drag ? 'grabbing' : 'grab' }}
       onDoubleClick={(e)=>{ e.stopPropagation(); const v = prompt('Node label', meta.label); if (v!=null) onEditLabel(id, v); }}
    >
      {meta.shape === 'rect' ? (
        <rect width={s.w} height={s.h} fill="#fff" stroke="#111827" strokeWidth={1} />
      ) : (
        <path d={cloudPath(s.w, s.h)} fill="#fff" stroke="#111827" strokeWidth={1} />
      )}
      <text x={s.w/2} y={s.h/2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#111827">{meta.label}</text>
      {(['nw','ne','se','sw'] as const).map(handleRect)}
    </g>
  );
}

// ---------- Edge component (straight or orthogonal; no arrowheads) ----------
function Edge({ a, b, label, style, orthogonal }:{ a:Point; b:Point; label?:string; style?:EdgeStyle; orthogonal:boolean }) {
  const stroke = style === 'dashed' ? '#6b7280' : '#0f172a';
  const dash = style === 'dashed' ? '6,6' : undefined;
  const strokeWidth = style === 'bold' ? 4 : style === 'solid' ? 1.6 : 1.2;

  if (!orthogonal) {
    return (
      <g>
        {style === 'bold' && (
          <line x1={a.x} y1={a.y + 2} x2={b.x} y2={b.y + 2} stroke={stroke} strokeWidth={strokeWidth + 2} strokeOpacity={0.25} />
        )}
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />
      </g>
    );
  }

  // Right‑angle connector: horizontal then vertical
  const midx = (a.x + b.x) / 2;
  return (
    <g>
      <polyline points={`${a.x},${a.y} ${midx},${a.y} ${midx},${b.y} ${b.x},${b.y}`} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />
    </g>
  );
}

// ---------- Toolbar ----------
function Toolbar({
  onZoomIn, onZoomOut, onReset, onExport, onImport, onResetAll, onExportSVG, onExportPNG,
  snapToGrid, setSnapToGrid, orthogonal, setOrthogonal, runTests, onTestExport,
}:{
  onZoomIn: ()=>void; onZoomOut: ()=>void; onReset: ()=>void; onExport: ()=>void; onImport: (file: File|null)=>void; onResetAll: ()=>void;
  onExportSVG: ()=>void; onExportPNG: ()=>void;
  snapToGrid: boolean; setSnapToGrid: (v:boolean)=>void; orthogonal: boolean; setOrthogonal: (v:boolean)=>void; runTests: ()=>void; onTestExport: ()=>void;
}) {
  const fileRef = useRef<HTMLInputElement|null>(null);
  return (
    <div className="flex items-center gap-2">
      <button className="border rounded px-2 py-1 transition-colors duration-150 hover:bg-slate-100 active:scale-[0.98]" onClick={onZoomOut}>−</button>
      <button className="border rounded px-2 py-1 transition-colors duration-150 hover:bg-slate-100 active:scale-[0.98]" onClick={onZoomIn}>+</button>
      <button className="border rounded px-2 py-1 transition-colors duration-150 hover:bg-slate-100 active:scale-[0.98]" onClick={onReset}>Reset View</button>
      <label className="ml-2 text-sm flex items-center gap-1"><input type="checkbox" checked={snapToGrid} onChange={e=>setSnapToGrid(e.target.checked)} /> Snap‑to‑grid</label>
      <label className="ml-2 text-sm flex items-center gap-1"><input type="checkbox" checked={orthogonal} onChange={e=>setOrthogonal(e.target.checked)} /> Orthogonal connectors</label>
      <button className="ml-2 border rounded px-2 py-1 transition-colors duration-150 hover:bg-slate-100 active:scale-[0.98]" onClick={onExport}>Export layout</button>
      <button className="ml-2 border rounded px-2 py-1 transition-colors duration-150 hover:bg-slate-100 active:scale-[0.98]" onClick={()=> fileRef.current?.click()}>Import layout</button>
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e)=> onImport(e.target.files?.[0]||null)} />
      <button className="ml-2 border rounded px-2 py-1 transition-colors duration-150 hover:bg-slate-100 active:scale-[0.98]" onClick={onExportSVG}>Export SVG</button>
      <button className="border rounded px-2 py-1 transition-colors duration-150 hover:bg-slate-100 active:scale-[0.98]" onClick={onExportPNG}>Export PNG</button>
      <button className="ml-2 border rounded px-2 py-1 transition-colors duration-150 hover:bg-slate-100 active:scale-[0.98]" onClick={runTests}>Run Tests</button>
      <button className="ml-2 border rounded px-2 py-1 transition-colors duration-150 hover:bg-slate-100 active:scale-[0.98]" onClick={onTestExport}>Test Export</button>
      <button className="ml-2 border rounded px-2 py-1 text-red-600 transition-colors duration-150 hover:bg-red-50 active:scale-[0.98]" onClick={onResetAll}>Reset All</button>
    </div>
  );
}

// ---------- Main Component ----------
export default function FiveGPL_BlockDiagram_Editor() {
  const status = useStatus();
  const svgRef = useRef<SVGSVGElement|null>(null);
  // Persisted layout state
  const [positions, setPositions] = useLocalValue<Record<string, Point>>("pcc_positions_v14", INITIAL_POS);
  const [sizes, setSizes] = useLocalValue<Record<string, Size>>("pcc_sizes_v14", Object.fromEntries(Object.keys(NODE_META_DEFAULT).map(k => [k, DEFAULT_SIZE[NODE_META_DEFAULT[k as keyof typeof NODE_META_DEFAULT].shape]])) as any);
  const [nodeMeta, setNodeMeta] = useLocalValue<Record<string, NodeMeta>>("pcc_node_meta_v14", NODE_META_DEFAULT);
  const [edgeMetaRaw, setEdgeMetaRaw] = useLocalValue<any>("pcc_edges_v14", EDGES_DEFAULT);
  const edgeMeta: EdgeDef[] = useMemo(()=> coerceEdges(edgeMetaRaw), [edgeMetaRaw]);
  // New: label offsets (persisted)
  const [labelOffsets, setLabelOffsets] = useLocalValue<Record<string, {dx:number; dy:number}>>("pcc_label_offsets_v1", {});

  // Migrations (once)
  useEffect(() => {
    // Legacy AAA → SMP rename
    setNodeMeta((n) => {
      if ((n as any).AAA && !(n as any).SMP) {
        const { AAA, ...rest } = n as any;
        return { ...rest, SMP: { ...AAA, label: 'SMP (Fixed)' } } as any;
      }
      if ((n as any).SMP && (n as any).SMP.label !== 'SMP (Fixed)') {
        return { ...(n as any), SMP: { ...(n as any).SMP, label: 'SMP (Fixed)' } } as any;
      }
      return n;
    });

    setEdgeMetaRaw((es: any) => coerceEdges(es).map((e) => {
      let { from, to, label } = e as any;
      if (from === 'AAA') from = 'SMP';
      if (to === 'AAA') to = 'SMP';
      if (label === 'Policy Mediation') label = 'Gxn';
      // Legacy "Gy (Online Charging)" → "Gyn (Mobile)" (and move to SMPM if needed)
      if (typeof label === 'string' && /gy\s*\(\s*online\s*charging\s*\)/i.test(label)) {
        label = 'Gyn (Mobile)';
        if (from === 'TDF' && to === 'OCS') from = 'SMPM';
      }
      if (label === 'SGi/N6') label = 'SGi';
      return { ...e, from, to, label };
    }));
  }, [setNodeMeta, setEdgeMetaRaw]);

  // Horizontal separator Y (persisted) + dragging state
  const [sepY, setSepY] = useLocalValue<number>("pcc_sep_y_v2", 320);
  const sepDrag = useRef<null | { sy:number; oy:number }>(null);

  const { scale, setScale, offset, setOffset, onWheel, beginPan, movePan, endPan } = usePanZoom();
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [orthogonal, setOrthogonal] = useState(false);

  const nodeCenter = (id: string) => {
    const meta = (nodeMeta as any)[id] || (NODE_META_DEFAULT as any)[id];
    const p = (positions as any)[id];
    const s = (sizes as any)[id] || (DEFAULT_SIZE as any)[meta.shape || 'rect'];
    return { x: p.x + s.w / 2, y: p.y + s.h / 2 };
  };

  const edges = useMemo(() => edgeMeta.map((e:any) => ({ ...e, a: nodeCenter(e.from), b: nodeCenter(e.to) })), [edgeMeta, positions, sizes, nodeMeta]);

  // Mermaid panel
  const [mermaidCode, setMermaidCode] = useState<string>(() => toMermaid(nodeMeta, edgeMeta));
  useEffect(() => { setMermaidCode(toMermaid(nodeMeta, edgeMeta)); }, [nodeMeta, edgeMeta, positions, sizes]);
  const copyMermaid = async () => { try { await navigator.clipboard.writeText(mermaidCode); alert("Mermaid code copied"); } catch {} };

  // Show ready status on mount
  useEffect(()=>{ const s = `Editor ready (rev ${VERSION})`; console.info(s); }, []);

  // Export/Import JSON (layout)
  const onExport = async () => {
    try {
      const payload = { positions, sizes, nodeMeta, edgeMeta, sepY, labelOffsets };
      const json = JSON.stringify(payload, null, 2);
      const anyWindow: any = window as any;

      // 1) File System Access API (best UX)
      if (anyWindow?.showSaveFilePicker) {
        try {
          const handle = await anyWindow.showSaveFilePicker({
            suggestedName: '5g-private-line-layout.json',
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(new Blob([json], { type: 'application/json;charset=utf-8' }));
          await writable.close();
          status.ok('Exported layout via Save dialog.');
          return;
        } catch (pickerErr:any) {
          console.warn('showSaveFilePicker unavailable/blocked, falling back to anchor download.', pickerErr);
        }
      }

      // 2) Anchor download
      try {
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = '5g-private-line-layout.json'; a.rel = 'noopener'; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(() => { try { document.body.removeChild(a); } catch {} try { URL.revokeObjectURL(url); } catch {} }, 0);
        status.ok('Exported layout (download started).');
        return;
      } catch {}

      // 3) Open in new tab as fallback
      try {
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) { status.ok('Opened JSON in a new tab — use "Save As…".'); return; }
      } catch {}

      // 4) Clipboard as last resort
      try {
        await (navigator as any).clipboard?.writeText(json);
        status.err('Download blocked — copied JSON to clipboard.');
      } catch (e:any) {
        status.err('Export failed: ' + (e?.message || e));
      }
    } catch (e:any) {
      status.err('Export failed: ' + (e?.message || e));
    }
  };

  const onImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (json.positions && json.sizes) {
        setPositions((s:any) => ({ ...s, ...json.positions }));
        setSizes((s:any) => ({ ...s, ...json.sizes }));
        if (json.nodeMeta) setNodeMeta((s:any)=> ({ ...s, ...json.nodeMeta }));
        if (json.edgeMeta) setEdgeMetaRaw(coerceEdges(json.edgeMeta).map((e:any)=> {
          let { from, to, label } = e;
          if (label === 'Policy Mediation') label = 'Gxn';
          if (typeof label === 'string' && /gy\s*\(\s*online\s*charging\s*\)/i.test(label)) { label = 'Gyn (Mobile)'; if (from === 'TDF' && to === 'OCS') from = 'SMPM'; }
          if (label === 'SGi/N6') label = 'SGi';
          return { ...e, from, to, label };
        }));
        if (typeof json.sepY === 'number') setSepY(json.sepY);
        if (json.labelOffsets && typeof json.labelOffsets === 'object') setLabelOffsets(json.labelOffsets);
      } else {
        alert("Invalid layout file: expected {positions, sizes, nodeMeta?, edgeMeta?, sepY?, labelOffsets?}");
      }
    } catch (e:any) { alert("Failed to import layout: " + (e?.message || e)); }
  };

  // New: Export SVG/PNG of the current diagram
  const getSerializedSVG = (): string => {
    const svg = svgRef.current;
    if (!svg) throw new Error('SVG not ready');
    // Clone to avoid mutating the live DOM
    const clone = svg.cloneNode(true) as SVGSVGElement;
    // Ensure explicit width/height on the clone root
    clone.setAttribute('width', String(CANVAS_W));
    clone.setAttribute('height', String(CANVAS_H));
    // Wrap children to flatten pan/zoom transform
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    while (clone.firstChild) g.appendChild(clone.firstChild);
    g.setAttribute('transform', `translate(${(offset as any).x}, ${(offset as any).y}) scale(${scale})`);
    clone.appendChild(g);

    const serializer = new XMLSerializer();
    const raw = serializer.serializeToString(clone);
    const header = '<?xml version="1.0" encoding="UTF-8"?>\n';
    return header + raw;
  };

  const onExportSVG = async () => {
    try {
      const svgText = getSerializedSVG();

      // 1) Anchor download
      try {
        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = '5g-private-line-diagram.svg'; a.rel = 'noopener';
        document.body.appendChild(a); a.click();
        setTimeout(()=>{ try{ document.body.removeChild(a);}catch{} try{ URL.revokeObjectURL(url);}catch{} },0);
        status.ok('Exported SVG (download started).');
        return;
      } catch {}

      // 2) Open in new tab (lets user Save As…)
      try {
        const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
        const win = window.open(url, '_blank');
        if (win) { status.ok('Opened SVG in new tab — use "Save As…".'); return; }
      } catch {}

      // 3) Clipboard fallback
      try {
        await (navigator as any).clipboard?.writeText(svgText);
        status.err('Download blocked — copied SVG text to clipboard.');
      } catch (e:any) {
        status.err('SVG export failed: ' + (e?.message||e));
      }
    } catch (e:any) {
      status.err('SVG export failed: ' + (e?.message||e));
    }
  };

  const onExportPNG = async () => {
    try {
      const svgText = getSerializedSVG();
      const img = new Image();
      const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
      await new Promise<void>((resolve, reject) => { img.onload = ()=> resolve(); img.onerror = reject; img.src = svgUrl; });
      const scaleFactor = 2; // crisp PNG
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W * scaleFactor;
      canvas.height = CANVAS_H * scaleFactor;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D not available');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b)=> resolve(b as Blob), 'image/png'));

      // 1) Anchor download
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = '5g-private-line-diagram.png'; a.rel = 'noopener';
        document.body.appendChild(a); a.click();
        setTimeout(()=>{ try{ document.body.removeChild(a);}catch{} try{ URL.revokeObjectURL(url);}catch{} },0);
        status.ok('Exported PNG (download started).');
        return;
      } catch {}

      // 2) New tab fallback (SVG)
      try {
        const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
        const win = window.open(url, '_blank');
        if (win) { status.ok('Opened SVG in a new tab (PNG fallback). Use "Save As…".'); return; }
      } catch {}

      // 3) Clipboard fallback (SVG text)
      try {
        await (navigator as any).clipboard?.writeText(svgText);
        status.err('PNG export blocked — copied SVG text to clipboard.');
      } catch (e:any) {
        status.err('PNG export failed: ' + (e?.message||e));
      }
    } catch (e:any) {
      status.err('PNG export failed: ' + (e?.message||e));
    }
  };

  // Test Export — creates a tiny PNG and tries picker → anchor → new tab → clipboard
  const onTestExport = async () => {
    try {
      const W = 200, H = 120;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D not available');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, W-12, H-12);
      ctx.fillStyle = '#0f172a';
      ctx.font = '14px sans-serif';
      ctx.fillText('5G PL — Test Export', 16, 48);
      ctx.fillText(new Date().toISOString(), 16, 72);
      const blob = await new Promise<Blob>((res)=> canvas.toBlob(b=> res(b as Blob), 'image/png'));

      const anyWin: any = window as any;
      if (anyWin?.showSaveFilePicker) {
        try {
          const handle = await anyWin.showSaveFilePicker({
            suggestedName: 'test-export.png',
            types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob); await writable.close();
          status.ok('Test Export: saved via file picker.');
          return;
        } catch (e) { /* fall through to anchor */ }
      }

      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'test-export.png'; a.rel = 'noopener'; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(()=>{ try{ document.body.removeChild(a);}catch{} try{ URL.revokeObjectURL(url);}catch{} },0);
        status.ok('Test Export: anchor download started.');
        return;
      } catch {}

      try {
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) { status.ok('Test Export: opened in new tab — use "Save As…".'); return; }
      } catch {}

      try {
        await (navigator as any).clipboard?.writeText('Test Export completed but download was blocked.');
        status.err('Test Export: download blocked — copied marker to clipboard.');
      } catch (e:any) {
        status.err('Test Export failed: ' + (e?.message || e));
      }
    } catch (e:any) {
      status.err('Test Export failed: ' + (e?.message || e));
    }
  };

  // Separator drag handlers
  const beginSepDrag = (e: React.MouseEvent) => { e.stopPropagation(); sepDrag.current = { sy: e.clientY, oy: sepY as number }; };
  const moveSepDrag = (e: React.MouseEvent) => {
    if (!sepDrag.current) return;
    const ny = sepDrag.current.oy + (e.clientY - sepDrag.current.sy);
    setSepY(snapToGrid ? snap(clamp(ny, 40, CANVAS_H - 40), GRID) : clamp(ny, 40, CANVAS_H - 40));
  };
  const endSepDrag = () => { sepDrag.current = null; };

  // Label dragging (persisted offsets)
  const labelDrag = useRef<null | { idx:number; sx:number; sy:number; odx:number; ody:number }>(null);
  const beginLabelDrag = (idx:number, e: React.MouseEvent<SVGTextElement, MouseEvent>) => {
    e.stopPropagation();
    const key = String(idx);
    const off = labelOffsets[key] || { dx: 0, dy: 0 };
    labelDrag.current = { idx, sx: e.clientX, sy: e.clientY, odx: off.dx, ody: off.dy };
  };
  const moveLabelDrag = (e: React.MouseEvent) => {
    if (!labelDrag.current) return;
    const dx = e.clientX - labelDrag.current.sx;
    const dy = e.clientY - labelDrag.current.sy;
    const key = String(labelDrag.current.idx);
    setLabelOffsets((s)=> ({ ...s, [key]: { dx: snapToGrid ? snap(labelDrag.current!.odx + dx) : labelDrag.current!.odx + dx, dy: snapToGrid ? snap(labelDrag.current!.ody + dy) : labelDrag.current!.ody + dy } }));
  };
  const endLabelDrag = () => { labelDrag.current = null; };

  // Handlers for node/edge edits
  const onMove = (id:string, p:Point) => setPositions((s:any) => ({ ...s, [id]: p }));
  const onResize = (id:string, sz:Size) => setSizes((s:any) => ({ ...s, [id]: { ...(s[id] || {}), ...sz } }));
  const onEditNodeLabel = (id:string, label:string) => setNodeMeta((s:any)=> ({ ...s, [id]: { ...s[id], label } }));
  const onEditEdgeLabel = (idx:number, label:string) => setEdgeMetaRaw((es:any)=> { const arr = coerceEdges(es); return arr.map((e,i)=> i===idx ? { ...e, label } : e); });

  // Sanity tests ("Run Tests" button)
  const runTests = () => {
    let passed = 0; const total = 16;
    const t1 = Object.keys(nodeMeta).every((k) => (sizes as any)[k]?.w && (sizes as any)[k]?.h); if (t1) passed++;
    const t2 = Array.isArray(edgeMeta) && edgeMeta.every((e:any) => (nodeMeta as any)[e.from] && (nodeMeta as any)[e.to]); if (t2) passed++;
    const t3 = Array.isArray(edgeMeta); if (t3) passed++;
    const t4 = (()=>{ const mm = toMermaid(nodeMeta, edgeMeta); return typeof mm === 'string' && mm.startsWith('flowchart'); })(); if (t4) passed++;
    const t5 = toMermaid(nodeMeta, edgeMeta).includes('["P-GW (PCEF)"]'); if (t5) passed++;
    const t6 = !!(nodeMeta as any).BNG && !!(nodeMeta as any).SMP && !!(nodeMeta as any).SMPM; if (t6) passed++;
    const t7 = typeof sepY === 'number' && sepY > 0 && sepY < CANVAS_H; if (t7) passed++;
    const t8 = (()=>{ const off:any = (offset ?? {x:0,y:0}); return typeof off.x === 'number' && typeof off.y === 'number'; })(); if (t8) passed++;
    const t9 = edgeMeta.some(e => e.label === 'Gyn (Fixed)'); if (t9) passed++;
    const t10 = edgeMeta.some(e => e.label === 'Gyn (Mobile)'); if (t10) passed++;
    const t11 = edgeMeta.some(e => e.label === 'Gxn'); if (t11) passed++;
    const t12 = !toMermaid(nodeMeta, edgeMeta).includes("\n\n\n"); if (t12) passed++;
    const t13 = (()=>{ try { JSON.stringify({ positions, sizes, nodeMeta, edgeMeta, sepY, labelOffsets }); return true; } catch { return false; } })(); if (t13) passed++;
    const t14 = (()=>{ const k = '0'; setLabelOffsets((s)=> ({ ...s, [k]: { dx: 1, dy: 1 } })); return true; })(); if (t14) passed++;
    const t15 = typeof getSerializedSVG() === 'string'; if (t15) passed++;
    const t16 = typeof document.createElement('canvas').getContext === 'function'; if (t16) passed++;
    alert(`${passed}/${total} tests passed`);
  };

  const onZoomIn = () => setScale((s)=> clamp(s + 0.1, 0.4, 3));
  const onZoomOut = () => setScale((s)=> clamp(s - 0.1, 0.4, 3));
  const onResetView = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  return (
    <div className="w-full min-h-screen bg-white text-gray-900 p-6" onContextMenu={(e)=> e.preventDefault()}>
      <div className="max-w-[1400px] mx-auto space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Converged Block Diagram — Mobile (NSA/EPC) + Fixed (FTTx) <span className="text-xs text-gray-500 align-middle">v{VERSION}</span></h1>
            <p className="text-sm text-gray-600">UE/CPE to P‑GW (PCEF) and BNG, with shared SG/Internet; PCRF/SMP control and charging shown.</p>
            <p className="text-[11px] text-gray-500 mt-1">Mermaid panel is <strong>one‑way</strong> (generated). Editing it does not modify the preview.</p>
          </div>
          <Toolbar
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onReset={onResetView}
            onExport={onExport}
            onImport={onImport}
            onExportSVG={onExportSVG}
            onExportPNG={onExportPNG}
            onTestExport={onTestExport}
            onResetAll={()=>{
              try {
                localStorage.removeItem('pcc_positions_v14');
                localStorage.removeItem('pcc_sizes_v14');
                localStorage.removeItem('pcc_node_meta_v14');
                localStorage.removeItem('pcc_edges_v14');
                localStorage.removeItem('pcc_label_offsets_v1');
              } catch {}
              setPositions(INITIAL_POS as any);
              setSizes(Object.fromEntries(Object.keys(NODE_META_DEFAULT).map(k => [k, DEFAULT_SIZE[(NODE_META_DEFAULT as any)[k].shape]])) as any);
              setNodeMeta(NODE_META_DEFAULT as any);
              setEdgeMetaRaw(EDGES_DEFAULT as any);
              setLabelOffsets({});
              setSepY(320);
              onResetView();
            }}
            snapToGrid={snapToGrid}
            setSnapToGrid={setSnapToGrid}
            orthogonal={orthogonal}
            setOrthogonal={setOrthogonal}
            runTests={runTests}
          />
          {status.msg && <div className="text-xs text-gray-600 pt-1">{status.msg}</div>}
        </div>

        {/* Split view: left preview, right Mermaid code */}
        <div className="grid grid-cols-2 gap-4">
          {/* Preview */}
          <div
            className="border rounded-xl bg-white overflow-auto"
            style={{ width: "100%", height: 600 }}
            onWheel={onWheel}
            onMouseMove={(e)=>{ moveSepDrag(e); movePan(e as any); moveLabelDrag(e as any); }}
            onMouseUp={(e)=>{ endSepDrag(); endPan(); endLabelDrag(); }}
            onMouseLeave={(e)=>{ endSepDrag(); endPan(); endLabelDrag(); }}
          >
            <svg
              ref={svgRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{ transform: `translate(${(offset as any).x}px, ${(offset as any).y}px) scale(${scale})`, transformOrigin: "0 0" }}
              onMouseDown={beginPan}
            >
              {/* Pan surface */}
              <rect id="pan-surface" x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="transparent" />

              {/* Grid */}
              {Array.from({ length: Math.ceil(CANVAS_W / GRID) }, (_, i) => (
                <line key={`vg${i}`} x1={i * GRID} y1={0} x2={i * GRID} y2={CANVAS_H} stroke="#eef2ff" strokeWidth={i % 5 === 0 ? 0.8 : 0.4} />
              ))}
              {Array.from({ length: Math.ceil(CANVAS_H / GRID) }, (_, j) => (
                <line key={`hg${j}`} x1={0} y1={j * GRID} x2={CANVAS_W} y2={j * GRID} stroke="#eef2ff" strokeWidth={j % 5 === 0 ? 0.8 : 0.4} />
              ))}

              {/* Horizontal dashed separator (draggable) */}
              <rect x={20} y={sepY - 10} width={CANVAS_W - 40} height={20} fill="transparent" cursor="ns-resize" onMouseDown={beginSepDrag} />
              <line x1={20} y1={sepY} x2={CANVAS_W - 20} y2={sepY} stroke="#9ca3af" strokeDasharray="6,6" strokeWidth={1.6} />
              <text x={24} y={sepY - 8} textAnchor="start" fontSize={11} fill="#6b7280">Mobile (NSA/EPC)</text>
              <text x={24} y={sepY + 16} textAnchor="start" fontSize={11} fill="#6b7280">Fixed (FTTx)</text>

              {/* Service Edge bounding box (around SG + SMP Fixed/Mobile) */}
              {(() => {
                const ids = ["TDF", "SMP", "SMPM"];
                const pad = { x: 16, y: 14 };
                const rects = ids.map((id) => {
                  const meta = (nodeMeta as any)[id] || (NODE_META_DEFAULT as any)[id];
                  const p = (positions as any)[id];
                  const s = (sizes as any)[id] || (DEFAULT_SIZE as any)[meta.shape || 'rect'];
                  return { x1: p.x, y1: p.y, x2: p.x + s.w, y2: p.y + s.h };
                });
                const minX = Math.min(...rects.map(r => r.x1)) - pad.x;
                const minY = Math.min(...rects.map(r => r.y1)) - pad.y;
                const maxX = Math.max(...rects.map(r => r.x2)) + pad.x;
                const maxY = Math.max(...rects.map(r => r.y2)) + pad.y;
                return (
                  <g>
                    <rect x={minX} y={minY} width={Math.max(0, maxX - minX)} height={Math.max(0, maxY - minY)} rx={10} ry={10} fill="none" stroke="#64748b" strokeDasharray="8,6" strokeWidth={1.4} />
                    <text x={maxX} y={maxY + 14} textAnchor="end" dominantBaseline="hanging" fontSize={11} fontWeight="700" fill="#64748b">TDF/PCEF (SG + SMP)</text>
                  </g>
                );
              })()}

              {/* Edges */}
              {(edges as any[]).map((e, i) => (
                <Edge key={`edge-${i}`} a={(e as any).a} b={(e as any).b} label={(e as any).label} style={(e as any).style} orthogonal={orthogonal} />
              ))}

              {/* Nodes */}
              {Object.keys(nodeMeta).map((id) => (
                <Node
                  key={id}
                  id={id}
                  meta={(nodeMeta as any)[id]}
                  pos={(positions as any)[id]}
                  size={(sizes as any)[id]}
                  onMove={onMove}
                  onResize={onResize}
                  snapToGrid={snapToGrid}
                  onEditLabel={onEditNodeLabel}
                />
              ))}

              {/* Edge labels on top (draggable) */}
              {(edges as any[]).map((e, i) => {
                const p = mid((e as any).a, (e as any).b);
                const off = labelOffsets[String(i)] || { dx:0, dy:0 };
                const lbl = (e as any).label || '';
                const stroke = ((e as any).style === 'dashed' ? '#6b7280' : '#0f172a');
                return (
                  <text key={`label-${i}`} x={p.x + off.dx} y={p.y - 8 + off.dy} textAnchor="middle" fontSize={11} fill={stroke}
                    onDoubleClick={(ev)=>{ (ev as any).stopPropagation(); const v = prompt('Connector label', lbl); if (v!=null) onEditEdgeLabel(i, v); }}
                    onMouseDown={(ev)=> beginLabelDrag(i, ev)}
                    style={{ userSelect: 'none', cursor: 'move' }}
                  >{lbl}</text>
                );
              })}
            </svg>
          </div>

          {/* Mermaid code panel */}
          <div className="border rounded-xl p-3 bg-gray-50 flex flex-col">
            <div className="flex items-center justify-between pb-2">
              <h2 className="font-semibold text-sm">Generated Mermaid</h2>
              <div className="flex gap-2">
                <button className="border rounded px-2 py-1 text-sm hover:bg-slate-100 active:scale-[0.98]" onClick={copyMermaid}>Copy</button>
              </div>
            </div>
            <textarea className="flex-1 text-xs font-mono p-2 border rounded bg-white" value={mermaidCode} readOnly />
          </div>
        </div>
      </div>
    </div>
  );
}
