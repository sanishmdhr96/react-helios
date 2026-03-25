"use client";

import React, { memo, useRef, useState, useEffect, useCallback, useMemo } from "react";
import type { VideoPlayerRef, BufferedRange } from "../../lib/types";
import { formatTime } from "../../lib/format";
import { parseThumbnailVtt, findThumbnailCue } from "../../lib/vtt";
import type { ThumbnailCue } from "../../lib/vtt";

export interface ProgressBarProps {
  videoRef: React.RefObject<HTMLMediaElement | null>;
  playerRef: VideoPlayerRef;
  enablePreview?: boolean;
  thumbnailVtt?: string;
  thumbnailVttBaseUrl?: string;
  isAudioMode?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = memo(({
  videoRef,
  playerRef,
  enablePreview = true,
  thumbnailVtt,
  thumbnailVttBaseUrl,
  isAudioMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressFilledRef = useRef<HTMLDivElement>(null);
  const scrubHandleRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hoverTimeTextRef = useRef<HTMLDivElement>(null);
  const hoverIndicatorRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  // Only bufferedRanges stays in React state — it changes on the `progress`
  // event which fires infrequently (every few seconds during buffering).
  const [bufferedRanges, setBufferedRanges] = useState<BufferedRange[]>([]);

  // Imperative state — no React re-renders for any of these
  const isDraggingRef = useRef(false);
  const hoverPosRef = useRef(0);
  const hoverTimeRef = useRef(0);
  const lastCueRef = useRef<ThumbnailCue | null>(null);

  // VTT thumbnail cues — loaded once, looked up synchronously
  const thumbnailCuesRef = useRef<ThumbnailCue[]>([]);

  /**
   * Rect cache — getBoundingClientRect() is expensive; invalidate on resize only.
   */
  const rectCacheRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    const invalidate = () => { rectCacheRef.current = null; };
    window.addEventListener("resize", invalidate, { passive: true });
    return () => window.removeEventListener("resize", invalidate);
  }, []);

  const getRect = useCallback((): DOMRect | null => {
    if (!rectCacheRef.current && containerRef.current) {
      rectCacheRef.current = containerRef.current.getBoundingClientRect();
    }
    return rectCacheRef.current;
  }, []);

  // ─── Load VTT thumbnail cues ────────────────────────────────────────────
  useEffect(() => {
    if (!thumbnailVtt) {
      thumbnailCuesRef.current = [];
      return;
    }
    let cancelled = false;
    fetch(thumbnailVtt)
      .then(r => r.text())
      .then(text => {
        if (!cancelled) thumbnailCuesRef.current = parseThumbnailVtt(text, thumbnailVttBaseUrl ?? thumbnailVtt);
      })
      .catch(() => {
        if (!cancelled) thumbnailCuesRef.current = [];
      });
    return () => { cancelled = true; };
  }, [thumbnailVtt]);

  // ─── Subscribe to timeupdate / durationchange ────────────────────────────
  // Updates the progress fill and scrub handle position imperatively —
  // zero React re-renders during playback.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      const dur = isFinite(video.duration) ? video.duration : 0;
      const ct = video.currentTime;
      const pct = dur > 0 ? (ct / dur) * 100 : 0;

      if (progressFilledRef.current)
        progressFilledRef.current.style.width = `${pct}%`;
      if (scrubHandleRef.current)
        scrubHandleRef.current.style.left = `${pct}%`;
      if (containerRef.current) {
        containerRef.current.setAttribute("aria-valuenow", String(Math.round(ct)));
        containerRef.current.setAttribute("aria-valuemax", String(Math.round(dur)));
        containerRef.current.setAttribute("aria-valuetext", formatTime(ct));
      }
    };

    video.addEventListener("timeupdate", updateProgress);
    video.addEventListener("durationchange", updateProgress);
    video.addEventListener("seeked", updateProgress);
    updateProgress(); // sync on mount

