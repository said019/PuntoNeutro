import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import puntoNeutroLogo from "@/assets/punto-neutro-logo.png";
import {
  LayoutDashboard, Package, CreditCard, Users, CalendarDays,
  BookOpen, DollarSign, BarChart3, Clock,
  Settings, ChevronLeft, ChevronRight, ChevronDown, LogOut, Globe, Menu, X,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Principal",
    collapsible: false,
    accentColor: "#94867a",
    items: [
      { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { path: "/admin/clients", label: "Clientes", icon: Users },
      { path: "/admin/payments", label: "Pagos", icon: DollarSign },
      { path: "/admin/bookings", label: "Reservas", icon: BookOpen },
    ],
  },
  {
    label: "Gestión",
    collapsible: true,
    accentColor: "#b5bf9c",
    items: [
      { path: "/admin/plans", label: "Planes", icon: Package },
      { path: "/admin/memberships", label: "Membresías", icon: CreditCard },
      { path: "/admin/classes", label: "Clases", icon: CalendarDays },
      { path: "/admin/schedules", label: "Horarios", icon: Clock },
      { path: "/admin/reports", label: "Reportes", icon: BarChart3 },
    ],
  },
  {
    label: "Sistema",
    collapsible: false,
    accentColor: "#94867a",
    items: [
      { path: "/admin/settings", label: "Configuración", icon: Settings },
    ],
  },
];

