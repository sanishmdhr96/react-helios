"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import HLS, { Events } from "hls.js";
import type {
  PlayerState,
  VideoPlayerRef,
  PlaybackRate,
  HLSQualityLevel,
  VideoError,
  VideoErrorCode,
} from "../lib/types";
import type { HlsConfig } from "hls.js";
import { isHLSUrl } from "../lib/format";
import { buildQualityLevels } from "../lib/hls";

interface UseVideoPlayerOptions {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playbackRates?: PlaybackRate[];
  enableHLS?: boolean;
  hlsConfig?: Partial<HlsConfig>;
  defaultAudioMode?: boolean;
  /** Kbps — switch to audio mode below this bandwidth. 0 = disabled. @default 300 */
  audioBandwidthThreshold?: number;
  /** HLS quality level — switch to audio mode at this level or below. -1 = disabled. @default undefined */
  audioModeSwitchLevel?: number;
  /** Ms between recovery probes while auto-switched to audio mode. @default 30000 */
  audioModeRecoveryInterval?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: VideoError) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onBuffering?: (isBuffering: boolean) => void;
  onTheaterModeChange?: (isTheater: boolean) => void;
  onAudioModeChange?: (isAudio: boolean) => void;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  audioSrc?: string;
}

const DEFAULT_STATE: PlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  playbackRate: 1,
  isFullscreen: false,
  isPictureInPicture: false,
  isTheaterMode: false,
  isAudioMode: false,
  isBuffering: false,
  bufferedRanges: [],
  error: null,
  isLive: false,
  qualityLevels: [],
  currentQualityLevel: -1,
};

