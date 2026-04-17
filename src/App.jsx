import { useState, useEffect, useRef, useCallback } from "react";
import {
  submitSoloScore, loadSoloLeaderboard, submitPracticeScore, getPersonalBest, getPercentile,
  createLobby, joinLobby, submitLobbyScore, loadLobbyLeaderboard,
  updateLobbyStatus, registerLobbyPlayer, getLobbyPlayers, getPlayerStats, getCombinePercentile,
  subscribeLobbyScores, subscribeLobbyStatus, subscribeLobbyPlayers, unsubscribe, DIFFICULTY,
} from "./supabase";

const COLORS = {
  bg: "#0A0E17", bgLight: "#111827", panel: "#1A1F2E", panelLight: "#232B3E",
  cyan: "#00DCF0", cyanDark: "#0097A7", white: "#FFFFFF", gray: "#9CA3AF",
  grayLight: "#D1D5DB", grayDark: "#4B5563", red: "#EF4444", green: "#10B981",
  yellow: "#F59E0B", purple: "#8B5CF6", orange: "#F97316",
};

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ==================== MAIN APP ====================
export default function EsportsCombine() {
  const [screen, setScreen] = useState("landing");
  const [playerName, setPlayerName] = useState("");
  const [scores, setScores] = useState({ reaction: 0, aim: 0, pattern: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState("solo");
  const [lobbyId, setLobbyId] = useState(null);
  const [lobbyCode, setLobbyCode] = useState("");
  const [lobbyData, setLobbyData] = useState(null);
  const [difficulty, setDifficulty] = useState("normal");
  const [practiceTest, setPracticeTest] = useState(null);

  useEffect(() => { loadSoloLeaderboard().then(setLeaderboard).catch(() => {}); }, []);

  const diffConfig = DIFFICULTY[difficulty];
  const updateScore = (test, score) => setScores(prev => ({ ...prev, [test]: score }));

  const resetGame = () => { setScores({ reaction: 0, aim: 0, pattern: 0 }); setPlayerName(""); };

  const submitScore = async () => {
    if (!playerName.trim() || submitting) return;
    setSubmitting(true);
    try {
      if (mode === "lobby" && lobbyId) {
        await submitLobbyScore(lobbyId, playerName.trim(), scores, difficulty);
        const lb = await loadLobbyLeaderboard(lobbyId);
        setLeaderboard(lb);
      } else {
        await submitSoloScore(playerName.trim(), scores, difficulty);
        const lb = await loadSoloLeaderboard();
        setLeaderboard(lb);
      }
    } catch (e) { console.error(e); }
    setSubmitting(false);
    setScreen("leaderboard");
  };

  const startSolo = () => { setMode("solo"); setLobbyId(null); setLobbyCode(""); setLobbyData(null); setScreen("name"); };
  const startMultiplayer = () => { setScreen("lobby-menu"); };
  const startPractice = () => { setScreen("practice-menu"); };

  const goHome = () => {
    resetGame(); setMode("solo"); setLobbyId(null); setLobbyCode(""); setLobbyData(null); setPracticeTest(null);
    setScreen("landing"); loadSoloLeaderboard().then(setLeaderboard).catch(() => {});
  };

  const playAgain = () => {
    setScores({ reaction: 0, aim: 0, pattern: 0 });
    if (mode === "practice") { setScreen("difficulty-select"); }
    else if (mode === "lobby") { setScreen("name"); }
    else { setScreen("difficulty-select"); }
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.white, fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 480, margin: "0 auto", position: "relative", overflow: "hidden" }}>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.purple})`, position: "sticky", top: 0, zIndex: 99 }} />

      {screen === "landing" && <Landing onSolo={startSolo} onMultiplayer={startMultiplayer} onPractice={startPractice} onStats={() => setScreen("stats")} leaderboard={leaderboard} onShowLB={() => { setMode("solo"); setScreen("leaderboard"); }} />}

      {screen === "name" && <NameEntry name={playerName} setName={setPlayerName} onNext={async () => {
        if (!playerName.trim()) return;
        if (mode === "lobby" && lobbyId) {
          const result = await registerLobbyPlayer(lobbyId, playerName.trim());
          if (result.error === "NAME_TAKEN") { alert("That name is already taken in this lobby. Choose another."); return; }
        }
        setScreen("difficulty-select");
      }} />}

      {screen === "difficulty-select" && <DifficultySelect selected={difficulty} onSelect={(d) => { setDifficulty(d); setScreen(mode === "practice" ? `practice-${practiceTest}` : "test1-intro"); }} onBack={goHome} />}

      {/* Practice mode */}
      {screen === "practice-menu" && <PracticeMenu onSelect={(test) => { setMode("practice"); setPracticeTest(test); setScreen("name"); }} onBack={goHome} />}
      {screen === "practice-reaction" && <ReactionTest difficulty={diffConfig} onComplete={s => { updateScore("reaction", s); setScreen("practice-result"); }} />}
      {screen === "practice-aim" && <AimTest difficulty={diffConfig} onComplete={s => { updateScore("aim", s); setTimeout(() => setScreen("practice-result"), 1500); }} />}
      {screen === "practice-pattern" && <PatternTest difficulty={diffConfig} onComplete={s => { updateScore("pattern", s); setTimeout(() => setScreen("practice-result"), 1500); }} />}
      {screen === "practice-result" && <PracticeResult name={playerName} testType={practiceTest} score={scores[practiceTest]} difficulty={difficulty} onTryAgain={() => { setScores({ reaction: 0, aim: 0, pattern: 0 }); setScreen(`practice-${practiceTest}`); }} onHome={goHome} />}

      {/* Stats */}
      {screen === "stats" && <StatsScreen onBack={goHome} />}

      {/* Lobby screens */}
      {screen === "lobby-menu" && <LobbyMenu onBack={goHome} onCreateScreen={() => setScreen("lobby-create")} onJoinScreen={() => setScreen("lobby-join")} />}
      {screen === "lobby-create" && <LobbyCreateScreen onBack={() => setScreen("lobby-menu")} onCreate={(data) => {
        setMode("lobby"); setLobbyId(data.id); setLobbyCode(data.code); setLobbyData(data); setScreen("lobby-waiting");
      }} />}
      {screen === "lobby-join" && <LobbyJoinScreen onBack={() => setScreen("lobby-menu")} onJoin={(data) => {
        setMode("lobby"); setLobbyId(data.id); setLobbyCode(data.code); setLobbyData(data); setScreen("name");
      }} />}
      {screen === "lobby-waiting" && <LobbyWaiting lobby={lobbyData} onStart={() => {
        updateLobbyStatus(lobbyId, "active").catch(() => {}); setScreen("name");
      }} onBack={goHome} />}

      {/* Tests */}
      {screen === "test1-intro" && <TestIntro num={1} title="REACTION TIME" desc="Wait for the screen to turn green, then tap as fast as you can." icon="⚡" color={COLORS.cyan} difficulty={difficulty} onStart={() => setScreen("test1")} />}
      {screen === "test1" && <ReactionTest difficulty={diffConfig} onComplete={ms => { updateScore("reaction", ms); setScreen("test2-intro"); }} />}
      {screen === "test2-intro" && <TestIntro num={2} title="AIM TRAINER" desc={`Tap ${diffConfig.aim.targetCount} targets as fast as you can.`} icon="🎯" color={COLORS.red} difficulty={difficulty} onStart={() => setScreen("test2")} />}
      {screen === "test2" && <AimTest difficulty={diffConfig} onComplete={s => { updateScore("aim", s); setTimeout(() => setScreen("test3-intro"), 1500); }} />}
      {screen === "test3-intro" && <TestIntro num={3} title="PATTERN MEMORY" desc="Watch the sequence, then repeat it. Gets harder each round." icon="🧠" color={COLORS.purple} difficulty={difficulty} onStart={() => setScreen("test3")} />}
      {screen === "test3" && <PatternTest difficulty={diffConfig} onComplete={s => { updateScore("pattern", s); setTimeout(() => setScreen("results"), 1500); }} />}

      {screen === "results" && <Results name={playerName} scores={scores} difficulty={difficulty} onSubmit={submitScore} submitting={submitting} />}
      {screen === "leaderboard" && (
        mode === "lobby" && lobbyId
          ? <LobbyLeaderboard lobbyId={lobbyId} lobbyCode={lobbyCode} playerName={playerName} onBack={goHome} onPlayAgain={playAgain} />
          : <Leaderboard data={leaderboard} playerName={playerName} onBack={goHome} onPlayAgain={playAgain} />
      )}
    </div>
  );
}

// ==================== LANDING ====================
function Landing({ onSolo, onMultiplayer, onPractice, onStats, leaderboard, onShowLB }) {
  return (
    <div style={{ padding: "40px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {/* <div style={{ fontSize: 11, color: COLORS.cyan, letterSpacing: 4, fontWeight: 700, marginBottom: 8 }}>ESPORTS</div> */}
      <h1 style={{ fontSize: 36, fontWeight: 900, margin: "0 0 4px", lineHeight: 1.1, background: `linear-gradient(135deg, ${COLORS.white}, ${COLORS.cyan})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ESPORTS<br/>COMBINE</h1>
      <p style={{ color: COLORS.gray, fontSize: 14, margin: "12px 0 24px", lineHeight: 1.5 }}>3 tests. Reaction. Aim. Memory.<br/>Compete for the top score.</p>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
        {[{ icon: "⚡", label: "Reaction", color: COLORS.cyan }, { icon: "🎯", label: "Aim", color: COLORS.red }, { icon: "🧠", label: "Memory", color: COLORS.purple }].map(t => (
          <div key={t.label} style={{ background: COLORS.panel, borderRadius: 12, padding: "14px 16px", flex: 1, borderTop: `3px solid ${t.color}` }}>
            <div style={{ fontSize: 24 }}>{t.icon}</div>
            <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 4 }}>{t.label}</div>
          </div>
        ))}
      </div>

      <button onClick={onSolo} style={{ background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.cyanDark})`, color: COLORS.bg, border: "none", borderRadius: 12, padding: "16px 32px", fontSize: 18, fontWeight: 800, cursor: "pointer", width: "100%", marginBottom: 10, letterSpacing: 1 }}>SOLO COMBINE</button>
      <button onClick={onMultiplayer} style={{ background: `linear-gradient(135deg, ${COLORS.purple}, #6D28D9)`, color: COLORS.white, border: "none", borderRadius: 12, padding: "16px 32px", fontSize: 18, fontWeight: 800, cursor: "pointer", width: "100%", marginBottom: 10, letterSpacing: 1 }}>MULTIPLAYER</button>
      <button onClick={onPractice} style={{ background: COLORS.panel, color: COLORS.cyan, border: `1px solid ${COLORS.cyan}33`, borderRadius: 12, padding: "14px 32px", fontSize: 16, fontWeight: 700, cursor: "pointer", width: "100%", marginBottom: 10 }}>PRACTICE MODE</button>

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <button onClick={onStats} style={{ flex: 1, background: COLORS.panel, color: COLORS.grayLight, border: "none", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>MY STATS</button>
        {leaderboard.length > 0 && <button onClick={onShowLB} style={{ flex: 1, background: COLORS.panel, color: COLORS.grayLight, border: "none", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>LEADERBOARD</button>}
      </div>

      <div style={{ marginTop: 16, fontSize: 10, color: COLORS.grayDark }}>ESPORTS 103 • BUILT BY SOPHIA NEI</div>
    </div>
  );
}

// ==================== DIFFICULTY SELECT ====================
function DifficultySelect({ selected, onSelect, onBack }) {
  const options = [
    { key: "easy", icon: "🟢", desc: "Larger targets, slower patterns", mult: "0.75x score" },
    { key: "normal", icon: "🟡", desc: "Standard challenge", mult: "1x score" },
    { key: "hard", icon: "🔴", desc: "Smaller targets, faster patterns", mult: "1.5x score" },
  ];
  return (
    <div style={{ padding: "60px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚔️</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>SELECT DIFFICULTY</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {options.map(o => {
          const cfg = DIFFICULTY[o.key];
          const isSel = selected === o.key;
          return (
            <button key={o.key} onClick={() => onSelect(o.key)} style={{
              background: isSel ? `${cfg.color}22` : COLORS.panel,
              border: `2px solid ${isSel ? cfg.color : COLORS.panelLight}`,
              borderRadius: 12, padding: "16px 20px", cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{ fontSize: 28 }}>{o.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: cfg.color }}>{cfg.label}</div>
                <div style={{ fontSize: 12, color: COLORS.gray, marginTop: 2 }}>{o.desc}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: cfg.color, background: `${cfg.color}22`, padding: "4px 10px", borderRadius: 8 }}>{o.mult}</div>
            </button>
          );
        })}
      </div>
      <button onClick={onBack} style={{ background: "transparent", color: COLORS.grayLight, border: "none", padding: "12px", fontSize: 14, cursor: "pointer" }}>← Back</button>
    </div>
  );
}

