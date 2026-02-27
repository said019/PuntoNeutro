import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/use-debounce";

interface Video {
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
}

const VideoList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [editingCard, setEditingCard] = useState<number | null>(null);
  const [cardDraft, setCardDraft] = useState<Partial<HomepageCard>>({});

  const { data, isLoading } = useQuery<{ data: Video[]; total: number }>({
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
              <p className="text-sm text-muted-foreground">Edita el nombre, descripción e ícono de cada tarjeta en la sección «Mira cómo se vive» del inicio.</p>
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
                        <Button
                          size="sm" variant="outline" className="w-full text-xs gap-1"
                          onClick={() => startEdit(card)}
                        >
                          <Pencil size={11} />Editar
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
