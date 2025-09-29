// app/components/Ground.tsx
"use client";

import * as THREE from "three";
import { useMemo } from "react";
import { useThree } from "@react-three/fiber";

/* ===========================
   PALETA “SUNSET GRASS”
   =========================== */
const PALETTE = {
  // verdes tibios (evitar azulados/menta que lavan la escena)
  baseA: "#5e9836",
  baseB: "#84b94f",
  centerLift: 0.06, // realce MUY sutil en el centro (antes era demasiado claro)
  // rugosidad alta y micro-ruido para matar highlights especulares
  roughMid: "#7a7a7a",
};

/* ---------- Texturas procedurales (color / rough) ---------- */
function makeGrassColor(size = 512): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;

  // Fondo en dos tonos (sin menta/azulado brillante)
  const cx = size / 2;
  const cy = size / 2;
  const radial = ctx.createRadialGradient(
    cx,
    cy,
    size * 0.1,
    cx,
    cy,
    size * 0.72
  );
  radial.addColorStop(0, PALETTE.baseB);
  radial.addColorStop(1, PALETTE.baseA);
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, size, size);

  // Manchas de pasto (parches) — tonos cercanos para evitar alto contraste
  for (let i = 0; i < 1300; i++) {
    const r = Math.random() * (size * 0.03);
    const x = Math.random() * size;
    const y = Math.random() * size;

    // variación suave alrededor de los verdes base
    const g1 = new THREE.Color(PALETTE.baseA);
    const g2 = new THREE.Color(PALETTE.baseB);
    const mix = Math.random() * 0.85 + 0.15;
    const col = g1.lerp(g2, mix);
    const a = 0.05 + Math.random() * 0.08;

    ctx.fillStyle = `rgba(${Math.round(col.r * 255)}, ${Math.round(
      col.g * 255
    )}, ${Math.round(col.b * 255)}, ${a})`;

    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      r * (0.7 + Math.random() * 0.7),
      r,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Levantamos muy poquito el centro para “separar” flores (sin brillos)
  if (PALETTE.centerLift > 0) {
    const lift = ctx.createRadialGradient(
      cx,
      cy,
      size * 0.08,
      cx,
      cy,
      size * 0.48
    );
    lift.addColorStop(0, `rgba(255,255,255,${PALETTE.centerLift})`);
    lift.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = lift;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";
  }

  // ⚠️ Quitamos los “puntitos de rocío” blancos (eran los que disparaban el bloom)
  // (si alguna vez querés habilitarlos, que sea con alpha MUY bajo y threshold alto)

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGrassRough(size = 512): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;

  // base de rugosidad media-alta
  ctx.fillStyle = PALETTE.roughMid;
  ctx.fillRect(0, 0, size, size);

  // micro-ruido con orientación alargada para matar highlights especulares
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = Math.random() * (size * 0.02) + 1.5;
    const h = w * (0.8 + Math.random() * 1.2);
    const rot = Math.random() * Math.PI;
    const a = Math.random() * 0.2 + 0.06;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

/* ---------- Relieve (colinas suaves) ---------- */
function makeHillsGeometry(
  width = 200,
  depth = 200,
  seg = 240,
  amplitude = 0.6 // ↓ un poco para horizonte más plano (como la foto)
) {
  const geo = new THREE.PlaneGeometry(width, depth, seg, seg);
  const pos = geo.attributes.position as THREE.BufferAttribute;

  const hw = width / 2;
  const hd = depth / 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    const nx = x / hw;
    const ny = y / hd;

    let h =
      0.55 * Math.sin(nx * Math.PI * 0.9) * Math.cos(ny * Math.PI * 0.8) +
      0.28 * Math.sin((nx + ny) * Math.PI * 0.55) +
      0.18 * Math.cos((nx - ny) * Math.PI * 0.5);

    const r = Math.sqrt(nx * nx + ny * ny);
    const falloff = 1 - Math.min(1, Math.pow(r / 1.4, 2.2));
    h *= Math.max(0, falloff);

    pos.setZ(i, h * amplitude);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* ---------- Componente ---------- */
export default function Ground() {
  const { gl } = useThree();

  const { colorMap, roughMap, bumpMap, hillsGeo } = useMemo(() => {
    const color = makeGrassColor(512);
    const rough = makeGrassRough(512);

    // repetición moderada (menos “patterning” que antes)
    const repeatU = 14 + Math.random() * 6;
    const repeatV = 14 + Math.random() * 6;
    color.repeat.set(repeatU, repeatV);
    rough.repeat.set(repeatU, repeatV);

    const offU = Math.random();
    const offV = Math.random();
    color.offset.set(offU, offV);
    rough.offset.set(offU, offV);

    // Anisotropía suficiente, sin forzar al máximo
    const maxAniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    color.anisotropy = maxAniso;
    rough.anisotropy = maxAniso;

    const bump = rough.clone();

    // Geometría más plana (look “pradera”)
    const hills = makeHillsGeometry(200, 200, 240, 0.6);

    return { colorMap: color, roughMap: rough, bumpMap: bump, hillsGeo: hills };
  }, [gl]);

  return (
    <mesh
      geometry={hillsGeo}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      frustumCulled={false}
    >
      <meshStandardMaterial
        // Color base apenas influye; el map sRGB gobierna
        color={"#6ea43e"}
        map={colorMap}
        roughnessMap={roughMap}
        roughness={0.96} // ↑ más mate
        metalness={0.0}
        bumpMap={bumpMap}
        bumpScale={0.008} // ↓ micro-relieve (evita brillos raros)
        envMapIntensity={0.15} // leve rebote cálido
        side={THREE.FrontSide}
        fog
      />
    </mesh>
  );
}
