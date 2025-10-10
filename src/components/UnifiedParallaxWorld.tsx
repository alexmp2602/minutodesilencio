// src/components/UnifiedParallaxWorld.tsx
"use client";

import * as THREE from "three";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Sky,
  Clouds,
  Cloud,
  OrbitControls,
  PerformanceMonitor,
  Html,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

import Ground from "@/components/Ground";
import GrassField from "@/components/GrassField";
import Flowers from "@/components/Flowers";
import GardenOverlay from "@/components/GardenOverlay";
import AmbientAudio from "@/components/AmbientAudio";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { MuteProvider } from "@/hooks/useMute";

declare global {
  interface Window {
    __camera?: THREE.Camera;
    __controls?: {
      target: { set: (x: number, y: number, z: number) => void };
      object: { position: { set: (x: number, y: number, z: number) => void } };
      update?: () => void;
    };
  }
}

type Props = { introProgress?: number; minuteProgress?: number };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (t: number) => {
  const u = clamp01(t);
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
};

/** Rig de cámara para el tramo de descenso (antes del jardín). */
function TimelineRig({
  minuteK,
  gardenEntered,
}: {
  minuteK: number;
  gardenEntered: boolean;
}) {
  const { camera, scene } = useThree();

  const startPos = useMemo(() => new THREE.Vector3(0, 22, 24), []);
  const endPos = useMemo(() => new THREE.Vector3(4, 3, 4), []);
  const startTarget = useMemo(() => new THREE.Vector3(0, 6, 0), []);
  const endTarget = useMemo(() => new THREE.Vector3(0, 0.6, 0), []);
  const snappedRef = useRef(false);

  useFrame((_, dt) => {
    if (gardenEntered) {
      if (!snappedRef.current) {
        camera.position.copy(endPos);
        (camera as THREE.PerspectiveCamera).lookAt(
          endTarget.x,
          endTarget.y,
          endTarget.z
        );
        const f = scene.fog as THREE.Fog | null;
        if (f) {
          f.near = 12;
          f.far = 42;
        }
        snappedRef.current = true;
      }
      return; // dentro del jardín: OrbitControls manda
    }

    const idle = 0.02 * Math.sin(performance.now() * 0.0012);
    const k = easeInOut(minuteK);

    const pos = startPos.clone().lerp(endPos, k);
    const tgt = startTarget.clone().lerp(endTarget, k);

    camera.position.lerp(pos, Math.min(1, dt * 4));
    (camera as THREE.PerspectiveCamera).lookAt(tgt.x, tgt.y + idle, tgt.z);

    const f = scene.fog as THREE.Fog | null;
    if (f) {
      f.near = THREE.MathUtils.lerp(10, 12, k);
      f.far = THREE.MathUtils.lerp(26, 42, k);
    }
  });

  return null;
}

