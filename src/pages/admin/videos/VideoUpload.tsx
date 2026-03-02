import { useState, useRef } from "react";
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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Video, Image, CheckCircle2, ExternalLink } from "lucide-react";

const videoSchema = z.object({
  title: z.string().min(1, "Título requerido"),
  description: z.string().optional(),
  tagline: z.string().optional(),
  subtitle: z.string().optional(),
  days: z.string().optional(),
  level: z.enum(["principiante", "intermedio", "avanzado", "todos"]).default("todos"),
  access_type: z.enum(["gratuito", "miembros", "free", "members"]).default("gratuito"),
  is_published: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  duration_seconds: z.coerce.number().default(0),
  sort_order: z.coerce.number().default(0),
  sales_enabled: z.boolean().default(false),
  sales_unlocks_video: z.boolean().default(false),
  sales_price_mxn: z.coerce.number().nullable().optional(),
  sales_class_credits: z.coerce.number().optional(),
  sales_cta_text: z.string().optional(),
  category_id: z.string().optional(),
  brand_color: z.string().optional(),
  // set by upload response
  drive_file_id: z.string().optional(),
  cloudinary_id: z.string().optional(),
  thumbnail_url: z.string().optional(),
  thumbnail_drive_id: z.string().optional(),
});

type VideoFormData = z.infer<typeof videoSchema>;

