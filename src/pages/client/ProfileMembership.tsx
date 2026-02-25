import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import api from "@/lib/api";
import { ClientAuthGuard } from "@/components/layout/ClientAuthGuard";
import ClientLayout from "@/components/layout/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import type { ClientMembership } from "@/types/membership";

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  expired: "Vencida",
  pending_payment: "Pago pendiente",
  pending_activation: "Por activar",
  cancelled: "Cancelada",
};

const ProfileMembership = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["my-membership"],
    queryFn: async () => (await api.get("/memberships/my")).data,
  });
  const membership: ClientMembership | null = data?.data ?? data ?? null;

  const daysRemaining = membership?.end_date
    ? Math.max(differenceInCalendarDays(parseISO(membership.end_date), new Date()), 0)
    : null;

  const classesProgress =
    membership?.class_limit && membership.classes_remaining !== null
      ? (membership.classes_remaining / membership.class_limit) * 100
      : null;

  return (
    <ClientAuthGuard requiredRoles={["client"]}>
      <ClientLayout>
        <div className="max-w-md space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/app/profile")}>
            <ArrowLeft size={16} className="mr-2" />Perfil
          </Button>
          <h1 className="text-xl font-bold">Mi membresía</h1>
          {isLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : membership ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {membership.plan_name}
                  <Badge variant={membership.status === "active" ? "default" : "secondary"}>
                    {STATUS_LABELS[membership.status] ?? membership.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Inicio</p>
                    <p className="font-medium">{format(parseISO(membership.start_date), "d MMM yyyy", { locale: es })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vencimiento</p>
                    <p className="font-medium">{format(parseISO(membership.end_date), "d MMM yyyy", { locale: es })}</p>
                  </div>
                </div>
                {daysRemaining !== null && (
                  <p className="text-sm text-muted-foreground">{daysRemaining} días restantes</p>
                )}
                {classesProgress !== null && membership.classes_remaining !== null && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Clases restantes</span>
                      <span className="font-medium">{membership.classes_remaining} / {membership.class_limit}</span>
                    </div>
                    <Progress value={classesProgress} className="h-2" />
                  </div>
                )}
                {membership.status !== "active" && (
                  <Button asChild className="w-full">
                    <Link to="/app/checkout">Renovar membresía</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">No tienes membresía activa</p>
              <Button asChild><Link to="/app/checkout">Adquirir membresía</Link></Button>
            </div>
          )}
        </div>
      </ClientLayout>
    </ClientAuthGuard>
  );
};

export default ProfileMembership;
