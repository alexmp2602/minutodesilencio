// components/Ground.tsx
"use client";

import * as THREE from "three";

export default function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[200, 200, 1, 1]} />
      <meshStandardMaterial
        color={"#268f26"} // verde definido
        roughness={0.95} // bien mate
        metalness={0.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
