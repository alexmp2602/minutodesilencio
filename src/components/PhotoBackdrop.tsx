"use client";

import * as THREE from "three";
import { useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";

/**
 * Muestra una imagen de fondo “pegada” a cámara:
 * no se ve afectada por luces, no tiene profundidad,
 * y siempre llena la vista (como en el Figma).
 */
export default function PhotoBackdrop({ url = "/bg-hills.webp" }) {
  const tex = useTexture(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const mesh = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!mesh.current) return;
    // Orientada a la cámara
    mesh.current.quaternion.copy(camera.quaternion);
    // A una distancia fija delante de la cámara
    const dist = 50;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    mesh.current.position.copy(camera.position).add(dir.multiplyScalar(dist));
    // Escala para cubrir el FOV
    let h: number, w: number;
    if ("fov" in camera) {
      // PerspectiveCamera
      h = 2 * Math.tan((camera.fov * Math.PI) / 180 / 2) * dist;
      w = h * camera.aspect;
    } else if (
      "top" in camera &&
      "bottom" in camera &&
      "left" in camera &&
      "right" in camera
    ) {
      // OrthographicCamera
      h = Math.abs(camera.top - camera.bottom);
      w = Math.abs(camera.right - camera.left);
    } else {
      // Default fallback
      h = 1;
      w = 1;
    }
    mesh.current.scale.set(w, h, 1);
  });

  return (
    <mesh ref={mesh} renderOrder={-999}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} depthWrite={false} />
    </mesh>
  );
}
