// src/components/Flowers.tsx
"use client";

import * as THREE from "three";
import { useMemo, useState, useRef, useLayoutEffect } from "react";
import useSWR from "swr";
import type { Flower } from "@/lib/types";
import { fetcher } from "@/lib/fetcher";
import { Instances, Instance, useCursor, useGLTF } from "@react-three/drei";
import { ThreeEvent } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ----------------- config ----------------- */
const CAP = 640;
const MODEL_URL = "/models/flower.glb";
const AREA = 200; // tamaño del jardín, para boundingSphere opcional

/* ----------------- helpers ---------------- */
type FlowersResponse = { flowers: Flower[] };

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

function colorFromId(id: string) {
  const rnd = seedFromString(id);
  const h = rnd();
  const s = 0.5 + rnd() * 0.35;
  const v = 0.9;
  const c = v * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  const seg = Math.floor(h * 6);
  if (seg === 0) [r, g, b] = [c, x, 0];
  else if (seg === 1) [r, g, b] = [x, c, 0];
  else if (seg === 2) [r, g, b] = [0, c, x];
  else if (seg === 3) [r, g, b] = [0, x, c];
  else if (seg === 4) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return new THREE.Color(r + m, g + m, b + m);
}

function positionFor(f: Flower): [number, number, number] {
  if (
    typeof f.x === "number" &&
    typeof f.y === "number" &&
    typeof f.z === "number"
  ) {
    // aseguramos no bajar del suelo
    return [f.x, Math.max(0, f.y), f.z];
  }
  const rnd = seedFromString(f.id);
  const r = 3 + rnd() * 9;
  const a = rnd() * Math.PI * 2;
  return [Math.cos(a) * r, 0, Math.sin(a) * r];
}

function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ms:userId");
}

/* -------- GLB → geometry único NORMALIZADO (sin morph/skin) -------- */
type GLBData = {
  geom: THREE.BufferGeometry | null;
  baseScale: number; // 1 / altura, con base en y=0 y orientación correcta
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

    // 1) Alinear eje mayor a +Y
    merged.computeBoundingBox();
    const size = new THREE.Vector3();
    merged.boundingBox!.getSize(size);
    if (size.y < size.z && size.z >= size.x) {
      merged.rotateX(Math.PI / 2); // Z -> Y
    } else if (size.y < size.x && size.x >= size.z) {
      merged.rotateZ(-Math.PI / 2); // X -> Y
    }

    // 2) Mirar hacia “adelante”
    merged.rotateY(Math.PI);

    // 3) Base a y=0
    merged.computeBoundingBox();
    const bb = merged.boundingBox!;
    const height = Math.max(0.0001, bb.max.y - bb.min.y);
    merged.translate(0, -bb.min.y, 0);

    (merged as THREE.BufferGeometry).morphAttributes = {};
    merged.deleteAttribute("skinIndex");
    merged.deleteAttribute("skinWeight");
    merged.computeVertexNormals();

    // (opcional) bounding sphere grande para culling correcto si se dejara activo
    merged.computeBoundingSphere();
    if (merged.boundingSphere) {
      merged.boundingSphere.radius = AREA / 2 + 40; // cubrir el jardín completo
    }

    const baseScale = 1 / height;
    return { geom: merged, baseScale, loaded: true };
  }, [gltf]);
}
useGLTF.preload(MODEL_URL);

/* ----------------- component ----------------- */
export default function Flowers() {
  const { data } = useSWR<FlowersResponse>("/api/flowers", fetcher, {
    revalidateOnFocus: false,
  });

  const { geom, baseScale, loaded } = useMergedFlowerGLB();

  const [hoverId, setHoverId] = useState<string | null>(null);
  useCursor(Boolean(hoverId));

  const myId = getUserId();

  const items = useMemo(() => {
    const list = data?.flowers ?? [];
    return list.slice(0, CAP).map((f) => {
      const pos = positionFor(f);
      const rnd = seedFromString(f.id);
      const scaleJitter = 0.85 + rnd() * 0.5; // 0.85..1.35

      const colorSRGB = f.color ? new THREE.Color(f.color) : colorFromId(f.id);
      const colorLinear = colorSRGB.clone().convertSRGBToLinear();

      const alive = f.alive ?? !f.wilted;
      const tiltA = rnd() * Math.PI * 2;
      const tilt = !alive ? 0.25 + rnd() * 0.2 : 0;
      const rotX = Math.cos(tiltA) * tilt;
      const rotZ = Math.sin(tiltA) * tilt;
      const isMine = !!myId && f.user_id === myId;
      return { f, pos, scaleJitter, colorLinear, rotX, rotZ, isMine };
    });
  }, [data?.flowers, myId]);

  const handleSelect = (id: string, position: [number, number, number]) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("flower-focus", { detail: { id, position } })
      );
    }
  };

  const hasGLB = loaded && !!geom;

  // ref al InstancedMesh para togglear culling (robusto aunque también pasamos prop)
  const instRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = instRef.current;
    if (!m) return;
    // 1) desactivar culling (principal fix)
    m.frustumCulled = false;
    // 2) por si en algún momento quisieras reactivarlo: deja lista una boundingSphere enorme
    m.geometry?.computeBoundingSphere?.();
    if (m.geometry?.boundingSphere) {
      m.geometry.boundingSphere.radius = AREA / 2 + 40;
    }
  }, [hasGLB]);

  return (
    <>
      {hasGLB ? (
        <Instances
          ref={instRef}
          name="flowers"
          limit={CAP}
          range={items.length}
          castShadow
          receiveShadow
          frustumCulled={false} // <- fix directo
        >
          <primitive object={geom!} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            color="#ffffff"
            roughness={0.55}
            metalness={0.04}
            // Si el pasto tiene transparencia, mantener depthWrite para que ocluya bien:
            depthWrite
            depthTest
          />
          {items.map(({ f, pos, scaleJitter, colorLinear, rotX, rotZ }) => {
            const s = scaleJitter * baseScale;
            const y = Math.max(0, pos[1]); // mantener por encima del plano
            return (
              <Instance
                key={`flower-${f.id}`}
                position={[pos[0], y, pos[2]]}
                scale={[s, s, s]}
                rotation={[rotX, 0, rotZ]}
                color={colorLinear}
                onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation();
                  setHoverId(f.id);
                }}
                onPointerOut={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation();
                  setHoverId((id) => (id === f.id ? null : id));
                }}
                onClick={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation();
                  handleSelect(f.id, [pos[0], y, pos[2]]);
                }}
              />
            );
          })}
        </Instances>
      ) : (
        <Instances
          ref={instRef}
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
            return (
              <Instance
                key={`flower-${f.id}`}
                position={[pos[0], Math.max(0, pos[1]) + 0.5 * s, pos[2]]}
                scale={[s, s, s]}
                color={"#7aa34f"}
              />
            );
          })}
        </Instances>
      )}
    </>
  );
}
