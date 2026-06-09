import { format } from "date-fns";
import { th } from "date-fns/locale";

export interface ReportRow {
  date: Date;
  consumedCalories: number;
  dailyLimit: number;
  meals: { name: string; calories: number; logged_at?: string; source?: string }[];
}

/** Helper: trigger a browser file download from a Blob */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Load Sarabun font from local public/fonts/ and register it with jsPDF.
 * The full font files (from google/fonts GitHub repo) include Thai unicode cmap.
 */
async function registerThaiFont(doc: any): Promise<boolean> {
  try {
    // Fetch font files from Next.js public directory
    const [normalBuf, boldBuf] = await Promise.all([
      fetch("/fonts/Sarabun-Regular.ttf").then((r) => {
        if (!r.ok) throw new Error(`Font fetch failed: ${r.status}`);
        return r.arrayBuffer();
      }),
      fetch("/fonts/Sarabun-Bold.ttf").then((r) => {
        if (!r.ok) throw new Error(`Font fetch failed: ${r.status}`);
        return r.arrayBuffer();
      }),
    ]);

    // Convert ArrayBuffer to base64
    const toBase64 = (buf: ArrayBuffer) => {
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };

    // Register fonts with jsPDF
    doc.addFileToVFS("Sarabun-Regular.ttf", toBase64(normalBuf));
    doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");

    doc.addFileToVFS("Sarabun-Bold.ttf", toBase64(boldBuf));
    doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");

    doc.setFont("Sarabun");
    return true;
  } catch (e) {
    console.warn("Failed to load Thai font, falling back to Helvetica:", e);
    return false;
  }
}

