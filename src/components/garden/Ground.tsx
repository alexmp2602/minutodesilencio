"use client";

import * as THREE from "three";

export default function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      {/* Plano de 100x100 con 1x1 de segmentos (simple y barato) */}
      <planeGeometry args={[100, 100, 1, 1]} />
      <meshStandardMaterial
        color={"#1a222b"}
        roughness={0.95}
        metalness={0.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
