// src/components/FlowerModel.tsx
"use client";
import React, { useMemo } from "react";
import type { JSX } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { GLTF } from "three-stdlib";

type Props = {
  position?: [number, number, number];
  scale?: number;
  rotationY?: number;
  tint?: string;
};

export default function FlowerModel({
  position = [0, 0, 0],
  scale = 1,
  rotationY = 0,
  tint,
}: Props): JSX.Element {
  const gltf = useGLTF("/models/flower.glb") as GLTF;
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useMemo(() => {
    cloned.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        obj.castShadow = true;
        obj.receiveShadow = true;
        m.roughness ??= 0.6;
        m.metalness ??= 0;
        if (tint) m.color = new THREE.Color(tint).convertSRGBToLinear();
      }
    });
  }, [cloned, tint]);

  return (
    <primitive
      object={cloned}
      position={position}
      rotation-y={rotationY}
      scale={scale}
    />
  );
}

useGLTF.preload("/models/flower.glb");
