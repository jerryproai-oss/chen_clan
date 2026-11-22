'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './status-dropdown.module.css';

const STATUS_OPTIONS = [
  { value: 'PENDING', label: '待普查' },
  { value: 'CONFIRMED', label: '已確認' },
  { value: 'UPDATED', label: '已更新' },
  { value: 'NOT_FOUND', label: '查無此人' },
  { value: 'WRONG_ADDRESS', label: '地址有誤' },
  { value: 'MOVED', label: '已遷移' },
  { value: 'NEW', label: '新增' },
];

interface StatusDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export function StatusDropdown({ value, onChange }: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLabel = STATUS_OPTIONS.find((o) => o.value === value)?.label || value;
  const statusClass = `status${value}` as keyof typeof styles;

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.trigger} ${styles[statusClass] || ''}`}
        onClick={() => setOpen(!open)}
      >
        {currentLabel}
        <span className={styles.triggerArrow}>▼</span>
      </button>
      {open && (
        <div className={styles.dropdown}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={opt.value === value ? styles.optionSelected : styles.option}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
