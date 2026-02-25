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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { MoreHorizontal, Plus } from "lucide-react";

const typeSchema = z.object({
  name: z.string().min(1),
  color: z.string().default("#8B5CF6"),
  defaultDuration: z.coerce.number().min(1),
  maxCapacity: z.coerce.number().min(1),
  isActive: z.boolean().default(true),
});

type TypeFormData = z.infer<typeof typeSchema>;
interface ClassType extends TypeFormData { id: string }

const ClassTypesList = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassType | null>(null);

  const { data, isLoading } = useQuery<{ data: ClassType[] }>({
    queryKey: ["class-types"],
    queryFn: async () => (await api.get("/class-types")).data,
  });
  const types = Array.isArray(data?.data) ? data.data : [];

  const form = useForm<TypeFormData>({ resolver: zodResolver(typeSchema), defaultValues: { color: "#8B5CF6", defaultDuration: 60, maxCapacity: 20, isActive: true } });

  const createMutation = useMutation({
    mutationFn: (d: TypeFormData) => api.post("/class-types", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["class-types"] }); toast({ title: "Tipo creado" }); setOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: ClassType) => api.put(`/class-types/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["class-types"] }); toast({ title: "Tipo actualizado" }); setOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/class-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["class-types"] }); toast({ title: "Tipo eliminado" }); },
  });

  const openEdit = (t: ClassType) => { form.reset(t); setEditing(t); setOpen(true); };
  const openCreate = () => { form.reset({ color: "#8B5CF6", defaultDuration: 60, maxCapacity: 20, isActive: true }); setEditing(null); setOpen(true); };

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Tipos de Clase</h1>
            <Button size="sm" onClick={openCreate}><Plus size={14} className="mr-1" />Nuevo tipo</Button>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Capacidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell><div className="w-5 h-5 rounded-full" style={{ backgroundColor: t.color }} /></TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.defaultDuration} min</TableCell>
                    <TableCell>{t.maxCapacity}</TableCell>
                    <TableCell><Badge variant={t.isActive ? "default" : "secondary"}>{t.isActive ? "Activo" : "Inactivo"}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => openEdit(t)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(t.id)}>Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? "Editar tipo" : "Nuevo tipo de clase"}</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit((d) => editing ? updateMutation.mutate({ ...d, id: editing.id }) : createMutation.mutate(d))} className="space-y-4">
              <div className="space-y-1"><Label>Nombre</Label><Input {...form.register("name")} /></div>
              <div className="space-y-1"><Label>Color</Label><Input type="color" {...form.register("color")} className="h-10 cursor-pointer" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Duración (min)</Label><Input type="number" {...form.register("defaultDuration")} /></div>
                <div className="space-y-1"><Label>Capacidad máx.</Label><Input type="number" {...form.register("maxCapacity")} /></div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.watch("isActive")} onCheckedChange={(v) => form.setValue("isActive", v)} />
                <Label>Activo</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit">{editing ? "Actualizar" : "Crear"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </AuthGuard>
  );
};

export default ClassTypesList;
