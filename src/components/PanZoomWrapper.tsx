/**
 * PanZoomWrapper Component
 *
 * Wraps any content with pan and zoom functionality for view-only mode.
 * Uses the usePanZoom hook to provide the same pan/zoom experience as edit mode.
 */

import { useRef, useState } from 'react';
import { usePanZoom } from '../hooks/usePanZoom';

interface PanZoomWrapperProps {
  children: React.ReactNode;
  width?: number;
  height?: number;
}

export function PanZoomWrapper({ children, width = 1400, height = 800 }: PanZoomWrapperProps) {
  const { scale, offset, setOffset, onWheel } = usePanZoom();
  const dragging = useRef<null | { x: number; y: number; ox: number; oy: number }>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Custom pan handlers that work on any element (not just background)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Always allow panning in view mode (left click or middle click)
    if (e.button === 0 || e.button === 1) {
      e.preventDefault();
      dragging.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    setOffset({ x: dragging.current.ox + dx, y: dragging.current.oy + dy });
  };

  const handleMouseUp = () => {
    dragging.current = null;
    setIsDragging(false);
  };

  return (
    <div className="relative w-full h-full min-h-[600px]">
      {/* Instructions */}
      <div className="absolute top-2 left-2 z-10 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <div>💡 <strong>Zoom:</strong> Scroll wheel</div>
          <div>💡 <strong>Pan:</strong> Click and drag</div>
        </div>
      </div>

      {/* Pan/Zoom Canvas */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        onWheel={onWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', minHeight: '600px' }}
        className="bg-white dark:bg-gray-900"
      >
        {/* Background (click to pan) */}
        <rect
          id="pan-surface"
          x="0"
          y="0"
          width={width}
          height={height}
          fill="transparent"
        />

        {/* Transformed content */}
        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
          {children}
        </g>
      </svg>
    </div>
  );
}
