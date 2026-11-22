'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './editable-cell.module.css';

interface EditableCellProps {
  value: string;
  onChange: (value: string) => void;
  onTab?: () => void;
  onEnter?: () => void;
  placeholder?: string;
  type?: 'text' | 'tel';
}

export function EditableCell({
  value,
  onChange,
  onTab,
  onEnter,
  placeholder = '',
  type = 'text',
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      commit();
      onTab?.();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit();
      onEnter?.();
    } else if (e.key === 'Escape') {
      setLocalValue(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className={styles.cellEditing}>
        <input
          ref={inputRef}
          type={type}
          className={styles.input}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }

  return (
    <div className={styles.cell} onClick={() => setEditing(true)}>
      {value || <span className={styles.placeholder}>{placeholder || '—'}</span>}
    </div>
  );
}