// ==================== PRACTICE MENU ====================
function PracticeMenu({ onSelect, onBack }) {
  const tests = [
    { key: "reaction", icon: "⚡", label: "Reaction Time", desc: "Train your reflexes", color: COLORS.cyan },
    { key: "aim", icon: "🎯", label: "Aim Trainer", desc: "Sharpen your precision", color: COLORS.red },
    { key: "pattern", icon: "🧠", label: "Pattern Memory", desc: "Boost your memory", color: COLORS.purple },
  ];
  return (
    <div style={{ padding: "60px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏋️</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>PRACTICE MODE</h2>
      <p style={{ color: COLORS.gray, fontSize: 13, marginBottom: 24 }}>Pick a skill to drill</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {tests.map(t => (
          <button key={t.key} onClick={() => onSelect(t.key)} style={{
            background: COLORS.panel, border: "none", borderRadius: 12, padding: "20px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 16, borderLeft: `4px solid ${t.color}`,
          }}>
            <div style={{ fontSize: 32 }}>{t.icon}</div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.color }}>{t.label}</div>
              <div style={{ fontSize: 12, color: COLORS.gray, marginTop: 2 }}>{t.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <button onClick={onBack} style={{ background: "transparent", color: COLORS.grayLight, border: "none", padding: "12px", fontSize: 14, cursor: "pointer" }}>← Back</button>
    </div>
  );
}

// ==================== PRACTICE RESULT ====================
function PracticeResult({ name, testType, score, difficulty, onTryAgain, onHome }) {
  const [personalBest, setPersonalBest] = useState(null);
  const [percentile, setPercentile] = useState(null);
  const [saving, setSaving] = useState(true);
  const icons = { reaction: "⚡", aim: "🎯", pattern: "🧠" };
  const colors = { reaction: COLORS.cyan, aim: COLORS.red, pattern: COLORS.purple };
  const labels = { reaction: "Reaction", aim: "Aim", pattern: "Memory" };
  const mult = DIFFICULTY[difficulty]?.multiplier || 1;
  const adjustedScore = Math.round(score * mult);

  useEffect(() => {
    (async () => {
      await submitPracticeScore(name, testType, score, difficulty);
      const pb = await getPersonalBest(testType, difficulty);
      const pct = await getPercentile(testType, score);
      setPersonalBest(pb);
      setPercentile(pct);
      setSaving(false);
    })();
  }, []);

  return (
    <div style={{ padding: "40px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 56 }}>{icons[testType]}</div>
      <div style={{ fontSize: 12, color: colors[testType], letterSpacing: 3, marginTop: 12 }}>{labels[testType].toUpperCase()} PRACTICE</div>
      <div style={{ fontSize: 56, fontWeight: 900, color: colors[testType], marginTop: 8 }}>{adjustedScore}</div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 4 }}>
        <span style={{ fontSize: 12, color: COLORS.gray }}>Raw: {score}</span>
        <span style={{ fontSize: 12, color: DIFFICULTY[difficulty].color, fontWeight: 700 }}>{DIFFICULTY[difficulty].label} ({mult}x)</span>
      </div>

      {!saving && (
        <div style={{ display: "flex", gap: 10, marginTop: 24, marginBottom: 24 }}>
          <div style={{ flex: 1, background: COLORS.panel, borderRadius: 12, padding: "14px 8px" }}>
            <div style={{ fontSize: 10, color: COLORS.gray }}>PERSONAL BEST</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.yellow, marginTop: 4 }}>{personalBest ? personalBest[testType] : score}</div>
          </div>
          <div style={{ flex: 1, background: COLORS.panel, borderRadius: 12, padding: "14px 8px" }}>
            <div style={{ fontSize: 10, color: COLORS.gray }}>PERCENTILE</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.green, marginTop: 4 }}>Top {100 - (percentile || 0)}%</div>
          </div>
        </div>
      )}

      <button onClick={onTryAgain} style={{ background: colors[testType], color: COLORS.bg, border: "none", borderRadius: 12, padding: "16px 32px", fontSize: 16, fontWeight: 800, cursor: "pointer", width: "100%", marginBottom: 10 }}>TRY AGAIN</button>
      <button onClick={onHome} style={{ background: COLORS.panel, color: COLORS.grayLight, border: "none", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}>HOME</button>
    </div>
  );
}

// ==================== STATS DASHBOARD ====================
function StatsScreen({ onBack }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [combinePercentile, setCombinePercentile] = useState(null);

  useEffect(() => {
    getPlayerStats().then(async (data) => {
      setStats(data);
      const combines = data.filter(s => s.mode === "combine");
      if (combines.length > 0) {
        const best = Math.max(...combines.map(c => c.total));
        const pct = await getCombinePercentile(best);
        setCombinePercentile(pct);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: COLORS.gray, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading stats...</div>;

  const combines = stats.filter(s => s.mode === "combine");
  const practices = stats.filter(s => s.mode === "practice");
  const bestCombine = combines.length > 0 ? Math.max(...combines.map(c => c.total)) : 0;
  const bestReaction = Math.max(0, ...stats.filter(s => s.reaction > 0).map(s => s.reaction));
  const bestAim = Math.max(0, ...stats.filter(s => s.aim > 0).map(s => s.aim));
  const bestPattern = Math.max(0, ...stats.filter(s => s.pattern > 0).map(s => s.pattern));

  // Sparkline data: last 20 combine scores chronologically
  const sparkData = combines.slice(0, 20).reverse().map(c => c.total);
  const sparkMax = Math.max(...sparkData, 1);
  const sparkMin = Math.min(...sparkData, 0);
  const sparkH = 60;
  const sparkW = 280;

  return (
    <div style={{ padding: "32px 24px", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 48 }}>📊</div>
        <h2 style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>MY STATS</h2>
      </div>

      {/* Overview */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, background: COLORS.panel, borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.cyan }}>{combines.length}</div>
          <div style={{ fontSize: 10, color: COLORS.gray }}>Combines</div>
        </div>
        <div style={{ flex: 1, background: COLORS.panel, borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.yellow }}>{bestCombine}</div>
          <div style={{ fontSize: 10, color: COLORS.gray }}>Best Score</div>
        </div>
        <div style={{ flex: 1, background: COLORS.panel, borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.green }}>{combinePercentile != null ? `Top ${100 - combinePercentile}%` : "—"}</div>
          <div style={{ fontSize: 10, color: COLORS.gray }}>Rank</div>
        </div>
      </div>

      {/* Per-test bests */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {[{ label: "Reaction", val: bestReaction, icon: "⚡", color: COLORS.cyan },
          { label: "Aim", val: bestAim, icon: "🎯", color: COLORS.red },
          { label: "Memory", val: bestPattern, icon: "🧠", color: COLORS.purple }].map(t => (
          <div key={t.label} style={{ flex: 1, background: COLORS.panel, borderRadius: 12, padding: "12px 8px", textAlign: "center", borderTop: `3px solid ${t.color}` }}>
            <div style={{ fontSize: 18 }}>{t.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.color, marginTop: 4 }}>{t.val}</div>
            <div style={{ fontSize: 9, color: COLORS.gray }}>Best {t.label}</div>
          </div>
        ))}
      </div>

      {/* Sparkline */}
      {sparkData.length > 1 && (
        <div style={{ background: COLORS.panel, borderRadius: 12, padding: "16px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: COLORS.gray, letterSpacing: 2, marginBottom: 8 }}>COMBINE SCORE TREND</div>
          <svg width="100%" viewBox={`0 0 ${sparkW} ${sparkH}`} style={{ display: "block" }}>
            <polyline
              fill="none" stroke={COLORS.cyan} strokeWidth="2" strokeLinejoin="round"
              points={sparkData.map((v, i) => `${(i / (sparkData.length - 1)) * sparkW},${sparkH - ((v - sparkMin) / (sparkMax - sparkMin || 1)) * (sparkH - 8) - 4}`).join(" ")}
            />
            {sparkData.map((v, i) => (
              <circle key={i} cx={(i / (sparkData.length - 1)) * sparkW} cy={sparkH - ((v - sparkMin) / (sparkMax - sparkMin || 1)) * (sparkH - 8) - 4} r="3" fill={COLORS.cyan} />
            ))}
          </svg>
        </div>
      )}

      {/* Recent history */}
      <div style={{ background: COLORS.panel, borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: COLORS.gray, letterSpacing: 2, marginBottom: 8 }}>RECENT ({stats.length} total)</div>
        {stats.slice(0, 10).map((s, i) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: i > 0 ? `1px solid ${COLORS.panelLight}` : "none" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.white }}>
                {s.mode === "practice" ? `${s.test_type} drill` : "Combine"}
                <span style={{ fontSize: 9, color: DIFFICULTY[s.difficulty || "normal"]?.color || COLORS.gray, marginLeft: 6, fontWeight: 700 }}>{(s.difficulty || "normal").toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 10, color: COLORS.grayDark }}>{formatDate(s.created_at)}</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.cyan }}>{s.total}</div>
          </div>
        ))}
        {stats.length === 0 && <div style={{ color: COLORS.grayDark, fontSize: 13, padding: 16, textAlign: "center" }}>No games yet. Go play!</div>}
      </div>

      <button onClick={onBack} style={{ background: COLORS.panel, color: COLORS.grayLight, border: "none", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}>← HOME</button>
    </div>
  );
}

// ==================== NAME ENTRY ====================
function NameEntry({ name, setName, onNext }) {
  return (
    <div style={{ padding: "60px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎮</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Enter Your Name</h2>
      <p style={{ color: COLORS.gray, fontSize: 13, marginBottom: 24 }}>This goes on the leaderboard</p>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Your gamer tag..." maxLength={20} autoFocus
        style={{ background: COLORS.panel, border: `2px solid ${COLORS.cyan}44`, borderRadius: 12, padding: "16px 20px", fontSize: 18, color: COLORS.white, textAlign: "center", width: "100%", boxSizing: "border-box", outline: "none", fontWeight: 600 }}
        onKeyDown={e => e.key === "Enter" && onNext()} />
      <button onClick={onNext} disabled={!name.trim()} style={{ marginTop: 16, background: name.trim() ? COLORS.cyan : COLORS.grayDark, color: COLORS.bg, border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 16, fontWeight: 700, cursor: name.trim() ? "pointer" : "default", width: "100%", opacity: name.trim() ? 1 : 0.5 }}>
        LET'S GO →
      </button>
    </div>
  );
}

// ==================== LOBBY MENU ====================
function LobbyMenu({ onBack, onCreateScreen, onJoinScreen }) {
  return (
    <div style={{ padding: "60px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🏟️</div>
      <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>MULTIPLAYER</h2>
      <p style={{ color: COLORS.gray, fontSize: 14, marginBottom: 32 }}>Create a lobby or join one with a code</p>
      <button onClick={onCreateScreen} style={{ background: `linear-gradient(135deg, ${COLORS.purple}, #6D28D9)`, color: COLORS.white, border: "none", borderRadius: 12, padding: "16px 32px", fontSize: 18, fontWeight: 800, cursor: "pointer", width: "100%", marginBottom: 12 }}>CREATE LOBBY</button>
      <button onClick={onJoinScreen} style={{ background: COLORS.panel, color: COLORS.cyan, border: `1px solid ${COLORS.cyan}44`, borderRadius: 12, padding: "16px 32px", fontSize: 18, fontWeight: 700, cursor: "pointer", width: "100%", marginBottom: 12 }}>JOIN WITH CODE</button>
      <button onClick={onBack} style={{ background: "transparent", color: COLORS.grayLight, border: "none", padding: "12px", fontSize: 14, cursor: "pointer" }}>← Back</button>
    </div>
  );
}

// ==================== LOBBY CREATE ====================
function LobbyCreateScreen({ onBack, onCreate }) {
  const [hostName, setHostName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [joinMinutes, setJoinMinutes] = useState(5);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const handleCreate = async () => {
    if (!hostName.trim() || creating) return;
    setCreating(true); setError("");
    try { const data = await createLobby(hostName.trim(), maxPlayers, joinMinutes); onCreate(data); }
    catch { setError("Failed to create lobby. Try again."); setCreating(false); }
  };
  return (
    <div style={{ padding: "40px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>CREATE LOBBY</h2>
      <div style={{ textAlign: "left", marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: COLORS.gray, letterSpacing: 1 }}>YOUR NAME</label>
        <input value={hostName} onChange={e => setHostName(e.target.value)} placeholder="Host name..." maxLength={20}
          style={{ display: "block", width: "100%", boxSizing: "border-box", background: COLORS.panel, border: `2px solid ${COLORS.cyan}44`, borderRadius: 10, padding: "14px 16px", fontSize: 16, color: COLORS.white, outline: "none", marginTop: 6, fontWeight: 600 }} />
      </div>
      <div style={{ textAlign: "left", marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: COLORS.gray, letterSpacing: 1 }}>EXPECTED PLAYERS: <span style={{ color: COLORS.cyan, fontWeight: 700 }}>{maxPlayers}</span></label>
        <input type="range" min={2} max={100} value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value))} style={{ display: "block", width: "100%", marginTop: 8, accentColor: COLORS.cyan }} />
      </div>
      <div style={{ textAlign: "left", marginBottom: 24 }}>
        <label style={{ fontSize: 12, color: COLORS.gray, letterSpacing: 1 }}>JOIN TIMER: <span style={{ color: COLORS.cyan, fontWeight: 700 }}>{joinMinutes} min</span></label>
        <input type="range" min={1} max={30} value={joinMinutes} onChange={e => setJoinMinutes(Number(e.target.value))} style={{ display: "block", width: "100%", marginTop: 8, accentColor: COLORS.cyan }} />
      </div>
      {error && <div style={{ color: COLORS.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button onClick={handleCreate} disabled={!hostName.trim() || creating} style={{ background: hostName.trim() ? `linear-gradient(135deg, ${COLORS.purple}, #6D28D9)` : COLORS.grayDark, color: COLORS.white, border: "none", borderRadius: 12, padding: "16px 32px", fontSize: 18, fontWeight: 800, cursor: "pointer", width: "100%", marginBottom: 12, opacity: creating ? 0.6 : 1 }}>{creating ? "CREATING..." : "CREATE LOBBY"}</button>
      <button onClick={onBack} style={{ background: "transparent", color: COLORS.grayLight, border: "none", padding: "12px", fontSize: 14, cursor: "pointer" }}>← Back</button>
    </div>
  );
}

// ==================== LOBBY JOIN ====================
function LobbyJoinScreen({ onBack, onJoin }) {
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const handleJoin = async () => {
    if (code.length < 6 || joining) return;
    setJoining(true); setError("");
    try {
      const data = await joinLobby(code);
      if (!data) { setError("Lobby not found or already completed."); setJoining(false); return; }
      const players = await getLobbyPlayers(data.id);
      if (players.length >= data.max_players) { setError("This lobby is full."); setJoining(false); return; }
      onJoin(data);
    } catch { setError("Failed to join. Check the code and try again."); setJoining(false); }
  };
  return (
    <div style={{ padding: "60px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>JOIN LOBBY</h2>
      <p style={{ color: COLORS.gray, fontSize: 13, marginBottom: 24 }}>Enter the 6-character code</p>
      <input value={code} onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="ABC123" maxLength={6} autoFocus
        style={{ background: COLORS.panel, border: `2px solid ${COLORS.purple}66`, borderRadius: 12, padding: "16px 20px", fontSize: 28, color: COLORS.white, textAlign: "center", width: "100%", boxSizing: "border-box", outline: "none", fontWeight: 800, letterSpacing: 8, fontFamily: "monospace" }}
        onKeyDown={e => e.key === "Enter" && handleJoin()} />
      {error && <div style={{ color: COLORS.red, fontSize: 13, marginTop: 12 }}>{error}</div>}
      <button onClick={handleJoin} disabled={code.length < 6 || joining} style={{ marginTop: 16, background: code.length >= 6 ? `linear-gradient(135deg, ${COLORS.purple}, #6D28D9)` : COLORS.grayDark, color: COLORS.white, border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 16, fontWeight: 700, cursor: "pointer", width: "100%", opacity: joining ? 0.6 : 1 }}>{joining ? "JOINING..." : "JOIN LOBBY"}</button>
      <button onClick={onBack} style={{ marginTop: 8, background: "transparent", color: COLORS.grayLight, border: "none", padding: "12px", fontSize: 14, cursor: "pointer" }}>← Back</button>
    </div>
  );
}

// ==================== LOBBY WAITING ====================
function LobbyWaiting({ lobby, onStart, onBack }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [players, setPlayers] = useState([]);
  const [expired, setExpired] = useState(false);
  const [isFull, setIsFull] = useState(false);
  useEffect(() => {
    const loadPlayers = async () => { const list = await getLobbyPlayers(lobby.id); setPlayers(list); setIsFull(list.length >= lobby.max_players); };
    loadPlayers();
    const sub = subscribeLobbyPlayers(lobby.id, () => loadPlayers());
    return () => unsubscribe(sub);
  }, [lobby.id, lobby.max_players]);
  useEffect(() => { if (isFull) updateLobbyStatus(lobby.id, "active").catch(() => {}); }, [isFull, lobby.id]);
  useEffect(() => {
    const tick = () => {
      const diff = new Date(lobby.join_deadline).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("0:00"); setExpired(true); return; }
      setTimeLeft(`${Math.floor(diff / 60000)}:${Math.floor((diff % 60000) / 1000).toString().padStart(2, "0")}`);
    };
    tick(); const interval = setInterval(tick, 1000); return () => clearInterval(interval);
  }, [lobby.join_deadline]);
  return (
    <div style={{ padding: "32px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🏟️</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>LOBBY CREATED</h2>
      <div style={{ background: COLORS.panel, borderRadius: 16, padding: "24px 20px", marginBottom: 20, border: `1px solid ${COLORS.purple}44` }}>
        <div style={{ fontSize: 11, color: COLORS.gray, letterSpacing: 2, marginBottom: 8 }}>SHARE THIS CODE</div>
        <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: 8, color: COLORS.purple, fontFamily: "monospace" }}>{lobby.code}</div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, background: COLORS.panel, borderRadius: 12, padding: "16px 8px" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: isFull ? COLORS.green : COLORS.cyan }}>{players.length}</div>
          <div style={{ fontSize: 10, color: COLORS.gray, marginTop: 4 }}>{isFull ? "LOBBY FULL" : `of ${lobby.max_players} joined`}</div>
        </div>
        <div style={{ flex: 1, background: COLORS.panel, borderRadius: 12, padding: "16px 8px" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: expired || isFull ? COLORS.red : COLORS.yellow }}>{isFull ? "CLOSED" : timeLeft}</div>
          <div style={{ fontSize: 10, color: COLORS.gray, marginTop: 4 }}>{isFull ? "No more joins" : expired ? "Timer expired" : "Time to join"}</div>
        </div>
      </div>
      {players.length > 0 && (
        <div style={{ background: COLORS.panel, borderRadius: 12, padding: "12px 16px", marginBottom: 20, textAlign: "left", maxHeight: 200, overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: COLORS.gray, letterSpacing: 2, marginBottom: 8 }}>PLAYERS JOINED</div>
          {players.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderTop: i > 0 ? `1px solid ${COLORS.panelLight}` : "none" }}>
              <span style={{ fontSize: 11, color: COLORS.grayDark, width: 20 }}>{i + 1}.</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.white }}>{p.player_name}</span>
              {p.play_count > 1 && <span style={{ fontSize: 9, color: COLORS.orange, background: `${COLORS.orange}22`, padding: "1px 6px", borderRadius: 8, marginLeft: 6 }}>x{p.play_count}</span>}
            </div>
          ))}
        </div>
      )}
      <button onClick={onStart} style={{ background: `linear-gradient(135deg, ${COLORS.purple}, #6D28D9)`, color: COLORS.white, border: "none", borderRadius: 12, padding: "16px 32px", fontSize: 18, fontWeight: 800, cursor: "pointer", width: "100%", marginBottom: 12 }}>START GAME</button>
      <button onClick={onBack} style={{ background: "transparent", color: COLORS.grayLight, border: "none", padding: "12px", fontSize: 14, cursor: "pointer" }}>← Cancel</button>
    </div>
  );
}

// ==================== LOBBY LEADERBOARD (REAL-TIME) ====================
const DEVICE_COLORS = ["#F97316", "#EC4899", "#3B82F6", "#14B8A6", "#A855F7", "#EAB308", "#EF4444", "#06B6D4", "#84CC16", "#F43F5E"];
function LobbyLeaderboard({ lobbyId, lobbyCode, playerName, onBack, onPlayAgain }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadLobbyLeaderboard(lobbyId).then(data => { setEntries(data); setLoading(false); }).catch(() => setLoading(false));
    const sub = subscribeLobbyScores(lobbyId, (n) => setEntries(prev => [...prev, n].sort((a, b) => b.total - a.total)));
    return () => unsubscribe(sub);
  }, [lobbyId]);
  const deviceMap = {}; let ci = 0;
  entries.forEach(e => { if (!e.device_id) return; if (!deviceMap[e.device_id]) { deviceMap[e.device_id] = { count: 0, color: DEVICE_COLORS[ci++ % DEVICE_COLORS.length], names: new Set() }; } deviceMap[e.device_id].count++; deviceMap[e.device_id].names.add(e.player_name); });
  const repeatDevices = {}; for (const [d, i] of Object.entries(deviceMap)) { if (i.count > 1) repeatDevices[d] = i; }
  return (
    <div style={{ padding: "24px 16px", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: COLORS.purple, letterSpacing: 3, marginBottom: 4 }}>LOBBY {lobbyCode}</div>
        <h2 style={{ fontSize: 26, fontWeight: 900, margin: 0, background: `linear-gradient(135deg, ${COLORS.white}, ${COLORS.purple})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>LIVE LEADERBOARD</h2>
      </div>
      <div style={{ background: COLORS.panel, borderRadius: 10, padding: "8px 14px", marginBottom: 16, textAlign: "center" }}>
        <span style={{ fontSize: 13, color: COLORS.grayLight }}>{entries.length} score{entries.length !== 1 ? "s" : ""} submitted</span>
      </div>
      {loading ? <div style={{ textAlign: "center", color: COLORS.gray, padding: 40 }}>Loading...</div>
      : entries.length === 0 ? <div style={{ textAlign: "center", color: COLORS.gray, padding: 40 }}>Waiting for players...</div>
      : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{entries.map((entry, i) => {
          const isMe = entry.player_name === playerName;
          const rank = i === 0 ? 1 : entries[i - 1].total === entry.total ? (entries.findIndex(e => e.total === entry.total)) + 1 : i + 1;
          const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
          const repeat = entry.device_id && repeatDevices[entry.device_id];
          const bc = repeat ? repeat.color : null;
          let pn = 0; if (repeat) { let s = 0; for (let j = 0; j <= i; j++) { if (entries[j].device_id === entry.device_id) s++; } pn = s; }
          const diffBadge = entry.difficulty ? DIFFICULTY[entry.difficulty] : DIFFICULTY.normal;
          return (
            <div key={entry.id} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: isMe ? `${COLORS.purple}15` : i % 2 === 0 ? COLORS.panel : COLORS.bg, border: isMe ? `1px solid ${COLORS.purple}44` : repeat ? `1px solid ${bc}33` : "1px solid transparent" }}>
              <div style={{ width: 32, fontSize: medal ? 20 : 14, color: COLORS.grayDark, fontWeight: 700, textAlign: "center" }}>{medal || rank}</div>
              <div style={{ flex: 1, marginLeft: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isMe ? COLORS.purple : COLORS.white }}>{entry.player_name}</span>
                  {repeat && <span style={{ fontSize: 9, fontWeight: 700, color: bc, background: `${bc}22`, padding: "1px 6px", borderRadius: 8 }}>x{pn}</span>}
                  {repeat && repeat.names.size > 1 && <span style={{ fontSize: 9, color: bc, opacity: 0.7 }}>= {[...repeat.names].find(n => n !== entry.player_name)}</span>}
                  {diffBadge && <span style={{ fontSize: 9, fontWeight: 700, color: diffBadge.color, background: `${diffBadge.color}22`, padding: "1px 6px", borderRadius: 8 }}>{diffBadge.label}</span>}
                </div>
                <div style={{ fontSize: 10, color: COLORS.grayDark, marginTop: 2 }}>
                  ⚡{entry.reaction} 🎯{entry.aim} 🧠{entry.pattern}
                  {diffBadge && diffBadge.multiplier !== 1 && <span style={{ color: diffBadge.color, marginLeft: 4 }}>({entry.reaction + entry.aim + entry.pattern} × {diffBadge.multiplier})</span>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: i < 3 ? COLORS.purple : COLORS.grayLight }}>{entry.total}</div>
                {repeat && <div style={{ width: 8, height: 8, borderRadius: "50%", background: bc, margin: "4px 0 0 auto" }} />}
              </div>
            </div>
          );
        })}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button onClick={onBack} style={{ flex: 1, background: COLORS.panel, color: COLORS.grayLight, border: "none", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>HOME</button>
        <button onClick={onPlayAgain} style={{ flex: 1, background: COLORS.purple, color: COLORS.white, border: "none", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>PLAY AGAIN</button>
      </div>
    </div>
  );
}

// ==================== TEST INTRO ====================
function TestIntro({ num, title, desc, icon, color, difficulty, onStart }) {
  const cfg = DIFFICULTY[difficulty];
  return (
    <div style={{ padding: "60px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 12, color: COLORS.grayDark, letterSpacing: 3, marginBottom: 8 }}>TEST {num} OF 3</div>
      <div style={{ fontSize: 56, marginBottom: 12 }}>{icon}</div>
      <h2 style={{ fontSize: 28, fontWeight: 900, color, marginBottom: 12 }}>{title}</h2>
      <p style={{ color: COLORS.grayLight, fontSize: 15, lineHeight: 1.6, marginBottom: 16, maxWidth: 320, margin: "0 auto 16px" }}>{desc}</p>
      {cfg && <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color, marginBottom: 24 }}>{cfg.label} MODE ({cfg.multiplier}x)</div>}
      <button onClick={onStart} style={{ background: color, color: COLORS.bg, border: "none", borderRadius: 12, padding: "16px 40px", fontSize: 18, fontWeight: 800, cursor: "pointer" }}>START TEST →</button>
    </div>
  );
}

// ==================== TEST 1: REACTION TIME ====================
function ReactionTest({ difficulty, onComplete }) {
  const [phase, setPhase] = useState("waiting");
  const [startTime, setStartTime] = useState(0);
  const [result, setResult] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState([]);
  const timerRef = useRef(null);
  const ATTEMPTS = 3;
  const maxDelay = difficulty?.reaction?.maxDelay || 4500;

  useEffect(() => {
    if (phase === "ready") {
      const delay = 1500 + Math.random() * (maxDelay - 1500);
      timerRef.current = setTimeout(() => { setPhase("go"); setStartTime(Date.now()); }, delay);
    }
    return () => clearTimeout(timerRef.current);
  }, [phase, maxDelay]);

  const handleTap = () => {
    if (phase === "waiting") setPhase("ready");
    else if (phase === "ready") { clearTimeout(timerRef.current); setPhase("early"); }
    else if (phase === "go") { const ms = Date.now() - startTime; setResult(ms); setResults(prev => [...prev, ms]); setPhase("result"); }
    else if (phase === "early") setPhase("ready");
    else if (phase === "result") {
      const next = attempt + 1;
      if (next >= ATTEMPTS) { const best = Math.min(...results, result); onComplete(Math.max(0, Math.round((500 - best) * 2))); }
      else { setAttempt(next); setPhase("ready"); }
    }
  };

  const bgColor = phase === "waiting" ? COLORS.panel : phase === "ready" ? COLORS.red : phase === "go" ? COLORS.green : phase === "early" ? COLORS.orange : COLORS.panel;
  return (
    <div onClick={handleTap} style={{ minHeight: "100vh", background: bgColor, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 24, cursor: "pointer", transition: "background 0.15s", userSelect: "none" }}>
      {phase === "waiting" && <><div style={{ fontSize: 14, color: COLORS.cyan, letterSpacing: 2, marginBottom: 8 }}>ATTEMPT {attempt + 1} / {ATTEMPTS}</div><div style={{ fontSize: 22, fontWeight: 700 }}>Tap anywhere to begin</div></>}
      {phase === "ready" && <><div style={{ fontSize: 28, fontWeight: 900, color: COLORS.white }}>WAIT...</div><div style={{ fontSize: 14, color: "#ffffff99", marginTop: 8 }}>Tap when it turns GREEN</div></>}
      {phase === "go" && <div style={{ fontSize: 48, fontWeight: 900, color: COLORS.bg }}>TAP NOW!</div>}
      {phase === "early" && <><div style={{ fontSize: 28, fontWeight: 900, color: COLORS.bg }}>TOO EARLY!</div><div style={{ fontSize: 14, color: "#00000088", marginTop: 8 }}>Tap to try again</div></>}
      {phase === "result" && <><div style={{ fontSize: 14, color: COLORS.cyan, letterSpacing: 2 }}>ATTEMPT {attempt + 1} / {ATTEMPTS}</div><div style={{ fontSize: 64, fontWeight: 900, color: COLORS.cyan, marginTop: 8 }}>{result}ms</div><div style={{ fontSize: 14, color: COLORS.gray, marginTop: 8 }}>{result < 200 ? "Lightning fast!" : result < 300 ? "Great reflexes!" : result < 400 ? "Solid!" : "Keep practicing!"}</div><div style={{ fontSize: 14, color: COLORS.grayLight, marginTop: 16 }}>Tap to {attempt + 1 >= ATTEMPTS ? "continue" : "next attempt"}</div></>}
    </div>
  );
}

// ==================== TEST 2: AIM TRAINER ====================
function AimTest({ difficulty, onComplete }) {
  const aimCfg = difficulty?.aim || { targetCount: 15, minSize: 28, sizeRange: 20 };
  const TOTAL = aimCfg.targetCount;
  const [targets, setTargets] = useState([]);
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [hitEffect, setHitEffect] = useState(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    setTargets(Array.from({ length: TOTAL }, () => ({
      x: 12 + Math.random() * 70, y: 12 + Math.random() * 55,
      size: aimCfg.minSize + Math.random() * aimCfg.sizeRange,
    })));
  }, [TOTAL, aimCfg.minSize, aimCfg.sizeRange]);

  const handleHit = () => {
    const t = targets[current];
    if (startTimeRef.current === 0) startTimeRef.current = Date.now();
    setHitEffect({ x: t.x, y: t.y, key: current });
    setTimeout(() => setHitEffect(null), 300);
    if (current + 1 >= TOTAL) {
      const ms = Date.now() - startTimeRef.current;
      setElapsed(ms);
      const baseTime = TOTAL * 1500;
      const score = Math.max(50, Math.round((baseTime - ms) / (baseTime / 1000)));
      setFinalScore(score); setDone(true); onComplete(score);
    } else { setCurrent(prev => prev + 1); }
  };

  if (done) return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 24 }}>
      <div style={{ fontSize: 56 }}>🎯</div>
      <div style={{ fontSize: 48, fontWeight: 900, color: COLORS.red, marginTop: 12 }}>{(elapsed / 1000).toFixed(2)}s</div>
      <div style={{ fontSize: 14, color: COLORS.gray, marginTop: 8 }}>{TOTAL} targets cleared</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.cyan, marginTop: 16 }}>{finalScore} PTS</div>
    </div>
  );

  const t = targets[current];
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 12, left: 0, right: 0, textAlign: "center", zIndex: 10 }}>
        <span style={{ background: COLORS.panel, padding: "6px 16px", borderRadius: 20, fontSize: 13, color: COLORS.grayLight }}>{current + 1} / {TOTAL}</span>
      </div>
      {t && <div onClick={handleHit} style={{ position: "absolute", left: `${t.x}%`, top: `${t.y}%`, width: t.size, height: t.size, borderRadius: "50%", background: `radial-gradient(circle, ${COLORS.red}, #b91c1c)`, boxShadow: `0 0 20px ${COLORS.red}66`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", animation: "popIn 0.15s ease-out" }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.white }} /></div>}
      {hitEffect && <div style={{ position: "absolute", left: `${hitEffect.x}%`, top: `${hitEffect.y}%`, width: 48, height: 48, marginLeft: -8, marginTop: -8, borderRadius: "50%", border: `3px solid ${COLORS.cyan}`, animation: "hitBurst 0.3s ease-out forwards", pointerEvents: "none" }} />}
      <style>{`@keyframes popIn{from{transform:scale(0)}to{transform:scale(1)}}@keyframes hitBurst{from{transform:scale(.5);opacity:1}to{transform:scale(2);opacity:0}}`}</style>
    </div>
  );
}

// ==================== TEST 3: PATTERN MEMORY ====================
function PatternTest({ difficulty, onComplete }) {
  const patCfg = difficulty?.pattern || { startLength: 3, showSpeed: 600 };
  const [sequence, setSequence] = useState([]);
  const [playerSeq, setPlayerSeq] = useState([]);
  const [phase, setPhase] = useState("showing");
  const [round, setRound] = useState(1);
  const [activeCell, setActiveCell] = useState(-1);
  const [showIdx, setShowIdx] = useState(-1);
  const [score, setScore] = useState(0);

  const generateSequence = useCallback((len) => Array.from({ length: len }, () => Math.floor(Math.random() * 9)), []);

  useEffect(() => {
    const seqLen = patCfg.startLength + round - 1;
    const seq = generateSequence(seqLen);
    setSequence(seq); setPlayerSeq([]); setPhase("showing");
    // Build a timeline with gaps between consecutive same cells
    const timeline = [];
    for (let j = 0; j < seq.length; j++) {
      if (j > 0 && seq[j] === seq[j - 1]) {
        timeline.push(-1); // brief dark gap
      }
      timeline.push(seq[j]);
    }
    let i = 0;
    const gapSpeed = Math.round(patCfg.showSpeed * 0.35);
    const showNext = () => {
      if (i >= timeline.length) {
        setShowIdx(-1);
        setTimeout(() => setPhase("input"), 300);
        return;
      }
      const val = timeline[i];
      setShowIdx(val);
      const delay = val === -1 ? gapSpeed : patCfg.showSpeed;
      i++;
      setTimeout(showNext, delay);
    };
    const startTimer = setTimeout(showNext, 300);
    return () => clearTimeout(startTimer);
  }, [round, generateSequence, patCfg.startLength, patCfg.showSpeed]);

  const handleCellTap = (idx) => {
    if (phase !== "input") return;
    setActiveCell(idx); setTimeout(() => setActiveCell(-1), 200);
    const newSeq = [...playerSeq, idx]; setPlayerSeq(newSeq);
    if (newSeq[newSeq.length - 1] !== sequence[newSeq.length - 1]) {
      setPhase("fail"); const fs = Math.max(50, (round - 1) * 100); setScore(fs); onComplete(fs); return;
    }
    if (newSeq.length === sequence.length) { setPhase("success"); setScore(round * 100); setTimeout(() => setRound(p => p + 1), 1000); }
  };

  const gridColors = [COLORS.cyan, COLORS.red, COLORS.yellow, COLORS.green, COLORS.purple, COLORS.orange, "#EC4899", "#3B82F6", "#14B8A6"];
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 24 }}>
      <div style={{ fontSize: 12, color: COLORS.grayDark, letterSpacing: 2, marginBottom: 4 }}>ROUND {round}</div>
      <div style={{ fontSize: 14, color: phase === "showing" ? COLORS.yellow : phase === "success" ? COLORS.green : phase === "fail" ? COLORS.red : COLORS.cyan, fontWeight: 700, marginBottom: 16 }}>
        {phase === "showing" ? "WATCH THE PATTERN..." : phase === "input" ? `YOUR TURN (${playerSeq.length}/${sequence.length})` : phase === "success" ? "CORRECT!" : `WRONG — Round ${round - 1} cleared`}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, width: "min(280px, 80vw)", aspectRatio: "1/1" }}>
        {Array.from({ length: 9 }).map((_, i) => {
          const lit = showIdx === i || activeCell === i;
          return <div key={i} onClick={() => handleCellTap(i)} style={{ background: lit ? gridColors[i] : COLORS.panel, borderRadius: 12, cursor: phase === "input" ? "pointer" : "default", transition: "background 0.15s, transform 0.1s", transform: lit ? "scale(1.05)" : "scale(1)", boxShadow: lit ? `0 0 20px ${gridColors[i]}55` : "none", border: `2px solid ${lit ? gridColors[i] : COLORS.panelLight}` }} />;
        })}
      </div>
      <div style={{ marginTop: 20, fontSize: 20, fontWeight: 800, color: COLORS.purple }}>SCORE: {score}</div>
    </div>
  );
}

