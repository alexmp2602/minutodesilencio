// src/components/InteractiveFlower.tsx
"use client";

import * as THREE from "three";
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

/* Ajuste de encuadre */
const FIT_HEIGHT = 1.5;
const OFFSET_Y = -0.9;

type Dyn = {
  falling: boolean;
  vel: THREE.Vector3;
  av: THREE.Vector3;
  swayAmp: number;
  swayFreq: number;
  phase: number;
};

type Props = {
  url?: string;
  scale?: number;
  position?: [number, number, number];
  onHint?: (show: boolean) => void;

  // Color principal de los pétalos
  petalColor?: string;
  // Color del centro
  centerColor?: string;
  // Color del tallo
  stemColor?: string;
  // Si es true el centro nunca se desprende
  centerSticky?: boolean;
  // Hace que la flor flote y gire levemente
  floatSpin?: boolean;
};

const GRAVITY = -2.4;
const FLOOR_Y = 0;

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;

function makeMat(color: string) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.05,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
}

const isStem = (name: string) => /^tallo$/i.test(name);
const isCenter = (name: string) => /^partedelmedio$/i.test(name);
const isPetal = (name: string) => /^petalo[1-6]$/i.test(name);

/**
 * Centra X/Z, apoya la base en Y=0, escala y aplica offset
 */
function fitAndCenter(
  root: THREE.Group,
  targetHeight = FIT_HEIGHT,
  offsetY = OFFSET_Y
) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;

  const after = new THREE.Box3().setFromObject(root);
  const afterSize = new THREE.Vector3();
  after.getSize(afterSize);
  const h = afterSize.y || 1;
  root.scale.setScalar(targetHeight / h);

  root.position.y += offsetY;
}

const EXPECTED = [
  "ParteDelMedio",
  "Petalo1",
  "Petalo2",
  "Petalo3",
  "Petalo4",
  "Petalo5",
  "Petalo6",
  "Tallo",
] as const;

