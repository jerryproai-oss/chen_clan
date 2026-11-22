import LoginForm from './login-form';
import styles from './login.module.css';

export const metadata = {
  title: '登入 · 宗親普查系統',
};

export default function LoginPage() {
  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>🏠</div>
          <h1 className={styles.title}>宗親普查系統</h1>
          <p className={styles.subtitle}>祭祖名單普查管理</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
