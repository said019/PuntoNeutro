import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { es } from "date-fns/locale";
import { format } from "date-fns";
import api from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { ClientAuthGuard } from "@/components/layout/ClientAuthGuard";
import ClientLayout from "@/components/layout/ClientLayout";
import { safeParse } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MembershipCard } from "@/components/MembershipCard";
import { Calendar, ClipboardList } from "lucide-react";
import type { ClientMembership } from "@/types/membership";
import type { BookingClient } from "@/types/booking";

const Dashboard = () => {
  const { user } = useAuthStore();

  const { data: membershipData, isLoading: loadingMembership } = useQuery({
    queryKey: ["my-membership"],
    queryFn: async () => (await api.get("/memberships/my")).data,
  });

  const { data: bookingsData, isLoading: loadingBookings } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => (await api.get("/bookings/my-bookings")).data,
  });

  // API returns { data: <membership|null> } — extract the inner payload.
  // Guard against the wrapper object being truthy when the actual value is null.
  const rawMembership = membershipData?.data !== undefined ? membershipData.data : membershipData;
  const membership: ClientMembership | null =
    rawMembership && typeof rawMembership === "object" && "id" in rawMembership ? rawMembership : null;

  const bookings: BookingClient[] = Array.isArray(bookingsData?.data) ? bookingsData.data : Array.isArray(bookingsData) ? bookingsData : [];

  const upcomingBookings = bookings
    .filter((b) => b.status === "confirmed" || b.status === "waitlist")
    .slice(0, 2);

  return (
    <ClientAuthGuard requiredRoles={["client"]}>
      <ClientLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">¡Hola, {(user?.displayName ?? user?.display_name ?? user?.email?.split("@")[0] ?? "")?.split(" ")[0]}!</h1>
            <p className="text-sm text-muted-foreground">Aquí está tu resumen de hoy</p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Button asChild size="sm"><Link to="/app/classes"><Calendar size={16} className="mr-2" />Reservar clase</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/app/bookings"><ClipboardList size={16} className="mr-2" />Mis reservas</Link></Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Membresía */}
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Mi membresía</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingMembership ? (
                  <Skeleton className="h-40 w-full rounded-2xl" />
                ) : membership ? (
                  <MembershipCard membership={membership} />
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">No tienes membresía activa</p>
                    <Button asChild size="sm"><Link to="/app/checkout">Adquirir membresía</Link></Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Próximas clases */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Próximas clases</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBookings ? (
                <Skeleton className="h-20 w-full" />
              ) : upcomingBookings.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">No tienes clases próximas</p>
                  <Button asChild size="sm"><Link to="/app/classes">Reservar ahora</Link></Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingBookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium text-sm">{b.class_type_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.start_time ? format(safeParse(b.start_time), "EEEE d MMM · HH:mm", { locale: es }) : "—"} · {b.instructor_name ?? b.class_type_name}
                        </p>
                      </div>
                      <Badge variant={b.status === "waitlist" ? "secondary" : "default"}>
                        {b.status === "waitlist" ? "Espera" : "Confirmada"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Videos — section available when /app/videos page is built */}
        </div>
      </ClientLayout>
    </ClientAuthGuard>
  );
};

export default Dashboard;
