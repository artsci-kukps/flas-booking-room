import { describe, expect, it } from "vitest";
import { KU_GOOGLE_DOMAIN, googleSignInOptions } from "./google-oauth";

describe("googleSignInOptions", () => {
  it("sends the KU Workspace domain hint", () => {
    const options = googleSignInOptions("https://booking.example");
    expect(options.queryParams.hd).toBe("ku.th");
  });

  it("exposes the KU domain constant", () => {
    expect(KU_GOOGLE_DOMAIN).toBe("ku.th");
  });

  it("redirects back to the auth callback on the given origin", () => {
    const options = googleSignInOptions("https://booking.example");
    expect(options.redirectTo).toBe("https://booking.example/auth/callback");
  });
});
