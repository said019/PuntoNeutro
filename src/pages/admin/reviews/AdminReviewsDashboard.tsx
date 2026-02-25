import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MoreHorizontal, Plus, Star } from "lucide-react";

const tagSchema = z.object({ name: z.string().min(1), color: z.string().default("#8B5CF6") });
type TagFormData = z.infer<typeof tagSchema>;
interface ReviewTag extends TagFormData { id: string }

const ReviewTagsManager = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReviewTag | null>(null);

  const { data } = useQuery<{ data: ReviewTag[] }>({ queryKey: ["review-tags"], queryFn: async () => (await api.get("/review-tags")).data });
  const tags = Array.isArray(data?.data) ? data.data : [];

  const form = useForm<TagFormData>({ resolver: zodResolver(tagSchema), defaultValues: { color: "#8B5CF6" } });

  const createMutation = useMutation({ mutationFn: (d: TagFormData) => api.post("/review-tags", d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["review-tags"] }); toast({ title: "Tag creado" }); setOpen(false); } });
  const updateMutation = useMutation({ mutationFn: ({ id, ...d }: ReviewTag) => api.put(`/review-tags/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["review-tags"] }); toast({ title: "Tag actualizado" }); setOpen(false); } });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/review-tags/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["review-tags"] }); toast({ title: "Tag eliminado" }); } });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Tags de reseñas</h2>
        <Button size="sm" onClick={() => { form.reset({ color: "#8B5CF6" }); setEditing(null); setOpen(true); }}><Plus size={14} className="mr-1" />Nuevo tag</Button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {tags.map((t) => (
          <div key={t.id} className="flex items-center gap-1">
            <Badge style={{ backgroundColor: `${t.color}22`, color: t.color, borderColor: `${t.color}44` }} variant="outline">{t.name}</Badge>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-xs" onClick={() => { form.reset(t); setEditing(t); setOpen(true); }}>✎</Button>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive text-xs" onClick={() => deleteMutation.mutate(t.id)}>✕</Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>{editing ? "Editar tag" : "Nuevo tag"}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((d) => editing ? updateMutation.mutate({ ...d, id: editing.id }) : createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1"><Label>Nombre</Label><Input {...form.register("name")} /></div>
            <div className="space-y-1"><Label>Color</Label><Input type="color" {...form.register("color")} className="h-10 cursor-pointer" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">{editing ? "Actualizar" : "Crear"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AdminReviewsDashboard = () => {
  const { data: statsData } = useQuery({ queryKey: ["reviews-stats"], queryFn: async () => (await api.get("/reviews/stats")).data });
  const { data: reviewsData } = useQuery({ queryKey: ["reviews"], queryFn: async () => (await api.get("/reviews?limit=50")).data });

  const stats = statsData?.data ?? statsData ?? {};
  const reviews = Array.isArray(reviewsData?.data) ? reviewsData.data : [];

  const renderStars = (n: number) => Array(5).fill(0).map((_, i) => (
    <Star key={i} size={12} fill={i < n ? "currentColor" : "none"} className={i < n ? "text-yellow-400" : "text-muted-foreground"} />
  ));

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Reseñas</h1>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total reseñas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.totalReviews ?? 0}</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Promedio</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.averageRating ?? "—"} ⭐</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">5 estrellas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.fiveStarCount ?? 0}</p></CardContent></Card>
          </div>

          <Tabs defaultValue="list">
            <TabsList>
              <TabsTrigger value="list">Reseñas</TabsTrigger>
              <TabsTrigger value="tags">Tags</TabsTrigger>
            </TabsList>
            <TabsContent value="list" className="mt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Instructor</TableHead><TableHead>Rating</TableHead><TableHead>Comentario</TableHead><TableHead>Fecha</TableHead></TableRow></TableHeader>
                <TableBody>
                  {reviews.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.userName ?? r.userId}</TableCell>
                      <TableCell>{r.instructorName ?? r.instructorId ?? "—"}</TableCell>
                      <TableCell><div className="flex">{renderStars(r.rating)}</div></TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{r.comment ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-MX") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="tags" className="mt-4"><ReviewTagsManager /></TabsContent>
          </Tabs>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

export default AdminReviewsDashboard;
