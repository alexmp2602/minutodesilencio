import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "minutodesilencio",
    template: "%s · minutodesilencio",
  },
  description:
    "Experiencia interactiva de jardín 3D con Next.js, R3F y Supabase.",
  metadataBase: new URL("https://minutodesilencio.vercel.app/"),
  openGraph: {
    title: "minutodesilencio",
    description:
      "Experiencia interactiva de jardín 3D con Next.js, R3F y Supabase.",
    type: "website",
  },
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <main>{children}</main>
      </body>
    </html>
  );
}
