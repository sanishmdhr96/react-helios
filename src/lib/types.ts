import type { ReactNode } from "react";
import type { HlsConfig } from "hls.js";

/**
 * Preset bandwidth thresholds (Kbps) for automatic audio mode switching.
 *
 * | Preset    | Kbps | Typical connection      |
 * |-----------|------|-------------------------|
 * | EXTREME   |  100 | 2G / Edge               |
 * | POOR      |  300 | Slow 3G  ← **default**  |
 * | FAIR      |  700 | 3G                      |
 * | GOOD      | 1500 | 4G / Wi-Fi              |
 *
 * Pass any of these (or a custom number) as `audioBandwidthThreshold`.
 * Set to `0` to disable automatic switching entirely.
 *
 * @example
 * import { AUDIO_BANDWIDTH_THRESHOLDS } from "react-helios";
 * <VideoPlayer audioBandwidthThreshold={AUDIO_BANDWIDTH_THRESHOLDS.FAIR} ... />
 */
export const AUDIO_BANDWIDTH_THRESHOLDS = {
  /** < 100 Kbps — very poor, 2G / Edge */
  EXTREME: 100,
  /** < 300 Kbps — poor, slow 3G (default) */
  POOR: 300,
  /** < 700 Kbps — fair, 3G */
  FAIR: 700,
  /** < 1500 Kbps — decent, 4G / Wi-Fi */
  GOOD: 1500,
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

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  preload?: "none" | "metadata" | "auto";
  playbackRates?: PlaybackRate[];
  className?: string;
  enableHLS?: boolean;
  enablePreview?: boolean;
  /**
   * URL to a WebVTT thumbnail track for sprite-sheet preview on the progress bar.
   *
   * The VTT file should map time ranges to sprite-sheet coordinates using the
   * standard `#xywh=x,y,w,h` fragment format:
   *
   * ```
   * WEBVTT
   *
   * 00:00:00.000 --> 00:00:05.000
   * https://cdn.example.com/thumbs/storyboard0.jpg#xywh=0,0,160,90
   * ```
   *
   * When provided, hovering the progress bar shows a thumbnail instead of
   * requiring a second video decode. If omitted, only the timestamp tooltip
   * is shown.
   */
  thumbnailVtt?: string;
  hlsConfig?: Partial<HlsConfig>;
  subtitles?: SubtitleTrack[];
  crossOrigin?: "anonymous" | "use-credentials";
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: VideoError) => void;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onBuffering?: (isBuffering: boolean) => void;
  onTheaterModeChange?: (isTheater: boolean) => void;
  /**
   * Image URL or ReactNode shown as artwork in audio mode.
   * Priority: `poster` prop → `logo` string/ReactNode → waveform-only.
   * If a string URL is provided the image is rendered white-normalised (filter invert)
   * so it stands out on the dark background.
   */
  logo?: string | ReactNode;
  /**
   * Show the headphones / audio-mode toggle button in the control bar.
   * @default true
   */
  showAudioButton?: boolean;
  /**
   * Start the player in audio-only mode on mount.
   * @default false
   */
  defaultAudioMode?: boolean;
  /**
   * Bandwidth threshold in **Kbps**. When the measured download speed falls below
   * this value the player automatically switches to audio mode.
   * Use the exported `AUDIO_BANDWIDTH_THRESHOLDS` presets for convenience.
   * Set to `0` to disable automatic switching.
   * Only applies to HLS streams (where hls.js measures real segment bandwidth).
   * @default 300  (AUDIO_BANDWIDTH_THRESHOLDS.POOR)
   */
  audioBandwidthThreshold?: number;
  /** Fired whenever audio mode is toggled — either automatically or by the user. */
  onAudioModeChange?: (isAudio: boolean) => void;
  contextMenuItems?: ContextMenuItem[];
  controlBarItems?: ControlBarItem[];
}

/** Internal error type used by the HLS module */
export interface PlayerError {
  code: string;
  message: string;
  details?: unknown;
}
