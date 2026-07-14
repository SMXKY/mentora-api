/**
 * Downloads real photos (not synthetic stubs) for the 5 real-tutor k6
 * fixtures — 3 per tutor (CNI front, CNI back, selfie) from picsum.photos
 * (free, no attribution required). Run once before seed-kyc-real-tutors.ts.
 *
 * Run: ts-node k6/support/fetch-real-tutor-photos.ts
 */
import fs from "fs";
import path from "path";
import axios from "axios";

const SHOTS: Array<{ file: string; url: string }[]> = [];

for (let t = 1; t <= 5; t++) {
  SHOTS.push([
    { file: "cni-front.jpg", url: `https://picsum.photos/seed/mentora-cni-front-${t}/1000/700.jpg` },
    { file: "cni-back.jpg", url: `https://picsum.photos/seed/mentora-cni-back-${t}/1000/700.jpg` },
    { file: "selfie.jpg", url: `https://picsum.photos/seed/mentora-selfie-${t}/900/900.jpg` },
  ]);
}

async function download(url: string, destPath: string): Promise<void> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxRedirects: 5,
  });
  fs.writeFileSync(destPath, Buffer.from(res.data));
}

async function main(): Promise<void> {
  const root = path.join(__dirname, "..", "fixtures", "real-tutors");
  for (let t = 1; t <= 5; t++) {
    const dir = path.join(root, `tutor-${t}`);
    fs.mkdirSync(dir, { recursive: true });
    for (const shot of SHOTS[t - 1]) {
      const dest = path.join(dir, shot.file);
      await download(shot.url, dest);
      const size = fs.statSync(dest).size;
      console.log(JSON.stringify({ event: "photo_downloaded", tutor: t, file: shot.file, bytes: size }));
    }
  }
}

main().catch((err) => {
  console.error("Photo download failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
