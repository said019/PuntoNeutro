import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { ClientAuthGuard } from "@/components/layout/ClientAuthGuard";
import ClientLayout from "@/components/layout/ClientLayout";
import { Button } from "@/components/ui/button";
import { ChevronRight, User, CreditCard, Bell, Users } from "lucide-react";

const ProfileLink = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <Link to={to} className="flex items-center justify-between rounded-xl border p-4 hover:bg-accent/30 transition-colors">
    <div className="flex items-center gap-3">
      <Icon size={18} className="text-muted-foreground" />
      <span className="font-medium">{label}</span>
    </div>
    <ChevronRight size={16} className="text-muted-foreground" />
  </Link>
);

const Profile = () => {
  const { user } = useAuthStore();
  const initials = user?.display_name
    ? user.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <ClientAuthGuard requiredRoles={["client"]}>
      <ClientLayout>
        <div className="max-w-md space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
              {user?.photo_url ? <img src={user.photo_url} className="h-16 w-16 rounded-full object-cover" /> : initials}
            </div>
            <div>
              <p className="text-xl font-bold">{user?.display_name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {user?.phone && <p className="text-sm text-muted-foreground">{user.phone}</p>}
            </div>
          </div>

          {/* Links */}
          <div className="space-y-2">
            <ProfileLink to="/app/profile/edit" icon={User} label="Editar perfil" />
            <ProfileLink to="/app/profile/membership" icon={CreditCard} label="Mi membresía" />
            <ProfileLink to="/app/profile/preferences" icon={Bell} label="Preferencias de notificación" />
            <ProfileLink to="/app/profile/refer" icon={Users} label="Referir amigos" />
          </div>
        </div>
      </ClientLayout>
    </ClientAuthGuard>
  );
};

export default Profile;
