"use client";

import * as THREE from "three";
import { useMemo, useState } from "react";
import useSWR from "swr";
import type { Flower } from "@/lib/types";
import { fetcher } from "@/lib/fetcher";
import {
  Instances,
  Instance,
  Html,
  Billboard,
  useCursor,
} from "@react-three/drei";

type FlowersResponse = { flowers: Flower[] };

const CAP = 640;
type VARIANTS = ["rose", "tulip", "daisy"];
type Variant = VARIANTS[number];

/* ---- utils ---- */
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
function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ms:userId");
}
function getUserName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ms:userName");
}

/* ---- componente ---- */
export default function Flowers() {
  const { data } = useSWR<FlowersResponse>("/api/flowers", fetcher, {
    revalidateOnFocus: false,
  });

  const [hoverId, setHoverId] = useState<string | null>(null);
  useCursor(Boolean(hoverId));

  const myId = getUserId();
  const myName = getUserName();

  const items = useMemo(() => {
    const list = data?.flowers ?? [];
    return list.slice(0, CAP).map((f) => {
      const pos = positionFor(f);
      const rnd = seedFromString(f.id);

      const stemH = 0.55 + rnd() * 0.55;
      const bloomR = 0.11 + rnd() * 0.09;

      // Define a type with optional properties for flower extensions
      type FlowerExtra = {
        color?: string;
        variant?: string;
        family?: string;
        alive?: boolean;
        user_id?: string;
        message?: string;
        x?: number;
        y?: number;
        z?: number;
      };
      const flowerExtra = f as Flower & FlowerExtra;

      const colorStr = flowerExtra.color;
      let color =
        typeof colorStr === "string" && colorStr
          ? new THREE.Color(colorStr)
          : colorFromId(f.id);

      const rawVar = flowerExtra.variant ?? flowerExtra.family;
      const variant: Variant =
        typeof rawVar === "string" &&
        (["rose", "tulip", "daisy"] as const).includes(rawVar)
          ? (rawVar as Variant)
          : "rose";

      const alive =
        typeof flowerExtra.alive === "boolean" ? flowerExtra.alive : true;
      if (!alive) color = color.clone().lerp(new THREE.Color("#777"), 0.4);

      const tiltA = rnd() * Math.PI * 2;
      const tilt = !alive ? 0.35 + rnd() * 0.2 : 0;
      const rotX = Math.cos(tiltA) * tilt;
      const rotZ = Math.sin(tiltA) * tilt;

      const isMine = myId && (flowerExtra.user_id === myId);

      return {
        f,
        pos,
        stemH,
        bloomR,
        color,
        variant,
        alive,
        rotX,
        rotZ,
        isMine,
      };
    });
  }, [data?.flowers, myId]);

  const roses = items.filter((it) => it.variant === "rose");
  const tulips = items.filter((it) => it.variant === "tulip");
  const daisies = items.filter((it) => it.variant === "daisy");

  return (
    <>
      {/* Tallos */}
      <Instances limit={CAP} range={items.length}>
        <cylinderGeometry args={[0.016, 0.028, 1, 6]} />
        <meshStandardMaterial roughness={0.95} />
        {items.map(({ f, pos, stemH, alive, rotX, rotZ }) => (
          <Instance
            key={`stem-${f.id}`}
            position={[pos[0], stemH / 2, pos[2]]}
            scale={[1, stemH, 1]}
            rotation={[rotX, 0, rotZ]}
            color={alive ? "#2f6f2f" : "#6e6e6e"}
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

      {/* ROSAS */}
      <Instances limit={CAP} range={roses.length}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial roughness={0.55} metalness={0.04} />
        {roses.map(
          ({ f, pos, stemH, bloomR, color, rotX, rotZ, alive, isMine }) => (
            <group key={`rose-g-${f.id}`}>
              <Instance
                key={`rose-${f.id}`}
                position={[
                  pos[0],
                  stemH + bloomR * (alive ? 1.1 : 0.85),
                  pos[2],
                ]}
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
              {isMine && (
                <>
                  <Billboard position={[pos[0], stemH + bloomR * 1.22, pos[2]]}>
                    <mesh scale={[bloomR * 4.5, bloomR * 4.5, 1]}>
                      <circleGeometry args={[1, 32]} />
                      <meshBasicMaterial
                        color={new THREE.Color(color).multiplyScalar(1.2)}
                        transparent
                        opacity={0.18}
                        depthWrite={false}
                        blending={THREE.AdditiveBlending}
                      />
                    </mesh>
                  </Billboard>
                  <Html
                    position={[pos[0], stemH + bloomR * 1.8, pos[2]]}
                    center
                    distanceFactor={8}
                    style={{
                      padding: "4px 8px",
                      background: "rgba(0,0,0,.55)",
                      color: "#fff",
                      borderRadius: 8,
                      fontSize: 12,
                      border: "1px solid rgba(255,255,255,.14)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {myName ? `Tu flor • ${myName}` : "Tu flor"}
                  </Html>
                </>
              )}
            </group>
          )
        )}
      </Instances>

      {/* TULIPANES */}
      <Instances limit={CAP} range={tulips.length}>
        <coneGeometry args={[1, 1.8, 12]} />
        <meshStandardMaterial roughness={0.56} metalness={0.035} />
        {tulips.map(
          ({ f, pos, stemH, bloomR, color, rotX, rotZ, alive, isMine }) => (
            <group key={`tulip-g-${f.id}`}>
              <Instance
                key={`tulip-${f.id}`}
                position={[
                  pos[0],
                  stemH + bloomR * (alive ? 1.28 : 1.0),
                  pos[2],
                ]}
                scale={[bloomR * 0.88, bloomR * 1.34, bloomR * 0.88]}
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
              {isMine && (
                <>
                  <Billboard position={[pos[0], stemH + bloomR * 1.3, pos[2]]}>
                    <mesh scale={[bloomR * 4.2, bloomR * 4.2, 1]}>
                      <circleGeometry args={[1, 32]} />
                      <meshBasicMaterial
                        color={new THREE.Color(color).multiplyScalar(1.2)}
                        transparent
                        opacity={0.18}
                        depthWrite={false}
                        blending={THREE.AdditiveBlending}
                      />
                    </mesh>
                  </Billboard>
                  <Html
                    position={[pos[0], stemH + bloomR * 1.8, pos[2]]}
                    center
                    distanceFactor={8}
                    style={{
                      padding: "4px 8px",
                      background: "rgba(0,0,0,.55)",
                      color: "#fff",
                      borderRadius: 8,
                      fontSize: 12,
                      border: "1px solid rgba(255,255,255,.14)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {myName ? `Tu flor • ${myName}` : "Tu flor"}
                  </Html>
                </>
              )}
            </group>
          )
        )}
      </Instances>

      {/* MARGARITAS (anillo + centro) */}
      <Instances limit={CAP} range={daisies.length}>
        <ringGeometry args={[0.55, 1, 18]} />
        <meshStandardMaterial
          roughness={0.62}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
        {daisies.map(
          ({ f, pos, stemH, bloomR, color, rotX, rotZ, alive, isMine }) => (
            <group key={`daisy-g-${f.id}`}>
              <Instance
                key={`daisy-${f.id}`}
                position={[
                  pos[0],
                  stemH + (alive ? bloomR * 1.05 : bloomR * 0.85),
                  pos[2],
                ]}
                scale={[bloomR, bloomR, bloomR]}
                rotation={[-Math.PI / 2 + rotX * 0.6, 0, rotZ * 0.6]}
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
              {/* centro */}
              <mesh
                position={[
                  pos[0],
                  stemH + 0.05 + (alive ? bloomR * 1.05 : bloomR * 0.85),
                  pos[2],
                ]}
                scale={[bloomR * 0.3, bloomR * 0.3, bloomR * 0.3]}
              >
                <sphereGeometry args={[1, 12, 12]} />
                <meshStandardMaterial
                  color={"#ffe39e"}
                  roughness={0.5}
                  metalness={0.02}
                />
              </mesh>
              {isMine && (
                <>
                  <Billboard position={[pos[0], stemH + bloomR * 1.18, pos[2]]}>
                    <mesh scale={[bloomR * 4.2, bloomR * 4.2, 1]}>
                      <circleGeometry args={[1, 32]} />
                      <meshBasicMaterial
                        color={new THREE.Color(color).multiplyScalar(1.2)}
                        transparent
                        opacity={0.18}
                        depthWrite={false}
                        blending={THREE.AdditiveBlending}
                      />
                    </mesh>
                  </Billboard>
                  <Html
                    position={[pos[0], stemH + bloomR * 1.8, pos[2]]}
                    center
                    distanceFactor={8}
                    style={{
                      padding: "4px 8px",
                      background: "rgba(0,0,0,.55)",
                      color: "#fff",
                      borderRadius: 8,
                      fontSize: 12,
                      border: "1px solid rgba(255,255,255,.14)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {myName ? `Tu flor • ${myName}` : "Tu flor"}
                  </Html>
                </>
              )}
            </group>
          )
        )}
      </Instances>

      {/* Mensajes en hover (se mantiene) */}
      {items.map(({ f, pos, stemH, bloomR }) => {
        // Define a type with the message property
        type FlowerWithMessage = Flower & { message?: string };
        const flowerWithMessage = f as FlowerWithMessage;
        return flowerWithMessage.message ? (
          <Html
            key={`tip-${f.id}`}
            position={[pos[0], stemH + bloomR * 1.8, pos[2]]}
            center
            distanceFactor={8}
            style={{
              pointerEvents: "none",
              opacity: hoverId === f.id ? 1 : 0,
              transition: "opacity .15s ease",
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
            {flowerWithMessage.message as string}
          </Html>
        ) : null;
      })}
    </>
  );
}
