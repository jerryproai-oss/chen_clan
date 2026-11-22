'use client';

import styles from './batch-save-bar.module.css';

interface BatchSaveBarProps {
  modifiedCount: number;
  onSaveAll: () => void;
  onCancelAll: () => void;
  saving?: boolean;
}

export function BatchSaveBar({
  modifiedCount,
  onSaveAll,
  onCancelAll,
  saving = false,
}: BatchSaveBarProps) {
  if (modifiedCount === 0) return null;

  return (
    <div className={styles.bar}>
      <span className={styles.info}>
        已修改 <span className={styles.count}>{modifiedCount}</span> 筆
      </span>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={onSaveAll}
          disabled={saving}
        >
          💾 {saving ? '儲存中...' : '儲存全部'}
        </button>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={onCancelAll}
          disabled={saving}
        >
          ↩ 取消修改
        </button>
      </div>
    </div>
  );
}
