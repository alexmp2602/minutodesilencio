"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import Ground from "./Ground";

export default function Scene() {
  return (
    <div
      style={{
        width: "100%",
        height: "70vh",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <Canvas
        camera={{ position: [4, 3, 4], fov: 50 }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0b0d10"); // combina con tu layout
        }}
      >
        {/* Luz ambiente y direccional básica */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 6, 3]} intensity={1.2} />
        <directionalLight position={[-5, 3, -2]} intensity={0.3} />

        {/* Suelo */}
        <Suspense fallback={null}>
          <Ground />
        </Suspense>

        {/* Controles de cámara */}
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>
    </div>
  );
}
