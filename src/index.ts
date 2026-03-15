// Main component
import VideoPlayer from "./components/VideoPlayer";
export { VideoPlayer };

// Controls and Control Elements
export { Controls } from "./components/Controls";
export * as ControlElements from "./components/control-elements";

// Audio mode bandwidth presets
export { AUDIO_BANDWIDTH_THRESHOLDS } from "./lib/types";

// Types
export type {
  VideoPlayerProps,
  VideoPlayerRef,
  PlayerState,
  PlaybackRate,
  HLSQualityLevel,
  SubtitleTrack,
  BufferedRange,
  VideoError,
  VideoErrorCode,
  ContextMenuItem,
  ControlBarItem,
} from "./lib/types";

// Utilities
export { formatTime, isHLSUrl, getMimeType } from "./lib/format";

// VTT thumbnail helpers (for custom integrations)
export type { ThumbnailCue } from "./lib/vtt";
export { parseThumbnailVtt, findThumbnailCue } from "./lib/vtt";
