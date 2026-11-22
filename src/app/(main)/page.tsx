import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionFromCookie } from '@/lib/auth/session';
import { prisma } from '@/lib/db/client';
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

function timeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '剛才';
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

interface CityStats {
  city: string;
  total: number;
  surveyed: number;
}

interface RecentItem {
  id: string;
  name: string;
  surveyStatus: string;
  surveyedAt: Date | null;
  surveyedBy: { displayName: string } | null;
}

interface AdminData {
  totalMembers: number;
  surveyed: number;
  pending: number;
  newCount: number;
  byCity: CityStats[];
  recentActivity: RecentItem[];
}

interface ManagerData {
  totalMembers: number;
  surveyed: number;
  pending: number;
  team: { displayName: string; surveyed: number; areas: string }[];
}

interface VolunteerData {
  totalAssigned: number;
  mySurveyed: number;
  pendingList: { id: string; name: string; city: string; district: string | null; address: string }[];
}

async function getAdminDashboard(): Promise<AdminData> {
  const [
    totalMembers,
    statusCounts,
    cityCounts,
    recentActivity,
  ] = await Promise.all([
    prisma.member.count(),
    prisma.member.groupBy({
      by: ['surveyStatus'],
      _count: true,
    }),
    prisma.member.groupBy({
      by: ['city'],
      _count: true,
    }),
    prisma.member.findMany({
      where: { surveyedAt: { not: null } },
      orderBy: { surveyedAt: 'desc' },
      take: 10,
      include: { surveyedBy: { select: { displayName: true } } },
    }),
  ]);

  // Get surveyed count per city
  const cityStats = await prisma.member.groupBy({
    by: ['city'],
    where: { surveyStatus: { not: 'PENDING' } },
    _count: true,
  });

  const cityMap = new Map<string, { total: number; surveyed: number }>();
  for (const c of cityCounts) {
    cityMap.set(c.city, { total: c._count, surveyed: 0 });
  }
  for (const cs of cityStats) {
    const existing = cityMap.get(cs.city);
    if (existing) existing.surveyed = cs._count;
  }

  const statusMap: Record<string, number> = {};
  for (const s of statusCounts) {
    statusMap[s.surveyStatus] = s._count;
  }
  const surveyed = totalMembers - (statusMap['PENDING'] || 0);
  const newCount = statusMap['NEW'] || 0;

  return {
    totalMembers,
    surveyed,
    pending: statusMap['PENDING'] || 0,
    newCount,
    byCity: Array.from(cityMap.entries()).map(([city, data]) => ({
      city,
      total: data.total,
      surveyed: data.surveyed,
    })),
    recentActivity: recentActivity as RecentItem[],
  };
}

