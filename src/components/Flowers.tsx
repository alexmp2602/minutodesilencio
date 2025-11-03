"use client";

import * as THREE from "three";
import { useMemo, useRef, useState, useEffect } from "react";
import { Instances, Instance, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import useSfx from "@/hooks/useSfx";

/** ===== Config ===== */
const MODEL_URL = "/models/flower.glb";
const GARDEN_RADIUS = 60;
const MAX_FLOWERS = 140;
const TARGET_ALIVE = 90;
const SPAWN_EVERY = 0.6;
const RESPAWN_MIN = 6;
const RESPAWN_MAX = 12;
const MIN_SEPARATION = 1.0;
const HITBOX_RADIUS = 0.75;
const HITBOX_HEIGHT = 2.6;

/** ===== Colores (lineales) ===== */
const STEM_COLOR = new THREE.Color("#036200");
const PETAL_COLOR = new THREE.Color("#FBDDF5");
const ANTHER_COLOR = PETAL_COLOR.clone();

/** ===== GLB merge en una sola geometry ===== */
type GLBData = {
  geom: THREE.BufferGeometry | null;
  baseScale: number;
  loaded: boolean;
};

function ensureColorAttribute(g: THREE.BufferGeometry) {
  if (!g.getAttribute("color")) {
    const count = g.getAttribute("position")?.count ?? 0;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) arr[i] = 1;
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3, true));
  }
  return g;
}

function useMergedFlowerGLB(url = MODEL_URL): GLBData {
  const gltf: import("three-stdlib").GLTF | null = useGLTF(url);
  return useMemo(() => {
    if (!gltf?.scene) return { geom: null, baseScale: 1, loaded: false };

    const parts: THREE.BufferGeometry[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const g = mesh.geometry.clone();
      g.applyMatrix4(mesh.matrixWorld);
      (g as THREE.BufferGeometry).morphAttributes = {} as Record<
        string,
        THREE.BufferAttribute[]
      >;
      g.deleteAttribute("skinIndex");
      g.deleteAttribute("skinWeight");
      ensureColorAttribute(g);
      parts.push(g);
    });

    const merged =
      parts.length > 1 ? mergeGeometries(parts, true) : parts[0] ?? null;
    if (!merged) return { geom: null, baseScale: 1, loaded: false };

    merged.computeBoundingBox();
    const bb = merged.boundingBox!;
    const height = Math.max(0.0001, bb.max.y - bb.min.y);
    merged.translate(0, -bb.min.y, 0);
    merged.computeBoundingBox();
    const maxY = merged.boundingBox!.max.y;

    const pos = merged.getAttribute("position") as THREE.BufferAttribute;
    the: {
    }
    const col = merged.getAttribute("color") as THREE.BufferAttribute;
    const arr = col.array as Float32Array;

    const STEM_TOP = 0.68;
    const stemR = STEM_COLOR.r,
      stemG = STEM_COLOR.g,
      stemB = STEM_COLOR.b;
    const petR = PETAL_COLOR.r,
      petG = PETAL_COLOR.g,
      petB = PETAL_COLOR.b;
    const antR = ANTHER_COLOR.r,
      antG = ANTHER_COLOR.g,
      antB = ANTHER_COLOR.b;

    for (let i = 0; i < pos.count; i++) {
      const ny = pos.getY(i) / maxY;
      if (ny <= STEM_TOP) {
        const k = Math.max(0, Math.min(1, ny / STEM_TOP));
        const shade = 0.85 + 0.15 * k;
        arr[i * 3 + 0] = stemR * shade;
        arr[i * 3 + 1] = stemG * shade;
        arr[i * 3 + 2] = stemB * shade;
      } else {
        if (ny > 0.93) {
          arr[i * 3 + 0] = antR;
          arr[i * 3 + 1] = antG;
          arr[i * 3 + 2] = antB;
        } else {
          arr[i * 3 + 0] = petR;
          arr[i * 3 + 1] = petG;
          arr[i * 3 + 2] = petB;
        }
      }
    }
    col.needsUpdate = true;
    merged.computeVertexNormals();
    merged.computeBoundingSphere();
    return { geom: merged, baseScale: 1 / height, loaded: true };
  }, [gltf]);
}
useGLTF.preload(MODEL_URL);

/** ===== Utils ===== */
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const choice = <T,>(arr: T[]) => arr[(Math.random() * arr.length) | 0];

const RIP_TAGS = ["#qepd🙏", "#rip🕊️", "#descansaenpaz💐", "#QEPD❤️‍🩹", "#RIP"];

