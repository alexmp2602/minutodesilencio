// src/components/Flowers.tsx
"use client";

import * as THREE from "three";
import { useMemo, useState, useRef, useLayoutEffect, useEffect } from "react";
import useSWR from "swr";
import type { Flower } from "@/lib/types";
import { fetcher } from "@/lib/fetcher";
import {
  Instances,
  Instance,
  useCursor,
  useGLTF,
  Html,
} from "@react-three/drei";
import { ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ===== Config ===== */
const CAP = 640;
const MODEL_URL = "/models/flower.glb";
const GARDEN_RADIUS = 60; // ⬅ radio del jardín circular
const MIN_SEPARATION = 0.85;
const MAX_NUDGE_STEPS = 28;

/* Hitbox */
const HITBOX_RADIUS = 0.75;
const HITBOX_HEIGHT = 3.0;
const HITBOX_CENTER_FACTOR = 2;

/* Pins (perf) */
const MAX_PINS = 8;
const PIN_MAX_DIST = 18;
const PIN_RECALC_MS = 250;
const CAMERA_IDLE_EPS = 0.0035;

/* Helpers */
type FlowersResponse = { flowers: Flower[] };

/* Paleta de colores por tipo */
const FLOWER_COLORS: Record<string, string[]> = {
  rose: ["#ff4da6", "#ff66c4", "#ff3399", "#ff5cab"],
  tulip: ["#ff8c00", "#ffb347", "#ff944d", "#ff7a1a"],
  daisy: ["#ffe066", "#fff275", "#fff799", "#ffd54d"],
};

/* Colores de fallback si el tipo es desconocido */
const FALLBACK_BRIGHT = ["#ff66c4", "#ffd54d", "#69a9ff", "#7cffb2"];

function pickPaletteColor(f: Flower): THREE.Color {
  if (f.color && f.color.trim()) return new THREE.Color(f.color);
  const palette = (f.family && FLOWER_COLORS[f.family]) || FALLBACK_BRIGHT;
  const rnd = seedFromString(f.id);
  const hex = palette[Math.floor(rnd() * palette.length)]!;
  // aseguramos que llegue en lineal para el material
  return new THREE.Color(hex);
}

function seedFromString(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    const t = (h ^= h >>> 16) >>> 0;
    return (t & 0xffff) / 0xffff;
  };
}

function positionFor(f: Flower): [number, number, number] {
  if (
    typeof f.x === "number" &&
    typeof f.y === "number" &&
    typeof f.z === "number"
  ) {
    return [f.x, Math.max(0, f.y), f.z];
  }
  const rnd = seedFromString(f.id);
  const r = 3 + rnd() * 9;
  const a = rnd() * Math.PI * 2;
  return [Math.cos(a) * r, 0, Math.sin(a) * r];
}

function clampToDisk(x: number, z: number, r: number) {
  const d2 = x * x + z * z;
  const r2 = r * r;
  if (d2 <= r2) return [x, z] as const;
  const d = Math.sqrt(d2);
  return [(x / d) * r * 0.98, (z / d) * r * 0.98] as const; // 2% margen interior
}

function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ms:userId");
}

function gridKey(x: number, z: number, cell = MIN_SEPARATION * 0.75) {
  const gx = Math.floor(x / cell);
  const gz = Math.floor(z / cell);
  return `${gx}:${gz}`;
}

function resolveNonOverlappingPosition(
  base: [number, number, number],
  taken: Set<string>,
  id: string
): [number, number, number] {
  const [bx, by, bz] = base;
  const cell = MIN_SEPARATION * 0.75;
  const startKey = gridKey(bx, bz, cell);
  if (!taken.has(startKey)) {
    taken.add(startKey);
    return [bx, by, bz];
  }

  const rnd = seedFromString(id);
  const angle0 = rnd() * Math.PI * 2;
  let radius = MIN_SEPARATION * 0.5;
  for (let i = 0; i < MAX_NUDGE_STEPS; i++) {
    const angle = angle0 + i * 0.85;
    const x = bx + Math.cos(angle) * radius;
    const z = bz + Math.sin(angle) * radius;
    const key = gridKey(x, z, cell);
    if (!taken.has(key)) {
      taken.add(key);
      return [x, by, z];
    }
    radius += 0.18 + rnd() * 0.07;
  }
  return [bx, by, bz];
}

/* GLB → geometry única */
type GLBData = {
  geom: THREE.BufferGeometry | null;
  baseScale: number;
  loaded: boolean;
};

