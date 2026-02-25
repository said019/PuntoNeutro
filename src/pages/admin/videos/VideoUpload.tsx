import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const videoSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  level: z.enum(["principiante", "intermedio", "avanzado", "todos"]),
  access_type: z.enum(["gratuito", "miembros"]),
  is_published: z.boolean().default(false),
  duration_seconds: z.coerce.number().default(0),
  sales_enabled: z.boolean().default(false),
  sales_unlocks_video: z.boolean().default(false),
  sales_price_mxn: z.coerce.number().nullable(),
  sales_class_credits: z.coerce.number().default(0),
  sales_cta_text: z.string().default("Comprar acceso"),
  category_id: z.string().optional(),
  cloudinary_id: z.string().optional(),
  thumbnail_url: z.string().optional(),
  brand_color: z.string().optional(),
  tagline: z.string().optional(),
});

type VideoFormData = z.infer<typeof videoSchema>;

const VideoUpload = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");

  const { data: existingData } = useQuery({
    queryKey: ["video", editId],
    queryFn: async () => (await api.get(`/videos/${editId}`)).data,
    enabled: !!editId,
  });

  const { data: categoriesData } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["video-categories"],
    queryFn: async () => (await api.get("/videos/categories")).data,
  });

  const form = useForm<VideoFormData>({
    resolver: zodResolver(videoSchema),
    defaultValues: {
      level: "todos",
      access_type: "gratuito",
      is_published: false,
      sales_enabled: false,
      sales_unlocks_video: false,
      sales_price_mxn: null,
      sales_class_credits: 0,
      sales_cta_text: "Comprar acceso",
      duration_seconds: 0,
      ...(existingData?.data ?? existingData ?? {}),
    },
  });

  const createMutation = useMutation({
    mutationFn: (d: VideoFormData) => api.post("/videos", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos"] }); toast({ title: "Video creado" }); navigate("/admin/videos"); },
  });

  const updateMutation = useMutation({
    mutationFn: (d: VideoFormData) => api.put(`/videos/${editId}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos"] }); toast({ title: "Video actualizado" }); navigate("/admin/videos"); },
  });

  const onSubmit = (d: VideoFormData) => {
    if (editId) updateMutation.mutate(d);
    else createMutation.mutate(d);
  };

  const salesEnabled = form.watch("sales_enabled");

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6 max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">{editId ? "Editar video" : "Nuevo video"}</h1>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Metadata */}
            <div className="space-y-4">
              <h2 className="text-base font-semibold">Metadatos</h2>
              <div className="space-y-1"><Label>Título *</Label><Input {...form.register("title")} /></div>
              <div className="space-y-1"><Label>Descripción</Label><Input {...form.register("description")} /></div>
              <div className="space-y-1"><Label>Tagline</Label><Input {...form.register("tagline")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nivel</Label>
                  <Select defaultValue="todos" onValueChange={(v) => form.setValue("level", v as "todos")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["principiante", "intermedio", "avanzado", "todos"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Categoría</Label>
                  <Select onValueChange={(v) => form.setValue("category_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {(categoriesData?.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Cloudinary ID</Label><Input {...form.register("cloudinary_id")} /></div>
                <div className="space-y-1"><Label>URL Miniatura</Label><Input {...form.register("thumbnail_url")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Duración (segundos)</Label><Input type="number" {...form.register("duration_seconds")} /></div>
                <div className="space-y-1"><Label>Color de marca</Label><Input type="color" {...form.register("brand_color")} className="h-10 cursor-pointer" /></div>
              </div>
            </div>

            {/* Access */}
            <div className="space-y-4">
              <h2 className="text-base font-semibold">Acceso y publicación</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo de acceso</Label>
                  <Select defaultValue="gratuito" onValueChange={(v) => form.setValue("access_type", v as "gratuito")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gratuito">Gratuito</SelectItem>
                      <SelectItem value="miembros">Solo miembros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.watch("is_published")} onCheckedChange={(v) => form.setValue("is_published", v)} />
                <Label>Publicado</Label>
              </div>
            </div>

            {/* Sales */}
            <div className="space-y-4">
              <h2 className="text-base font-semibold">Venta individual</h2>
              <div className="flex items-center gap-3">
                <Switch checked={salesEnabled} onCheckedChange={(v) => form.setValue("sales_enabled", v)} />
                <Label>Activar precio promocional / venta</Label>
              </div>
              {salesEnabled && (
                <>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.watch("sales_unlocks_video")} onCheckedChange={(v) => form.setValue("sales_unlocks_video", v)} />
                    <Label>Requiere compra para ver</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Precio (MXN)</Label><Input type="number" {...form.register("sales_price_mxn")} /></div>
                    <div className="space-y-1"><Label>Créditos de clase incluidos</Label><Input type="number" {...form.register("sales_class_credits")} /></div>
                  </div>
                  <div className="space-y-1"><Label>Texto del botón</Label><Input {...form.register("sales_cta_text")} /></div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => navigate("/admin/videos")}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                {editId ? "Guardar cambios" : "Crear video"}
              </Button>
            </div>
          </form>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

export default VideoUpload;
