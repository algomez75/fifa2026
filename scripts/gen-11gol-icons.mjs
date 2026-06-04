// Generates app icon / splash / adaptive / favicon from the 11 Gol logo.
// Requires sharp (install temporarily): npm i -D sharp && node scripts/gen-11gol-icons.mjs && npm uninstall sharp
import sharp from 'sharp';

const DIR = 'assets/images';
const LOGO = `${DIR}/fifaimages/11gol.png`;
const NAVY = { r: 10, g: 14, b: 26, alpha: 1 };   // #0A0E1A
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// trim the uniform white border around the sticker logo, keep transparency
async function logoBuf(scaleSize) {
  return sharp(LOGO)
    .trim({ threshold: 18 })
    .resize(scaleSize, scaleSize, { fit: 'contain', background: CLEAR })
    .toBuffer();
}

async function compose(size, bg, scale, out, flatten) {
  const inner = Math.round(size * scale);
  const logo = await logoBuf(inner);
  const meta = await sharp(logo).metadata();
  const left = Math.round((size - (meta.width || inner)) / 2);
  const top = Math.round((size - (meta.height || inner)) / 2);
  let img = sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: logo, left, top }]);
  if (flatten) img = img.flatten({ background: bg });
  await img.png().toFile(`${DIR}/${out}`);
  console.log(`✓ ${out} (${size}px)`);
}

await compose(1024, NAVY, 0.92, 'icon.png', true);                 // app icon
await compose(1024, CLEAR, 0.66, 'android-icon-foreground.png');   // adaptive fg
await compose(1024, NAVY, 1, 'android-icon-background.png', true);  // adaptive bg
await compose(1024, NAVY, 0.62, 'android-icon-monochrome.png');    // (reuse)
await compose(1024, CLEAR, 0.9, 'splash-icon.png');                // splash (on navy via app.json)
await compose(196, NAVY, 0.9, 'favicon.png', true);                // web favicon
console.log('Done.');
