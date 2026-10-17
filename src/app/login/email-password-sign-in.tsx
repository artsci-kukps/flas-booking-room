"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import Alert from "@/components/alert";
import {
  emailProblem,
  formatCountdown,
  normaliseEmail,
  OTP_LENGTH,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  PASSWORD_MIN_LENGTH,
  passwordProblem,
  type AuthAlert,
  type AuthField,
} from "@/lib/auth/email-password";
import {
  requestOTPforRegister,
  signInWithEmailAndPassword,
  signUpWithEmailAndPassword,
} from "../auth/action";
import GoogleSignInButton from "./google-sign-in-button";

type Tab = "signin" | "signup";
type SignUpStep = "credentials" | "otp";
type Direction = "forward" | "back";

const EMPTY_DIGITS = Array.from({ length: OTP_LENGTH }, () => "");

/** ไอคอนตา (แสดง/ซ่อนรหัสผ่าน) — เขียนเอง น้ำหนักเส้น 1.8 ตามระบบ */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {open ? (
        <>
          <path d="M4 4l16 16" />
          <path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8" />
          <path d="M6.3 7.9A17 17 0 0 0 2.5 12S6 18.5 12 18.5c1.4 0 2.7-.3 3.8-.8" />
          <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
        </>
      ) : (
        <>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

/** ปุ่มสลับการมองเห็นรหัสผ่าน — อยู่ในช่องกรอก ไม่ใช่ปุ่มส่ง */
function PasswordToggle({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={shown}
      aria-label={shown ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
      className="icon-btn absolute right-1.5 top-1/2 -translate-y-1/2"
    >
      <EyeIcon open={shown} />
    </button>
  );
}

/** ป้ายกำกับช่องกรอก — 12px/600 ตามสเกล label ของ DESIGN.md */
function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: string;
}) {
  return (
    <label htmlFor={htmlFor} className="field-label">
      {children}
    </label>
  );
}

export default function EmailPasswordSignInUp() {
  const [tab, setTab] = useState<Tab>("signin");
  const [step, setStep] = useState<SignUpStep>("credentials");
  const [direction, setDirection] = useState<Direction>("forward");

  // --- เข้าสู่ระบบ ---
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInShowPassword, setSignInShowPassword] = useState(false);
  const [signInPending, setSignInPending] = useState(false);
  const [signInAlert, setSignInAlert] = useState<AuthAlert | null>(null);

  // --- สมัครสมาชิก ---
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpShowPassword, setSignUpShowPassword] = useState(false);
  const [signUpPending, setSignUpPending] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [signUpAlert, setSignUpAlert] = useState<AuthAlert | null>(null);
  const [digits, setDigits] = useState<string[]>(EMPTY_DIGITS);
  const [resendIn, setResendIn] = useState(0);

  const signInEmailRef = useRef<HTMLInputElement>(null);
  const signInPasswordRef = useRef<HTMLInputElement>(null);
  const signUpEmailRef = useRef<HTMLInputElement>(null);
  const signUpPasswordRef = useRef<HTMLInputElement>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  /** Alert ที่ระบุช่องผิด ให้พาผู้ใช้กลับไปแก้ช่องนั้น */
  function focusField(field: AuthField | undefined, target: Tab) {
    if (!field) {
      return;
    }

    if (target === "signin") {
      if (field === "email") signInEmailRef.current?.focus();
      if (field === "password") signInPasswordRef.current?.focus();
      return;
    }

    if (field === "email") signUpEmailRef.current?.focus();
    if (field === "password") signUpPasswordRef.current?.focus();
    if (field === "otp") otpRefs.current[0]?.focus();
  }

  // นับถอยหลังก่อนกดขอรหัสซ้ำได้ (ตั้งต้น 60 วินาที = OTP_RESEND_COOLDOWN_SECONDS)
  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }

    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // เข้าเฟส OTP แล้วให้โฟกัสช่องแรกทันที
  useEffect(() => {
    if (tab === "signup" && step === "otp") {
      otpRefs.current[0]?.focus();
    }
  }, [tab, step]);

  // Alert ที่ระบุช่องผิด ให้พาผู้ใช้กลับไปแก้ช่องนั้น
  useEffect(() => {
    focusField(signInAlert?.field, "signin");
  }, [signInAlert]);

  useEffect(() => {
    focusField(signUpAlert?.field, "signup");
  }, [signUpAlert]);

  function selectTab(next: Tab) {
    if (next === tab) {
      return;
    }

    setDirection(next === "signup" ? "forward" : "back");
    setTab(next);
  }

  function handleTabKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    selectTab(tab === "signin" ? "signup" : "signin");
  }

  /** เข้าสู่ระบบด้วยอีเมล–รหัสผ่าน (ตรวจฝั่ง client ให้ตรงกับ server action) */
  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = normaliseEmail(signInEmail);
    const emailIssue = emailProblem(email);
    if (emailIssue) {
      setSignInAlert({
        heading: "เข้าสู่ระบบไม่ได้",
        body: emailIssue,
        field: "email",
      });
      return;
    }

    if (!signInPassword) {
      setSignInAlert({
        heading: "เข้าสู่ระบบไม่ได้",
        body: "กรุณากรอกรหัสผ่าน",
        field: "password",
      });
      return;
    }

    setSignInAlert(null);
    setSignInPending(true);

    try {
      const result = await signInWithEmailAndPassword({
        email,
        password: signInPassword,
      });
      // สำเร็จ = server action redirect ไปแล้ว จึงมาถึงบรรทัดนี้เฉพาะกรณีผิดพลาด
      if (!result.ok) {
        setSignInAlert(result.error);
      }
    } catch (error) {
      if ((error as Error).message === "NEXT_REDIRECT") return;
      setSignInAlert({
        heading: "เข้าสู่ระบบไม่สำเร็จ",
        body: "เกิดข้อผิดพลาดระหว่างเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setSignInPending(false);
    }
  }

  /** เฟส 1: ตรวจอีเมล+รหัสผ่าน แล้วขอรหัส OTP */
  async function handleRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = normaliseEmail(signUpEmail);
    const emailIssue = emailProblem(email);
    if (emailIssue) {
      setSignUpAlert({
        heading: "สมัครสมาชิกไม่ได้",
        body: emailIssue,
        field: "email",
      });
      return;
    }

    const passwordIssue = passwordProblem(signUpPassword);
    if (passwordIssue) {
      setSignUpAlert({
        heading: "สมัครสมาชิกไม่ได้",
        body: passwordIssue,
        field: "password",
      });
      return;
    }

    setSignUpAlert(null);
    setRequestingOtp(true);

    try {
      const result = await requestOTPforRegister(email);

      if (!result.ok) {
        setSignUpAlert(result.error);
        return;
      }

      setDirection("forward");
      setStep("otp");
      setDigits(EMPTY_DIGITS);
      setResendIn(OTP_RESEND_COOLDOWN_SECONDS);
    } catch {
      setSignUpAlert({
        heading: "ส่งรหัสไม่สำเร็จ",
        body: "เกิดข้อผิดพลาดระหว่างส่งรหัส กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setRequestingOtp(false);
    }
  }

  /** เฟส 2: ยืนยันรหัส OTP แล้วสมัครสมาชิก (สำเร็จ = server action พาเข้าสู่ระบบให้เลย) */
  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const otp = digits.join("");
    if (otp.length !== OTP_LENGTH) {
      setSignUpAlert({
        heading: "รหัสไม่ครบ",
        body: `กรุณากรอกรหัสยืนยันให้ครบ ${OTP_LENGTH} หลัก`,
        field: "otp",
      });
      return;
    }

    setSignUpAlert(null);
    setSignUpPending(true);

    try {
      const result = await signUpWithEmailAndPassword({
        email: normaliseEmail(signUpEmail),
        password: signUpPassword,
        otp,
      });

      if (!result.ok) {
        setSignUpAlert(result.error);
        if (result.error.field === "otp") {
          setDigits(EMPTY_DIGITS);
          otpRefs.current[0]?.focus();
        }
      }
    } catch (error) {
      if ((error as Error).message === "NEXT_REDIRECT") return;
      setSignUpAlert({
        heading: "สมัครสมาชิกไม่สำเร็จ",
        body: "เกิดข้อผิดพลาดระหว่างสมัครสมาชิก กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setSignUpPending(false);
    }
  }

  async function handleResendOtp() {
    if (resendIn > 0 || requestingOtp) {
      return;
    }

    setSignUpAlert(null);
    setRequestingOtp(true);

    try {
      const result = await requestOTPforRegister(normaliseEmail(signUpEmail));

      if (!result.ok) {
        setSignUpAlert(result.error);
        return;
      }

      setDigits(EMPTY_DIGITS);
      setResendIn(OTP_RESEND_COOLDOWN_SECONDS);
      setSignUpAlert({
        heading: "ส่งรหัสใหม่แล้ว",
        body: `รหัสชุดใหม่ใช้ได้ ${OTP_TTL_SECONDS / 60} นาที กรุณาตรวจอีเมลอีกครั้ง`,
        tone: "success",
      });
    } catch {
      setSignUpAlert({
        heading: "ส่งรหัสไม่สำเร็จ",
        body: "เกิดข้อผิดพลาดระหว่างส่งรหัส กรุณาลองใหม่อีกครั้ง",
      });
    } finally {
      setRequestingOtp(false);
    }
  }

  function backToCredentials() {
    setDirection("back");
    setStep("credentials");
    setSignUpAlert(null);
    setDigits(EMPTY_DIGITS);
  }

  /** กรอกรหัส OTP ทีละช่อง — รองรับการวางหลายหลักพร้อมกัน */
  function handleDigitChange(index: number, raw: string) {
    const numeric = raw.replace(/\D/g, "");

    if (!numeric) {
      setDigits((previous) => {
        const next = [...previous];
        next[index] = "";
        return next;
      });
      return;
    }

    const chars = numeric.slice(0, OTP_LENGTH - index).split("");

    setDigits((previous) => {
      const next = [...previous];
      chars.forEach((char, offset) => {
        next[index + offset] = char;
      });
      return next;
    });

    const nextIndex = Math.min(index + chars.length, OTP_LENGTH - 1);
    otpRefs.current[nextIndex]?.focus();
  }

  function handleDigitKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      setDigits((previous) => {
        const next = [...previous];
        next[index - 1] = "";
        return next;
      });
      otpRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      otpRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitPaste(index: number, text: string) {
    handleDigitChange(index, text);
  }

  const view = tab === "signin" ? "signin" : `signup-${step}`;
  const animation = direction === "forward" ? "step-forward" : "step-back";

  return (
    <div>
      {/* ---------- แท็บ: เข้าสู่ระบบ / สมัครสมาชิก ---------- */}
      <div
        role="tablist"
        aria-label="เข้าสู่ระบบหรือสมัครสมาชิก"
        className="flex gap-1 rounded-[14px] border border-border bg-canvas p-1"
      >
        {(
          [
            { id: "signin", label: "เข้าสู่ระบบ" },
            { id: "signup", label: "สมัครสมาชิก" },
          ] as const
        ).map((item) => {
          const active = tab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={active}
              aria-controls={`panel-${item.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => selectTab(item.id)}
              onKeyDown={handleTabKeys}
              className={`flex-1 rounded-[12px] px-3 py-2 text-sm font-semibold transition-colors ${
                active ? "bg-ku-soft text-ku" : "text-ink-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ---------- เนื้อหาแต่ละแท็บ (เลื่อนเข้าเวลาเปลี่ยนแท็บ/เฟส) ---------- */}
      <div
        key={view}
        id={tab === "signin" ? "panel-signin" : "panel-signup"}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className={`mt-6 ${animation}`}
      >
        {tab === "signin" ? (
          <div>
            <h2 className="text-[1.75rem] font-bold tracking-[-0.03em] text-ink sm:text-[2rem]">
              เข้าสู่ระบบ
            </h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
              ใช้บัญชีอีเมลมหาวิทยาลัย (@ku.th)
              เพื่อจองห้องและติดตามการจองของคุณ
            </p>

            <div className="mt-6">
              <GoogleSignInButton />
            </div>

            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-ink-muted">
                หรือใช้อีเมลมหาวิทยาลัย
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            {signInAlert ? (
              <Alert
                heading={signInAlert.heading}
                body={signInAlert.body}
                className="mb-5"
              />
            ) : null}

            <form onSubmit={handleSignIn} className="space-y-4" noValidate>
              <div>
                <FieldLabel htmlFor="signin-email">อีเมลมหาวิทยาลัย</FieldLabel>
                <input
                  ref={signInEmailRef}
                  id="signin-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="name@ku.th"
                  className="field"
                  value={signInEmail}
                  onChange={(event) => setSignInEmail(event.target.value)}
                  aria-invalid={signInAlert?.field === "email"}
                  disabled={signInPending}
                  required
                />
              </div>

              <div>
                <FieldLabel htmlFor="signin-password">รหัสผ่าน</FieldLabel>
                <div className="relative">
                  <input
                    ref={signInPasswordRef}
                    id="signin-password"
                    name="password"
                    type={signInShowPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="รหัสผ่านของคุณ"
                    className="field pr-12"
                    value={signInPassword}
                    onChange={(event) => setSignInPassword(event.target.value)}
                    aria-invalid={signInAlert?.field === "password"}
                    disabled={signInPending}
                    required
                  />
                  <PasswordToggle
                    shown={signInShowPassword}
                    onToggle={() => setSignInShowPassword((value) => !value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={signInPending}
                aria-busy={signInPending}
                className="btn btn-primary btn-lg w-full"
              >
                {signInPending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
              </button>
            </form>
          </div>
        ) : step === "credentials" ? (
          <div>
            <h2 className="text-[1.75rem] font-bold tracking-[-0.03em] text-ink sm:text-[2rem]">
              สมัครสมาชิก
            </h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
              ตั้งอีเมลและรหัสผ่านก่อน ระบบจะส่งรหัสยืนยัน{" "}
              <span className="font-semibold tabular-nums text-ink">
                {OTP_LENGTH} หลัก
              </span>{" "}
              ไปทางอีเมลมหาวิทยาลัยของคุณ
            </p>

            {signUpAlert ? (
              <Alert
                tone={signUpAlert.tone ?? "danger"}
                heading={signUpAlert.heading}
                body={signUpAlert.body}
                className="mt-5"
              />
            ) : null}

            <form
              onSubmit={handleRequestOtp}
              className="mt-5 space-y-4"
              noValidate
            >
              <div>
                <FieldLabel htmlFor="signup-email">อีเมลมหาวิทยาลัย</FieldLabel>
                <input
                  ref={signUpEmailRef}
                  id="signup-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  placeholder="name@ku.th"
                  className="field"
                  value={signUpEmail}
                  onChange={(event) => setSignUpEmail(event.target.value)}
                  aria-invalid={signUpAlert?.field === "email"}
                  disabled={requestingOtp}
                  required
                />
              </div>

              <div>
                <FieldLabel htmlFor="signup-password">ตั้งรหัสผ่าน</FieldLabel>
                <div className="relative">
                  <input
                    ref={signUpPasswordRef}
                    id="signup-password"
                    name="password"
                    type={signUpShowPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={`อย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`}
                    className="field pr-12"
                    value={signUpPassword}
                    onChange={(event) => setSignUpPassword(event.target.value)}
                    aria-invalid={signUpAlert?.field === "password"}
                    aria-describedby="signup-password-hint"
                    disabled={requestingOtp}
                    required
                  />
                  <PasswordToggle
                    shown={signUpShowPassword}
                    onToggle={() => setSignUpShowPassword((value) => !value)}
                  />
                </div>
                <p
                  id="signup-password-hint"
                  className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-muted"
                >
                  อย่างน้อย {PASSWORD_MIN_LENGTH} ตัวอักษร
                  ไม่บังคับตัวเลขหรืออักขระพิเศษ
                </p>
              </div>

              <button
                type="submit"
                disabled={requestingOtp}
                aria-busy={requestingOtp}
                className="btn btn-primary btn-lg w-full"
              >
                {requestingOtp ? "กำลังส่งรหัส…" : "ขอรหัสยืนยัน"}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <h2 className="text-[1.75rem] font-bold tracking-[-0.03em] text-ink sm:text-[2rem]">
              ยืนยันอีเมล
            </h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">
              กรอกรหัส {OTP_LENGTH} หลักที่ส่งไปที่{" "}
              <span className="font-semibold text-ink">
                {normaliseEmail(signUpEmail)}
              </span>{" "}
              รหัสใช้ได้ {OTP_TTL_SECONDS / 60} นาที
            </p>

            {signUpAlert ? (
              <Alert
                tone={signUpAlert.tone ?? "danger"}
                heading={signUpAlert.heading}
                body={signUpAlert.body}
                className="mt-5"
              />
            ) : null}

            <form onSubmit={handleVerifyOtp} className="mt-5" noValidate>
              <fieldset disabled={signUpPending}>
                <legend className="field-label">
                  รหัสยืนยัน {OTP_LENGTH} หลัก
                </legend>
                <div className="flex gap-2 sm:gap-2.5">
                  {digits.map((digit, index) => (
                    <input
                      // ช่อง OTP ไม่มีลำดับที่เปลี่ยนได้ — ใช้ตำแหน่งเป็นคีย์ได้
                      key={index}
                      ref={(element) => {
                        otpRefs.current[index] = element;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      value={digit}
                      onChange={(event) =>
                        handleDigitChange(index, event.target.value)
                      }
                      onKeyDown={(event) => handleDigitKeyDown(index, event)}
                      onPaste={(event) => {
                        event.preventDefault();
                        handleDigitPaste(
                          index,
                          event.clipboardData.getData("text"),
                        );
                      }}
                      aria-label={`หลักที่ ${index + 1}`}
                      className="field h-14 flex-1 px-0 text-center text-xl font-bold tabular-nums"
                    />
                  ))}
                </div>
              </fieldset>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <button
                  type="button"
                  onClick={backToCredentials}
                  disabled={signUpPending}
                  className="text-[0.8125rem] font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  แก้ไขอีเมลหรือรหัสผ่าน
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendIn > 0 || requestingOtp}
                  className="text-[0.8125rem] font-semibold text-ku underline-offset-4 hover:underline disabled:text-ink-muted disabled:no-underline"
                >
                  {resendIn > 0
                    ? `ส่งรหัสอีกครั้งใน ${formatCountdown(resendIn)}`
                    : requestingOtp
                      ? "กำลังส่งรหัส…"
                      : "ส่งรหัสอีกครั้ง"}
                </button>
              </div>

              <button
                type="submit"
                disabled={signUpPending}
                aria-busy={signUpPending}
                className="btn btn-primary btn-lg mt-5 w-full"
              >
                {signUpPending ? "กำลังสมัครสมาชิก…" : "ยืนยันและสมัครสมาชิก"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
