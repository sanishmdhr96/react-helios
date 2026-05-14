import HLS from "hls.js";
import type { HLSQualityLevel } from "./types";

/**
 * Map HLS.js level objects to our own quality-level shape.
 */
export function buildQualityLevels(levels: HLS["levels"]): HLSQualityLevel[] {
  return levels.map((l, i) => ({
    id: i,
    height: l.height ?? 0,
    width: l.width ?? 0,
    bitrate: l.bitrate ?? 0,
    name: l.height ? `${l.height}p` : `Level ${i + 1}`,
  }));
}
