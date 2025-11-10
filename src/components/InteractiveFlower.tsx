"use client";

import * as THREE from "three";
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

/* ------- knobs de encuadre ------- */
const FIT_HEIGHT = 1.5; // ↓ si aún se corta; ↑ si queda chico
const OFFSET_Y = -1; // mueve todo el grupo hacia abajo/arriba

/* ---------------- tipos ---------------- */
type Dyn = { falling: boolean; vel: THREE.Vector3; av: THREE.Vector3 };
type Props = {
  url?: string;
  scale?: number;
  position?: [number, number, number];
  onHint?: (show: boolean) => void;
};

const GRAVITY = -9.8;
const FLOOR_Y = 0;

/* --------------- helpers 3D --------------- */
const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;

const makeMat = (color: string) =>
  new THREE.MeshStandardMaterial({
    color,
    metalness: 0.1,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });

function sanitizeMesh(m: THREE.Mesh, name: string) {
  const isTallo = /^tallo$/i.test(name);
  const isParte = /^partedelmedio$/i.test(name);
  const isPetalo = /^petalo[1-6]$/i.test(name);
  m.material = makeMat(
    isTallo ? "#3c3c3c" : isParte ? "#fafafa" : isPetalo ? "#ffffff" : "#dddddd"
  );
}

function cloneMeshes(n: THREE.Object3D) {
  const out: THREE.Mesh[] = [];
  n.traverse((o) => {
    if (isMesh(o)) {
      const c = o.clone(true);
      sanitizeMesh(c, o.name ?? "");
      out.push(c);
    }
  });
  return out;
}

/** centra X/Z, apoya base en Y=0, escala y aplica offset */
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
const isPetal = (n: string) => /^petalo[1-6]$/i.test(n);

/* --------------- núcleo flor --------------- */
function FlowerMesh({
  url,
  scale,
  position,
  onHint,
}: Required<Pick<Props, "url" | "scale" | "position">> & {
  onHint?: (s: boolean) => void;
}) {
  const wrapperRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const [dyn, setDyn] = useState<Record<string, Dyn>>({});
  const [hovered, setHovered] = useState(false);
  const petals = useRef<Set<string>>(new Set());

  const model = useMemo(() => {
    const g = new THREE.Group();
    let any = false;

    for (const key of EXPECTED) {
      const n = scene.getObjectByName(key);
      if (!n) continue;
      cloneMeshes(n).forEach((m) => g.add(m));
      any = true;
    }
    if (!any) {
      scene.traverse((o) => {
        if (isMesh(o)) {
          const c = o.clone(true);
          sanitizeMesh(c, o.name ?? "");
          g.add(c);
        }
      });
    }

    fitAndCenter(g, FIT_HEIGHT, OFFSET_Y);
    return g;
  }, [scene]);

  useEffect(() => {
    const set = new Set<string>();
    model.traverse((o) => {
      if (isMesh(o) && (isPetal(o.name) || !/^tallo$/i.test(o.name)))
        set.add(o.uuid);
    });
    petals.current = set;
  }, [model]);

  useFrame((_, dt) => {
    const g = wrapperRef.current;
    if (!g) return;
    g.scale.setScalar(
      THREE.MathUtils.lerp(g.scale.x, hovered ? 1.06 : 1, 0.18)
    );

    model.traverse((p) => {
      if (!isMesh(p)) return;
      const d = dyn[p.uuid];
      if (!d?.falling) return;

      d.vel.y += GRAVITY * dt * 0.6;
      p.position.addScaledVector(d.vel, dt);
      const dq = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(d.av.x * dt, d.av.y * dt, d.av.z * dt)
      );
      p.quaternion.multiply(dq);

      if (p.position.y <= FLOOR_Y) {
        p.position.y = FLOOR_Y;
        d.vel.set(0, 0, 0);
        d.av.set(0, 0, 0);
        setDyn((prev) => ({ ...prev, [p.uuid]: { ...d, falling: false } }));
      }
    });
  });

  const onOver = () => {
    setHovered(true);
    onHint?.(true);
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    setHovered(false);
    onHint?.(false);
    document.body.style.cursor = "auto";
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const obj = e.object;
    if (!petals.current.has(obj.uuid)) return;
    setDyn((prev) => ({
      ...prev,
      [obj.uuid]: {
        falling: true,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.4,
          2.0 + Math.random() * 1.0,
          (Math.random() - 0.5) * 0.4
        ),
        av: new THREE.Vector3(Math.random(), Math.random(), Math.random()),
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

/* --------------- canvas contenedor --------------- */
export default function InteractiveFlower({
  url = "/models/InteractiveFlower.glb",
  scale = 1,
  position = [0, 0, 0],
  onHint,
}: Props) {
  return (
    <Canvas
      style={{
        width: "min(420px, 50vw)",
        height: "min(420px, 50vw)",
        cursor: "pointer",
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
      />
    </Canvas>
  );
}

useGLTF.preload("/models/InteractiveFlower.glb");
