// src/lib/threeLoaders.ts
"use client";

import type { WebGLRenderer } from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

/**
 * Manejamos una única instancia de KTX2Loader para toda la app.
 * Sin `any`, sin globals.
 */
let configured = false;
let ktx2Loader: KTX2Loader | null = null;

/**
 * Configura loaders modernos (por ahora, KTX2/BasisU).
 * - Si pasás un renderer, se llama a `detectSupport` (recomendado).
 * - Se puede invocar varias veces; sólo configura una vez.
 */
export function configureThreeLoaders(renderer?: WebGLRenderer): void {
  if (configured) return;

  // Si tenés los transcoders en /public/basis/, dejá este path.
  // Si no existen, KTX2Loader intentará usar el path por defecto de three/examples.
  const loader = new KTX2Loader().setTranscoderPath("/basis/");
  if (renderer) {
    loader.detectSupport(renderer);
  }

  ktx2Loader = loader;
  configured = true;
}

/**
 * Obtiene la instancia compartida del KTX2Loader (si se configuró).
 * Útil si en algún sitio necesitás engancharlo manualmente.
 */
export function getKTX2Loader(): KTX2Loader | null {
  return ktx2Loader;
}
