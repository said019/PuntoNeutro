import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import {
  LayoutDashboard, Calendar, ClipboardList, ShoppingCart, Package,
  Wallet, Play, User, Bell, LogOut, Menu, X, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/app", label: "Inicio", icon: LayoutDashboard },
  { to: "/app/classes", label: "Reservar clase", icon: Calendar },
  { to: "/app/bookings", label: "Mis reservas", icon: ClipboardList },
  { to: "/app/checkout", label: "Membresía", icon: ShoppingCart },
  { to: "/app/orders", label: "Mis órdenes", icon: Package },
  { to: "/app/wallet", label: "Club / Wallet", icon: Wallet },
  { to: "/app/videos", label: "Videos", icon: Play },
  { to: "/app/profile", label: "Perfil", icon: User },
  { to: "/app/notifications", label: "Notificaciones", icon: Bell },
];

const NavItem = ({ to, label, icon: Icon, onClick }: { to: string; label: string; icon: any; onClick?: () => void }) => {
  const location = useLocation();
  const active = location.pathname === to || (to !== "/app" && location.pathname.startsWith(to));
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon size={18} />
      <span>{label}</span>
      {active && <ChevronRight size={14} className="ml-auto" />}
    </Link>
  );
};

const ClientLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/auth/login");
  };

  const initials = user?.display_name
    ? user.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <span className="text-lg font-bold tracking-tight">Ophelia Studio</span>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(false)}>
            <X size={18} />
          </Button>
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            {user?.photo_url ? <img src={user.photo_url} className="h-9 w-9 rounded-full object-cover" /> : initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.display_name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} onClick={() => setOpen(false)} />
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t p-3">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground" onClick={handleLogout}>
            <LogOut size={16} />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="flex h-14 items-center border-b bg-card px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </Button>
          <span className="ml-3 font-semibold">Ophelia Studio</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
};

export default ClientLayout;
