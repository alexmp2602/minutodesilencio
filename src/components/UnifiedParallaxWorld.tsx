// src/components/UnifiedParallaxWorld.tsx
"use client";

import * as THREE from "three";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Sky,
  Clouds,
  Cloud,
  OrbitControls,
  PerformanceMonitor,
  Html,
} from "@react-three/drei";

import Ground from "@/components/Ground";
import GrassField from "@/components/GrassField";
import Flowers from "@/components/Flowers";
import GardenOverlay from "@/components/GardenOverlay";
import AmbientAudio from "@/components/AmbientAudio";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { MuteProvider } from "@/hooks/useMute";
import GardenHint from "@/components/GardenHint";

declare global {
  interface Window {
    __camera?: THREE.Camera;
    __controls?: {
      target: { set: (x: number, y: number, z: number) => void };
      object: { position: { set: (x: number, y: number, z: number) => void } };
      update?: () => void;
      setEnabled?: (enabled: boolean) => void;
    };
    __orbitDragging?: boolean;
  }
}

type Props = { minuteProgress?: number; introProgress?: number };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (t: number) => {
  const u = clamp01(t);
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
};

// Offset vertical para levantar un poco la capa de nubes
const MINUTE_YOFF = 0.55;

// Colores base del cielo y la niebla
const INTRO_CLEAR = new THREE.Color("#1227e6");
const GARDEN_CLEAR = new THREE.Color("#69a9ff");
const GARDEN_FOG = new THREE.Color("#8fbeff");

// Marcador pulsante para mostrar la flor propia
function FocusPulse({ pos }: { pos: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const s = 1 + 0.15 * Math.sin(t * 3);
    if (ref.current) {
      ref.current.scale.setScalar(s);
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 + 0.4 * Math.sin(t * 3 + Math.PI / 2);
    }
  });

  return (
    <mesh
      ref={ref}
      position={[pos.x, pos.y + 0.01, pos.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.28, 0.42, 48]} />
      <meshBasicMaterial color="#2300ff" transparent opacity={0.8} />
    </mesh>
  );
}

// Detecta si la cámara está “dentro” del jardín con un poco de histéresis
function ProximitySensor({
  onSetGardenActive,
  controlsRef,
}: {
  onSetGardenActive: (active: boolean) => void;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 0.6, 0), []);
  const ENTER_DIST = 12.4;
  const EXIT_DIST = 14.0;
  const activeRef = useRef(false);

  useFrame(() => {
    const t = controlsRef.current?.target ?? target;
    const dist = camera.position.distanceTo(t);
    const k = clamp01((EXIT_DIST - dist) / (EXIT_DIST - ENTER_DIST));

    if (!activeRef.current && dist <= ENTER_DIST) {
      activeRef.current = true;
      onSetGardenActive(true);
    } else if (activeRef.current && dist >= EXIT_DIST) {
      activeRef.current = false;
      onSetGardenActive(false);
    }

    window.dispatchEvent(
      new CustomEvent("ms:garden", { detail: { k, entered: k > 0 } })
    );
  });

  return null;
}

