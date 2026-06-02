// Generates app icon / splash / favicon / adaptive icons from the provided
// WC26 brand art.
// `sharp` is intentionally NOT a project dependency (it's a heavy native module
// that breaks EAS builds). Install it only when regenerating icons:
//   npm i -D sharp && node scripts/gen-icons.mjs && npm uninstall sharp
import sharp from 'sharp';

const DIR = 'assets/images';
const MARK = `${DIR}/fifaimages/shopping.webp`; // gold "26 + trophy" on black
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

async function canvas(size, bg, markScale, out) {
  const inner = Math.round(size * markScale);
  const mark = await sharp(MARK)
    .resize(inner, inner, { fit: 'contain', background: CLEAR })
    .toBuffer();
  const pad = Math.round((size - inner) / 2);
  const opaque = bg.alpha === 1;
  let img = sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  }).composite([{ input: mark, top: pad, left: pad }]);
  if (opaque) img = img.flatten({ background: bg });
  await img.png().toFile(`${DIR}/${out}`);
  console.log(`✓ ${out} (${size}px)`);
}

await canvas(1024, BLACK, 0.86, 'icon.png');
await canvas(1024, CLEAR, 0.6, 'android-icon-foreground.png');
await canvas(1024, CLEAR, 0.6, 'android-icon-monochrome.png');
await canvas(1024, BLACK, 1, 'android-icon-background.png');
await canvas(1024, CLEAR, 0.92, 'splash-icon.png');
await canvas(196, BLACK, 0.9, 'favicon.png');

console.log('Done.');
