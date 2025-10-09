// src/app/providers.tsx
"use client";

import * as React from "react";
import { SWRConfig } from "swr";
import { MuteProvider } from "@/hooks/useMute";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <React.StrictMode>
      <SWRConfig
        value={{
          // No forzamos fetcher global para no interferir con tu fetcher propio por recurso
          revalidateOnFocus: false,
          revalidateIfStale: true,
          revalidateOnReconnect: true,
          errorRetryCount: 2,
          errorRetryInterval: 2500,
          shouldRetryOnError: true,
          // Sugerencia: si querés activar suspense global más adelante:
          // suspense: true,
        }}
      >
        <MuteProvider>{children}</MuteProvider>
      </SWRConfig>
    </React.StrictMode>
  );
}
