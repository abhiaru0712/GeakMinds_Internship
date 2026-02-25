import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Upload, BarChart3, Brain, Menu, X } from "lucide-react";
import { useState } from "react";
import { useHRData } from "@/context/HRDataContext";

const navItems = [
  { path: "/", label: "Upload", icon: Upload },
  { path: "/dashboard", label: "Explore Dashboard", icon: BarChart3 },
  { path: "/intelligence", label: "HR Intelligence", icon: Brain },
];

const AppNavbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { summary } = useHRData();

  return (
    <nav className="sticky top-0 z-50 glass border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg">TalentIQ AI</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {isActive && (
                  <motion.div layoutId="nav-indicator" className="absolute bottom-0 left-2 right-2 h-0.5 gradient-primary rounded-full" />
                )}
              </Link>
            );
          })}
          {summary && (
            <span className="ml-3 text-xs bg-secondary/15 text-secondary px-2 py-1 rounded-full font-medium">
              {summary.totalRows} records loaded
            </span>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="md:hidden border-t border-border bg-card p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                location.pathname === item.path ? "bg-primary/10 text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </motion.div>
      )}
    </nav>
  );
};

export default AppNavbar;
