'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { InlineEditTable, InlineMember } from '@/components/inline-edit-table';
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
  phone: string | null;
  surveyStatus: string;
  version: number;
}

interface ApiResponse {
  members: Member[];
  total: number;
  page: number;
  totalPages: number;
}

interface CityInfo {
  name: string;
  count: number;
  geoOrder: number;
}

type CitySortMode = 'count' | 'northToSouth' | 'southToNorth';

const SORT_LABELS: Record<CitySortMode, string> = {
  count: '📊 依筆數',
  northToSouth: '🧭 由北到南',
  southToNorth: '🧭 由南到北',
};

interface UserInfo {
  role: string;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export default function MembersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<CityInfo[]>([]);
  const [citySortMode, setCitySortMode] = useState<CitySortMode>('count');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Debounce search input (300ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Fetch current user info
  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data: { user: UserInfo }) => setUserInfo(data.user))
      .catch(() => {});
  }, []);

  const isEditor = userInfo?.role === 'EDITOR';
  const pageLimit = isEditor ? 50 : 20;

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (city) params.set('city', city);
      if (status) params.set('status', status);
      params.set('page', String(page));
      params.set('limit', String(pageLimit));

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
  }, [debouncedSearch, city, status, page, pageLimit]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Fetch city list once from dedicated API
  useEffect(() => {
    fetch('/api/members/cities')
      .then((r) => r.json())
      .then((data: { cities: CityInfo[] }) => {
        setCities(data.cities || []);
      })
      .catch(() => {});
  }, []);

  // Sort cities based on selected mode
  const sortedCities = cities.toSorted((a, b) => {
    if (citySortMode === 'count') return b.count - a.count;
    if (citySortMode === 'northToSouth') return a.geoOrder - b.geoOrder;
    return b.geoOrder - a.geoOrder; // southToNorth
  });

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
  const total = data?.total || 0;

  const showInlineEdit = isEditor && isDesktop;

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>宗親名單</h1>

      <form className={styles.filterBar} onSubmit={handleSearch}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="搜尋姓名..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={city}
          onChange={(e) => { setCity(e.target.value); setPage(1); }}
        >
          <option value="">全部縣市</option>
          {sortedCities.map((c) => (
            <option key={c.name} value={c.name}>{c.name}（{c.count}）</option>
          ))}
        </select>
        <select
          className={styles.sortSelect}
          value={citySortMode}
          onChange={(e) => setCitySortMode(e.target.value as CitySortMode)}
          title="縣市排序方式"
        >
          {(Object.entries(SORT_LABELS) as [CitySortMode, string][]).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
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
      ) : showInlineEdit ? (
        /* ── EDITOR Inline Edit Table (desktop ≥ 1024px) ── */
        <>
          <InlineEditTable
            members={members as InlineMember[]}
            onRefresh={fetchMembers}
          />

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
                共 {total.toLocaleString()} 筆　{page} / {totalPages} 頁
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
      ) : (
        /* ── Standard View (all roles, or EDITOR on mobile) ── */
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
                共 {total.toLocaleString()} 筆　{page} / {totalPages} 頁
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
