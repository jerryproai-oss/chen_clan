import Link from 'next/link';
import { FontSizeSwitcher } from './font-size-switcher';
import styles from './header.module.css';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理員',
  CHAIRMAN: '董事長',
  MANAGER: '總幹事',
  VOLUNTEER: '志工',
};

interface HeaderProps {
  user: {
    displayName: string;
    role: string;
  };
}

export function Header({ user }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.title}>宗親普查系統</span>
        <span className={styles.titleShort}>普查系統</span>
      </div>

      <div className={styles.right}>
        {/* Desktop navigation links */}
        <nav className={styles.desktopNav}>
          <Link href="/" className={styles.navLink}>首頁</Link>
          <Link href="/members" className={styles.navLink}>名單</Link>
          <Link href="/members/new" className={styles.navLink}>新增</Link>
          {user.role === 'ADMIN' && (
            <Link href="/admin" className={styles.navLink}>管理</Link>
          )}
          <form action="/api/auth/logout" method="POST" style={{ display: 'contents' }}>
            <button type="submit" className={styles.navLink}>登出</button>
          </form>
        </nav>

        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.displayName}</span>
          <span className={styles.roleBadge}>
            {ROLE_LABELS[user.role] || user.role}
          </span>
        </div>

        <FontSizeSwitcher />
      </div>
    </header>
  );
}
