import type { SourceImage } from '../engine/render';

/** Largest side we keep in memory; bigger photos are scaled down on load. */
const MAX_SOURCE_SIDE = 3200;

export async function loadImageFile(file: Blob): Promise<SourceImage> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  try {
    const probe = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(probe.width, probe.height));
    if (scale === 1) return { image: probe, width: probe.width, height: probe.height };
    const width = Math.round(probe.width * scale);
    const height = Math.round(probe.height * scale);
    probe.close();
    const bitmap = await createImageBitmap(file, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
    return { image: bitmap, width, height };
  } catch {
    // Older browsers: fall back to an <img> element.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return { image: img, width: img.naturalWidth, height: img.naturalHeight };
    } catch {
      throw new Error("Couldn't read that image.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** A built-in picture so the app shows something before you upload. */
export function createDemoImage(): SourceImage {
  const width = 1200;
  const height = 800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#0d1b3d');
  sky.addColorStop(0.55, '#4a2a6a');
  sky.addColorStop(1, '#f08a4b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Sun with soft rings.
  const sunX = width * 0.5;
  const sunY = height * 0.58;
  for (let i = 6; i >= 1; i--) {
    ctx.fillStyle = `rgba(255, 200, 120, ${0.05 * (7 - i)})`;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 150 + i * 38, 0, Math.PI * 2);
    ctx.fill();
  }
  const sun = ctx.createRadialGradient(sunX - 40, sunY - 50, 10, sunX, sunY, 170);
  sun.addColorStop(0, '#fffbe6');
  sun.addColorStop(0.5, '#ffd27a');
  sun.addColorStop(1, '#ff7a45');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 170, 0, Math.PI * 2);
  ctx.fill();

  // Layered hills.
  const hills: Array<[string, number, number, number]> = [
    ['#3b1f4f', 0.72, 60, 0.004],
    ['#24133a', 0.8, 45, 0.007],
    ['#120a20', 0.9, 30, 0.011],
  ];
  for (const [color, base, amp, freq] of hills) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 8) {
      const y = height * base - Math.sin(x * freq) * amp - Math.sin(x * freq * 2.7 + 1) * amp * 0.4;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }

  // Stars.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 180; i++) {
    const x = rand() * width;
    const y = rand() * height * 0.45;
    ctx.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.7})`;
    ctx.fillRect(x, y, 1 + rand() * 2.5, 1 + rand() * 2.5);
  }

  // Title.
  ctx.font = '700 120px ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255,180,120,0.8)';
  ctx.shadowBlur = 30;
  ctx.fillText('glyphcast', width / 2, height * 0.22);
  ctx.shadowBlur = 0;

  return { image: canvas, width, height };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
