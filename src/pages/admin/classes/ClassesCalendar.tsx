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
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Palette, Zap, MoreHorizontal, Loader2 } from "lucide-react";

/* ── Palette ── */
const PALETTE_COLORS = [
  { label: "Rosa", value: "#E15CB8" },
  { label: "Violeta", value: "#CA71E1" },
  { label: "Lima", value: "#E7EB6E" },
  { label: "Púrpura", value: "#8B5CF6" },
  { label: "Magenta", value: "#c026d3" },
  { label: "Azul", value: "#3B82F6" },
  { label: "Esmeralda", value: "#10B981" },
  { label: "Naranja", value: "#F97316" },
];

/* ── Types ── */
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

interface ClassType {
  id: string;
  name: string;
  color: string;
  defaultDuration?: number;
  durationMin?: number;
  maxCapacity?: number;
  capacity?: number;
  isActive?: boolean;
}

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const GENERATE_DAYS = [
  { label: "Lun", value: 1 },
  { label: "Mar", value: 2 },
  { label: "Mié", value: 3 },
  { label: "Jue", value: 4 },
  { label: "Vie", value: 5 },
  { label: "Sáb", value: 6 },
  { label: "Dom", value: 0 },
];

const TABS = [
  { key: "calendar", label: "Calendario", icon: CalendarDays },
  { key: "types", label: "Tipos de clase", icon: Palette },
  { key: "generate", label: "Generar semana", icon: Zap },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/* ── Schemas ── */
const classSchema = z.object({
  classTypeId: z.string().min(1),
  instructorId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  maxCapacity: z.coerce.number().min(1),
  notes: z.string().optional(),
});
type ClassFormData = z.infer<typeof classSchema>;

const typeSchema = z.object({
  name: z.string().min(1),
  color: z.string().default("#CA71E1"),
  defaultDuration: z.coerce.number().min(1),
  maxCapacity: z.coerce.number().min(1),
  isActive: z.boolean().default(true),
});
type TypeFormData = z.infer<typeof typeSchema>;

const generateSchema = z.object({
  classTypeId: z.string().min(1),
  instructorId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  daysOfWeek: z.array(z.number()).min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  maxCapacity: z.coerce.number().min(1),
});
type GenerateFormData = z.infer<typeof generateSchema>;

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
const ClassesCalendar = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("calendar");

  const { data: typesData } = useQuery<{ data: ClassType[] }>({
    queryKey: ["class-types"],
    queryFn: async () => (await api.get("/class-types")).data,
  });
  const types = Array.isArray(typesData?.data) ? typesData.data : [];

  const { data: instructorsData } = useQuery<{ data: { id: string; displayName: string }[] }>({
    queryKey: ["instructors"],
    queryFn: async () => (await api.get("/instructors")).data,
  });
  const instructors = Array.isArray(instructorsData?.data) ? instructorsData.data : [];

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h1 className="text-2xl font-bold">Clases</h1>
            <div className="flex gap-1 rounded-xl bg-secondary p-1">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all " +
                    (tab === key
                      ? "bg-gradient-to-r from-[#CA71E1] to-[#E15CB8] text-white shadow-md shadow-[#E15CB8]/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5")
                  }
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {tab === "calendar" && <CalendarTab types={types} instructors={instructors} toast={toast} qc={qc} />}
          {tab === "types" && <TypesTab types={types} toast={toast} qc={qc} />}
          {tab === "generate" && <GenerateTab types={types} instructors={instructors} toast={toast} />}
        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   TAB 1 – CALENDAR
   ═══════════════════════════════════════════════════════════════════ */
