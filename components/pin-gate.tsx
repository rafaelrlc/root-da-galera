"use client";

import { useState, useTransition } from "react";
import { Eye, LockKeyhole } from "lucide-react";

export function PinGate() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [guestPending, startGuestTransition] = useTransition();

  function appendDigit(digit: string) {
    if (pin.length >= 4) return;
    setPin((current) => current + digit);
    setError("");
  }

  function backspace() {
    setPin((current) => current.slice(0, -1));
    setError("");
  }

  function submitPin() {
    if (pin.length !== 4) return;

    startTransition(async () => {
      const response = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });

      if (!response.ok) {
        setError("PIN inválido");
        setPin("");
        return;
      }

      window.location.reload();
    });
  }

  function enterAsGuest() {
    startGuestTransition(async () => {
      await fetch("/api/auth/guest", { method: "POST" });
      window.location.reload();
    });
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <section className="forest-card w-full overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#7d9f57_0%,#4e6a35_100%)] px-6 py-8 text-center text-cream">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10">
              <LockKeyhole className="h-8 w-8" />
            </div>
            <h1 className="storybook-title mt-4 text-4xl text-white !text-white">Entrar na Resenha</h1>
            <p className="mt-2 text-sm text-cream/90">Digite seu PIN de 4 dígitos para acessar.</p>
          </div>

          <div className="space-y-6 p-6">
            <div className="flex justify-center gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className={`h-4 w-4 rounded-full border-2 ${index < pin.length ? "border-moss bg-moss" : "border-bark/20 bg-white"}`}
                />
              ))}
            </div>

            {error ? <p className="text-center text-sm font-semibold text-berry">{error}</p> : null}

            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "OK"].map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={pending || guestPending}
                  onClick={() => {
                    if (key === "←") return backspace();
                    if (key === "OK") return submitPin();
                    appendDigit(key);
                  }}
                  className="rounded-[22px] border-2 border-bark/10 bg-white/80 px-4 py-4 text-lg font-bold text-bark transition hover:bg-white disabled:opacity-60"
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="pt-1">
              <div className="relative flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-bark/10" />
                <span className="text-xs font-semibold text-bark/40 uppercase tracking-widest">ou</span>
                <div className="h-px flex-1 bg-bark/10" />
              </div>
              <button
                type="button"
                onClick={enterAsGuest}
                disabled={pending || guestPending}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-bark/10 bg-white/60 px-4 py-3 text-sm font-bold text-bark/70 transition hover:bg-white hover:text-bark disabled:opacity-50"
              >
                <Eye className="h-4 w-4" />
                Entrar como visitante
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