// ============================================================
// PDF EXPORT — jsPDF + autoTable + Thai font
// ============================================================
export async function exportToPDF(
  rows: ReportRow[],
  periodLabel: string,
  dailyLimit: number
): Promise<void> {
  // Dynamic import to avoid SSR issues
  const jsPDFModule = await import("jspdf");
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Register Thai-compatible font
  const hasThai = await registerThaiFont(doc);
  const fontName = hasThai ? "Sarabun" : "helvetica";

  // ── Header ──────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont(fontName, "bold");
  doc.text(hasThai ? "MOMU SCAN - รายงานแคลอรี่" : "MOMU SCAN - Calorie Report", 14, 18);

  doc.setFontSize(10);
  doc.setFont(fontName, "normal");
  doc.text(`${hasThai ? "ช่วงเวลา" : "Period"}: ${periodLabel}`, 14, 26);
  doc.text(`${hasThai ? "เป้าหมายต่อวัน" : "Daily Limit"}: ${dailyLimit > 0 ? dailyLimit.toLocaleString() + " kcal" : (hasThai ? "ไม่ได้ตั้ง" : "Not set")}`, 14, 32);
  doc.text(`${hasThai ? "ส่งออกเมื่อ" : "Exported"}: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 38);

  const totalCalories = rows.reduce((s, r) => s + r.consumedCalories, 0);
  const avgCalories = rows.length > 0 ? Math.round(totalCalories / rows.length) : 0;

  doc.text(`${hasThai ? "แคลอรี่รวม" : "Total Calories"}: ${totalCalories.toLocaleString()} kcal`, 14, 44);
  doc.text(`${hasThai ? "เฉลี่ยต่อวัน" : "Average per Day"}: ${avgCalories.toLocaleString()} kcal`, 14, 50);

  // ── Summary Table ────────────────────────────────────────
  const summaryBody = rows.map((r) => [
    format(r.date, "dd/MM/yyyy"),
    hasThai ? format(r.date, "EEEE", { locale: th }) : format(r.date, "EEEE"),
    r.consumedCalories.toLocaleString(),
    dailyLimit > 0 ? (r.consumedCalories > dailyLimit ? (hasThai ? "เกิน" : "OVER") : (hasThai ? "ผ่าน" : "OK")) : "-",
    r.meals.length.toString(),
  ]);

  autoTable(doc, {
    startY: 56,
    head: [hasThai ? ["วันที่", "วัน", "แคลอรี่ (kcal)", "เทียบเป้า", "จำนวนมื้อ"] : ["Date", "Day", "Calories (kcal)", "vs Limit", "# Meals"]],
    body: summaryBody,
    styles: { fontSize: 9, cellPadding: 3, font: fontName },
    headStyles: { fillColor: [99, 102, 241], font: fontName, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "center" }, 4: { halign: "center" } },
  });

  // ── Meal Detail (one sub-table per day) ─────────────────
  let finalY = (doc as any).lastAutoTable?.finalY ?? 60;

  for (const row of rows) {
    if (row.meals.length === 0) continue;
    if (finalY > 240) { doc.addPage(); finalY = 14; }

    finalY += 8;
    doc.setFontSize(10);
    doc.setFont(fontName, "bold");
    const dateLabel = hasThai
      ? `มื้ออาหารวันที่ ${format(row.date, "dd MMM yyyy", { locale: th })}`
      : `Meals on ${format(row.date, "dd MMM yyyy")}`;
    doc.text(
      `${dateLabel} — ${row.consumedCalories.toLocaleString()} kcal`,
      14,
      finalY
    );

    autoTable(doc, {
      startY: finalY + 3,
      head: [hasThai ? ["รายการอาหาร", "แคลอรี่ (kcal)", "เวลา"] : ["Food Item", "Calories (kcal)", "Time"]],
      body: row.meals.map((m) => [
        m.name,
        m.calories.toLocaleString(),
        m.logged_at ? format(new Date(m.logged_at), "HH:mm") : "",
      ]),
      styles: { fontSize: 8, cellPadding: 2, font: fontName },
      headStyles: { fillColor: [148, 163, 184], font: fontName, fontStyle: "bold" },
      margin: { left: 18 },
    });

    finalY = (doc as any).lastAutoTable?.finalY ?? finalY;
  }

  // ── Download via Blob (reliable cross-browser) ───────────
  const pdfBlob = doc.output("blob");
  triggerDownload(pdfBlob, `momu-report-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
}

// ============================================================
// EXCEL EXPORT — xlsx (SheetJS)
// ============================================================
export async function exportToExcel(
  rows: ReportRow[],
  periodLabel: string,
  dailyLimit: number
): Promise<void> {
  const XLSX = await import("xlsx");

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Summary ─────────────────────────────────────
  const summaryData: (string | number)[][] = [
    ["MOMU SCAN - รายงานแคลอรี่"],
    [`ช่วงเวลา: ${periodLabel}`],
    [`เป้าหมายต่อวัน: ${dailyLimit > 0 ? dailyLimit.toLocaleString() + " kcal" : "ไม่ได้ตั้ง"}`],
    [`ส่งออกเมื่อ: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
    [],
    ["วันที่", "วัน", "แคลอรี่ (kcal)", "เทียบเป้า", "จำนวนมื้อ"],
    ...rows.map((r) => [
      format(r.date, "dd/MM/yyyy"),
      format(r.date, "EEEE", { locale: th }),
      r.consumedCalories,
      dailyLimit > 0 ? (r.consumedCalories > dailyLimit ? "เกิน" : "ผ่าน") : "-",
      r.meals.length,
    ]),
    [],
    ["รวม", "", rows.reduce((s, r) => s + r.consumedCalories, 0), "", rows.reduce((s, r) => s + r.meals.length, 0)],
    ["เฉลี่ย", "", rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.consumedCalories, 0) / rows.length) : 0, "", ""],
  ];

  const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWS["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");

  // ── Sheet 2: Meal Details ─────────────────────────────────
  const mealData: (string | number)[][] = [
    ["วันที่", "รายการอาหาร", "แคลอรี่ (kcal)", "เวลา", "แหล่งที่มา"],
  ];
  for (const row of rows) {
    for (const m of row.meals) {
      mealData.push([
        format(row.date, "dd/MM/yyyy"),
        m.name,
        m.calories,
        m.logged_at ? format(new Date(m.logged_at), "HH:mm") : "",
        m.source ?? "manual",
      ]);
    }
  }

  const mealWS = XLSX.utils.aoa_to_sheet(mealData);
  mealWS["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, mealWS, "Meal Details");

  // ── Download via Blob (reliable cross-browser) ────────────
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const xlsxBlob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(xlsxBlob, `momu-report-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`);
}
