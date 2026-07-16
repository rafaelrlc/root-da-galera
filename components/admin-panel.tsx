"use client";

import { useEffect, useState, useTransition } from "react";
import { LoaderCircle, Shield, UserPlus } from "lucide-react";
import type { MemberRecord } from "@/lib/types";

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

/** Cache em memória do cliente: evita refetch ao sair/entrar na aba Admin. */
let membersCache: MemberRecord[] | null = null;
let membersLoadPromise: Promise<MemberRecord[]> | null = null;

async function fetchMembers(): Promise<MemberRecord[]> {
  const response = await fetch("/api/admin/members");
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Não foi possível carregar os membros.");
  }
  return payload.members as MemberRecord[];
}

function loadMembers(force = false): Promise<MemberRecord[]> {
  if (!force && membersCache) {
    return Promise.resolve(membersCache);
  }
  if (!force && membersLoadPromise) {
    return membersLoadPromise;
  }

  membersLoadPromise = fetchMembers()
    .then((members) => {
      membersCache = members;
      return members;
    })
    .finally(() => {
      membersLoadPromise = null;
    });

  return membersLoadPromise;
}

export function AdminPanel({ onMembersChanged }: { onMembersChanged?: () => Promise<void> | void }) {
  const [members, setMembers] = useState<MemberRecord[]>(() => membersCache ?? []);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdPin, setCreatedPin] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => membersCache === null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    if (membersCache) {
      setMembers(membersCache);
      setLoading(false);
      return;
    }

    setLoading(true);
    loadMembers()
      .then((next) => {
        if (!cancelled) {
          setMembers(next);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setMembers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatedPin(null);
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível criar o membro.");
        return;
      }

      const member = payload.member as MemberRecord;
      setCreatedPin(member.pin);
      setName("");

      const next = await loadMembers(true);
      setMembers(next);
      await onMembersChanged?.();
    });
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      <div>
        <h2 className="storybook-title text-2xl">Painel Admin</h2>
        <p className="mt-1 text-sm text-bark/70">
          Gerencie membros permanentes da liga e consulte os PINs de acesso.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="rounded-[24px] border-2 border-bark/10 bg-white/65 p-5"
      >
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-moss" />
          <h3 className="storybook-title text-lg">Adicionar membro</h3>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 space-y-1 text-sm font-semibold">
            <span>Nome</span>
            <input
              className="w-full rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 outline-none transition focus:border-moss"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do jogador"
              maxLength={24}
              required
            />
          </label>
          <button
            type="submit"
            disabled={pending || name.trim().length < 2}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-moss px-5 py-3 text-sm font-bold text-cream transition hover:brightness-110 disabled:opacity-50"
          >
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Criar e gerar PIN
          </button>
        </div>
        {createdPin ? (
          <p className="mt-3 rounded-2xl bg-moss/10 px-4 py-3 text-sm font-semibold text-moss">
            Membro criado. PIN de acesso: <span className="font-mono text-base tracking-widest">{createdPin}</span>
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm font-semibold text-berry">{error}</p> : null}
      </form>

      <div className="rounded-[24px] border-2 border-bark/10 bg-white/65 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-moss" />
          <h3 className="storybook-title text-lg">Membros e PINs</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-bark/60">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando membros…
          </div>
        ) : members.length === 0 ? (
          <p className="py-8 text-center text-sm text-bark/60">Nenhum membro cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-bark/10 text-xs font-bold uppercase tracking-[0.14em] text-bark/50">
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">PIN</th>
                  <th className="px-3 py-2">Admin</th>
                  <th className="px-3 py-2">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-bark/5">
                    <td className="px-3 py-3 font-semibold text-bark">{member.name}</td>
                    <td className="px-3 py-3 font-mono tracking-widest text-bark">{member.pin}</td>
                    <td className="px-3 py-3">
                      {member.isAdmin ? (
                        <span className="rounded-full bg-moss/15 px-2.5 py-1 text-xs font-bold text-moss">Sim</span>
                      ) : (
                        <span className="text-bark/45">Não</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-bark/70">{formatCreatedAt(member.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
