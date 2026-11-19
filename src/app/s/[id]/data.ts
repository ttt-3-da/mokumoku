import { cache } from "react";
import { parseSharedSession } from "@/lib/share";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** シェアされた記録（シェアしていない・止めたものは null）。ログインしていなくても読める */
export const getSharedSession = cache(async (id: string) => {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await (await createClient()).rpc("get_shared_session", { p_session_id: id });
  if (error) return null;
  return parseSharedSession(data);
});
