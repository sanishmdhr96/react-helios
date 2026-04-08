"use client";

import { memo, useState, useRef, useEffect, useMemo } from "react";
import type { PlaybackRate, HLSQualityLevel, ManualQualityLevel } from "../../lib/types";

export interface SettingsMenuProps {
  currentRate: number;
  playbackRates: PlaybackRate[];
  onRateChange: (rate: PlaybackRate) => void;
  qualityLevels?: HLSQualityLevel[];
  /** User's selection: -1 = Auto, N = specific level. Controls the checkmark. */
  currentQualityLevel?: number;
  /** The level actually playing right now (used for the Auto badge). */
  playingQualityLevel?: number;
  onQualityChange?: (level: number) => void;
  showQualityMenu?: boolean;
  manualQualityLevels?: ManualQualityLevel[];
  activeManualSrc?: string;
  onManualQualityChange?: (src: string) => void;
  isAudioMode?: boolean;
}

type Panel = null | "speed" | "quality";

const SpeedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/>
  </svg>
);

const QualityIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
  </svg>
);

const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
  </svg>
);

const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
  </svg>
);

const SettingsMenu = memo<SettingsMenuProps>(({
  currentRate,
  playbackRates,
  onRateChange,
  qualityLevels = [],
  currentQualityLevel = -1,
  playingQualityLevel = -1,
  onQualityChange,
  showQualityMenu = false,
  manualQualityLevels,
  activeManualSrc,
  onManualQualityChange,
  isAudioMode = false,
}) => {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasHLSQuality = qualityLevels.length > 0 && !!onQualityChange;
  const hasManualQuality = !!manualQualityLevels?.length && !!onManualQualityChange;
  // Quality row is hidden in audio mode — quality only applies to video
  const hasQuality = !isAudioMode && (hasHLSQuality || hasManualQuality || showQualityMenu);

  // Reset to main panel when menu closes or audio mode changes (quality panel may become irrelevant)
  useEffect(() => {
    if (!open) setPanel(null);
  }, [open]);

  useEffect(() => {
    if (isAudioMode) setPanel((p) => (p === "quality" ? null : p));
  }, [isAudioMode]);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const sortedLevels = useMemo(
    () => [...qualityLevels].sort((a, b) => b.bitrate - a.bitrate),
    [qualityLevels],
  );

  const currentRateLabel = currentRate === 1 ? "Normal" : `${currentRate}×`;

  const currentQualityLabel = useMemo(() => {
    if (hasManualQuality && activeManualSrc) {
      return manualQualityLevels!.find((l) => l.src === activeManualSrc)?.label ?? "Auto";
    }
    if (hasHLSQuality) {
      if (currentQualityLevel === -1) {
        // Auto — show the currently playing level in parentheses if known
        const playingName = playingQualityLevel >= 0
          ? qualityLevels.find((l) => l.id === playingQualityLevel)?.name
          : null;
        return playingName ? `Auto (${playingName})` : "Auto";
      }
      return qualityLevels.find((l) => l.id === currentQualityLevel)?.name ?? "Auto";
    }
    return "Auto";
  }, [hasManualQuality, hasHLSQuality, activeManualSrc, manualQualityLevels, qualityLevels, currentQualityLevel, playingQualityLevel]);

  // Badge shown next to the "Auto" option in the sub-panel: "(1080p)"
  const autoQualityName = useMemo(() => {
    if (playingQualityLevel < 0) return null;
    return qualityLevels.find((l) => l.id === playingQualityLevel)?.name ?? null;
  }, [qualityLevels, playingQualityLevel]);

  return (
    <div ref={containerRef} className="settingsContainer">
      <button
        onClick={() => setOpen((o) => !o)}
        className="controlButton"
        aria-label="Settings"
        title="Settings"
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.02 7.02 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54a6.88 6.88 0 0 0-1.61.94l-2.39-.96a.488.488 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54a6.88 6.88 0 0 0 1.61-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 0 1 8.4 12 3.6 3.6 0 0 1 12 8.4a3.6 3.6 0 0 1 3.6 3.6 3.6 3.6 0 0 1-3.6 3.6z" />
        </svg>
      </button>

      {open && (
        <div className="settingsDropdown" role="menu">

          {/* ── Main panel ── */}
          {panel === null && (
            <div className="settingsMainPanel">
              <button
                className="settingsRow"
                onClick={() => setPanel("speed")}
              >
                <span className="settingsRowIcon"><SpeedIcon /></span>
                <span className="settingsRowLabel">Playback speed</span>
                <span className="settingsRowValue">{currentRateLabel}</span>
                <span className="settingsRowChevron"><ChevronRight /></span>
              </button>

              {hasQuality && (
                <button
                  className="settingsRow"
                  onClick={() => setPanel("quality")}
                >
                  <span className="settingsRowIcon"><QualityIcon /></span>
                  <span className="settingsRowLabel">Quality</span>
                  <span className="settingsRowValue">{currentQualityLabel}</span>
                  <span className="settingsRowChevron"><ChevronRight /></span>
                </button>
              )}
            </div>
          )}

          {/* ── Speed sub-panel ── */}
          {panel === "speed" && (
            <div className="settingsSubPanel">
              <button className="settingsBackRow" onClick={() => setPanel(null)}>
                <ChevronLeft />
                <span>Playback speed</span>
              </button>
              <div className="settingsDivider" />
              {playbackRates.map((rate) => {
                const isActive = currentRate === rate;
                return (
                  <button
                    key={rate}
                    onClick={() => { onRateChange(rate); setPanel(null); }}
                    className={`settingsOption${isActive ? " active" : ""}`}
                    role="menuitemradio"
                    aria-checked={isActive}
                  >
                    <span className="settingsOptionCheck">
                      {isActive && <CheckIcon />}
                    </span>
                    {rate === 1 ? "Normal" : `${rate}×`}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Quality sub-panel ── */}
          {panel === "quality" && (
            <div className="settingsSubPanel">
              <button className="settingsBackRow" onClick={() => setPanel(null)}>
                <ChevronLeft />
                <span>Quality</span>
              </button>
              <div className="settingsDivider" />

              {/* Manual quality levels */}
              {hasManualQuality && (
                <>
                  {manualQualityLevels!.map((level) => {
                    const isActive = activeManualSrc === level.src;
                    return (
                      <button
                        key={level.src}
                        onClick={() => { onManualQualityChange!(level.src); setPanel(null); }}
                        className={`settingsOption${isActive ? " active" : ""}`}
                        role="menuitemradio"
                        aria-checked={isActive}
                      >
                        <span className="settingsOptionCheck">
                          {isActive && <CheckIcon />}
                        </span>
                        {level.label}
                      </button>
                    );
                  })}
                  {hasHLSQuality && <div className="settingsDivider" />}
                </>
              )}

              {/* HLS quality levels */}
              {hasHLSQuality && (
                <>
                  <button
                    onClick={() => { onQualityChange!(-1); setPanel(null); }}
                    className={`settingsOption${currentQualityLevel === -1 ? " active" : ""}`}
                    role="menuitemradio"
                    aria-checked={currentQualityLevel === -1}
                  >
                    <span className="settingsOptionCheck">
                      {currentQualityLevel === -1 && <CheckIcon />}
                    </span>
                    <span>
                      Auto
                      {autoQualityName && (
                        <span className="settingsOptionBadge"> ({autoQualityName})</span>
                      )}
                    </span>
                  </button>
                  {sortedLevels.map((level) => {
                    const isActive = currentQualityLevel === level.id;
                    return (
                      <button
                        key={level.id}
                        onClick={() => { onQualityChange!(level.id); setPanel(null); }}
                        className={`settingsOption${isActive ? " active" : ""}`}
                        role="menuitemradio"
                        aria-checked={isActive}
                      >
                        <span className="settingsOptionCheck">
                          {isActive && <CheckIcon />}
                        </span>
                        <span style={{ flex: 1 }}>{level.name}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
});

SettingsMenu.displayName = "SettingsMenu";
export default SettingsMenu;