/** Yaw hacia el centro (0,0,0) */
const FORWARD_BIAS = 0;
function yawToCenter(x: number, z: number) {
  return Math.atan2(-x, -z) + FORWARD_BIAS;
}

function clampToDisk(x: number, z: number, r: number) {
  const d2 = x * x + z * z;
  const r2 = r * r;
  if (d2 <= r2) return [x, z] as const;
  const d = Math.sqrt(d2);
  return [(x / d) * r * 0.98, (z / d) * r * 0.98] as const;
}
function nonOverlappingPosition(existing: THREE.Vector3[], r: number) {
  for (let i = 0; i < 40; i++) {
    const rad = rand(2.5, r - 2);
    const ang = rand(0, Math.PI * 2);
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    const [cx, cz] = clampToDisk(x, z, r - 0.6);
    const ok = existing.every(
      (p) =>
        p.distanceToSquared(new THREE.Vector3(cx, 0, cz)) >=
        MIN_SEPARATION * MIN_SEPARATION
    );
    if (ok) return new THREE.Vector3(cx, 0, cz);
  }
  return new THREE.Vector3(rand(-r * 0.7, r * 0.7), 0, rand(-r * 0.7, r * 0.7));
}

/** ===== Estado ===== */
type LifeState = "growing" | "alive" | "dying" | "dead";
type Item = {
  id: number;
  pos: THREE.Vector3;
  scale: number;
  rotX: number;
  rotZ: number;
  yaw: number;
  t: number;
  state: LifeState;
  respawnAt: number;
};
type Props = { gardenActive?: boolean };