/* Núcleo de la flor */
function FlowerMesh({
  url,
  scale,
  position,
  onHint,
  petalColor,
  centerColor,
  stemColor,
  centerSticky,
  floatSpin,
}: Required<
  Pick<
    Props,
    | "url"
    | "scale"
    | "position"
    | "petalColor"
    | "centerColor"
    | "stemColor"
    | "centerSticky"
    | "floatSpin"
  >
> & { onHint?: (s: boolean) => void }) {
  const wrapperRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const [dyn, setDyn] = useState<Record<string, Dyn>>({});
  const [hovered, setHovered] = useState(false);
  const petals = useRef<Set<string>>(new Set());
  const petalsOpenedRef = useRef(false);

  const model = useMemo(() => {
    const g = new THREE.Group();

    const stemMat = makeMat(stemColor);
    const centerMat = makeMat(centerColor);
    const petalMat = makeMat(petalColor);

    const attachMaterial = (m: THREE.Mesh, name: string) => {
      if (isStem(name)) m.material = stemMat;
      else if (isCenter(name)) m.material = centerMat;
      else if (isPetal(name)) m.material = petalMat;
      else m.material = petalMat;
    };

    let any = false;
    for (const key of EXPECTED) {
      const n = scene.getObjectByName(key);
      if (!n) continue;
      n.traverse((o) => {
        if (!isMesh(o)) return;
        const c = o.clone(true);
        attachMaterial(c, o.name ?? "");
        g.add(c);
      });
      any = true;
    }

    if (!any) {
      scene.traverse((o) => {
        if (isMesh(o)) {
          const c = o.clone(true);
          attachMaterial(c, o.name ?? "");
          g.add(c);
        }
      });
    }

    fitAndCenter(g, FIT_HEIGHT, OFFSET_Y);
    return g;
  }, [scene, petalColor, centerColor, stemColor]);

  useEffect(() => {
    const set = new Set<string>();

    // Apertura leve de pétalos una sola vez
    if (!petalsOpenedRef.current) {
      model.traverse((o) => {
        if (!isMesh(o)) return;
        const name = o.name ?? "";
        if (isPetal(name)) {
          const v = new THREE.Vector3(o.position.x, 0, o.position.z);
          if (v.lengthSq() > 0.0001) {
            v.normalize().multiplyScalar(0.035);
            o.position.add(v);
          }
        }
      });
      petalsOpenedRef.current = true;
    }

    model.traverse((o) => {
      if (!isMesh(o)) return;
      const name = o.name ?? "";
      if (isPetal(name)) set.add(o.uuid);
      if (!centerSticky && isCenter(name)) set.add(o.uuid);
    });

    petals.current = set;
  }, [model, centerSticky]);

  const tRef = useRef(0);
  const baseYRef = useRef<number | null>(null);

  useFrame((_, dt) => {
    const g = wrapperRef.current;
    if (!g) return;

    tRef.current += dt;
    const t = tRef.current;

    // Flotar y girar la flor completa
    if (floatSpin) {
      if (baseYRef.current == null) baseYRef.current = g.position.y;
      const baseY = baseYRef.current!;
      g.position.y = baseY + Math.sin(t * 1.2) * 0.06;
      g.rotation.y += 0.12 * dt;
    }

    // Efecto hover (escala suave)
    g.scale.setScalar(
      THREE.MathUtils.lerp(g.scale.x, hovered ? 1.06 : 1, 0.18)
    );

    // Animación de pétalos que caen
    model.traverse((p) => {
      if (!isMesh(p)) return;
      const d = dyn[p.uuid];
      if (!d?.falling) return;

      d.vel.y += GRAVITY * dt;
      d.vel.multiplyScalar(0.985);
      p.position.addScaledVector(d.vel, dt);

      const swayX = Math.sin(t * d.swayFreq + d.phase) * d.swayAmp * dt * 10.0;
      const swayZ = Math.cos(t * d.swayFreq + d.phase) * d.swayAmp * dt * 10.0;
      p.position.x += swayX;
      p.position.z += swayZ;

      const dq = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(d.av.x * dt, d.av.y * dt, d.av.z * dt)
      );
      p.quaternion.multiply(dq);

      if (p.position.y <= FLOOR_Y) {
        p.position.y = FLOOR_Y;
        d.vel.set(0, 0, 0);
        d.av.set(0, 0, 0);
        d.swayAmp = 0;
        setDyn((prev) => ({ ...prev, [p.uuid]: { ...d, falling: false } }));
      }
    });
  });

  const onOver = () => {
    setHovered(true);
    onHint?.(true);
  };

  const onOut = () => {
    setHovered(false);
    onHint?.(false);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const obj = e.object;
    if (!petals.current.has(obj.uuid)) return;

    const swayAmp = 0.06 + Math.random() * 0.04;
    const swayFreq = 1.1 + Math.random() * 0.9;
    const phase = Math.random() * Math.PI * 2;

    setDyn((prev) => ({
      ...prev,
      [obj.uuid]: {
        falling: true,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.32,
          1.15 + Math.random() * 0.5,
          (Math.random() - 0.5) * 0.32
        ),
        av: new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8
        ),
        swayAmp,
        swayFreq,
        phase,
      },
    }));
  };

  return (
    <group ref={wrapperRef} scale={scale} position={position}>
      <primitive
        object={model}
        onPointerOver={onOver}
        onPointerOut={onOut}
        onClick={onClick}
      />
    </group>
  );
}

/* Canvas contenedor */
export default function InteractiveFlower({
  url = "/models/InteractiveFlower.glb",
  scale = 1,
  position = [0, 0, 0],
  onHint,
  petalColor = "#D095E7",
  stemColor = "#006D05",
  centerColor = "#FFF79B",
  centerSticky = true,
  floatSpin = true,
}: Props) {
  return (
    <Canvas
      style={{
        width: "min(420px, 50vw)",
        height: "min(420px, 50vw)",
      }}
      camera={{ position: [0, 1.25, 2.25], fov: 38, near: 0.05, far: 100 }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[2, 3, 3]} intensity={1.2} />
      <FlowerMesh
        url={url}
        scale={scale}
        position={(position ?? [0, 0, 0]) as [number, number, number]}
        onHint={onHint}
        petalColor={petalColor}
        centerColor={centerColor}
        stemColor={stemColor}
        centerSticky={centerSticky}
        floatSpin={floatSpin}
      />
    </Canvas>
  );
}

useGLTF.preload("/models/InteractiveFlower.glb");