// Maneja el vuelo de cámara cuando se planta una flor
function PlantingLogic({
  controlsRef,
  setGardenActive,
  setMyFlowerPos,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  setGardenActive: (v: boolean) => void;
  setMyFlowerPos: (v: THREE.Vector3 | null) => void;
}) {
  const { camera } = useThree();
  const defaultTarget = useMemo(() => new THREE.Vector3(0, 0.6, 0), []);
  const flightRef = useRef<{
    t: number;
    dur: number;
    startPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endPos: THREE.Vector3;
    endTarget: THREE.Vector3;
  } | null>(null);

  const angleRef = useRef(0);

  const startFlight = useCallback(
    (focus: THREE.Vector3) => {
      const c = controlsRef.current;
      const startPos = camera.position.clone();
      const startTarget = c?.target?.clone() ?? defaultTarget.clone();

      const dir = new THREE.Vector3().subVectors(startPos, focus).setY(0);
      if (dir.lengthSq() < 1e-3) dir.set(1, 0, 0);
      dir.normalize();

      const endTarget = focus.clone().setY(0.6);
      const endPos = focus.clone().add(dir.multiplyScalar(3.2)).setY(2.6);

      flightRef.current = {
        t: 0,
        dur: 1.2,
        startPos,
        startTarget,
        endPos,
        endTarget,
      };
    },
    [camera, controlsRef, defaultTarget]
  );

  useEffect(() => {
    const onPlant = () => {
      setGardenActive(true);
      const c = controlsRef.current;
      const center = c?.target?.clone() ?? defaultTarget.clone();
      const r = 2.4 + Math.random() * 2.1;
      angleRef.current += 2.3999632297;
      const a = angleRef.current;
      const pos = new THREE.Vector3(
        center.x + Math.cos(a) * r,
        0,
        center.z + Math.sin(a) * r
      );
      setMyFlowerPos(pos.clone());
      startFlight(pos);
      window.dispatchEvent(
        new CustomEvent("ms:plant:done", {
          detail: { position: [pos.x, pos.y, pos.z] },
        })
      );
    };

    window.addEventListener("ms:plant", onPlant as EventListener);
    return () =>
      window.removeEventListener("ms:plant", onPlant as EventListener);
  }, [
    controlsRef,
    defaultTarget,
    setGardenActive,
    setMyFlowerPos,
    startFlight,
  ]);

  useFrame((_, dt) => {
    const f = flightRef.current;
    if (!f) return;

    f.t += dt;
    const k = easeInOut(clamp01(f.t / f.dur));

    const camPos = new THREE.Vector3().lerpVectors(f.startPos, f.endPos, k);
    const tgtPos = new THREE.Vector3().lerpVectors(
      f.startTarget,
      f.endTarget,
      k
    );

    camera.position.copy(camPos);
    (camera as THREE.PerspectiveCamera).lookAt(tgtPos);

    const c = controlsRef.current;
    if (c) {
      c.object.position.copy(camPos);
      c.target.copy(tgtPos);
      c.update();
    }

    if (k >= 1) {
      flightRef.current = null;
    }
  });

  return null;
}

// Trayectoria “clásica” de descenso durante el minuto
function TimelineRig({
  minuteK,
  gardenActive,
}: {
  minuteK: number;
  gardenActive: boolean;
}) {
  const { camera, scene } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 0.6, 0), []);
  const startPos = useMemo(() => new THREE.Vector3(0, 28, 30), []);
  const endPos = useMemo(() => new THREE.Vector3(7.5, 6.8, 7.5), []);
  const startSph = useMemo(
    () => new THREE.Spherical().setFromVector3(startPos.clone().sub(target)),
    [startPos, target]
  );
  const endSph = useMemo(
    () => new THREE.Spherical().setFromVector3(endPos.clone().sub(target)),
    [endPos, target]
  );

  useFrame((_state, dt) => {
    if (gardenActive) {
      const f = scene.fog as THREE.Fog | null;
      if (f) {
        f.near = 10;
        f.far = 160;
      }
      return;
    }

    const idle = 0.02 * Math.sin(performance.now() * 0.0012);
    const k = easeInOut(minuteK);
    const r = THREE.MathUtils.lerp(startSph.radius, endSph.radius, k);
    const phi = THREE.MathUtils.lerp(startSph.phi, endSph.phi, k);
    const theta = THREE.MathUtils.lerp(startSph.theta, endSph.theta, k);

    const pos = new THREE.Vector3()
      .setFromSpherical(new THREE.Spherical(r, phi, theta))
      .add(target);

    camera.position.lerp(pos, Math.min(1, dt * 4));
    (camera as THREE.PerspectiveCamera).lookAt(
      target.x,
      target.y + idle,
      target.z
    );

    const f = scene.fog as THREE.Fog | null;
    if (f) {
      const NEAR_START = 0;
      const FAR_START = 0;
      const NEAR_END = 8;
      const FAR_END = 300;
      f.near = THREE.MathUtils.lerp(NEAR_START, NEAR_END, k);
      f.far = THREE.MathUtils.lerp(FAR_START, FAR_END, k);
    }
  });

  return null;
}

