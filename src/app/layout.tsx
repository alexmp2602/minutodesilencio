// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Fuente variable con display swap
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Viewport seguro (notch) + color de barra
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
  applicationName: "minutodesilencio",
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
        url: "/og.jpg", // 1200x630 en /public
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

  // —— Favicons / manifest ——
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [
      { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#8ad1ff" },
    ],
  },
  manifest: "/site.webmanifest",

  formatDetection: {
    telephone: false,
    date: false,
    email: false,
    address: false,
  },
  other: {
    "color-scheme": "dark light",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <head>
        {/* Preload de audios: tipo declarado para evitar warnings */}
        <link
          rel="preload"
          href="/ambience-soft.mp3"
          as="audio"
          type="audio/mpeg"
        />
        <link
          rel="preload"
          href="/ambience-nature.mp3"
          as="audio"
          type="audio/mpeg"
        />
      </head>
      <body
        className={`${inter.variable} antialiased h-full`}
        suppressHydrationWarning
      >
        <main>{children}</main>
      </body>
    </html>
  );
}
