import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_ROLES = ["admin", "instructor", "coach", "super_admin", "reception"];

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export const AuthGuard = ({ children, requiredRoles = ["admin"] }: AuthGuardProps) => {
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setOk(true);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!ok)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        Cargando...
      </div>
    );

  return <>{children}</>;
};
