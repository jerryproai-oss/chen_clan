import { redirect } from 'next/navigation';
import { getSessionFromCookie } from '@/lib/auth/session';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import styles from './layout.module.css';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromCookie();
  if (!session) redirect('/login');

  // 如果需要改密碼，導向改密碼頁面
  if (session.user.mustChangePassword) {
    redirect('/change-password?must=1');
  }

  return (
    <div className={styles.layoutWrapper}>
      <Header
        user={{
          displayName: session.user.displayName,
          role: session.user.role,
        }}
      />
      <main className={styles.mainContent}>{children}</main>
      <BottomNav userRole={session.user.role} />
    </div>
  );
}
