import React, {
  useEffect,
  useMemo,
  useState,
  Component,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import type {
  Analysis,
  Checkpoint,
  Progress,
  SymbolNode,
} from "../shared/model.ts";
import { compare, blast } from "../analyzer/temporal.ts";
import { explain, cochanges } from "../analyzer/evidence.ts";
import { api, auth } from "./api.ts";
import "./style.css";
class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main>
        <h1>That view could not be rendered.</h1>
        <p>Your repository is safe. Refresh to reconnect.</p>
        <button onClick={() => location.reload()}>Reconnect</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [data, setData] = useState<Analysis>();
  const [progress, setProgress] = useState<Progress>();
  const [failure, setFailure] = useState("");
  const [connected, setConnected] = useState(true);
  const [ai, setAi] = useState(false);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState("Architecture");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<SymbolNode>();
  const [playing, setPlaying] = useState(false);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(1);
  const [diffText, setDiff] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout>;
    const load = async () => {
      const a = await api<Analysis>("/api/analysis");
      setData(a);
      setIndex(a.checkpoints.length - 1);
      setTo(a.checkpoints.length - 1);
    };
    async function connect() {
      try {
        const s = await api<{ ready: boolean; error: string; ai: boolean }>(
          "/api/status",
        );
        setAi(s.ai);
        if (s.ready) await load();
        if (s.error) setFailure(s.error);
        const r = await fetch("/api/events", {
          headers: auth,
          signal: controller.signal,
        });
        if (!r.ok)
          throw Error("Open the private session link printed by the CLI.");
        setConnected(true);
        const reader = r.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) throw Error("Disconnected");
          buffer += decoder.decode(value, { stream: true });
          let end;
          while ((end = buffer.indexOf("\n\n")) >= 0) {
            const message = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            if (message.startsWith("data: ")) {
              const event = JSON.parse(message.slice(6));
              if (event.type === "progress") setProgress(event.data);
              if (event.type === "ready") await load();
              if (event.type === "error") setFailure(event.data);
            }
          }
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        setConnected(false);
        if (!data) setFailure((e as Error).message);
        retry = setTimeout(connect, 2500);
      }
    }
    void connect();
    return () => {
      controller.abort();
      clearTimeout(retry);
    };
  }, []);
  useEffect(() => {
    if (!playing || !data) return;
    const t = setInterval(
      () =>
        setIndex((i) => {
          if (i >= data.checkpoints.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      1300,
    );
    return () => clearInterval(t);
  }, [playing, data]);
  const cp = data?.checkpoints[index];
  const nodes = useMemo(
    () =>
      cp?.files
        .flatMap((f) => f.symbols)
        .filter(
          (s) =>
            (filter === "all" || s.kind === filter) &&
            (s.name + " " + s.path).toLowerCase().includes(query.toLowerCase()),
        ) || [],
    [cp, filter, query],
  );
  if (!data || !cp)
    return (
      <div className="loading">
        <Brand />
        <div className="loading-orbit">◷</div>
        <p className="eyebrow">YOUR REPOSITORY, THROUGH TIME</p>
        <h1>
          {failure && !connected
            ? "Waiting for your local session"
            : progress?.stage || "Connecting to Chronicle"}
        </h1>
        <p>
          {failure && !connected
            ? failure
            : progress?.detail || "All analysis happens on this computer."}
        </p>
        <progress
          aria-label="Analysis progress"
          value={progress?.completed || 0}
          max={progress?.total || 1}
        />
        <small>No uploads. No telemetry. Just your Git history.</small>
      </div>
    );
  const change = index ? compare(data.checkpoints[index - 1], cp) : undefined;
  return (
    <div className="app">
      <header>
        <Brand />
        <span className="project">
          ⌘ <strong>{data.name}</strong>
          <span className="badge">{data.demo ? "DEMO" : "LOCAL REPO"}</span>
        </span>
        <span className="private">
          <i />
          Processed locally
        </span>
        <span className={"connection " + (!connected ? "offline" : "")}>
          {connected ? "● Connected" : "○ Reconnecting"}
        </span>
        <a
          href="https://github.com/pseelam02/chronicle"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </header>
      <aside className="sidebar">
        <p className="eyebrow">WORKSPACE</p>
        {["Architecture", "Compare", "Blast radius"].map((m, i) => (
          <button
            key={m}
            className={mode === m ? "nav active" : "nav"}
            onClick={() => setMode(m)}
          >
            <span>{["▦", "⇄", "◎"][i]}</span>
            {m}
          </button>
        ))}
        <div className="side-section">
          <p className="eyebrow">REPOSITORY</p>
          <p>
            <span>Branch / ref</span>
            <code>{data.ref}</code>
          </p>
          <p>
            <span>HEAD</span>
            <code>{data.head.slice(0, 7)}</code>
          </p>
          <p>
            <span>Commits</span>
            <strong>{data.commits.length.toLocaleString()}</strong>
          </p>
          <p>
            <span>Checkpoints</span>
            <strong>{data.checkpoints.length}</strong>
          </p>
        </div>
        <div className="side-bottom">
          <div className="local-icon">⌂</div>
          <strong>Your code stays yours.</strong>
          <p>Git history and source analysis never leave this computer.</p>
          <small>Chronicle 0.1.0</small>
        </div>
      </aside>
      <main>
        <div className="title-row">
          <div>
            <p className="eyebrow">EXPLORE THE SHAPE OF YOUR CODE</p>
            <h1>
              {mode === "Architecture"
                ? "Every codebase has a story."
                : mode === "Compare"
                  ? "See what changed."
                  : "Follow the ripple."}
            </h1>
            <p className="subtitle">
              {mode === "Architecture"
                ? "Travel through its architecture. Understand how it got here."
                : mode === "Compare"
                  ? "Compare snapshots, trace symbol changes, and inspect the evidence."
                  : "Explore potential impact through the dependencies your code reveals."}
            </p>
          </div>
          <span className="snapshot-label">◉ {cp.label}</span>
        </div>
        <div className="metrics">
          <Metric label="TYPESCRIPT FILES" value={cp.files.length} />
          <Metric
            label="SYMBOLS"
            value={cp.files.reduce((n, f) => n + f.symbols.length, 0)}
          />
          <Metric label="RELATIONSHIPS" value={cp.edges.length} />
          <Metric
            label="CHECKPOINT"
            value={`${index + 1} / ${data.checkpoints.length}`}
          />
        </div>
        {data.warnings.length > 0 && (
          <details className="warning">
            <summary>{data.warnings.length} analysis coverage notes</summary>
            {data.warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </details>
        )}
        {mode === "Architecture" ? (
          <section className="explorer">
            <div className="toolbar">
              <div>
                <strong>Architecture map</strong>
                <span className="muted"> / {nodes.length} symbols</span>
              </div>
              <input
                aria-label="Search symbols"
                placeholder="⌕  Search symbols or files…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                aria-label="Filter symbol kind"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {[
                  "all",
                  "function",
                  "class",
                  "interface",
                  "type",
                  "method",
                  "route",
                ].map((k) => (
                  <option key={k} value={k}>
                    {k === "all" ? "All symbols" : k}
                  </option>
                ))}
              </select>
            </div>
            <Graph
              cp={cp}
              nodes={nodes}
              onSelect={setSelected}
              selected={selected?.id}
            />
            <div className="graph-footer">
              <span>
                <i className="dot green" />
                Function <i className="dot purple" />
                Contract <i className="dot orange" />
                Route
              </span>
              <span>Scroll to zoom · Drag to pan · Select to explore</span>
            </div>
          </section>
        ) : (
          <section className="explorer compare">
            <div className="toolbar">
              <strong>{mode}</strong>
              <select
                aria-label="Compare from"
                value={from}
                onChange={(e) => setFrom(+e.target.value)}
              >
                {data.checkpoints.map((c, i) => (
                  <option key={i} value={i}>
                    {c.label} · {c.commit.subject.slice(0, 35)}
                  </option>
                ))}
              </select>
              <span>→</span>
              <select
                aria-label="Compare to"
                value={to}
                onChange={(e) => setTo(+e.target.value)}
              >
                {data.checkpoints.map((c, i) => (
                  <option key={i} value={i}>
                    {c.label} · {c.commit.subject.slice(0, 35)}
                  </option>
                ))}
              </select>
            </div>
            {mode === "Compare" ? (
              <Comparison
                a={data.checkpoints[from]}
                b={data.checkpoints[to]}
                onSelect={setSelected}
              />
            ) : (
              <Impact
                a={data.checkpoints[from]}
                b={data.checkpoints[to]}
                onSelect={setSelected}
              />
            )}
            <button
              className="text-button"
              onClick={() =>
                api<{ diff: string }>(
                  `/api/diff?from=${data.checkpoints[from].ref}&to=${data.checkpoints[to].ref}`,
                )
                  .then((r) => setDiff(r.diff))
                  .catch((e) => setDiff(e.message))
              }
            >
              View local Git diff ↗
            </button>
            {diffText && <pre className="diff">{diffText}</pre>}
          </section>
        )}
        <section className="timeline">
          <div className="timeline-heading">
            <div>
              <span className="eyebrow">REPOSITORY TIMELINE</span>
              <h3>{cp.commit.subject}</h3>
              <span className="muted">
                {cp.commit.author} ·{" "}
                {new Date(cp.commit.timestamp).toLocaleDateString()} ·{" "}
                <code>{cp.commit.sha.slice(0, 7)}</code>
              </span>
            </div>
            <button
              aria-label={playing ? "Pause timeline" : "Play timeline"}
              onClick={() => {
                if (index === data.checkpoints.length - 1) setIndex(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "Ⅱ Pause" : "▶ Play evolution"}
            </button>
          </div>
          <input
            aria-label="History checkpoint"
            type="range"
            min="0"
            max={data.checkpoints.length - 1}
            value={index}
            onChange={(e) => {
              setPlaying(false);
              setIndex(+e.target.value);
            }}
          />
          <div className="ticks">
            {data.checkpoints.map((c, i) => (
              <button
                title={c.commit.subject}
                className={i === index ? "current" : ""}
                key={i}
                onClick={() => setIndex(i)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="transition">
            {change ? (
              <>
                <span className="green-text">+{change.added.length} added</span>
                <span>−{change.removed.length} removed</span>
                <span>{change.modified.length} modified</span>
                <span>{change.moved.length} moved / renamed</span>
              </>
            ) : (
              <span>Beginning of the analyzed history</span>
            )}
            <small>
              Analyzed {new Date(data.analyzedAt).toLocaleTimeString()}
            </small>
          </div>
        </section>
      </main>
      {selected && (
        <Detail
          data={data}
          node={selected}
          ai={ai}
          onClose={() => setSelected(undefined)}
        />
      )}
      <footer>
        CHRONICLE <span>A little perspective on a lot of code.</span>
        <span>LOCAL FIRST. HISTORY IN FOCUS.</span>
      </footer>
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">◴</span>chronicle
      <span className="brand-period">.</span>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Graph({
  cp,
  nodes,
  onSelect,
  selected,
}: {
  cp: Checkpoint;
  nodes: SymbolNode[];
  onSelect: (s: SymbolNode) => void;
  selected?: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number }>();
  const shown = nodes.slice(0, 100);
  const groups = [
    ...new Set(
      shown.map((n) => n.path.split("/").slice(0, -1).join("/") || "."),
    ),
  ];
  const positions = new Map<string, { x: number; y: number }>();
  groups.forEach((g, gi) =>
    shown
      .filter((n) => (n.path.split("/").slice(0, -1).join("/") || ".") === g)
      .forEach((n, ni) =>
        positions.set(n.id, {
          x: 40 + (gi % 3) * 300,
          y: 65 + Math.floor(gi / 3) * 340 + ni * 66,
        }),
      ),
  );
  const height = Math.max(380, ...[...positions.values()].map((p) => p.y + 80));
  return (
    <div
      className="graph"
      onPointerMove={(e) => {
        if (drag) {
          setPan((p) => ({
            x: p.x + e.clientX - drag.x,
            y: p.y + e.clientY - drag.y,
          }));
          setDrag({ x: e.clientX, y: e.clientY });
        }
      }}
      onPointerUp={() => setDrag(undefined)}
      onPointerLeave={() => setDrag(undefined)}
      onWheel={(e) =>
        setZoom((z) => Math.max(0.4, Math.min(2, z - e.deltaY * 0.001)))
      }
    >
      {!nodes.length ? (
        <div className="empty">
          <h3>No symbols in view</h3>
          <p>Try another search, filter, or checkpoint.</p>
        </div>
      ) : (
        <svg
          role="img"
          aria-label="Interactive architecture graph"
          viewBox={`0 0 940 ${height}`}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              setDrag({ x: e.clientX, y: e.clientY });
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          }}
        >
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            {groups.map((g, i) => (
              <g key={g}>
                <rect
                  className="group-box"
                  x={25 + (i % 3) * 300}
                  y={Math.floor(i / 3) * 340 + 20}
                  width="280"
                  height={Math.max(
                    170,
                    shown.filter(
                      (n) =>
                        (n.path.split("/").slice(0, -1).join("/") || ".") === g,
                    ).length *
                      66 +
                      52,
                  )}
                  rx="12"
                />
                <text
                  className="group-title"
                  x={42 + (i % 3) * 300}
                  y={Math.floor(i / 3) * 340 + 44}
                >
                  ▱ {g}
                </text>
              </g>
            ))}
            {cp.edges
              .filter((e) => positions.has(e.source) && positions.has(e.target))
              .slice(0, 100)
              .map((e, i) => {
                const a = positions.get(e.source)!,
                  b = positions.get(e.target)!;
                return (
                  <path
                    className="edge"
                    key={i}
                    d={`M ${a.x + 120} ${a.y + 45} C ${a.x + 120} ${a.y + 110},${b.x + 120} ${b.y - 60},${b.x + 120} ${b.y}`}
                  >
                    <title>
                      {e.kind}: {e.evidence}
                    </title>
                  </path>
                );
              })}
            {shown.map((n) => {
              const p = positions.get(n.id)!;
              return (
                <g
                  key={n.id}
                  className={`node ${n.kind} ${selected === n.id ? "selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.name} ${n.kind}`}
                  onClick={() => onSelect(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelect(n);
                  }}
                  transform={`translate(${p.x} ${p.y})`}
                >
                  <rect width="250" height="50" rx="7" />
                  <circle cx="16" cy="19" r="4" />
                  <text x="29" y="23">
                    {n.name.slice(0, 26)}
                  </text>
                  <text className="node-path" x="29" y="39">
                    {n.path.split("/").at(-1)} · {n.kind}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
      <div className="graph-controls">
        <button
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
        >
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
        >
          +
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Fit view
        </button>
      </div>
      <svg
        className="minimap"
        aria-label="Graph minimap"
        viewBox={`0 0 940 ${height}`}
      >
        {[...positions].map(([id, p]) => (
          <rect key={id} x={p.x} y={p.y} width="250" height="45" rx="5" />
        ))}
      </svg>
      {nodes.length > 100 && (
        <span className="graph-limit">
          Showing 100 of {nodes.length}. Search to narrow the map.
        </span>
      )}
    </div>
  );
}
function Comparison({
  a,
  b,
  onSelect,
}: {
  a: Checkpoint;
  b: Checkpoint;
  onSelect: (s: SymbolNode) => void;
}) {
  const c = compare(a, b);
  return (
    <div className="comparison-body">
      <p className="muted">
        Complexity delta {c.complexity > 0 ? "+" : ""}
        {c.complexity} · {c.edgesAdded.length} relationships added ·{" "}
        {c.edgesRemoved.length} removed
      </p>
      {(["added", "removed", "modified", "moved"] as const).map((k) => (
        <div key={k}>
          <h3>
            {k} <span className="badge">{c[k].length}</span>
          </h3>
          {c[k].map((s) => (
            <button
              className="symbol-row"
              key={s.id}
              onClick={() => onSelect(s)}
            >
              <strong>{s.name}</strong>
              <code>{s.path}</code>
              <span>{s.kind}</span>
            </button>
          ))}
          {!c[k].length && <p className="muted">No {k} symbols.</p>}
        </div>
      ))}
    </div>
  );
}
function Impact({
  a,
  b,
  onSelect,
}: {
  a: Checkpoint;
  b: Checkpoint;
  onSelect: (s: SymbolNode) => void;
}) {
  const items = blast(a, b);
  return (
    <div className="comparison-body">
      <p className="notice">
        Risk indicators, not guaranteed failures. Static relationships and
        sampled history may be incomplete.
      </p>
      <h2>{items.length} potentially affected nodes</h2>
      {items.map((i) => (
        <button
          className="symbol-row impact-row"
          key={i.id}
          onClick={() => i.node && onSelect(i.node)}
        >
          <strong>{i.node?.name || i.id.replace("file:", "")}</strong>
          <span>{i.reason}</span>
        </button>
      ))}
      {!items.length && (
        <p>No symbol changes detected between these snapshots.</p>
      )}
    </div>
  );
}
function Detail({
  data,
  node,
  ai,
  onClose,
}: {
  data: Analysis;
  node: SymbolNode;
  ai: boolean;
  onClose: () => void;
}) {
  const e = explain(data, node.id);
  const [consent, setConsent] = useState(false);
  const [synthesis, setSynthesis] = useState("");
  const [busy, setBusy] = useState(false);
  const [commit, setCommit] = useState("");
  useEffect(() => {
    setConsent(false);
    setSynthesis("");
  }, [node.id]);
  return (
    <aside className="detail">
      <div className="detail-top">
        <span className="eyebrow">SYMBOL INSPECTOR</span>
        <button aria-label="Close symbol inspector" onClick={onClose}>
          ×
        </button>
      </div>
      <span className={`kind-label ${node.kind}`}>{node.kind}</span>
      <h2>{node.name}</h2>
      <code className="filepath">
        {node.path}:{node.line}
      </code>
      <pre>{node.signature}</pre>
      <div className="detail-stats">
        <span>
          Complexity <strong>{node.complexity}</strong>
        </span>
        <span>
          Lineage confidence{" "}
          <strong>{Math.round(node.confidence * 100)}%</strong>
        </span>
      </div>
      <p className="muted">{node.evidence}</p>
      <h3>Why does this exist?</h3>
      <p>{e.summary}</p>
      <p className="notice">{e.caveat}</p>
      <h3>History & evidence</h3>
      {e.evidence.map((item) => (
        <article className="evidence" key={item.id}>
          <span className="eyebrow">
            {item.id} · {item.kind}
          </span>
          <h4>{item.subject}</h4>
          <p>{item.claim}</p>
          <button className="text-button" onClick={() => setCommit(item.sha)}>
            {item.sha.slice(0, 7)} · {item.author} ↗
          </button>
        </article>
      ))}
      {commit && (
        <div className="notice">
          <strong>Local commit {commit.slice(0, 7)}</strong>
          <p>
            {data.commits.find((c) => c.sha === commit)?.body ||
              data.commits.find((c) => c.sha === commit)?.subject}
          </p>
        </div>
      )}
      <h3>Frequently co-changing files</h3>
      {cochanges(data, node.id).map((c) => (
        <p key={c.path}>
          <code>{c.path}</code> · {c.count} checkpoints
        </p>
      ))}
      {!cochanges(data, node.id).length && (
        <p className="muted">No co-change signal in sampled checkpoints.</p>
      )}
      <h3>Optional AI synthesis</h3>
      <p className="muted">
        {ai
          ? "Review the selected Git evidence before sending it to OpenAI."
          : "Disabled or no OPENAI_API_KEY available. Offline explanations work without it."}
      </p>
      {ai && (
        <>
          <button onClick={() => setConsent(!consent)}>
            Preview evidence to send
          </button>
          {consent && (
            <div>
              <pre className="ai-preview">
                {JSON.stringify(e.evidence.slice(0, 8), null, 2)}
              </pre>
              <button
                className="primary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  api<{ claims: { text: string; citations: string[] }[] }>(
                    "/api/synthesize",
                    { id: node.id, consent: true },
                  )
                    .then((r) =>
                      setSynthesis(
                        r.claims
                          .map((c) => `${c.text} [${c.citations.join(", ")}]`)
                          .join("\n\n"),
                      ),
                    )
                    .catch((err) => setSynthesis(err.message))
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? "Synthesizing…" : "I consent — send this evidence"}
              </button>
            </div>
          )}
          <p className="synthesis">{synthesis}</p>
        </>
      )}
    </aside>
  );
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <App />
  </Boundary>,
);
