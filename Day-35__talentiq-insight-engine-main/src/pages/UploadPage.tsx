import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { motion } from "framer-motion";
import { Upload, FileSpreadsheet, CheckCircle2, ArrowRight, Trash2 } from "lucide-react";
import { useHRData, EmployeeRecord } from "@/context/HRDataContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import DataSummaryView from "@/components/DataSummaryView";

const UploadPage = () => {
  const { setData, summary, fileName, clearData } = useHRData();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const processFile = useCallback((file: File) => {
    setError("");
    setIsProcessing(true);

    if (!file.name.endsWith(".csv") && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setError("Please upload a CSV file.");
      setIsProcessing(false);
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as EmployeeRecord[];
        if (data.length === 0) {
          setError("The file appears to be empty.");
          setIsProcessing(false);
          return;
        }
        setData(data, file.name);
        setIsProcessing(false);
      },
      error: () => {
        setError("Failed to parse the file. Please check the format.");
        setIsProcessing(false);
      },
    });
  }, [setData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold font-display">Upload HR Data</h1>
          <p className="text-muted-foreground text-lg">Upload your employee dataset (CSV) to get started with analytics.</p>
        </motion.div>

        {!summary ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card
              className={`relative border-2 border-dashed transition-all duration-200 cursor-pointer ${
                isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {isProcessing ? "Processing..." : "Drop your CSV file here"}
                </h3>
                <p className="text-muted-foreground mb-4">or click to browse files</p>
                <p className="text-sm text-muted-foreground">Supports CSV files with employee data, performance metrics, leave data, feedback</p>
                {error && <p className="text-destructive mt-3 font-medium">{error}</p>}
              </div>
              <input id="file-input" type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <Card className="p-5 shadow-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="font-semibold">{fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {summary.totalRows} rows · {summary.totalColumns} columns
                  </p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-secondary ml-2" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearData}>
                  <Trash2 className="w-4 h-4 mr-1" /> Replace
                </Button>
                <Button size="sm" onClick={() => navigate("/dashboard")}>
                  Explore Dashboard <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </Card>

            <DataSummaryView />
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default UploadPage;
