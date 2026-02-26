import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import opheliaLogo from "@/assets/ophelia-logo-full.png";
import {
  LayoutDashboard, Package, CreditCard, Users, CalendarDays,
  Calendar, BookOpen, UserCheck, DollarSign, ShoppingBag,
  ShoppingCart, Tag, Gift, Video, BarChart2,
  Settings, ChevronLeft, ChevronRight, LogOut, Globe,
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/plans", label: "Planes", icon: Package },
  { path: "/admin/memberships", label: "Membresías", icon: CreditCard },
  { path: "/admin/clients", label: "Clientes", icon: Users },
  { path: "/admin/classes", label: "Clases", icon: CalendarDays },
  { path: "/admin/schedules", label: "Horarios", icon: Calendar },
  { path: "/admin/bookings", label: "Reservas", icon: BookOpen },
  { path: "/admin/staff", label: "Instructores", icon: UserCheck },
  { path: "/admin/payments", label: "Pagos", icon: DollarSign },
  { path: "/admin/orders", label: "Órdenes", icon: ShoppingBag },
  { path: "/admin/pos", label: "POS", icon: ShoppingCart },
  { path: "/admin/discount-codes", label: "Descuentos", icon: Tag },
  { path: "/admin/loyalty", label: "Lealtad", icon: Gift },
  { path: "/admin/videos", label: "Videos", icon: Video },
  { path: "/admin/reports", label: "Reportes", icon: BarChart2 },
  { path: "/admin/settings", label: "Configuración", icon: Settings },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    logout();
    navigate("/auth/login");
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-secondary transition-all duration-300",
          collapsed ? "w-[60px]" : "w-[220px]"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-6 border-b border-border">
          {!collapsed && (
            <img src={opheliaLogo} alt="Ophelia" className="h-20 w-full object-contain" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path || location.pathname.startsWith(path + "/");
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors no-underline rounded-lg mx-2",
                  active
                    ? "bg-gradient-to-r from-[#CA71E1]/20 to-[#E15CB8]/10 text-[#CA71E1] font-medium border border-[#CA71E1]/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title={collapsed ? label : undefined}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="border-t border-border py-3">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors no-underline"
            title={collapsed ? "Ver sitio" : undefined}
          >
            <Globe size={14} className="shrink-0" />
            {!collapsed && "Ver sitio"}
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 text-xs text-destructive hover:text-destructive/80 transition-colors w-full"
            title={collapsed ? "Salir" : undefined}
          >
            <LogOut size={14} className="shrink-0" />
            {!collapsed && "Salir"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
};

export default AdminLayout;
