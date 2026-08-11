export const DEV_ADMIN_USERNAME = "channg";

export function isAdminUsername(username: string): boolean {
  return username.toLowerCase() === DEV_ADMIN_USERNAME;
}
