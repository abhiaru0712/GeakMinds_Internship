import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HRDataProvider } from "@/context/HRDataContext";
import AppNavbar from "@/components/AppNavbar";
import UploadPage from "@/pages/UploadPage";
import ExploreDashboard from "@/pages/ExploreDashboard";
import HRIntelligenceDashboard from "@/pages/HRIntelligenceDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HRDataProvider>
        <BrowserRouter>
          <AppNavbar />
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/dashboard" element={<ExploreDashboard />} />
            <Route path="/intelligence" element={<HRIntelligenceDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </HRDataProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