const MOBILE_QUICK_NAV = [
  { path: "/admin/dashboard", label: "Inicio", icon: LayoutDashboard },
  { path: "/admin/classes", label: "Clases", icon: CalendarDays },
  { path: "/admin/bookings", label: "Reservas", icon: BookOpen },
  { path: "/admin/clients", label: "Clientes", icon: Users },
  { path: "/admin/payments", label: "Pagos", icon: DollarSign },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Gestión: true,
  });

  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user as any);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    logout();
    navigate("/auth/login");
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const currentItem = allItems.find(
    (i) => location.pathname === i.path || location.pathname.startsWith(i.path + "/"),
  );

  const activeGroup = NAV_GROUPS.find((g) =>
    g.items.some((i) => location.pathname === i.path || location.pathname.startsWith(i.path + "/")),
  );

  const isCompact = collapsed && !mobileOpen;

  return (
    <div className="flex min-h-screen bg-[#ebede5] text-[#2d2d2d]">
      {mobileOpen && (
        <button
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-[#94867a]/25 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300 shrink-0",
          "border-r border-[#94867a]/15",
          "bg-gradient-to-b from-[#e2e5da] via-[#ebede5] to-[#ebede5]",
          "w-[88vw] max-w-[300px] -translate-x-full lg:translate-x-0 lg:static",
          mobileOpen && "translate-x-0",
          collapsed ? "lg:w-[72px]" : "lg:w-[240px]",
        )}
      >
        <div
          className={cn(
            "flex items-center border-b border-[#94867a]/15 shrink-0",
            isCompact ? "justify-center px-3 py-5" : "justify-between px-4 py-4",
          )}
        >
          {!isCompact && (
            <img src={puntoNeutroLogo} alt="Punto Neutro" className="h-14 w-auto object-contain" />
          )}

          <button
            onClick={() => setMobileOpen(false)}
            className="flex lg:hidden items-center justify-center w-8 h-8 rounded-lg text-[#94867a] hover:text-[#2d2d2d] hover:bg-[#94867a]/10"
            aria-label="Cerrar menú"
          >
            <X size={16} />
          </button>

          <button
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              "hidden lg:flex items-center justify-center w-7 h-7 rounded-lg transition-all",
              "text-[#94867a] hover:text-[#2d2d2d] hover:bg-[#94867a]/10",
            )}
            aria-label="Contraer menú"
          >
            {collapsed ? <Menu size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
          {NAV_GROUPS.map((group) => {
            const isGroupActive = activeGroup?.label === group.label;
            const isOpen = group.collapsible ? (openGroups[group.label] ?? isGroupActive) : true;

            return (
              <div key={group.label} className="mb-1">
                {!isCompact && (
                  group.collapsible ? (
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between px-5 py-1.5 group"
                    >
                      <span
                        className="text-[10px] font-semibold tracking-widest uppercase transition-colors"
                        style={{ color: isGroupActive ? group.accentColor : `${group.accentColor}80` }}
                      >
                        {group.label}
                      </span>
                      <ChevronDown
                        size={11}
                        className={cn("transition-all duration-200", isOpen ? "rotate-0" : "-rotate-90")}
                        style={{ color: `${group.accentColor}80` }}
                      />
                    </button>
                  ) : (
                    <p
                      className="px-5 py-1.5 text-[10px] font-semibold tracking-widest uppercase"
                      style={{ color: `${group.accentColor}80` }}
                    >
                      {group.label}
                    </p>
                  )
                )}

                {(isCompact || isOpen) && group.items.map(({ path, label, icon: Icon }) => {
                  const active = location.pathname === path || location.pathname.startsWith(path + "/");
                  const accent = group.accentColor;
                  return (
                    <Link
                      key={path}
                      to={path}
                      title={isCompact ? label : undefined}
                      className={cn(
                        "flex items-center gap-3 mx-2 my-0.5 rounded-xl transition-all duration-200 no-underline group",
                        isCompact ? "px-0 justify-center py-2.5" : "px-3 py-2.5",
                        active
                          ? "border font-semibold text-[#2d2d2d]"
                          : "text-[#2d2d2d]/55 hover:text-[#2d2d2d]/90 hover:bg-[#94867a]/[0.06] border border-transparent",
                      )}
                      style={active ? {
                        background: `linear-gradient(to right, ${accent}20, ${accent}0a)`,
                        borderColor: `${accent}40`,
                        boxShadow: `0 0 12px ${accent}15`,
                      } : {}}
                    >
                      <Icon
                        size={15}
                        className="shrink-0 transition-colors"
                        style={{ color: active ? accent : undefined }}
                      />
                      {!isCompact && (
                        <span className="text-[13px] leading-none truncate">{label}</span>
                      )}
                      {active && !isCompact && (
                        <span
                          className="ml-auto w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: accent, boxShadow: `0 0 6px ${accent}` }}
                        />
                      )}
                    </Link>
                  );
                })}

                {isCompact && <div className="mx-3 my-1 h-px bg-[#94867a]/10" />}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[#94867a]/15 pb-3 pt-2 shrink-0">
          <Link
            to="/"
            title={isCompact ? "Ver sitio" : undefined}
            className={cn(
              "flex items-center gap-3 mx-2 rounded-xl px-3 py-2 no-underline transition-all",
              "text-[#2d2d2d]/40 hover:text-[#94867a] hover:bg-[#94867a]/8 border border-transparent",
              isCompact && "justify-center px-0",
            )}
          >
            <Globe size={14} className="shrink-0" />
            {!isCompact && <span className="text-xs">Ver sitio</span>}
          </Link>
          <button
            onClick={handleLogout}
            title={isCompact ? "Salir" : undefined}
            className={cn(
              "flex items-center gap-3 mx-2 rounded-xl px-3 py-2 w-[calc(100%-16px)] transition-all",
              "text-[#2d2d2d]/40 hover:text-red-600 hover:bg-red-50 border border-transparent",
              isCompact && "justify-center px-0",
            )}
          >
            <LogOut size={14} className="shrink-0" />
            {!isCompact && <span className="text-xs">Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        <header className="shrink-0 h-14 flex items-center justify-between px-3 sm:px-4 lg:px-6 border-b border-[#94867a]/15 bg-[#ebede5]/85 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#94867a] hover:text-[#2d2d2d] hover:bg-[#94867a]/10"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu size={16} />
            </button>
            <span className="text-[#94867a]/50 text-[11px] sm:text-xs font-medium tracking-wider uppercase">Admin</span>
            {currentItem && (
              <>
                <ChevronRight size={12} className="text-[#94867a]/30 shrink-0" />
                <span className="text-[#2d2d2d] text-xs sm:text-sm font-semibold truncate">{currentItem.label}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#94867a]/70 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#b5bf9c] shadow-[0_0_6px_#b5bf9c] animate-pulse" />
              En línea
            </span>
            <div className="w-px h-4 bg-[#94867a]/15 hidden sm:block" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#94867a] to-[#b5bf9c] flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
                {user?.displayName?.[0]?.toUpperCase() ?? user?.display_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "A"}
              </div>
              {!isCompact && (
                <span className="text-xs text-[#2d2d2d]/55 hidden md:block truncate max-w-[180px]">
                  {user?.displayName ?? user?.display_name ?? user?.email ?? "Admin"}
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="admin-mobile-main flex-1 overflow-auto pb-[88px] lg:pb-0">{children}</main>

        {isMobile && (
          <nav className="fixed inset-x-2 bottom-2 z-40 rounded-2xl border border-[#94867a]/15 bg-[#ebede5]/95 p-1 pb-safe backdrop-blur-xl lg:hidden shadow-lg shadow-[#94867a]/10">
            <ul className="grid grid-cols-5 gap-1">
              {MOBILE_QUICK_NAV.map((item) => {
                const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        "flex h-12 min-h-[44px] flex-col items-center justify-center rounded-xl text-[11px] font-semibold transition-colors",
                        active
                          ? "bg-gradient-to-r from-[#94867a] to-[#b5bf9c] text-white shadow-md shadow-[#94867a]/20"
                          : "text-[#2d2d2d]/45 hover:bg-[#94867a]/8 hover:text-[#2d2d2d]",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon size={14} />
                      <span className="mt-0.5 leading-none">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
};

export default AdminLayout;
