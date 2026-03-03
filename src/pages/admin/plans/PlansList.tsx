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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { MoreHorizontal, Plus } from "lucide-react";

const CATEGORIES = [
  { value: "jumping", label: "Jumping",       color: "bg-[#E15CB8]/20 text-[#E15CB8] border-[#E15CB8]/30" },
  { value: "pilates", label: "Pilates",        color: "bg-[#CA71E1]/20 text-[#CA71E1] border-[#CA71E1]/30" },
  { value: "mixto",   label: "Mixto",          color: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30" },
  { value: "all",     label: "Todas (sin filtro)", color: "bg-white/10 text-white/60 border-white/15" },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]["value"];

const planSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  currency: z.string().default("MXN"),
  durationDays: z.coerce.number().min(1),
  classLimit: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().nullable()),
  classCategory: z.enum(["jumping", "pilates", "mixto", "all"]).default("all"),
  features: z.string().optional(),
  isActive: z.boolean().default(true),
  isNonTransferable: z.boolean().default(false),
  isNonRepeatable: z.boolean().default(false),
  repeatKey: z.string().optional(),
  sortOrder: z.coerce.number().default(0),
});

type PlanFormData = z.infer<typeof planSchema>;

interface Plan extends PlanFormData {
  id: string;
}

const EMPTY: PlanFormData = {
  name: "", description: "", price: 0, currency: "MXN",
  durationDays: 30, classLimit: null, classCategory: "all",
  features: "", isActive: true, isNonTransferable: false, isNonRepeatable: false, repeatKey: "", sortOrder: 0,
};

function serializePlan(d: PlanFormData) {
  return {
    ...d,
    repeatKey: d.isNonRepeatable ? (d.repeatKey?.trim() || null) : null,
    features: d.features
      ? d.features.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
  };
}

function normalizePlan(p: Plan): PlanFormData {
  return {
    ...p,
    classCategory: ((p as any).classCategory ?? (p as any).class_category ?? "all") as CategoryValue,
    features: Array.isArray(p.features)
      ? (p.features as unknown as string[]).join(", ")
      : (p.features as unknown as string) ?? "",
    isNonTransferable: Boolean((p as any).isNonTransferable ?? (p as any).is_non_transferable),
    isNonRepeatable: Boolean((p as any).isNonRepeatable ?? (p as any).is_non_repeatable),
    repeatKey: String((p as any).repeatKey ?? (p as any).repeat_key ?? ""),
  };
}

const PlansList = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const { data, isLoading } = useQuery<{ data: Plan[] }>({
    queryKey: ["plans"],
    queryFn: async () => (await api.get("/plans")).data,
  });
  const plans = Array.isArray(data?.data) ? data.data : [];

  const form = useForm<PlanFormData>({ resolver: zodResolver(planSchema), defaultValues: EMPTY });

  const createMutation = useMutation({
    mutationFn: (d: PlanFormData) => api.post("/plans", serializePlan(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plans"] }); toast({ title: "Plan creado" }); closeDialog(); },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al crear", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: Plan) => api.put(`/plans/${id}`, serializePlan(d)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plans"] }); toast({ title: "Plan actualizado" }); closeDialog(); },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al actualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/plans/${id}`),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      const msg = res?.data?.message ?? "Plan eliminado";
      toast({ title: msg });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Error al eliminar", variant: "destructive" }),
  });

  const openCreate = () => { form.reset(EMPTY); setEditing(null); setOpen(true); };
  const openEdit = (p: Plan) => { form.reset(normalizePlan(p)); setEditing(p); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  const onSubmit = (d: PlanFormData) => {
    if (editing) updateMutation.mutate({ ...d, id: editing.id });
    else createMutation.mutate(d);
  };

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="admin-page max-w-5xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <h1 className="text-2xl font-bold">Planes</h1>
            <Button onClick={openCreate} size="sm"><Plus size={14} className="mr-1" />Nuevo plan</Button>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Límite clases</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Reglas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array(4).fill(0).map((_, i) => (
                    <TableRow key={i}>{Array(8).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
                  ))
                  : plans.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>${p.price} {p.currency}</TableCell>
                      <TableCell>{p.durationDays} días</TableCell>
                      <TableCell>{p.classLimit == null ? "Ilimitado" : p.classLimit === 0 ? "0" : p.classLimit}</TableCell>
                      <TableCell>
                        {(() => {
                          const cat = CATEGORIES.find((c) => c.value === (p.classCategory ?? "all")) ?? CATEGORIES[3];
                          return <Badge className={`border ${cat.color}`}>{cat.label}</Badge>;
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {Boolean((p as any).isNonTransferable ?? (p as any).is_non_transferable) && (
                            <Badge variant="outline">No transferible</Badge>
                          )}
                          {Boolean((p as any).isNonRepeatable ?? (p as any).is_non_repeatable) && (
                            <Badge variant="outline">No repetible</Badge>
                          )}
                          {!Boolean((p as any).isNonTransferable ?? (p as any).is_non_transferable) &&
                            !Boolean((p as any).isNonRepeatable ?? (p as any).is_non_repeatable) && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.isActive ? "default" : "secondary"}>
                          {p.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => openEdit(p)}>Editar</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => { if (window.confirm("¿Eliminar este plan?")) deleteMutation.mutate(p.id); }}>Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar plan" : "Nuevo plan"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label>Nombre</Label>
                <Input {...form.register("name")} />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Categoría de clases</Label>
                <Select
                  value={form.watch("classCategory") ?? "all"}
                  onValueChange={(v) => form.setValue("classCategory", v as CategoryValue)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Descripción</Label>
                <Input {...form.register("description")} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Precio (MXN)</Label>
                  <Input type="number" {...form.register("price")} />
                </div>
                <div className="space-y-1">
                  <Label>Duración (días)</Label>
                  <Input type="number" {...form.register("durationDays")} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Límite de clases (vacío = ilimitado)</Label>
                <Input type="number" placeholder="null = ilimitado" {...form.register("classLimit")} />
              </div>
              <div className="space-y-1">
                <Label>Beneficios (separados por coma)</Label>
                <Input {...form.register("features")} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <Switch
                    checked={form.watch("isNonTransferable")}
                    onCheckedChange={(v) => form.setValue("isNonTransferable", v)}
                  />
                  <Label>No transferible</Label>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <Switch
                    checked={form.watch("isNonRepeatable")}
                    onCheckedChange={(v) => form.setValue("isNonRepeatable", v)}
                  />
                  <Label>No repetible</Label>
                </div>
              </div>
              {form.watch("isNonRepeatable") && (
                <div className="space-y-1">
                  <Label>Clave de repetición (grupo)</Label>
                  <Input placeholder="ej. trial_single_session" {...form.register("repeatKey")} />
                </div>
              )}
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.watch("isActive")}
                  onCheckedChange={(v) => form.setValue("isActive", v)}
                />
                <Label>Activo</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editing ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </AuthGuard>
  );
};

export default PlansList;
