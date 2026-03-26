export interface ThumbnailCue {
  start: number;
  end: number;
  /** Absolute URL to the sprite image */
  url: string;
  /** Pixel offset from the left of the sprite sheet */
  x: number;
  /** Pixel offset from the top of the sprite sheet */
  y: number;
  /** Width of a single thumbnail cell */
  w: number;
  /** Height of a single thumbnail cell */
  h: number;
}

function parseVttTime(s: string): number {
  const parts = s.trim().split(":");
  if (parts.length === 3) {
    return +parts[0] * 3600 + +parts[1] * 60 + parseFloat(parts[2]);
  }
  return +parts[0] * 60 + parseFloat(parts[1]);
}

function resolveUrl(vttBase: string, url: string, absoluteRootBase?: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  // Root-absolute paths (starting with "/") are resolved against the origin by
  // new URL(), which strips any path prefix from the base. When the caller
  // provides an explicit absoluteRootBase (e.g. an S3 bucket sub-path), use
  // simple string concatenation instead so the prefix is preserved.
  if (url.startsWith("/") && absoluteRootBase) {
    return absoluteRootBase.replace(/\/+$/, "") + url;
  }
  try {
    return new URL(url, vttBase).href;
  } catch {
    return url;
  }
}

/**
 * Parse a WebVTT thumbnail track into an array of cues.
 *
 * Supports the standard sprite-sheet format:
 *   00:00:00.000 --> 00:00:05.000
 *   https://cdn.example.com/thumbs/s0.jpg#xywh=0,0,160,90
 *
 * @param text    Raw VTT file text
 * @param baseUrl VTT file URL — used to resolve relative image paths
 */
export function parseThumbnailVtt(text: string, baseUrl = "", absoluteRootBase?: string): ThumbnailCue[] {
  const cues: ThumbnailCue[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.includes("-->")) {
      const arrow = line.indexOf("-->");
      const start = parseVttTime(line.slice(0, arrow));
      const end = parseVttTime(line.slice(arrow + 3));
      i++;

      // Skip blank lines between timing and URL
      while (i < lines.length && !lines[i].trim()) i++;

      if (i < lines.length) {
        const urlLine = lines[i].trim();
        const hashIdx = urlLine.lastIndexOf("#xywh=");
        let url = urlLine;
        let x = 0, y = 0, w = 160, h = 90;

        if (hashIdx !== -1) {
          url = urlLine.slice(0, hashIdx);
          const coords = urlLine.slice(hashIdx + 6).split(",").map(Number);
          x = coords[0] ?? 0;
          y = coords[1] ?? 0;
          w = coords[2] ?? 160;
          h = coords[3] ?? 90;
        }

        cues.push({ start, end, url: resolveUrl(baseUrl, url, absoluteRootBase), x, y, w, h });
      }
    }

    i++;
  }

  return cues;
}

/**
 * Binary-search for the cue that covers `time` (seconds).
 * Returns null if no cue covers that timestamp.
 */
export function findThumbnailCue(
  cues: ThumbnailCue[],
  time: number,
): ThumbnailCue | null {
  if (!cues.length) return null;

  let lo = 0;
  let hi = cues.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].end <= time) lo = mid + 1;
    else if (cues[mid].start > time) hi = mid - 1;
    else return cues[mid];
  }

  return null;
}
