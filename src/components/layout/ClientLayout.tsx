import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import {
  LayoutDashboard, Calendar, ClipboardList, CreditCard, Package,
  Wallet, Play, User, Bell, LogOut, Menu, X, Settings,
  ChevronRight, Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import puntoNeutroLogo from "@/assets/punto-neutro-logo.png";

/* ── Navigation groups ─────────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: "Principal",
    labelColor: "#94867a",
    items: [
      { to: "/app", label: "Inicio", icon: LayoutDashboard, activeColor: "#94867a" },
      { to: "/app/classes", label: "Reservar clase", icon: Calendar, activeColor: "#94867a" },
      { to: "/app/bookings", label: "Mis reservas", icon: ClipboardList, activeColor: "#b5bf9c" },
      { to: "/app/orders", label: "Mis órdenes", icon: CreditCard, activeColor: "#94867a" },
    ],
  },
];

/* ── Single nav item ───────────────────────────────────────────────── */
const NavItem = ({
  to, label, icon: Icon, onClick, collapsed, activeColor = "#94867a",
}: {
  to: string; label: string; icon: any; onClick?: () => void; collapsed?: boolean; activeColor?: string;
}) => {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== "/app" && pathname.startsWith(to));

  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.82rem] font-medium transition-all duration-200 no-underline",
        active
          ? "text-[#2d2d2d] border"
          : "text-[#2d2d2d]/55 hover:bg-[#94867a]/[0.06] hover:text-[#2d2d2d] border border-transparent",
        collapsed && "justify-center px-2"
      )}
      style={active ? {
        background: `linear-gradient(to right, ${activeColor}20, ${activeColor}08)`,
        borderColor: `${activeColor}30`,
      } : {}}
    >
      {/* Active left bar */}
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full"
          style={{ backgroundColor: activeColor }}
        />
      )}

      {/* Icon */}
      <span
        className={cn("flex-shrink-0 transition-all", !active && "group-hover:text-[#94867a]")}
        style={active ? { color: activeColor } : {}}
      >
        <Icon size={17} />
      </span>

      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && active && (
        <ChevronRight size={13} style={{ color: activeColor }} className="opacity-70" />
      )}
    </Link>
  );
};