function useMergedFlowerGLB(url = MODEL_URL): GLBData {
  const gltf: import("three-stdlib").GLTF | null = useGLTF(url);
  return useMemo(() => {
    if (!gltf?.scene) return { geom: null, baseScale: 1, loaded: false };

    const parts: THREE.BufferGeometry[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        if (!mesh.geometry) return;

        const g = mesh.geometry.clone();
        g.applyMatrix4(mesh.matrixWorld);
        (g as THREE.BufferGeometry).morphAttributes = {} as Record<
          string,
          unknown
        >;
        g.deleteAttribute("skinIndex");
        g.deleteAttribute("skinWeight");

        parts.push(g);
      }
    });

    const merged =
      parts.length > 1 ? mergeGeometries(parts, true) : parts[0] ?? null;
    if (!merged) return { geom: null, baseScale: 1, loaded: false };

    merged.computeBoundingBox();
    const size = new THREE.Vector3();
    merged.boundingBox!.getSize(size);
    if (size.y < size.z && size.z >= size.x) merged.rotateX(Math.PI / 2);
    else if (size.y < size.x && size.x >= size.z) merged.rotateZ(-Math.PI / 2);

    merged.rotateY(Math.PI);

    merged.computeBoundingBox();
    const bb = merged.boundingBox!;
    const height = Math.max(0.0001, bb.max.y - bb.min.y);
    merged.translate(0, -bb.min.y, 0);

    (merged as THREE.BufferGeometry).morphAttributes = {};
    merged.deleteAttribute("skinIndex");
    merged.deleteAttribute("skinWeight");
    merged.computeVertexNormals();

    merged.computeBoundingSphere();
    if (merged.boundingSphere) {
      merged.boundingSphere.radius = GARDEN_RADIUS + 5; // acorde al jardín circular
    }

    const baseScale = 1 / height;
    return { geom: merged, baseScale, loaded: true };
  }, [gltf]);
}
useGLTF.preload(MODEL_URL);

/* Component */
type Props = { gardenActive?: boolean };

