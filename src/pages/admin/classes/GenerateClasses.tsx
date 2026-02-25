import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import { AuthGuard } from "@/components/admin/AuthGuard";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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

const DAYS = [
  { label: "Lunes", value: 1 }, { label: "Martes", value: 2 },
  { label: "Miércoles", value: 3 }, { label: "Jueves", value: 4 },
  { label: "Viernes", value: 5 }, { label: "Sábado", value: 6 },
  { label: "Domingo", value: 0 },
];

const GenerateClasses = () => {
  const { toast } = useToast();
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const { data: typesData } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["class-types"],
    queryFn: async () => (await api.get("/class-types")).data,
  });

  const { data: instructorsData } = useQuery<{ data: { id: string; displayName: string }[] }>({
    queryKey: ["instructors"],
    queryFn: async () => (await api.get("/instructors")).data,
  });

  const form = useForm<GenerateFormData>({
    resolver: zodResolver(generateSchema),
    defaultValues: { daysOfWeek: [], maxCapacity: 20, startTime: "09:00", endTime: "10:00" },
  });

  const generateMutation = useMutation({
    mutationFn: (d: GenerateFormData) => api.post("/classes/generate", d),
    onSuccess: (res: any) => toast({ title: `${res.data?.created ?? "N"} clases generadas` }),
    onError: () => toast({ title: "Error generando clases", variant: "destructive" }),
  });

  const toggleDay = (v: number) => {
    const updated = selectedDays.includes(v) ? selectedDays.filter((d) => d !== v) : [...selectedDays, v];
    setSelectedDays(updated);
    form.setValue("daysOfWeek", updated);
  };

  return (
    <AuthGuard>
      <AdminLayout>
        <div className="p-6 max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Generar Clases Masivas</h1>
          <form onSubmit={form.handleSubmit((d) => generateMutation.mutate(d))} className="space-y-5">
            <div className="space-y-1">
              <Label>Tipo de clase</Label>
              <Select onValueChange={(v) => form.setValue("classTypeId", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {(typesData?.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Instructor</Label>
              <Select onValueChange={(v) => form.setValue("instructorId", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar instructor" /></SelectTrigger>
                <SelectContent>
                  {(instructorsData?.data ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Fecha inicio</Label><Input type="date" {...form.register("startDate")} /></div>
              <div className="space-y-1"><Label>Fecha fin</Label><Input type="date" {...form.register("endDate")} /></div>
              <div className="space-y-1"><Label>Hora inicio</Label><Input type="time" {...form.register("startTime")} /></div>
              <div className="space-y-1"><Label>Hora fin</Label><Input type="time" {...form.register("endTime")} /></div>
            </div>
            <div className="space-y-1">
              <Label>Capacidad máxima</Label>
              <Input type="number" {...form.register("maxCapacity")} />
            </div>
            <div className="space-y-2">
              <Label>Días de la semana</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedDays.includes(d.value)
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={generateMutation.isPending} className="w-full">
              {generateMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
              Generar clases
            </Button>
          </form>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
};

export default GenerateClasses;
