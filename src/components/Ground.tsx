// src/components/Ground.tsx
"use client";

import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";

type Props = {
  size?: number;
  segments?: number;
  amplitude?: number;
  seed?: number;
  /** Radio visual del jardín circular */
  radius?: number;
  /** Suavizado del borde (en unidades del mundo) */
  feather?: number;
};

/* ===== Config ===== */
const GARDEN_RADIUS_DEFAULT = 60;
const FEATHER_DEFAULT = 9; // ancho del “desvanecido” del borde

/* RNG determinístico ligero */
function mulberry32(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* Paleta */
const PALETTE = {
  baseA: "#5e9836",
  baseB: "#84b94f",
  centerLift: 0.06,
  roughMid: "#7a7a7a",
} as const;

/* Texturas procedurales */
function makeGrassColor(rng: () => number, size = 512): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;

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

  for (let i = 0; i < 1300; i++) {
    const r = rng() * (size * 0.03);
    const x = rng() * size;
    const y = rng() * size;

    const g1 = new THREE.Color(PALETTE.baseA);
    const g2 = new THREE.Color(PALETTE.baseB);
    const mix = rng() * 0.85 + 0.15;
    const col = g1.clone().lerp(g2, mix);
    const a = 0.05 + rng() * 0.08;

    ctx.fillStyle = `rgba(${Math.round(col.r * 255)}, ${Math.round(
      col.g * 255
    )}, ${Math.round(col.b * 255)}, ${a})`;

    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      r * (0.7 + rng() * 0.7),
      r,
      rng() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

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

  const tex = new THREE.CanvasTexture(c);
  tex.name = "GroundColor";
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  // assign colorSpace if available in this three.js build (avoid `any` by using unknown casts)
  const _srgb = (THREE as unknown as { SRGBColorSpace?: number })
    .SRGBColorSpace;
  if (_srgb !== undefined) {
    (tex as unknown as { colorSpace: number }).colorSpace = _srgb;
  }
  return tex;
}

function makeGrassRough(rng: () => number, size = 512): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;

  ctx.fillStyle = PALETTE.roughMid;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1600; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const w = rng() * (size * 0.02) + 1.5;
    const h = w * (0.8 + rng() * 1.2);
    const rot = rng() * Math.PI;
    const a = rng() * 0.2 + 0.06;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.name = "GroundRough";
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

/* Relieve (colinas) */
function makeHillsGeometry(
  width = 200,
  depth = 200,
  seg = 240,
  amplitude = 0.6,
  radius = GARDEN_RADIUS_DEFAULT,
  feather = FEATHER_DEFAULT
) {
  const geo = new THREE.PlaneGeometry(width, depth, seg, seg);
  const pos = geo.attributes.position as THREE.BufferAttribute;

  const hw = width / 2;
  const hd = depth / 2;

  // Para un borde físico más prolijo, reducimos altura fuera del radio+feather
  const rMax = radius + feather;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    const nx = x / hw;
    const ny = y / hd;

    // Ruido suave
    let h =
      0.55 * Math.sin(nx * Math.PI * 0.9) * Math.cos(ny * Math.PI * 0.8) +
      0.28 * Math.sin((nx + ny) * Math.PI * 0.55) +
      0.18 * Math.cos((nx - ny) * Math.PI * 0.5);

    // Caída radial global (para que el centro sea protagonista)
    const rNorm = Math.sqrt(nx * nx + ny * ny);
    const falloff = 1 - Math.min(1, Math.pow(rNorm / 1.4, 2.2));
    h *= Math.max(0, falloff);

    // Aplanado físico fuera del círculo (opcional pero ayuda a raycasting)
    const r = Math.hypot(x, y);
    if (r > rMax) {
      h *= 0.0;
    } else if (r > radius) {
      // transiciona a 0 entre radius..radius+feather
      const k = (r - radius) / feather;
      h *= 1.0 - Math.min(1, k);
    }

    pos.setZ(i, h * amplitude);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* Componente */
export default function Ground({
  size = 200,
  segments = 240,
  amplitude = 0.6,
  seed = 1,
  radius = GARDEN_RADIUS_DEFAULT,
  feather = FEATHER_DEFAULT,
}: Props) {
  const { gl } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);

  const rng = useMemo(() => mulberry32(seed), [seed]);

  const { colorMap, roughMap, bumpMap, hillsGeo } = useMemo(() => {
    const color = makeGrassColor(rng, 512);
    const rough = makeGrassRough(rng, 512);

    const repeatU = 14 + rng() * 6;
    const repeatV = 14 + rng() * 6;
    color.repeat.set(repeatU, repeatV);
    rough.repeat.set(repeatU, repeatV);

    const offU = rng();
    const offV = rng();
    color.offset.set(offU, offV);
    const maxAniso = Math.min(8, gl.capabilities.getMaxAnisotropy?.() ?? 1);
    (color as unknown as { anisotropy: number }).anisotropy = maxAniso;
    (rough as unknown as { anisotropy: number }).anisotropy = maxAniso;

    const bump = rough.clone();
    bump.name = "GroundBump";

    const hills = makeHillsGeometry(
      size,
      size,
      segments,
      amplitude,
      radius,
      feather
    );
    hills.name = "GroundHills";

    return { colorMap: color, roughMap: rough, bumpMap: bump, hillsGeo: hills };
  }, [gl, size, segments, amplitude, rng, radius, feather]);

  useEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    m.updateMatrix();
  }, []);

  useEffect(() => {
    return () => {
      colorMap.dispose();
      roughMap.dispose();
      // bumpMap is a Texture (clone of roughMap) and exposes dispose()
      (bumpMap as THREE.Texture).dispose();
      hillsGeo.dispose();
    };
  }, [colorMap, roughMap, bumpMap, hillsGeo]);

  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: "#6ea43e",
      map: colorMap,
      roughnessMap: roughMap,
      roughness: 0.96,
      metalness: 0.0,
      bumpMap: bumpMap,
      bumpScale: 0.008,
      envMapIntensity: 0.15,
      side: THREE.FrontSide,
      fog: true,
      transparent: true,
      alphaTest: 0.001, // que el alphatest haga efecto
      depthWrite: true, // escribimos Z dentro del disco (mejor orden)
    });

    // Anti-alias del borde si usás MSAA
    const mExt = m as THREE.MeshStandardMaterial & { alphaToCoverage?: boolean };
    mExt.alphaToCoverage = true;

    m.onBeforeCompile = (shader) => {
      // 1) pasar posición mundo al fragment
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
       varying vec3 vWorldPos;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
       vec4 wp = modelMatrix * vec4(transformed, 1.0);
       vWorldPos = wp.xyz;`
      );

      // 2) declarar varying en fragment
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
       varying vec3 vWorldPos;`
      );

      // 3) recorte circular ANTES del alphatest, afectando diffuseColor.a
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <alphatest_fragment>",
        `
        // --- circular mask ---
        float r = length(vWorldPos.xz);
        float R = ${radius.toFixed(3)};
        float F = ${feather.toFixed(3)};
        float edge0 = max(0.0, R - F);
        float edge1 = R;

        // fuera del disco: descartar
        if (r > edge1) { discard; }

        // feather en el borde: baja alpha de forma suave
        float k = smoothstep(edge0, edge1, r);
        diffuseColor.a *= (1.0 - k);

        // continuar con el alphatest estándar
        #include <alphatest_fragment>
      `
      );
    };

    m.needsUpdate = true;
    return m;
  }, [colorMap, roughMap, bumpMap, radius, feather]);

  return (
    <mesh
      ref={meshRef}
      geometry={hillsGeo}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      frustumCulled={false}
      matrixAutoUpdate={false}
      renderOrder={0}
    >
      <primitive attach="material" object={material} />
    </mesh>
  );
}
