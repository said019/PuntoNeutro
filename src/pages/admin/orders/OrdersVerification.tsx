import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const STATUS_BADGE: Record<string, "default" | "outline" | "destructive" | "secondary"> = {
  pending_payment: "outline",
  pending_verification: "outline",
  approved: "default",
  rejected: "destructive",
  cancelled: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Esperando pago",
  pending_verification: "Por verificar",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

interface Order {
  id: string;
  userName: string;
  userId: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  proofUrl?: string;
  planName?: string;
  notes?: string;
}

const OrdersTable = ({ url, queryKey }: { url: string; queryKey: string[] }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Order | null>(null);
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery<{ data: Order[] }>({
    queryKey,
    queryFn: async () => (await api.get(url)).data,
  });
  const orders = Array.isArray(data?.data) ? data.data : [];

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => api.put(`/admin/orders/${id}/verify`, { notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["orders"] }); toast({ title: "Orden aprobada" }); setSelected(null); },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => api.put(`/admin/orders/${id}/reject`, { notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["orders"] }); toast({ title: "Orden rechazada" }); setSelected(null); },
  });

  return (
    <>
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array(4).fill(0).map((_, i) => (
                <TableRow key={i}>{Array(5).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
              : orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{o.userName ?? o.userId}</TableCell>
                  <TableCell>${Number(o.totalAmount).toFixed(2)} MXN</TableCell>
                  <TableCell><Badge variant={STATUS_BADGE[o.status] ?? "outline"}>{STATUS_LABEL[o.status] ?? o.status}</Badge></TableCell>
                  <TableCell className="text-sm">{new Date(o.createdAt).toLocaleDateString("es-MX")}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => { setSelected(o); setNotes(""); }}>
                      Ver detalle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Order detail dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detalle de orden #{selected?.id?.slice(0, 8)}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <div><span className="font-medium">Cliente:</span> {selected.userName}</div>
                <div><span className="font-medium">Plan:</span> {selected.planName ?? "—"}</div>
                <div><span className="font-medium">Monto:</span> ${Number(selected.totalAmount).toFixed(2)} MXN</div>
                <div><span className="font-medium">Estado:</span> <Badge variant={STATUS_BADGE[selected.status] ?? "outline"}>{STATUS_LABEL[selected.status] ?? selected.status}</Badge></div>
              </div>
              {selected.proofUrl && (
                <div>
                  <Label className="mb-2 block">Comprobante</Label>
                  {selected.proofUrl.endsWith(".pdf")
                    ? <a href={selected.proofUrl} target="_blank" rel="noreferrer" className="text-primary text-sm underline">Ver PDF</a>
                    : (
                      <a href={selected.proofUrl} target="_blank" rel="noreferrer" title="Click para ver en tamaño completo">
                        <img
                          src={selected.proofUrl}
                          alt="Comprobante"
                          className="max-h-64 rounded-lg object-contain border border-border cursor-pointer hover:opacity-80 transition-opacity"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Click en la imagen para verla en tamaño completo</p>
                      </a>
                    )
                  }
                </div>
              )}
              <div className="space-y-1">
                <Label>Notas del admin</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional..." />
              </div>
              <DialogFooter>
                {selected.status === "pending_verification" && (
                  <>
                    <Button variant="destructive" onClick={() => rejectMutation.mutate({ id: selected.id, notes })}>Rechazar</Button>
                    <Button onClick={() => approveMutation.mutate({ id: selected.id, notes })}>Aprobar</Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const OrdersVerification = () => (
  <AuthGuard>
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Verificación de Órdenes</h1>
        <Tabs defaultValue="pending_verification">
          <TabsList>
            <TabsTrigger value="pending_verification">Por verificar</TabsTrigger>
            <TabsTrigger value="pending_payment">Esperando pago</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
          <TabsContent value="pending_verification" className="mt-4">
            <OrdersTable url="/admin/orders?status=pending_verification" queryKey={["orders", "pending_verification"]} />
          </TabsContent>
          <TabsContent value="pending_payment" className="mt-4">
            <OrdersTable url="/admin/orders?status=pending_payment" queryKey={["orders", "pending_payment"]} />
          </TabsContent>
          <TabsContent value="all" className="mt-4">
            <OrdersTable url="/admin/orders" queryKey={["orders", "all"]} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  </AuthGuard>
);

export default OrdersVerification;
