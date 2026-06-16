"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type CsvValue = string | number | boolean | null | undefined;

type CsvColumn = {
  key: string;
  header: string;
};

type CsvRow = Record<string, CsvValue>;

function formatCsvValue(value: CsvValue) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function escapeCsvCell(value: CsvValue) {
  const formatted = formatCsvValue(value);
  if (!/[",\r\n]/.test(formatted)) return formatted;
  return `"${formatted.replaceAll("\"", "\"\"")}"`;
}

function buildCsv(columns: CsvColumn[], rows: CsvRow[]) {
  const header = columns.map((column) => escapeCsvCell(column.header)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsvCell(row[column.key])).join(","));
  return [header, ...body].join("\r\n");
}

export function ExportCsvButton({
  columns,
  rows,
  filename,
  label = "Export CSV",
}: {
  columns: CsvColumn[];
  rows: CsvRow[];
  filename: string;
  label?: string;
}) {
  function downloadCsv() {
    const csv = buildCsv(columns, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <Button type="button" variant="outline" onClick={downloadCsv}>
      <Download className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}