    return () => {
      video.removeEventListener("timeupdate", updateProgress);
      video.removeEventListener("durationchange", updateProgress);
      video.removeEventListener("seeked", updateProgress);
    };
  }, [videoRef, isAudioMode]);

  // ─── Subscribe to progress (buffered ranges) ────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateBuffered = () => {
      const ranges: BufferedRange[] = [];
      for (let i = 0; i < video.buffered.length; i++) {
        ranges.push({ start: video.buffered.start(i), end: video.buffered.end(i) });
      }
      setBufferedRanges(ranges);
    };

    video.addEventListener("progress", updateBuffered);
    return () => video.removeEventListener("progress", updateBuffered);
  }, [videoRef, isAudioMode]);

  // ─── Non-React drag-state helpers ────────────────────────────────────────
  const startDragging = useCallback(() => {
    isDraggingRef.current = true;
    scrubHandleRef.current?.classList.add("dragging");
  }, []);

  const stopDragging = useCallback(() => {
    isDraggingRef.current = false;
    scrubHandleRef.current?.classList.remove("dragging");
  }, []);

  // ─── Show / hide preview tooltip ─────────────────────────────────────────
  const showTooltip = useCallback(() => {
    if (!enablePreview) return;
    rectCacheRef.current = null; // invalidate rect on re-entry
    if (tooltipRef.current) tooltipRef.current.style.display = "block";
    if (hoverIndicatorRef.current) hoverIndicatorRef.current.style.display = "block";
  }, [enablePreview]);

  const hideTooltip = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.display = "none";
    if (hoverIndicatorRef.current) hoverIndicatorRef.current.style.display = "none";
  }, []);

  // ─── Apply thumbnail from VTT cue ────────────────────────────────────────
  const applyThumbnail = useCallback((time: number) => {
    if (!thumbRef.current || !thumbnailCuesRef.current.length) return;
    const cue = findThumbnailCue(thumbnailCuesRef.current, time);
    lastCueRef.current = cue;
    if (!cue) return;
    const el = thumbRef.current;
    el.style.backgroundImage = `url(${cue.url})`;
    el.style.backgroundPosition = `-${cue.x}px -${cue.y}px`;
    el.style.width = `${cue.w}px`;
    el.style.height = `${cue.h}px`;
  }, []);

  // ─── Geometry helpers ────────────────────────────────────────────────────
  const getTimeFromClientX = useCallback((clientX: number): number => {
    const rect = getRect();
    const dur = videoRef.current?.duration;
    if (!rect || rect.width === 0 || !dur || !isFinite(dur)) return 0;
    const pos = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return (pos / rect.width) * dur;
  }, [getRect, videoRef]);

  const getPxFromClientX = useCallback((clientX: number): number => {
    const rect = getRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(clientX - rect.left, rect.width));
  }, [getRect]);

  // ─── Keyboard handler ────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const ct = video.currentTime;
    const dur = isFinite(video.duration) ? video.duration : 0;

    switch (e.key) {
      case "ArrowLeft":
      case "ArrowRight": {
        e.preventDefault();
        e.nativeEvent.stopImmediatePropagation();
        const step = e.shiftKey ? 10 : 5;
        playerRef.seek(e.key === "ArrowLeft"
          ? Math.max(0, ct - step)
          : Math.min(dur, ct + step));
        break;
      }
      case "Home":
        e.preventDefault();
        e.nativeEvent.stopImmediatePropagation();
        playerRef.seek(0);
        break;
      case "End":
        if (dur > 0) {
          e.preventDefault();
          e.nativeEvent.stopImmediatePropagation();
          playerRef.seek(dur);
        }
        break;
    }
  }, [videoRef, playerRef]);

  // ─── Mouse handlers ───────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const time = getTimeFromClientX(e.clientX);
    const px = getPxFromClientX(e.clientX);

    hoverPosRef.current = px;
    hoverTimeRef.current = time;

    if (hoverIndicatorRef.current) hoverIndicatorRef.current.style.left = `${px}px`;
    if (hoverTimeTextRef.current) hoverTimeTextRef.current.textContent = formatTime(time);


    applyThumbnail(time);

    if (tooltipRef.current) {
      const tooltipWidth = tooltipRef.current.offsetWidth;
      const containerWidth = getRect()?.width ?? 0;
      const halfWidth = tooltipWidth / 2;
      const clampedLeft = Math.max(halfWidth, Math.min(px, containerWidth - halfWidth));
      tooltipRef.current.style.left = `${clampedLeft}px`;
    }

    if (isDraggingRef.current) playerRef.seek(time);
  }, [playerRef, applyThumbnail, getTimeFromClientX, getPxFromClientX, getRect]);

  const handleMouseLeave = useCallback(() => {
    hideTooltip();
    stopDragging();
  }, [hideTooltip, stopDragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    startDragging();
    playerRef.seek(getTimeFromClientX(e.clientX));
  }, [startDragging, getTimeFromClientX, playerRef]);


  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) playerRef.seek(getTimeFromClientX(e.clientX));
  }, [getTimeFromClientX, playerRef]);

  // ─── Touch handlers ───────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onTouchMove = (e: TouchEvent) => {
      if (isDraggingRef.current) e.preventDefault();
    };
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => container.removeEventListener("touchmove", onTouchMove);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    rectCacheRef.current = null;
    startDragging();
    playerRef.seek(getTimeFromClientX(e.touches[0].clientX));
  }, [startDragging, getTimeFromClientX, playerRef]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    playerRef.seek(getTimeFromClientX(e.touches[0].clientX));
  }, [getTimeFromClientX, playerRef]);


  // Release drag if pointer leaves the window
  useEffect(() => {
    const up = () => stopDragging();
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [stopDragging]);

  // ─── Buffered segments (memoised — only re-renders on progress event) ────
  const bufferedSegments = useMemo(() => {
    const video = videoRef.current;
    const dur = video && isFinite(video.duration) ? video.duration : 0;
    if (dur <= 0 || !bufferedRanges.length) return null;
    return bufferedRanges.map((range, i) => {
      const start = (range.start / dur) * 100;
      const width = ((range.end - range.start) / dur) * 100;
      return (
        <div
          key={i}
          className="bufferedSegment"
          style={{ left: `${start}%`, width: `${width}%` }}
        />
      );
    });
  }, [bufferedRanges, videoRef]);

  return (
    <div
      ref={containerRef}
      className="progressContainer"
      onMouseMove={handleMouseMove}
      onMouseEnter={showTooltip}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={stopDragging}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={stopDragging}
      onKeyDown={handleKeyDown}
      role="slider"
      aria-label="Video progress"
      aria-valuemin={0}
      aria-valuemax={0}
      aria-valuenow={0}
      aria-valuetext="0:00"
      tabIndex={0}
    >
      {/* Tooltip — always in DOM when preview enabled; shown/hidden imperatively */}
      {enablePreview && (
        <div
          ref={tooltipRef}
          className="previewTooltip"
          style={{ left: 0, display: "none" }}
          aria-hidden="true"
        >
          {thumbnailVtt && (
            <div ref={thumbRef} className="previewThumbnail" />
          )}
          <div ref={hoverTimeTextRef} className="previewTime" />
        </div>
      )}

      {/* Track */}
      <div className="progressBackground">
        {bufferedSegments}
        <div ref={progressFilledRef} className="progressFilled" style={{ width: "0%" }} />
        {enablePreview && (
          <div
            ref={hoverIndicatorRef}
            className="hoverIndicator"
            style={{ left: 0, display: "none" }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Scrub handle — class toggled imperatively for dragging state */}
      <div
        ref={scrubHandleRef}
        className="scrubHandle"
        style={{ left: "0%" }}
        aria-hidden="true"
      />
    </div>
  );
});

ProgressBar.displayName = "ProgressBar";

export default ProgressBar;
