import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfWeek, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

const classSchema = z.object({
  classTypeId: z.string().min(1),
  instructorId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  maxCapacity: z.coerce.number().min(1),
  notes: z.string().optional(),
});

type ClassFormData = z.infer<typeof classSchema>;

interface ClassInstance {
  id: string;
  classTypeId: string;
  classTypeName?: string;
  classTypeColor?: string;
  instructorId: string;
  instructorName?: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  bookedCount?: number;
  isCancelled: boolean;
  notes?: string;
}

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const ClassesCalendar = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<ClassInstance | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const start = format(weekStart, "yyyy-MM-dd");
  const end = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data } = useQuery<{ data: ClassInstance[] }>({
    queryKey: ["classes", start, end],
    queryFn: async () => (await api.get(`/classes?start=${start}&end=${end}`)).data,
  });
  const classes = data?.data ?? [];

  const { data: typesData } = useQuery<{ data: { id: string; name: string; color: string }[] }>({
    queryKey: ["class-types"],
    queryFn: async () => (await api.get("/class-types")).data,
  });

  const { data: instructorsData } = useQuery<{ data: { id: string; displayName: string }[] }>({
    queryKey: ["instructors"],
    queryFn: async () => (await api.get("/instructors")).data,
  });

  const form = useForm<ClassFormData>({ resolver: zodResolver(classSchema) });

  const createMutation = useMutation({
    mutationFn: (d: ClassFormData) => api.post("/classes", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes"] }); toast({ title: "Clase creada" }); setCreateOpen(false); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.put(`/classes/${id}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes"] }); toast({ title: "Clase cancelada" }); setSheetOpen(false); },
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const classesForDay = (date: Date) =>
    classes.filter((c) => c.startTime?.startsWith(format(date, "yyyy-MM-dd")));

  const openCreate = (date: string) => {
    setSelectedDate(date);
    form.reset({ startTime: `${date}T09:00`, endTime: `${date}T10:00`, maxCapacity: 20 });
    setCreateOpen(true);
  };

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Clases</h1>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-sm font-medium">
                {format(weekStart, "d MMM", { locale: es })} – {format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, i) => (
              <div key={i} className="min-h-[300px]">
                <div
                  className="text-center text-xs font-medium text-muted-foreground mb-2 cursor-pointer hover:text-foreground"
                  onClick={() => openCreate(format(day, "yyyy-MM-dd"))}
                >
                  <div>{DAYS_ES[day.getDay()]}</div>
                  <div className="text-lg font-bold text-foreground">{format(day, "d")}</div>
                </div>
                <div className="space-y-1">
                  {classesForDay(day).map((c) => (
                    <div
                      key={c.id}
                      onClick={() => { setSelectedClass(c); setSheetOpen(true); }}
                      className="rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: c.classTypeColor ? `${c.classTypeColor}33` : "hsl(var(--primary)/0.2)", borderLeft: `3px solid ${c.classTypeColor ?? "hsl(var(--primary))"}` }}
                    >
                      <div className="font-medium truncate">{c.classTypeName ?? "Clase"}</div>
                      <div className="text-muted-foreground">{c.startTime ? format(parseISO(c.startTime), "HH:mm") : ""}</div>
                      <div className="text-muted-foreground">{c.bookedCount ?? 0}/{c.maxCapacity}</div>
                      {c.isCancelled && <Badge variant="destructive" className="text-[0.6rem] px-1 mt-1">Cancelada</Badge>}
                    </div>
                  ))}
                  <button
                    onClick={() => openCreate(format(day, "yyyy-MM-dd"))}
                    className="w-full text-center text-muted-foreground/40 hover:text-muted-foreground text-lg py-1 transition-colors"
                  >
                    <Plus size={12} className="mx-auto" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nueva clase</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              <div className="space-y-1">
                <Label>Tipo de clase</Label>
                <Select onValueChange={(v) => form.setValue("classTypeId", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>
                    {(typesData?.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Instructor</Label>
                <Select onValueChange={(v) => form.setValue("instructorId", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar instructor" /></SelectTrigger>
                  <SelectContent>
                    {(instructorsData?.data ?? []).map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Inicio</Label>
                  <Input type="datetime-local" {...form.register("startTime")} />
                </div>
                <div className="space-y-1">
                  <Label>Fin</Label>
                  <Input type="datetime-local" {...form.register("endTime")} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Capacidad máxima</Label>
                <Input type="number" {...form.register("maxCapacity")} />
              </div>
              <div className="space-y-1">
                <Label>Notas</Label>
                <Input {...form.register("notes")} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>Crear</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Class detail sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{selectedClass?.classTypeName ?? "Clase"}</SheetTitle>
            </SheetHeader>
            {selectedClass && (
              <div className="mt-6 space-y-4 text-sm">
                <div><span className="font-medium">Instructor:</span> {selectedClass.instructorName ?? selectedClass.instructorId}</div>
                <div><span className="font-medium">Inicio:</span> {selectedClass.startTime ? new Date(selectedClass.startTime).toLocaleString("es-MX") : "—"}</div>
                <div><span className="font-medium">Cupo:</span> {selectedClass.bookedCount ?? 0} / {selectedClass.maxCapacity}</div>
                {selectedClass.notes && <div><span className="font-medium">Notas:</span> {selectedClass.notes}</div>}
                <div className="pt-4 flex flex-col gap-2">
                  {!selectedClass.isCancelled && (
                    <Button variant="destructive" onClick={() => cancelMutation.mutate(selectedClass.id)} disabled={cancelMutation.isPending}>
                      Cancelar clase
                    </Button>
                  )}
                  {selectedClass.isCancelled && <Badge variant="destructive">Clase cancelada</Badge>}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </AdminLayout>
    </AuthGuard>
  );
};

export default ClassesCalendar;
