import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Check, X, Upload, Trash2, Loader2, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/use-debounce";

interface VideoItem {
  id: string;
  title: string;
  description?: string;
  access_type: "gratuito" | "miembros";
  is_published: boolean;
  thumbnail_url?: string;
  duration_seconds: number;
  sales_enabled: boolean;
  sales_price_mxn: number | null;
  level: string;
}

interface HomepageCard {
  id: number;
  sort_order: number;
  title: string;
  description: string;
  emoji: string;
  video_url?: string | null;
}

const VideoList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [editingCard, setEditingCard] = useState<number | null>(null);
  const [cardDraft, setCardDraft] = useState<Partial<HomepageCard>>({});
  const [uploadingCardId, setUploadingCardId] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const { data, isLoading } = useQuery<{ data: VideoItem[]; total: number }>({
    queryKey: ["videos", debouncedSearch],
    queryFn: async () => (await api.get(`/videos?search=${debouncedSearch}&limit=20`)).data,
  });
  const videos = Array.isArray(data?.data) ? data.data : [];

  const { data: cardsData, isLoading: cardsLoading } = useQuery<{ data: HomepageCard[] }>({
    queryKey: ["homepage-video-cards"],
    queryFn: async () => (await api.get("/homepage-video-cards")).data,
  });
  const cards: HomepageCard[] = cardsData?.data ?? [];

  const { toast } = useToast();
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/videos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["videos"] }); toast({ title: "Video eliminado" }); },
  });

  const updateCardMutation = useMutation({
    mutationFn: ({ id, ...body }: Partial<HomepageCard> & { id: number }) =>
      api.put(`/homepage-video-cards/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["homepage-video-cards"] });
      toast({ title: "Tarjeta actualizada" });
      setEditingCard(null);
      setCardDraft({});
    },
    onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
  });

  // Upload video file for a homepage card (max 50 MB)
  const handleCardVideoUpload = async (cardId: number, file: File) => {
    const MAX_MB = 50;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({ title: `El archivo es demasiado grande. Máximo ${MAX_MB} MB.`, variant: "destructive" });
      return;
    }
    setUploadingCardId(cardId);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("video", file);

      const token = localStorage.getItem("token");
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/homepage-video-cards/${cardId}/upload`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            qc.invalidateQueries({ queryKey: ["homepage-video-cards"] });
            toast({ title: "✅ Video subido correctamente" });
            resolve();
          } else {
            let msg = "Error al subir video";
            try { msg = JSON.parse(xhr.responseText || "{}").message || msg; } catch {}
            toast({ title: msg, variant: "destructive" });
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => { toast({ title: "Error de conexión. El archivo puede ser demasiado grande.", variant: "destructive" }); reject(new Error("Network error")); };
        xhr.send(formData);
      });
    } catch {
      // error already toasted
    } finally {
      setUploadingCardId(null);
      setUploadProgress(0);
    }
  };

  // Delete video from a homepage card
  const deleteCardVideoMutation = useMutation({
    mutationFn: (cardId: number) => api.delete(`/homepage-video-cards/${cardId}/video`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["homepage-video-cards"] });
      toast({ title: "Video eliminado de la tarjeta" });
    },
    onError: () => toast({ title: "Error al eliminar video", variant: "destructive" }),
  });

  const startEdit = (card: HomepageCard) => {
    setEditingCard(card.id);
    setCardDraft({ title: card.title, description: card.description, emoji: card.emoji });
  };

  const cancelEdit = () => { setEditingCard(null); setCardDraft({}); };

  const saveCard = (id: number) => {
    if (!cardDraft.title?.trim() || !cardDraft.description?.trim()) return;
    updateCardMutation.mutate({ id, ...cardDraft });
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto space-y-10">

          {/* ── Tarjetas del inicio ── */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-bold">Tarjetas de inicio</h2>
              <p className="text-sm text-muted-foreground">Edita el nombre, descripción y sube un video para cada tarjeta en la sección «Mira cómo se vive» del inicio.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {cardsLoading
                ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)
                : cards.map((card) => (
                  <div key={card.id} className="rounded-xl border border-border bg-secondary p-4 space-y-3">
                    {editingCard === card.id ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Input
                            value={cardDraft.emoji ?? ""}
                            onChange={(e) => setCardDraft((p) => ({ ...p, emoji: e.target.value }))}
                            className="w-16 text-center text-lg"
                            maxLength={4}
                            placeholder="🎬"
                          />
                          <Input
                            value={cardDraft.title ?? ""}
                            onChange={(e) => setCardDraft((p) => ({ ...p, title: e.target.value }))}
                            placeholder="Nombre de la clase"
                            className="flex-1"
                          />
                        </div>
                        <Textarea
                          value={cardDraft.description ?? ""}
                          onChange={(e) => setCardDraft((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Descripción breve"
                          rows={3}
                          className="text-sm resize-none"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm" className="flex-1 text-xs gap-1"
                            onClick={() => saveCard(card.id)}
                            disabled={updateCardMutation.isPending}
                          >
                            <Check size={12} />Guardar
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={cancelEdit}>
                            <X size={12} />Cancelar
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{card.emoji}</span>
                          <p className="font-semibold text-sm">{card.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>

                        {/* Video status */}
                        {card.video_url ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="text-[0.6rem] bg-green-600">
                                <Video size={10} className="mr-1" />Video cargado
                              </Badge>
                            </div>
                            <div className="rounded-lg overflow-hidden border border-border aspect-video bg-black">
                              <iframe
                                src={card.video_url}
                                className="w-full h-full"
                                allow="autoplay"
                                allowFullScreen
                              />
                            </div>
                            <Button
                              size="sm" variant="destructive" className="w-full text-xs gap-1"
                              onClick={() => deleteCardVideoMutation.mutate(card.id)}
                              disabled={deleteCardVideoMutation.isPending}
                            >
                              <Trash2 size={11} />Eliminar video
                            </Button>
                          </div>
                        ) : uploadingCardId === card.id ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 size={14} className="animate-spin" />
                              Subiendo video... {uploadProgress}%
                            </div>
                            <Progress value={uploadProgress} className="h-2" />
                          </div>
                        ) : (
                          <div>
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              ref={(el) => { fileInputRefs.current[card.id] = el; }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleCardVideoUpload(card.id, file);
                                e.target.value = "";
                              }}
                            />
                            <Button
                              size="sm" variant="outline" className="w-full text-xs gap-1 border-dashed"
                              onClick={() => fileInputRefs.current[card.id]?.click()}
                            >
                              <Upload size={11} />Subir video
                            </Button>
                            <p className="text-[0.6rem] text-muted-foreground mt-1 text-center">MP4, MOV — máx 50 MB</p>
                          </div>
                        )}

                        <Button
                          size="sm" variant="outline" className="w-full text-xs gap-1"
                          onClick={() => startEdit(card)}
                        >
                          <Pencil size={11} />Editar texto
                        </Button>
                      </>
                    )}
                  </div>
                ))}
            </div>
          </section>

          {/* ── Videos ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Videos</h2>
              <Button size="sm" onClick={() => navigate("/admin/videos/upload")}>
                <Plus size={14} className="mr-1" />Nuevo video
              </Button>
            </div>

            <div className="relative mb-4 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar videos..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {isLoading
                ? Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)
                : videos.map((v) => (
                  <div key={v.id} className="rounded-xl border border-border overflow-hidden bg-secondary hover:bg-muted transition-colors">
                    {v.thumbnail_url
                      ? <img src={v.thumbnail_url} alt={v.title} className="w-full h-28 object-cover" />
                      : <div className="w-full h-28 bg-muted flex items-center justify-center text-muted-foreground text-xs">Sin miniatura</div>
                    }
                    <div className="p-3">
                      <p className="font-medium text-sm truncate">{v.title}</p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <Badge variant={v.access_type === "gratuito" ? "default" : "secondary"} className="text-[0.6rem]">{v.access_type}</Badge>
                        {!v.is_published && <Badge variant="outline" className="text-[0.6rem]">Borrador</Badge>}
                        {v.sales_enabled && v.sales_price_mxn && (
                          <Badge variant="outline" className="text-[0.6rem]">${v.sales_price_mxn}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{formatDuration(v.duration_seconds ?? 0)}</p>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => navigate(`/admin/videos/upload?id=${v.id}`)}>Editar</Button>
                        <Button size="sm" variant="destructive" className="text-xs" onClick={() => deleteMutation.mutate(v.id)}>Eliminar</Button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </section>

        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

export default VideoList;
