"use client";

import * as THREE from "three";
import { useMemo } from "react";
import { useThree } from "@react-three/fiber";

function makeGrassColor(size = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;

  ctx.fillStyle = "#1f4f1f";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1200; i++) {
    const r = Math.random() * (size * 0.04);
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 110 + Math.floor(Math.random() * 80);
    const b = 110 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgba(40, ${g}, ${b}, ${Math.random() * 0.14 + 0.05})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (0.7 + Math.random() * 0.6), r, 0, 0, Math.PI * 2);
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

function makeGrassRough(size = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;

  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 800; i++) {
    const r = Math.random() * (size * 0.03);
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = Math.random() * 0.25 + 0.05;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      r,
      r * (0.6 + Math.random() * 0.8),
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

export default function Ground() {
  const { gl } = useThree();

  const { colorMap, roughMap } = useMemo(() => {
    const color = makeGrassColor(256);
    const rough = makeGrassRough(256);

    const repeatU = 30 + Math.random() * 6;
    const repeatV = 30 + Math.random() * 6;

    color.repeat.set(repeatU, repeatV);
    rough.repeat.set(repeatU, repeatV);

    const offU = Math.random();
    const offV = Math.random();
    color.offset.set(offU, offV);
    rough.offset.set(offU, offV);

    const maxAniso = Math.min(16, gl.capabilities.getMaxAnisotropy());
    color.anisotropy = maxAniso;
    rough.anisotropy = maxAniso;

    return { colorMap: color, roughMap: rough };
  }, [gl]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      frustumCulled={false}
    >
      <planeGeometry args={[200, 200, 4, 4]} />
      <meshStandardMaterial
        color="#2a8a2a"
        map={colorMap}
        roughnessMap={roughMap}
        roughness={0.96}
        metalness={0}
        side={THREE.FrontSide}
        fog
      />
    </mesh>
  );
}