const VideoUpload = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");

  // Upload state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedEmbedUrl, setUploadedEmbedUrl] = useState<string | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);

  const { data: existingData } = useQuery({
    queryKey: ["video", editId],
    queryFn: async () => (await api.get(`/videos/${editId}`)).data,
    enabled: !!editId,
  });

  const existing = existingData?.data ?? existingData ?? null;

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
      is_featured: false,
      sales_enabled: false,
      sales_unlocks_video: false,
      sales_price_mxn: null,
      sales_class_credits: 0,
      sales_cta_text: "Comprar acceso",
      duration_seconds: 0,
      sort_order: 0,
      brand_color: "#E15CB8",
      ...( existing ?? {} ),
    },
  });

  // Pre-fill embed URL when editing
  const existingDriveId = existing?.drive_file_id;
  if (existingDriveId && !uploadedEmbedUrl) {
    setUploadedEmbedUrl(`https://drive.google.com/file/d/${existingDriveId}/preview`);
  }

  const createMutation = useMutation({
    mutationFn: (d: VideoFormData) => api.post("/videos", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos"] }); toast({ title: "✅ Video creado" }); navigate("/admin/videos"); },
    onError: () => toast({ title: "Error al crear video", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (d: VideoFormData) => api.put(`/videos/${editId}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos"] }); toast({ title: "✅ Video actualizado" }); navigate("/admin/videos"); },
    onError: () => toast({ title: "Error al actualizar video", variant: "destructive" }),
  });

  // Direct-to-Drive upload: init session on server, upload directly to googleapis.com
  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const videoFile = e.target.files?.[0];
    if (!videoFile) return;

    // Client-side size check (500 MB)
    const MAX_MB = 500;
    if (videoFile.size > MAX_MB * 1024 * 1024) {
      toast({ title: `El archivo es demasiado grande. Máximo ${MAX_MB} MB.`, variant: "destructive" });
      return;
    }

    setVideoFileName(videoFile.name);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadedEmbedUrl(null);

    try {
      // Step 1: Get resumable upload URL from our server (small JSON request)
      const initResp = await api.post("/drive/init-upload", {
        fileName: `video_${Date.now()}_${videoFile.name}`,
        mimeType: videoFile.type || "video/mp4",
        fileSize: videoFile.size,
      });
      const { uploadUrl } = initResp.data?.data || initResp.data || {};
      if (!uploadUrl) throw new Error("No se obtuvo URL de subida");

      // Step 2: Upload directly to Google Drive via XHR (for progress)
      const driveFileId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", videoFile.type || "video/mp4");

        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 90));
        };

        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result.id);
            } catch {
              reject(new Error("Respuesta inválida de Google Drive"));
            }
          } else {
            reject(new Error(`Error de Google Drive: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Error de red al subir a Google Drive"));
        xhr.send(videoFile);
      });

      setUploadProgress(93);

      // Step 3: Make file public
      await api.post(`/drive/make-public/${driveFileId}`);
      setUploadProgress(96);

      // Step 4: Upload thumbnail if provided (small file)
      const thumbFile = thumbInputRef.current?.files?.[0];
      let thumbnailUrl = `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w640`;
      let thumbnailDriveId = "";
      if (thumbFile) {
        const thumbInit = await api.post("/drive/init-upload", {
          fileName: `thumb_${Date.now()}_${thumbFile.name}`,
          mimeType: thumbFile.type || "image/jpeg",
          fileSize: thumbFile.size,
        });
        const thumbUploadUrl = thumbInit.data?.data?.uploadUrl;
        if (thumbUploadUrl) {
          const thumbResp = await fetch(thumbUploadUrl, {
            method: "PUT",
            headers: { "Content-Type": thumbFile.type || "image/jpeg" },
            body: thumbFile,
          });
          if (thumbResp.ok) {
            const thumbResult = await thumbResp.json();
            thumbnailDriveId = thumbResult.id;
            thumbnailUrl = `https://drive.google.com/thumbnail?id=${thumbResult.id}&sz=w640`;
            await api.post(`/drive/make-public/${thumbResult.id}`);
          }
        }
      }

      setUploadProgress(100);

      // Set form values
      form.setValue("drive_file_id", driveFileId);
      form.setValue("cloudinary_id", driveFileId);
      form.setValue("thumbnail_url", thumbnailUrl);
      form.setValue("thumbnail_drive_id", thumbnailDriveId);
      setUploadedEmbedUrl(`https://drive.google.com/file/d/${driveFileId}/preview`);
      toast({ title: "✅ Video subido a Google Drive" });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Error al subir video";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleThumbFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setThumbPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = (d: VideoFormData) => {
    if (editId) updateMutation.mutate(d);
    else createMutation.mutate(d);
  };

  const salesEnabled = form.watch("sales_enabled");
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">{editId ? "Editar video" : "Nuevo video"}</h1>
            <Button variant="outline" onClick={() => navigate("/admin/videos")}>Cancelar</Button>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            {/* ── UPLOAD ─────────────────────────────────────────────── */}
            <section className="space-y-4 rounded-xl border p-5">
              <h2 className="font-semibold flex items-center gap-2"><Video size={16} /> Archivo de video</h2>

              {/* Video file picker */}
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => videoInputRef.current?.click()}
              >
                {videoFileName ? (
                  <p className="text-sm font-medium flex items-center gap-2">
                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} className="text-green-500" />}
                    {videoFileName}
                  </p>
                ) : (
                  <>
                    <Upload size={28} className="text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Haz click para seleccionar el video</p>
                    <p className="text-xs text-muted-foreground">MP4, MOV, AVI — máx. 500 MB</p>
                  </>
                )}
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoFileChange}
                />
              </div>

              {/* Upload progress */}
              {isUploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subiendo a Google Drive…</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Preview embed once uploaded */}
              {uploadedEmbedUrl && !isUploading && (
                <div className="space-y-2">
                  <p className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={13} /> Video en Google Drive</p>
                  <iframe
                    src={uploadedEmbedUrl}
                    className="w-full rounded-lg border aspect-video"
                    allow="autoplay"
                    title="Preview"
                  />
                  <a href={uploadedEmbedUrl.replace("/preview", "/view")} target="_blank" rel="noreferrer"
                    className="text-xs text-primary flex items-center gap-1 hover:underline">
                    <ExternalLink size={12} /> Abrir en Drive
                  </a>
                </div>
              )}

              {/* Thumbnail */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Image size={14} /> Miniatura (opcional)</Label>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => thumbInputRef.current?.click()}>
                    Seleccionar imagen
                  </Button>
                  {thumbPreview && <img src={thumbPreview} className="h-16 rounded object-cover" alt="thumb" />}
                  <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbFileChange} />
                </div>
                <p className="text-xs text-muted-foreground">Si no subes miniatura se genera automáticamente desde el video en Drive.</p>
              </div>

              {/* Manual Drive ID fallback */}
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">ID de Google Drive (se rellena automáticamente)</Label>
                <Input {...form.register("drive_file_id")} placeholder="1AbCdEfGhIjKlMnOpQ…" className="font-mono text-xs" />
              </div>
            </section>

            {/* ── METADATA ───────────────────────────────────────────── */}
            <section className="space-y-4 rounded-xl border p-5">
              <h2 className="font-semibold">Metadatos</h2>
              <div className="space-y-1"><Label>Título *</Label><Input {...form.register("title")} /></div>
              <div className="space-y-1"><Label>Descripción</Label><Input {...form.register("description")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Subtítulo</Label><Input {...form.register("subtitle")} /></div>
                <div className="space-y-1"><Label>Tagline</Label><Input {...form.register("tagline")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Días de clase</Label><Input {...form.register("days")} placeholder="Lunes, Miércoles y Viernes" /></div>
                <div className="space-y-1"><Label>Duración (segundos)</Label><Input type="number" {...form.register("duration_seconds")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nivel</Label>
                  <Select value={form.watch("level")} onValueChange={(v) => form.setValue("level", v as VideoFormData["level"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["principiante", "intermedio", "avanzado", "todos"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Categoría</Label>
                  <Select value={form.watch("category_id") || ""} onValueChange={(v) => form.setValue("category_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {(Array.isArray(categoriesData?.data) ? categoriesData.data : []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Color de marca</Label><div className="flex gap-2"><Input type="color" {...form.register("brand_color")} className="h-10 w-14 cursor-pointer p-1" /><Input {...form.register("brand_color")} className="font-mono" /></div></div>
                <div className="space-y-1"><Label>Orden</Label><Input type="number" {...form.register("sort_order")} /></div>
              </div>
            </section>

            {/* ── ACCESS ─────────────────────────────────────────────── */}
            <section className="space-y-4 rounded-xl border p-5">
              <h2 className="font-semibold">Acceso y publicación</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo de acceso</Label>
                  <Select value={form.watch("access_type")} onValueChange={(v) => form.setValue("access_type", v as VideoFormData["access_type"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gratuito">Gratuito</SelectItem>
                      <SelectItem value="miembros">Solo miembros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-3">
                  <Switch checked={form.watch("is_published")} onCheckedChange={(v) => form.setValue("is_published", v)} />
                  <Label>Publicado</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.watch("is_featured")} onCheckedChange={(v) => form.setValue("is_featured", v)} />
                  <Label>Destacado</Label>
                </div>
              </div>
            </section>

            {/* ── SALES ──────────────────────────────────────────────── */}
            <section className="space-y-4 rounded-xl border p-5">
              <h2 className="font-semibold">Venta individual</h2>
              <div className="flex items-center gap-3">
                <Switch checked={salesEnabled} onCheckedChange={(v) => form.setValue("sales_enabled", v)} />
                <Label>Activar precio / venta</Label>
              </div>
              {salesEnabled && (
                <div className="space-y-4 pl-2 border-l-2 border-primary/30">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.watch("sales_unlocks_video")} onCheckedChange={(v) => form.setValue("sales_unlocks_video", v)} />
                    <Label>Bloquear video hasta que el pago sea aprobado</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Precio (MXN)</Label><Input type="number" {...form.register("sales_price_mxn")} /></div>
                    <div className="space-y-1"><Label>Créditos de clase</Label><Input type="number" {...form.register("sales_class_credits")} /></div>
                  </div>
                  <div className="space-y-1"><Label>Texto del botón CTA</Label><Input {...form.register("sales_cta_text")} placeholder="Comprar acceso" /></div>
                </div>
              )}
            </section>

            <div className="flex gap-3">
              <Button type="submit" disabled={isPending || isUploading} className="flex-1">
                {isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
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

