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
import { Calendar, ClipboardList, Stethoscope, Clock, CalendarCheck, ShoppingBag, ArrowRight, Sparkles, Upload, CreditCard, Banknote } from "lucide-react";
import type { ClientMembership } from "@/types/membership";
import type { BookingClient } from "@/types/booking";

interface Consultation {
  id: string;
  complement_type: string;
  complement_name: string;
  specialist: string;
  status: "pending" | "scheduled";
  scheduled_date: string | null;
  notes: string | null;
  created_at: string;
}

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

  const { data: consultationsData } = useQuery({
    queryKey: ["my-consultations"],
    queryFn: async () => (await api.get("/consultations/my")).data,
  });

  const { data: ordersData } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => (await api.get("/orders")).data,
  });

  const pendingOrders: any[] = (Array.isArray(ordersData?.data) ? ordersData.data : [])
    .filter((o: any) => o.status === "pending_payment" || o.status === "pending_verification");

  const consultations: Consultation[] = Array.isArray(consultationsData?.data)
    ? consultationsData.data
    : Array.isArray(consultationsData) ? consultationsData : [];

  // API returns { data: <membership|null> } — extract the inner payload.
  // Guard against the wrapper object being truthy when the actual value is null.
  const rawMembership = membershipData?.data !== undefined ? membershipData.data : membershipData;
  const membership: ClientMembership | null =
    rawMembership && typeof rawMembership === "object" && "id" in rawMembership ? rawMembership : null;

  const bookings: BookingClient[] = Array.isArray(bookingsData?.data) ? bookingsData.data : Array.isArray(bookingsData) ? bookingsData : [];

  const upcomingBookings = bookings
    .filter((b) => b.status === "confirmed" || b.status === "waitlist")
    .slice(0, 2);

  const classesRemaining = membership?.classesRemaining ?? membership?.classes_remaining ?? null;
  const isLowCredits = membership && classesRemaining !== null && classesRemaining <= 2;
  const noMembership = !loadingMembership && !membership;

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
            <Button asChild variant="outline" size="sm"><Link to="/app/checkout"><ShoppingBag size={16} className="mr-2" />Adquirir plan</Link></Button>
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

          {/* CTA: Adquirir / Renovar plan */}
          {(noMembership || isLowCredits) && (
            <Link to="/app/checkout" className="block no-underline">
              <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/15">
                      <Sparkles size={20} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">
                        {noMembership ? "Adquiere tu membresía" : "Renueva tu plan"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {noMembership
                          ? "Elige el plan ideal para ti y comienza a reservar clases"
                          : `Te quedan ${classesRemaining} clase${classesRemaining === 1 ? "" : "s"} — renueva para seguir entrenando`}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} className="text-primary shrink-0" />
                </div>
              </div>
            </Link>
          )}

          {/* Órdenes pendientes */}
          {pendingOrders.length > 0 && (
            <Card className="border-[#94867a]/30 bg-[#94867a]/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[#94867a] flex items-center gap-2">
                  <CreditCard size={16} />
                  {pendingOrders.length === 1 ? "Orden pendiente" : "Órdenes pendientes"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingOrders.map((o: any) => (
                    <div key={o.id} className="rounded-xl border border-[#94867a]/20 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-sm text-[#2d2d2d]">{o.plan_name}</p>
                          <p className="text-xs text-[#5a524a]">
                            ${Number(o.total_amount).toLocaleString("es-MX")} MXN · {o.payment_method === "cash" ? "Efectivo" : "Transferencia"}
                          </p>
                          {o.order_number && (
                            <p className="text-[10px] text-[#94867a] font-mono">Orden: {o.order_number}</p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={o.status === "pending_payment"
                            ? "border-amber-500/50 text-amber-700 bg-amber-50"
                            : "border-blue-500/50 text-blue-700 bg-blue-50"
                          }
                        >
                          {o.status === "pending_payment" ? (
                            <><Upload size={11} className="mr-1" /> Subir comprobante</>
                          ) : (
                            <><Clock size={11} className="mr-1" /> En revisión</>
                          )}
                        </Badge>
                      </div>
                      {o.status === "pending_payment" && (
                        <Button asChild size="sm" className="mt-3 w-full sm:w-auto">
                          <Link to={`/app/checkout?orderId=${o.id}`}>
                            <Upload size={14} className="mr-2" />Subir comprobante de pago
                          </Link>
                        </Button>
                      )}
                      {o.status === "pending_verification" && o.payment_method === "cash" && (
                        <p className="text-xs text-blue-700 mt-3 bg-blue-50 rounded-lg px-3 py-2">
                          Acércate a recepción para completar tu pago. Tu membresía se activará al confirmar.
                        </p>
                      )}
                      {o.status === "pending_verification" && o.payment_method !== "cash" && (
                        <p className="text-xs text-blue-700 mt-3 bg-blue-50 rounded-lg px-3 py-2">
                          Tu comprobante está siendo revisado. Recibirás una notificación cuando se apruebe.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Consultas pendientes */}
          {consultations.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-800 flex items-center gap-2">
                  <Stethoscope size={16} />
                  Consulta pendiente por agendar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {consultations.map((c) => (
                    <div key={c.id} className="rounded-xl border border-amber-400/40 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-sm text-foreground">{c.complement_name}</p>
                          <p className="text-xs text-muted-foreground">Especialista: {c.specialist}</p>
                          {c.status === "scheduled" && c.scheduled_date && (
                            <p className="text-xs text-green-700 font-medium flex items-center gap-1 mt-1">
                              <CalendarCheck size={12} />
                              Agendada: {format(new Date(c.scheduled_date), "EEEE d 'de' MMMM · HH:mm", { locale: es })}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={c.status === "scheduled"
                            ? "border-green-500/50 text-green-700 bg-green-50"
                            : "border-amber-500/50 text-amber-700 bg-amber-50"
                          }
                        >
                          {c.status === "scheduled" ? (
                            <><CalendarCheck size={11} className="mr-1" /> Agendada</>
                          ) : (
                            <><Clock size={11} className="mr-1" /> Pendiente</>
                          )}
                        </Badge>
                      </div>
                      {c.status === "pending" && (
                        <p className="text-xs text-amber-700 mt-3 bg-amber-100/60 rounded-lg px-3 py-2">
                          Tu consulta está incluida en tu membresía. El estudio se pondrá en contacto contigo para agendar tu cita.
                        </p>
                      )}
                      {c.notes && (
                        <p className="text-xs text-muted-foreground mt-2 italic">Nota: {c.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
