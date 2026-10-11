import type { ArtRect } from "./MenuArtLayout";

/** Resolve stroke coverage once at the final pixel size, then draw a hard mask 1:1. */
export function sharpBitmap(source: CanvasImageSource, color?: string): (context: CanvasRenderingContext2D, frame: ArtRect, destination: ArtRect) => void {
  const cache = new Map<string, HTMLCanvasElement>();
  const rasterize = (frame: ArtRect, width: number, height: number): HTMLCanvasElement => {
    const key = `${frame.x},${frame.y},${frame.width},${frame.height}:${width},${height}`;
    let raster = cache.get(key);
    if (!raster) {
      raster = document.createElement("canvas"); raster.width = width; raster.height = height;
      // This tiny canvas is read immediately once. Keep it on the CPU to avoid
      // flushing GPU work for every newly encountered character.
      const target = raster.getContext("2d", { willReadFrequently: true })!;
      // Coverage resampling prevents nearest-neighbor decimation from dropping
      // a thin stroke. Only this offscreen step uses interpolation.
      target.imageSmoothingEnabled = true; target.imageSmoothingQuality = "high";
      target.drawImage(source, frame.x, frame.y, frame.width, frame.height, 0, 0, width, height);
      const pixels = target.getImageData(0, 0, width, height);
      for (let index = 3; index < pixels.data.length; index += 4) pixels.data[index] = pixels.data[index] >= 96 ? 255 : 0;
      target.putImageData(pixels, 0, 0);
      if (color) {
        target.globalCompositeOperation = "source-in";
        target.fillStyle = color;
        target.fillRect(0, 0, width, height);
        target.globalCompositeOperation = "source-over";
      }
      if (cache.size >= 512) cache.delete(cache.keys().next().value!);
      cache.set(key, raster);
    }
    return raster;
  };
  return (context, frame, destination): void => {
    const matrix = context.getTransform();
    // Rotated text retains its authored transform; current UI is axis-aligned.
    if (Math.abs(matrix.b) > 0.0001 || Math.abs(matrix.c) > 0.0001 || matrix.a <= 0 || matrix.d <= 0) {
      if (color) context.drawImage(rasterize(frame, Math.max(1, Math.ceil(frame.width)), Math.max(1, Math.ceil(frame.height))),
        destination.x, destination.y, destination.width, destination.height);
      else context.drawImage(source, frame.x, frame.y, frame.width, frame.height,
        destination.x, destination.y, destination.width, destination.height);
      return;
    }
    const x = Math.round(destination.x * matrix.a + matrix.e), y = Math.round(destination.y * matrix.d + matrix.f);
    const width = Math.max(1, Math.round((destination.x + destination.width) * matrix.a + matrix.e) - x);
    const height = Math.max(1, Math.round((destination.y + destination.height) * matrix.d + matrix.f) - y);
    const raster = rasterize(frame, width, height);
    context.save(); context.resetTransform(); context.imageSmoothingEnabled = false;
    context.drawImage(raster, x, y); context.restore();
  };
}
