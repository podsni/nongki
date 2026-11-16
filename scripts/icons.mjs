// Generate Nongki icons (favicon.ico, apple-icon, PWA icons) from one SVG source.
// Run: node scripts/icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const mark = (s = 1, dx = 0, dy = 0) => `
<g transform="translate(${dx} ${dy}) scale(${s})" stroke-linecap="round" stroke-linejoin="round">
  <g fill="none" stroke="#c8864b" stroke-width="30">
    <path d="M196.4 196.4A56 56 0 0 1 275.6 196.4"/>
    <path d="M162.5 162.5A104 104 0 0 1 309.5 162.5"/>
    <path d="M128.5 128.5A152 152 0 0 1 343.5 128.5"/>
  </g>
  <path d="M132 256H340V316C340 376 296 420 236 420C176 420 132 376 132 316Z" fill="#fbf7f2"/>
  <path d="M340 276H360C384 276 400 292 400 316C400 340 384 356 360 356H338" fill="none" stroke="#fbf7f2" stroke-width="26"/>
  <rect x="112" y="440" width="268" height="22" rx="11" fill="#eadccb"/>
</g>`;

export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="116" fill="#2b1a12"/>${mark(1, 18, -10)}</svg>`;
// Full-bleed with content inside the 80% maskable safe zone.
const FULL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#2b1a12"/>${mark(0.74, 84, 62)}</svg>`;

const png = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

writeFileSync("app/icon.svg", ICON_SVG);
writeFileSync("public/icons/icon-192.png", await png(ICON_SVG, 192));
writeFileSync("public/icons/icon-512.png", await png(ICON_SVG, 512));
writeFileSync("public/icons/maskable-192.png", await png(FULL_SVG, 192));
writeFileSync("public/icons/maskable-512.png", await png(FULL_SVG, 512));
writeFileSync("app/apple-icon.png", await png(FULL_SVG, 180));

// favicon.ico with embedded PNG frames (16, 32, 48)
const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map((s) => png(ICON_SVG, s)));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt8(0, e + 2);
  header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(frames[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += frames[i].length;
});
writeFileSync("app/favicon.ico", Buffer.concat([header, ...frames]));
console.log("icons ok");
