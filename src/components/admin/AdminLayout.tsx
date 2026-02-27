import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import opheliaLogo from "@/assets/ophelia-logo-full.png";
import {
  LayoutDashboard, Package, CreditCard, Users, CalendarDays,
  Calendar, BookOpen, UserCheck, DollarSign, ShoppingBag,
  ShoppingCart, Tag, Gift, Video, BarChart2,
  Settings, ChevronLeft, ChevronRight, ChevronDown, LogOut, Globe, Menu, Ticket,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Principal",
    collapsible: false,
    accentColor: "#E15CB8",
    items: [
      { path: "/admin/dashboard", label: "Dashboard",  icon: LayoutDashboard },
      { path: "/admin/clients",   label: "Clientes",   icon: Users },
      { path: "/admin/payments",  label: "Pagos",      icon: DollarSign },
      { path: "/admin/bookings",  label: "Reservas",   icon: BookOpen },
    ],
  },
  {
    label: "Gestión",
    collapsible: true,
    accentColor: "#CA71E1",
    items: [
      { path: "/admin/plans",          label: "Planes",       icon: Package },
      { path: "/admin/memberships",    label: "Membresías",   icon: CreditCard },
      { path: "/admin/classes",        label: "Clases",       icon: CalendarDays },
      { path: "/admin/schedules",      label: "Horarios",     icon: Calendar },
      { path: "/admin/staff",          label: "Instructores", icon: UserCheck },
      { path: "/admin/orders",         label: "Órdenes",      icon: ShoppingBag },
      { path: "/admin/pos",            label: "POS",          icon: ShoppingCart },
      { path: "/admin/discount-codes", label: "Descuentos",   icon: Tag },
      { path: "/admin/loyalty",        label: "Lealtad",      icon: Gift },
      { path: "/admin/videos",         label: "Videos",       icon: Video },
      { path: "/admin/events",         label: "Eventos",      icon: Ticket },
    ],
  },
  {
    label: "Sistema",
    collapsible: false,
    accentColor: "#E15CB8",
    items: [
      { path: "/admin/reports",   label: "Reportes",      icon: BarChart2 },
      { path: "/admin/settings",  label: "Configuración", icon: Settings },
    ],
  },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Gestión: true,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const handleLogout = async () => {
    logout();
    navigate("/auth/login");
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // Current page label
  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const currentItem = allItems.find(
    (i) => location.pathname === i.path || location.pathname.startsWith(i.path + "/")
  );

  // Auto-open the group containing the active route
  const activeGroup = NAV_GROUPS.find((g) =>
    g.items.some((i) => location.pathname === i.path || location.pathname.startsWith(i.path + "/"))
  );

  return (
    <div className="flex min-h-screen bg-[#080808] text-foreground">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col transition-all duration-300 relative z-20 shrink-0",
          "border-r border-white/[0.06]",
          "bg-gradient-to-b from-[#0f0518] via-[#0a0a0a] to-[#080808]",
          collapsed ? "w-[64px]" : "w-[240px]"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center border-b border-white/[0.06] shrink-0",
            collapsed ? "justify-center px-3 py-5" : "justify-between px-5 py-4"
          )}
        >
          {!collapsed && (
            <img src={opheliaLogo} alt="Ophelia" className="h-16 w-auto object-contain" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-lg transition-all",
              "text-[#CA71E1]/60 hover:text-[#CA71E1] hover:bg-[#CA71E1]/10"
            )}
          >
            {collapsed ? <Menu size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
          {NAV_GROUPS.map((group) => {
            const isGroupActive = activeGroup?.label === group.label;
            const isOpen = group.collapsible ? (openGroups[group.label] ?? isGroupActive) : true;

            return (
              <div key={group.label} className="mb-1">
                {/* Group header */}
                {!collapsed && (
                  group.collapsible ? (
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between px-5 py-1.5 group"
                    >
                      <span
                        className="text-[10px] font-semibold tracking-widest uppercase transition-colors"
                        style={{ color: isGroupActive ? group.accentColor : `${group.accentColor}50` }}
                      >
                        {group.label}
                      </span>
                      <ChevronDown
                        size={11}
                        className={cn(
                          "transition-all duration-200",
                          isOpen ? "rotate-0" : "-rotate-90"
                        )}
                        style={{ color: `${group.accentColor}50` }}
                      />
                    </button>
                  ) : (
                    <p
                      className="px-5 py-1.5 text-[10px] font-semibold tracking-widest uppercase"
                      style={{ color: `${group.accentColor}50` }}
                    >
                      {group.label}
                    </p>
                  )
                )}

                {/* Items */}
                {(collapsed || isOpen) && group.items.map(({ path, label, icon: Icon }) => {
                  const active = location.pathname === path || location.pathname.startsWith(path + "/");
                  const accent = group.accentColor;
                  return (
                    <Link
                      key={path}
                      to={path}
                      title={collapsed ? label : undefined}
                      className={cn(
                        "flex items-center gap-3 mx-2 my-0.5 rounded-xl transition-all duration-200 no-underline group",
                        collapsed ? "px-0 justify-center py-2.5" : "px-3 py-2.5",
                        active
                          ? "border text-white font-semibold"
                          : "text-white/50 hover:text-white/85 hover:bg-white/[0.04] border border-transparent"
                      )}
                      style={active ? {
                        background: `linear-gradient(to right, ${accent}18, ${accent}08)`,
                        borderColor: `${accent}30`,
                        boxShadow: `0 0 12px ${accent}18`,
                      } : {}}
                    >
                      <Icon
                        size={15}
                        className={cn("shrink-0 transition-colors")}
                        style={{ color: active ? accent : undefined }}
                      />
                      {!collapsed && (
                        <span className="text-[13px] leading-none">{label}</span>
                      )}
                      {active && !collapsed && (
                        <span
                          className="ml-auto w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: accent, boxShadow: `0 0 6px ${accent}` }}
                        />
                      )}
                    </Link>
                  );
                })}

                {/* Collapsed separator */}
                {collapsed && <div className="mx-3 my-1 h-px bg-white/[0.04]" />}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/[0.06] pb-3 pt-2 shrink-0">
          <Link
            to="/"
            title={collapsed ? "Ver sitio" : undefined}
            className={cn(
              "flex items-center gap-3 mx-2 rounded-xl px-3 py-2 no-underline transition-all",
              "text-white/30 hover:text-[#E7EB6E] hover:bg-[#E7EB6E]/5 border border-transparent",
              collapsed && "justify-center px-0"
            )}
          >
            <Globe size={14} className="shrink-0" />
            {!collapsed && <span className="text-xs">Ver sitio</span>}
          </Link>
          <button
            onClick={handleLogout}
            title={collapsed ? "Salir" : undefined}
            className={cn(
              "flex items-center gap-3 mx-2 rounded-xl px-3 py-2 w-[calc(100%-16px)] transition-all",
              "text-white/30 hover:text-[#ff6b6b] hover:bg-[#ff6b6b]/8 border border-transparent",
              collapsed && "justify-center px-0 w-[calc(100%-16px)]"
            )}
          >
            <LogOut size={14} className="shrink-0" />
            {!collapsed && <span className="text-xs">Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* ── Content area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="shrink-0 h-14 flex items-center justify-between px-6 border-b border-white/[0.06] bg-[#080808]/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white/30 text-xs font-medium tracking-wider uppercase">Admin</span>
            {currentItem && (
              <>
                <ChevronRight size={12} className="text-white/20" />
                <span className="text-white/85 text-sm font-semibold">{currentItem.label}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Lime accent dot */}
            <span className="flex items-center gap-1.5 text-[11px] text-[#E7EB6E]/70 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E7EB6E] shadow-[0_0_6px_#E7EB6E] animate-pulse" />
              En línea
            </span>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#E15CB8] to-[#CA71E1] flex items-center justify-center text-[11px] font-bold text-white shadow-[0_0_10px_rgba(225,92,184,0.4)]">
                {(user as any)?.name?.[0]?.toUpperCase() ?? (user as any)?.email?.[0]?.toUpperCase() ?? "A"}
              </div>
              {!collapsed && (
                <span className="text-xs text-white/50 hidden sm:block">
                  {(user as any)?.name ?? (user as any)?.email ?? "Admin"}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
