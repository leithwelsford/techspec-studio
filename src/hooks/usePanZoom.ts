/**
 * usePanZoom Hook
 *
 * Provides pan and zoom functionality for SVG canvases.
 * Features:
 * - Scroll wheel zoom (Ctrl+wheel prevented to avoid browser zoom)
 * - Pan with spacebar + drag or middle-click
 * - Click background to pan
 * - Programmatic zoom and offset control
 */

import { useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

interface UsePanZoomReturn {
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  offset: Point;
  setOffset: React.Dispatch<React.SetStateAction<Point>>;
  onWheel: (e: React.WheelEvent) => void;
  beginPan: (e: React.MouseEvent) => void;
  movePan: (e: React.MouseEvent) => void;
  endPan: () => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function usePanZoom(): UsePanZoomReturn {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const dragging = useRef<null | { x: number; y: number; ox: number; oy: number }>(null);
  const spaceHeld = useRef(false);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        // Don't prevent spacebar if user is typing in an input/textarea
        const target = e.target as HTMLElement;
        const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        if (!isTyping) {
          e.preventDefault();
          spaceHeld.current = true;
        }
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
      }
    };

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

  const endPan = () => {
    dragging.current = null;
  };

  return { scale, setScale, offset, setOffset, onWheel, beginPan, movePan, endPan };
}
