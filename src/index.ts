// Main component
import VideoPlayer from "./components/VideoPlayer";
export { VideoPlayer };

// Plain audio player (HLS + direct audio sources)
import AudioPlayer from "./components/AudioPlayer";
export { AudioPlayer };

// Controls and Control Elements
export { Controls } from "./components/Controls";
export * as ControlElements from "./components/control-elements";

// Audio mode presets
export { AUDIO_BANDWIDTH_THRESHOLDS, AUDIO_SWITCH_LEVELS } from "./lib/types";

// Types
export type {
  VideoPlayerProps,
  VideoPlayerOptions,
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
  ManualQualityLevel,
  PlaylistItem,
  AudioPlayerProps,
  AudioPlayerOptions,
  AudioPlayerRef,
  AudioPlayerState,
} from "./lib/types";

// Utilities
export { formatTime, isHLSUrl, getMimeType } from "./lib/format";

// VTT thumbnail helpers (for custom integrations)
export type { ThumbnailCue } from "./lib/vtt";
export { parseThumbnailVtt, findThumbnailCue } from "./lib/vtt";
