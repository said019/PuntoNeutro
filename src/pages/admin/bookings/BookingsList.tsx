import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

const STATUS_OPTIONS = ["confirmed", "waitlist", "checked_in", "no_show", "cancelled"];

interface BookingsListProps {
  title?: string;
  initialStatus?: string;
  statusLocked?: boolean;
}

interface Booking {
  id: string;
  userId: string;
  userName?: string;
  classId: string;
  className?: string;
  startTime?: string;
  status: string;
}

const BookingsList = ({ title = "Reservas", initialStatus, statusLocked = false }: BookingsListProps) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState(initialStatus ?? "all");

  const url = status && status !== "all" ? `/bookings?status=${status}` : "/bookings";
  const { data, isLoading } = useQuery<{ data: Booking[] }>({
    queryKey: ["bookings", status],
    queryFn: async () => (await api.get(url)).data,
  });
  const bookings = Array.isArray(data?.data) ? data.data : [];

  const checkinMutation = useMutation({
    mutationFn: (id: string) => api.put(`/bookings/${id}/check-in`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bookings"] }); toast({ title: "Check-in realizado" }); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bookings/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bookings"] }); toast({ title: "Reserva cancelada" }); },
  });

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">{title}</h1>
            {!statusLocked && (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Clase</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>{Array(5).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
                  ))
                  : bookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.userName ?? b.userId}</TableCell>
                      <TableCell>{b.className ?? b.classId}</TableCell>
                      <TableCell className="text-sm">{b.startTime ? new Date(b.startTime).toLocaleString("es-MX") : "—"}</TableCell>
                      <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {b.status !== "checked_in" && (
                            <Button size="sm" variant="outline" onClick={() => checkinMutation.mutate(b.id)}>Check-in</Button>
                          )}
                          {b.status !== "cancelled" && (
                            <Button size="sm" variant="destructive" onClick={() => cancelMutation.mutate(b.id)}>Cancelar</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

export default BookingsList;
