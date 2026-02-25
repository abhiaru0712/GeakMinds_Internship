import React, { createContext, useContext, useState, ReactNode } from "react";

export interface EmployeeRecord {
  [key: string]: string | number;
}

export interface DataSummary {
  totalRows: number;
  totalColumns: number;
  columns: string[];
  numericColumns: string[];
  categoricalColumns: string[];
  numericStats: Record<string, { min: number; max: number; avg: number; sum: number }>;
  categoricalStats: Record<string, Record<string, number>>;
  sampleData: EmployeeRecord[];
}

interface HRDataContextType {
  rawData: EmployeeRecord[];
  summary: DataSummary | null;
  fileName: string;
  setData: (data: EmployeeRecord[], fileName: string) => void;
  clearData: () => void;
}

const HRDataContext = createContext<HRDataContextType | undefined>(undefined);

function computeSummary(data: EmployeeRecord[]): DataSummary {
  if (data.length === 0) {
    return { totalRows: 0, totalColumns: 0, columns: [], numericColumns: [], categoricalColumns: [], numericStats: {}, categoricalStats: {}, sampleData: [] };
  }

  const columns = Object.keys(data[0]);
  const numericColumns: string[] = [];
  const categoricalColumns: string[] = [];

  columns.forEach((col) => {
    const sampleValues = data.slice(0, 50).map((r) => r[col]);
    const numericCount = sampleValues.filter((v) => v !== "" && v !== null && v !== undefined && !isNaN(Number(v))).length;
    if (numericCount > sampleValues.length * 0.6) {
      numericColumns.push(col);
    } else {
      categoricalColumns.push(col);
    }
  });

  const numericStats: Record<string, { min: number; max: number; avg: number; sum: number }> = {};
  numericColumns.forEach((col) => {
    const values = data.map((r) => Number(r[col])).filter((v) => !isNaN(v));
    if (values.length > 0) {
      numericStats[col] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
        sum: Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100,
      };
    }
  });

  const categoricalStats: Record<string, Record<string, number>> = {};
  categoricalColumns.forEach((col) => {
    const counts: Record<string, number> = {};
    data.forEach((r) => {
      const val = String(r[col] ?? "N/A");
      counts[val] = (counts[val] || 0) + 1;
    });
    categoricalStats[col] = counts;
  });

  return {
    totalRows: data.length,
    totalColumns: columns.length,
    columns,
    numericColumns,
    categoricalColumns,
    numericStats,
    categoricalStats,
    sampleData: data.slice(0, 10),
  };
}

export const HRDataProvider = ({ children }: { children: ReactNode }) => {
  const [rawData, setRawData] = useState<EmployeeRecord[]>([]);
  const [summary, setSummary] = useState<DataSummary | null>(null);
  const [fileName, setFileName] = useState("");

  const setData = (data: EmployeeRecord[], name: string) => {
    setRawData(data);
    setFileName(name);
    setSummary(computeSummary(data));
  };

  const clearData = () => {
    setRawData([]);
    setSummary(null);
    setFileName("");
  };

  return (
    <HRDataContext.Provider value={{ rawData, summary, fileName, setData, clearData }}>
      {children}
    </HRDataContext.Provider>
  );
};

export const useHRData = () => {
  const ctx = useContext(HRDataContext);
  if (!ctx) throw new Error("useHRData must be used within HRDataProvider");
  return ctx;
};
