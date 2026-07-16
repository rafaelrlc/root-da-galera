"use client";

import { useMemo, useState } from "react";
import { Lock, RotateCcw, Shuffle, Swords, UserPlus, Users, X } from "lucide-react";
import { FactionBadge } from "@/components/faction-badge";
import { deriveGuestParticipants, isLeaguePlayer, validateGuestName } from "@/lib/league-players";
import {
  beginDrafting,
  calculatePickedReach,
  canPickFaction,
  createTurnOrder,
  DRAFT_EXPANSIONS,
  getCurrentPicker,
  getFactionReach,
  getMinReach,
  getRemainingPool,
  resetDraftSession,
  selectFaction,
  selectVagabondRole,
  startDraftSession,
  type DraftExpansionId,
  type DraftPick,
  type DraftSession,
  type VagabondRole
} from "@/lib/faction-draft";

type Props = {
  players: string[];
  onApplyToRegister?: (assignments: Record<string, DraftPick>) => void;
};

const DEFAULT_EXPANSIONS: DraftExpansionId[] = ["base", "riverfolk", "underworld", "marauder"];

function DraftPlayerName({ name, players }: { name: string; players: string[] }) {
  return (
    <span className="inline-flex items-center gap-2">
      {name}
      {!isLeaguePlayer(name, players) ? (
        <span className="rounded-full bg-bark/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-bark/60">
          Temporário
        </span>
      ) : null}
    </span>
  );
}

