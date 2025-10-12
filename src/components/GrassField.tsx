"use client";

import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

/** Interfaz local para el shader que recibimos en onBeforeCompile */
type GLSLShader = {
  uniforms: Record<string, THREE.IUniform<unknown>>;
  vertexShader: string;
  fragmentShader: string;
};

/* ===========================
   RNG determinístico ligero
   =========================== */
function mulberry32(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Misma función de relieve que usa Ground (aprox) */
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
  /** Cantidad de instancias de pasto */
  count?: number;
  /** Largo del lado del terreno (debe coincidir con Ground.size) */
  terrainSize?: number;
  /** Amplitud del relieve (debe coincidir con Ground.amplitude) */
  terrainAmplitude?: number;
  /** Área cuadrada donde se distribuyen las hierbas (centrado en 0,0).
      Si no se especifica, usa terrainSize. */
  areaSize?: number;
  /** Altura media de la hoja */
  bladeHeight?: number;
  /** Variación relativa de altura */
  heightJitter?: number;
  /** Intensidad del viento */
  wind?: number;
  /** Semilla RNG para posiciones/fases determinísticas */
  seed?: number;
  /** Color base de hojas (sRGB) */
  color?: string | number | THREE.Color;
};

export default function GrassField({
  count = 12000,
  terrainSize = 200,
  terrainAmplitude = 0.6,
  areaSize,
  bladeHeight = 0.6,
  heightJitter = 0.35,
  wind = 0.8,
  seed = 1,
  color = "#6ea43e",
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const shaderRef = useRef<GLSLShader | null>(null);

  /* =========
     Geometría base (hoja con 5 segmentos verticales)
     ========= */
  const bladeGeom = useMemo(() => {
    const h = 1;
    const w = 0.045;
    const segments = 5;
    const geom = new THREE.PlaneGeometry(w, h, 1, segments);
    geom.translate(0, h / 2, 0); // que y=0 sea la base
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    return geom;
  }, []);

  /* =========
     Material con bend y viento (guardamos shader)
     ========= */
  const material = useMemo(() => {
    const col = new THREE.Color(color as string | number | THREE.Color);
    const m = new THREE.MeshStandardMaterial({
      color: col, // sRGB → linear via renderer
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
      vertexColors: false, // ❗ fuera: no usamos instanceColor con r180
      toneMapped: true,
    });

    m.onBeforeCompile = (shader) => {
      (shader.uniforms as GLSLShader["uniforms"]).uTime = { value: 0 };
      (shader.uniforms as GLSLShader["uniforms"]).uWind = { value: wind };

      shader.vertexShader =
        `
        uniform float uTime;
        uniform float uWind;
        attribute float aScale;
        attribute float aPhase;
        varying float vY;
        varying float vPhase;
        ` +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `
          #include <begin_vertex>
          vY = position.y;
          vPhase = aPhase;

          float sway = sin( (uTime*0.8) + aPhase*6.2831 + position.y*1.2 ) * 0.6;
          float gust = sin( (uTime*0.2) + aPhase*12.0 ) * 0.4;
          float bend = (sway + gust) * uWind;

          transformed.x += bend * pow(vY, 1.5);
          transformed.z += bend * 0.6 * pow(vY, 1.8);
          transformed.y *= aScale;
        `
        );

      shader.fragmentShader =
        `
        varying float vY;
        varying float vPhase;
        ` +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `
          // gradiente vertical leve
          diffuseColor.rgb *= mix(vec3(0.95, 0.97, 0.95),
                                  vec3(1.05, 1.08, 1.04),
                                  clamp(vY, 0.0, 1.0));

          // variación cromática por instancia (sin instanceColor)
          // ±6% alrededor del color base, determinístico por vPhase
          float jitter = 1.0 + (fract(sin(vPhase*43758.5453)*43758.5453) - 0.5) * 0.12;
          diffuseColor.rgb *= jitter;

          #include <color_fragment>
        `
        );

      shaderRef.current = shader as GLSLShader;

      // Forzar recompilación si cambia la "forma" del programa
      const key = `grass-bend-${wind.toFixed(3)}`;
      m.customProgramCacheKey = () => key;
    };

    return m;
  }, [color, wind]);

  /* =========
     Buffers y matrices por instancia (determinísticos)
     ========= */
  const { aScale, aPhase, matrices } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const aScale = new Float32Array(count);
    const aPhase = new Float32Array(count);
    const matrices: THREE.Matrix4[] = new Array(count);

    const rng = mulberry32(seed);
    const span = areaSize ?? terrainSize; // lado del cuadrado de distribución

    for (let i = 0; i < count; i++) {
      const x = (rng() - 0.5) * span;
      const z = (rng() - 0.5) * span;
      const y = sampleHillHeight(x, z, terrainSize, terrainAmplitude);

      aScale[i] = bladeHeight * (1.0 + (rng() - 0.5) * heightJitter * 2.0);
      const rotY = rng() * Math.PI * 2;

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.updateMatrix();
      matrices[i] = dummy.matrix.clone();

      aPhase[i] = rng();
    }

    return { aScale, aPhase, matrices };
  }, [
    count,
    terrainSize,
    terrainAmplitude,
    areaSize,
    bladeHeight,
    heightJitter,
    seed,
  ]);

  // Helper para aplicar atributos a un instanced mesh ya montado
  const applyInstancedAttributes = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;

    // matrices
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, matrices[i]);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    // atributos custom
    const g = mesh.geometry as THREE.InstancedBufferGeometry;
    g.setAttribute("aScale", new THREE.InstancedBufferAttribute(aScale, 1));
    g.setAttribute("aPhase", new THREE.InstancedBufferAttribute(aPhase, 1));
    (g.getAttribute("aScale") as THREE.BufferAttribute).setUsage(
      THREE.StaticDrawUsage
    );
    (g.getAttribute("aPhase") as THREE.BufferAttribute).setUsage(
      THREE.StaticDrawUsage
    );
  };

  // Reaplicar atributos si cambian dependencias
  useEffect(() => {
    if (meshRef.current) applyInstancedAttributes(meshRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aScale, aPhase, matrices, count]);

  /* =========
     Animación del viento (uTime) + update de uWind en caliente
     ========= */
  useFrame(({ clock }) => {
    const sh = shaderRef.current;
    if (!sh?.uniforms) return;
    (sh.uniforms.uTime as THREE.IUniform<number> | undefined)!.value =
      clock.getElapsedTime();
    const uW = sh.uniforms.uWind as THREE.IUniform<number> | undefined;
    if (uW && typeof uW.value === "number" && uW.value !== wind) {
      uW.value = wind;
    }
  });

  // Limpieza de recursos
  useEffect(() => {
    return () => {
      bladeGeom.dispose();
      material.dispose();
    };
  }, [bladeGeom, material]);

  return (
    <instancedMesh
      ref={(m) => {
        meshRef.current = m as THREE.InstancedMesh | null;
        applyInstancedAttributes(m as THREE.InstancedMesh | null);
      }}
      key={`grass-${count}-${terrainSize}-${areaSize ?? terrainSize}-${seed}`}
      args={[bladeGeom, material, count]}
      castShadow={false}
      receiveShadow
      frustumCulled={false}
      renderOrder={1}
    />
  );
}
