// ส่ง hint ให้ Google จำกัดบัญชีในโดเมน ku.th (ชั้นที่ 1 ของการป้องกัน)
export function googleSignInOptions(origin: string) {
  return {
    redirectTo: `${origin}/auth/callback`,
    queryParams: { prompt: "select_account" },
  };
}
