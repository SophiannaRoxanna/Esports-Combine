import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ==================== DEVICE ID ====================

export function getDeviceId() {
  let id = localStorage.getItem("gc-device-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("gc-device-id", id);
  }
  return id;
}

// ==================== SOLO MODE ====================

export async function submitSoloScore(name, scores) {
  const total = scores.reaction + scores.aim + scores.pattern;
  const { data, error } = await supabase
    .from("scores")
    .insert({ player_name: name, reaction: scores.reaction, aim: scores.aim, pattern: scores.pattern, total, lobby_id: null, device_id: getDeviceId() })
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

// Register a player joining a lobby (before they play)
export async function registerLobbyPlayer(lobbyId, playerName) {
  const deviceId = getDeviceId();

  // Check if this device already joined this lobby
  const { data: existing } = await supabase
    .from("lobby_players")
    .select("*")
    .eq("lobby_id", lobbyId)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (existing) {
    // Same device, update play count and possibly new name
    const { data, error } = await supabase
      .from("lobby_players")
      .update({ player_name: playerName, play_count: existing.play_count + 1 })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return { player: data, isRepeat: true };
  }

  // Check if name is taken in this lobby
  const { data: nameTaken } = await supabase
    .from("lobby_players")
    .select("id")
    .eq("lobby_id", lobbyId)
    .eq("player_name", playerName)
    .maybeSingle();

  if (nameTaken) {
    return { error: "NAME_TAKEN" };
  }

  // New player
  const { data, error } = await supabase
    .from("lobby_players")
    .insert({ lobby_id: lobbyId, player_name: playerName, device_id: deviceId })
    .select()
    .single();
  if (error) throw error;
  return { player: data, isRepeat: false };
}

// Get all players who joined a lobby
export async function getLobbyPlayers(lobbyId) {
  const { data, error } = await supabase
    .from("lobby_players")
    .select("*")
    .eq("lobby_id", lobbyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getLobbyPlayerCount(lobbyId) {
  const { count, error } = await supabase
    .from("lobby_players")
    .select("*", { count: "exact", head: true })
    .eq("lobby_id", lobbyId);
  if (error) return 0;
  return count;
}

// Check if lobby is full
export async function isLobbyFull(lobbyId) {
  const { data: lobby } = await supabase
    .from("lobbies")
    .select("max_players")
    .eq("id", lobbyId)
    .single();
  if (!lobby) return false;
  const count = await getLobbyPlayerCount(lobbyId);
  return count >= lobby.max_players;
}

export async function submitLobbyScore(lobbyId, name, scores) {
  const total = scores.reaction + scores.aim + scores.pattern;
  const { data, error } = await supabase
    .from("scores")
    .insert({ player_name: name, reaction: scores.reaction, aim: scores.aim, pattern: scores.pattern, total, lobby_id: lobbyId, device_id: getDeviceId() })
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

export async function updateLobbyStatus(lobbyId, status) {
  const { error } = await supabase
    .from("lobbies")
    .update({ status })
    .eq("id", lobbyId);
  if (error) throw error;
}

// ==================== REALTIME SUBSCRIPTIONS ====================

export function subscribeLobbyPlayers(lobbyId, callback) {
  return supabase
    .channel(`lobby-players-${lobbyId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "lobby_players", filter: `lobby_id=eq.${lobbyId}` }, (payload) => {
      callback(payload);
    })
    .subscribe();
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
