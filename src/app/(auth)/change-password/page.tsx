import ChangePasswordForm from '@/components/change-password-form';
import styles from '../login/login.module.css';

export const metadata = {
  title: '變更密碼 · 宗親普查系統',
};

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ must?: string }>;
}) {
  const params = await searchParams;
  const isMustChange = params.must === '1';

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>🔑</div>
          <h1 className={styles.title}>變更密碼</h1>
          {isMustChange && (
            <p className={styles.subtitle}>首次登入，請設定新密碼</p>
          )}
        </div>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
