import type { ReactNode } from "react";
import type { HlsConfig } from "hls.js";

/**
 * Preset bandwidth thresholds (Kbps) for automatic audio mode switching.
 *
 * | Preset    | Kbps | Typical connection             |
 * |-----------|------|--------------------------------|
 * | EXTREME   |  100 | 2G / Edge                      |
 * | POOR      |  300 | Slow 3G                        |
 * | FAIR      |  800 | Marginal 3G ← **recommended**  |
 * | GOOD      | 1500 | Weak 4G / congested Wi-Fi      |
 *
 * Pass any of these (or a custom number) as `audioBandwidthThreshold`.
 * Set to `0` to disable bandwidth-based switching entirely.
 *
 * @example
 * import { AUDIO_BANDWIDTH_THRESHOLDS } from "react-helios";
 * <VideoPlayer options={{ audioBandwidthThreshold: AUDIO_BANDWIDTH_THRESHOLDS.FAIR }} />
 */
export const AUDIO_BANDWIDTH_THRESHOLDS = {
  /** < 100 Kbps — very poor, 2G / Edge */
  EXTREME: 100,
  /** < 300 Kbps — poor, slow 3G */
  POOR: 300,
  /** < 800 Kbps — marginal 3G ← **recommended default** */
  FAIR: 800,
  /** < 1500 Kbps — weak 4G / congested Wi-Fi */
  GOOD: 1500,
} as const;

/**
 * Preset HLS quality level indices for automatic audio mode switching.
 *
 * When HLS.js drops to this level or below (due to poor bandwidth), the player
 * automatically switches to audio mode. Level `0` is always the lowest quality
 * available in the manifest.
 *
 * | Preset         | Value | Meaning                                       |
 * |----------------|-------|-----------------------------------------------|
 * | LOWEST         |   0   | Switch when at the very lowest quality ← **recommended** |
 * | SECOND_LOWEST  |   1   | Switch one level above the lowest             |
 * | DISABLED       |  -1   | Disable level-based switching entirely        |
 *
 * Works alongside `audioBandwidthThreshold` — whichever fires first wins.
 *
 * @example
 * import { AUDIO_SWITCH_LEVELS } from "react-helios";
 * <VideoPlayer options={{ audioModeSwitchLevel: AUDIO_SWITCH_LEVELS.LOWEST }} />
 */
export const AUDIO_SWITCH_LEVELS = {
  /** Switch when HLS.js is at the lowest available quality (recommended default). */
  LOWEST: 0,
  /** Switch when HLS.js drops to the second-lowest quality. */
  SECOND_LOWEST: 1,
  /** Disable level-based auto-switching. */
  DISABLED: -1,
} as const;

export interface BufferedRange {
  start: number;
  end: number;
}

export type VideoErrorCode =
  | "MEDIA_ERR_ABORTED"
  | "MEDIA_ERR_NETWORK"
  | "MEDIA_ERR_DECODE"
  | "MEDIA_ERR_SRC_NOT_SUPPORTED"
  | "HLS_NETWORK_ERROR"
  | "HLS_FATAL_ERROR"
  | "UNKNOWN";

export interface VideoError {
  code: VideoErrorCode;
  message: string;
}

/** Display name e.g. "1080p", "720p", "Auto" */
export interface HLSQualityLevel {
  id: number;
  height: number;
  width: number;
  bitrate: number;
  name: string;
}

export interface SubtitleTrack {
  id: string;
  src: string;
  label: string;
  srclang: string;
  default?: boolean;
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  bufferedRanges: BufferedRange[];
  isBuffering: boolean;
  error: VideoError | null;
  isFullscreen: boolean;
  isPictureInPicture: boolean;
  isTheaterMode: boolean;
  /** True when the player is in audio-only mode (video hidden, waveform shown). */
  isAudioMode: boolean;
  isLive: boolean;
  qualityLevels: HLSQualityLevel[];
  currentQualityLevel: number;
}

export type PlaybackRate = 0.25 | 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2;

export interface VideoPlayerRef {
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: PlaybackRate) => void;
  setQualityLevel: (level: number) => void;
  seekToLive: () => void;
  toggleFullscreen: () => Promise<void>;
  togglePictureInPicture: () => Promise<void>;
  toggleTheaterMode: () => void;
  /** Toggle audio-only mode. Can also be triggered programmatically from outside the player. */
  toggleAudioMode: () => void;
  getState: () => PlayerState;
  getVideoElement: () => HTMLVideoElement | null;
}

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
}

export interface ControlBarItem {
  key: string;
  icon: ReactNode;
  label: string;
  title?: string;
  onClick: () => void;
}

export interface VideoPlayerOptions {
  // Playback
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: "none" | "metadata" | "auto";
  playbackRates?: PlaybackRate[];
  // HLS
  enableHLS?: boolean;
  hlsConfig?: Partial<HlsConfig>;
  // Preview
  enablePreview?: boolean;
  thumbnailVtt?: string;
  /** Override the base URL used to resolve relative image paths inside the VTT file.
   *  Useful when the VTT contains root-absolute paths that are missing a path prefix
   *  (e.g. S3 bucket name). Example: "https://cdn.example.com/wepreach" */
  thumbnailVttBaseUrl?: string;
  // UI
  autoHideControls?: boolean;
  // Subtitles
  subtitles?: SubtitleTrack[];
  crossOrigin?: "anonymous" | "use-credentials";
  // Audio mode
  logo?: string | ReactNode;
  audioSrc?: string;
  showAudioButton?: boolean;
  audioModeIcon?: ReactNode;
  videoModeIcon?: ReactNode;
  /**
   * Custom content shown in audio mode when no `poster` is provided.
   * Replaces the default animated-gradient + waveform fallback entirely.
   * The `logo` prop is still rendered on top of this if also provided.
   */
  audioModeFallback?: ReactNode;
  /** Label shown next to the icon when in video mode (click → switches to audio). Default: "Audio" */
  audioModeLabel?: string;
  /** Label shown next to the icon when in audio mode (click → switches to video). Default: "Video" */
  videoModeLabel?: string;
  defaultAudioMode?: boolean;
  /**
   * Kbps — switch to audio mode when rolling average bandwidth drops below this value.
   * `0` disables bandwidth-based switching. Default: `300` (slow 3G).
   * Works alongside `audioModeSwitchLevel` — whichever fires first wins.
   */
  audioBandwidthThreshold?: number;
  /**
   * HLS quality level index — switch to audio mode when HLS.js drops to this level or below.
   * `0` = lowest quality (recommended default). `-1` disables level-based switching.
   * Works alongside `audioBandwidthThreshold` — whichever fires first wins.
   */
  audioModeSwitchLevel?: number;
  /**
   * Milliseconds between automatic recovery probes while in auto-switched audio mode.
   * The player briefly resumes video loading to sample bandwidth, then switches back
   * to video if conditions have improved. Default: `30000` (30 seconds).
   */
  audioModeRecoveryInterval?: number;
  // Callbacks
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: VideoError) => void;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onBuffering?: (isBuffering: boolean) => void;
  onTheaterModeChange?: (isTheater: boolean) => void;
  onAudioModeChange?: (isAudio: boolean) => void;
  // Custom
  contextMenuItems?: ContextMenuItem[];
  controlBarItems?: ControlBarItem[];
}

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  controls?: boolean;
  options?: VideoPlayerOptions;
}

