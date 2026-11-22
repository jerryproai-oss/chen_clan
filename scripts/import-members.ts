/**
 * 匯入祭祖名單到資料庫
 *
 * 使用方式:
 *   DATABASE_URL=postgresql://... npx tsx scripts/import-members.ts [excel-path]
 *
 * 預設讀取: d:\Vibe Coding\Antigravity\clan宗親\祭祖名單_行政區劃分派.xlsx
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import ExcelJS from 'exceljs';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  const excelPath = process.argv[2] || 'd:\\Vibe Coding\\Antigravity\\clan宗親\\祭祖名單_行政區劃分派.xlsx';

  console.log('📂 讀取 Excel 檔案:', excelPath);

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    let totalImported = 0;
    let totalSkipped = 0;
    let serialNumber = 1;

    // 遍歷所有工作表
    for (const worksheet of workbook.worksheets) {
      const sheetName = worksheet.name;
      console.log(`\n📋 處理工作表: ${sheetName}`);

      let sheetImported = 0;

      // 讀取標題列（第一列）
      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        headers[colNumber] = String(cell.value || '').trim();
      });

      // 找出欄位索引
      const colMap: Record<string, number> = {};
      headers.forEach((h, i) => {
        const lower = h.toLowerCase();
        if (lower.includes('姓名') || lower === '名字' || lower === 'name') colMap['name'] = i;
        if (lower.includes('郵遞區號') || lower.includes('郵碼') || lower.includes('zip')) colMap['postalCode'] = i;
        if (lower.includes('縣市') || lower === 'city') colMap['city'] = i;
        if (lower.includes('區域') || lower.includes('行政區') || lower === 'district') colMap['district'] = i;
        if (lower.includes('里') || lower === 'village') colMap['village'] = i;
        if (lower.includes('地址') || lower === 'address') colMap['address'] = i;
        if (lower.includes('完整地址') || lower.includes('full')) colMap['fullAddress'] = i;
        if (lower.includes('電話') || lower.includes('phone') || lower.includes('tel')) colMap['phone'] = i;
        if (lower.includes('備註') || lower === 'note') colMap['note'] = i;
      });

      // 如果沒找到關鍵欄位，嘗試按位置猜測
      if (!colMap['name'] && !colMap['address']) {
        console.log(`  ⚠️  無法識別欄位標題，跳過此工作表`);
        continue;
      }

      // 遍歷資料列
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // 跳過標題列

        const getValue = (key: string): string | null => {
          const colIdx = colMap[key];
          if (!colIdx) return null;
          const cell = row.getCell(colIdx);
          const value = cell.value;
          if (value === null || value === undefined) return null;
          return String(value).trim() || null;
        };

        const name = getValue('name');
        const city = getValue('city');
        const address = getValue('address');

        // 至少要有姓名和城市
        if (!name || !city) {
          totalSkipped++;
          return;
        }

        // 收集資料（之後批次寫入）
        const record = {
          serialNumber: serialNumber++,
          name,
          postalCode: getValue('postalCode'),
          city,
          district: getValue('district'),
          village: getValue('village'),
          address: address || '',
          fullAddress: getValue('fullAddress') || `${city}${getValue('district') || ''}${address || ''}`,
          phone: getValue('phone'),
          note: getValue('note'),
          sourceSheet: sheetName,
          surveyStatus: 'PENDING' as const,
          version: 1,
        };

        // 使用同步方式記錄（之後批次處理）
        (worksheet as any).__records = (worksheet as any).__records || [];
        (worksheet as any).__records.push(record);
        sheetImported++;
      });

      // 批次寫入資料庫
      const records = (worksheet as any).__records || [];
      if (records.length > 0) {
        // 分批，每批 100 筆
        for (let i = 0; i < records.length; i += 100) {
          const batch = records.slice(i, i + 100);
          await prisma.member.createMany({
            data: batch,
          });
        }
        totalImported += records.length;
        console.log(`  ✅ 匯入 ${records.length} 筆`);
      }
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ 匯入完成！`);
    console.log(`   總匯入: ${totalImported} 筆`);
    console.log(`   略過:   ${totalSkipped} 筆`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
