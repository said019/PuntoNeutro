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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { MoreHorizontal, Plus } from "lucide-react";

const codeSchema = z.object({
  code: z.string().min(1),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.coerce.number().min(0),
  minPurchaseAmount: z.coerce.number().optional(),
  maxUses: z.coerce.number().nullable(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().default(true),
});

type CodeFormData = z.infer<typeof codeSchema>;
interface DiscountCode extends CodeFormData { id: string; usesCount: number }

const DiscountCodes = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountCode | null>(null);

  const { data, isLoading } = useQuery<{ data: DiscountCode[] }>({
    queryKey: ["discount-codes"],
    queryFn: async () => (await api.get("/discount-codes")).data,
  });
  const codes = Array.isArray(data?.data) ? data.data : [];

  const form = useForm<CodeFormData>({ resolver: zodResolver(codeSchema), defaultValues: { discountType: "percentage", isActive: true, maxUses: null } });

  const createMutation = useMutation({
    mutationFn: (d: CodeFormData) => api.post("/discount-codes", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["discount-codes"] }); toast({ title: "Código creado" }); setOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: DiscountCode) => api.put(`/discount-codes/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["discount-codes"] }); toast({ title: "Código actualizado" }); setOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/discount-codes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["discount-codes"] }); toast({ title: "Código eliminado" }); },
  });

  const openEdit = (c: DiscountCode) => { form.reset(c); setEditing(c); setOpen(true); };
  const openCreate = () => { form.reset({ discountType: "percentage", isActive: true, maxUses: null }); setEditing(null); setOpen(true); };

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Códigos de Descuento</h1>
            <Button size="sm" onClick={openCreate}><Plus size={14} className="mr-1" />Nuevo código</Button>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descuento</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-bold">{c.code}</TableCell>
                    <TableCell>{c.discountType === "percentage" ? "%" : "MXN"}</TableCell>
                    <TableCell>{c.discountType === "percentage" ? `${c.discountValue}%` : `$${c.discountValue}`}</TableCell>
                    <TableCell>{c.usesCount}/{c.maxUses ?? "∞"}</TableCell>
                    <TableCell className="text-sm">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("es-MX") : "—"}</TableCell>
                    <TableCell><Badge variant={c.isActive ? "default" : "secondary"}>{c.isActive ? "Activo" : "Inactivo"}</Badge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => openEdit(c)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm("¿Eliminar este código de descuento?")) deleteMutation.mutate(c.id); }}>Eliminar</DropdownMenuItem>
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
            <DialogHeader><DialogTitle>{editing ? "Editar código" : "Nuevo código"}</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit((d) => editing ? updateMutation.mutate({ ...d, id: editing.id, usesCount: editing.usesCount }) : createMutation.mutate(d))} className="space-y-4">
              <div className="space-y-1"><Label>Código</Label><Input {...form.register("code")} className="uppercase font-mono" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select defaultValue="percentage" onValueChange={(v) => form.setValue("discountType", v as "percentage")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentaje</SelectItem>
                      <SelectItem value="fixed">Monto fijo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Valor</Label><Input type="number" {...form.register("discountValue")} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Compra mínima</Label><Input type="number" {...form.register("minPurchaseAmount")} /></div>
                <div className="space-y-1"><Label>Máx. usos (vacío=∞)</Label><Input type="number" {...form.register("maxUses")} /></div>
              </div>
              <div className="space-y-1"><Label>Fecha de expiración</Label><Input type="datetime-local" {...form.register("expiresAt")} /></div>
              <div className="flex items-center gap-3"><Switch checked={form.watch("isActive")} onCheckedChange={(v) => form.setValue("isActive", v)} /><Label>Activo</Label></div>
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

export default DiscountCodes;
