'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import styles from './login.module.css';

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setError('登入嘗試次數過多，請稍後再試');
        } else {
          setError(data.error ?? '帳號或密碼錯誤');
        }
        return;
      }

      // 成功：檢查是否需要首次改密碼
      if (data.requirePasswordChange) {
        router.push('/change-password?must=1');
      } else {
        router.push('/');
      }
      router.refresh();
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

      {/* 帳號 */}
      <div className={styles.field}>
        <label htmlFor="username" className={styles.label}>
          帳號
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          className={styles.input}
          placeholder="請輸入帳號"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
        />
      </div>

      {/* 密碼 */}
      <div className={styles.field}>
        <label htmlFor="password" className={styles.label}>
          密碼
        </label>
        <div className={styles.passwordWrapper}>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className={`${styles.input} ${styles.passwordInput}`}
            placeholder="請輸入密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff size={18} aria-hidden />
            ) : (
              <Eye size={18} aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* 登入按鈕 */}
      <button type="submit" className={styles.button} disabled={loading}>
        {loading ? '登入中…' : '登入'}
      </button>
    </form>
  );
}
