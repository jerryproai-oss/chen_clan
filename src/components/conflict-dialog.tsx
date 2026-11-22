'use client';

import styles from './conflict-dialog.module.css';

export interface ConflictItem {
  id: string;
  name: string;
  currentVersion: number;
}

interface ConflictDialogProps {
  conflicts: ConflictItem[];
  onReload: () => void;
  onForceOverwrite: () => void;
  onClose: () => void;
}

export function ConflictDialog({
  conflicts,
  onReload,
  onForceOverwrite,
  onClose,
}: ConflictDialogProps) {
  if (conflicts.length === 0) return null;

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <span className={styles.warningIcon}>⚠️</span>
          <h3 className={styles.title}>資料衝突</h3>
        </div>
        <div className={styles.body}>
          <p className={styles.message}>
            以下 {conflicts.length} 筆記錄已被他人修改，無法儲存。請選擇操作方式：
          </p>
          <div className={styles.conflictList}>
            {conflicts.map((c) => (
              <div key={c.id} className={styles.conflictItem}>
                <span className={styles.conflictName}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.reloadBtn} onClick={onReload}>
            重新載入
          </button>
          <button type="button" className={styles.forceBtn} onClick={onForceOverwrite}>
            強制覆蓋
          </button>
        </div>
      </div>
    </div>
  );
}
