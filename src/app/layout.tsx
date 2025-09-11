import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Fuente con display swap y variable CSS para futuras extensiones
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Viewport: notch safe, color de barra del navegador según tema
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0d10" },
    { media: "(prefers-color-scheme: light)", color: "#0b0d10" },
  ],
};

const siteUrl = "https://minutodesilencio.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "minutodesilencio",
    template: "%s · minutodesilencio",
  },
  description:
    "Un ritual interactivo en 60 segundos y un jardín 3D hecho con Next.js, R3F y Supabase.",
  keywords: [
    "minutodesilencio",
    "ritual",
    "arte interactivo",
    "three.js",
    "react-three-fiber",
    "Supabase",
    "Next.js",
  ],
  alternates: { canonical: siteUrl + "/" },
  openGraph: {
    type: "website",
    url: siteUrl + "/",
    siteName: "minutodesilencio",
    title: "minutodesilencio",
    description:
      "Un ritual interactivo en 60 segundos y un jardín 3D hecho con Next.js, R3F y Supabase.",
    images: [
      {
        url: "/og.jpg", // poné un 1200x630 en /public
        width: 1200,
        height: 630,
        alt: "minutodesilencio – ritual y jardín 3D",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "minutodesilencio",
    description:
      "Un ritual interactivo en 60 segundos y un jardín 3D hecho con Next.js, R3F y Supabase.",
    images: ["/og.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png" }], // opcional: 180x180 en /public
  },
  // Si vas a agregar un manifest PWA:
  // manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <body
        className={`${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        <main>{children}</main>
      </body>
    </html>
  );
}
