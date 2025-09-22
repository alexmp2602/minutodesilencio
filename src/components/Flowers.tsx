// app/components/Flowers.tsx
"use client";

import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type { Flower } from "@/lib/types";
import { fetcher } from "@/lib/fetcher";
import {
  Instances,
  Instance,
  Html,
  useCursor,
  Billboard,
} from "@react-three/drei";

type FlowersResponse = { flowers: Flower[] };

const CAP = 512 as const;
const VARIANTS = ["rose", "tulip", "daisy"] as const;
type Variant = (typeof VARIANTS)[number];

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
  const s = 0.55 + rnd() * 0.3;
  const v = 0.85;
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
  const has = f as Record<string, unknown>;
  if (
    typeof has.x === "number" &&
    typeof has.y === "number" &&
    typeof has.z === "number"
  ) {
    return [has.x as number, has.y as number, has.z as number];
  }
  const rnd = seedFromString(f.id);
  const r = 3 + rnd() * 9;
  const a = rnd() * Math.PI * 2;
  return [Math.cos(a) * r, 0, Math.sin(a) * r];
}

function useAppearFactor(duration = 700) {
  const [k, setK] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const ease = (t: number) => t * t * (3 - 2 * t);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setK(ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);
  return k;
}

function useGlowTexture() {
  return useMemo(() => {
    const s = 256;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.5, "rgba(255,255,255,0.25)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, []);
}

/** Bloom animado para flores NUEVAS (respeta variant) */
function NewBloom({
  pos,
  stemH,
  bloomR,
  color,
  variant,
  glowMap,
  onOver,
  onOut,
}: {
  id: string;
  pos: [number, number, number];
  stemH: number;
  bloomR: number;
  color: THREE.Color;
  variant: Variant;
  glowMap: THREE.Texture;
  onOver: () => void;
  onOut: () => void;
}) {
  const k = useAppearFactor(700);
  const pulse = Math.sin(k * Math.PI);
  const s = Math.max(0.0001, bloomR * k);
  const y = stemH + s * 1.1 + Math.sin((k + 0.5) * Math.PI) * 0.02;

  return (
    <group>
      {/* Forma principal según variante */}
      {variant === "rose" && (
        <mesh
          position={[pos[0], y, pos[2]]}
          scale={[s, s, s]}
          onPointerOver={(e) => {
            e.stopPropagation();
            onOver();
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onOut();
          }}
        >
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial
            color={color}
            roughness={0.6}
            metalness={0.05}
            emissive={color.clone().multiplyScalar(0.6)}
            emissiveIntensity={0.6 * pulse}
          />
        </mesh>
      )}

      {variant === "tulip" && (
        <mesh
          position={[pos[0], y + s * 0.2, pos[2]]}
          scale={[s * 0.9, s * 1.35, s * 0.9]}
          onPointerOver={(e) => {
            e.stopPropagation();
            onOver();
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onOut();
          }}
        >
          <coneGeometry args={[1, 1.8, 10]} />
          <meshStandardMaterial
            color={color}
            roughness={0.58}
            metalness={0.04}
            emissive={color.clone().multiplyScalar(0.5)}
            emissiveIntensity={0.55 * pulse}
          />
        </mesh>
      )}

      {variant === "daisy" && (
        <group
          position={[pos[0], y, pos[2]]}
          scale={[s, s, s]}
          onPointerOver={(e) => {
            e.stopPropagation();
            onOver();
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onOut();
          }}
        >
          {/* Anillo de pétalos (disco fino) */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.55, 1, 18]} />
            <meshStandardMaterial
              color={color}
              roughness={0.65}
              metalness={0.02}
              emissive={color.clone().multiplyScalar(0.45)}
              emissiveIntensity={0.45 * pulse}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Centro */}
          <mesh position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.28, 12, 12]} />
            <meshStandardMaterial
              color={"#ffe39e"}
              roughness={0.5}
              metalness={0.02}
              emissive={"#ffd177"}
              emissiveIntensity={0.35 * pulse}
            />
          </mesh>
        </group>
      )}

      {/* Glow billboard común */}
      <Billboard
        position={[pos[0], y, pos[2]]}
        follow={false}
        lockX
        lockY
        lockZ
      >
        <mesh scale={[s * 6, s * 6, 1]}>
          <planeGeometry />
          <meshBasicMaterial
            map={glowMap}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            color={color}
            opacity={0.85 * pulse}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

