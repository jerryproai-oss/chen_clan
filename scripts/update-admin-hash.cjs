// 更新 admin 密碼為 bcrypt 格式
const bcrypt = require('bcryptjs');
const pg = require('pg');

async function main() {
  const hash = await bcrypt.hash('admin123', 12);
  console.log('New bcrypt hash:', hash);
  
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const result = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE username = $2',
    [hash, 'admin']
  );
  console.log('Updated', result.rowCount, 'rows');
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
