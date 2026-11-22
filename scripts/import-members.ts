/**
 * 匯入祭祖名單到資料庫
 *
 * 使用方式:
 *   DATABASE_URL=postgresql://... npx tsx scripts/import-members.ts [excel-path]
 *
 * 預設讀取: d:\Vibe Coding\Antigravity\clan宗親\祭祖名單_行政區劃分派.xlsx
 *
 * Excel 結構（每個城市工作表）:
 *   Row 1: 標題（合併儲存格）— e.g. "台南市 — 祭祖名單..."
 *   Row 2: 區劃分布摘要（合併儲存格）
 *   Row 3: 空列
 *   Row 4: 欄位標題 — 序號 | 姓名 | 郵遞區號 | 區/鎮/鄉/市 | 里/村 | 完整地址 | 電話 | 備註 | 標籤 | 資料問題
 *   Row 5+: 區塊標題（▶ 開頭，合併儲存格）夾雜資料列
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import ExcelJS from 'exceljs';

// 已知的欄位對應（依據 Row 4 的順序）
// A=序號, B=姓名, C=郵遞區號, D=區/鎮/鄉/市, E=里/村, F=完整地址, G=電話, H=備註, I=標籤, J=資料問題
const KNOWN_COLUMNS = {
  serial: 1,     // A
  name: 2,       // B
  postalCode: 3, // C
  district: 4,   // D
  village: 5,    // E
  fullAddress: 6, // F
  phone: 7,      // G
  note: 8,       // H
  label: 9,      // I
  dataIssue: 10, // J
};

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
    // 先清空現有資料（避免重複匯入）
    const existingCount = await prisma.member.count();
    if (existingCount > 0) {
      console.log(`⚠️  資料庫已有 ${existingCount} 筆資料，先清空...`);
      await prisma.member.deleteMany();
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    let totalImported = 0;
    let totalSkipped = 0;
    let globalSerialNumber = 1;

    // 跳過非資料工作表
    const skipSheets = ['統計總覽', '資料品質報告'];

    for (const worksheet of workbook.worksheets) {
      const sheetName = worksheet.name;
      if (skipSheets.includes(sheetName)) {
        console.log(`\n⏭  跳過工作表: ${sheetName}`);
        continue;
      }

      console.log(`\n📋 處理工作表: ${sheetName}`);

      // 動態偵測欄位標題列 —— 掃描前 10 列，找包含「姓名」的非合併 cell
      let headerRowNum = -1;
      let colMap: Record<string, number> = {};

      for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
        const row = worksheet.getRow(r);

        // 逐欄檢查（直接用 getCell 而非 eachCell）
        for (let c = 1; c <= Math.min(15, worksheet.columnCount); c++) {
          const cell = row.getCell(c);
          // 跳過合併儲存格（合併的 slave cell 會返回 master 的值，造成誤判）
          if (cell.isMerged && cell.master && cell.master.address !== cell.address) {
            continue;
          }
          const val = String(cell.value || '').trim();
          if (val === '姓名') {
            headerRowNum = r;
            break;
          }
        }
        if (headerRowNum !== -1) break;
      }

      if (headerRowNum === -1) {
        // 備案：直接假設 Row 4 是標題列（所有工作表結構一致）
        const row4Cell = worksheet.getRow(4).getCell(2);
        const row4Val = String(row4Cell.value || '').trim();
        if (row4Val === '姓名') {
          headerRowNum = 4;
        }
      }

      if (headerRowNum === -1) {
        console.log(`  ⚠️  無法識別欄位標題，跳過此工作表`);
        totalSkipped++;
        continue;
      }

      // 解析欄位標題 — 用 getCell 逐欄讀取
      const headerRow = worksheet.getRow(headerRowNum);
      colMap = {};
      for (let c = 1; c <= Math.min(15, worksheet.columnCount); c++) {
        const cell = headerRow.getCell(c);
        const val = String(cell.value || '').trim();
        if (val === '序號') colMap['serial'] = c;
        else if (val === '姓名') colMap['name'] = c;
        else if (val.includes('郵遞區號')) colMap['postalCode'] = c;
        else if (val === '區/鎮/鄉/市' || val === '行政區') colMap['district'] = c;
        else if (val === '里/村' || val === '里村') colMap['village'] = c;
        else if (val.includes('完整地址') || val === '地址') colMap['fullAddress'] = c;
        else if (val.includes('電話')) colMap['phone'] = c;
        else if (val === '備註') colMap['note'] = c;
        else if (val === '標籤') colMap['label'] = c;
        else if (val.includes('資料問題')) colMap['dataIssue'] = c;
      }

      // 如果 colMap 不完整，使用已知欄位對應作為 fallback
      if (!colMap['name']) {
        console.log(`  ⚠️  找到標題列 Row ${headerRowNum} 但缺少「姓名」欄，使用預設欄位對應`);
        colMap = {
          serial: KNOWN_COLUMNS.serial,
          name: KNOWN_COLUMNS.name,
          postalCode: KNOWN_COLUMNS.postalCode,
          district: KNOWN_COLUMNS.district,
          village: KNOWN_COLUMNS.village,
          fullAddress: KNOWN_COLUMNS.fullAddress,
          phone: KNOWN_COLUMNS.phone,
          note: KNOWN_COLUMNS.note,
          label: KNOWN_COLUMNS.label,
          dataIssue: KNOWN_COLUMNS.dataIssue,
        };
      }

      console.log(`  標題列: Row ${headerRowNum}, 欄位: ${Object.keys(colMap).join(', ')}`);

      // 城市名稱 = 工作表名稱
      const city = sheetName;

      // 收集資料
      const records: any[] = [];

      for (let r = headerRowNum + 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);

        // 檢查第一欄 — 跳過合併的區塊標題列（▶ 開頭）
        const firstCell = row.getCell(1);
        if (firstCell.isMerged && firstCell.master && firstCell.master.address !== firstCell.address) {
          continue; // slave cell of a merge
        }
        const firstVal = String(firstCell.value || '').trim();
        if (firstVal.startsWith('▶') || firstVal.startsWith('►')) {
          continue;
        }

        // 取得姓名
        const nameCell = row.getCell(colMap['name']);
        const name = String(nameCell.value || '').trim();
        if (!name) continue;

        // 如果姓名欄是合併儲存格的 slave，跳過
        if (nameCell.isMerged && nameCell.master && nameCell.master.address !== nameCell.address) {
          continue;
        }

        // 檢查序號 — 排除小計行等非數字行
        const serialVal = colMap['serial'] ? String(row.getCell(colMap['serial']).value || '').trim() : '';
        if (serialVal && isNaN(Number(serialVal))) continue;

        const getValue = (key: string): string | null => {
          const colIdx = colMap[key];
          if (!colIdx) return null;
          const cell = row.getCell(colIdx);
          const value = cell.value;
          if (value === null || value === undefined) return null;
          const str = String(value).trim();
          return str || null;
        };

        const district = getValue('district');
        const village = getValue('village');
        const fullAddress = getValue('fullAddress');
        const postalCode = getValue('postalCode');
        const phone = getValue('phone');
        const note = getValue('note');

        // 建立地址欄位
        const address = fullAddress || `${district || ''}${village || ''}`;

        records.push({
          serialNumber: globalSerialNumber++,
          name,
          postalCode,
          city,
          district,
          village,
          address,
          fullAddress: fullAddress || `${city}${district || ''}${village || ''}`,
          phone,
          note,
          sourceSheet: sheetName,
          surveyStatus: 'PENDING' as const,
          version: 1,
        });
      }

      // 批次寫入資料庫
      if (records.length > 0) {
        for (let i = 0; i < records.length; i += 100) {
          const batch = records.slice(i, i + 100);
          await prisma.member.createMany({
            data: batch,
          });
        }
        totalImported += records.length;
        console.log(`  ✅ 匯入 ${records.length} 筆`);
      } else {
        console.log(`  ⚠️  無有效資料`);
      }
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ 匯入完成！`);
    console.log(`   總匯入: ${totalImported} 筆`);
    console.log(`   略過:   ${totalSkipped} 個工作表`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
