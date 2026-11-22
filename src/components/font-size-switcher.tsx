'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './font-size-switcher.module.css';

const FONT_SIZES = [16, 18, 20, 22, 24] as const;
type FontSize = (typeof FONT_SIZES)[number];
const STORAGE_KEY = 'clan-font-size';
const DEFAULT_SIZE: FontSize = 20;

export function FontSizeSwitcher() {
  const [currentSize, setCurrentSize] = useState<FontSize>(DEFAULT_SIZE);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10) as FontSize;
      if (FONT_SIZES.includes(parsed)) {
        setCurrentSize(parsed);
        document.documentElement.setAttribute('data-font-size', String(parsed));
      }
    } else {
      // Apply default
      document.documentElement.setAttribute('data-font-size', String(DEFAULT_SIZE));
    }
  }, []);

  const changeSize = useCallback((direction: 'up' | 'down') => {
    setCurrentSize((prev) => {
      const idx = FONT_SIZES.indexOf(prev);
      const nextIdx = direction === 'up' ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= FONT_SIZES.length) return prev;

      const newSize = FONT_SIZES[nextIdx];
      document.documentElement.setAttribute('data-font-size', String(newSize));
      localStorage.setItem(STORAGE_KEY, String(newSize));

      // Save to server (fire-and-forget)
      fetch('/api/me/font-size', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fontSize: String(newSize) }),
      }).catch(() => {
        // Silently fail — localStorage is the primary store
      });

      return newSize;
    });
  }, []);

  const currentIdx = FONT_SIZES.indexOf(currentSize);
  const percentage = Math.round((currentSize / 16) * 100);

  return (
    <div className={styles.container}>
      <button
        className={styles.btn}
        onClick={() => changeSize('down')}
        disabled={currentIdx === 0}
        aria-label="縮小字體"
        type="button"
      >
        A-
      </button>
      <span className={styles.level}>{percentage}%</span>
      <button
        className={styles.btn}
        onClick={() => changeSize('up')}
        disabled={currentIdx === FONT_SIZES.length - 1}
        aria-label="放大字體"
        type="button"
      >
        A+
      </button>
    </div>
  );
}
