// app/components/Ground.tsx
"use client";

import * as THREE from "three";
import { useMemo } from "react";
import { useThree } from "@react-three/fiber";

/* ---------- Texturas procedurales (color / rough) ---------- */
function makeGrassColor(size = 512): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;

  // Gradiente radial suave (centro un poco más claro)
  const cx = size / 2;
  const cy = size / 2;
  const radial = ctx.createRadialGradient(
    cx,
    cy,
    size * 0.1,
    cx,
    cy,
    size * 0.7
  );
  radial.addColorStop(0, "#d9f3e8");
  radial.addColorStop(1, "#bfe6d5");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, size, size);

  // Manchitas de pasto
  for (let i = 0; i < 1600; i++) {
    const r = Math.random() * (size * 0.035);
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 190 + Math.floor(Math.random() * 30);
    const b = 190 + Math.floor(Math.random() * 25);
    const a = Math.random() * 0.12 + 0.04;
    ctx.fillStyle = `rgba(100, ${g}, ${b}, ${a})`;
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      r * (0.6 + Math.random() * 0.7),
      r,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Puntitos tipo rocío (ayudan al bloom)
  for (let i = 0; i < 320; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 2 + 0.5;
    const a = Math.random() * 0.08 + 0.02;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

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

  ctx.fillStyle = "#7f7f7f";
  ctx.fillRect(0, 0, size, size);

  // Ruido para rugosidad
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = Math.random() * (size * 0.03) + 2;
    const h = w * (0.6 + Math.random() * 0.8);
    const rot = Math.random() * Math.PI;
    const a = Math.random() * 0.25 + 0.05;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // Halo más liso en el centro (separa un poco las flores)
  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(
    cx,
    cy,
    size * 0.05,
    cx,
    cy,
    size * 0.45
  );
  grad.addColorStop(0, "rgba(255,255,255,0.04)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";

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
  amplitude = 0.85
) {
  // Plano en XY, luego lo rotamos en la malla (-90° en X) para quedar en XZ
  const geo = new THREE.PlaneGeometry(width, depth, seg, seg);
  const pos = geo.attributes.position as THREE.BufferAttribute;

  const hw = width / 2;
  const hd = depth / 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    // Normalizamos a [-1, 1]
    const nx = x / hw;
    const ny = y / hd;

    // Combinación de senos/cosenos para “rolling hills”
    let h =
      0.6 * Math.sin(nx * Math.PI * 0.9) * Math.cos(ny * Math.PI * 0.8) +
      0.3 * Math.sin((nx + ny) * Math.PI * 0.55) +
      0.2 * Math.cos((nx - ny) * Math.PI * 0.5);

    // Suavizamos bordes para que el horizonte no levante demasiado
    const r = Math.sqrt(nx * nx + ny * ny);
    const falloff = 1 - Math.min(1, Math.pow(r / 1.4, 2.2));
    h *= Math.max(0, falloff);

    pos.setZ(i, h * amplitude); // z aquí será “altura”; luego se convierte en Y al rotar la malla
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

    // Repetición y offset aleatorio para evitar patterning
    const repeatU = 18 + Math.random() * 8;
    const repeatV = 18 + Math.random() * 8;
    color.repeat.set(repeatU, repeatV);
    rough.repeat.set(repeatU, repeatV);

    const offU = Math.random();
    const offV = Math.random();
    color.offset.set(offU, offV);
    rough.offset.set(offU, offV);

    // Anisotropía alta (limitada por HW)
    const maxAniso = Math.min(16, gl.capabilities.getMaxAnisotropy());
    color.anisotropy = maxAniso;
    rough.anisotropy = maxAniso;

    const bump = rough.clone();

    // Geometría ondulada
    const hills = makeHillsGeometry(200, 200, 240, 0.85);

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
        color="#bfe6d5" // color base; el map sRGB manda
        map={colorMap}
        roughnessMap={roughMap}
        roughness={0.93}
        metalness={0}
        bumpMap={bumpMap}
        bumpScale={0.015} // micro-relieve
        side={THREE.FrontSide}
        fog
      />
    </mesh>
  );
}