export function useVideoPlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  src: string,
  options: UseVideoPlayerOptions = {},
) {
  const hlsRef = useRef<HLS | null>(null);
  const fullscreenContainerRef = useRef<HTMLElement | null>(null);
  const lastVolumeRef = useRef<number>(1);
  const networkRetriesRef = useRef<number>(0);
  const mediaErrorRetriesRef = useRef<number>(0);
  // Tracks the src that was active when isAudioMode last changed, so the audio
  // mode sync effect can tell the difference between a real mode toggle and a
  // spurious false reset that happens when src changes mid-audio-mode.
  const audioModeSrcRef = useRef<string>(src);

  // ── Stable refs so effects never need options/state in their dep arrays ──────
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, setState] = useState<PlayerState>({
    ...DEFAULT_STATE,
    isMuted: options.muted ?? false,
    volume: options.muted ? 0 : 1,
    isAudioMode: options.defaultAudioMode ?? false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Audio mode / bandwidth detection ─────────────────────────────────────
  /** Rolling window of the last 5 HLS bandwidth samples (Kbps). */
  const bwSamplesRef = useRef<number[]>([]);
  /** Counts loaded fragments — level-based switch is suppressed until ≥ 3. */
  const fragCountRef = useRef<number>(0);
  /** True when the current audio-mode switch was triggered automatically. */
  const autoSwitchedRef = useRef<boolean>(false);
  /** While true, auto-detection is suppressed (user just manually toggled). */
  const manualCooldownActiveRef = useRef<boolean>(false);
  const manualCooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Timer that fires the next bandwidth recovery probe while in auto audio mode. */
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True while a recovery probe fragment load is in-flight. */
  const recoveryProbePendingRef = useRef<boolean>(false);

  /** Returns the currently-active media element (audio in audio mode, video otherwise). */
  const getActiveMedia = useCallback((): HTMLMediaElement | null => {
    const opts = optionsRef.current;
    if (stateRef.current.isAudioMode && opts.audioSrc && opts.audioRef?.current) {
      return opts.audioRef.current;
    }
    return videoRef.current;
  }, [videoRef]);

  // ─── Source / HLS initialisation ────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Guards all async HLS callbacks — set to true in cleanup so stale events
    // (e.g. from a previous src load still in-flight) never touch the new state.
    let destroyed = false;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    networkRetriesRef.current = 0;
    mediaErrorRetriesRef.current = 0;

    // Reset bandwidth samples and cooldown for the new source
    bwSamplesRef.current = [];
    fragCountRef.current = 0;
    autoSwitchedRef.current = false;
    manualCooldownActiveRef.current = false;
    if (manualCooldownTimerRef.current) {
      clearTimeout(manualCooldownTimerRef.current);
      manualCooldownTimerRef.current = null;
    }
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    recoveryProbePendingRef.current = false;

    setState((prev) => ({
      ...prev,
      currentTime: 0,
      duration: 0,
      error: null,
      isPlaying: false,
      // Keep isBuffering true while the manifest loads — the video `waiting` event
      // only fires once buffering starts, which is after the manifest is parsed.
      // Without this, the player shows a blank/frozen frame with no spinner.
      isBuffering: !!src,
      isLive: false,
      qualityLevels: [],
      currentQualityLevel: -1,
      isAudioMode: optionsRef.current.defaultAudioMode ?? false,
    }));

    if (!src) return () => { destroyed = true; };

    const opts = optionsRef.current;

    if (opts.enableHLS !== false && isHLSUrl(src)) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS (Safari) – no HLS.js instance needed
        video.src = src;
        video.load();
        if (opts.autoplay) video.play().catch(() => {});
      } else if (HLS.isSupported()) {
        const hls = new HLS({
          autoStartLoad: true,
          startLevel: -1,
          capLevelToPlayerSize: true,
          capLevelOnFPSDrop: true,
          enableWorker: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          maxBufferSize: 60 * 1000 * 1000,
          liveBackBufferLength: 30,
          liveSyncDurationCount: 3,
          ...opts.hlsConfig,
        });

        hls.attachMedia(video);
        hls.loadSource(src);

        hls.on(Events.MANIFEST_PARSED, (_, data) => {
          if (destroyed) return;
          const levels: HLSQualityLevel[] = buildQualityLevels(data.levels);
          setState((prev) => ({
            ...prev,
            qualityLevels: levels,
            currentQualityLevel: -1,
          }));
          if (optionsRef.current.autoplay) video.play().catch(() => {});
        });

        hls.on(Events.LEVEL_SWITCHED, (_, data) => {
          if (destroyed) return;
          setState((prev) => ({ ...prev, currentQualityLevel: data.level }));

          // ── Level-based auto-switch ──────────────────────────────────────
          const opts = optionsRef.current;
          const switchLevel = opts.audioModeSwitchLevel;
          if (
            switchLevel === undefined ||
            switchLevel < 0 ||
            !opts.audioSrc ||
            manualCooldownActiveRef.current ||
            fragCountRef.current < 3 // ignore initial level ramp-up on page load
          ) return;

          setState((prev) => {
            if (!prev.isAudioMode && data.level <= switchLevel) {
              autoSwitchedRef.current = true;
              optionsRef.current.onAudioModeChange?.(true);
              return { ...prev, isAudioMode: true };
            }
            return prev;
          });
        });

        hls.on(Events.FRAG_LOADED, (_, fragData) => {
          if (destroyed) return;
          // Reset media-error retry counter on any successful fragment load
          // so a later isolated seek/parse error still gets recovery attempts.
          mediaErrorRetriesRef.current = 0;

          const opts = optionsRef.current;

          // Only auto-switch if an audio source is actually provided
          if (!opts.audioSrc) return;

          fragCountRef.current += 1;

          // ── Measure actual per-fragment bandwidth ────────────────────────
          // hls.bandwidthEstimate is an EWMA that reacts slowly — if the page
          // loaded on fast WiFi the estimate stays high for many fragments.
          // Instead measure each fragment directly: bytes × 8 / load-time(ms) = Kbps
          const loadMs = fragData.stats.loading.end - fragData.stats.loading.start;
          const fragBwKbps = loadMs > 0 && fragData.stats.total > 0
            ? (fragData.stats.total * 8) / loadMs
            : 0;

          const threshold = opts.audioBandwidthThreshold ?? 300;

          // ── Recovery probe path ──────────────────────────────────────────
          if (recoveryProbePendingRef.current) {
            recoveryProbePendingRef.current = false;
            if (fragBwKbps > 0 && threshold && fragBwKbps > threshold * 1.5) {
              // Bandwidth has recovered — switch back to video
              autoSwitchedRef.current = false;
              hls.startLoad();
              optionsRef.current.onAudioModeChange?.(false);
              setState((prev) => ({ ...prev, isAudioMode: false }));
            } else {
              // Still poor — stop loading, schedule next probe
              hls.stopLoad();
              scheduleRecoveryProbe();
            }
            return;
          }

          // ── Normal bandwidth-based auto-switch ───────────────────────────
          if (!threshold) return; // 0 = disabled
          if (manualCooldownActiveRef.current) return;
          if (fragBwKbps <= 0) return;

          const samples = bwSamplesRef.current;
          samples.push(fragBwKbps);
          if (samples.length > 5) samples.shift();
          if (samples.length < 2) return; // need at least 2 samples to avoid noise

          const avg = samples.reduce((s, v) => s + v, 0) / samples.length;

          setState((prev) => {
            if (!prev.isAudioMode && avg < threshold) {
              autoSwitchedRef.current = true;
              optionsRef.current.onAudioModeChange?.(true);
              return { ...prev, isAudioMode: true };
            }
            return prev;
          });
        });

        // Helper: schedule a recovery bandwidth probe
        const scheduleRecoveryProbe = () => {
          if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
          const interval = optionsRef.current.audioModeRecoveryInterval ?? 30_000;
          recoveryTimerRef.current = setTimeout(() => {
            if (!autoSwitchedRef.current || !stateRef.current.isAudioMode) return;
            recoveryProbePendingRef.current = true;
            hls.startLoad(); // loads one fragment → FRAG_LOADED fires → we evaluate
          }, interval);
        };

        const MAX_RETRIES = 3;
        hls.on(Events.ERROR, (_, data) => {
          if (destroyed) return;
          if (!data.fatal) {
            console.warn("[hls] non-fatal:", data.details);
            return;
          }
          switch (data.type) {
            case HLS.ErrorTypes.NETWORK_ERROR:
              if (networkRetriesRef.current < MAX_RETRIES) {
                networkRetriesRef.current += 1;
                const delay = 1000 * networkRetriesRef.current;
                console.warn(
                  `[hls] network error – retry ${networkRetriesRef.current}/${MAX_RETRIES} in ${delay}ms`,
                );
                // Guard against retry firing after this HLS instance was replaced/destroyed
                setTimeout(() => {
                  if (hlsRef.current === hls) hls.startLoad();
                }, delay);
              } else {
                const err: VideoError = {
                  code: "HLS_NETWORK_ERROR",
                  message: "Failed to load stream after multiple retries.",
                };
                setState((prev) => ({ ...prev, error: err }));
                optionsRef.current.onError?.(err);
              }
              break;
            case HLS.ErrorTypes.MEDIA_ERROR:
              if (mediaErrorRetriesRef.current < MAX_RETRIES) {
                mediaErrorRetriesRef.current += 1;
                console.warn(
                  `[hls] media error – recovery attempt ${mediaErrorRetriesRef.current}/${MAX_RETRIES}`,
                );
                hls.recoverMediaError();
              } else {
                hls.destroy();
                hlsRef.current = null;
                const mediaErr: VideoError = {
                  code: "HLS_FATAL_ERROR",
                  message: "An unrecoverable media error occurred.",
                };
                setState((prev) => ({ ...prev, error: mediaErr }));
                optionsRef.current.onError?.(mediaErr);
              }
              break;
            default: {
              hls.destroy();
              hlsRef.current = null;
              const fatalErr: VideoError = {
                code: "HLS_FATAL_ERROR",
                message: "An unrecoverable HLS error occurred.",
              };
              setState((prev) => ({ ...prev, error: fatalErr }));
              optionsRef.current.onError?.(fatalErr);
              break;
            }
          }
        });

        hlsRef.current = hls;
      }
    } else {
      // Regular video (mp4, webm, etc.)
      video.src = src;
      video.load();
      if (opts.autoplay) video.play().catch(() => {});
    }

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (manualCooldownTimerRef.current) {
        clearTimeout(manualCooldownTimerRef.current);
        manualCooldownTimerRef.current = null;
      }
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
      recoveryProbePendingRef.current = false;
      // Reset audio element when source changes
      const audio = optionsRef.current.audioRef?.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    };
  }, [src, videoRef]);

  // ─── Video element event listeners ──────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (optionsRef.current.muted) video.muted = true;
    if (optionsRef.current.loop) video.loop = true;

    const handlePlay = () => {
      setState((prev) => ({ ...prev, isPlaying: true }));
      optionsRef.current.onPlay?.();
    };
    const handlePause = () => {
      setState((prev) => ({ ...prev, isPlaying: false }));
      optionsRef.current.onPause?.();
    };
    const handleEnded = () => {
      setState((prev) => ({ ...prev, isPlaying: false }));
      optionsRef.current.onEnded?.();
    };
    const handleTimeUpdate = () => {
      // In audio mode the audio element drives time updates instead
      if (stateRef.current.isAudioMode && optionsRef.current.audioSrc) return;
      optionsRef.current.onTimeUpdate?.(video.currentTime);
    };
    const handleDurationChange = () => {
      const dur = video.duration;
      const live = !Number.isFinite(dur);
      setState((prev) => ({ ...prev, duration: live ? 0 : dur, isLive: live }));
      if (!live) optionsRef.current.onDurationChange?.(dur);
    };
    const handleVolumeChange = () => {
      const vol = video.volume;
      if (vol > 0 && !video.muted) lastVolumeRef.current = vol;
      setState((prev) => ({
        ...prev,
        volume: vol,
        isMuted: video.muted || vol === 0,
      }));
    };
    const handleRateChange = () => {
      setState((prev) => ({ ...prev, playbackRate: video.playbackRate }));
    };
    const handleError = () => {
      const e = video.error;
      if (!e) return;
      // When HLS.js is managing the stream it handles all error recovery via its
      // own Events.ERROR handler. The native video `error` event is a downstream
      // side-effect of those same failures — propagating it here would show the
      // error overlay before hls.js has a chance to call recoverMediaError().
      if (hlsRef.current) return;
      const codeMap: Partial<Record<number, VideoErrorCode>> = {
        1: "MEDIA_ERR_ABORTED",
        2: "MEDIA_ERR_NETWORK",
        3: "MEDIA_ERR_DECODE",
        4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
      };
      const err: VideoError = {
        code: codeMap[e.code] ?? "UNKNOWN",
        message: e.message || "Unknown media error",
      };
      setState((prev) => ({ ...prev, error: err }));
      optionsRef.current.onError?.(err);
    };
    const handleWaiting = () => {
      setState((prev) => ({ ...prev, isBuffering: true }));
      optionsRef.current.onBuffering?.(true);
    };
    const handleCanPlay = () => {
      setState((prev) => ({ ...prev, isBuffering: false }));
      optionsRef.current.onBuffering?.(false);
    };
    const handlePlaying = () =>
      setState((prev) => ({ ...prev, isBuffering: false }));
    const handleFullscreenChange = () => {
      const fs = !!(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      setState((prev) => ({ ...prev, isFullscreen: fs }));
    };
    const handlePiPChange = () => {
      setState((prev) => ({
        ...prev,
        isPictureInPicture: document.pictureInPictureElement === video,
      }));
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("volumechange", handleVolumeChange);
    video.addEventListener("ratechange", handleRateChange);
    video.addEventListener("error", handleError);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("playing", handlePlaying);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    video.addEventListener("enterpictureinpicture", handlePiPChange);
    video.addEventListener("leavepictureinpicture", handlePiPChange);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("volumechange", handleVolumeChange);
      video.removeEventListener("ratechange", handleRateChange);
      video.removeEventListener("error", handleError);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("playing", handlePlaying);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      video.removeEventListener("enterpictureinpicture", handlePiPChange);
      video.removeEventListener("leavepictureinpicture", handlePiPChange);
    };
  }, [videoRef]); // stable – options accessed via optionsRef

  // ─── Audio element event listeners ──────────────────────────────────────────
  useEffect(() => {
    const audio = optionsRef.current.audioRef?.current;
    if (!audio || !optionsRef.current.audioSrc) return;

    const handlePlay = () => {
      setState((prev) => ({ ...prev, isPlaying: true }));
      optionsRef.current.onPlay?.();
    };
    const handlePause = () => {
      setState((prev) => ({ ...prev, isPlaying: false }));
      optionsRef.current.onPause?.();
    };
    const handleEnded = () => {
      setState((prev) => ({ ...prev, isPlaying: false }));
      optionsRef.current.onEnded?.();
    };
    const handleWaiting = () => {
      setState((prev) => ({ ...prev, isBuffering: true }));
      optionsRef.current.onBuffering?.(true);
    };
    const handleCanPlay = () => {
      setState((prev) => ({ ...prev, isBuffering: false }));
      optionsRef.current.onBuffering?.(false);
    };
    const handlePlaying = () =>
      setState((prev) => ({ ...prev, isBuffering: false }));
    const handleTimeUpdate = () => {
      if (!stateRef.current.isAudioMode) return;
      optionsRef.current.onTimeUpdate?.(audio.currentTime);
    };
    const handleDurationChange = () => {
      const dur = audio.duration;
      if (isFinite(dur)) {
        setState((prev) => ({ ...prev, duration: dur }));
        optionsRef.current.onDurationChange?.(dur);
      }
    };
    const handleError = () => {
      const err: VideoError = { code: "MEDIA_ERR_NETWORK", message: "Audio source failed to load." };
      setState((prev) => ({ ...prev, error: err }));
      optionsRef.current.onError?.(err);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("error", handleError);
    };
  }, [src]); // re-bind when content changes

  // ─── Sync between video and audio on mode switch ─────────────────────────────
  useEffect(() => {
    const opts = optionsRef.current;
    const video = videoRef.current;
    const audio = opts.audioRef?.current;
    if (!video || !audio || !opts.audioSrc) return;

    // When src changes, the src effect resets isAudioMode → false as part of a
    // full state reset. That triggers this effect, but we must NOT perform the
    // audio→video handoff in that case: the new HLS instance is still loading its
    // manifest and calling startLoad() / setting currentTime here would interrupt it.
    if (audioModeSrcRef.current !== src) {
      audioModeSrcRef.current = src;
      return;
    }
    audioModeSrcRef.current = src;

    if (state.isAudioMode) {
      // Entering audio mode — pause video (stops decoding), hand off to audio element
      const pos = video.currentTime;
      const wasPlaying = !video.paused;
      video.pause();
      // Stop HLS from buffering video in the background — saves bandwidth for audio
      hlsRef.current?.stopLoad();
      if (!audio.getAttribute("src")) audio.src = opts.audioSrc;
      audio.currentTime = pos;
      audio.volume = video.volume;
      audio.muted = video.muted;
      audio.playbackRate = video.playbackRate;
      if (wasPlaying) audio.play().catch(() => {});
      // Schedule bandwidth recovery probes if this was an automatic switch
      if (autoSwitchedRef.current) {
        if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
        const interval = opts.audioModeRecoveryInterval ?? 30_000;
        recoveryTimerRef.current = setTimeout(() => {
          if (!autoSwitchedRef.current || !stateRef.current.isAudioMode) return;
          recoveryProbePendingRef.current = true;
          hlsRef.current?.startLoad();
        }, interval);
      }
    } else {
      // Leaving audio mode — hand off back to video element
      const pos = audio.currentTime;
      const wasPlaying = !audio.paused;
      audio.pause();
      // Cancel any pending recovery probe
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
      recoveryProbePendingRef.current = false;
      // Resume HLS video loading
      hlsRef.current?.startLoad();
      video.currentTime = pos;
      video.volume = audio.volume;
      if (wasPlaying) video.play().catch(() => {});
    }
  }, [state.isAudioMode, videoRef, src]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Control methods (all stable via useCallback with empty or minimal deps) ─
  const play = useCallback(async () => {
    const media = getActiveMedia();
    if (!media) return;
    try {
      await media.play();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError")
        console.error("[player] play() failed:", err);
    }
  }, [getActiveMedia]);

  const pause = useCallback(() => {
    getActiveMedia()?.pause();
  }, [getActiveMedia]);

  const seek = useCallback(
    (time: number) => {
      const media = getActiveMedia();
      if (!media) return;
      media.currentTime = Math.max(0, Math.min(time, media.duration || time));
    },
    [getActiveMedia],
  );

  const setVolume = useCallback(
    (volume: number) => {
      const media = getActiveMedia();
      if (!media) return;
      const v = Math.max(0, Math.min(volume, 1));
      if (v > 0) lastVolumeRef.current = v;
      media.volume = v;
      media.muted = v === 0;
    },
    [getActiveMedia],
  );

  const toggleMute = useCallback(() => {
    const media = getActiveMedia();
    if (!media) return;
    if (media.muted || media.volume === 0) {
      const restore = lastVolumeRef.current > 0 ? lastVolumeRef.current : 1;
      media.volume = restore;
      media.muted = false;
    } else {
      lastVolumeRef.current = media.volume;
      media.muted = true;
    }
  }, [getActiveMedia]);

  const setPlaybackRate = useCallback(
    (rate: PlaybackRate) => {
      // Apply to both so rate is preserved across mode switches
      const video = videoRef.current;
      if (video) video.playbackRate = rate;
      const audio = optionsRef.current.audioRef?.current;
      if (audio) audio.playbackRate = rate;
    },
    [videoRef],
  );

  const setQualityLevel = useCallback((level: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = level;
    setState((prev) => ({ ...prev, currentQualityLevel: level }));
  }, []);

  const seekToLive = useCallback(() => {
    const hls = hlsRef.current;
    const video = videoRef.current;
    if (!hls || !video) return;
    const livePos = hls.liveSyncPosition;
    if (livePos != null && Number.isFinite(livePos))
      video.currentTime = livePos;
  }, [videoRef]);

  const toggleFullscreen = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const container = fullscreenContainerRef.current ?? video.parentElement;
    if (!container) return;
    try {
      if (
        !document.fullscreenElement &&
        !(document as any).webkitFullscreenElement
      ) {
        if (container.requestFullscreen) await container.requestFullscreen();
        else (container as any).webkitRequestFullscreen?.();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else (document as any).webkitExitFullscreen?.();
      }
    } catch (err) {
      console.error("[player] fullscreen toggle failed:", err);
    }
  }, [videoRef]);

  const togglePictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement)
        await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch (err) {
      console.error("[player] PiP toggle failed:", err);
    }
  }, [videoRef]);

  const toggleTheaterMode = useCallback(() => {
    const next = !stateRef.current.isTheaterMode;
    setState((prev) => ({ ...prev, isTheaterMode: next }));
    optionsRef.current.onTheaterModeChange?.(next);
  }, []);

  const toggleAudioMode = useCallback(() => {
    // Clear any running cooldown
    if (manualCooldownTimerRef.current) clearTimeout(manualCooldownTimerRef.current);

    // Mark as a manual override — suppress auto-detection for 60 s
    autoSwitchedRef.current = false;
    manualCooldownActiveRef.current = true;
    manualCooldownTimerRef.current = setTimeout(() => {
      manualCooldownActiveRef.current = false;
      // Clear samples so auto-detection starts fresh after cooldown
      bwSamplesRef.current = [];
    }, 60_000);

    const next = !stateRef.current.isAudioMode;
    setState((prev) => ({ ...prev, isAudioMode: next }));
    optionsRef.current.onAudioModeChange?.(next);
  }, []);

  const getState = useCallback((): PlayerState => {
    const media = getActiveMedia();
    const currentTime = media?.currentTime ?? 0;
    const bufferedRanges: import("../lib/types").BufferedRange[] = [];
    if (media) {
      for (let i = 0; i < media.buffered.length; i++) {
        bufferedRanges.push({ start: media.buffered.start(i), end: media.buffered.end(i) });
      }
    }
    return { ...stateRef.current, currentTime, bufferedRanges };
  }, [getActiveMedia]);

  const getVideoElement = useCallback(
    (): HTMLVideoElement | null => videoRef.current ?? null,
    [videoRef],
  );

  const ref = useMemo<VideoPlayerRef>(
    () => ({
      play,
      pause,
      seek,
      setVolume,
      toggleMute,
      setPlaybackRate,
      setQualityLevel,
      seekToLive,
      toggleFullscreen,
      togglePictureInPicture,
      toggleTheaterMode,
      toggleAudioMode,
      getState,
      getVideoElement,
    }),
    [
      play,
      pause,
      seek,
      setVolume,
      toggleMute,
      setPlaybackRate,
      setQualityLevel,
      seekToLive,
      toggleFullscreen,
      togglePictureInPicture,
      toggleTheaterMode,
      toggleAudioMode,
      getState,
      getVideoElement,
    ],
  );

  return { state, ref, hlsRef, fullscreenContainerRef };
}
