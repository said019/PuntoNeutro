import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

// ── Cash Assignment Wizard ──────────────────────────────
const CashAssignment = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedUser, setSelectedUser] = useState<{ id: string; displayName: string } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<{ id: string; name: string; price: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const { data: usersData, isLoading: usersLoading } = useQuery<{ data: { id: string; displayName: string; email: string }[] }>({
    queryKey: ["users-search", debouncedSearch],
    queryFn: async () => (await api.get(`/users?role=client&search=${debouncedSearch}`)).data,
    enabled: !!debouncedSearch,
  });

  const { data: plansData } = useQuery<{ data: { id: string; name: string; price: number }[] }>({
    queryKey: ["plans"],
    queryFn: async () => (await api.get("/plans")).data,
  });

  const assignMutation = useMutation({
    mutationFn: () => api.post("/memberships", { userId: selectedUser?.id, planId: selectedPlan?.id, paymentMethod, startDate: new Date().toISOString().split("T")[0] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["memberships"] });
      toast({ title: "Membresía asignada correctamente" });
      setStep(1); setSelectedUser(null); setSelectedPlan(null);
    },
  });

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-6">Asignación de pago en efectivo</h2>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {["Buscar cliente", "Elegir plan", "Confirmar pago"].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step > i + 1 ? "bg-primary text-primary-foreground" : step === i + 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}</div>
            <span className={`text-sm ${step === i + 1 ? "font-medium" : "text-muted-foreground"}`}>{s}</span>
            {i < 2 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <Label>Buscar cliente por nombre o email</Label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Escribir para buscar..." />
          </div>
          {usersLoading && <Loader2 className="animate-spin" />}
          <div className="space-y-2">
            {(Array.isArray(usersData?.data) ? usersData.data : []).map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted cursor-pointer"
                onClick={() => { setSelectedUser(u); setStep(2); }}
              >
                <div>
                  <p className="font-medium text-sm">{u.displayName}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Button size="sm" variant="outline">Seleccionar</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Cliente: <strong>{selectedUser?.displayName}</strong></p>
          <Label>Elegir plan</Label>
          <div className="space-y-2">
            {(Array.isArray(plansData?.data) ? plansData.data : []).map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${selectedPlan?.id === p.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
                onClick={() => setSelectedPlan(p)}
              >
                <span className="font-medium text-sm">{p.name}</span>
                <span className="font-bold">${p.price} MXN</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>Volver</Button>
            <Button onClick={() => setStep(3)} disabled={!selectedPlan}>Continuar</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-secondary space-y-2 text-sm">
            <div className="flex justify-between"><span>Cliente:</span><span className="font-medium">{selectedUser?.displayName}</span></div>
            <div className="flex justify-between"><span>Plan:</span><span className="font-medium">{selectedPlan?.name}</span></div>
            <div className="flex justify-between"><span>Total:</span><span className="font-bold">${selectedPlan?.price} MXN</span></div>
          </div>
          <div className="space-y-1">
            <Label>Método de pago</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>Volver</Button>
            <Button onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
              {assignMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
              Confirmar y activar membresía
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Payments Register ───────────────────────────────────
const PaymentsRegister = () => {
  const { data } = useQuery<{ data: any[] }>({
    queryKey: ["payments"],
    queryFn: async () => (await api.get("/payments")).data,
  });
  const payments = Array.isArray(data?.data) ? data.data : [];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Historial de pagos</h2>
      <Table>
        <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Monto</TableHead><TableHead>Método</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
        <TableBody>
          {payments.map((p: any) => (
            <TableRow key={p.id}>
              <TableCell>{p.userName ?? p.userId}</TableCell>
              <TableCell>${p.amount} MXN</TableCell>
              <TableCell><Badge variant="outline">{p.method}</Badge></TableCell>
              <TableCell className="text-sm">{p.createdAt ? new Date(p.createdAt).toLocaleDateString("es-MX") : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// ── Main Payments Page ──────────────────────────────────
const PaymentsPage = () => (
  <AuthGuard>
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Pagos</h1>
        <Tabs defaultValue="cash">
          <TabsList>
            <TabsTrigger value="cash">Asignación efectivo</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>
          <TabsContent value="cash"><CashAssignment /></TabsContent>
          <TabsContent value="history" className="mt-4"><PaymentsRegister /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  </AuthGuard>
);

export default PaymentsPage;
