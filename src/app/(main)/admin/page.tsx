'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Pencil, KeyRound, UserX, UserCheck } from 'lucide-react';
import { UserFormModal } from '@/components/user-form-modal';
import styles from './page.module.css';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理員',
  CHAIRMAN: '董事長',
  EDITOR: '編輯人員',
  MANAGER: '總幹事',
  VOLUNTEER: '志工',
};

interface UserData {
  id: string;
  username: string;
  displayName: string;
  role: string;
  status: string;
  assignments: { city: string; district: string | null }[];
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.status === 403) {
        // Not admin — redirect
        window.location.href = '/';
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleResetPassword = async (userId: string) => {
    if (!confirm('確定要重設此使用者密碼？')) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`密碼已重設為：${data.temporaryPassword}\n請通知使用者登入後修改密碼。`);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '重設密碼失敗');
      }
    } catch {
      alert('重設密碼失敗');
    }
  };

  const handleToggleStatus = async (user: UserData) => {
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const action = newStatus === 'INACTIVE' ? '停用' : '啟用';
    if (!confirm(`確定要${action}使用者 ${user.displayName}？`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchUsers();
      } else {
        alert(`${action}失敗`);
      }
    } catch {
      alert(`${action}失敗`);
    }
  };

  const handleEdit = (user: UserData) => {
    setEditingUser(user);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingUser(null);
  };

  const handleModalSave = () => {
    setModalOpen(false);
    setEditingUser(null);
    fetchUsers();
  };

  const roleBadgeClass = (role: string) => {
    const key = `role${role}` as keyof typeof styles;
    return styles[key] || styles.roleBadge;
  };

  if (loading) {
    return <div className={styles.page}><p>載入中...</p></div>;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>使用者管理</h1>

      <div className={styles.toolbar}>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'calc(var(--font-size-base) * 0.9)' }}>
          共 {users.length} 位使用者
        </span>
        <button className={styles.addBtn} onClick={handleAdd}>
          <UserPlus size={18} /> 新增使用者
        </button>
      </div>

      {/* Desktop Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>帳號</th>
              <th>名稱</th>
              <th>角色</th>
              <th>負責區域</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td><strong>{user.displayName}</strong></td>
                <td>
                  <span className={roleBadgeClass(user.role)}>
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                </td>
                <td>
                  {user.assignments.length > 0
                    ? user.assignments.map((a) => a.district ? `${a.city}${a.district}` : a.city).join('、')
                    : '—'}
                </td>
                <td>
                  <span className={user.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive}>
                    {user.status === 'ACTIVE' ? '啟用' : '停用'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => handleEdit(user)}
                      title="編輯"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className={styles.actionBtn}
                      onClick={() => handleResetPassword(user.id)}
                      title="重設密碼"
                    >
                      <KeyRound size={16} />
                    </button>
                    <button
                      className={styles.actionBtnDanger}
                      onClick={() => handleToggleStatus(user)}
                      title={user.status === 'ACTIVE' ? '停用' : '啟用'}
                    >
                      {user.status === 'ACTIVE' ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className={styles.cardList}>
        {users.map((user) => (
          <div key={user.id} className={styles.card}>
            <div className={styles.cardInfo}>
              <span className={styles.cardName}>{user.displayName}</span>
              <span className={styles.cardMeta}>
                @{user.username} ·{' '}
                <span className={roleBadgeClass(user.role)}>
                  {ROLE_LABELS[user.role] || user.role}
                </span>
                {' · '}
                <span className={user.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive}>
                  {user.status === 'ACTIVE' ? '啟用' : '停用'}
                </span>
              </span>
            </div>
            <div className={styles.cardActions}>
              <button className={styles.actionBtn} onClick={() => handleEdit(user)} title="編輯">
                <Pencil size={16} />
              </button>
              <button className={styles.actionBtn} onClick={() => handleResetPassword(user.id)} title="重設密碼">
                <KeyRound size={16} />
              </button>
              <button className={styles.actionBtnDanger} onClick={() => handleToggleStatus(user)} title={user.status === 'ACTIVE' ? '停用' : '啟用'}>
                {user.status === 'ACTIVE' ? <UserX size={16} /> : <UserCheck size={16} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <p className={styles.emptyState}>尚無使用者</p>
      )}

      {modalOpen && (
        <UserFormModal
          user={editingUser}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
