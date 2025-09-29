// app/components/GrassField.tsx
"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

/** Interfaz local para el shader que recibimos en onBeforeCompile.
 *  Evita depender de THREE.Shader (que cambia entre typings). */
type GLSLShader = {
  uniforms: Record<string, THREE.IUniform<unknown>>;
  vertexShader: string;
  fragmentShader: string;
};

/** Misma función de relieves que usa tu Ground (aprox),
 *  para colocar cada brizna a la altura correcta */
function sampleHillHeight(x: number, z: number, size = 200, amplitude = 0.6) {
  const nx = x / (size / 2);
  const ny = z / (size / 2);
  let h =
    0.55 * Math.sin(nx * Math.PI * 0.9) * Math.cos(ny * Math.PI * 0.8) +
    0.28 * Math.sin((nx + ny) * Math.PI * 0.55) +
    0.18 * Math.cos((nx - ny) * Math.PI * 0.5);
  const r = Math.sqrt(nx * nx + ny * ny);
  const falloff = 1 - Math.min(1, Math.pow(r / 1.4, 2.2));
  h *= Math.max(0, falloff);
  return h * amplitude;
}

type Props = {
  count?: number; // cantidad de briznas (instancias)
  areaSize?: number; // tamaño del terreno a cubrir
  bladeHeight?: number; // altura media de hoja
  heightJitter?: number; // variación de altura
  wind?: number; // intensidad del viento
  seed?: number; // semilla RNG
};

export default function GrassField({
  count = 12000,
  areaSize = 200,
  bladeHeight = 0.6,
  heightJitter = 0.35,
  wind = 0.8,
  seed = 1,
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const shaderRef = useRef<GLSLShader | null>(null);

  // Geometría base: hoja con 5 segmentos verticales (curva más suave)
  const bladeGeom = useMemo(() => {
    const h = 1;
    const w = 0.045;
    const segments = 5;
    const geom = new THREE.PlaneGeometry(w, h, 1, segments);
    geom.translate(0, h / 2, 0); // que y=0 sea la base
    return geom;
  }, []);

  // Material con bend y viento (guardamos el shader en un ref)
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#6ea43e"),
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    m.onBeforeCompile = (shader) => {
      // uniforms para animación
      (shader.uniforms as GLSLShader["uniforms"]).uTime = { value: 0 };
      (shader.uniforms as GLSLShader["uniforms"]).uWind = { value: wind };

      shader.vertexShader =
        `
        uniform float uTime;
        uniform float uWind;
        attribute float aScale;
        attribute float aPhase;
        varying float vY;
        varying float vBend;
        ` +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `
          #include <begin_vertex>
          vY = position.y;

          float sway = sin( (uTime*0.8) + aPhase*6.2831 + position.y*1.2 ) * 0.6;
          float gust = sin( (uTime*0.2) + aPhase*12.0 ) * 0.4;
          float bend = (sway + gust) * uWind;
          vBend = bend;

          transformed.x += bend * pow(vY, 1.5);
          transformed.z += bend * 0.6 * pow(vY, 1.8);
          transformed.y *= aScale;
        `
        );

      shader.fragmentShader =
        `
        varying float vY;
        varying float vBend;
        ` +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `
          // leve gradiente vertical en las hojas
          diffuseColor.rgb *= mix(vec3(0.95, 0.97, 0.95), vec3(1.05, 1.08, 1.04), clamp(vY, 0.0, 1.0));
          #include <color_fragment>
        `
        );

      shaderRef.current = shader as GLSLShader;
      m.customProgramCacheKey = () => "grass-bend-v1";
    };

    return m;
  }, [wind]);

  // Buffers por instancia
  const { aScale, aPhase, matrices } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const aScale = new Float32Array(count);
    const aPhase = new Float32Array(count);
    const matrices: THREE.Matrix4[] = new Array(count);

    const rng = (function (seed0: number) {
      let s = seed0 % 2147483647;
      if (s <= 0) s += 2147483646;
      return () => (s = (s * 16807) % 2147483647) / 2147483647;
    })(seed);

    for (let i = 0; i < count; i++) {
      const x = (rng() - 0.5) * areaSize;
      const z = (rng() - 0.5) * areaSize;
      const y = sampleHillHeight(x, z, areaSize, 0.6);

      aScale[i] = bladeHeight * (1.0 + (rng() - 0.5) * heightJitter * 2.0);
      const rotY = rng() * Math.PI * 2;

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.updateMatrix();
      matrices[i] = dummy.matrix.clone();

      aPhase[i] = rng();
    }

    return { aScale, aPhase, matrices };
  }, [count, areaSize, bladeHeight, heightJitter, seed]);

  // Asignar matrices y atributos al InstancedMesh
  const setAttributes = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, matrices[i]);
    mesh.instanceMatrix.needsUpdate = true;

    // geometry es BufferGeometry, pero aceptará atributos instanciados
    const g = mesh.geometry as unknown as THREE.InstancedBufferGeometry;
    g.setAttribute("aScale", new THREE.InstancedBufferAttribute(aScale, 1));
    g.setAttribute("aPhase", new THREE.InstancedBufferAttribute(aPhase, 1));
  };

  // Animación del viento (uTime)
  useFrame(({ clock }) => {
    const sh = shaderRef.current;
    if (sh?.uniforms?.uTime) {
      (sh.uniforms.uTime as THREE.IUniform<number>).value =
        clock.getElapsedTime();
    }
  });

  return (
    <instancedMesh
      ref={(m) => {
        meshRef.current = m as THREE.InstancedMesh;
        setAttributes(m as THREE.InstancedMesh);
      }}
      args={[bladeGeom, material, count]}
      castShadow={false}
      receiveShadow
      frustumCulled={false}
    />
  );
}
