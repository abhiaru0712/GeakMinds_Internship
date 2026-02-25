import { motion } from "framer-motion";
import { useHRData } from "@/context/HRDataContext";
import { Card } from "@/components/ui/card";
import { Hash, Type, BarChart3, TrendingUp } from "lucide-react";

const DataSummaryView = () => {
  const { summary } = useHRData();
  if (!summary) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold font-display">Data Summary</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Rows", value: summary.totalRows, icon: BarChart3, color: "text-primary" },
          { label: "Total Columns", value: summary.totalColumns, icon: Hash, color: "text-secondary" },
          { label: "Numeric Fields", value: summary.numericColumns.length, icon: TrendingUp, color: "text-accent" },
          { label: "Categorical Fields", value: summary.categoricalColumns.length, icon: Type, color: "text-chart-4" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-4 shadow-card">
              <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {summary.numericColumns.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Numeric Column Statistics</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Column</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Min</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Max</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Average</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sum</th>
                </tr>
              </thead>
              <tbody>
                {summary.numericColumns.map((col) => {
                  const s = summary.numericStats[col];
                  if (!s) return null;
                  return (
                    <tr key={col} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">{col}</td>
                      <td className="py-2 px-3 text-right">{s.min}</td>
                      <td className="py-2 px-3 text-right">{s.max}</td>
                      <td className="py-2 px-3 text-right">{s.avg}</td>
                      <td className="py-2 px-3 text-right">{s.sum}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {summary.categoricalColumns.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Categorical Column Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.categoricalColumns.slice(0, 6).map((col) => {
              const counts = summary.categoricalStats[col];
              if (!counts) return null;
              const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
              const total = Object.values(counts).reduce((a, b) => a + b, 0);
              return (
                <Card key={col} className="p-4 shadow-card">
                  <p className="font-semibold mb-3 text-sm">{col}</p>
                  <div className="space-y-2">
                    {entries.map(([val, count]) => (
                      <div key={val}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="truncate mr-2">{val}</span>
                          <span className="text-muted-foreground">{count} ({Math.round((count / total) * 100)}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full gradient-primary" style={{ width: `${(count / total) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {summary.sampleData.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Sample Data (first 10 rows)</h3>
          <Card className="overflow-x-auto shadow-card">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {summary.columns.slice(0, 8).map((col) => (
                    <th key={col} className="text-left py-2 px-3 font-medium text-muted-foreground whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.sampleData.map((row, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/30">
                    {summary.columns.slice(0, 8).map((col) => (
                      <td key={col} className="py-2 px-3 whitespace-nowrap">{String(row[col] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DataSummaryView;