function CalendarTab({
  types,
  instructors,
  toast,
  qc,
}: {
  types: ClassType[];
  instructors: { id: string; displayName: string }[];
  toast: any;
  qc: any;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassInstance | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const start = format(weekStart, "yyyy-MM-dd");
  const end = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data } = useQuery<{ data: ClassInstance[] }>({
    queryKey: ["classes", start, end],
    queryFn: async () => (await api.get("/classes?start=" + start + "&end=" + end)).data,
  });
  const classes = Array.isArray(data?.data) ? data.data : [];

  const form = useForm<ClassFormData>({ resolver: zodResolver(classSchema) });

  const createMutation = useMutation({
    mutationFn: (d: ClassFormData) => api.post("/classes", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast({ title: "Clase creada" });
      setCreateOpen(false);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.put("/classes/" + id + "/cancel"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast({ title: "Clase cancelada" });
      setSheetOpen(false);
    },
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const classesForDay = (date: Date) =>
    classes.filter((c) => c.startTime?.startsWith(format(date, "yyyy-MM-dd")));

  const openCreate = (date: string) => {
    setSelectedDate(date);
    form.reset({ startTime: date + "T09:00", endTime: date + "T10:00", maxCapacity: 10 });
    setCreateOpen(true);
  };

  return (
    <>
      {/* Week nav */}
      <div className="flex items-center justify-center gap-3 mb-6">
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

      {/* Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const dayClasses = classesForDay(day);
          return (
            <div key={i} className="min-h-[300px]">
              <div
                className="text-center text-xs font-medium text-muted-foreground mb-2 cursor-pointer hover:text-foreground"
                onClick={() => openCreate(format(day, "yyyy-MM-dd"))}
              >
                <div>{DAYS_ES[day.getDay()]}</div>
                <div className="text-lg font-bold text-foreground">{format(day, "d")}</div>
              </div>
              <div className="space-y-1">
                {dayClasses.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => { setSelectedClass(c); setSheetOpen(true); }}
                    className="rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: c.classTypeColor ? c.classTypeColor + "33" : "hsl(var(--primary)/0.2)",
                      borderLeft: "3px solid " + (c.classTypeColor ?? "hsl(var(--primary))"),
                    }}
                  >
                    <div className="font-medium truncate">{c.classTypeName ?? "Clase"}</div>
                    <div className="text-muted-foreground">{c.startTime ? format(parseISO(c.startTime), "HH:mm") : ""}</div>
                    <div className="text-muted-foreground">{(c.bookedCount ?? 0) + "/" + c.maxCapacity}</div>
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
          );
        })}
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
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: t.color }} />
                        {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Instructor</Label>
              <Select onValueChange={(v) => form.setValue("instructorId", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar instructor" /></SelectTrigger>
                <SelectContent>
                  {instructors.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Inicio</Label><Input type="datetime-local" {...form.register("startTime")} /></div>
              <div className="space-y-1"><Label>Fin</Label><Input type="datetime-local" {...form.register("endTime")} /></div>
            </div>
            <div className="space-y-1"><Label>Capacidad máxima</Label><Input type="number" {...form.register("maxCapacity")} /></div>
            <div className="space-y-1"><Label>Notas</Label><Input {...form.register("notes")} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-[#CA71E1] to-[#E15CB8] text-white">Crear</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{selectedClass?.classTypeName ?? "Clase"}</SheetTitle></SheetHeader>
          {selectedClass && (
            <div className="mt-6 space-y-4 text-sm">
              <div><span className="font-medium">Instructor:</span> {selectedClass.instructorName ?? selectedClass.instructorId}</div>
              <div><span className="font-medium">Inicio:</span> {selectedClass.startTime ? new Date(selectedClass.startTime).toLocaleString("es-MX") : "—"}</div>
              <div><span className="font-medium">Cupo:</span> {(selectedClass.bookedCount ?? 0) + " / " + selectedClass.maxCapacity}</div>
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
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 2 – CLASS TYPES
   ═══════════════════════════════════════════════════════════════════ */
function TypesTab({ types, toast, qc }: { types: ClassType[]; toast: any; qc: any }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassType | null>(null);
  const form = useForm<TypeFormData>({
    resolver: zodResolver(typeSchema),
    defaultValues: { color: "#CA71E1", defaultDuration: 50, maxCapacity: 10, isActive: true },
  });

  const createMutation = useMutation({
    mutationFn: (d: TypeFormData) => api.post("/class-types", d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-types"] });
      toast({ title: "Tipo creado" });
      setOpen(false);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...d }: any) => api.put("/class-types/" + id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-types"] });
      toast({ title: "Tipo actualizado" });
      setOpen(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/class-types/" + id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-types"] });
      toast({ title: "Tipo eliminado" });
    },
  });

  const openEdit = (t: ClassType) => {
    form.reset({
      name: t.name,
      color: t.color,
      defaultDuration: t.defaultDuration ?? t.durationMin ?? 50,
      maxCapacity: t.maxCapacity ?? t.capacity ?? 10,
      isActive: t.isActive ?? true,
    });
    setEditing(t);
    setOpen(true);
  };
  const openCreate = () => {
    form.reset({ color: "#CA71E1", defaultDuration: 50, maxCapacity: 10, isActive: true });
    setEditing(null);
    setOpen(true);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{types.length} tipos registrados</p>
        <Button size="sm" onClick={openCreate} className="bg-gradient-to-r from-[#CA71E1] to-[#E15CB8] text-white">
          <Plus size={14} className="mr-1" />Nuevo tipo
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Color</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Duración</TableHead>
              <TableHead>Capacidad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((t) => (
              <TableRow key={t.id}>
                <TableCell><div className="w-6 h-6 rounded-full shadow-sm" style={{ backgroundColor: t.color }} /></TableCell>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{(t.defaultDuration ?? t.durationMin ?? "—") + " min"}</TableCell>
                <TableCell>{t.maxCapacity ?? t.capacity ?? "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant={t.isActive !== false ? "default" : "secondary"}
                    className={t.isActive !== false ? "bg-[#CA71E1]/20 text-[#CA71E1] border border-[#CA71E1]/30" : ""}
                  >
                    {t.isActive !== false ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal size={14} /></Button>
                    </DropdownMenuTrigger>
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

      {/* CRUD dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar tipo" : "Nuevo tipo de clase"}</DialogTitle></DialogHeader>
          <form
            onSubmit={form.handleSubmit((d) =>
              editing ? updateMutation.mutate({ ...d, id: editing.id }) : createMutation.mutate(d)
            )}
            className="space-y-4"
          >
            <div className="space-y-1"><Label>Nombre</Label><Input {...form.register("name")} /></div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PALETTE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => form.setValue("color", c.value)}
                    className={
                      "w-8 h-8 rounded-full border-2 transition-all " +
                      (form.watch("color") === c.value
                        ? "border-foreground scale-110 ring-2 ring-offset-2 ring-offset-background ring-[#CA71E1]"
                        : "border-transparent opacity-70 hover:opacity-100")
                    }
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
              <Input type="color" {...form.register("color")} className="h-8 w-16 cursor-pointer" />
            </div>
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
              <Button type="submit" className="bg-gradient-to-r from-[#CA71E1] to-[#E15CB8] text-white">
                {editing ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB 3 – GENERATE WEEK
   ═══════════════════════════════════════════════════════════════════ */
function GenerateTab({
  types,
  instructors,
  toast,
}: {
  types: ClassType[];
  instructors: { id: string; displayName: string }[];
  toast: any;
}) {
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const form = useForm<GenerateFormData>({
    resolver: zodResolver(generateSchema),
    defaultValues: { daysOfWeek: [], maxCapacity: 10, startTime: "09:00", endTime: "10:00" },
  });

  const generateMutation = useMutation({
    mutationFn: (d: GenerateFormData) => api.post("/classes/generate", d),
    onSuccess: (res: any) => toast({ title: (res.data?.created ?? "N") + " clases generadas" }),
    onError: () => toast({ title: "Error generando clases", variant: "destructive" }),
  });

  const toggleDay = (v: number) => {
    const updated = selectedDays.includes(v) ? selectedDays.filter((d) => d !== v) : [...selectedDays, v];
    setSelectedDays(updated);
    form.setValue("daysOfWeek", updated);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-1">Generar clases de la semana</h2>
        <p className="text-sm text-muted-foreground mb-6">Crea múltiples clases de un tipo en un rango de fechas.</p>

        <form onSubmit={form.handleSubmit((d) => generateMutation.mutate(d))} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Tipo de clase</Label>
              <Select onValueChange={(v) => form.setValue("classTypeId", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: t.color }} />
                        {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Instructor</Label>
              <Select onValueChange={(v) => form.setValue("instructorId", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {instructors.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1"><Label>Fecha inicio</Label><Input type="date" {...form.register("startDate")} /></div>
            <div className="space-y-1"><Label>Fecha fin</Label><Input type="date" {...form.register("endDate")} /></div>
            <div className="space-y-1"><Label>Hora inicio</Label><Input type="time" {...form.register("startTime")} /></div>
            <div className="space-y-1"><Label>Hora fin</Label><Input type="time" {...form.register("endTime")} /></div>
          </div>

          <div className="space-y-1">
            <Label>Capacidad máxima</Label>
            <Input type="number" {...form.register("maxCapacity")} className="max-w-[120px]" />
          </div>

          <div className="space-y-2">
            <Label>Días de la semana</Label>
            <div className="flex flex-wrap gap-2">
              {GENERATE_DAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all " +
                    (selectedDays.includes(d.value)
                      ? "bg-gradient-to-r from-[#CA71E1] to-[#E15CB8] text-white shadow-md"
                      : "bg-secondary text-muted-foreground hover:text-foreground")
                  }
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={generateMutation.isPending}
            className="w-full bg-gradient-to-r from-[#CA71E1] to-[#E15CB8] hover:from-[#CA71E1]/90 hover:to-[#E15CB8]/90 text-white font-medium"
          >
            {generateMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : <Zap size={14} className="mr-2" />}
            Generar clases
          </Button>
        </form>
      </div>
    </div>
  );
}

export default ClassesCalendar;
