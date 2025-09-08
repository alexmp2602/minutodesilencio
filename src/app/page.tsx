import ThreeScene from "@/components/ThreeScene";
import dynamic from "next/dynamic";

// Cargar el ping solo en cliente (evita cualquier advertencia en SSR)
const SupabasePing = dynamic(() => import("@/components/SupabasePing"), {
  ssr: false,
});

export default function HomePage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Hola Mundo 3D</h1>
      <p style={{ marginBottom: "1rem" }}>
        Esto es un “smoke test” con react-three-fiber y Supabase.
      </p>
      <ThreeScene />
      <div style={{ marginTop: "1rem" }}>
        <SupabasePing />
      </div>
    </main>
  );
}
