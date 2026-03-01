import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();

  const { data: user, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => (await api.get(`/users/${id}`)).data,
    enabled: !!id,
  });

  const { data: bookings } = useQuery({
    queryKey: ["client-bookings", id],
    queryFn: async () => (await api.get(`/bookings?userId=${id}`)).data,
    enabled: !!id,
  });

  const { data: memberships } = useQuery({
    queryKey: ["client-memberships", id],
    queryFn: async () => (await api.get(`/memberships?userId=${id}`)).data,
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ["client-payments", id],
    queryFn: async () => (await api.get(`/payments?userId=${id}`)).data,
    enabled: !!id,
  });

  const { data: loyalty } = useQuery({
    queryKey: ["client-loyalty", id],
    queryFn: async () => (await api.get(`/loyalty/points/${id}`)).data,
    enabled: !!id,
  });

  const u = user?.data ?? user;

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto">
          {isLoading ? (
            <Skeleton className="h-10 w-60 mb-4" />
          ) : (
            <div className="mb-6">
              <h1 className="text-2xl font-bold">{u?.displayName}</h1>
              <p className="text-muted-foreground text-sm">{u?.email} · {u?.phone}</p>
            </div>
          )}

          <Tabs defaultValue="profile">
            <TabsList>
              <TabsTrigger value="profile">Perfil</TabsTrigger>
              <TabsTrigger value="memberships">Membresías</TabsTrigger>
              <TabsTrigger value="bookings">Reservas</TabsTrigger>
              <TabsTrigger value="payments">Pagos</TabsTrigger>
              <TabsTrigger value="loyalty">Lealtad</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-4">
              {isLoading ? <Skeleton className="h-40 w-full" /> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">Fecha de nacimiento:</span> {u?.dateOfBirth ?? "—"}</div>
                  <div><span className="font-medium">Emergencia:</span> {u?.emergencyContactName ?? "—"} {u?.emergencyContactPhone ?? ""}</div>
                  <div className="col-span-2"><span className="font-medium">Notas de salud:</span> {u?.healthNotes ?? "—"}</div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="memberships" className="mt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Estado</TableHead><TableHead>Vence</TableHead><TableHead>Clases</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(Array.isArray(memberships?.data) ? memberships.data : []).map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.planName ?? m.planId}</TableCell>
                      <TableCell><Badge>{m.status}</Badge></TableCell>
                      <TableCell>{m.endDate ? new Date(m.endDate).toLocaleDateString("es-MX") : "—"}</TableCell>
                      <TableCell>{m.classesRemaining}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="bookings" className="mt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Clase</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(Array.isArray(bookings?.data) ? bookings.data : []).map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.className ?? b.classId}</TableCell>
                      <TableCell>{b.startTime ? new Date(b.startTime).toLocaleString("es-MX", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                      <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Monto</TableHead><TableHead>Método</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(Array.isArray(payments?.data) ? payments.data : []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>${p.total_amount ?? p.amount}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell>{p.createdAt ? new Date(p.createdAt).toLocaleDateString("es-MX") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="loyalty" className="mt-4">
              <div className="text-4xl font-bold mb-2">{loyalty?.points ?? 0}</div>
              <p className="text-muted-foreground text-sm">puntos acumulados</p>
            </TabsContent>
          </Tabs>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

export default ClientDetail;
