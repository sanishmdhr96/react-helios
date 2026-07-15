"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import HLS, { Events } from "hls.js";
import type { HlsConfig } from "hls.js";
import type {
  AudioPlayerRef,
  AudioPlayerState,
  PlaybackRate,
  VideoError,
  VideoErrorCode,
} from "../lib/types";
import { isHLSUrl } from "../lib/format";

interface UseAudioPlayerOptions {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  enableHLS?: boolean;
  hlsConfig?: Partial<HlsConfig>;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: VideoError) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
  onBuffering?: (isBuffering: boolean) => void;
}

const DEFAULT_STATE: AudioPlayerState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  playbackRate: 1,
  isBuffering: false,
  bufferedRanges: [],
  error: null,
  isLive: false,
};

export function useAudioPlayer(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  src: string,
  options: UseAudioPlayerOptions = {},
) {
  const hlsRef = useRef<HLS | null>(null);
  const lastVolumeRef = useRef<number>(1);
  const networkRetriesRef = useRef<number>(0);
  const mediaErrorRetriesRef = useRef<number>(0);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, setState] = useState<AudioPlayerState>({
    ...DEFAULT_STATE,
    isMuted: options.muted ?? false,
    volume: options.muted ? 0 : 1,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // ─── Source / HLS initialisation ────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let destroyed = false;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    networkRetriesRef.current = 0;
    mediaErrorRetriesRef.current = 0;

    setState((prev) => ({
      ...prev,
      currentTime: 0,
      duration: 0,
      error: null,
      isPlaying: false,
      isBuffering: !!src,
      isLive: false,
    }));

    if (!src) return () => { destroyed = true; };

    const opts = optionsRef.current;

    if (opts.enableHLS !== false && isHLSUrl(src)) {
      if (HLS.isSupported()) {
        const hls = new HLS({
          autoStartLoad: true,
          startLevel: -1,
          enableWorker: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          maxBufferSize: 60 * 1000 * 1000,
          liveBackBufferLength: 30,
          liveSyncDurationCount: 3,
          ...opts.hlsConfig,
        });

        hls.attachMedia(audio);
        hls.loadSource(src);

        hls.on(Events.MANIFEST_PARSED, () => {
          if (destroyed) return;
          if (optionsRef.current.autoplay) audio.play().catch(() => {});
        });

        hls.on(Events.FRAG_LOADED, () => {
          if (destroyed) return;
          mediaErrorRetriesRef.current = 0;
        });

        const MAX_RETRIES = 3;
        hls.on(Events.ERROR, (_, data) => {
          if (destroyed) return;
          if (!data.fatal) {
            console.warn("[hls-audio] non-fatal:", data.details);
            return;
          }
          switch (data.type) {
            case HLS.ErrorTypes.NETWORK_ERROR:
              if (networkRetriesRef.current < MAX_RETRIES) {
                networkRetriesRef.current += 1;
                const delay = 1000 * networkRetriesRef.current;
                console.warn(
                  `[hls-audio] network error – retry ${networkRetriesRef.current}/${MAX_RETRIES} in ${delay}ms`,
                );
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
                  `[hls-audio] media error – recovery attempt ${mediaErrorRetriesRef.current}/${MAX_RETRIES}`,
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
      } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        audio.src = src;
        audio.load();
        if (opts.autoplay) audio.play().catch(() => {});
      }
    } else {
      audio.src = src;
      audio.load();
      if (opts.autoplay) audio.play().catch(() => {});
    }

    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, audioRef]);

  // ─── Audio element event listeners ──────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (optionsRef.current.muted) audio.muted = true;
    if (optionsRef.current.loop) audio.loop = true;

    const handlePlay = () => {
      setState((prev) => ({ ...prev, isPlaying: true }));
      optionsRef.current.onPlay?.();
    };
    const handlePause = () => {
      setState((prev) => ({ ...prev, isPlaying: false }));
      optionsRef.current.onPause?.();
    };
    const handleEnded = () => {
      if (audio.loop) return;
      setState((prev) => ({ ...prev, isPlaying: false }));
      optionsRef.current.onEnded?.();
    };
    const handleTimeUpdate = () => {
      optionsRef.current.onTimeUpdate?.(audio.currentTime);
    };
    const handleDurationChange = () => {
      const dur = audio.duration;
      const live = !Number.isFinite(dur);
      setState((prev) => ({ ...prev, duration: live ? 0 : dur, isLive: live }));
      if (!live) optionsRef.current.onDurationChange?.(dur);
    };
    const handleVolumeChange = () => {
      const vol = audio.volume;
      if (vol > 0 && !audio.muted) lastVolumeRef.current = vol;
      setState((prev) => ({
        ...prev,
        volume: vol,
        isMuted: audio.muted || vol === 0,
      }));
    };
    const handleRateChange = () => {
      setState((prev) => ({ ...prev, playbackRate: audio.playbackRate }));
    };
    const handleError = () => {
      const e = audio.error;
      if (!e) return;
      // HLS.js owns error recovery when it's managing the stream.
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
    const handlePlaying = () => {
      setState((prev) => ({ ...prev, isBuffering: false }));
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("volumechange", handleVolumeChange);
    audio.addEventListener("ratechange", handleRateChange);
    audio.addEventListener("error", handleError);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("playing", handlePlaying);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("volumechange", handleVolumeChange);
      audio.removeEventListener("ratechange", handleRateChange);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("playing", handlePlaying);
    };
  }, [audioRef, src]);

  // ─── Control methods ──────────────────────────────────────────────────────
  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError")
        console.error("[audio-player] play() failed:", err);
    }
  }, [audioRef]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, [audioRef]);

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = Math.max(0, Math.min(time, audio.duration || time));
    },
    [audioRef],
  );

  const setVolume = useCallback(
    (volume: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const v = Math.max(0, Math.min(volume, 1));
      if (v > 0) lastVolumeRef.current = v;
      audio.volume = v;
      audio.muted = v === 0;
    },
    [audioRef],
  );

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.muted || audio.volume === 0) {
      const restore = lastVolumeRef.current > 0 ? lastVolumeRef.current : 1;
      audio.volume = restore;
      audio.muted = false;
    } else {
      lastVolumeRef.current = audio.volume;
      audio.muted = true;
    }
  }, [audioRef]);

  const setPlaybackRate = useCallback(
    (rate: PlaybackRate) => {
      const audio = audioRef.current;
      if (audio) audio.playbackRate = rate;
    },
    [audioRef],
  );

  const getState = useCallback((): AudioPlayerState => {
    const audio = audioRef.current;
    const currentTime = audio?.currentTime ?? 0;
    const bufferedRanges: import("../lib/types").BufferedRange[] = [];
    if (audio) {
      for (let i = 0; i < audio.buffered.length; i++) {
        bufferedRanges.push({ start: audio.buffered.start(i), end: audio.buffered.end(i) });
      }
    }
    return { ...stateRef.current, currentTime, bufferedRanges };
  }, [audioRef]);

  const getAudioElement = useCallback(
    (): HTMLAudioElement | null => audioRef.current ?? null,
    [audioRef],
  );

  const ref = useMemo<AudioPlayerRef>(
    () => ({
      play,
      pause,
      seek,
      setVolume,
      toggleMute,
      setPlaybackRate,
      getState,
      getAudioElement,
    }),
    [play, pause, seek, setVolume, toggleMute, setPlaybackRate, getState, getAudioElement],
  );

  return { state, ref };
}