async function getManagerDashboard(
  assignments: { city: string; district: string | null }[]
): Promise<ManagerData> {
  const cities = assignments.map((a) => a.city);

  const [totalMembers, statusCounts, teamMembers] = await Promise.all([
    prisma.member.count({ where: { city: { in: cities } } }),
    prisma.member.groupBy({
      by: ['surveyStatus'],
      where: { city: { in: cities } },
      _count: true,
    }),
    prisma.user.findMany({
      where: {
        role: 'VOLUNTEER',
        status: 'ACTIVE',
        assignments: { some: { city: { in: cities } } },
      },
      include: {
        _count: {
          select: { surveyedMembers: true },
        },
        assignments: true,
      },
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const s of statusCounts) {
    statusMap[s.surveyStatus] = s._count;
  }
  const surveyed = totalMembers - (statusMap['PENDING'] || 0);

  return {
    totalMembers,
    surveyed,
    pending: statusMap['PENDING'] || 0,
    team: teamMembers.map((u: { displayName: string; _count: { surveyedMembers: number }; assignments: { city: string; district: string | null }[] }) => ({
      displayName: u.displayName,
      surveyed: u._count.surveyedMembers,
      areas: u.assignments
        .map((a: { city: string; district: string | null }) => (a.district ? `${a.city}${a.district}` : a.city))
        .join('、'),
    })),
  };
}

async function getVolunteerDashboard(
  userId: string,
  assignments: { city: string; district: string | null }[]
): Promise<VolunteerData> {
  const cities = assignments.map((a) => a.city);

  const [totalAssigned, mySurveyed, pendingList] = await Promise.all([
    prisma.member.count({ where: { city: { in: cities } } }),
    prisma.member.count({ where: { surveyedById: userId } }),
    prisma.member.findMany({
      where: { city: { in: cities }, surveyStatus: 'PENDING' },
      take: 5,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, city: true, district: true, address: true },
    }),
  ]);

  return {
    totalAssigned,
    mySurveyed,
    pendingList,
  };
}

export default async function DashboardPage() {
  const session = await getSessionFromCookie();
  if (!session) redirect('/login');

  const { user } = session;
  const role = user.role;

  return (
    <div className={styles.page}>
      <div className={styles.greeting}>
        <h1 className={styles.greetingTitle}>
          你好，{user.displayName}
        </h1>
        <p className={styles.greetingSubtitle}>
          {role === 'ADMIN'
            ? '系統管理員總覽'
            : role === 'CHAIRMAN'
              ? '董事長總覽'
              : role === 'MANAGER'
                ? '區域管理總覽'
                : '我的普查進度'}
        </p>
      </div>

      {(role === 'ADMIN' || role === 'CHAIRMAN') && <AdminDashboard />}
      {role === 'MANAGER' && <ManagerDashboard assignments={user.assignments} />}
      {role === 'VOLUNTEER' && (
        <VolunteerDashboard userId={user.id} assignments={user.assignments} />
      )}
    </div>
  );
}

async function AdminDashboard() {
  const data = await getAdminDashboard();

  return (
    <>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>總人數</span>
          <span className={styles.statValuePrimary}>{data.totalMembers.toLocaleString()}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>已普查</span>
          <span className={styles.statValueSuccess}>{data.surveyed.toLocaleString()}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>未普查</span>
          <span className={styles.statValueWarning}>{data.pending.toLocaleString()}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>新增</span>
          <span className={styles.statValueInfo}>{data.newCount.toLocaleString()}</span>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>各縣市進度</h2>
        {data.byCity.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>縣市</th>
                <th>總數</th>
                <th>已普查</th>
                <th>進度</th>
              </tr>
            </thead>
            <tbody>
              {data.byCity.map((city) => {
                const pct = city.total > 0 ? Math.round((city.surveyed / city.total) * 100) : 0;
                return (
                  <tr key={city.city}>
                    <td>{city.city}</td>
                    <td>{city.total}</td>
                    <td>{city.surveyed}</td>
                    <td>
                      <div className={styles.progressBarContainer}>
                        <div
                          className={styles.progressBarFill}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={styles.progressText}>{pct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className={styles.emptyState}>尚無資料</p>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>最近普查活動</h2>
        {data.recentActivity.length > 0 ? (
          <ul className={styles.activityList}>
            {data.recentActivity.map((item) => (
              <li key={item.id} className={styles.activityItem}>
                <span className={styles.activityName}>{item.name}</span>
                <span className={styles.activityDetail}>
                  {STATUS_LABELS[item.surveyStatus] || item.surveyStatus}
                  {item.surveyedBy && ` — ${item.surveyedBy.displayName}`}
                </span>
                {item.surveyedAt && (
                  <span className={styles.activityTime}>
                    {timeAgo(item.surveyedAt)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyState}>尚無普查活動</p>
        )}
      </div>
    </>
  );
}

async function ManagerDashboard({
  assignments,
}: {
  assignments: { city: string; district: string | null }[];
}) {
  const data = await getManagerDashboard(assignments);

  return (
    <>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>區域總人數</span>
          <span className={styles.statValuePrimary}>{data.totalMembers.toLocaleString()}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>已普查</span>
          <span className={styles.statValueSuccess}>{data.surveyed.toLocaleString()}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>未普查</span>
          <span className={styles.statValueWarning}>{data.pending.toLocaleString()}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>完成率</span>
          <span className={styles.statValueInfo}>
            {data.totalMembers > 0
              ? Math.round((data.surveyed / data.totalMembers) * 100)
              : 0}%
          </span>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>團隊志工進度</h2>
        {data.team.length > 0 ? (
          <div className={styles.teamList}>
            {data.team.map((member) => (
              <div key={member.displayName} className={styles.teamCard}>
                <div>
                  <div className={styles.teamName}>{member.displayName}</div>
                  <div className={styles.teamProgress}>
                    負責區域：{member.areas || '未指定'}
                  </div>
                </div>
                <div className={styles.teamProgress}>
                  已普查 {member.surveyed} 筆
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>尚無團隊成員</p>
        )}
      </div>
    </>
  );
}

async function VolunteerDashboard({
  userId,
  assignments,
}: {
  userId: string;
  assignments: { city: string; district: string | null }[];
}) {
  const data = await getVolunteerDashboard(userId, assignments);

  return (
    <>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>區域總人數</span>
          <span className={styles.statValuePrimary}>{data.totalAssigned.toLocaleString()}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>我已普查</span>
          <span className={styles.statValueSuccess}>{data.mySurveyed.toLocaleString()}</span>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>待普查名單</h2>
        {data.pendingList.length > 0 ? (
          <div className={styles.quickActions}>
            {data.pendingList.map((member) => (
              <Link
                key={member.id}
                href={`/members/${member.id}`}
                className={styles.quickActionBtn}
              >
                <strong>{member.name}</strong>
                <span>
                  {member.city}
                  {member.district && member.district}
                </span>
              </Link>
            ))}
            <Link href="/members?status=PENDING" className={styles.quickActionBtn}>
              查看全部待普查 →
            </Link>
          </div>
        ) : (
          <p className={styles.emptyState}>🎉 所有宗親已完成普查！</p>
        )}
      </div>
    </>
  );
}
