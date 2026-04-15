import type { User } from "@supabase/supabase-js";

export function isAdmin(
  user: User | null,
  userRole: "ADMIN" | "USER" | null
): boolean {
  if (!user) return false;
  return userRole === "ADMIN";
}
