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

const scheduleSchema = z.object({
  dayOfWeek: z.coerce.number().min(0).max(6),
  classTypeId: z.string().min(1),
  instructorId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  maxCapacity: z.coerce.number().min(1),
  isActive: z.boolean().default(true),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;
interface Schedule extends ScheduleFormData { id: string; classTypeName?: string; instructorName?: string }

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const WeeklySchedule = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);

  const { data } = useQuery<{ data: Schedule[] }>({
    queryKey: ["schedules"],
    queryFn: async () => (await api.get("/schedules")).data,
  });
  const schedules = data?.data ?? [];

  const { data: typesData } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["class-types"],
    queryFn: async () => (await api.get("/class-types")).data,
  });

  const { data: instructorsData } = useQuery<{ data: { id: string; displayName: string }[] }>({
    queryKey: ["instructors"],
    queryFn: async () => (await api.get("/instructors")).data,
  });

  const form = useForm<ScheduleFormData>({ resolver: zodResolver(scheduleSchema), defaultValues: { maxCapacity: 20, isActive: true } });

  const createMutation = useMutation({
    mutationFn: (d: ScheduleFormData) => api.post("/schedules", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedules"] }); toast({ title: "Horario creado" }); setOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: Schedule) => api.put(`/schedules/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedules"] }); toast({ title: "Horario actualizado" }); setOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/schedules/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedules"] }); toast({ title: "Horario eliminado" }); },
  });

  const openEdit = (s: Schedule) => { form.reset(s); setEditing(s); setOpen(true); };
  const openCreate = () => { form.reset({ maxCapacity: 20, isActive: true }); setEditing(null); setOpen(true); };

  const grouped = DAYS.reduce((acc, _, i) => {
    acc[i] = schedules.filter((s) => s.dayOfWeek === i);
    return acc;
  }, {} as Record<number, Schedule[]>);

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Horarios Semanales</h1>
            <Button size="sm" onClick={openCreate}><Plus size={14} className="mr-1" />Nuevo horario</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {DAYS.map((day, i) => (
              <div key={i} className="bg-secondary rounded-xl p-3">
                <p className="text-xs font-bold text-center mb-3 text-muted-foreground uppercase">{day.slice(0, 3)}</p>
                {grouped[i].length === 0 ? (
                  <p className="text-center text-muted-foreground/40 text-xs">—</p>
                ) : grouped[i].map((s) => (
                  <div key={s.id} className="mb-2 p-2 bg-background rounded-lg border border-border text-xs">
                    <div className="font-medium">{s.classTypeName ?? s.classTypeId}</div>
                    <div className="text-muted-foreground">{s.startTime}–{s.endTime}</div>
                    <div className="text-muted-foreground">{s.instructorName ?? s.instructorId}</div>
                    <div className="flex items-center justify-between mt-1">
                      <Badge variant={s.isActive ? "default" : "secondary"} className="text-[0.6rem]">{s.isActive ? "Activo" : "Inactivo"}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5"><MoreHorizontal size={10} /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => openEdit(s)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(s.id)}>Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? "Editar horario" : "Nuevo horario"}</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit((d) => editing ? updateMutation.mutate({ ...d, id: editing.id }) : createMutation.mutate(d))} className="space-y-4">
              <div className="space-y-1">
                <Label>Día</Label>
                <Select onValueChange={(v) => form.setValue("dayOfWeek", Number(v))} defaultValue={String(form.getValues("dayOfWeek"))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar día" /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo de clase</Label>
                <Select onValueChange={(v) => form.setValue("classTypeId", v)}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    {(typesData?.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Instructor</Label>
                <Select onValueChange={(v) => form.setValue("instructorId", v)}>
                  <SelectTrigger><SelectValue placeholder="Instructor" /></SelectTrigger>
                  <SelectContent>
                    {(instructorsData?.data ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.displayName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Hora inicio</Label><Input type="time" {...form.register("startTime")} /></div>
                <div className="space-y-1"><Label>Hora fin</Label><Input type="time" {...form.register("endTime")} /></div>
              </div>
              <div className="space-y-1"><Label>Capacidad máx.</Label><Input type="number" {...form.register("maxCapacity")} /></div>
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

export default WeeklySchedule;
