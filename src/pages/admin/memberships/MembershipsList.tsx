import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MoreHorizontal, Plus } from "lucide-react";

const STATUS_OPTIONS = ["active", "pending_payment", "pending_activation", "expired", "cancelled"] as const;
type MembershipStatus = (typeof STATUS_OPTIONS)[number];

const STATUS_LABELS: Record<MembershipStatus, string> = {
  active: "Activa",
  pending_payment: "Pendiente pago",
  pending_activation: "Pendiente activación",
  expired: "Expirada",
  cancelled: "Cancelada",
};

const STATUS_VARIANTS: Record<MembershipStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  pending_payment: "outline",
  pending_activation: "outline",
  expired: "secondary",
  cancelled: "destructive",
};

interface Membership {
  id: string;
  userId: string;
  userName?: string;
  planId: string;
  planName?: string;
  status: MembershipStatus;
  paymentMethod?: string;
  startDate: string;
  endDate: string;
  classesRemaining: number;
}

const membershipSchema = z.object({
  userId: z.string().min(1),
  planId: z.string().min(1),
  paymentMethod: z.enum(["efectivo", "tarjeta", "transferencia"]).optional(),
  startDate: z.string().min(1),
});

type MembershipFormData = z.infer<typeof membershipSchema>;

const MembershipTable = ({ status, title }: { status?: string; title: string }) => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const url = status ? `/memberships?status=${status}` : "/memberships";
  const { data, isLoading } = useQuery<{ data: Membership[] }>({
    queryKey: ["memberships", status],
    queryFn: async () => (await api.get(url)).data,
  });
  const memberships = data?.data ?? [];

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.put(`/memberships/${id}/activate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memberships"] }); toast({ title: "Membresía activada" }); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.put(`/memberships/${id}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memberships"] }); toast({ title: "Membresía cancelada" }); },
  });

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Clases</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array(4).fill(0).map((_, i) => (
                <TableRow key={i}>{Array(6).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
              : memberships.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.userName ?? m.userId}</TableCell>
                  <TableCell>{m.planName ?? m.planId}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[m.status]}>{STATUS_LABELS[m.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{m.endDate ? new Date(m.endDate).toLocaleDateString("es-MX") : "—"}</TableCell>
                  <TableCell>{m.classesRemaining}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {m.status !== "active" && (
                          <DropdownMenuItem onClick={() => activateMutation.mutate(m.id)}>Activar</DropdownMenuItem>
                        )}
                        {m.status !== "cancelled" && (
                          <DropdownMenuItem className="text-destructive" onClick={() => cancelMutation.mutate(m.id)}>Cancelar</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const MembershipsList = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm<MembershipFormData>({ resolver: zodResolver(membershipSchema), defaultValues: { startDate: new Date().toISOString().split("T")[0] } });

  const createMutation = useMutation({
    mutationFn: (d: MembershipFormData) => api.post("/memberships", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memberships"] }); toast({ title: "Membresía asignada" }); setOpen(false); },
  });

  const { data: plansData } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["plans"],
    queryFn: async () => (await api.get("/plans")).data,
  });

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Membresías</h1>
            <Button size="sm" onClick={() => setOpen(true)}><Plus size={14} className="mr-1" />Asignar</Button>
          </div>

          <Tabs defaultValue="all">
            <TabsList className="mb-6">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="active">Activas</TabsTrigger>
              <TabsTrigger value="expiring">Por vencer</TabsTrigger>
              <TabsTrigger value="pending">Pendientes</TabsTrigger>
            </TabsList>
            <TabsContent value="all"><MembershipTable title="Todas las membresías" /></TabsContent>
            <TabsContent value="active"><MembershipTable status="active" title="Membresías activas" /></TabsContent>
            <TabsContent value="expiring"><MembershipTable status="expiring" title="Por vencer (7 días)" /></TabsContent>
            <TabsContent value="pending"><MembershipTable status="pending_payment" title="Pendientes de pago" /></TabsContent>
          </Tabs>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Asignar membresía</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              <div className="space-y-1">
                <Label>ID de cliente</Label>
                <Input {...form.register("userId")} placeholder="UUID del cliente" />
              </div>
              <div className="space-y-1">
                <Label>Plan</Label>
                <Select onValueChange={(v) => form.setValue("planId", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar plan" /></SelectTrigger>
                  <SelectContent>
                    {(plansData?.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Método de pago</Label>
                <Select onValueChange={(v) => form.setValue("paymentMethod", v as "efectivo")}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fecha de inicio</Label>
                <Input type="date" {...form.register("startDate")} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>Asignar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </AuthGuard>
  );
};

export default MembershipsList;
