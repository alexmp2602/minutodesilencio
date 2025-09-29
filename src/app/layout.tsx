// app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { Open_Sans, Lekton } from "next/font/google";

const catchy = localFont({
  src: [
    {
      path: "../../public/fonts/CatchyMager.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-catchy",
  display: "swap",
  preload: true,
});

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0d10",
};

const siteUrl = "https://minutodesilencio.vercel.app";
const siteName = "Minuto de Silencio";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: siteName,
    template: "%s · Minuto de Silencio",
  },
  description:
    "Un ritual interactivo de 60 segundos y un jardín 3D hecho con Next.js, R3F y Supabase.",
  alternates: {
    canonical: siteUrl + "/",
  },
  other: {
    "color-scheme": "dark light",
  },
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
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: siteName }],
    locale: "es_AR",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" dir="ltr" className="h-full">
      <head>
        {/* Preloads de assets críticos */}
        <link
          rel="preload"
          href="/ambience-soft.mp3"
          as="audio"
          type="audio/mpeg"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/ambience-nature.mp3"
          as="audio"
          type="audio/mpeg"
          crossOrigin="anonymous"
        />
        <link rel="preload" href="/og.jpg" as="image" type="image/jpeg" />

      </head>
      <body
        className={`${openSans.variable} ${catchy.variable} ${lekton.variable} antialiased h-full`}
        suppressHydrationWarning
      >
        {/* Enlace accesible para saltar al contenido */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:bg-white/90 focus:text-black focus:px-3 focus:py-2 focus:rounded"
        >
          Saltar al contenido
        </a>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