/** Expone cámara/controles para el overlay. */
function PublishGlobals({
  controlsRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  useEffect(() => {
    window.__camera = camera;
    const c = controlsRef.current;
    if (c) {
      window.__controls = {
        target: { set: (x, y, z) => c.target.set(x, y, z) },
        object: {
          position: { set: (x, y, z) => c.object.position.set(x, y, z) },
        },
        update: () => c.update?.(),
      };
    }
    return () => {
      if (window.__camera === camera) delete window.__camera;
      if (window.__controls) delete window.__controls;
    };
  }, [camera, controlsRef]);
  return null;
}

export default function UnifiedParallaxWorld({
  introProgress = 0,
  minuteProgress = 0,
}: Props) {
  const [dpr, setDpr] = useState<[number, number] | number>([1, 2]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [forceEntered, setForceEntered] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Ir directo al jardín si hay #main
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#main") {
      setForceEntered(true);
      requestAnimationFrame(() =>
        window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" })
      );
    }
  }, []);

  const minuteK = clamp01(minuteProgress);
  const gardenEntered = forceEntered || minuteK > 0.94;

  const fogColor = useMemo(() => new THREE.Color("#eab565"), []);

  // ---- Scroll passthrough SOLO antes de entrar ----
  const lastTouchY = useRef<number | null>(null);
  const scrollByPage = (dy: number) => {
    const el =
      document.scrollingElement ||
      (document.documentElement as HTMLElement) ||
      (document.body as HTMLElement);
    el.scrollTop += dy;
  };
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!gardenEntered) {
      e.preventDefault();
      scrollByPage(e.deltaY);
    }
    // dentro del jardín: no hacemos nada → OrbitControls usa la rueda para zoom
  };
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!gardenEntered) {
      lastTouchY.current = e.touches[0]?.clientY ?? null;
    }
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!gardenEntered) {
      const y = e.touches[0]?.clientY ?? null;
      if (y != null && lastTouchY.current != null) {
        e.preventDefault();
        const dy = lastTouchY.current - y;
        scrollByPage(dy);
      }
      lastTouchY.current = y;
    }
    // dentro del jardín: OrbitControls maneja drag y pinch (zoom)
  };
  const handleTouchEnd = () => {
    lastTouchY.current = null;
  };

  return (
    <Canvas
      className={grabbing ? "canvas-grabbing" : "canvas-grab"}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      camera={{ position: [0, 22, 24], fov: 50, near: 0.1, far: 200 }}
      dpr={dpr}
      style={{ width: "100%", height: "100%" }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor("#edd0a1", 1);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.68;
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.fog = new THREE.Fog(fogColor, 10, 26);
      }}
      onPointerDown={(e) => {
        if (e.button === 2 || e.button === 0) setGrabbing(true);
      }}
      onPointerUp={() => setGrabbing(false)}
      onPointerCancel={() => setGrabbing(false)}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr([1, 2])}
      />

      <MuteProvider>
        <TimelineRig minuteK={minuteK} gardenEntered={gardenEntered} />

        {/* Cielo y nubes */}
        <Sky
          sunPosition={[0, 5.5, -10]}
          turbidity={12}
          rayleigh={1.6}
          mieCoefficient={0.02}
          mieDirectionalG={0.995}
          distance={4500}
          inclination={0.47}
          azimuth={180}
        />
        <group position={[0, 0.3, 0]}>
          <Clouds material={THREE.MeshLambertMaterial}>
            <Cloud
              seed={1}
              position={[0, 14, -6]}
              bounds={[12, 6, 6]}
              volume={8}
              segments={30}
              opacity={1 - minuteK}
            />
            <Cloud
              seed={2}
              position={[-6, 16, 2]}
              bounds={[10, 5, 6]}
              volume={6}
              segments={24}
              opacity={1 - minuteK}
            />
            <Cloud
              seed={3}
              position={[7, 15, 5]}
              bounds={[10, 6, 7]}
              volume={7}
              segments={26}
              opacity={1 - minuteK}
            />
          </Clouds>
        </group>

        {/* Luces */}
        <ambientLight intensity={0.35} />
        <directionalLight
          color={0xffe1b0}
          intensity={1.15}
          position={[8, 14, 6]}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={40}
          shadow-camera-left={-16}
          shadow-camera-right={16}
          shadow-camera-top={16}
          shadow-camera-bottom={-16}
        />

        {/* Jardín */}
        <Suspense fallback={null}>
          <group visible={gardenEntered}>
            <Ground />
            <GrassField
              count={12000}
              areaSize={200}
              bladeHeight={0.65}
              wind={0.8}
            />
            <Flowers />
          </group>
        </Suspense>

        <EffectComposer multisampling={0}>
          <Bloom
            mipmapBlur
            intensity={reducedMotion ? 0.08 : 0.16}
            luminanceThreshold={0.72}
            luminanceSmoothing={0.08}
            radius={0.55}
          />
        </EffectComposer>

        {/* Dentro del jardín: la rueda hace zoom (dolly) */}
        {gardenEntered && (
          <OrbitControls
            ref={controlsRef}
            enableZoom={true} // ← ACTIVAMOS zoom con rueda/pinch
            zoomSpeed={reducedMotion ? 0.7 : 1.0}
            enablePan={false}
            enableDamping
            dampingFactor={reducedMotion ? 0.03 : 0.08}
            rotateSpeed={reducedMotion ? 0.45 : 0.68}
            maxPolarAngle={Math.PI / 2.02}
            minDistance={2.5} // podés acercarte más al suelo
            maxDistance={28} // y alejarte hacia el cielo
          />
        )}

        <PublishGlobals controlsRef={controlsRef} />

        {/* Audio + Overlay al entrar */}
        <Html style={{ pointerEvents: "none" }}>
          {gardenEntered && (
            <div style={{ pointerEvents: "auto" }}>
              <AmbientAudio src="/audio/ambient.mp3" volume={0.15} />
            </div>
          )}
        </Html>
        <Html fullscreen pointerEvents="none" zIndexRange={[50, 0]}>
          {gardenEntered && (
            <div style={{ pointerEvents: "auto" }}>
              <GardenOverlay />
            </div>
          )}
        </Html>
      </MuteProvider>
    </Canvas>
  );
}
