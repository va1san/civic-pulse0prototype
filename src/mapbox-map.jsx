// INTERACTIVE MAP: OpenStreetMap raster tiles, report pins and location picking.
import { useEffect, useMemo, useRef, useState } from "react";
import { BOUNDS } from "./database.js";

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;
const DEFAULT_CENTER = { lat: (BOUNDS.north + BOUNDS.south) / 2, lng: (BOUNDS.west + BOUNDS.east) / 2 };

function project({ lat, lng }, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const safeLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const sin = Math.sin((safeLat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function unproject({ x, y }, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI;
  return { lat, lng };
}

function visibleTiles(center, zoom, size) {
  if (!size.width || !size.height) return [];
  const world = TILE_SIZE * 2 ** zoom;
  const point = project(center, zoom);
  const left = point.x - size.width / 2;
  const top = point.y - size.height / 2;
  const minX = Math.floor(left / TILE_SIZE);
  const maxX = Math.floor((left + size.width) / TILE_SIZE);
  const minY = Math.max(0, Math.floor(top / TILE_SIZE));
  const maxY = Math.min(2 ** zoom - 1, Math.floor((top + size.height) / TILE_SIZE));
  const tiles = [];

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      const wrappedX = ((x % 2 ** zoom) + 2 ** zoom) % 2 ** zoom;
      tiles.push({
        key: `${zoom}/${x}/${y}`,
        src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: x * TILE_SIZE - left,
        top: y * TILE_SIZE - top,
      });
    }
  }
  return tiles;
}

export default function MapView({ issues = [], selectedId, onSelect, pick, onPick, label = "Map of reported issues" }) {
  const box = useRef(null);
  const drag = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const picking = typeof onPick === "function";
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(13);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!box.current) return undefined;
    const element = box.current;
    const resize = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const issue = issues.find((item) => item.id === selectedId);
    if (issue) {
      setCenter(issue.location);
      setZoom((current) => Math.max(current, 15));
    }
  }, [selectedId]); // The selected report is the only reason this effect recentres the map.

  useEffect(() => {
    if (pick) setCenter({ lat: pick.lat, lng: pick.lng });
  }, [pick?.lat, pick?.lng]);

  const tiles = useMemo(() => visibleTiles(center, zoom, size), [center, zoom, size]);
  const centerPoint = useMemo(() => project(center, zoom), [center, zoom]);
  const worldSize = TILE_SIZE * 2 ** zoom;

  const pointPosition = (location) => {
    const point = project(location, zoom);
    let dx = point.x - centerPoint.x;
    if (dx > worldSize / 2) dx -= worldSize;
    if (dx < -worldSize / 2) dx += worldSize;
    return { left: size.width / 2 + dx, top: size.height / 2 + point.y - centerPoint.y };
  };

  const startDrag = (event) => {
    if (event.button !== 0 || event.target.closest("button, a")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2) {
      const [first, second] = [...pointers.current.values()];
      const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      pinch.current = {
        distance,
        zoom,
        moved: false,
        anchor: unproject({
          x: centerPoint.x + midpoint.x - box.current.getBoundingClientRect().left - size.width / 2,
          y: centerPoint.y + midpoint.y - box.current.getBoundingClientRect().top - size.height / 2,
        }, zoom),
      };
      drag.current = null;
      setDragging(false);
      return;
    }
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCenter: centerPoint,
      moved: false,
    };
  };

  const moveDrag = (event) => {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      event.preventDefault();
      const [first, second] = [...pointers.current.values()];
      const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const pinchScale = Math.log2(Math.hypot(second.x - first.x, second.y - first.y) / pinch.current.distance);
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(pinch.current.zoom + pinchScale * 0.5)));
      const rect = box.current.getBoundingClientRect();
      const anchorPoint = project(pinch.current.anchor, nextZoom);
      pinch.current.moved = true;
      setZoom(nextZoom);
      setCenter(unproject({
        x: anchorPoint.x - (midpoint.x - rect.left - size.width / 2),
        y: anchorPoint.y - (midpoint.y - rect.top - size.height / 2),
      }, nextZoom));
      return;
    }
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.current.startX;
    const dy = event.clientY - drag.current.startY;
    if (!drag.current.moved && Math.hypot(dx, dy) > 3) {
      drag.current.moved = true;
      setDragging(true);
    }
    if (drag.current.moved) {
      setCenter(unproject({ x: drag.current.startCenter.x - dx, y: drag.current.startCenter.y - dy }, zoom));
    }
  };

  const finishDrag = (event) => {
    const wasPinching = !!pinch.current;
    pointers.current.delete(event.pointerId);
    if (wasPinching) {
      pinch.current = null;
      if (pointers.current.size) {
        const [pointerId, point] = [...pointers.current.entries()][0];
        drag.current = { pointerId, startX: point.x, startY: point.y, startCenter: project(center, zoom), moved: true };
        setDragging(true);
      }
      return;
    }
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const didMove = drag.current.moved;
    drag.current = null;
    setDragging(false);
    if (!didMove && picking && box.current) {
      const rect = box.current.getBoundingClientRect();
      const point = project(center, zoom);
      const location = unproject({
        x: point.x + event.clientX - rect.left - size.width / 2,
        y: point.y + event.clientY - rect.top - size.height / 2,
      }, zoom);
      onPick(location);
    }
  };

  const zoomBy = (amount) => setZoom((current) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + amount)));
  const zoomAtPointer = (event) => {
    event.preventDefault();
    const amount = event.deltaY < 0 ? 1 : -1;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + amount));
    if (nextZoom === zoom || !box.current) return;
    const rect = box.current.getBoundingClientRect();
    const offset = { x: event.clientX - rect.left - size.width / 2, y: event.clientY - rect.top - size.height / 2 };
    const anchor = unproject({ x: centerPoint.x + offset.x, y: centerPoint.y + offset.y }, zoom);
    const anchorPoint = project(anchor, nextZoom);
    setCenter(unproject({ x: anchorPoint.x - offset.x, y: anchorPoint.y - offset.y }, nextZoom));
    setZoom(nextZoom);
  };
  const pickCenter = () => onPick?.(center);

  return (
    <div
      ref={box}
      className={`map-box osm-map${dragging ? " is-dragging" : ""}`}
      role="group"
      aria-label={label}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onWheel={zoomAtPointer}
      onKeyDown={(event) => {
        const delta = 100 / 2 ** zoom;
        if (event.key === "ArrowLeft") setCenter((c) => ({ ...c, lng: c.lng - delta }));
        if (event.key === "ArrowRight") setCenter((c) => ({ ...c, lng: c.lng + delta }));
        if (event.key === "ArrowUp") setCenter((c) => ({ ...c, lat: c.lat + delta }));
        if (event.key === "ArrowDown") setCenter((c) => ({ ...c, lat: c.lat - delta }));
      }}
      tabIndex={0}
    >
      <div className="osm-tiles" aria-hidden="true">
        {tiles.map((tile) => (
          <img
            key={tile.key}
            className="osm-tile"
            src={tile.src}
            alt=""
            draggable="false"
            style={{ left: tile.left, top: tile.top }}
            onError={() => setTileError(true)}
          />
        ))}
      </div>

      <div className="osm-markers">
        {!picking && issues.map((issue) => {
          const position = pointPosition(issue.location);
          if (position.left < -100 || position.left > size.width + 100 || position.top < -100 || position.top > size.height + 100) return null;
          const radius = Math.max(28, Math.min(70, 10 + (zoom - 10) * 10));
          const opacity = Math.max(0.12, Math.min(0.55, 0.55 - Math.max(0, zoom - 13) * 0.12));
          return <span key={`density-${issue.id}`} className="osm-density-spot" style={{ left: position.left, top: position.top, width: radius * 2, height: radius * 2, opacity }} />;
        })}
        {!picking && issues.map((issue) => {
          const position = pointPosition(issue.location);
          if (position.left < -30 || position.left > size.width + 30 || position.top < -30 || position.top > size.height + 30) return null;
          return (
            <button
              key={issue.id}
              type="button"
              className={`mb-pin${issue.id === selectedId ? " on" : ""}`}
              style={{ left: position.left, top: position.top }}
              aria-label={`${issue.category}: ${issue.text.slice(0, 70)}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onSelect?.(issue.id)}
            />
          );
        })}
        {picking && pick && (() => {
          const position = pointPosition(pick);
          return <span className="mb-pick" style={{ left: position.left, top: position.top }} aria-label="Selected location" />;
        })()}
      </div>

      <div className="osm-controls" aria-label="Map controls">
        <button type="button" aria-label="Zoom in" onPointerDown={(event) => event.stopPropagation()} onClick={() => zoomBy(1)}>+</button>
        <button type="button" aria-label="Zoom out" onPointerDown={(event) => event.stopPropagation()} onClick={() => zoomBy(-1)}>−</button>
      </div>

      {picking && (
        <button type="button" className="map-centre-btn" onPointerDown={(event) => event.stopPropagation()} onClick={pickCenter}>
          Drop pin at map centre
        </button>
      )}
      <a className="osm-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        © OpenStreetMap contributors
      </a>
      {tileError && <span className="osm-error" role="status">Some map tiles could not be loaded.</span>}
    </div>
  );
}
