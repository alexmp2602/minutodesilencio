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
};

const PETAL = new THREE.Color("#FBDDF5").convertSRGBToLinear();
const STEM = new THREE.Color("#036200").convertSRGBToLinear();

function isPetalName(name?: string) {
  if (!name) return false;
  const n = name.toLowerCase();
  return /(petal|petalo|petalón|flower_top|blossom|flor|corola)/.test(n);
}
function isStemName(name?: string) {
  if (!name) return false;
  const n = name.toLowerCase();
  return /(stem|tallo|stalk|tronco|peduncle)/.test(n);
}

export default function FlowerModel({
  position = [0, 0, 0],
  scale = 1,
  rotationY = 0,
}: Props): JSX.Element {
  const gltf = useGLTF("/models/flower.glb") as GLTF;

  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.updateMatrixWorld(true);

    // Heurística de materiales
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Normalizar material
      const mat = (mesh.material ??
        new THREE.MeshStandardMaterial()) as THREE.MeshStandardMaterial;
      mesh.material = mat;
      mat.roughness ??= 0.6;
      mat.metalness ??= 0.02;

      const byMesh = isPetalName(mesh.name);
      const byMat = isPetalName(mat.name);
      const petal = byMesh || byMat;

      const byMeshStem = isStemName(mesh.name);
      const byMatStem = isStemName(mat.name);
      const stem = byMeshStem || byMatStem;

      // Fallback geométrico (por si el GLB no tiene nombres)
      if (!petal && !stem && mesh.geometry?.boundingBox == null) {
        mesh.geometry?.computeBoundingBox();
      }
      const bb = mesh.geometry?.boundingBox ?? null;
      const aspect = bb
        ? (bb.max.y - bb.min.y) / Math.max(0.0001, bb.max.x - bb.min.x)
        : 1;

      if (petal || (!stem && aspect < 1.2)) {
        mat.color = PETAL.clone();
      } else if (stem || aspect >= 1.2) {
        mat.color = STEM.clone();
      } else {
        mat.color = PETAL.clone(); // último recurso
      }
    });

    return cloned;
  }, [gltf.scene]);

  return (
    <primitive
      object={scene}
      position={position}
      rotation-y={rotationY}
      scale={scale}
    />
  );
}

useGLTF.preload("/models/flower.glb");
