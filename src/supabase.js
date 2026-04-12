import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ==================== SOLO MODE ====================

export async function submitSoloScore(name, scores) {
  const total = scores.reaction + scores.aim + scores.pattern;
  const { data, error } = await supabase
    .from("scores")
    .insert({ player_name: name, reaction: scores.reaction, aim: scores.aim, pattern: scores.pattern, total, lobby_id: null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadSoloLeaderboard() {
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .is("lobby_id", null)
    .order("total", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

// ==================== LOBBY MODE ====================

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createLobby(hostName, maxPlayers, joinMinutes) {
  const code = generateCode();
  const joinDeadline = new Date(Date.now() + joinMinutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("lobbies")
    .insert({ code, host_name: hostName, max_players: maxPlayers, join_deadline: joinDeadline, status: "waiting" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function joinLobby(code) {
  const { data, error } = await supabase
    .from("lobbies")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();
  if (error || !data) return null;
  if (data.status === "completed") return null;
  return data;
}

export async function submitLobbyScore(lobbyId, name, scores) {
  const total = scores.reaction + scores.aim + scores.pattern;
  const { data, error } = await supabase
    .from("scores")
    .insert({ player_name: name, reaction: scores.reaction, aim: scores.aim, pattern: scores.pattern, total, lobby_id: lobbyId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadLobbyLeaderboard(lobbyId) {
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("lobby_id", lobbyId)
    .order("total", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getLobbyPlayerCount(lobbyId) {
  const { count, error } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true })
    .eq("lobby_id", lobbyId);
  if (error) return 0;
  return count;
}

export async function updateLobbyStatus(lobbyId, status) {
  const { error } = await supabase
    .from("lobbies")
    .update({ status })
    .eq("id", lobbyId);
  if (error) throw error;
}

export function subscribeLobbyScores(lobbyId, callback) {
  return supabase
    .channel(`lobby-scores-${lobbyId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "scores", filter: `lobby_id=eq.${lobbyId}` }, (payload) => {
      callback(payload.new);
    })
    .subscribe();
}

export function subscribeLobbyStatus(lobbyId, callback) {
  return supabase
    .channel(`lobby-status-${lobbyId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lobbies", filter: `id=eq.${lobbyId}` }, (payload) => {
      callback(payload.new);
    })
    .subscribe();
}

export function unsubscribe(channel) {
  supabase.removeChannel(channel);
}