export default function Flowers({ gardenActive = false }: Props) {
  const { data } = useSWR<FlowersResponse>("/api/flowers", fetcher, {
    revalidateOnFocus: false,
  });
  const { camera } = useThree();

  const { geom, baseScale, loaded } = useMergedFlowerGLB();

  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useCursor(Boolean(hoverId));

  const myId = getUserId();

  const items = useMemo(() => {
    const list = data?.flowers ?? [];
    const taken = new Set<string>();

    return list.slice(0, CAP).map((f) => {
      const basePos = positionFor(f);
      let pos = resolveNonOverlappingPosition(basePos, taken, f.id);
      // ⬇ clamp al disco del jardín
      const [cx, cz] = clampToDisk(pos[0], pos[2], GARDEN_RADIUS - 0.6);
      pos = [cx, pos[1], cz];

      const rnd = seedFromString(f.id);
      const scaleBase = 2.35;
      const scaleJitter = scaleBase * (0.92 + rnd() * 0.18);

      const colorLinear = pickPaletteColor(f).clone().convertSRGBToLinear();

      const alive = f.alive ?? !f.wilted;
      const tiltA = rnd() * Math.PI * 2;
      const tilt = !alive ? 0.25 + rnd() * 0.2 : 0;
      const rotX = Math.cos(tiltA) * tilt;
      const rotZ = Math.sin(tiltA) * tilt;
      const isMine = !!myId && f.user_id === myId;

      const msg =
        typeof f.message === "string" && f.message.trim().length > 0
          ? f.message.trim()
          : "";

      return { f, pos, scaleJitter, colorLinear, rotX, rotZ, isMine, msg };
    });
  }, [data?.flowers, myId]);

  const handleSelect = (id: string, position: [number, number, number]) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("flower-focus", { detail: { id, position } })
      );
    }
    setSelectedId(id);
  };

  const hasGLB = loaded && !!geom;

  const instRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = instRef.current;
    if (!m) return;
    m.frustumCulled = false;
    m.geometry?.computeBoundingSphere?.();
    if (m.geometry?.boundingSphere) {
      m.geometry.boundingSphere.radius = GARDEN_RADIUS + 5;
    }
  }, [hasGLB]);

  /* Autoselección de mi flor sólo cuando el jardín está activo */
  useEffect(() => {
    if (!gardenActive) {
      setSelectedId(null);
      return;
    }
    const mine = items.find((it) => it.isMine);
    if (mine) setSelectedId(mine.f.id);
  }, [items, gardenActive]);

  /* IDs con tooltip auto (no seleccionada) */
  const visibleTipIds = useMemo(() => {
    if (!gardenActive) return new Set<string>();
    const s = new Set<string>();
    const mine = items.find((it) => it.isMine);
    if (mine && mine.f.id !== selectedId) s.add(mine.f.id);
    return s;
  }, [items, selectedId, gardenActive]);

  /* Controls hook */
  interface OrbitControlsType {
    setEnabled?: (enabled: boolean) => void;
  }
  const controlsSetEnabled = (enabled: boolean) => {
    try {
      (
        window as unknown as { __controls?: OrbitControlsType }
      ).__controls?.setEnabled?.(enabled);
    } catch {}
  };

  /* PERF: pins cercanos (sólo con jardín activo) */
  const [pinIds, setPinIds] = useState<Set<string>>(new Set());
  const lastCam = useRef(new THREE.Vector3());
  const movingAcc = useRef(0);
  const tAcc = useRef(0);

  useFrame((_, dt) => {
    if (!gardenActive) {
      if (pinIds.size) setPinIds(new Set());
      return;
    }

    tAcc.current += dt;
    const camPos = camera.position;
    const d = lastCam.current.distanceToSquared(camPos);
    const moving = d > CAMERA_IDLE_EPS * CAMERA_IDLE_EPS;
    lastCam.current.copy(camPos);

    if (moving) movingAcc.current = 0.2;
    else movingAcc.current = Math.max(0, movingAcc.current - dt);

    if (movingAcc.current > 0) {
      if (pinIds.size) setPinIds(new Set());
      return;
    }

    if (tAcc.current < PIN_RECALC_MS / 1000) return;
    tAcc.current = 0;

    const mustShow = new Set<string>();
    const mine = items.find((it) => it.isMine);
    if (mine) mustShow.add(mine.f.id);
    if (hoverId) mustShow.add(hoverId);
    if (selectedId) mustShow.add(selectedId);

    if (mustShow.size < MAX_PINS + mustShow.size) {
      const cx = camPos.x,
        cy = camPos.y,
        cz = camPos.z;
      const maxD2 = PIN_MAX_DIST * PIN_MAX_DIST;
      const candidates: { id: string; d2: number }[] = [];
      for (const it of items) {
        if (mustShow.has(it.f.id)) continue;
        const [x, y, z] = it.pos;
        const dx = x - cx,
          dy = y + 1.2 - cy,
          dz = z - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 <= maxD2) candidates.push({ id: it.f.id, d2 });
      }
      candidates.sort((a, b) => a.d2 - b.d2);
      for (
        let i = 0;
        i < candidates.length &&
        mustShow.size <
          MAX_PINS + (hoverId ? 1 : 0) + (selectedId ? 1 : 0) + (mine ? 1 : 0);
        i++
      ) {
        mustShow.add(candidates[i]!.id);
      }
    }

    const same =
      pinIds.size === mustShow.size &&
      [...pinIds].every((id) => mustShow.has(id));
    if (!same) setPinIds(mustShow);
  });

  const onUiDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    controlsSetEnabled(false);
  };
  const onUiUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    controlsSetEnabled(true);
  };

  return (
    <>
      {/* Geometría (visual) */}
      {hasGLB ? (
        <Instances
          ref={instRef}
          name="flowers"
          limit={CAP}
          range={items.length}
          castShadow
          receiveShadow
          frustumCulled={false}
          onPointerMissed={(e) => {
            if (e.type === "click") setSelectedId(null);
          }}
        >
          <primitive object={geom!} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            color="#ffffff"
            roughness={0.55}
            metalness={0.04}
            depthWrite
            depthTest
          />
          {items.map(({ f, pos, scaleJitter, colorLinear, rotX, rotZ }) => {
            const s = scaleJitter * baseScale;
            const yBase = Math.max(0, pos[1]);
            return (
              <Instance
                key={`flower-${f.id}`}
                position={[pos[0], yBase, pos[2]]}
                scale={[s, s, s]}
                rotation={[rotX, 0, rotZ]}
                color={colorLinear}
                onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                  if (e.instanceId != null) controlsSetEnabled(false);
                }}
                onPointerUp={() => controlsSetEnabled(true)}
                onPointerCancel={() => controlsSetEnabled(true)}
                onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation();
                  setHoverId(f.id);
                }}
                onPointerOut={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation();
                  setHoverId((id) => (id === f.id ? null : id));
                }}
                onClick={(e: ThreeEvent<PointerEvent>) => {
                  if (
                    (window as Window & { __orbitDragging?: boolean })
                      .__orbitDragging
                  )
                    return;
                  e.stopPropagation();
                  handleSelect(f.id, [pos[0], yBase, pos[2]]);
                }}
              />
            );
          })}
        </Instances>
      ) : (
        <Instances
          name="flowers-fallback"
          limit={CAP}
          range={items.length}
          frustumCulled={false}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
          <meshStandardMaterial roughness={0.7} metalness={0.0} />
          {items.map(({ f, pos, scaleJitter }) => {
            const s = scaleJitter * 0.9;
            const yBase = Math.max(0, pos[1]);
            return (
              <Instance
                key={`flower-${f.id}`}
                position={[pos[0], yBase + 0.5 * s, pos[2]]}
                scale={[s, s, s]}
                color={"#7aa34f"}
                onPointerDown={() => controlsSetEnabled(false)}
                onPointerUp={() => controlsSetEnabled(true)}
                onPointerCancel={() => controlsSetEnabled(true)}
                onClick={(e: ThreeEvent<PointerEvent>) => {
                  if (
                    (window as Window & { __orbitDragging?: boolean })
                      .__orbitDragging
                  )
                    return;
                  e.stopPropagation();
                  handleSelect(f.id, [pos[0], yBase, pos[2]]);
                }}
              />
            );
          })}
        </Instances>
      )}

      {/* Hitboxes (sólo activas dentro del jardín) */}
      {gardenActive && (
        <Instances
          name="flower-hitareas"
          limit={CAP}
          range={items.length}
          frustumCulled={false}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (e.instanceId != null) controlsSetEnabled(false);
          }}
          onPointerUp={() => controlsSetEnabled(true)}
          onPointerCancel={() => controlsSetEnabled(true)}
          onPointerMissed={(e) => {
            if (e.type === "click") setSelectedId(null);
          }}
        >
          <cylinderGeometry
            args={[HITBOX_RADIUS, HITBOX_RADIUS, HITBOX_HEIGHT, 16]}
          />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={true}
            colorWrite={false as unknown as boolean}
          />
          {items.map(({ f, pos, scaleJitter }) => {
            const s = scaleJitter * baseScale;
            const yBase = Math.max(0, pos[1]);
            const yCenter = yBase + s * HITBOX_CENTER_FACTOR;
            return (
              <Instance
                key={`hit-${f.id}`}
                position={[pos[0], yCenter, pos[2]]}
                scale={[s, s, s]}
                onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation();
                  setHoverId(f.id);
                }}
                onPointerOut={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation();
                  setHoverId((id) => (id === f.id ? null : id));
                }}
                onClick={(e: ThreeEvent<PointerEvent>) => {
                  if (
                    (window as Window & { __orbitDragging?: boolean })
                      .__orbitDragging
                  )
                    return;
                  e.stopPropagation();
                  handleSelect(f.id, [pos[0], yBase, pos[2]]);
                }}
              />
            );
          })}
        </Instances>
      )}

      {/* Pins */}
      {gardenActive &&
        items.map(({ f, pos, isMine, msg }) => {
          if (!pinIds.has(f.id) && !isMine) return null;
          const yBase = Math.max(0, pos[1]);
          const btnY = yBase + 1.6;
          const isOpen = f.id === selectedId || isMine;
          const label =
            msg && msg.length > 0 ? msg : isMine ? "Tu flor" : "Sin mensaje";
          return (
            <Html
              key={`btn-${f.id}`}
              position={[pos[0], btnY, pos[2]]}
              center
              distanceFactor={9}
              occlude={false}
              className="flower-pin-wrap"
            >
              <button
                type="button"
                className={`flower-pin ${
                  isOpen ? "flower-pin--open" : "flower-pin--show"
                }`}
                aria-label={
                  isOpen ? "Ocultar mensaje" : "Ver mensaje de esta flor"
                }
                onMouseDown={onUiDown}
                onMouseUp={onUiUp}
                onTouchStart={(e: React.TouchEvent<HTMLButtonElement>) =>
                  onUiDown(e)
                }
                onTouchEnd={(e: React.TouchEvent<HTMLButtonElement>) =>
                  onUiUp(e)
                }
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(f.id, [pos[0], yBase, pos[2]]);
                }}
              >
                {!isOpen && (
                  <span className="flower-pin__icon" aria-hidden>
                    i
                  </span>
                )}
                <span className="flower-pin__label">{label}</span>
              </button>
            </Html>
          );
        })}

      {/* Tooltips 3D */}
      {gardenActive &&
        items.map(({ f, pos, isMine, msg }) => {
          if (f.id === selectedId || isMine) return null;
          const show = visibleTipIds.has(f.id) && msg.length > 0;
          if (!show) return null;

          const yBase = Math.max(0, pos[1]);
          const position: [number, number, number] = [
            pos[0],
            yBase + 1.45,
            pos[2],
          ];

          return (
            <group key={`tooltip-${f.id}`}>
              <Html
                position={position}
                center
                distanceFactor={8}
                occlude
                className="flower-tooltip"
              >
                <div
                  className="flower-tooltip__inner"
                  role="status"
                  aria-live="polite"
                >
                  <span className="flower-tooltip__msg">{msg}</span>
                </div>
              </Html>
            </group>
          );
        })}
    </>
  );
}
