export function applySupabaseAdminAuthHeaders(headers: Headers, serviceRoleKey: string) {
  headers.set("apikey", serviceRoleKey);
  if (serviceRoleKey.startsWith("sb_secret_")) {
    headers.delete("Authorization");
  } else {
    headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  }
}
