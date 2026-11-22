import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { hashPassword } from '../src/lib/auth/password';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // 檢查是否已有管理員
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (existingAdmin) {
      console.log('✅ 管理員帳號已存在:', existingAdmin.username);
      return;
    }

    const username = 'admin';
    const password = 'admin123';
    const passwordHash = await hashPassword(password);

    const admin = await prisma.user.create({
      data: {
        username,
        passwordHash,
        displayName: '系統管理員',
        role: 'ADMIN',
        status: 'ACTIVE',
        mustChangePassword: true,
      },
    });

    console.log('');
    console.log('✅ 管理員帳號建立成功！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  帳號:', username);
    console.log('  密碼:', password);
    console.log('  ID:  ', admin.id);
    console.log('━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⚠️  請在首次登入後立即變更密碼！');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
