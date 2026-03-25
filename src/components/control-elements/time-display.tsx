"use client";

import { memo, useRef, useEffect } from "react";
import { formatTime } from "../../lib/format";

export interface TimeDisplayProps {
  videoRef: React.RefObject<HTMLMediaElement | null>;
  isLive?: boolean;
  isAudioMode?: boolean;
}

/**
 * TimeDisplay subscribes directly to the video element's timeupdate and
 * durationchange events, updating the DOM via refs. It never re-renders
 * during playback — only when isLive changes (once per source change).
 */
const TimeDisplay = memo<TimeDisplayProps>(({ videoRef, isLive = false, isAudioMode = false }) => {
  const currentRef  = useRef<HTMLSpanElement>(null);
  const durationRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => {
      if (currentRef.current)
        currentRef.current.textContent = formatTime(video.currentTime);
    };

    const updateDuration = () => {
      if (durationRef.current) {
        const dur = isFinite(video.duration) ? video.duration : 0;
        durationRef.current.textContent = ` / ${formatTime(dur)}`;
      }
    };

    video.addEventListener("timeupdate",     updateTime);
    video.addEventListener("durationchange", updateDuration);
    video.addEventListener("seeked",         updateTime);

    updateTime();
    updateDuration();

    return () => {
      video.removeEventListener("timeupdate",     updateTime);
      video.removeEventListener("durationchange", updateDuration);
      video.removeEventListener("seeked",         updateTime);
    };
  }, [videoRef, isLive, isAudioMode]);

  if (isLive) {
    return (
      <span className="timeDisplay" style={{ opacity: 0.7 }}>
        <span ref={currentRef}>0:00</span>
      </span>
    );
  }

  return (
    <span className="timeDisplay">
      <span ref={currentRef}>0:00</span>
      <span ref={durationRef} style={{ opacity: 0.6 }}> / 0:00</span>
    </span>
  );
});

TimeDisplay.displayName = "TimeDisplay";
export default TimeDisplay;
