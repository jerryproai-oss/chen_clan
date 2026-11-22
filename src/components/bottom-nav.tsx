'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, PlusCircle, Settings } from 'lucide-react';
import styles from './bottom-nav.module.css';

interface BottomNavProps {
  userRole: string;
}

import type { LucideIcon } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  hideFor?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '首頁', icon: LayoutDashboard },
  { href: '/members', label: '名單', icon: Users },
  { href: '/members/new', label: '新增', icon: PlusCircle },
  { href: '/admin', label: '管理', icon: Settings, adminOnly: true },
];

export function BottomNav({ userRole }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map((item) => {
        if (item.adminOnly && userRole !== 'ADMIN') return null;

        const isActive =
          item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? styles.navItemActive : styles.navItem}
          >
            <Icon className={styles.icon} size={22} />
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
