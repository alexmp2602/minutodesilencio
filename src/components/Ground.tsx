// components/Ground.tsx
"use client";

import * as THREE from "three";
import { useMemo } from "react";
import { useThree } from "@react-three/fiber";

function makeGrassTexture(size = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  // base
  ctx.fillStyle = "#1f4f1f";
  ctx.fillRect(0, 0, size, size);

  // “mottled” noise
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
  tex.colorSpace = THREE.SRGBColorSpace; // ← sin "any", tipado correcto
  return tex;
}

export default function Ground() {
  const { gl } = useThree();

  const { colorMap, roughMap } = useMemo(() => {
    const map = makeGrassTexture(256);
    map.repeat.set(30 + Math.random() * 6, 30 + Math.random() * 6);
    map.offset.set(Math.random(), Math.random());
    map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy(), 16);

    const rough = map.clone();
    return { colorMap: map, roughMap: rough };
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
        color={"#2a8a2a"}
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
