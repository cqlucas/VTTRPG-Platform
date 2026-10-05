"use client";

import { useState, useRef, useCallback } from "react";
import { Ruler, PlusSquare, Eraser } from "lucide-react";

interface BoardProps {
  isDM: boolean;
  tiles: Record<string, { image: string }>;
  onTilesChange: (newTiles: Record<string, { image: string }>) => void;
  onPointerChange: (start: { x: number; y: number } | null, current: { x: number; y: number } | null) => void;
  peerPointers: Record<string, { start: { x: number; y: number } | null; current: { x: number; y: number } | null }>;
}

const TILE_SIZE = 50;
const TILE_IMAGE_PATH = "/images/genericTile.png";

export function Board({ isDM, tiles, onTilesChange, onPointerChange, peerPointers }: BoardProps) {
  const [activeTool, setActiveTool] = useState<"measure" | "add" | "erase" | null>(null);
  
  // Measure state
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureCurrent, setMeasureCurrent] = useState<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const syncGridToPeers = useCallback((newTiles: Record<string, { image: string }>) => {
    console.log("Mock: syncGridToPeers", newTiles);
  }, []);

  const saveGridToCache = useCallback((newTiles: Record<string, { image: string }>) => {
    console.log("Mock: saveGridToCache", newTiles);
  }, []);

  const broadcastPointer = useCallback((start: { x: number; y: number } | null, current: { x: number; y: number } | null) => {
    console.log("Mock: broadcastPointer", { start, current });
  }, []);

  const getGridCoords = (e: React.MouseEvent) => {
    if (!boardRef.current) return { x: 0, y: 0 };
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getGridCoords(e);
    const key = `${coords.x},${coords.y}`;

    if (activeTool === "add" && isDM) {
      const newTiles = { ...tiles, [key]: { image: TILE_IMAGE_PATH } };
      onTilesChange(newTiles);
    } else if (activeTool === "erase" && isDM) {
      if (tiles[key]) {
        const newTiles = { ...tiles };
        delete newTiles[key];
        onTilesChange(newTiles);
      }
    } else if (activeTool === "measure") {
      setMeasureStart(coords);
      setMeasureCurrent(coords);
      onPointerChange(coords, coords);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (activeTool === "measure" && measureStart) {
      const coords = getGridCoords(e);
      setMeasureCurrent(coords);
      onPointerChange(measureStart, coords);
    }
  };

  const handleMouseUp = () => {
    if (activeTool === "measure") {
      setMeasureStart(null);
      setMeasureCurrent(null);
      onPointerChange(null, null);
    }
  };

  const handleMouseLeave = () => {
    if (activeTool === "measure") {
      setMeasureStart(null);
      setMeasureCurrent(null);
      onPointerChange(null, null);
    }
  };

  // Calculate distance
  let distanceText = "";
  let lineCoords = null;
  if (measureStart && measureCurrent) {
    const dx = measureCurrent.x - measureStart.x;
    const dy = measureCurrent.y - measureStart.y;
    // Using Euclidean distance for the visual ruler
    const distanceTiles = Math.sqrt(dx * dx + dy * dy);
    const distanceFt = Math.round(distanceTiles) * 5;
    distanceText = `${distanceFt} ft`;

    lineCoords = {
      x1: measureStart.x * TILE_SIZE + TILE_SIZE / 2,
      y1: measureStart.y * TILE_SIZE + TILE_SIZE / 2,
      x2: measureCurrent.x * TILE_SIZE + TILE_SIZE / 2,
      y2: measureCurrent.y * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 bg-surface-base border border-border-subtle rounded-lg p-1.5 shadow-2xl">
        <button
          className={`p-2 rounded transition-colors ${activeTool === "measure" ? "bg-primary/20 text-primary" : "text-text-muted hover:text-white hover:bg-surface-bright"}`}
          onClick={() => setActiveTool(activeTool === "measure" ? null : "measure")}
          title="Medir Distância"
        >
          <Ruler className="w-5 h-5" />
        </button>
        {isDM && (
          <>
            <button
              className={`p-2 rounded transition-colors ${activeTool === "add" ? "bg-primary/20 text-primary" : "text-text-muted hover:text-white hover:bg-surface-bright"}`}
              onClick={() => setActiveTool(activeTool === "add" ? null : "add")}
              title="Colocar Tile"
            >
              <PlusSquare className="w-5 h-5" />
            </button>
            <button
              className={`p-2 rounded transition-colors ${activeTool === "erase" ? "bg-danger/20 text-danger" : "text-text-muted hover:text-white hover:bg-surface-bright"}`}
              onClick={() => setActiveTool(activeTool === "erase" ? null : "erase")}
              title="Apagar Tile"
            >
              <Eraser className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Grid Canvas */}
      <div 
        ref={boardRef}
        className="absolute inset-0 select-none touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
          cursor: activeTool ? "crosshair" : "default"
        }}
      >
        {/* Render Tiles */}
        {Object.entries(tiles).map(([key, tile]) => {
          const [x, y] = key.split(",").map(Number);
          return (
            <img 
              key={key}
              src={tile.image} 
              alt="Tile"
              className="absolute pointer-events-none object-cover rounded-sm"
              style={{
                left: x * TILE_SIZE,
                top: y * TILE_SIZE,
                width: TILE_SIZE,
                height: TILE_SIZE,
              }}
            />
          );
        })}

        {/* Measure Ruler Overlay */}
        {lineCoords && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ overflow: "visible" }}>
            <line 
              x1={lineCoords.x1} 
              y1={lineCoords.y1} 
              x2={lineCoords.x2} 
              y2={lineCoords.y2} 
              stroke="var(--color-primary, #6366f1)" 
              strokeWidth="2"
              strokeDasharray="4,4"
            />
            {/* Tooltip background */}
            <rect 
              x={(lineCoords.x1 + lineCoords.x2) / 2 - 28}
              y={(lineCoords.y1 + lineCoords.y2) / 2 - 12}
              width="56"
              height="24"
              rx="4"
              fill="#0f172a"
              stroke="var(--color-primary, #6366f1)"
              strokeWidth="1"
            />
            {/* Tooltip text */}
            <text 
              x={(lineCoords.x1 + lineCoords.x2) / 2} 
              y={(lineCoords.y1 + lineCoords.y2) / 2 + 4} 
              fill="white" 
              fontSize="12" 
              fontFamily="monospace"
              textAnchor="middle"
            >
              {distanceText}
            </text>
          </svg>
        )}

        {/* Peer Pointers Overlay */}
        {Object.entries(peerPointers).map(([peerId, pointer]) => {
          if (!pointer.start || !pointer.current) return null;
          const dx = pointer.current.x - pointer.start.x;
          const dy = pointer.current.y - pointer.start.y;
          const distanceTiles = Math.sqrt(dx * dx + dy * dy);
          const distanceFt = Math.round(distanceTiles) * 5;
          const text = `${distanceFt} ft`;

          const pCoords = {
            x1: pointer.start.x * TILE_SIZE + TILE_SIZE / 2,
            y1: pointer.start.y * TILE_SIZE + TILE_SIZE / 2,
            x2: pointer.current.x * TILE_SIZE + TILE_SIZE / 2,
            y2: pointer.current.y * TILE_SIZE + TILE_SIZE / 2,
          };

          return (
            <svg key={peerId} className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ overflow: "visible" }}>
              <line 
                x1={pCoords.x1} 
                y1={pCoords.y1} 
                x2={pCoords.x2} 
                y2={pCoords.y2} 
                stroke="var(--color-secondary, #14b8a6)" 
                strokeWidth="2"
                strokeDasharray="4,4"
                opacity="0.7"
              />
              <rect 
                x={(pCoords.x1 + pCoords.x2) / 2 - 28}
                y={(pCoords.y1 + pCoords.y2) / 2 - 12}
                width="56"
                height="24"
                rx="4"
                fill="#0f172a"
                stroke="var(--color-secondary, #14b8a6)"
                strokeWidth="1"
              />
              <text 
                x={(pCoords.x1 + pCoords.x2) / 2} 
                y={(pCoords.y1 + pCoords.y2) / 2 + 4} 
                fill="white" 
                fontSize="12" 
                fontFamily="monospace"
                textAnchor="middle"
              >
                {text}
              </text>
            </svg>
          );
        })}
      </div>
    </div>
  );
}
