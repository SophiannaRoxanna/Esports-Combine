import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = {
  bg: "#0A0E17", bgLight: "#111827", panel: "#1A1F2E", panelLight: "#232B3E",
  cyan: "#00DCF0", cyanDark: "#0097A7", white: "#FFFFFF", gray: "#9CA3AF",
  grayLight: "#D1D5DB", grayDark: "#4B5563", red: "#EF4444", green: "#10B981",
  yellow: "#F59E0B", purple: "#8B5CF6", orange: "#F97316",
};

// ==================== STORAGE HELPERS ====================
async function saveScore(name, scores) {
  try {
    const entry = { name, scores, total: scores.reaction + scores.aim + scores.pattern, ts: Date.now() };
    const existing = await loadLeaderboard();
    existing.push(entry);
    existing.sort((a, b) => b.total - a.total);
    localStorage.setItem("combine-leaderboard", JSON.stringify(existing.slice(0, 50)));
    return entry;
  } catch (e) { console.error(e); return null; }
}
async function loadLeaderboard() {
  try {
    const r = localStorage.getItem("combine-leaderboard");
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

// ==================== MAIN APP ====================
export default function GardenCityEsportsCombine() {
  const [screen, setScreen] = useState("landing");
  const [playerName, setPlayerName] = useState("");
  const [scores, setScores] = useState({ reaction: 0, aim: 0, pattern: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadLeaderboard().then(setLeaderboard); }, []);

  const updateScore = (test, score) => setScores(prev => ({ ...prev, [test]: score }));

  const submitScore = async () => {
    if (!playerName.trim() || submitting) return;
    setSubmitting(true);
    await saveScore(playerName.trim(), scores);
    const lb = await loadLeaderboard();
    setLeaderboard(lb);
    setSubmitting(false);
    setScreen("leaderboard");
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.white, fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 480, margin: "0 auto", position: "relative", overflow: "hidden" }}>
      {/* Accent bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.purple})`, position: "sticky", top: 0, zIndex: 99 }} />

      {screen === "landing" && <Landing onStart={() => setScreen("name")} leaderboard={leaderboard} onShowLB={() => setScreen("leaderboard")} />}
      {screen === "name" && <NameEntry name={playerName} setName={setPlayerName} onNext={() => playerName.trim() && setScreen("test1-intro")} />}
      {screen === "test1-intro" && <TestIntro num={1} title="REACTION TIME" desc="Wait for the screen to turn green, then tap as fast as you can. Don't tap early!" icon="⚡" color={COLORS.cyan} onStart={() => setScreen("test1")} />}
      {screen === "test1" && <ReactionTest onComplete={ms => { updateScore("reaction", ms); setScreen("test2-intro"); }} />}
      {screen === "test2-intro" && <TestIntro num={2} title="AIM TRAINER" desc="Tap each target as fast as you can. 15 targets. Speed and accuracy." icon="🎯" color={COLORS.red} onStart={() => setScreen("test2")} />}
      {screen === "test2" && <AimTest onComplete={s => { updateScore("aim", s); setTimeout(() => setScreen("test3-intro"), 1500); }} />}
      {screen === "test3-intro" && <TestIntro num={3} title="PATTERN MEMORY" desc="Watch the sequence, then repeat it. Gets harder each round. How far can you go?" icon="🧠" color={COLORS.purple} onStart={() => setScreen("test3")} />}
      {screen === "test3" && <PatternTest onComplete={s => { updateScore("pattern", s); setTimeout(() => setScreen("results"), 1500); }} />}
      {screen === "results" && <Results name={playerName} scores={scores} onSubmit={submitScore} submitting={submitting} />}
      {screen === "leaderboard" && <Leaderboard data={leaderboard} playerName={playerName} onBack={() => setScreen("landing")} onPlayAgain={() => { setScores({ reaction: 0, aim: 0, pattern: 0 }); setScreen("test1-intro"); }} />}
    </div>
  );
}

// ==================== LANDING SCREEN ====================
function Landing({ onStart, leaderboard, onShowLB }) {
  return (
    <div style={{ padding: "40px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 11, color: COLORS.cyan, letterSpacing: 4, fontWeight: 700, marginBottom: 8 }}>GARDEN CITY ESPORTS</div>
      <h1 style={{ fontSize: 36, fontWeight: 900, margin: "0 0 4px", lineHeight: 1.1, background: `linear-gradient(135deg, ${COLORS.white}, ${COLORS.cyan})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>GARDEN CITY ESPORTS<br/>COMBINE</h1>
      <p style={{ color: COLORS.gray, fontSize: 14, margin: "12px 0 32px", lineHeight: 1.5 }}>3 tests. Reaction. Aim. Memory.<br/>Compete for the top score.</p>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>
        {[{ icon: "⚡", label: "Reaction", color: COLORS.cyan }, { icon: "🎯", label: "Aim", color: COLORS.red }, { icon: "🧠", label: "Memory", color: COLORS.purple }].map(t => (
          <div key={t.label} style={{ background: COLORS.panel, borderRadius: 12, padding: "14px 16px", flex: 1, borderTop: `3px solid ${t.color}` }}>
            <div style={{ fontSize: 24 }}>{t.icon}</div>
            <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 4 }}>{t.label}</div>
          </div>
        ))}
      </div>

      <button onClick={onStart} style={{ background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.cyanDark})`, color: COLORS.bg, border: "none", borderRadius: 12, padding: "16px 32px", fontSize: 18, fontWeight: 800, cursor: "pointer", width: "100%", marginBottom: 12, letterSpacing: 1 }}>
        START COMBINE
      </button>

      {leaderboard.length > 0 && (
        <button onClick={onShowLB} style={{ background: "transparent", color: COLORS.cyan, border: `1px solid ${COLORS.cyan}33`, borderRadius: 12, padding: "12px 24px", fontSize: 14, cursor: "pointer", width: "100%" }}>
          View Leaderboard ({leaderboard.length} players)
        </button>
      )}

      <div style={{ marginTop: 32, fontSize: 10, color: COLORS.grayDark }}>ESPORTS 103 • BUILT BY SOPHIA NEI</div>
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
      <input
        value={name} onChange={e => setName(e.target.value)} placeholder="Your gamer tag..."
        maxLength={20} autoFocus
        style={{ background: COLORS.panel, border: `2px solid ${COLORS.cyan}44`, borderRadius: 12, padding: "16px 20px", fontSize: 18, color: COLORS.white, textAlign: "center", width: "100%", boxSizing: "border-box", outline: "none", fontWeight: 600 }}
        onKeyDown={e => e.key === "Enter" && onNext()}
      />
      <button onClick={onNext} disabled={!name.trim()} style={{ marginTop: 16, background: name.trim() ? COLORS.cyan : COLORS.grayDark, color: COLORS.bg, border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 16, fontWeight: 700, cursor: name.trim() ? "pointer" : "default", width: "100%", opacity: name.trim() ? 1 : 0.5 }}>
        LET'S GO →
      </button>
    </div>
  );
}

// ==================== TEST INTRO ====================
function TestIntro({ num, title, desc, icon, color, onStart }) {
  return (
    <div style={{ padding: "60px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 12, color: COLORS.grayDark, letterSpacing: 3, marginBottom: 8 }}>TEST {num} OF 3</div>
      <div style={{ fontSize: 56, marginBottom: 12 }}>{icon}</div>
      <h2 style={{ fontSize: 28, fontWeight: 900, color, marginBottom: 12 }}>{title}</h2>
      <p style={{ color: COLORS.grayLight, fontSize: 15, lineHeight: 1.6, marginBottom: 32, maxWidth: 320, margin: "0 auto 32px" }}>{desc}</p>
      <button onClick={onStart} style={{ background: color, color: COLORS.bg, border: "none", borderRadius: 12, padding: "16px 40px", fontSize: 18, fontWeight: 800, cursor: "pointer" }}>
        START TEST →
      </button>
    </div>
  );
}

// ==================== TEST 1: REACTION TIME ====================
function ReactionTest({ onComplete }) {
  const [phase, setPhase] = useState("waiting");
  const [startTime, setStartTime] = useState(0);
  const [result, setResult] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState([]);
  const timerRef = useRef(null);
  const ATTEMPTS = 3;

  useEffect(() => {
    if (phase === "ready") {
      const delay = 1500 + Math.random() * 3000;
      timerRef.current = setTimeout(() => { setPhase("go"); setStartTime(Date.now()); }, delay);
    }
    return () => clearTimeout(timerRef.current);
  }, [phase]);

  const handleTap = () => {
    if (phase === "waiting") { setPhase("ready"); }
    else if (phase === "ready") { clearTimeout(timerRef.current); setPhase("early"); }
    else if (phase === "go") {
      const ms = Date.now() - startTime;
      setResult(ms);
      setResults(prev => [...prev, ms]);
      setPhase("result");
    }
    else if (phase === "early") { setPhase("ready"); }
    else if (phase === "result") {
      const nextAttempt = attempt + 1;
      if (nextAttempt >= ATTEMPTS) {
        const best = Math.min(...results, result);
        const score = Math.max(0, Math.round((500 - best) * 2));
        onComplete(score);
      } else {
        setAttempt(nextAttempt);
        setPhase("ready");
      }
    }
  };

  const bgColor = phase === "waiting" ? COLORS.panel : phase === "ready" ? COLORS.red : phase === "go" ? COLORS.green : phase === "early" ? COLORS.orange : COLORS.panel;

  return (
    <div onClick={handleTap} style={{ minHeight: "100vh", background: bgColor, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 24, cursor: "pointer", transition: "background 0.15s", userSelect: "none" }}>
      {phase === "waiting" && <>
        <div style={{ fontSize: 14, color: COLORS.cyan, letterSpacing: 2, marginBottom: 8 }}>ATTEMPT {attempt + 1} / {ATTEMPTS}</div>
        <div style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }}>Tap anywhere to begin</div>
      </>}
      {phase === "ready" && <>
        <div style={{ fontSize: 28, fontWeight: 900, textAlign: "center", color: COLORS.white }}>WAIT...</div>
        <div style={{ fontSize: 14, color: "#ffffff99", marginTop: 8 }}>Tap when it turns GREEN</div>
      </>}
      {phase === "go" && <>
        <div style={{ fontSize: 48, fontWeight: 900, color: COLORS.bg }}>TAP NOW!</div>
      </>}
      {phase === "early" && <>
        <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.bg }}>TOO EARLY!</div>
        <div style={{ fontSize: 14, color: "#00000088", marginTop: 8 }}>Tap to try again</div>
      </>}
      {phase === "result" && <>
        <div style={{ fontSize: 14, color: COLORS.cyan, letterSpacing: 2 }}>ATTEMPT {attempt + 1} / {ATTEMPTS}</div>
        <div style={{ fontSize: 64, fontWeight: 900, color: COLORS.cyan, marginTop: 8 }}>{result}ms</div>
        <div style={{ fontSize: 14, color: COLORS.gray, marginTop: 8 }}>{result < 200 ? "Lightning fast!" : result < 300 ? "Great reflexes!" : result < 400 ? "Solid!" : "Keep practicing!"}</div>
        <div style={{ fontSize: 14, color: COLORS.grayLight, marginTop: 16 }}>Tap to {attempt + 1 >= ATTEMPTS ? "continue" : "next attempt"}</div>
      </>}
    </div>
  );
}

// ==================== TEST 2: AIM TRAINER ====================
function AimTest({ onComplete }) {
  const [targets, setTargets] = useState([]);
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [hitEffect, setHitEffect] = useState(null);
  const startTimeRef = useRef(0);
  const TOTAL = 15;

  const generateTarget = () => ({
    x: 12 + Math.random() * 70,
    y: 12 + Math.random() * 55,
    size: 28 + Math.random() * 20,
  });

  useEffect(() => {
    const t = Array.from({ length: TOTAL }, generateTarget);
    setTargets(t);
  }, []);

  const handleHit = () => {
    const t = targets[current];
    if (startTimeRef.current === 0) startTimeRef.current = Date.now();

    setHitEffect({ x: t.x, y: t.y, key: current });
    setTimeout(() => setHitEffect(null), 300);

    if (current + 1 >= TOTAL) {
      const ms = Date.now() - startTimeRef.current;
      setElapsed(ms);
      const score = Math.max(50, Math.round((25000 - ms) / 20));
      setFinalScore(score);
      setDone(true);
      onComplete(score);
    } else {
      setCurrent(prev => prev + 1);
    }
  };

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <div style={{ fontSize: 56 }}>🎯</div>
        <div style={{ fontSize: 48, fontWeight: 900, color: COLORS.red, marginTop: 12 }}>{(elapsed / 1000).toFixed(2)}s</div>
        <div style={{ fontSize: 14, color: COLORS.gray, marginTop: 8 }}>{TOTAL} targets cleared</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.cyan, marginTop: 16 }}>{finalScore} PTS</div>
      </div>
    );
  }

  const t = targets[current];
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 12, left: 0, right: 0, textAlign: "center", zIndex: 10 }}>
        <span style={{ background: COLORS.panel, padding: "6px 16px", borderRadius: 20, fontSize: 13, color: COLORS.grayLight }}>{current + 1} / {TOTAL}</span>
      </div>
      {t && (
        <div
          onClick={handleHit}
          style={{
            position: "absolute", left: `${t.x}%`, top: `${t.y}%`, width: t.size, height: t.size,
            borderRadius: "50%", background: `radial-gradient(circle, ${COLORS.red}, #b91c1c)`,
            boxShadow: `0 0 20px ${COLORS.red}66`, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "popIn 0.15s ease-out",
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.white }} />
        </div>
      )}
      {hitEffect && (
        <div style={{
          position: "absolute", left: `${hitEffect.x}%`, top: `${hitEffect.y}%`,
          width: 48, height: 48, marginLeft: -8, marginTop: -8,
          borderRadius: "50%", border: `3px solid ${COLORS.cyan}`,
          animation: "hitBurst 0.3s ease-out forwards", pointerEvents: "none",
        }} />
      )}
      <style>{`
        @keyframes popIn { from { transform: scale(0); } to { transform: scale(1); } }
        @keyframes hitBurst { from { transform: scale(0.5); opacity: 1; } to { transform: scale(2); opacity: 0; } }
      `}</style>
    </div>
  );
}

// ==================== TEST 3: PATTERN MEMORY ====================
function PatternTest({ onComplete }) {
  const [sequence, setSequence] = useState([]);
  const [playerSeq, setPlayerSeq] = useState([]);
  const [phase, setPhase] = useState("showing");
  const [round, setRound] = useState(1);
  const [activeCell, setActiveCell] = useState(-1);
  const [showIdx, setShowIdx] = useState(-1);
  const [score, setScore] = useState(0);

  const generateSequence = useCallback((len) => {
    const s = [];
    for (let i = 0; i < len; i++) s.push(Math.floor(Math.random() * 9));
    return s;
  }, []);

  useEffect(() => {
    const seq = generateSequence(round + 2);
    setSequence(seq);
    setPlayerSeq([]);
    setPhase("showing");
    let i = 0;
    const interval = setInterval(() => {
      if (i < seq.length) { setShowIdx(seq[i]); i++; }
      else { setShowIdx(-1); clearInterval(interval); setTimeout(() => setPhase("input"), 300); }
    }, 600);
    return () => clearInterval(interval);
  }, [round, generateSequence]);

  const handleCellTap = (idx) => {
    if (phase !== "input") return;
    setActiveCell(idx);
    setTimeout(() => setActiveCell(-1), 200);

    const newSeq = [...playerSeq, idx];
    setPlayerSeq(newSeq);

    if (newSeq[newSeq.length - 1] !== sequence[newSeq.length - 1]) {
      setPhase("fail");
      const finalScore = Math.max(50, (round - 1) * 100);
      setScore(finalScore);
      onComplete(finalScore);
      return;
    }

    if (newSeq.length === sequence.length) {
      setPhase("success");
      const newScore = round * 100;
      setScore(newScore);
      setTimeout(() => { setRound(prev => prev + 1); }, 1000);
    }
  };

  const gridColors = [COLORS.cyan, COLORS.red, COLORS.yellow, COLORS.green, COLORS.purple, COLORS.orange, "#EC4899", "#3B82F6", "#14B8A6"];

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 24 }}>
      <div style={{ fontSize: 12, color: COLORS.grayDark, letterSpacing: 2, marginBottom: 4 }}>ROUND {round}</div>
      <div style={{ fontSize: 14, color: phase === "showing" ? COLORS.yellow : phase === "success" ? COLORS.green : phase === "fail" ? COLORS.red : COLORS.cyan, fontWeight: 700, marginBottom: 16 }}>
        {phase === "showing" ? "WATCH THE PATTERN..." : phase === "input" ? `YOUR TURN (${playerSeq.length}/${sequence.length})` : phase === "success" ? "CORRECT! ✓" : `WRONG — Round ${round - 1} cleared`}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, width: "min(280px, 80vw)", aspectRatio: "1/1" }}>
        {Array.from({ length: 9 }).map((_, i) => {
          const isShowing = showIdx === i;
          const isActive = activeCell === i;
          const lit = isShowing || isActive;
          return (
            <div
              key={i} onClick={() => handleCellTap(i)}
              style={{
                background: lit ? gridColors[i] : COLORS.panel,
                borderRadius: 12, cursor: phase === "input" ? "pointer" : "default",
                transition: "background 0.15s, transform 0.1s",
                transform: lit ? "scale(1.05)" : "scale(1)",
                boxShadow: lit ? `0 0 20px ${gridColors[i]}55` : "none",
                border: `2px solid ${lit ? gridColors[i] : COLORS.panelLight || "#232B3E"}`,
              }}
            />
          );
        })}
      </div>

      <div style={{ marginTop: 20, fontSize: 20, fontWeight: 800, color: COLORS.purple }}>SCORE: {score}</div>
    </div>
  );
}

// ==================== RESULTS SCREEN ====================
function Results({ name, scores, onSubmit, submitting }) {
  const total = scores.reaction + scores.aim + scores.pattern;
  return (
    <div style={{ padding: "40px 24px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 12, color: COLORS.cyan, letterSpacing: 3, marginBottom: 8 }}>COMBINE COMPLETE</div>
      <div style={{ fontSize: 56, fontWeight: 900, background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.purple})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{total}</div>
      <div style={{ fontSize: 13, color: COLORS.gray, marginBottom: 24 }}>TOTAL SCORE</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
        {[
          { label: "Reaction", score: scores.reaction, color: COLORS.cyan, icon: "⚡" },
          { label: "Aim", score: scores.aim, color: COLORS.red, icon: "🎯" },
          { label: "Memory", score: scores.pattern, color: COLORS.purple, icon: "🧠" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: COLORS.panel, borderRadius: 12, padding: "14px 8px", borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.score}</div>
            <div style={{ fontSize: 10, color: COLORS.gray }}>{s.label}</div>
          </div>
        ))}
      </div>

      <button onClick={onSubmit} disabled={submitting} style={{ background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.cyanDark})`, color: COLORS.bg, border: "none", borderRadius: 12, padding: "16px 32px", fontSize: 16, fontWeight: 800, cursor: "pointer", width: "100%", opacity: submitting ? 0.6 : 1 }}>
        {submitting ? "SUBMITTING..." : `SUBMIT SCORE AS ${name.toUpperCase()}`}
      </button>
    </div>
  );
}

// ==================== LEADERBOARD ====================
function Leaderboard({ data, playerName, onBack, onPlayAgain }) {
  return (
    <div style={{ padding: "24px 16px", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: COLORS.cyan, letterSpacing: 3, marginBottom: 4 }}>GARDEN CITY ESPORTS COMBINE</div>
        <h2 style={{ fontSize: 26, fontWeight: 900, margin: 0, background: `linear-gradient(135deg, ${COLORS.white}, ${COLORS.cyan})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>LEADERBOARD</h2>
      </div>

      {data.length === 0 ? (
        <div style={{ textAlign: "center", color: COLORS.gray, padding: 40 }}>No scores yet. Be the first!</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.map((entry, i) => {
            const isMe = entry.name === playerName;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", padding: "10px 14px", borderRadius: 10,
                background: isMe ? `${COLORS.cyan}15` : i % 2 === 0 ? COLORS.panel : COLORS.bg,
                border: isMe ? `1px solid ${COLORS.cyan}44` : "1px solid transparent",
              }}>
                <div style={{ width: 32, fontSize: medal ? 20 : 14, color: COLORS.grayDark, fontWeight: 700, textAlign: "center" }}>
                  {medal || (i + 1)}
                </div>
                <div style={{ flex: 1, marginLeft: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isMe ? COLORS.cyan : COLORS.white }}>{entry.name}</div>
                  <div style={{ fontSize: 10, color: COLORS.grayDark, marginTop: 2 }}>
                    ⚡{entry.scores.reaction} 🎯{entry.scores.aim} 🧠{entry.scores.pattern}
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: i < 3 ? COLORS.cyan : COLORS.grayLight }}>{entry.total}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button onClick={onBack} style={{ flex: 1, background: COLORS.panel, color: COLORS.grayLight, border: "none", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>HOME</button>
        <button onClick={onPlayAgain} style={{ flex: 1, background: COLORS.cyan, color: COLORS.bg, border: "none", borderRadius: 10, padding: "12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>PLAY AGAIN</button>
      </div>

      <div style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: COLORS.grayDark }}>BUILT BY SOPHIA NEI • ESPORTS 103</div>
    </div>
  );
}
