/*
  Geoff’s Personal Dashboard (v1)

  What this is:
  - A single-file React component with a clean Tailwind + shadcn/ui layout.
  - Opinionated starter widgets with API hook points you can wire up quickly.
  - No backend required to preview; uses mock data/localStorage until you add endpoints.

  How to wire APIs:
  - Set env or replace ENDPOINTS entries below.
  - Each widget has a fetcher stub (fetchJSON) and update methods to POST.
  - Replace mock timers with real data when ready.

  Suggested endpoints (adjust to taste):
  - WEATHER_ENDPOINT (GET): returns { tempC:number, condition:string, icon?:string }
  - CALENDAR_ENDPOINT (GET): returns [{ id, title, startISO, endISO, location? }]
  - CAPTURE_ENDPOINT (POST): { text } -> { id }
  - FINANCE_MTD_ENDPOINT (GET): { mtd:number, target:number }
  - CREW_STATUS_ENDPOINT (GET): { queue:number, running:number, lastRunISO:string }
  - OLLAMA_HEALTH (GET): any non-error JSON when running locally
  - WATCHLIST_ENDPOINT (GET): [{ symbol, price, changePct, currency? }]

  Notes:
  - Uses localStorage for: quick captures, protein grams, focus timer settings.
  - Dark mode follows system via 'dark' class on <html>. Add your own toggle if you want.
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Calendar as CalendarIcon,
  Clock,
  CloudSun,
  Target as TargetIcon,
  ListPlus,
  Play,
  Pause,
  RotateCcw,
  Cpu,
  Rocket,
  TrendingUp,
  DollarSign,
  Plus,
  Minus,
  Save,
  NotebookPen,
  ChevronRight,
  RefreshCcw,
} from "lucide-react";

// ---------------------------
// Configurable endpoints
// ---------------------------
const ENDPOINTS = {
  WEATHER_ENDPOINT: import.meta?.env?.VITE_WEATHER_ENDPOINT || "https://api.open-meteo.com/v1/forecast?latitude=43.651&longitude=-79.347&current_weather=true&timezone=auto",
  CALENDAR_ENDPOINT: import.meta?.env?.VITE_CALENDAR_ENDPOINT || "/api/calendar",
  CAPTURE_ENDPOINT: import.meta?.env?.VITE_CAPTURE_ENDPOINT || "/api/capture",
  FINANCE_MTD_ENDPOINT:
    import.meta?.env?.VITE_FINANCE_MTD_ENDPOINT || "/api/finance/mtd",
  CREW_STATUS_ENDPOINT:
    import.meta?.env?.VITE_CREW_STATUS_ENDPOINT || "/api/crew/status",
  OLLAMA_HEALTH: import.meta?.env?.VITE_OLLAMA_HEALTH || "http://localhost:11434/api/tags",
  BOC_FX_USDCAD: import.meta?.env?.VITE_BOC_FX_USDCAD || "https://www.bankofcanada.ca/valet/observations/FXUSDCAD?recent=2",
  WATCHLIST_ENDPOINT:
    import.meta?.env?.VITE_WATCHLIST_ENDPOINT || "/api/markets/watchlist",
};

async function fetchJSON(url: string, opts: RequestInit = {}) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (e) {
    console.warn("Fetch error", url, e);
    return null; // Widgets will fall back to mock
  }
}

// Pocket utils
const fmtTime = (d = new Date()) =>
  d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const fmtDate = (d = new Date()) =>
  d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

// Weather code mapping (Open-Meteo)
function weatherDesc(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1 || code === 2) return "Mostly clear";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([56, 57].includes(code)) return "Freezing drizzle";
  if ([61, 63, 65].includes(code)) return "Rain";
  if ([66, 67].includes(code)) return "Freezing rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm w/ hail";
  return "—";
}
function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code === 1 || code === 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([56, 57, 66, 67].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "🌨️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "⛅";
}

// ---------------------------
// Clock-only updates (avoid re-rendering whole dashboard)
// ---------------------------
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function ClockDate() {
  const now = useNow();
  return <div className="text-sm text-muted-foreground">{fmtDate(now)}</div>;
}

function ClockTime() {
  const now = useNow();
  return <div className="font-mono text-lg tabular-nums">{fmtTime(now)}</div>;
}

// ---------------------------
// Main Component
// ---------------------------
export default function Dashboard() {
  // Dark mode
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('geoff-dark');
    if (saved !== null) return saved === '1';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('geoff-dark', darkMode ? '1' : '0');
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', darkMode);
    }
  }, [darkMode]);

  // Weather (Toronto default)
  const [weather, setWeather] = useState<{ tempC: number; condition: string; icon?: string } | null>(null);
  useEffect(() => {
    (async () => {
      const data = await fetchJSON(ENDPOINTS.WEATHER_ENDPOINT);
      let shaped: { tempC: number; condition: string; icon?: string } | null = null;
      if (data?.current_weather) {
        const cw = data.current_weather;
        shaped = {
          tempC: Math.round(Number(cw.temperature)),
          condition: weatherDesc(Number(cw.weathercode)),
          icon: weatherIcon(Number(cw.weathercode)),
        };
      }
      setWeather(
        shaped || {
          tempC: 22,
          condition: "Partly Cloudy",
          icon: "⛅",
        }
      );
    })();
  }, []);

  // Calendar (next events)
  type CalEvent = { id: string; title: string; startISO: string; endISO?: string; location?: string };
  const [events, setEvents] = useState<CalEvent[]>([]);
  useEffect(() => {
    (async () => {
      const data = await fetchJSON(ENDPOINTS.CALENDAR_ENDPOINT);
      setEvents(
        data || [
          {
            id: "1",
            title: "Daily focus block",
            startISO: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            endISO: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "2",
            title: "Upload 3 Shorts",
            startISO: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          },
        ]
      );
    })();
  }, []);

  // Quick capture (Notion/Todo list)
  const [capture, setCapture] = useState("");
  const [captureItems, setCaptureItems] = useState<{ id: string; text: string; ts: number }[]>(() => {
    const raw = localStorage.getItem("geoff-captures");
    return raw ? JSON.parse(raw) : [];
  });
  useEffect(() => {
    localStorage.setItem("geoff-captures", JSON.stringify(captureItems));
  }, [captureItems]);
  async function submitCapture() {
    const text = capture.trim();
    if (!text) return;
    setCapture("");
    setCaptureItems((prev) => [{ id: crypto.randomUUID(), text, ts: Date.now() }, ...prev].slice(0, 20));
    // fire and forget real endpoint
    fetchJSON(ENDPOINTS.CAPTURE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  }

  // Focus timer (Pomodoro-ish)
  const [workMin, setWorkMin] = useState<number>(() => Number(localStorage.getItem("geoff-workMin")) || 25);
  const [breakMin, setBreakMin] = useState<number>(() => Number(localStorage.getItem("geoff-breakMin")) || 5);
  const [secsLeft, setSecsLeft] = useState<number>(workMin * 60);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"work" | "break">("work");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem("geoff-workMin", String(workMin));
  }, [workMin]);
  useEffect(() => {
    localStorage.setItem("geoff-breakMin", String(breakMin));
  }, [breakMin]);

  useEffect(() => {
    if (!running) return;
    timerRef.current = window.setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) {
          const nextPhase = phase === "work" ? "break" : "work";
          setPhase(nextPhase);
          return (nextPhase === "work" ? workMin : breakMin) * 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [running, phase, workMin, breakMin]);

  useEffect(() => {
    // Reset when lengths change and timer not running
    if (!running) setSecsLeft((phase === "work" ? workMin : breakMin) * 60);
  }, [workMin, breakMin, phase, running]);

  const mins = Math.floor(secsLeft / 60)
    .toString()
    .padStart(2, "0");
  const secs = (secsLeft % 60).toString().padStart(2, "0");
  const phaseLabel = phase === "work" ? "Focus" : "Break";

  // Finance goal progress
  const [mtd, setMtd] = useState<number>(0);
  const [target, setTarget] = useState<number>(10000);
  useEffect(() => {
    (async () => {
      const data = await fetchJSON(ENDPOINTS.FINANCE_MTD_ENDPOINT);
      if (data) {
        setMtd(Number(data.mtd || 0));
        setTarget(Number(data.target || 10000));
      } else {
        setMtd(1250); // mock
        setTarget(10000);
      }
    })();
  }, []);
  const pct = clamp(target ? (mtd / target) * 100 : 0, 0, 100);

  // Agent Ops (CrewAI + Ollama health)
  const [crew, setCrew] = useState<{ queue: number; running: number; lastRunISO?: string } | null>(null);
  const [ollamaOK, setOllamaOK] = useState<boolean>(false);
  const [autoRun, setAutoRun] = useState<boolean>(() => localStorage.getItem("geoff-autorun") === "1");
  useEffect(() => {
    localStorage.setItem("geoff-autorun", autoRun ? "1" : "0");
  }, [autoRun]);
  async function refreshAgentOps() {
    const s = await fetchJSON(ENDPOINTS.CREW_STATUS_ENDPOINT);
    setCrew(s || { queue: 3, running: 1, lastRunISO: new Date().toISOString() });
    const oll = await fetchJSON(ENDPOINTS.OLLAMA_HEALTH);
    setOllamaOK(!!oll);
  }
  useEffect(() => {
    refreshAgentOps();
  }, []);

  // Protein tracker (because, gains)
  const [proteinGoal, setProteinGoal] = useState<number>(() => Number(localStorage.getItem("geoff-proteinGoal")) || 130);
  const [proteinToday, setProteinToday] = useState<number>(() => Number(localStorage.getItem("geoff-proteinToday")) || 0);
  useEffect(() => {
    localStorage.setItem("geoff-proteinGoal", String(proteinGoal));
  }, [proteinGoal]);
  useEffect(() => {
    localStorage.setItem("geoff-proteinToday", String(proteinToday));
  }, [proteinToday]);

  // Watchlist (tickers)
  type Ticker = { symbol: string; price: number; changePct: number; currency?: string };
  const [watch, setWatch] = useState<Ticker[]>([]);
  useEffect(() => {
    (async () => {
      const items: Ticker[] = [];
      // Bank of Canada USD/CAD (recent=2 to compute simple change)
      const boc = await fetchJSON(ENDPOINTS.BOC_FX_USDCAD);
      const obs = boc?.observations;
      if (Array.isArray(obs) && obs.length >= 1) {
        const latest = Number(obs[obs.length - 1]?.FXUSDCAD?.v);
        const prev = Number((obs.length > 1 ? obs[obs.length - 2]?.FXUSDCAD?.v : latest));
        if (!Number.isNaN(latest) && !Number.isNaN(prev) && prev) {
          const changePct = ((latest - prev) / prev) * 100;
          items.push({ symbol: "USD/CAD", price: latest, changePct });
        }
      }

      const data = await fetchJSON(ENDPOINTS.WATCHLIST_ENDPOINT);
      if (Array.isArray(data) && data.length) items.push(...data);

      if (!items.length) {
        items.push(
          { symbol: "USD/CAD", price: 1.35, changePct: 0.05 },
          { symbol: "BTC", price: 65000, changePct: 1.2, currency: "USD" },
          { symbol: "NVDA", price: 122.34, changePct: -0.8, currency: "USD" },
        );
      }
      setWatch(items);
    })();
  }, []);

  // Small helpers
  function addProtein(n: number) {
    setProteinToday((p) => clamp(p + n, 0, 10000));
  }

  const next3Events = useMemo(() =>
    [...events]
      .sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime())
      .slice(0, 3),
  [events]);

  // Price formatting for watchlist
  function formatTickerValue(t: Ticker): string {
    // FX pair like "USD/CAD"
    if (t.symbol.includes("/")) {
      const [base, quote] = t.symbol.split("/");
      const nf = new Intl.NumberFormat(undefined, {
        minimumFractionDigits: t.price >= 10 ? 2 : 4,
        maximumFractionDigits: 5,
      });
      return `${nf.format(t.price)} ${quote} per ${base}`;
    }
    // Default to currency formatting (USD fallback unless provided)
    const currency = t.currency || "USD";
    const nf = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    });
    return nf.format(t.price);
  }

  return (
    <div className="min-h-dvh w-full bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-primary/10 grid place-items-center">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <ClockDate />
              <h1 className="text-xl font-semibold leading-tight">Hey Geoff — here’s your snapshot</h1>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 mb-1">
              <span className="text-xs text-muted-foreground">Dark mode</span>
              <Switch checked={darkMode} onCheckedChange={(v) => setDarkMode(Boolean(v))} />
            </div>
            <div className="text-sm text-muted-foreground">Local time</div>
            <ClockTime />
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-7xl px-4 py-6 grid gap-6 md:grid-cols-12">
        {/* Focus Timer */}
        <Card className="md:col-span-4 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Focus Timer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Phase</div>
                <div className="text-lg font-medium">{phaseLabel}</div>
              </div>
              <div className="font-mono text-3xl tabular-nums">{mins}:{secs}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setRunning(true)}><Play className="h-4 w-4 mr-1" />Start</Button>
              <Button size="sm" variant="secondary" onClick={() => setRunning(false)}><Pause className="h-4 w-4 mr-1" />Pause</Button>
              <Button size="sm" variant="outline" onClick={() => { setRunning(false); setPhase("work"); setSecsLeft(workMin * 60); }}><RotateCcw className="h-4 w-4 mr-1" />Reset</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Work (min)</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => setWorkMin((m) => clamp(m - 5, 5, 180))}><Minus className="h-4 w-4" /></Button>
                  <Input value={workMin} onChange={(e) => setWorkMin(clamp(Number(e.target.value || 0), 5, 180))} className="text-center" />
                  <Button variant="outline" size="icon" onClick={() => setWorkMin((m) => clamp(m + 5, 5, 180))}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Break (min)</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => setBreakMin((m) => clamp(m - 1, 1, 60))}><Minus className="h-4 w-4" /></Button>
                  <Input value={breakMin} onChange={(e) => setBreakMin(clamp(Number(e.target.value || 0), 1, 60))} className="text-center" />
                  <Button variant="outline" size="icon" onClick={() => setBreakMin((m) => clamp(m + 1, 1, 60))}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Capture */}
        <Card className="md:col-span-4 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><ListPlus className="h-5 w-5" /> Quick Capture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Jot something down… (press Enter to save)"
                value={capture}
                onChange={(e) => setCapture(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitCapture()}
              />
              <Button onClick={submitCapture}><Save className="h-4 w-4 mr-1" />Save</Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-auto pr-1">
              {captureItems.length === 0 && (
                <div className="text-sm text-muted-foreground">Your last 20 ideas will land here.</div>
              )}
              {captureItems.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm leading-snug">{c.text}</div>
                    <div className="text-xs text-muted-foreground">{new Date(c.ts).toLocaleString()}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setCaptureItems((prev) => prev.filter((x) => x.id !== c.id))}>✕</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Calendar */}
        <Card className="md:col-span-4 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5" /> Next Up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {next3Events.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between rounded-xl border p-2">
                <div>
                  <div className="text-sm font-medium">{ev.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(ev.startISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {ev.endISO ? (
                      <>
                        <span> → </span>
                        {new Date(ev.endISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </>
                    ) : null}
                  </div>
                </div>
                <Button variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            ))}
            {next3Events.length === 0 && (
              <div className="text-sm text-muted-foreground">No upcoming events loaded.</div>
            )}
          </CardContent>
        </Card>

        {/* Weather */}
        <Card className="md:col-span-3 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><CloudSun className="h-5 w-5" /> Toronto Weather</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-semibold">{weather?.tempC ?? "--"}°C</div>
              <div className="text-sm text-muted-foreground">{weather?.condition ?? "—"}</div>
            </div>
            <div className="text-5xl">{weather?.icon || "⛅"}</div>
          </CardContent>
        </Card>

        {/* Finance Goal */}
        <Card className="md:col-span-5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">MTD</div>
                <div className="text-xl font-semibold">${mtd.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Target</div>
                <div className="text-xl font-semibold">${target.toLocaleString()}</div>
              </div>
            </div>
            <Progress value={pct} />
            <div className="text-xs text-muted-foreground">{pct.toFixed(1)}% of goal</div>
          </CardContent>
        </Card>

        {/* Agent Ops */}
        <Card className="md:col-span-4 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Cpu className="h-5 w-5" /> Agent Ops</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm">Crew queue</div>
                <div className="text-lg font-medium">{crew?.queue ?? 0} queued · {crew?.running ?? 0} running</div>
                <div className="text-xs text-muted-foreground">Last run {crew?.lastRunISO ? new Date(crew.lastRunISO).toLocaleString() : "—"}</div>
              </div>
              <div className="grid gap-2">
                <Button variant="outline" size="sm" onClick={refreshAgentOps}><RefreshCcw className="h-4 w-4 mr-1" />Refresh</Button>
                <div className="flex items-center gap-2 text-sm">
                  <Switch checked={autoRun} onCheckedChange={(v) => setAutoRun(Boolean(v))} />
                  <span>Auto-run queue</span>
                </div>
                <Badge variant={ollamaOK ? "default" : "secondary"}>{ollamaOK ? "Ollama OK" : "Ollama Offline"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Protein Tracker */}
        <Card className="md:col-span-5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><TargetIcon className="h-5 w-5" /> Protein Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Consumed</div>
              <div className="font-mono text-2xl">{proteinToday}g</div>
            </div>
            <Progress value={clamp((proteinToday / proteinGoal) * 100, 0, 100)} />
            <div className="grid grid-cols-4 gap-2">
              {[15, 25, 35, 50].map((n) => (
                <Button key={n} variant="outline" onClick={() => addProtein(n)}>+{n}g</Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Goal</span>
              <Input className="w-24" value={proteinGoal} onChange={(e) => setProteinGoal(clamp(Number(e.target.value || 0), 40, 300))} />
              <Button variant="ghost" onClick={() => setProteinToday(0)}>Reset</Button>
            </div>
          </CardContent>
        </Card>

        {/* Watchlist */}
        <Card className="md:col-span-7 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Watchlist</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {watch.map((t) => (
              <div key={t.symbol} className="rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{t.symbol}</div>
                  <Badge variant={t.changePct >= 0 ? "default" : "secondary"}>{t.changePct >= 0 ? "+" : ""}{t.changePct.toFixed(2)}%</Badge>
                </div>
                <div className="mt-1 font-mono">{formatTickerValue(t)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Shortcuts */}
        <Card className="md:col-span-5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><NotebookPen className="h-5 w-5" /> Shortcuts</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <a className="rounded-xl border p-3 hover:bg-accent" href="http://localhost:3000" target="_blank" rel="noreferrer">Local App</a>
            <a className="rounded-xl border p-3 hover:bg-accent" href="https://notion.so" target="_blank" rel="noreferrer">Notion</a>
            <a className="rounded-xl border p-3 hover:bg-accent" href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
            <a className="rounded-xl border p-3 hover:bg-accent" href="https://studio.youtube.com" target="_blank" rel="noreferrer">YT Studio</a>
            <a className="rounded-xl border p-3 hover:bg-accent" href="https://app.crewai.com" target="_blank" rel="noreferrer">CrewAI</a>
            <a className="rounded-xl border p-3 hover:bg-accent" href="http://localhost:11434" target="_blank" rel="noreferrer">Ollama</a>
          </CardContent>
        </Card>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-muted-foreground">
        Built fast so you can ship faster. Swap the mock fetchers with your real endpoints when ready.
      </footer>
    </div>
  );
}
