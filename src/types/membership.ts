export interface ClientMembership {
  id: string;
  plan_id: string;
  plan_name: string;
  status: "active" | "expired" | "pending_payment" | "pending_activation" | "cancelled";
  start_date: string;
  end_date: string;
  classes_remaining: number | null;
  class_limit: number | null;
  payment_method?: string;
}
