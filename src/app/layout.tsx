// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import CursorGlow from "@/components/ui/CursorGlow";

import { DM_Mono } from "next/font/google";
import localFont from "next/font/local";

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
  variable: "--font-mono",
});

const edwardian = localFont({
  src: "/fonts/edwardianscriptitc.ttf",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-script",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1227e6",
};

const siteUrl = "https://minutodesilencio.vercel.app";
const siteName = "Minuto de Silencio";
const ogImage = "/minutodesilencio.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: { default: siteName, template: "%s · Minuto de Silencio" },
  description:
    "Un ritual interactivo y un jardín 3D. Hecho con Next.js, R3F y Supabase.",
  alternates: { canonical: siteUrl + "/" },
  other: { "color-scheme": "dark light" },

  manifest: "/site.webmanifest",

  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#1227e6" },
    ],
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteName,
  },

  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title: siteName,
    description:
      "Un ritual interactivo y un jardín 3D. Hecho con Next.js, R3F y Supabase.",
    images: [{ url: ogImage, alt: siteName }],
    locale: "es_AR",
  },

  twitter: {
    card: "summary_large_image",
    title: siteName,
    description:
      "Un ritual interactivo y un jardín 3D. Hecho con Next.js, R3F y Supabase.",
    images: [ogImage],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR" dir="ltr" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="prefetch" href="/audio/plant.mp3" crossOrigin="anonymous" />
        <meta name="color-scheme" content="dark light" />
      </head>
      <body
        className={[
          dmMono.variable,
          edwardian.variable,
          "antialiased h-full",
        ].join(" ")}
        suppressHydrationWarning
      >
        <Providers>
          <main id="main">{children}</main>
        </Providers>
        <CursorGlow />
        <div id="overlay-root" />
      </body>
    </html>
  );
}
