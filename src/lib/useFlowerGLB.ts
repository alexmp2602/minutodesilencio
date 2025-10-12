import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export interface FlowerGLBData {
  geoms: THREE.BufferGeometry[];
  baseScale: number;
  loaded: boolean;
}

/**
 * Carga segura del modelo GLB de flor y extracción de sus geometrías.
 * Evita errores si el modelo aún no está disponible o la ruta es incorrecta.
 */
export function useFlowerGLB(
  url: string = "/models/flor3d_VERSIONPRUEBA.glb"
): FlowerGLBData {
  const gltf = useGLTF(url);

  return useMemo(() => {
    if (!gltf?.scene) {
      console.warn(
        "[useFlowerGLB] Modelo aún no cargado o no encontrado:",
        url
      );
      return { geoms: [], baseScale: 1, loaded: false };
    }

    const geoms: THREE.BufferGeometry[] = [];
    let minY = Infinity;
    let maxY = -Infinity;

    gltf.scene.traverse((obj: THREE.Object3D) => {
      // Type guard for Mesh
      if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).geometry) {
        const mesh = obj as THREE.Mesh;
        const geom = mesh.geometry.clone();
        geom.computeBoundingBox();
        const bb = geom.boundingBox;
        if (bb) {
          minY = Math.min(minY, bb.min.y);
          maxY = Math.max(maxY, bb.max.y);
        }
        geoms.push(geom);
      }
    });

    const height = Math.max(0.0001, maxY - minY);
    const baseScale = 1 / height;

    return { geoms, baseScale, loaded: true };
  }, [gltf, url]);
}

// Precarga preventiva (evita parpadeos)
useGLTF.preload("/models/flor3d_VERSIONPRUEBA.glb");
