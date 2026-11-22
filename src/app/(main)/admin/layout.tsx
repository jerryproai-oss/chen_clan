import { redirect } from 'next/navigation';
import { getSessionFromCookie } from '@/lib/auth/session';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromCookie();
  if (!session) redirect('/login');

  // 僅 ADMIN 可存取管理頁面
  if (session.user.role !== 'ADMIN') {
    redirect('/');
  }

  return <>{children}</>;
}
