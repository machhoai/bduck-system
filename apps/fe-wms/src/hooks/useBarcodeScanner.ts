"use client";

/**
 * useBarcodeScanner — Detects rapid keyboard input from physical barcode scanners
 *
 * HOW IT WORKS:
 * Physical barcode scanners emulate keyboard input — they type characters
 * extremely fast (~20-50ms between keystrokes) and end with Enter.
 *
 * This hook detects that pattern:
 * 1. Characters arrive faster than CHAR_INTERVAL_MS (100ms)
 * 2. Sequence ends with Enter key
 * 3. Buffer length >= MIN_LENGTH (3 chars)
 * 4. Calls onScan callback with the scanned string
 *
 * Manual typing is much slower (>150ms between chars) so it's filtered out.
 */

import { useEffect, useRef, useCallback } from "react";

interface UseBarcodeScaannerOptions {
  /** Callback when a barcode is detected */
  onScan: (barcode: string) => void;
  /** Max time between keystrokes in ms (default: 100) */
  charIntervalMs?: number;
  /** Min barcode length to trigger (default: 3) */
  minLength?: number;
  /** Whether the scanner is active */
  enabled?: boolean;
}

export function useBarcodeScanner({
  onScan,
  charIntervalMs = 100,
  minLength = 3,
  enabled = true,
}: UseBarcodeScaannerOptions) {
  const bufferRef = useRef("");
  const lastKeystrokeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetBuffer = useCallback(() => {
    bufferRef.current = "";
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const elapsed = now - lastKeystrokeRef.current;
      lastKeystrokeRef.current = now;

      // If too slow (manual typing), reset buffer
      if (elapsed > charIntervalMs && bufferRef.current.length > 0) {
        resetBuffer();
      }

      // Enter = end of barcode scan
      if (e.key === "Enter") {
        if (bufferRef.current.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          onScan(bufferRef.current.trim());
        }
        resetBuffer();
        return;
      }

      // Only accept printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bufferRef.current += e.key;

        // Safety: clear buffer after 500ms of no input
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          resetBuffer();
        }, 500);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onScan, charIntervalMs, minLength, enabled, resetBuffer]);
}
