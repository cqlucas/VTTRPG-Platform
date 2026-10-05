"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GripHorizontal, X } from "lucide-react";

interface DraggableModalProps {
  id?: string;
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  initialHeight?: number;
  headerActions?: React.ReactNode;
}

const EDGE_MARGIN = 8;

export function DraggableModal({ 
  id = "draggable-modal", 
  title, 
  icon, 
  open, 
  onClose, 
  children, 
  width = 320,
  initialHeight = 400,
  headerActions 
}: DraggableModalProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clamp = useCallback((x: number, y: number) => {
    const el = windowRef.current;
    const w = el?.offsetWidth ?? width;
    const h = el?.offsetHeight ?? initialHeight;
    return {
      x: Math.min(Math.max(EDGE_MARGIN, x), window.innerWidth - w - EDGE_MARGIN),
      y: Math.min(Math.max(EDGE_MARGIN, y), window.innerHeight - h - EDGE_MARGIN),
    };
  }, [width, initialHeight]);

  useLayoutEffect(() => {
    if (!open || position) return;
    const h = windowRef.current?.offsetHeight ?? initialHeight;
    setPosition(clamp((window.innerWidth - width) / 2, (window.innerHeight - h) / 2));
  }, [open, position, clamp, width, initialHeight]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => setPosition((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, clamp]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !position) return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    setIsDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffset.current) return;
    setPosition(clamp(e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffset.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragOffset.current = null;
    setIsDragging(false);
  };

  if (!open) return null;

  return (
    <div
      ref={windowRef}
      role="dialog"
      id={id}
      className={`fixed z-50 layer-3-floating rounded-lg shadow-2xl shadow-black/50 animate-window-in select-none flex flex-col ${isDragging ? "cursor-grabbing" : ""}`}
      style={{
        width: width,
        maxHeight: "80vh",
        left: position?.x ?? -9999,
        top: position?.y ?? -9999,
      }}
    >
      <div
        className={`flex items-center justify-between px-3 py-2.5 border-b border-border-subtle touch-none shrink-0 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-white text-[13px]">{title}</span>
          <GripHorizontal className="w-3.5 h-3.5 text-text-muted/40" />
        </div>
        <div className="flex items-center gap-1">
          {headerActions}
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-surface-base rounded-b-lg">
        {children}
      </div>
    </div>
  );
}
