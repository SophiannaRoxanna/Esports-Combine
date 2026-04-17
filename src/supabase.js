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

// ==================== DIFFICULTY CONFIG ====================

export const DIFFICULTY = {
  easy: {
    label: "EASY", color: "#10B981", multiplier: 0.75,
    aim: { targetCount: 10, minSize: 38, sizeRange: 20 },
    pattern: { startLength: 2, showSpeed: 800 },
    reaction: { maxDelay: 4000 },
  },
  normal: {
    label: "NORMAL", color: "#F59E0B", multiplier: 1,
    aim: { targetCount: 15, minSize: 28, sizeRange: 20 },
    pattern: { startLength: 3, showSpeed: 600 },
    reaction: { maxDelay: 4500 },
  },
  hard: {
    label: "HARD", color: "#EF4444", multiplier: 1.5,
    aim: { targetCount: 20, minSize: 18, sizeRange: 14 },
    pattern: { startLength: 4, showSpeed: 400 },
    reaction: { maxDelay: 5000 },
  },
};

// ==================== SOLO MODE ====================

export async function submitSoloScore(name, scores, difficulty = "normal") {
  const mult = DIFFICULTY[difficulty]?.multiplier || 1;
  const total = Math.round((scores.reaction + scores.aim + scores.pattern) * mult);
  const { data, error } = await supabase
    .from("scores")
    .insert({ player_name: name, reaction: scores.reaction, aim: scores.aim, pattern: scores.pattern, total, lobby_id: null, device_id: getDeviceId(), difficulty, mode: "combine" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadSoloLeaderboard() {
  const { data, error } = await supabase
    .from("scores")
    .select("id,player_name,reaction,aim,pattern,total,difficulty,created_at")
    .is("lobby_id", null)
    .eq("mode", "combine")
    .order("total", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

// ==================== PRACTICE MODE ====================

export async function submitPracticeScore(name, testType, score, difficulty = "normal") {
  const mult = DIFFICULTY[difficulty]?.multiplier || 1;
  const adjustedScore = Math.round(score * mult);
  const scores = { reaction: 0, aim: 0, pattern: 0 };
  scores[testType] = score;
  const { data, error } = await supabase
    .from("scores")
    .insert({ player_name: name, ...scores, total: adjustedScore, lobby_id: null, device_id: getDeviceId(), difficulty, mode: "practice", test_type: testType })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPersonalBest(testType, difficulty) {
  const field = testType;
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("device_id", getDeviceId())
    .eq("mode", "practice")
    .eq("test_type", testType)
    .eq("difficulty", difficulty)
    .order(field, { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getPercentile(testType, score) {
  const { count: below } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true })
    .eq("mode", "practice")
    .eq("test_type", testType)
    .lt(testType, score);
  const { count: total } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true })
    .eq("mode", "practice")
    .eq("test_type", testType);
  if (!total || total === 0) return 100;
  return Math.round(((below || 0) / total) * 100);
}

// ==================== STATS ====================

export async function getPlayerStats() {
  const deviceId = getDeviceId();
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data;
}

export async function getCombinePercentile(totalScore) {
  const { count: below } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true })
    .eq("mode", "combine")
    .lt("total", totalScore);
  const { count: total } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true })
    .eq("mode", "combine");
  if (!total || total === 0) return 100;
  return Math.round(((below || 0) / total) * 100);
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

export async function registerLobbyPlayer(lobbyId, playerName) {
  const deviceId = getDeviceId();
  const { data: existing } = await supabase
    .from("lobby_players")
    .select("*")
    .eq("lobby_id", lobbyId)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("lobby_players")
      .update({ player_name: playerName, play_count: existing.play_count + 1 })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return { player: data, isRepeat: true };
  }

  const { data: nameTaken } = await supabase
    .from("lobby_players")
    .select("id")
    .eq("lobby_id", lobbyId)
    .eq("player_name", playerName)
    .maybeSingle();

  if (nameTaken) return { error: "NAME_TAKEN" };

  const { data, error } = await supabase
    .from("lobby_players")
    .insert({ lobby_id: lobbyId, player_name: playerName, device_id: deviceId })
    .select()
    .single();
  if (error) throw error;
  return { player: data, isRepeat: false };
}

export async function getLobbyPlayers(lobbyId) {
  const { data, error } = await supabase
    .from("lobby_players")
    .select("*")
    .eq("lobby_id", lobbyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function submitLobbyScore(lobbyId, name, scores, difficulty = "normal") {
  const mult = DIFFICULTY[difficulty]?.multiplier || 1;
  const total = Math.round((scores.reaction + scores.aim + scores.pattern) * mult);
  const { data, error } = await supabase
    .from("scores")
    .insert({ player_name: name, reaction: scores.reaction, aim: scores.aim, pattern: scores.pattern, total, lobby_id: lobbyId, device_id: getDeviceId(), difficulty, mode: "combine" })
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

// ==================== GOOGLE AUTH ====================

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
}

export async function linkDeviceScoresToUser(userId) {
  const deviceId = getDeviceId();
  await supabase
    .from("scores")
    .update({ user_id: userId })
    .eq("device_id", deviceId)
    .is("user_id", null);
}

// ==================== REALTIME ====================

export function subscribeLobbyPlayers(lobbyId, callback) {
  return supabase
    .channel(`lobby-players-${lobbyId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "lobby_players", filter: `lobby_id=eq.${lobbyId}` }, (payload) => callback(payload))
    .subscribe();
}

export function subscribeLobbyScores(lobbyId, callback) {
  return supabase
    .channel(`lobby-scores-${lobbyId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "scores", filter: `lobby_id=eq.${lobbyId}` }, (payload) => callback(payload.new))
    .subscribe();
}

export function subscribeLobbyStatus(lobbyId, callback) {
  return supabase
    .channel(`lobby-status-${lobbyId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lobbies", filter: `id=eq.${lobbyId}` }, (payload) => callback(payload.new))
    .subscribe();
}

export function unsubscribe(channel) {
  supabase.removeChannel(channel);
}