// Hace de “fader” entre la intro azul y el jardín celeste
function EnvTint({ inGarden }: { inGarden: boolean }) {
  const { gl, scene } = useThree();
  const clear = useRef(INTRO_CLEAR.clone());
  const fogCol = useRef(INTRO_CLEAR.clone());

  useEffect(() => {
    const c = inGarden ? GARDEN_CLEAR : INTRO_CLEAR;
    const f = inGarden ? GARDEN_FOG : INTRO_CLEAR;
    clear.current.copy(c);
    fogCol.current.copy(f);
    gl.setClearColor(clear.current, 1);
    (scene.fog as THREE.Fog).color.copy(fogCol.current);
  }, [gl, scene, inGarden]);

  useFrame(() => {
    const targetClear = inGarden ? GARDEN_CLEAR : INTRO_CLEAR;
    const targetFog = inGarden ? GARDEN_FOG : INTRO_CLEAR;

    clear.current.lerp(targetClear, 0.08);
    fogCol.current.lerp(targetFog, 0.08);

    gl.setClearColor(clear.current, 1);
    (scene.fog as THREE.Fog).color.copy(fogCol.current);
  });

  return null;
}

// Expone cámara y controles en window para debug/ajustes
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
        setEnabled: (enabled: boolean) => (c.enabled = enabled),
      };
    }

    return () => {
      if (window.__camera === camera) delete window.__camera;
      if (window.__controls) delete window.__controls;
    };
  }, [camera, controlsRef]);

  return null;
}

// Vuelo automático hacia el jardín, disparado desde TextOverlay
function AutoFlightLoop({
  autoFlightRef,
  controlsRef,
  onFinish,
}: {
  autoFlightRef: React.MutableRefObject<{
    t: number;
    dur: number;
    startPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endPos: THREE.Vector3;
    endTarget: THREE.Vector3;
  } | null>;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  onFinish: () => void;
}) {
  const { camera } = useThree();

  useFrame((_, dt) => {
    const f = autoFlightRef.current;
    if (!f) return;

    f.t += dt;
    const k = easeInOut(clamp01(f.t / f.dur));

    const camPos = new THREE.Vector3().lerpVectors(f.startPos, f.endPos, k);
    const tgtPos = new THREE.Vector3().lerpVectors(
      f.startTarget,
      f.endTarget,
      k
    );

    camera.position.copy(camPos);
    (camera as THREE.PerspectiveCamera).lookAt(tgtPos);

    const c = controlsRef.current;
    if (c) {
      c.object.position.copy(camPos);
      c.target.copy(tgtPos);
      c.update();
    }

    if (k >= 1) {
      autoFlightRef.current = null;
      onFinish();
    }
  });

  return null;
}

