import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useHRData } from "@/context/HRDataContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Users, TrendingUp, BarChart3, PieChart } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

const COLORS = [
  "hsl(210, 100%, 45%)", "hsl(175, 60%, 40%)", "hsl(30, 95%, 55%)",
  "hsl(280, 60%, 55%)", "hsl(350, 70%, 55%)", "hsl(150, 50%, 45%)",
];

const ExploreDashboard = () => {
  const { summary, rawData } = useHRData();
  const navigate = useNavigate();

  const charts = useMemo(() => {
    if (!summary || rawData.length === 0) return null;

    // Bar chart for first categorical column
    const catCol = summary.categoricalColumns[0];
    let barData: { name: string; count: number }[] = [];
    if (catCol && summary.categoricalStats[catCol]) {
      barData = Object.entries(summary.categoricalStats[catCol])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count }));
    }

    // Pie chart for second categorical column
    const catCol2 = summary.categoricalColumns[1] || summary.categoricalColumns[0];
    let pieData: { name: string; value: number }[] = [];
    if (catCol2 && summary.categoricalStats[catCol2]) {
      pieData = Object.entries(summary.categoricalStats[catCol2])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value]) => ({ name, value }));
    }

    // Line chart using numeric columns (show avg by first categorical)
    const numCol = summary.numericColumns[0];
    const groupCol = summary.categoricalColumns[0];
    let lineData: { name: string; value: number }[] = [];
    if (numCol && groupCol) {
      const groups: Record<string, number[]> = {};
      rawData.forEach((row) => {
        const g = String(row[groupCol] ?? "Other");
        const v = Number(row[numCol]);
        if (!isNaN(v)) {
          if (!groups[g]) groups[g] = [];
          groups[g].push(v);
        }
      });
      lineData = Object.entries(groups)
        .map(([name, vals]) => ({
          name,
          value: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    }

    // Numeric overview
    const numOverview = summary.numericColumns.slice(0, 6).map((col) => ({
      name: col,
      avg: summary.numericStats[col]?.avg ?? 0,
      max: summary.numericStats[col]?.max ?? 0,
    }));

    return { barData, pieData, lineData, numOverview, catCol, catCol2, numCol, groupCol };
  }, [summary, rawData]);

  if (!summary) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-10 text-center shadow-card max-w-md">
          <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Data Loaded</h2>
          <p className="text-muted-foreground mb-4">Upload your HR dataset first to explore the dashboard.</p>
          <Button onClick={() => navigate("/")}>Go to Upload</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold font-display mb-1">Explore Dashboard</h1>
          <p className="text-muted-foreground">Visual overview of your uploaded HR data</p>
        </motion.div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Employees", value: summary.totalRows, icon: Users, color: "gradient-primary" },
            { label: "Data Fields", value: summary.totalColumns, icon: BarChart3, color: "bg-secondary" },
            { label: "Numeric Metrics", value: summary.numericColumns.length, icon: TrendingUp, color: "bg-accent" },
            { label: "Categories", value: summary.categoricalColumns.length, icon: PieChart, color: "bg-chart-4" },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="p-5 shadow-card">
                <div className={`w-10 h-10 rounded-xl ${kpi.color} flex items-center justify-center mb-3`}>
                  <kpi.icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <p className="text-3xl font-bold">{kpi.value}</p>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {charts && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart */}
            {charts.barData.length > 0 && (
              <Card className="p-6 shadow-card">
                <h3 className="font-semibold mb-4">Distribution by {charts.catCol}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={charts.barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill={COLORS[0]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Pie Chart */}
            {charts.pieData.length > 0 && (
              <Card className="p-6 shadow-card">
                <h3 className="font-semibold mb-4">Breakdown by {charts.catCol2}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RPieChart>
                    <Pie data={charts.pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {charts.pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RPieChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Line Chart */}
            {charts.lineData.length > 0 && (
              <Card className="p-6 shadow-card">
                <h3 className="font-semibold mb-4">Avg {charts.numCol} by {charts.groupCol}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={charts.lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill={COLORS[1]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Numeric overview */}
            {charts.numOverview.length > 0 && (
              <Card className="p-6 shadow-card">
                <h3 className="font-semibold mb-4">Numeric Metrics Overview</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={charts.numOverview} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avg" fill={COLORS[0]} radius={[0, 6, 6, 0]} name="Average" />
                    <Bar dataKey="max" fill={COLORS[2]} radius={[0, 6, 6, 0]} name="Max" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExploreDashboard;