/* ── Main layout ───────────────────────────────────────────────────── */
const ClientLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/auth/login");
  };

  const initials = (user?.displayName ?? user?.display_name)
    ? (user?.displayName ?? user?.display_name ?? "").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email
      ? user.email[0].toUpperCase()
      : "U";

  const firstName = (user?.displayName ?? user?.display_name)?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Tú";

  /* ── mobile bottom nav items ── */
  const BOTTOM_NAV = [
    { to: "/app", icon: LayoutDashboard, label: "Inicio", color: "#94867a" },
    { to: "/app/classes", icon: Calendar, label: "Clases", color: "#94867a" },
    { to: "/app/bookings", icon: ClipboardList, label: "Reservas", color: "#b5bf9c" },
    { to: "/app/profile", icon: User, label: "Perfil", color: "#94867a" },
  ];

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Mobile overlay ─────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-[#94867a]/25 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── SIDEBAR ────────────────────────────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col transition-transform duration-300 lg:static lg:translate-x-0",
        "border-r border-[#94867a]/15 bg-[#ebede5]",
        open ? "translate-x-0" : "-translate-x-full"
      )}>

        {/* Ambient top glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[200px] bg-gradient-to-b from-[#94867a]/[0.06] to-transparent" />
        <div className="pointer-events-none absolute left-[-40px] top-[-40px] h-[180px] w-[180px] rounded-full bg-[#b5bf9c]/[0.08] blur-[60px]" />

        {/* ── Logo / Brand ── */}
        <div className="relative flex h-20 items-center justify-between px-5 border-b border-[#94867a]/15">
          <Link to="/" className="flex items-center no-underline">
            <img src={puntoNeutroLogo} alt="Punto Neutro" className="h-16 w-auto" />
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden rounded-lg p-1.5 text-[#94867a] hover:text-[#2d2d2d] hover:bg-[#94867a]/10 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── User card ── */}
        <Link
          to="/app/profile"
          onClick={() => setOpen(false)}
          className={cn(
            "relative mx-3 mt-4 mb-2 flex items-center gap-3 rounded-2xl p-3.5 no-underline transition-all duration-200",
            "bg-gradient-to-br from-[#b5bf9c]/[0.12] to-[#ebede5]/[0.10]",
            "border border-[#b5bf9c]/[0.18] hover:border-[#94867a]/30 hover:from-[#b5bf9c]/[0.18] hover:to-[#ebede5]/[0.14]",
            pathname.startsWith("/app/profile") && "border-[#94867a]/30"
          )}
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white",
              "bg-gradient-to-br from-[#94867a] to-[#b5bf9c] shadow-md shadow-[#94867a]/30"
            )}>
              {(user?.photoUrl ?? user?.photo_url)
                ? <img src={(user?.photoUrl ?? user?.photo_url)!} className="h-10 w-10 rounded-full object-cover" alt="" />
                : initials}
            </div>
            {/* Online dot */}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#ebede5]" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.83rem] font-semibold text-[#2d2d2d] leading-tight">
              {firstName}
            </p>
            <p className="truncate text-[0.72rem] text-[#2d2d2d]/55 leading-tight mt-0.5">
              {user?.email}
            </p>
          </div>

          <ChevronRight size={14} className="flex-shrink-0 text-[#94867a]/50" />
        </Link>

        {/* ── Nav groups ── */}
        <nav className="flex-1 overflow-y-auto px-3 pb-2 space-y-5 mt-2
          [&::-webkit-scrollbar]:w-[3px]
          [&::-webkit-scrollbar-track]:bg-transparent
          [&::-webkit-scrollbar-thumb]:bg-[#94867a]/15
          [&::-webkit-scrollbar-thumb:hover]:bg-[#94867a]/40">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p
                className="px-3 mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em]"
                style={{ color: `${group.labelColor}70` }}
              >
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem
                    key={item.to}
                    {...item}
                    onClick={() => setOpen(false)}
                    activeColor={item.activeColor}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Bottom actions ── */}
        <div className="border-t border-[#94867a]/15 p-3 space-y-1">
          <Link
            to="/app/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.82rem] font-medium text-[#2d2d2d]/55 hover:bg-[#94867a]/[0.06] hover:text-[#2d2d2d] transition-all"
          >
            <Bell size={17} />
            <span>Notificaciones</span>
          </Link>
          <Link
            to="/app/profile/preferences"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.82rem] font-medium text-[#2d2d2d]/55 hover:bg-[#94867a]/[0.06] hover:text-[#2d2d2d] transition-all"
          >
            <Settings size={17} />
            <span>Configuración</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.82rem] font-medium text-[#2d2d2d]/55 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut size={17} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Mobile topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#94867a]/15 bg-[#ebede5]/90 backdrop-blur-md px-4 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-xl p-2 text-[#94867a] hover:text-[#2d2d2d] hover:bg-[#94867a]/10 transition-colors"
          >
            <Menu size={20} />
          </button>

          <Link to="/">
            <img src={puntoNeutroLogo} alt="Punto Neutro" className="h-12 w-auto" />
          </Link>

          <Link to="/app/notifications" className="rounded-xl p-2 text-[#94867a] hover:text-[#2d2d2d] hover:bg-[#94867a]/10 transition-colors">
            <Bell size={20} />
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-6">
          {children}
        </main>

        {/* ── Mobile bottom navigation ── */}
        <nav className="fixed bottom-0 inset-x-0 z-30 flex lg:hidden
          border-t border-[#94867a]/15 bg-[#ebede5]/95 backdrop-blur-md
          pb-safe">
          {BOTTOM_NAV.map(({ to, icon: Icon, label, color }) => {
            const active = pathname === to || (to !== "/app" && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className="flex flex-1 flex-col items-center justify-center gap-1 py-3 transition-all"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                    !active && "text-[#2d2d2d]/45"
                  )}
                  style={active ? {
                    background: `linear-gradient(135deg, ${color}25, ${color}10)`,
                    color: color,
                  } : {}}
                >
                  <Icon size={18} />
                </span>
                <span
                  className={cn(
                    "text-[0.62rem] font-medium leading-none",
                    !active && "text-[#2d2d2d]/40"
                  )}
                  style={active ? { color } : {}}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

      </div>
    </div>
  );
};

export default ClientLayout;
