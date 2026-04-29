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

// ============================================================
// PDF EXPORT — jsPDF + autoTable
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

  // ── Header ──────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("MOMU SCAN - Calorie Report", 14, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${periodLabel}`, 14, 26);
  doc.text(`Daily Limit: ${dailyLimit > 0 ? dailyLimit.toLocaleString() + " kcal" : "Not set"}`, 14, 32);
  doc.text(`Exported: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 38);

  const totalCalories = rows.reduce((s, r) => s + r.consumedCalories, 0);
  const avgCalories = rows.length > 0 ? Math.round(totalCalories / rows.length) : 0;

  doc.text(`Total Calories: ${totalCalories.toLocaleString()} kcal`, 14, 44);
  doc.text(`Average per Day: ${avgCalories.toLocaleString()} kcal`, 14, 50);

  // ── Summary Table ────────────────────────────────────────
  const summaryBody = rows.map((r) => [
    format(r.date, "dd/MM/yyyy"),
    format(r.date, "EEEE", { locale: th }),
    r.consumedCalories.toLocaleString(),
    dailyLimit > 0 ? (r.consumedCalories > dailyLimit ? "OVER" : "OK") : "-",
    r.meals.length.toString(),
  ]);

  autoTable(doc, {
    startY: 56,
    head: [["Date", "Day", "Calories (kcal)", "vs Limit", "# Meals"]],
    body: summaryBody,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [99, 102, 241] },
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
    doc.setFont("helvetica", "bold");
    doc.text(
      `Meals on ${format(row.date, "dd MMM yyyy", { locale: th })} — ${row.consumedCalories.toLocaleString()} kcal`,
      14,
      finalY
    );

    autoTable(doc, {
      startY: finalY + 3,
      head: [["Food Item", "Calories (kcal)", "Time"]],
      body: row.meals.map((m) => [
        m.name,
        m.calories.toLocaleString(),
        m.logged_at ? format(new Date(m.logged_at), "HH:mm") : "",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [148, 163, 184] },
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
    ["MOMU SCAN - Calorie Report"],
    [`Period: ${periodLabel}`],
    [`Daily Limit: ${dailyLimit > 0 ? dailyLimit.toLocaleString() + " kcal" : "Not set"}`],
    [`Exported: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
    [],
    ["Date", "Day (TH)", "Calories (kcal)", "vs Limit", "# Meals"],
    ...rows.map((r) => [
      format(r.date, "dd/MM/yyyy"),
      format(r.date, "EEEE", { locale: th }),
      r.consumedCalories,
      dailyLimit > 0 ? (r.consumedCalories > dailyLimit ? "OVER" : "OK") : "-",
      r.meals.length,
    ]),
    [],
    ["Total", "", rows.reduce((s, r) => s + r.consumedCalories, 0), "", rows.reduce((s, r) => s + r.meals.length, 0)],
    ["Average", "", rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.consumedCalories, 0) / rows.length) : 0, "", ""],
  ];

  const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWS["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");

  // ── Sheet 2: Meal Details ─────────────────────────────────
  const mealData: (string | number)[][] = [
    ["Date", "Food Item", "Calories (kcal)", "Time", "Source"],
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
