import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Users, MessageSquare, RefreshCw, Wifi, WifiOff } from "lucide-react";

// Generic settings section
const SettingsSection = ({ settingKey, fields }: { settingKey: string; fields: { key: string; label: string; type?: string }[] }) => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["settings", settingKey],
    queryFn: async () => (await api.get(`/settings/${settingKey}`)).data,
  });

  const [values, setValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (data?.value ?? data?.data?.value) {
      setValues(data?.value ?? data?.data?.value ?? {});
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: () => api.put(`/settings/${settingKey}`, { value: values }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings", settingKey] }); toast({ title: "Configuración guardada" }); },
  });

  return (
    <div className="space-y-4 max-w-md">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label>{f.label}</Label>
          {f.type === "boolean"
            ? <div className="flex items-center gap-3"><Switch checked={!!values[f.key]} onCheckedChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))} /></div>
            : <Input type={f.type ?? "text"} value={values[f.key] ?? ""} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))} />
          }
        </div>
      ))}
      <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
        {updateMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
        Guardar
      </Button>
    </div>
  );
};

// WhatsApp Evolution API
const WhatsAppSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Connection ──────────────────────────────────────────────────────
  const { data: statusData, refetch, isFetching } = useQuery({
    queryKey: ["evolution-status"],
    queryFn: async () => (await api.get("/evolution/status")).data,
    refetchInterval: (query) => {
      const d = query.state.data as any;
      return d?.data?.state === "qr_pending" || d?.state === "qr_pending" ? 3000 : false;
    },
  });

  const status = (statusData as any)?.data ?? statusData ?? {};

  const connectMutation = useMutation({
    mutationFn: () => api.post("/evolution/connect"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["evolution-status"] }); refetch(); },
    onError: () => toast({ title: "Error al conectar", variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.post("/evolution/disconnect"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["evolution-status"] }); toast({ title: "WhatsApp desconectado" }); },
    onError: () => toast({ title: "Error al desconectar", variant: "destructive" }),
  });

  // ── Test message ────────────────────────────────────────────────────
  const [testPhone, setTestPhone] = useState("");
  const testMutation = useMutation({
    mutationFn: () => api.post("/evolution/send-test", { phone: testPhone }),
    onSuccess: () => toast({ title: "✅ Mensaje de prueba enviado" }),
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al enviar prueba", variant: "destructive" }),
  });

  // ── Notify clients ──────────────────────────────────────────────────
  const [notifyFilter, setNotifyFilter] = useState<"all" | "members" | "active">("all");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyResult, setNotifyResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const notifyMutation = useMutation({
    mutationFn: () => api.post("/evolution/notify-clients", { filter: notifyFilter, message: notifyMessage }),
    onSuccess: (res) => {
      const d = (res as any).data?.data ?? (res as any).data;
      setNotifyResult(d);
      toast({ title: `✅ Enviados ${d.sent} / ${d.total}` });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al enviar notificaciones", variant: "destructive" }),
  });

  const filterLabels: Record<string, string> = {
    all: "Todos los clientes",
    members: "Solo con membresía activa",
    active: "Clientes activos (últimos 60 días)",
  };

  return (
    <div className="space-y-8 max-w-xl">
      {/* ── Status ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            {status.connected ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-muted-foreground" />}
            Conexión WhatsApp
          </h3>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={status.connected ? "default" : "secondary"} className={status.connected ? "bg-green-500" : ""}>
            {status.connected ? "Conectado" : status.state === "qr_pending" ? "Esperando QR" : "Desconectado"}
          </Badge>
          {status.number && <span className="text-sm text-muted-foreground">{status.number}</span>}
        </div>

        {status.state === "qr_pending" && status.qrCode && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Escanea con WhatsApp para conectar:</p>
            <img src={status.qrCode} alt="QR Code" className="w-52 h-52 border border-border rounded-xl" />
            <p className="text-xs text-muted-foreground">Actualizando cada 3 segundos…</p>
          </div>
        )}

        <div className="flex gap-3">
          {!status.connected ? (
            <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
              {connectMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
              {status.state === "qr_pending" ? "Obtener nuevo QR" : "Conectar WhatsApp"}
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
              {disconnectMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
              Desconectar
            </Button>
          )}
        </div>
      </div>

      {/* ── Test message ────────────────────────────────────────────── */}
      {status.connected && (
        <div className="rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare size={16} />
            Mensaje de prueba
          </h3>
          <div className="flex gap-3">
            <Input
              placeholder="Ej. 5219991234567"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !testPhone}
            >
              {testMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Incluye código de país. Ej: 521 + 10 dígitos para México.</p>
        </div>
      )}

      {/* ── Notify clients ──────────────────────────────────────────── */}
      {status.connected && (
        <div className="rounded-xl border p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Users size={16} />
            Notificar a clientes
          </h3>

          <div className="space-y-1">
            <Label>Destinatarios</Label>
            <Select value={notifyFilter} onValueChange={(v) => setNotifyFilter(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                <SelectItem value="members">Solo con membresía activa</SelectItem>
                <SelectItem value="active">Clientes activos (últimos 60 días)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{filterLabels[notifyFilter]}</p>
          </div>

          <div className="space-y-1">
            <Label>Mensaje</Label>
            <Textarea
              placeholder="Escribe tu mensaje aquí…"
              rows={4}
              value={notifyMessage}
              onChange={(e) => setNotifyMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{notifyMessage.length} caracteres</p>
          </div>

          {notifyResult && (
            <div className="rounded-lg bg-muted px-4 py-3 text-sm space-y-1">
              <p>✅ Enviados: <strong>{notifyResult.sent}</strong></p>
              {notifyResult.failed > 0 && <p>❌ Fallidos: <strong>{notifyResult.failed}</strong></p>}
              <p className="text-muted-foreground">Total: {notifyResult.total}</p>
            </div>
          )}

          <Button
            onClick={() => { setNotifyResult(null); notifyMutation.mutate(); }}
            disabled={notifyMutation.isPending || !notifyMessage.trim()}
            className="w-full"
          >
            {notifyMutation.isPending
              ? <><Loader2 className="animate-spin mr-2" size={14} /> Enviando…</>
              : <><Send size={14} className="mr-2" /> Enviar notificación</>
            }
          </Button>
        </div>
      )}
    </div>
  );
};

const SettingsPage = () => (
  <AuthGuard>
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Configuración</h1>
        <Tabs defaultValue="general">
          <TabsList className="flex-wrap h-auto gap-1 mb-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="studio">Estudio</TabsTrigger>
            <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
            <TabsTrigger value="policies">Políticas</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <SettingsSection
              settingKey="general_settings"
              fields={[
                { key: "timezone", label: "Zona horaria" },
                { key: "currency", label: "Moneda" },
                { key: "date_format", label: "Formato de fecha" },
                { key: "language", label: "Idioma" },
                { key: "maintenance_mode", label: "Modo mantenimiento", type: "boolean" },
              ]}
            />
          </TabsContent>

          <TabsContent value="studio">
            <SettingsSection
              settingKey="studio_settings"
              fields={[
                { key: "name", label: "Nombre del estudio" },
                { key: "logo", label: "URL del logo" },
                { key: "address", label: "Dirección" },
                { key: "phone", label: "Teléfono" },
                { key: "instagram", label: "Instagram" },
                { key: "facebook", label: "Facebook" },
              ]}
            />
          </TabsContent>

          <TabsContent value="notifications">
            <SettingsSection
              settingKey="notification_settings"
              fields={[
                { key: "email_reminders", label: "Recordatorios por email", type: "boolean" },
                { key: "whatsapp_reminders", label: "Recordatorios por WhatsApp", type: "boolean" },
                { key: "reminder_hours_before", label: "Horas antes del recordatorio", type: "number" },
              ]}
            />
          </TabsContent>

          <TabsContent value="policies">
            <SettingsSection
              settingKey="policies_settings"
              fields={[
                { key: "cancellation_policy", label: "Política de cancelación" },
                { key: "terms_of_service", label: "Términos de servicio" },
              ]}
            />
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppSettings />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  </AuthGuard>
);

export default SettingsPage;
