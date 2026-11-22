'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './page.module.css';

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待普查',
  CONFIRMED: '已確認',
  UPDATED: '已更新',
  NOT_FOUND: '查無此人',
  WRONG_ADDRESS: '地址有誤',
  MOVED: '已遷移',
  NEW: '新增',
};

const STATUS_OPTIONS = [
  { value: '', label: '全部狀態' },
  { value: 'PENDING', label: '待普查' },
  { value: 'CONFIRMED', label: '已確認' },
  { value: 'UPDATED', label: '已更新' },
  { value: 'NOT_FOUND', label: '查無此人' },
  { value: 'WRONG_ADDRESS', label: '地址有誤' },
  { value: 'MOVED', label: '已遷移' },
  { value: 'NEW', label: '新增' },
];

interface Member {
  id: string;
  serialNumber: number | null;
  name: string;
  city: string;
  district: string | null;
  address: string;
  surveyStatus: string;
}

interface ApiResponse {
  members: Member[];
  total: number;
  page: number;
  totalPages: number;
}

export default function MembersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<string[]>([]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (city) params.set('city', city);
      if (status) params.set('status', status);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/members?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  }, [search, city, status, page]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Fetch city list once
  useEffect(() => {
    fetch('/api/members?limit=1')
      .then((r) => r.json())
      .then(() => {
        // Extract unique cities from a broader query
        fetch('/api/members?limit=9999')
          .then((r) => r.json())
          .then((json: ApiResponse) => {
            const uniqueCities = [...new Set(json.members.map((m) => m.city))].sort();
            setCities(uniqueCities);
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const statusClass = (s: string) => {
    const key = `status${s}` as keyof typeof styles;
    return styles[key] || styles.statusPENDING;
  };

  const members = data?.members || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>宗親名單</h1>

      <form className={styles.filterBar} onSubmit={handleSearch}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="搜尋姓名..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className={styles.filterSelect}
          value={city}
          onChange={(e) => { setCity(e.target.value); setPage(1); }}
        >
          <option value="">全部縣市</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </form>

      {loading ? (
        <p className={styles.emptyState}>載入中...</p>
      ) : members.length === 0 ? (
        <p className={styles.emptyState}>找不到符合條件的宗親</p>
      ) : (
        <>
          {/* Desktop Table */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>序號</th>
                  <th>姓名</th>
                  <th>縣市</th>
                  <th>區域</th>
                  <th>地址</th>
                  <th>狀態</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => router.push(`/members/${m.id}`)}
                  >
                    <td>{m.serialNumber ?? '—'}</td>
                    <td><strong>{m.name}</strong></td>
                    <td>{m.city}</td>
                    <td>{m.district || '—'}</td>
                    <td>{m.address}</td>
                    <td>
                      <span className={statusClass(m.surveyStatus)}>
                        {STATUS_LABELS[m.surveyStatus] || m.surveyStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className={styles.cardList}>
            {members.map((m) => (
              <Link
                key={m.id}
                href={`/members/${m.id}`}
                className={styles.card}
              >
                <div className={styles.cardInfo}>
                  <span className={styles.cardName}>{m.name}</span>
                  <span className={styles.cardAddress}>
                    {m.city}{m.district || ''} {m.address}
                  </span>
                </div>
                <span className={statusClass(m.surveyStatus)}>
                  {STATUS_LABELS[m.surveyStatus] || m.surveyStatus}
                </span>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={page <= 1 ? styles.pageBtnDisabled : styles.pageBtn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="上一頁"
              >
                <ChevronLeft size={18} />
              </button>
              <span className={styles.pageInfo}>
                {page} / {totalPages}
              </span>
              <button
                className={page >= totalPages ? styles.pageBtnDisabled : styles.pageBtn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="下一頁"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