export function FactionDraftPanel({ players, onApplyToRegister }: Props) {
  const [session, setSession] = useState<DraftSession>(resetDraftSession);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState("");
  const [enabledExpansions, setEnabledExpansions] = useState<DraftExpansionId[]>(DEFAULT_EXPANSIONS);
  const [error, setError] = useState<string | null>(null);
  const guestParticipants = deriveGuestParticipants(selectedPlayers, players);

  const remainingPool = useMemo(() => getRemainingPool(session), [session]);
  const currentPicker = useMemo(() => getCurrentPicker(session), [session]);
  const pickedReach = useMemo(() => calculatePickedReach(session.picks), [session.picks]);
  const minReach = session.playerCount > 0 ? getMinReach(session.playerCount) : 0;

  function togglePlayer(player: string) {
    setSelectedPlayers((current) => {
      if (current.includes(player)) {
        return current.filter((name) => name !== player);
      }
      if (current.length >= 6) return current;
      return [...current, player];
    });
  }

  function addGuestPlayer(name: string) {
    const trimmed = name.trim().replace(/\s+/g, " ");
    const guestError = validateGuestName(trimmed, selectedPlayers, players);
    if (guestError) {
      setError(guestError);
      return;
    }

    setError(null);
    setSelectedPlayers((current) => {
      if (current.length >= 6) return current;
      return [...current, trimmed];
    });
  }

  function removeGuestPlayer(name: string) {
    if (isLeaguePlayer(name, players)) return;
    setSelectedPlayers((current) => current.filter((player) => player !== name));
  }

  function toggleExpansion(expansion: DraftExpansionId) {
    if (DRAFT_EXPANSIONS[expansion].required) return;
    setEnabledExpansions((current) =>
      current.includes(expansion)
        ? current.filter((id) => id !== expansion)
        : [...current, expansion]
    );
  }

  function handleStartDraft() {
    setError(null);
    if (selectedPlayers.length < 3) {
      setError("Selecione pelo menos 3 jogadores.");
      return;
    }

    try {
      setSession(startDraftSession(selectedPlayers, enabledExpansions));
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Não foi possível gerar o draft.");
    }
  }

  function handleReshuffleOrder() {
    if (session.phase !== "order") return;
    const turnOrder = createTurnOrder(session.turnOrder);
    setSession({
      ...session,
      turnOrder,
      draftOrder: [...turnOrder].reverse()
    });
  }

  function handleBeginDrafting() {
    setSession(beginDrafting(session));
  }

  function handlePick(entryId: string) {
    setSession((current) => selectFaction(current, entryId));
  }

  function handleVagabondRole(role: VagabondRole) {
    setSession((current) => selectVagabondRole(current, role));
  }

  function handleReset() {
    setSession(resetDraftSession());
    setSelectedPlayers([]);
    setGuestInput("");
    setEnabledExpansions(DEFAULT_EXPANSIONS);
    setError(null);
  }

  if (session.phase === "setup") {
    return (
      <div className="flex h-full flex-col gap-5 overflow-y-auto pr-1">
        <div>
          <h2 className="storybook-title text-2xl">Draft de facções</h2>
          <p className="mt-1 text-sm text-bark/70">
            Para partidas presenciais no Advanced Setup. O site sorteia o pool e conduz a ordem de escolha.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Jogadores</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                selectedPlayers.length >= 3 ? "bg-amberleaf/30 text-bark" : "bg-berry/15 text-berry"
              }`}
            >
              {selectedPlayers.length}/6 {selectedPlayers.length < 3 ? "(mín. 3)" : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {players.map((player) => {
              const active = selectedPlayers.includes(player);
              return (
                <button
                  key={player}
                  type="button"
                  onClick={() => togglePlayer(player)}
                  className={
                    active
                      ? "rounded-full border-2 border-moss bg-moss px-4 py-2 text-sm font-bold text-cream transition"
                      : "rounded-full border-2 border-bark/10 bg-white/70 px-4 py-2 text-sm font-bold text-bark transition hover:border-moss/40"
                  }
                >
                  {player}
                </button>
              );
            })}
          </div>

          <div className="rounded-[24px] border-2 border-dashed border-bark/15 bg-white/45 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-bark">
              <UserPlus className="h-4 w-4" />
              Jogador temporário
            </div>
            <p className="mb-3 text-xs text-bark/60">
              Inclua convidados ou bots na mesa do draft. Eles participam da escolha, mas não entram nas estatísticas da liga.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="w-full rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-moss"
                placeholder="Ex.: Bot, João visitante"
                value={guestInput}
                onChange={(event) => setGuestInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (guestInput.trim()) {
                      addGuestPlayer(guestInput);
                      setGuestInput("");
                    }
                  }
                }}
              />
              <button
                type="button"
                disabled={selectedPlayers.length >= 6 || !guestInput.trim()}
                onClick={() => {
                  addGuestPlayer(guestInput);
                  setGuestInput("");
                }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-moss/30 bg-moss/10 px-4 py-3 text-sm font-bold text-moss transition hover:bg-moss/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
            {guestParticipants.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {guestParticipants.map((guest) => (
                  <span
                    key={guest}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-bark/15 bg-white/80 px-3 py-1.5 text-sm font-bold text-bark"
                  >
                    {guest}
                    <span className="rounded-full bg-bark/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-bark/60">
                      Temporário
                    </span>
                    <button
                      type="button"
                      aria-label={`Remover ${guest}`}
                      onClick={() => removeGuestPlayer(guest)}
                      className="rounded-full p-0.5 text-bark/50 transition hover:bg-bark/10 hover:text-bark"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-sm font-semibold">Expansões disponíveis</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(DRAFT_EXPANSIONS) as DraftExpansionId[]).map((expansion) => {
              const meta = DRAFT_EXPANSIONS[expansion];
              const active = enabledExpansions.includes(expansion);
              return (
                <button
                  key={expansion}
                  type="button"
                  disabled={meta.required}
                  onClick={() => toggleExpansion(expansion)}
                  className={
                    active
                      ? "rounded-2xl border-2 border-moss bg-moss/10 px-4 py-3 text-left text-sm font-bold text-moss transition"
                      : "rounded-2xl border-2 border-bark/10 bg-white/70 px-4 py-3 text-left text-sm font-bold text-bark/70 transition hover:border-bark/25"
                  }
                >
                  {meta.label}
                  {meta.required ? <span className="mt-1 block text-xs font-semibold text-bark/50">Sempre incluído</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {error ? <p className="rounded-2xl border-2 border-berry/20 bg-berry/10 px-4 py-3 text-sm font-semibold text-berry">{error}</p> : null}

        <button
          type="button"
          onClick={handleStartDraft}
          disabled={selectedPlayers.length < 3}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-moss px-4 py-3 font-bold text-cream transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Shuffle className="h-5 w-5" />
          Sortear ordem e pool
        </button>
      </div>
    );
  }

  if (session.phase === "order") {
    return (
      <div className="flex h-full flex-col gap-5 overflow-y-auto pr-1">
        <div>
          <h2 className="storybook-title text-2xl">Ordem do draft</h2>
          <p className="mt-1 text-sm text-bark/70">
            A escolha de facções segue a ordem inversa do turno. O último jogador escolhe primeiro.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border-2 border-bark/10 bg-white/65 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-bark/55">
              <Swords className="h-4 w-4" />
              Ordem de turno na partida
            </div>
            <ol className="space-y-2">
              {session.turnOrder.map((player, index) => (
                <li key={player} className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2 text-sm font-semibold">
                  <span>Jogador {index + 1}</span>
                  <DraftPlayerName name={player} players={players} />
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-[24px] border-2 border-moss/20 bg-moss/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-moss">
              <Users className="h-4 w-4" />
              Ordem de escolha no draft
            </div>
            <ol className="space-y-2">
              {session.draftOrder.map((player, index) => (
                <li key={player} className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2 text-sm font-semibold">
                  <span>{index + 1}º a escolher</span>
                  <DraftPlayerName name={player} players={players} />
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleReshuffleOrder}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-bark/15 bg-white/70 px-4 py-3 text-sm font-bold text-bark transition hover:bg-white"
          >
            <Shuffle className="h-4 w-4" />
            Re-sortear ordem
          </button>
          <button
            type="button"
            onClick={handleBeginDrafting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-moss px-4 py-3 text-sm font-bold text-cream transition hover:brightness-105"
          >
            Revelar pool e iniciar draft
          </button>
        </div>
      </div>
    );
  }

  if (session.phase === "drafting" || session.phase === "complete") {
    const reachOk = pickedReach >= minReach;

    return (
      <div className="flex h-full flex-col gap-5 overflow-y-auto pr-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="storybook-title text-2xl">
              {session.phase === "complete" ? "Draft concluído" : "Escolhendo facções"}
            </h2>
            {session.phase === "drafting" && currentPicker ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-bark/70">
                Vez de <DraftPlayerName name={currentPicker} players={players} />
              </p>
            ) : null}
          </div>

          <div
            className={`rounded-2xl border-2 px-4 py-3 text-sm ${
              reachOk ? "border-moss/25 bg-moss/10 text-moss" : "border-amber-400/40 bg-amber-50 text-amber-900"
            }`}
          >
            <p className="font-bold uppercase tracking-[0.12em]">Alcance (Reach)</p>
            <p className="mt-1 text-lg font-extrabold">
              {pickedReach} / {minReach}+
            </p>
            {!reachOk && session.phase === "complete" ? (
              <p className="mt-1 text-xs font-semibold">Abaixo do ideal para {session.playerCount} jogadores.</p>
            ) : null}
          </div>
        </div>

        {session.pendingVagabond ? (
          <div className="rounded-[24px] border-2 border-moss/25 bg-moss/5 p-4">
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-bark">
              <DraftPlayerName name={session.pendingVagabond.player} players={players} />, escolha o Vagabond:
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {session.pendingVagabond.options.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleVagabondRole(role)}
                  className="rounded-2xl border-2 border-bark/10 bg-white/80 px-4 py-3 text-sm font-bold text-bark transition hover:border-moss hover:bg-moss/10"
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-bark/50">Pool de facções</span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {session.pool.map((entry) => {
              const picked = Object.values(session.picks).some((pick) => pick.faction === entry.faction);
              const selectable = session.phase === "drafting" && canPickFaction(session, entry);
              const locked = entry.locked && !session.militantPicked && !picked;

              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={!selectable}
                  onClick={() => handlePick(entry.id)}
                  className={`rounded-[24px] border-2 p-4 text-left transition ${
                    picked
                      ? "border-bark/10 bg-bark/5 opacity-45"
                      : selectable
                        ? "border-moss/30 bg-white/80 hover:border-moss hover:bg-moss/5"
                        : "border-bark/10 bg-white/55 opacity-80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <FactionBadge faction={entry.faction} />
                    <span className="rounded-full bg-bark/10 px-2 py-1 text-xs font-bold text-bark/70">
                      Reach {getFactionReach(entry.faction)}
                    </span>
                  </div>
                  {entry.faction === "Vagabond" && entry.vagabondOptions ? (
                    <p className="mt-2 text-xs font-semibold text-bark/60">
                      Opções: {entry.vagabondOptions.join(" ou ")}
                    </p>
                  ) : null}
                  {locked ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-berry">
                      <Lock className="h-3.5 w-3.5" />
                      Trancada até alguém escolher uma militante
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-bark/50">Escolhas</span>
          <div className="grid gap-2">
            {session.draftOrder.map((player) => {
              const pick = session.picks[player];
              return (
                <div
                  key={player}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3 ${
                    currentPicker === player && session.phase === "drafting"
                      ? "border-moss bg-moss/10"
                      : "border-bark/10 bg-white/65"
                  }`}
                >
                  <DraftPlayerName name={player} players={players} />
                  {pick ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <FactionBadge faction={pick.faction} selected />
                      {pick.vagabondRole ? (
                        <span className="leaf-chip">Vagabond: {pick.vagabondRole}</span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-bark/50">Aguardando escolha</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {session.phase === "complete" ? (
          <div className="space-y-4">
            {session.discardedFaction ? (
              <p className="rounded-2xl border-2 border-dashed border-bark/15 bg-white/50 px-4 py-3 text-sm text-bark/70">
                Facção descartada do pool: <span className="font-bold text-bark">{session.discardedFaction}</span>
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {onApplyToRegister ? (
                <button
                  type="button"
                  onClick={() => onApplyToRegister(session.picks)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-berry px-4 py-3 text-sm font-bold text-white transition hover:brightness-105"
                >
                  Usar no registro de partida
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-bark/15 bg-white/70 px-4 py-3 text-sm font-bold text-bark transition hover:bg-white"
              >
                <RotateCcw className="h-4 w-4" />
                Novo draft
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
