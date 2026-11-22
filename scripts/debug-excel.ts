/**
 * 診斷 Excel 檔案結構
 * 顯示前 10 列的所有 cell 值，幫助找出欄位標題位置
 */

import ExcelJS from 'exceljs';

async function main() {
  const excelPath = process.argv[2] || 'd:\\Vibe Coding\\Antigravity\\clan宗親\\祭祖名單_行政區劃分派.xlsx';
  
  console.log('📂 讀取 Excel 檔案:', excelPath);
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  
  // 只看前 2 個資料工作表
  const skipSheets = ['統計總覽', '資料品質報告'];
  let count = 0;
  
  for (const worksheet of workbook.worksheets) {
    if (skipSheets.includes(worksheet.name)) continue;
    if (count >= 2) break;
    count++;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`工作表: "${worksheet.name}" (共 ${worksheet.rowCount} 列, ${worksheet.columnCount} 欄)`);
    console.log(`${'='.repeat(60)}`);
    
    // 顯示合併儲存格
    // @ts-ignore
    const merges = worksheet.model?.merges || [];
    if (merges.length > 0) {
      console.log(`\n合併儲存格: ${merges.length} 個`);
      merges.slice(0, 10).forEach((m: string) => console.log(`  ${m}`));
      if (merges.length > 10) console.log(`  ... 還有 ${merges.length - 10} 個`);
    }
    
    // 顯示前 8 列的所有 cell
    for (let r = 1; r <= Math.min(8, worksheet.rowCount); r++) {
      const row = worksheet.getRow(r);
      console.log(`\n--- Row ${r} ---`);
      
      // 方式1: eachCell
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const rawValue = cell.value;
        const type = typeof rawValue;
        const isMerged = cell.isMerged;
        const master = cell.master ? `master=${cell.master.address}` : '';
        cells.push(`  Col ${colNumber} (${cell.address}): type=${type}, isMerged=${isMerged}, ${master} value=${JSON.stringify(rawValue)}`);
      });
      
      if (cells.length === 0) {
        console.log('  (空列)');
      } else {
        cells.forEach(c => console.log(c));
      }
      
      // 方式2: 直接用 getCell 檢查特定欄位
      if (r <= 6) {
        console.log(`  -- getCell 方式 --`);
        for (let c = 1; c <= Math.min(10, worksheet.columnCount); c++) {
          const cell = row.getCell(c);
          if (cell.value !== null && cell.value !== undefined) {
            console.log(`  getCell(${c}): "${cell.value}" (type: ${typeof cell.value}, isMerged: ${cell.isMerged})`);
          }
        }
      }
    }
    
    // 也看第一筆資料行（大約在第 5-6 列之後）
    console.log(`\n--- Row 5-6 (可能的資料行) ---`);
    for (let r = 5; r <= Math.min(7, worksheet.rowCount); r++) {
      const row = worksheet.getRow(r);
      const values: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        values.push(`Col${colNumber}="${cell.value}"`);
      });
      console.log(`  Row ${r}: ${values.join(' | ')}`);
    }
  }
}

main().catch(console.error);
