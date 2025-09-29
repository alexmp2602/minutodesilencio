// app/components/Scene.tsx
"use client";

import * as THREE from "three";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor, Sky } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import Ground from "./Ground";
import GrassField from "./GrassField";
import Flowers from "./Flowers";

export default function Scene() {
  const [dpr, setDpr] = useState<[number, number] | number>([1, 2]);
  const [grabbing, setGrabbing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // paleta cálida, pero controlada
  const palette = {
    fog: "#eab565",
    clear: "#edd0a1",
    hemiSky: "#f3c48a",
    hemiGround: "#3b5d36",
    sun: "#f2c472",
  } as const;

  const fogColor = useMemo(() => new THREE.Color(palette.fog), [palette.fog]);

  // posición del sol (para Sky y para la luz direccional)
  const sun = useMemo<THREE.Vector3>(
    () => new THREE.Vector3(0, 0.55, -1).normalize().multiplyScalar(10),
    []
  );

  return (
    <Canvas
      className={grabbing ? "canvas-grabbing" : "canvas-grab"}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      camera={{ position: [4, 3, 4], fov: 50, near: 0.1, far: 200 }}
      dpr={dpr}
      style={{ width: "100%", height: "100%" }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(palette.clear, 1);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.68;
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;

        // bruma cálida que funde con el cielo
        scene.fog = new THREE.Fog(fogColor, 12, 42);

        const onLost = (e: Event) => e.preventDefault();
        gl.domElement.addEventListener("webglcontextlost", onLost, {
          passive: false,
        });
        return () =>
          gl.domElement.removeEventListener("webglcontextlost", onLost);
      }}
      onPointerDown={(e) => {
        if (e.button === 2 || e.button === 0) setGrabbing(true);
      }}
      onPointerUp={() => setGrabbing(false)}
      onPointerCancel={() => setGrabbing(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* baja calidad si cae el rendimiento */}
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr([1, 2])}
      />

      {/* CIELO: solo <Sky/>, sin disco/overlay extra */}
      <Sky
        sunPosition={sun.toArray()}
        turbidity={12}
        rayleigh={1.6}
        mieCoefficient={0.02}
        mieDirectionalG={0.995}
        azimuth={180}
        inclination={0.47}
        distance={4500}
      />

      {/* Iluminación coherente con el atardecer (sin exagerar) */}
      <ambientLight intensity={0.15} />
      <hemisphereLight
        color={palette.hemiSky}
        groundColor={palette.hemiGround}
        intensity={0.26}
      />
      <directionalLight
        position={[0, 3.8, -8]} // proviene del frente, a baja altura
        color={palette.sun}
        intensity={0.72} // más suave para no “lavar”
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0006}
        shadow-camera-near={1}
        shadow-camera-far={38}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />

      <Suspense fallback={null}>
        <Ground />
        <GrassField count={12000} areaSize={200} bladeHeight={0.65} wind={0.8} />
        <Flowers />
      </Suspense>

      <OrbitControls
        enableDamping
        dampingFactor={reducedMotion ? 0.03 : 0.08}
        rotateSpeed={reducedMotion ? 0.45 : 0.68}
        zoomSpeed={reducedMotion ? 0.6 : 0.85}
        enablePan={false}
        target={[0, 0.6, 0]}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={3}
        maxDistance={16}
      />

      {/* Bloom MUY selectivo, solo respira en altas luces reales */}
      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          intensity={reducedMotion ? 0.1 : 0.16}
          luminanceThreshold={0.72}
          luminanceSmoothing={0.08}
          radius={0.55}
        />
      </EffectComposer>
    </Canvas>
  );
}
