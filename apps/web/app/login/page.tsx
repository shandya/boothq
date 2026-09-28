"use client";

import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { Delete } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LargeTitle } from "../../components/ui/LargeTitle";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { ApiError, login } from "../../lib/api";
import { useStaffTitle } from "../../lib/useStaffTitle";

type Role = "ILLUSTRATOR" | "ADMIN";

const PIN_LENGTH = 6;
const DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  useStaffTitle();
  const router = useRouter();
  const searchParams = useSearchParams();
  const boothName = process.env.NEXT_PUBLIC_BOOTH_NAME ?? "the booth";

  const [role, setRole] = useState<Role>("ILLUSTRATOR");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: { role: Role; pin: string }) => login(input),
    onSuccess: (data) => {
      const next = searchParams.get("next");
      router.replace(next ?? (data.role === "ADMIN" ? "/admin" : "/illustrator"));
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError && err.status === 429 ? "Too many tries, wait a minute." : "Wrong PIN");
      setPin("");
      setShake(true);
    },
  });

  useEffect(() => {
    if (!shake) return;
    const id = setTimeout(() => setShake(false), 400);
    return () => clearTimeout(id);
  }, [shake]);

  function pressDigit(digit: string) {
    if (pin.length >= PIN_LENGTH || mutation.isPending) return;
    setError(null);
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      mutation.mutate({ role, pin: next });
    }
  }

  function pressDelete() {
    if (mutation.isPending) return;
    setError(null);
    setPin((p) => p.slice(0, -1));
  }

  function changeRole(next: Role) {
    setRole(next);
    setPin("");
    setError(null);
  }

  return (
    <main className="flex min-h-dvh flex-col gap-5 bg-bg px-4 pb-7 pt-3 text-label">
      <header className="flex h-11 items-center justify-between px-1">
        <span className="text-[15px] font-semibold text-label-2">{boothName}</span>
        <span className="text-[13px] font-bold tracking-[-0.01em] text-label-2">BoothQ</span>
      </header>

      <LargeTitle className="px-1">Staff Sign In</LargeTitle>

      <SegmentedControl
        options={[
          { value: "ILLUSTRATOR", label: "Illustrator" },
          { value: "ADMIN", label: "Admin" },
        ]}
        value={role}
        onChange={changeRole}
      />

      <div className={clsx("mt-3 flex flex-col items-center gap-4", shake && "shake")}>
        <span className="text-[20px] font-semibold">Enter PIN</span>
        <div className="flex gap-[18px]" aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}>
          {Array.from({ length: PIN_LENGTH }, (_, index) => (
            <span
              key={index}
              className="h-[13px] w-[13px] rounded-full border-[1.5px] border-label"
              style={{ background: index < pin.length ? "var(--label)" : "transparent" }}
            />
          ))}
        </div>
        {error ? (
          <p role="alert" className="m-0 text-[15px] font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex-grow" />

      <div
        className="grid justify-center gap-x-[26px] gap-y-4"
        style={{ gridTemplateColumns: "repeat(3, 80px)" }}
      >
        {DIGIT_KEYS.map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => pressDigit(digit)}
            disabled={mutation.isPending}
            className="h-20 w-20 cursor-pointer rounded-full bg-fill text-[34px] font-normal text-label disabled:cursor-default disabled:opacity-50"
          >
            {digit}
          </button>
        ))}
        <span />
        <button
          type="button"
          onClick={() => pressDigit("0")}
          disabled={mutation.isPending}
          className="h-20 w-20 cursor-pointer rounded-full bg-fill text-[34px] font-normal text-label disabled:cursor-default disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={pressDelete}
          aria-label="Delete digit"
          disabled={mutation.isPending}
          className="flex h-20 w-20 cursor-pointer items-center justify-center text-label disabled:cursor-default disabled:opacity-50"
        >
          <Delete className="h-7 w-7" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </main>
  );
}
