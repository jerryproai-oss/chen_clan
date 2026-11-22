'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './user-form-modal.module.css';

const CITIES = [
  '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市',
  '基隆市', '新竹市', '嘉義市', '新竹縣', '苗栗縣', '彰化縣',
  '南投縣', '雲林縣', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '臺東縣', '澎湖縣', '金門縣', '連江縣',
];

const ROLES = [
  { value: 'VOLUNTEER', label: '志工' },
  { value: 'MANAGER', label: '總幹事' },
  { value: 'EDITOR', label: '編輯人員' },
  { value: 'CHAIRMAN', label: '董事長' },
  { value: 'ADMIN', label: '管理員' },
];

interface UserData {
  id: string;
  username: string;
  displayName: string;
  role: string;
  status: string;
  assignments: { city: string; district: string | null }[];
}

interface Assignment {
  city: string;
  district: string;
}

interface UserFormModalProps {
  user: UserData | null;
  onClose: () => void;
  onSave: () => void;
}

export function UserFormModal({ user, onClose, onSave }: UserFormModalProps) {
  const isEdit = !!user;

  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [role, setRole] = useState(user?.role || 'VOLUNTEER');
  const [assignments, setAssignments] = useState<Assignment[]>(
    user?.assignments.map((a) => ({
      city: a.city,
      district: a.district || '',
    })) || []
  );

  // New area inputs
  const [newCity, setNewCity] = useState('');
  const [newDistrict, setNewDistrict] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const addArea = () => {
    if (!newCity) return;
    // Avoid duplicates
    const exists = assignments.some(
      (a) => a.city === newCity && a.district === newDistrict
    );
    if (exists) return;

    setAssignments([...assignments, { city: newCity, district: newDistrict }]);
    setNewDistrict('');
  };

  const removeArea = (index: number) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError('');

    if (!isEdit && !username.trim()) {
      setError('請輸入帳號');
      return;
    }
    if (!isEdit && !password) {
      setError('請輸入密碼');
      return;
    }
    if (!displayName.trim()) {
      setError('請輸入顯示名稱');
      return;
    }

    setSaving(true);

    try {
      if (isEdit) {
        // Update user
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: displayName.trim(),
            role,
            assignments: assignments.map((a) => ({
              city: a.city,
              district: a.district || null,
            })),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '更新失敗');
        }
      } else {
        // Create user
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            password,
            displayName: displayName.trim(),
            role,
            assignments: assignments.map((a) => ({
              city: a.city,
              district: a.district || null,
            })),
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '新增失敗');
        }
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {isEdit ? '編輯使用者' : '新增使用者'}
          </h2>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                帳號 <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                className={styles.fieldInput}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isEdit}
                placeholder="登入帳號"
              />
            </div>

            {!isEdit && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  密碼 <span className={styles.required}>*</span>
                </label>
                <input
                  type="password"
                  className={styles.fieldInput}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="初始密碼"
                />
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                顯示名稱 <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                className={styles.fieldInput}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="使用者名稱"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>角色</label>
              <select
                className={styles.fieldSelect}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Area Assignments */}
          <div className={styles.areaSection}>
            <div className={styles.areaSectionTitle}>負責區域</div>

            {assignments.length > 0 && (
              <div className={styles.areaRow}>
                {assignments.map((a, i) => (
                  <span key={i} className={styles.areaTag}>
                    {a.city}{a.district && a.district}
                    <button
                      type="button"
                      className={styles.removeAreaBtn}
                      onClick={() => removeArea(i)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className={styles.addAreaRow}>
              <select
                className={styles.addAreaSelect}
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
              >
                <option value="">選擇縣市</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="text"
                className={styles.fieldInput}
                value={newDistrict}
                onChange={(e) => setNewDistrict(e.target.value)}
                placeholder="區域（選填）"
                style={{ flex: 1, minWidth: '100px' }}
              />
              <button
                type="button"
                className={styles.addAreaBtn}
                onClick={addArea}
                disabled={!newCity}
              >
                新增
              </button>
            </div>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose} type="button">
            取消
          </button>
          <button
            className={styles.saveBtn}
            onClick={handleSubmit}
            disabled={saving}
            type="button"
          >
            {saving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}