export default function Flowers({ gardenActive = false }: Props) {
  const { geom, baseScale, loaded } = useMergedFlowerGLB();
  const { play } = useSfx();

  // InstancedMesh real
  const instMainRef =
    useRef<
      THREE.InstancedMesh<
        THREE.BufferGeometry,
        THREE.Material | THREE.Material[]
      >
    >(null);

  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const fadeBufferRef = useRef<Float32Array>(new Float32Array(MAX_FLOWERS));

  // Uniforms
  const uTimeRef = useRef<{ value: number }>({ value: 0 });
  const uDissolveSizeRef = useRef<{ value: number }>({ value: 6.0 });

  const itemsRef = useRef<Item[]>(
    new Array(MAX_FLOWERS).fill(0).map((_, i) => ({
      id: i,
      pos: new THREE.Vector3(9999, -10, 9999),
      scale: rand(1.7, 2.2),
      rotX: rand(-0.05, 0.05),
      rotZ: rand(-0.05, 0.05),
      yaw: 0,
      t: 0,
      state: "dead" as LifeState,
      respawnAt: 0,
    }))
  );
  const [version, setVersion] = useState(0);

  // score acumulado
  const killsRef = useRef(0);
  const activityRef = useRef(0);
  const percentRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const lastProgressSentRef = useRef(0);

  const KILL_IMPULSE = 1.0;
  const TAU_SECONDS = 14;

  const emitProgress = () => {
    const nowMs = performance.now();
    if (nowMs - lastProgressSentRef.current < 100) return;
    lastProgressSentRef.current = nowMs;

    const k = 6;
    const p01 = Math.min(0.98, 1 - Math.exp(-activityRef.current / k));
    percentRef.current = p01;

    const alive = itemsRef.current.filter(
      (it) => it.state === "alive" || it.state === "growing"
    ).length;
    const dead = MAX_FLOWERS - alive;

    window.dispatchEvent(
      new CustomEvent("ms:flowers:progress", {
        detail: {
          alive,
          dead,
          kills: killsRef.current,
          percent: percentRef.current,
        },
      })
    );
  };

  // atributo instanciado iFade
  useEffect(() => {
    const geo = instMainRef.current?.geometry as
      | THREE.InstancedBufferGeometry
      | undefined;
    if (!geo || geo.getAttribute("iFade")) return;
    geo.setAttribute(
      "iFade",
      new THREE.InstancedBufferAttribute(fadeBufferRef.current, 1)
    );
  }, [version, loaded]);

  useFrame((_, dt) => {
    if (!gardenActive) return;
    const now = performance.now() / 1000;

    uTimeRef.current.value += dt;

    // decaimiento
    const decay = Math.exp(-dt / TAU_SECONDS);
    activityRef.current *= decay;

    // spawn
    if (now - lastSpawnRef.current >= SPAWN_EVERY) {
      lastSpawnRef.current = now;
      const alive = itemsRef.current.filter(
        (it) => it.state === "alive" || it.state === "growing"
      ).length;
      if (alive < TARGET_ALIVE) {
        const positions = itemsRef.current
          .filter((it) => it.state !== "dead")
          .map((it) => it.pos);
        const pos = nonOverlappingPosition(positions, GARDEN_RADIUS);
        const slot = itemsRef.current.find((it) => it.state === "dead");
        if (slot) {
          slot.state = "growing";
          slot.t = 0;
          slot.pos.copy(pos);
          slot.scale = rand(1.7, 2.2);
          slot.rotX = rand(-0.12, 0.12);
          slot.rotZ = rand(-0.12, 0.12);
          slot.yaw = yawToCenter(pos.x, pos.z);

          // SFX spawn centralizado
          play("flower-pop", {
            volume: 0.005,
            detuneSemitones: (Math.random() - 0.5) * 1.2, // leve variación
          });

          window.dispatchEvent(
            new CustomEvent("ms:flowers:spawn", {
              detail: { position: [pos.x, pos.y, pos.z] },
            })
          );
          window.dispatchEvent(new CustomEvent("ms:flower:regrow"));
          setVersion((v) => v + 1);
        }
      }
    }

    // animaciones / estados
    let changed = false;
    for (const it of itemsRef.current) {
      if (it.state === "dead") continue;
      it.t += dt;

      if (it.state === "growing" && it.t >= 0.9) {
        it.state = "alive";
        it.t = 0;
        changed = true;
        window.dispatchEvent(new CustomEvent("ms:flower:regrow"));
      } else if (it.state === "dying" && it.t >= 0.35) {
        it.state = "dead";
        it.t = 0;
        changed = true;
      }
    }

    // fades por instancia
    const fades = fadeBufferRef.current;
    for (const it of itemsRef.current) {
      let f = 0;
      if (it.state === "growing") f = Math.min(1, it.t / 0.9);
      else if (it.state === "alive") f = 1;
      else if (it.state === "dying") f = 1 - Math.min(1, it.t / 0.35);
      else f = 0;
      fades[it.id] = f;
    }
    const mesh = instMainRef.current;
    if (mesh?.geometry?.attributes?.iFade) {
      (
        mesh.geometry.attributes.iFade as THREE.InstancedBufferAttribute
      ).needsUpdate = true;
    }

    if (changed) setVersion((v) => v + 1);
    emitProgress();
  });

  const killFlower = (it: Item) => {
    if (it.state !== "alive" && it.state !== "growing") return;
    it.state = "dying";
    it.t = 0;
    it.respawnAt = performance.now() / 1000 + rand(RESPAWN_MIN, RESPAWN_MAX);
    killsRef.current += 1;
    activityRef.current += KILL_IMPULSE;

    window.dispatchEvent(
      new CustomEvent("ms:flowers:kill", {
        detail: {
          position: [it.pos.x, it.pos.y + it.scale * baseScale, it.pos.z],
          tag: choice(RIP_TAGS),
        },
      })
    );
    window.dispatchEvent(new CustomEvent("ms:flower:killed"));

    setVersion((v) => v + 1);
    emitProgress();
  };

  const hasGLB = loaded && !!geom;
  const renderItems = itemsRef.current.map((i) => ({ ...i }));

  const onClickInstance = (id: number) => {
    const it = itemsRef.current[id];
    if (!it) return;
    const dragging = (window as unknown as { __orbitDragging?: boolean })
      .__orbitDragging;
    if (dragging) return;
    killFlower(it);
  };

  /** ===== Material con fade+dissolve ===== */
  const flowerMaterial = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.55,
      metalness: 0.04,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
      alphaTest: 0.001,
    });
    (
      m as THREE.MeshStandardMaterial & { alphaToCoverage?: boolean }
    ).alphaToCoverage = true;

    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTimeRef.current;
      shader.uniforms.uDissolveSize = uDissolveSizeRef.current;

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           attribute float iFade;
           varying float vFade;
           varying vec3 vWorldPos;`
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vFade = iFade;
           vec4 wp = modelMatrix * vec4(transformed, 1.0);
           vWorldPos = wp.xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uTime;
           uniform float uDissolveSize;
           varying float vFade;
           varying vec3 vWorldPos;

           float hash21(vec2 p) {
             p = fract(p*vec2(123.34, 345.45));
             p += dot(p, p+34.345);
             return fract(p.x*p.y);
           }

           float bayer4(vec2 fragCoord){
             int x = int(mod(fragCoord.x, 4.0));
             int y = int(mod(fragCoord.y, 4.0));
             int m[16];
             m[0]=0;  m[1]=8;  m[2]=2;  m[3]=10;
             m[4]=12; m[5]=4;  m[6]=14; m[7]=6;
             m[8]=3;  m[9]=11; m[10]=1; m[11]=9;
             m[12]=15; m[13]=7; m[14]=13; m[15]=5;
             int idx = y*4 + x;
             return float(m[idx]) / 16.0;
           }`
        )
        .replace(
          "#include <alphatest_fragment>",
          `
           diffuseColor.a *= vFade;

           vec3 dryCol = vec3(0.35, 0.28, 0.15);
           diffuseColor.rgb = mix(dryCol, diffuseColor.rgb, vFade);

           float cell = hash21(floor(vWorldPos.xz * uDissolveSize));
           float dthr = mix(0.0, 1.0, 1.0 - vFade);
           dthr = clamp(dthr + (bayer4(gl_FragCoord.xy)-0.5)/32.0, 0.0, 1.0);

           if (cell < dthr) discard;

           #include <alphatest_fragment>
          `
        );
    };

    m.needsUpdate = true;
    matRef.current = m;
    return m;
  }, []);

  return (
    <>
      {hasGLB ? (
        <Instances
          ref={instMainRef}
          name="flowers"
          limit={MAX_FLOWERS}
          range={renderItems.length}
          castShadow
          receiveShadow
          frustumCulled={false}
        >
          <primitive object={geom!} attach="geometry" />
          <primitive object={flowerMaterial} attach="material" />
          {renderItems.map((it) => {
            let s = it.scale * baseScale;
            let y = 0;
            let tiltX = it.rotX;
            let tiltZ = it.rotZ;

            if (it.state === "growing") {
              const k = Math.min(1, it.t / 0.9);
              s *= 0.2 + 0.8 * k;
              y = 0.02 + 0.12 * (1 - k);
              tiltX *= 0.6 + 0.4 * k;
              tiltZ *= 0.6 + 0.4 * k;
            } else if (it.state === "dying") {
              const k = Math.min(1, it.t / 0.35);
              s *= 1.1 - 1.05 * k;
              y = 0.05 + 0.25 * k;
              tiltX = tiltX * (1.0 + 0.6 * k) + 0.12 * k;
              tiltZ = tiltZ * (1.0 + 0.6 * k) + 0.072 * k;
            }

            const yaw = itemsRef.current[it.id].yaw;

            return (
              <Instance
                key={`f-${it.id}`}
                position={[it.pos.x, y, it.pos.z]}
                rotation={[tiltX, yaw, tiltZ]}
                scale={[s, s, s]}
                onClick={() => onClickInstance(it.id)}
              />
            );
          })}
        </Instances>
      ) : (
        <Instances
          name="flowers-fallback"
          limit={MAX_FLOWERS}
          range={renderItems.length}
          frustumCulled={false}
        >
          <cylinderGeometry args={[0.05, 0.05, 1, 10]} />
          <meshStandardMaterial roughness={0.7} metalness={0.0} />
          {renderItems.map((it) => {
            let s = it.scale * 0.9;
            if (it.state === "growing")
              s *= 0.2 + 0.8 * Math.min(1, it.t / 0.9);
            if (it.state === "dying")
              s *= 1.1 - 1.05 * Math.min(1, it.t / 0.35);
            return (
              <Instance
                key={`ff-${it.id}`}
                position={[it.pos.x, 0.5 * s, it.pos.z]}
                scale={[s, s, s]}
                onClick={() => onClickInstance(it.id)}
              />
            );
          })}
        </Instances>
      )}

      {gardenActive && (
        <Instances
          name="flower-hitareas"
          limit={MAX_FLOWERS}
          range={renderItems.length}
          frustumCulled={false}
        >
          <cylinderGeometry
            args={[HITBOX_RADIUS, HITBOX_RADIUS, HITBOX_HEIGHT, 12]}
          />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          {renderItems.map((it) => (
            <Instance
              key={`hit-${it.id}`}
              position={[it.pos.x, HITBOX_HEIGHT * 0.5, it.pos.z]}
              scale={[1, 1, 1]}
              onClick={() => onClickInstance(it.id)}
            />
          ))}
        </Instances>
      )}
    </>
  );
}
