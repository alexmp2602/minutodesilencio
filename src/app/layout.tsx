// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Open_Sans, Lekton, Cormorant_Garamond } from "next/font/google";
import Providers from "./providers";

const openSans = Open_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
});
const lekton = Lekton({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-lekton",
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0d10",
};

const siteUrl = "https://minutodesilencio.vercel.app";
const siteName = "Minuto de Silencio";
const ogImage = "/minutodesilencio.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: { default: siteName, template: "%s · Minuto de Silencio" },
  description:
    "Un ritual interactivo de 60 segundos y un jardín 3D hecho con Next.js, R3F y Supabase.",
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
      { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#0b0d10" },
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
      "Un ritual interactivo de 60 segundos y un jardín 3D hecho con Next.js, R3F y Supabase.",
    images: [{ url: ogImage, alt: siteName }],
    locale: "es_AR",
  },

  twitter: {
    card: "summary_large_image",
    title: siteName,
    description:
      "Un ritual interactivo de 60 segundos y un jardín 3D hecho con Next.js, R3F y Supabase.",
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
          openSans.variable,
          lekton.variable,
          cormorant.variable,
          "antialiased h-full",
        ].join(" ")}
        suppressHydrationWarning
      >
        <Providers>
          <main id="main">{children}</main>
        </Providers>
        <div id="overlay-root" />
      </body>
    </html>
  );
}
