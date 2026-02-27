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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TimePicker } from "@/components/ui/time-picker";
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
  const schedules = Array.isArray(data?.data) ? data.data : [];

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
          <div className="flex items-center justify-between mb-7">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Horarios Semanales</h1>
              <p className="text-sm text-white/35">Horario base que se repite cada semana</p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#E15CB8] to-[#CA71E1] hover:opacity-90 transition-opacity"
            >
              <Plus size={14} /> Nuevo horario
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
            {DAYS.map((day, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                <p className="text-[10px] font-bold text-center mb-3 text-[#CA71E1]/60 uppercase tracking-widest">
                  {day.slice(0, 3)}
                </p>
                {grouped[i].length === 0 ? (
                  <p className="text-center text-white/15 text-xs py-3">—</p>
                ) : grouped[i].map((s) => (
                  <div key={s.id} className="mb-2 p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.05] text-xs">
                    <div className="font-semibold text-white/80 text-[11px] truncate">{s.classTypeName ?? s.classTypeId}</div>
                    <div className="text-[#E7EB6E]/70 text-[10px] mt-0.5">{s.startTime}–{s.endTime}</div>
                    <div className="text-white/35 text-[10px] truncate">{s.instructorName ?? s.instructorId}</div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${s.isActive ? "text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/5" : "text-white/25 border-white/10"}`}>
                        {s.isActive ? "Activo" : "Inactivo"}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-white/20 hover:text-white/60">
                            <MoreHorizontal size={10} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#0f0518] border-white/10">
                          <DropdownMenuItem className="text-white/70 hover:text-white" onClick={() => openEdit(s)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-[#f87171]" onClick={() => deleteMutation.mutate(s.id)}>Eliminar</DropdownMenuItem>
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
          <DialogContent className="max-w-md bg-[#0f0518] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">{editing ? "Editar horario" : "Nuevo horario"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit((d) =>
                editing ? updateMutation.mutate({ ...d, id: editing.id }) : createMutation.mutate(d)
              )}
              className="space-y-4"
            >
              <div className="space-y-1">
                <Label className="text-white/60 text-xs">Día</Label>
                <Select
                  onValueChange={(v) => form.setValue("dayOfWeek", Number(v))}
                  defaultValue={String(form.getValues("dayOfWeek"))}
                >
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                    <SelectValue placeholder="Seleccionar día" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0518] border-white/10">
                    {DAYS.map((d, i) => (
                      <SelectItem key={i} value={String(i)} className="text-white">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-white/60 text-xs">Tipo de clase</Label>
                <Select onValueChange={(v) => form.setValue("classTypeId", v)}>
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0518] border-white/10">
                    {(Array.isArray(typesData?.data) ? typesData.data : []).map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-white">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-white/60 text-xs">Instructor</Label>
                <Select onValueChange={(v) => form.setValue("instructorId", v)}>
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                    <SelectValue placeholder="Instructor" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f0518] border-white/10">
                    {(Array.isArray(instructorsData?.data) ? instructorsData.data : []).map((i) => (
                      <SelectItem key={i.id} value={i.id} className="text-white">{i.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-white/60 text-xs">Hora inicio</Label>
                  <TimePicker
                    value={form.watch("startTime")}
                    onChange={(v) => form.setValue("startTime", v)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-white/60 text-xs">Hora fin</Label>
                  <TimePicker
                    value={form.watch("endTime")}
                    onChange={(v) => form.setValue("endTime", v)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-white/60 text-xs">Capacidad máx.</Label>
                <Input
                  type="number"
                  className="bg-white/[0.04] border-white/[0.08] text-white"
                  {...form.register("maxCapacity")}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.watch("isActive")} onCheckedChange={(v) => form.setValue("isActive", v)} />
                <Label className="text-white/60 text-xs">Activo</Label>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 text-white/60 hover:bg-white/5"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-[#E15CB8] to-[#CA71E1] text-white border-0"
                >
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

export default WeeklySchedule;
