export const KU_EMAIL_SUFFIX = '@ku.th'

// semantics ต้องตรงกับ CHECK ของ DB: lower(email) LIKE '%@ku.th'
export function isKuEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(KU_EMAIL_SUFFIX)
}