export default function UnifiedParallaxWorld({ minuteProgress = 0 }: Props) {
  const [dpr, setDpr] = useState<[number, number] | number>([1, 2]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [grabbing, setGrabbing] = useState(false);

  const [gardenActive, setGardenActive] = useState(false);
  const [forceEntered, setForceEntered] = useState(false);
  const [myFlowerPos, setMyFlowerPos] = useState<THREE.Vector3 | null>(null);

  // Re-monto el hint cada vez que se vuelve a entrar al jardín
  const [hintEpoch, setHintEpoch] = useState(0);
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (gardenActive && !wasActiveRef.current) {
      setHintEpoch((e) => e + 1);
    }
    wasActiveRef.current = gardenActive;
  }, [gardenActive]);

  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const defaultTarget = useMemo(() => new THREE.Vector3(0, 0.6, 0), []);
  const autoFlightRef = useRef<{
    t: number;
    dur: number;
    startPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endPos: THREE.Vector3;
    endTarget: THREE.Vector3;
  } | null>(null);

  // Vuelo controlado hacia el jardín
  const startAutoEnter = useCallback(() => {
    if (autoFlightRef.current || gardenActive) return;

    const c = controlsRef.current || null;
    const cam =
      (window.__camera as THREE.PerspectiveCamera | undefined) || null;

    const startPos = cam ? cam.position.clone() : new THREE.Vector3(0, 28, 30);
    const startTarget = c?.target?.clone() ?? defaultTarget.clone();

    const endTarget = defaultTarget.clone();
    const endPos = new THREE.Vector3(7.5, 6.8, 7.5);

    autoFlightRef.current = {
      t: 0,
      dur: 5,
      startPos,
      startTarget,
      endPos,
      endTarget,
    };

    setForceEntered(true);

    if (c) c.enabled = false;

    requestAnimationFrame(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
    );
  }, [gardenActive, defaultTarget]);

  // Eventos que dispara TextOverlay cuando termina el ritual
  useEffect(() => {
    const onGo = () => startAutoEnter();
    window.addEventListener("ui:overlay:dismissed", onGo as EventListener);
    window.addEventListener("silence:completed", onGo as EventListener);
    return () => {
      window.removeEventListener("ui:overlay:dismissed", onGo as EventListener);
      window.removeEventListener("silence:completed", onGo as EventListener);
    };
  }, [startAutoEnter]);

  // Respeta prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Entrada directa al jardín con hash (#main)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#main") {
      setForceEntered(true);
      setGardenActive(true);
      requestAnimationFrame(() =>
        window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" })
      );
    }
  }, []);

  const minuteK = clamp01(minuteProgress);

  // Passthrough de scroll cuando todavía no estás “dentro” del jardín
  const lastTouchY = useRef<number | null>(null);
  const scrollByPage = (dy: number) => {
    const el =
      document.scrollingElement ||
      (document.documentElement as HTMLElement) ||
      (document.body as HTMLElement);
    el.scrollTop += dy;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      if (!gardenActive) {
        e.preventDefault();
        scrollByPage(e.deltaY);
      }
    };
    const onTouchStart = (e: TouchEvent) => {
      if (!gardenActive) lastTouchY.current = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!gardenActive) {
        const y = e.touches[0]?.clientY ?? null;
        if (y != null && lastTouchY.current != null) {
          e.preventDefault();
          scrollByPage(lastTouchY.current - y);
        }
        lastTouchY.current = y;
      }
    };
    const onTouchEnd = () => (lastTouchY.current = null);

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      canvas.removeEventListener("wheel", onWheel as EventListener);
      canvas.removeEventListener("touchstart", onTouchStart as EventListener);
      canvas.removeEventListener("touchmove", onTouchMove as EventListener);
      canvas.removeEventListener("touchend", onTouchEnd as EventListener);
    };
  }, [gardenActive]);

  // Dentro del jardín bloqueo scroll nativo y dejo sólo OrbitControls
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const canvas = canvasRef.current;

    if (gardenActive) {
      body.style.overflow = "hidden";
      root.style.overscrollBehavior = "contain";
      if (canvas) (canvas.style as CSSStyleDeclaration).touchAction = "none";
    } else {
      body.style.overflow = "";
      root.style.overscrollBehavior = "";
      if (canvas) (canvas.style as CSSStyleDeclaration).touchAction = "";
    }

    return () => {
      body.style.overflow = "";
      root.style.overscrollBehavior = "";
      if (canvas) (canvas.style as CSSStyleDeclaration).touchAction = "";
    };
  }, [gardenActive]);

  const overlayVisible = gardenActive || forceEntered;

  return (
    <Canvas
      className={grabbing ? "canvas-grabbing" : "canvas-grab"}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      camera={{
        position: [0, 28, 30],
        fov: 50,
        near: 0.01,
        far: 220,
      }}
      dpr={dpr}
      style={{ width: "100%", height: "100%" }}
      onCreated={({ gl, scene }) => {
        canvasRef.current = gl.domElement as HTMLCanvasElement;
        gl.setClearColor(INTRO_CLEAR, 1);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.68;
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.fog = new THREE.Fog(INTRO_CLEAR.clone(), 8, 120);
      }}
      onPointerDown={(e) => {
        if (e.button === 2 || e.button === 0) setGrabbing(true);
      }}
      onPointerUp={() => setGrabbing(false)}
      onPointerCancel={() => setGrabbing(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr([1, 2])}
      />

      <MuteProvider>
        <EnvTint inGarden={overlayVisible} />

        <TimelineRig minuteK={minuteK} gardenActive={overlayVisible} />
        <ProximitySensor
          onSetGardenActive={(v) => setGardenActive(v)}
          controlsRef={controlsRef}
        />
        <PlantingLogic
          controlsRef={controlsRef}
          setGardenActive={setGardenActive}
          setMyFlowerPos={setMyFlowerPos}
        />

        <AutoFlightLoop
          autoFlightRef={autoFlightRef}
          controlsRef={controlsRef}
          onFinish={() => {
            setGardenActive(true);
            setForceEntered(true);
            const c = controlsRef.current;
            if (c) c.enabled = true;
          }}
        />

        <Sky
          sunPosition={[0, 5.5, -10]}
          turbidity={overlayVisible ? 6 : 10}
          rayleigh={overlayVisible ? 2.8 : 2.0}
          mieCoefficient={0.012}
          mieDirectionalG={0.995}
          distance={4500}
          inclination={0.47}
          azimuth={180}
        />

        <group position={[0, 3.8 + MINUTE_YOFF, 0]}>
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

        <ambientLight intensity={0.35} />
        <hemisphereLight
          args={[0xffffff, 0x335533, 0.35]}
          position={[0, 1, 0]}
        />
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
          shadow-bias={-0.0005}
        />

        <Suspense fallback={null}>
          <group>
            <Ground radius={60} />
            <GrassField
              count={12000}
              areaRadius={60}
              bladeHeight={0.65}
              wind={0.8}
            />
            <Flowers gardenActive={overlayVisible} />
          </group>
        </Suspense>

        {myFlowerPos && <FocusPulse pos={myFlowerPos} />}

        {overlayVisible && (
          <OrbitControls
            ref={controlsRef}
            enableZoom
            enablePan={false}
            enableDamping
            dampingFactor={reducedMotion ? 0.03 : 0.08}
            rotateSpeed={reducedMotion ? 0.45 : 0.68}
            maxPolarAngle={Math.PI / 1.95}
            minPolarAngle={Math.PI / 3.0}
            minDistance={3.2}
            maxDistance={120}
            zoomSpeed={reducedMotion ? 0.7 : 1.0}
            onStart={() => (window.__orbitDragging = true)}
            onEnd={() => (window.__orbitDragging = false)}
            onChange={(e) => {
              const c = e?.target as OrbitControlsImpl | undefined;
              if (!c) return;
              const cam = c.object as THREE.PerspectiveCamera;
              if (cam.position.y < 1.6) cam.position.y = 1.6;
              if (c.target.y < 0.5) c.target.y = 0.5;
            }}
          />
        )}

        <PublishGlobals controlsRef={controlsRef} />

        {/* Audio ambiental del jardín */}
        <Html style={{ pointerEvents: "none" }}>
          {overlayVisible && (
            <div style={{ pointerEvents: "auto" }}>
              <AmbientAudio
                src="/audio/ambient.mp3"
                volume={0.16}
                fadeMs={360}
              />
            </div>
          )}
        </Html>

        {/* HUD y overlays 2D sobre la escena */}
        <Html fullscreen pointerEvents="none" zIndexRange={[50, 0]}>
          {overlayVisible && (
            <div style={{ pointerEvents: "auto" }}>
              <div
                id="overlay-root"
                style={{ position: "fixed", inset: 0, zIndex: 60 }}
              />
              <div
                id="hud-root"
                style={{
                  position: "fixed",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: "0px",
                  zIndex: 70,
                  pointerEvents: "none",
                }}
              />
              <div
                id="fx-root"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 75,
                  pointerEvents: "none",
                }}
              />
              {gardenActive && (
                <GardenHint key={hintEpoch} autoRotateMs={3200} />
              )}
              <GardenOverlay />
            </div>
          )}
        </Html>
      </MuteProvider>
    </Canvas>
  );
}
