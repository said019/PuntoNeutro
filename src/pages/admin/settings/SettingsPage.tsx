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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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

  const { data: statusData, refetch } = useQuery({
    queryKey: ["evolution-status"],
    queryFn: async () => (await api.get("/evolution/status")).data,
    refetchInterval: (data: any) => (data?.state === "qr_pending" ? 3000 : false),
  });

  const status = statusData?.data ?? statusData ?? {};

  const connectMutation = useMutation({
    mutationFn: () => api.post("/evolution/connect"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["evolution-status"] }); refetch(); },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.post("/evolution/disconnect"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["evolution-status"] }); toast({ title: "Desconectado" }); },
  });

  const testMutation = useMutation({
    mutationFn: () => api.post("/evolution/send-test"),
    onSuccess: () => toast({ title: "Mensaje de prueba enviado" }),
  });

  return (
    <div className="space-y-6 max-w-md">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Estado:</span>
        <Badge variant={status.connected ? "default" : "secondary"}>
          {status.state ?? "no_configured"}
        </Badge>
        {status.number && <span className="text-sm text-muted-foreground">{status.number}</span>}
      </div>

      {status.state === "qr_pending" && status.qrCode && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">Escanea con WhatsApp para conectar:</p>
          <img src={status.qrCode} alt="QR Code" className="w-48 h-48 border border-border rounded-xl" />
          <p className="text-xs text-muted-foreground mt-2">Actualizando automáticamente...</p>
        </div>
      )}

      <div className="flex gap-3">
        {!status.connected
          ? <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
              {connectMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
              Conectar WhatsApp
            </Button>
          : <>
              <Button variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>Enviar mensaje de prueba</Button>
              <Button variant="destructive" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>Desconectar</Button>
            </>
        }
      </div>
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
