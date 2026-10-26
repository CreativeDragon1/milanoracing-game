import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Download, Maximize2, Play, RotateCcw, X } from "lucide-react";
import poster from "../assets/racing-preview.png";
import "./Racing.css";

const gameBase = new URL(import.meta.env.VITE_MILANO_GAME_URL || "/play/", location.origin);
const gameOrigin = gameBase.origin;
const circuits = [
  ["milano", "Milano Autodromo"], ["singapore", "Singapore"], ["monaco", "Monaco"],
  ["monza", "Monza"], ["bahrain", "Bahrain"], ["spa", "Spa-Francorchamps"],
  ["austria", "Austria"], ["silverstone", "Silverstone"], ["abu-dhabi", "Yas Marina"],
  ["suzuka", "Suzuka"], ["interlagos", "Interlagos"], ["zandvoort", "Zandvoort"],
  ["riviera", "Milano Riviera"], ["solara", "Milano Solara"],
];
export default function Racing() {
  const [circuit, setCircuit] = useState("milano");
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const returnScroll = useRef(0);
  const gameUrl = new URL(gameBase);gameUrl.searchParams.set("embed","1");gameUrl.searchParams.set("circuit",circuit);
  const src = gameUrl.href;
  const pause = () => frame.current?.contentWindow?.postMessage({type: "milano:pause"}, gameOrigin);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".header");
    if (!header) return;
    const fit = () => pageRef.current?.style.setProperty("--racing-header-height", `${Math.ceil(header.getBoundingClientRect().height)}px`);
    const observer = new ResizeObserver(fit); observer.observe(header); fit();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const screen = window.matchMedia("(max-width:760px), (max-height:600px)");
    const previous = document.body.style.overflow;
    let scroll = 0;
    const fitScreen = () => {
      document.body.style.overflow = screen.matches ? "hidden" : previous;
      cancelAnimationFrame(scroll);
      scroll=requestAnimationFrame(() => {
        if (screen.matches || !consoleRef.current) return;
        const headerHeight=document.querySelector(".header")?.getBoundingClientRect().height||0;
        window.scrollTo({top:window.scrollY+consoleRef.current.getBoundingClientRect().top-headerHeight-12,behavior:"instant"});
      });
    };
    fitScreen(); screen.addEventListener("change", fitScreen);window.addEventListener("resize",fitScreen);
    return () => {cancelAnimationFrame(scroll);document.body.style.overflow = previous;screen.removeEventListener("change", fitScreen);window.removeEventListener("resize",fitScreen);};
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const current = frame.current?.contentWindow;
    let inView = true;
    const visibility = () => current?.postMessage({type:"milano:visibility",visible:inView&&!document.hidden},gameOrigin);
    const receive = (event: MessageEvent) => {
      if (event.origin !== gameOrigin || event.source !== current || event.data?.type !== "milano:ready") return;
      setReady(true); setSlow(false); window.clearInterval(ping); window.clearTimeout(timeout);
      visibility();
      if (inView && !document.hidden) frame.current?.focus({preventScroll:true});
    };
    const hello = () => {current?.postMessage({type: "milano:hello"}, gameOrigin);visibility();};
    const hidden = () => {visibility();if (document.hidden) pause();};
    window.addEventListener("message", receive);
    document.addEventListener("visibilitychange", hidden);
    const ping = window.setInterval(hello, 1000);
    const timeout = window.setTimeout(() => {window.clearInterval(ping); setSlow(true);}, 120000);
    const observer = new IntersectionObserver(([entry]) => {inView=entry.isIntersecting;visibility();if (!inView) pause();}, {threshold: .05});
    if (consoleRef.current) observer.observe(consoleRef.current);
    hello();
    return () => {
      current?.postMessage({type: "milano:pause"}, gameOrigin);
      window.clearInterval(ping); window.clearTimeout(timeout); observer.disconnect();
      window.removeEventListener("message", receive);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [started, attempt, circuit]);
  // Stop the handshake as soon as loading completes; no background polling in a race.
  useEffect(() => { if (ready) setSlow(false); }, [ready]);
  const launch = () => {returnScroll.current=window.scrollY;setReady(false);setSlow(false);setStarted(true);setError("");};
  const close = () => {pause();setStarted(false);setReady(false);requestAnimationFrame(() => {window.scrollTo({top:returnScroll.current,behavior:"instant"});playRef.current?.focus({preventScroll:true});});};
  const fullscreen = async () => {
    try {
      if (!consoleRef.current?.requestFullscreen) throw Error("unsupported");
      await consoleRef.current.requestFullscreen(); frame.current?.focus();
    } catch {setError("Fullscreen is unavailable here. Use Open game for a full-window view.");}
  };
  return <section ref={pageRef} className={`racing-page${started ? " is-playing" : ""}`}>
    <div className="racing-heading"><h1>Always the <em>Fastest</em></h1><span className="racing-preview-tag">Team preview</span></div>
    <div className="racing-console" ref={consoleRef}>
      {started ? <>
        <div className="racing-toolbar"><span className="racing-status" role="status">{ready ? <Check size={15}/> : <span className="racing-spinner"/>}{ready ? "Garage ready" : "Opening garage"}</span><div className="racing-toolbar-actions">
          <a href={src} target="_blank" rel="noopener noreferrer" title="Open game in a new tab" aria-label="Open game in a new tab"><span>Open game</span><ArrowUpRight size={18}/></a>
          <button onClick={fullscreen} title="Fullscreen game" aria-label="Fullscreen game"><Maximize2 size={18}/></button>
          <button onClick={close} title="Exit game" aria-label="Exit game"><X size={20}/></button>
        </div></div>
        <iframe key={attempt} ref={frame} title="Milano Racing game" src={src} allow="fullscreen; gamepad; autoplay" allowFullScreen tabIndex={0}/>
        {(slow && !ready) && <div className="racing-notice" role="status">Still loading. <button onClick={() => {setAttempt(a=>a+1);setSlow(false);setReady(false);}}>Retry <RotateCcw size={14}/></button><a href={src} target="_blank" rel="noopener noreferrer">Open separately <ArrowUpRight size={14}/></a></div>}
        {error && <p className="racing-notice" role="status">{error}</p>}
      </> : <div className="racing-launcher">
        <img className="racing-poster" src={poster} alt="The MR 26 in the Milano Racing garage" width="1440" height="900" fetchPriority="high"/>
        <div className="racing-launch-controls"><div className="racing-circuit-field"><label htmlFor="racing-circuit">Circuit</label><select id="racing-circuit" value={circuit} onChange={e=>setCircuit(e.target.value)}>{circuits.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></div><button className="racing-play" ref={playRef} onClick={launch}><Play size={17} fill="currentColor"/>Play now<ArrowUpRight size={20}/></button></div>
      </div>}
    </div>
    {!started && <div className="racing-desktop"><div><strong>Milano Apex</strong><span>Windows · 64-bit</span></div><a href="/downloads/Milano-Apex-Windows.zip" download="Milano-Apex-Windows.zip"><Download size={17}/>Download desktop app</a></div>}
  </section>;
}
