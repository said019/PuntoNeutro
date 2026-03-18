import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { differenceInCalendarDays } from "date-fns";
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { MembershipCard } from "@/components/MembershipCard";
import { Calendar, ClipboardList, Play, Star } from "lucide-react";
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

  const { data: walletData, isError: walletError } = useQuery({
    queryKey: ["wallet-pass"],
    queryFn: async () => (await api.get("/wallet/pass")).data,
    retry: false,
  });

  const { data: videosData } = useQuery({
    queryKey: ["recent-videos"],
    queryFn: async () => (await api.get("/videos?limit=4")).data,
  });

  const membership: ClientMembership | null = membershipData?.data ?? membershipData ?? null;
  const bookings: BookingClient[] = Array.isArray(bookingsData?.data) ? bookingsData.data : Array.isArray(bookingsData) ? bookingsData : [];
  const wallet = walletData?.data ?? walletData ?? null;
  const videos = Array.isArray(videosData?.data) ? videosData.data : Array.isArray(videosData) ? videosData : [];

  // Support both camelCase (server response) and snake_case (legacy)
  const planName = membership?.planName ?? membership?.plan_name ?? "Membresía";
  const classLimit = membership?.classLimit ?? membership?.class_limit ?? null;
  const classesRemaining = membership?.classesRemaining ?? membership?.classes_remaining ?? null;
  const endDate = membership?.endDate ?? membership?.end_date ?? null;

  const upcomingBookings = bookings
    .filter((b) => b.status === "confirmed" || b.status === "waitlist")
    .slice(0, 2);

  const daysRemaining = endDate
    ? Math.max(differenceInCalendarDays(safeParse(endDate), new Date()), 0)
    : null;

  const classesProgress =
    classLimit && classesRemaining !== null
      ? (classesRemaining / classLimit) * 100
      : null;

  return (
    <ClientAuthGuard requiredRoles={["client"]}>
      <ClientLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">¡Hola, {user?.display_name?.split(" ")[0]}!</h1>
            <p className="text-sm text-muted-foreground">Aquí está tu resumen de hoy</p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Button asChild size="sm"><Link to="/app/classes"><Calendar size={16} className="mr-2" />Reservar clase</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/app/bookings"><ClipboardList size={16} className="mr-2" />Mis reservas</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/app/videos"><Play size={16} className="mr-2" />Explorar videos</Link></Button>
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

            {/* Puntos */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Puntos de lealtad</CardTitle>
              </CardHeader>
              <CardContent>
                {(wallet || walletError) ? (
                  <div className="space-y-2">
                    <p className="text-3xl font-bold">{wallet?.points ?? 0}</p>
                    <p className="text-xs text-muted-foreground">puntos acumulados</p>
                    <Button asChild variant="outline" size="sm"><Link to="/app/wallet">Ver wallet</Link></Button>
                  </div>
                ) : (
                  <Skeleton className="h-16 w-full" />
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

          {/* Videos recientes */}
          {videos.length > 0 && (
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                <h2 className="font-semibold">Videos recientes</h2>
                <Link to="/app/videos" className="text-sm text-primary hover:underline">Ver todos</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:grid-cols-4">
                {videos.map((v: any) => (
                  <Link key={v.id} to={`/app/videos/${v.id}`}>
                    <div className="rounded-xl overflow-hidden border group cursor-pointer">
                      <div className="aspect-video bg-muted relative overflow-hidden">
                        {v.thumbnail_url && (
                          <img src={v.thumbnail_url} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />
                        )}
                        <div className="absolute bottom-1 right-1 bg-[#94867a]/25 text-[#2d2d2d] text-xs rounded px-1">
                          {Math.floor((v.duration_seconds ?? 0) / 60)} min
                        </div>
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium line-clamp-1">{v.title}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </ClientLayout>
    </ClientAuthGuard>
  );
};

export default Dashboard;
