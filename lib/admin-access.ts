export const ADMIN_EMAIL = "lyhenning@gmail.com";

export function isAdminEmail(email?: string | null) {
  return email?.toLowerCase() === ADMIN_EMAIL;
}

export function isSuperAdminEmail(email?: string | null) {
  return isAdminEmail(email);
}