export default function Flowers() {
  const { data } = useSWR<FlowersResponse>("/api/flowers", fetcher, {
    revalidateOnFocus: false,
  });

  const [hoverId, setHoverId] = useState<string | null>(null);
  useCursor(Boolean(hoverId));

  const seenRef = useRef<Set<string>>(new Set());
  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current && data?.flowers) {
      for (const f of data.flowers) seenRef.current.add(f.id);
      initRef.current = true;
    }
  }, [data?.flowers]);

  const glowMap = useGlowTexture();

  const items = useMemo(() => {
    const list = data?.flowers ?? [];
    return list.map((f) => {
      const pos = positionFor(f);
      const rnd = seedFromString(f.id);
      const stemH = 0.4 + rnd() * 0.45;
      const bloomR = 0.06 + rnd() * 0.06;
      const colorStr = (f as Record<string, unknown>).color;
      let color =
        typeof colorStr === "string" && colorStr
          ? new THREE.Color(colorStr)
          : colorFromId(f.id);

      // Variante normalizada
      const rawVar = (f as Record<string, unknown>).variant;
      const v =
        typeof rawVar === "string" && VARIANTS.includes(rawVar as Variant)
          ? (rawVar as Variant)
          : ("rose" as Variant);

      // Estado de vida
      const alive =
        typeof (f as Record<string, unknown>).alive === "boolean"
          ? ((f as Record<string, unknown>).alive as boolean)
          : true;

      // Si está marchita, desaturamos/oscurecemos un poco
      if (!alive) {
        const gray = new THREE.Color("#777");
        color = color.clone().lerp(gray, 0.45);
      }

      const isNew = initRef.current && !seenRef.current.has(f.id);
      if (isNew) seenRef.current.add(f.id);

      // Inclinación/droop para marchitas (axis aleatorio)
      const tiltA = rnd() * Math.PI * 2;
      const tilt = !alive ? 0.45 + rnd() * 0.25 : 0;
      const rotX = Math.cos(tiltA) * tilt;
      const rotZ = Math.sin(tiltA) * tilt;

      return {
        f,
        pos,
        stemH,
        bloomR,
        color,
        variant: v,
        alive,
        isNew,
        rotX,
        rotZ,
      };
    });
  }, [data?.flowers]);

  const stems = items.slice(0, CAP);

  // Viejas (ya presentes) separadas por variante
  const oldRoses = items
    .filter((it) => !it.isNew && it.variant === "rose")
    .slice(0, CAP);
  const oldTulips = items
    .filter((it) => !it.isNew && it.variant === "tulip")
    .slice(0, CAP);
  const oldDaisies = items
    .filter((it) => !it.isNew && it.variant === "daisy")
    .slice(0, CAP);

  // Nuevas para animación
  const newBlooms = items.filter((it) => it.isNew);

  return (
    <>
      {/* Tallos (cilindros instanciados) */}
      <Instances limit={CAP} range={stems.length}>
        <cylinderGeometry args={[0.012, 0.02, 1, 6]} />
        <meshStandardMaterial roughness={0.95} />
        {stems.map(({ f, pos, stemH, alive, rotX, rotZ }) => (
          <Instance
            key={`stem-${f.id}`}
            position={[pos[0], stemH / 2, pos[2]]}
            scale={[1, stemH, 1]}
            rotation={[rotX, 0, rotZ]}
            color={alive ? "#2c6f2c" : "#6e6e6e"}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoverId(f.id);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHoverId((id) => (id === f.id ? null : id));
            }}
          />
        ))}
      </Instances>

      {/* ROSE: esferas instanciadas */}
      <Instances limit={CAP} range={oldRoses.length}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial roughness={0.6} metalness={0.05} />
        {oldRoses.map(({ f, pos, stemH, bloomR, color, rotX, rotZ, alive }) => (
          <Instance
            key={`rose-${f.id}`}
            position={[pos[0], stemH + bloomR * (alive ? 1.1 : 0.8), pos[2]]}
            scale={[bloomR, bloomR, bloomR]}
            rotation={[rotX, 0, rotZ]}
            color={color.getStyle()}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoverId(f.id);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHoverId((id) => (id === f.id ? null : id));
            }}
          />
        ))}
      </Instances>

      {/* TULIP: conos instanciados */}
      <Instances limit={CAP} range={oldTulips.length}>
        <coneGeometry args={[1, 1.8, 10]} />
        <meshStandardMaterial roughness={0.58} metalness={0.04} />
        {oldTulips.map(
          ({ f, pos, stemH, bloomR, color, rotX, rotZ, alive }) => (
            <Instance
              key={`tulip-${f.id}`}
              position={[
                pos[0],
                stemH + bloomR * (alive ? 1.25 : 0.95),
                pos[2],
              ]}
              scale={[bloomR * 0.9, bloomR * 1.35, bloomR * 0.9]}
              rotation={[rotX, 0, rotZ]}
              color={color.getStyle()}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoverId(f.id);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHoverId((id) => (id === f.id ? null : id));
              }}
            />
          )
        )}
      </Instances>

      {/* DAISY: anillos instanciados (pétalos) */}
      <Instances limit={CAP} range={oldDaisies.length}>
        <ringGeometry args={[0.55, 1, 18]} />
        <meshStandardMaterial
          roughness={0.65}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
        {oldDaisies.map(
          ({ f, pos, stemH, bloomR, color, rotX, rotZ, alive }) => (
            <Instance
              key={`daisy-${f.id}`}
              position={[
                pos[0],
                stemH + 0.02 + (alive ? bloomR * 1.05 : bloomR * 0.8),
                pos[2],
              ]}
              scale={[bloomR, bloomR, bloomR]}
              rotation={[-Math.PI / 2 + rotX, 0, rotZ]}
              color={color.getStyle()}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoverId(f.id);
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                setHoverId((id) => (id === f.id ? null : id));
              }}
            />
          )
        )}
      </Instances>

      {/* DAISY centro: esferas pequeñas instanciadas */}
      <Instances limit={CAP} range={oldDaisies.length}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          color={"#ffe39e"}
          roughness={0.5}
          metalness={0.02}
        />
        {oldDaisies.map(({ f, pos, stemH, bloomR, rotX, rotZ, alive }) => (
          <Instance
            key={`daisy-center-${f.id}`}
            position={[
              pos[0],
              stemH + 0.06 + (alive ? bloomR * 1.05 : bloomR * 0.8),
              pos[2],
            ]}
            scale={[bloomR * 0.28, bloomR * 0.28, bloomR * 0.28]}
            rotation={[rotX, 0, rotZ]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoverId(f.id);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHoverId((id) => (id === f.id ? null : id));
            }}
          />
        ))}
      </Instances>

      {/* NUEVAS con animación y glow */}
      {newBlooms.map(({ f, pos, stemH, bloomR, color, variant }) => (
        <NewBloom
          key={`new-${f.id}`}
          id={f.id}
          pos={pos}
          stemH={stemH}
          bloomR={bloomR}
          color={color}
          variant={variant}
          glowMap={glowMap}
          onOver={() => setHoverId(f.id)}
          onOut={() => setHoverId((id) => (id === f.id ? null : id))}
        />
      ))}

      {/* Mensajes en hover */}
      {items.map(({ f, pos, stemH, bloomR }) =>
        f.message ? (
          <Html
            key={`tip-${f.id}`}
            position={[pos[0], stemH + bloomR * 1.8, pos[2]]}
            center
            distanceFactor={8}
            style={{
              pointerEvents: "none",
              opacity: hoverId === f.id ? 1 : 0,
              transition: "opacity .2s ease",
              background: "rgba(0,0,0,.5)",
              color: "white",
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.12)",
              backdropFilter: "blur(4px)",
              maxWidth: 220,
              whiteSpace: "pre-wrap",
            }}
          >
            {f.message}
          </Html>
        ) : null
      )}
    </>
  );
}
