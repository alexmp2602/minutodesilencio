// scripts/gen-icons.ts
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "public", "minutodesilencio.png");
const OUT = path.join(ROOT, "public");

type Job = {
  out: string;
  size: number | { w: number; h: number };
  opts?: sharp.SharpOptions;
  fit?: keyof typeof sharp.fit;
  bg?: string;
  format?: "png" | "jpg";
};

const jobs: Job[] = [
  // Open Graph (16:9) – partiendo de cuadrado, hacemos cover
  {
    out: "og.jpg",
    size: { w: 1200, h: 630 },
    fit: "cover",
    format: "jpg",
    bg: "#0b0d10",
  },

  // Apple + PWA
  { out: "apple-touch-icon.png", size: 180 },
  { out: "android-chrome-192x192.png", size: 192 },
  { out: "android-chrome-512x512.png", size: 512 },

  // Favicons PNG
  { out: "favicon-32x32.png", size: 32 },
  { out: "favicon-16x16.png", size: 16 },
];

// Utilidades
function outPath(name: string) {
  return path.join(OUT, name);
}
async function ensureSrc() {
  try {
    await fs.access(SRC);
  } catch {
    throw new Error(`No se encontró imagen fuente en ${SRC}`);
  }
}

async function run() {
  await ensureSrc();

  // Generar PNG/JPG
  for (const job of jobs) {
    const target = outPath(job.out);
    const fit = job.fit ?? "contain";
    const bg = job.bg ?? "#0b0d10";

    const instance = sharp(SRC, job.opts);

    if (typeof job.size === "number") {
      instance.resize(job.size, job.size, { fit, background: bg });
    } else {
      instance.resize(job.size.w, job.size.h, { fit, background: bg });
    }

    if (job.format === "jpg") {
      await instance.jpeg({ quality: 92 }).toFile(target);
    } else {
      await instance.png({ compressionLevel: 9 }).toFile(target);
    }
    console.log("✓", job.out);
  }

  // Generar favicon.ico (16,32,48) a partir de PNGs
  const tmp16 = await sharp(SRC).resize(16, 16).png().toBuffer();
  const tmp32 = await sharp(SRC).resize(32, 32).png().toBuffer();
  const tmp48 = await sharp(SRC).resize(48, 48).png().toBuffer();
  const ico = await pngToIco([tmp16, tmp32, tmp48]);
  await fs.writeFile(outPath("favicon.ico"), ico);
  console.log("✓ favicon.ico");

  // Opcional: maskable icon (PWA)
  const maskable = await sharp(SRC)
    .resize(512, 512, { fit: "contain", background: "#0b0d10" })
    .png()
    .toBuffer();
  await fs.writeFile(outPath("android-chrome-512x512-maskable.png"), maskable);
  console.log("✓ android-chrome-512x512-maskable.png");

  console.log("\nListo. Todos los assets fueron regenerados en /public");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
