'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import styles from './change-password-form.module.css';

export default function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 前端驗證
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('請填寫所有欄位');
      return;
    }

    if (newPassword.length < 6) {
      setError('新密碼至少需要 6 個字元');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('新密碼與確認密碼不一致');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? '密碼變更失敗');
        return;
      }

      setSuccess('密碼已成功變更，即將跳轉…');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1500);
    } catch {
      setError('無法連線至伺服器，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* 錯誤訊息 */}
      {error && (
        <div className={styles.errorBox} role="alert">
          <AlertCircle size={18} className={styles.errorIcon} aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {/* 成功訊息 */}
      {success && (
        <div className={styles.successBox} role="status">
          <CheckCircle size={18} aria-hidden />
          <span>{success}</span>
        </div>
      )}

      {/* 目前密碼 */}
      <div className={styles.field}>
        <label htmlFor="currentPassword" className={styles.label}>
          目前密碼
        </label>
        <div className={styles.passwordWrapper}>
          <input
            id="currentPassword"
            name="currentPassword"
            type={showCurrent ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className={`${styles.input} ${styles.passwordInput}`}
            placeholder="請輸入目前密碼"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowCurrent((v) => !v)}
            aria-label={showCurrent ? '隱藏密碼' : '顯示密碼'}
            tabIndex={-1}
          >
            {showCurrent ? (
              <EyeOff size={18} aria-hidden />
            ) : (
              <Eye size={18} aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* 新密碼 */}
      <div className={styles.field}>
        <label htmlFor="newPassword" className={styles.label}>
          新密碼
        </label>
        <div className={styles.passwordWrapper}>
          <input
            id="newPassword"
            name="newPassword"
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            required
            className={`${styles.input} ${styles.passwordInput}`}
            placeholder="至少 6 個字元"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowNew((v) => !v)}
            aria-label={showNew ? '隱藏密碼' : '顯示密碼'}
            tabIndex={-1}
          >
            {showNew ? (
              <EyeOff size={18} aria-hidden />
            ) : (
              <Eye size={18} aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* 確認新密碼 */}
      <div className={styles.field}>
        <label htmlFor="confirmPassword" className={styles.label}>
          確認新密碼
        </label>
        <div className={styles.passwordWrapper}>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            required
            className={`${styles.input} ${styles.passwordInput}`}
            placeholder="請再次輸入新密碼"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? '隱藏密碼' : '顯示密碼'}
            tabIndex={-1}
          >
            {showConfirm ? (
              <EyeOff size={18} aria-hidden />
            ) : (
              <Eye size={18} aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* 送出按鈕 */}
      <button type="submit" className={styles.button} disabled={loading}>
        {loading ? '變更中…' : '確認變更密碼'}
      </button>
    </form>
  );
}