// ==================== RESULTS SCREEN ====================
function Results({ name, scores, difficulty, onSubmit, submitting }) {
  const mult = DIFFICULTY[difficulty]?.multiplier || 1;
  const raw = scores.reaction + scores.aim + scores.pattern;
  const total = Math.round(raw * mult);
  const canvasRef = useRef(null);

  const handleShare = () => {
    const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
    const ctx = c.getContext("2d");
    // Background
    ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, 1080, 1350);
    // Top accent
    const grad = ctx.createLinearGradient(0, 0, 1080, 0); grad.addColorStop(0, COLORS.cyan); grad.addColorStop(1, COLORS.purple);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 6);
    // Branding
    ctx.fillStyle = COLORS.cyan; ctx.font = "bold 24px 'Segoe UI', sans-serif"; ctx.textAlign = "center"; ctx.letterSpacing = "8px";
    ctx.fillText("ESPORTS COMBINE", 540, 120);
    // Name
    ctx.fillStyle = COLORS.white; ctx.font = "bold 48px 'Segoe UI', sans-serif";
    ctx.fillText(name.toUpperCase(), 540, 220);
    // Difficulty
    const dc = DIFFICULTY[difficulty]; ctx.fillStyle = dc.color; ctx.font = "bold 28px 'Segoe UI', sans-serif";
    ctx.fillText(`${dc.label} MODE (${dc.multiplier}x)`, 540, 280);
    // Total
    ctx.fillStyle = COLORS.cyan; ctx.font = "900 160px 'Segoe UI', sans-serif";
    ctx.fillText(total.toString(), 540, 500);
    ctx.fillStyle = COLORS.gray; ctx.font = "bold 28px 'Segoe UI', sans-serif";
    ctx.fillText("TOTAL SCORE", 540, 550);
    // Individual scores
    const tests = [{ icon: "⚡", label: "REACTION", val: scores.reaction, color: COLORS.cyan },
      { icon: "🎯", label: "AIM", val: scores.aim, color: COLORS.red },
      { icon: "🧠", label: "MEMORY", val: scores.pattern, color: COLORS.purple }];
    tests.forEach((t, i) => {
      const x = 180 + i * 360;
      ctx.fillStyle = COLORS.panel; roundRect(ctx, x - 140, 620, 280, 160, 20); ctx.fill();
      ctx.fillStyle = t.color; ctx.font = "900 56px 'Segoe UI', sans-serif"; ctx.fillText(t.val.toString(), x, 720);
      ctx.fillStyle = COLORS.gray; ctx.font = "bold 20px 'Segoe UI', sans-serif"; ctx.fillText(t.label, x, 760);
    });
    // Date
    ctx.fillStyle = COLORS.grayDark; ctx.font = "20px 'Segoe UI', sans-serif";
    ctx.fillText(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), 540, 880);
    // Footer
    ctx.fillStyle = COLORS.grayDark; ctx.font = "16px 'Segoe UI', sans-serif";
    ctx.fillText("BUILT BY SOPHIA NEI • ESPORTS 103", 540, 1300);

    c.toBlob(async (blob) => {
      if (navigator.share && navigator.canShare) {
        try {
          await navigator.share({ files: [new File([blob], "combine-results.png", { type: "image/png" })], title: "My Combine Results" });
          return;
        } catch {}
      }
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "combine-results.png"; a.click(); URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <div style={{ padding: "40px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 12, color: COLORS.cyan, letterSpacing: 3, marginBottom: 8 }}>COMBINE COMPLETE</div>
      <div style={{ fontSize: 56, fontWeight: 900, background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.purple})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{total}</div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 4 }}>
        {mult !== 1 && <span style={{ fontSize: 12, color: COLORS.gray }}>Raw: {raw}</span>}
        <span style={{ fontSize: 12, fontWeight: 700, color: DIFFICULTY[difficulty].color }}>{DIFFICULTY[difficulty].label} ({mult}x)</span>
      </div>
      <div style={{ fontSize: 13, color: COLORS.gray, marginBottom: 24 }}>TOTAL SCORE</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {[{ label: "Reaction", score: scores.reaction, color: COLORS.cyan, icon: "⚡" },
          { label: "Aim", score: scores.aim, color: COLORS.red, icon: "🎯" },
          { label: "Memory", score: scores.pattern, color: COLORS.purple, icon: "🧠" }].map(s => (
          <div key={s.label} style={{ flex: 1, background: COLORS.panel, borderRadius: 12, padding: "14px 8px", borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.score}</div>
            <div style={{ fontSize: 10, color: COLORS.gray }}>{s.label}</div>
          </div>
        ))}
      </div>

      <button onClick={onSubmit} disabled={submitting} style={{ background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.cyanDark})`, color: COLORS.bg, border: "none", borderRadius: 12, padding: "16px 32px", fontSize: 16, fontWeight: 800, cursor: "pointer", width: "100%", opacity: submitting ? 0.6 : 1, marginBottom: 10 }}>
        {submitting ? "SUBMITTING..." : `SUBMIT SCORE AS ${name.toUpperCase()}`}
      </button>
      <button onClick={handleShare} style={{ background: COLORS.panel, color: COLORS.grayLight, border: `1px solid ${COLORS.grayDark}44`, borderRadius: 12, padding: "12px 32px", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%" }}>
        SHARE RESULTS
      </button>
    </div>
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// ==================== SOLO LEADERBOARD ====================
function Leaderboard({ data, playerName, onBack, onPlayAgain }) {
  return (
    <div style={{ padding: "24px 16px", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: COLORS.cyan, letterSpacing: 3, marginBottom: 4 }}>ESPORTS COMBINE</div>
        <h2 style={{ fontSize: 26, fontWeight: 900, margin: 0, background: `linear-gradient(135deg, ${COLORS.white}, ${COLORS.cyan})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>LEADERBOARD</h2>
      </div>
      {data.length === 0 ? <div style={{ textAlign: "center", color: COLORS.gray, padding: 40 }}>No scores yet. Be the first!</div>
      : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{data.map((entry, i) => {
          const isMe = entry.player_name === playerName;
          const rank = i === 0 ? 1 : data[i - 1].total === entry.total ? (data.findIndex(e => e.total === entry.total)) + 1 : i + 1;
          const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
          const diffBadge = entry.difficulty ? DIFFICULTY[entry.difficulty] : DIFFICULTY.normal;
          return (
            <div key={entry.id} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: isMe ? `${COLORS.cyan}15` : i % 2 === 0 ? COLORS.panel : COLORS.bg, border: isMe ? `1px solid ${COLORS.cyan}44` : "1px solid transparent" }}>
              <div style={{ width: 32, fontSize: medal ? 20 : 14, color: COLORS.grayDark, fontWeight: 700, textAlign: "center" }}>{medal || rank}</div>
              <div style={{ flex: 1, marginLeft: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isMe ? COLORS.cyan : COLORS.white }}>{entry.player_name}</span>
                  {diffBadge && <span style={{ fontSize: 9, fontWeight: 700, color: diffBadge.color, background: `${diffBadge.color}22`, padding: "1px 6px", borderRadius: 8 }}>{diffBadge.label}</span>}
                </div>
                <div style={{ fontSize: 10, color: COLORS.grayDark, marginTop: 2 }}>
                  ⚡{entry.reaction} 🎯{entry.aim} 🧠{entry.pattern}
                  {diffBadge && diffBadge.multiplier !== 1 && <span style={{ color: diffBadge.color, marginLeft: 4 }}>({entry.reaction + entry.aim + entry.pattern} × {diffBadge.multiplier})</span>}
                  <span style={{ marginLeft: 4 }}>· {formatDate(entry.created_at)}</span>
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: i < 3 ? COLORS.cyan : COLORS.grayLight }}>{entry.total}</div>
            </div>
          );
        })}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button onClick={onBack} style={{ flex: 1, background: COLORS.panel, color: COLORS.grayLight, border: "none", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>HOME</button>
        <button onClick={onPlayAgain} style={{ flex: 1, background: COLORS.cyan, color: COLORS.bg, border: "none", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>PLAY AGAIN</button>
      </div>
      <div style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: COLORS.grayDark }}>BUILT BY SOPHIA NEI • ESPORTS 103</div>
    </div>
  );
}
