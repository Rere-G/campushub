import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import "./landing.css";
import headImg from "../assets/LandingPageHead.png";
import laptopImg from "../assets/laptop.png";
import mascotGif from "../assets/TS.gif";
import shotMarketplace from "../assets/landing/marketplace.webp";
import shotPost from "../assets/landing/post.webp";
import shotDashboard from "../assets/landing/dashboard.webp";
import shotServices from "../assets/landing/services.webp";
import shotService from "../assets/landing/service.webp";

// Jagged top edge for each colour band ("torn paper").
const TEAR_POINTS =
  "0,40 28,13 58,7 78,10 107,7 141,17 160,9 191,30 211,19 231,31 250,11 275,7 311,29 330,18 349,12 376,30 398,11 434,23 469,15 490,16 519,10 554,8 590,7 627,17 660,31 702,24 734,33 763,23 788,15 828,19 848,23 882,35 928,25 969,32 996,8 1017,36 1048,14 1090,25 1112,35 1143,6 1182,8 1224,24 1252,26 1289,35 1325,33 1345,9 1371,34 1411,8 1430,23 1440,32 1440,60 0,60";

function Tear({ fill, flip = false }) {
  return (
    <svg className="lp-tear" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={TEAR_POINTS} fill={fill} transform={flip ? "scale(-1,1) translate(-1440,0)" : undefined} />
    </svg>
  );
}

function Banner({ kicker, letter, title, color }) {
  return (
    <div className="lp-head">
      <span className="lp-kicker" style={{ background: color }} data-lp="drop">
        {kicker}
      </span>
      <div className="lp-banner" style={{ color }} data-lp="banner" data-lp-delay="0.12">
        <span className="lp-roundel">{letter}</span>
        <h2 className="lp-caps" style={{ margin: 0 }}>{title}</h2>
      </div>
    </div>
  );
}

function Stop({ n, color, title, children }) {
  return (
    <div className="lp-stop">
      <div className="lp-stop-h">
        <span className="lp-num" style={{ background: color }} data-lp="pop">{n}</span>
        <h3 className="lp-disp">{title}</h3>
      </div>
      <p data-lp="blur" data-lp-delay="0.15">{children}</p>
    </div>
  );
}

function Frame({ src, alt, from, position }) {
  return (
    <div className="lp-frame" data-lp={from}>
      <img className="lp-shot" src={src} alt={alt} loading="lazy" style={position ? { objectPosition: position } : undefined} />
    </div>
  );
}

// A soft UI click made in code (no audio file). Browsers only allow sound
// after the visitor interacts, which is why sound starts off.
function useBlip() {
  const ctxRef = useRef(null);
  return () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ctxRef.current) ctxRef.current = new AC();
      const ctx = ctxRef.current;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(660, t);
      o.frequency.exponentialRampToValueAtTime(990, t + 0.06);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.13);
    } catch {
      // Sound is a nicety; ignore any audio errors.
    }
  };
}

export default function Landing() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [checking, setChecking] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const blip = useBlip();
  const click = () => soundOn && blip();

  // Signed-in students skip the landing page.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) navigate("/dashboard", { replace: true });
      else setChecking(false);
    });
    return unsub;
  }, [navigate]);

  // Scroll animation: reveal-on-scroll, hero parallax, the top route
  // progress bar, and the dashed route lines drawing themselves.
  // useLayoutEffect so elements are hidden before the first paint (no flash).
  useLayoutEffect(() => {
    if (checking) return undefined;
    const root = rootRef.current;
    if (!root) return undefined;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return undefined;

    root.classList.add("lp-js");

    // Stagger: data-lp-delay (seconds) becomes the --lp-d custom property.
    const items = Array.from(root.querySelectorAll("[data-lp]"));
    items.forEach((el) => {
      const d = el.getAttribute("data-lp-delay");
      if (d) el.style.setProperty("--lp-d", `${d}s`);
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("lp-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => io.observe(el));

    const lines = Array.from(root.querySelectorAll(".lp-line"));
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        root.style.setProperty("--lp-sy", String(Math.min(y, 900)));
        root.style.setProperty("--lp-progress", String(max > 0 ? Math.min(1, y / max) : 0));
        const vh = window.innerHeight;
        lines.forEach((line) => {
          const r = line.parentElement.getBoundingClientRect();
          // 0 when the section's top reaches 80% down the screen, 1 when its
          // bottom passes 60% down: the line keeps pace with your reading.
          const p = (vh * 0.8 - r.top) / (r.height + vh * 0.2);
          line.style.setProperty("--lp-line", String(Math.max(0, Math.min(1, p))));
        });
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      root.classList.remove("lp-js");
    };
  }, [checking]);

  if (checking) return <div style={{ minHeight: "100vh", background: "#0d0b07" }} />;

  return (
    <div className="lp" ref={rootRef}>
      <div className="lp-progress" aria-hidden="true" />

      <div className="lp-grain" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg">
          <filter id="lp-grain-f">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#lp-grain-f)" fill="#808080" />
        </svg>
      </div>
      <div className="lp-vignette" aria-hidden="true" />

      {/* ═════ TOP BAR ═════ */}
      <header className="lp-bar">
        <div className="lp-wrap lp-bar-in">
          <a className="lp-logo" href="#top">
            Campus<span>Hub</span>
          </a>
          <button
            type="button"
            className="lp-sound"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              if (next) blip();
            }}
            aria-pressed={soundOn}
            aria-label={soundOn ? "Sound on" : "Sound off"}
            title={soundOn ? "Sound on" : "Sound off"}
          >
            {soundOn ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" /></svg>
            )}
          </button>
          <Link className="lp-btn lp-btn-ghost" to="/login" onClick={click}>Log in</Link>
          <Link className="lp-btn lp-btn-main" to="/signup" onClick={click}>Sign up</Link>
        </div>
      </header>

      {/* ═════ HERO ═════ */}
      <section className="lp-hero" id="top">
        {/* Clipped at the street line so the skyline can sink on scroll without showing below the road */}
        <div className="lp-sky-clip" aria-hidden="true">
          <svg className="lp-sky" viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <defs>
              <pattern id="lp-win" width="22" height="26" patternUnits="userSpaceOnUse"><rect x="6" y="6" width="8" height="11" fill="#e0b25e" opacity=".55" /></pattern>
              <pattern id="lp-win2" width="30" height="30" patternUnits="userSpaceOnUse"><rect x="8" y="8" width="10" height="12" fill="#e0b25e" opacity=".35" /></pattern>
            </defs>
            <rect x="0" y="250" width="160" height="170" fill="#1d1a15" />
            <rect x="0" y="250" width="160" height="170" fill="url(#lp-win2)" />
            <rect x="150" y="200" width="120" height="220" fill="#24201a" />
            <rect x="150" y="200" width="120" height="220" fill="url(#lp-win)" />
            <polygon points="150,200 210,160 270,200" fill="#24201a" />
            <rect x="290" y="270" width="200" height="150" fill="#1a1712" />
            <rect x="290" y="270" width="200" height="150" fill="url(#lp-win2)" />
            <rect x="500" y="120" width="70" height="300" fill="#2a251e" />
            <polygon points="492,120 535,52 578,120" fill="#2a251e" />
            <circle cx="535" cy="160" r="20" fill="#0d0b07" stroke="#e0b25e" strokeWidth="3" opacity=".9" />
            <path d="M535 160 L535 147 M535 160 L544 164" stroke="#e0b25e" strokeWidth="3" />
            <rect x="500" y="200" width="70" height="220" fill="url(#lp-win)" />
            <rect x="590" y="230" width="260" height="190" fill="#211d17" />
            <path d="M610 230 A110 110 0 0 1 830 230 Z" fill="#211d17" />
            <rect x="640" y="300" width="20" height="120" fill="#16130e" />
            <rect x="690" y="300" width="20" height="120" fill="#16130e" />
            <rect x="740" y="300" width="20" height="120" fill="#16130e" />
            <rect x="790" y="300" width="20" height="120" fill="#16130e" />
            <rect x="870" y="180" width="150" height="240" fill="#26221b" />
            <rect x="870" y="180" width="150" height="240" fill="url(#lp-win)" />
            <rect x="1040" y="260" width="180" height="160" fill="#1c1914" />
            <rect x="1040" y="260" width="180" height="160" fill="url(#lp-win2)" />
            <rect x="1230" y="210" width="110" height="210" fill="#24201a" />
            <rect x="1230" y="210" width="110" height="210" fill="url(#lp-win)" />
            <rect x="1340" y="290" width="100" height="130" fill="#1a1712" />
            <rect x="1376" y="250" width="6" height="170" fill="#2e2921" />
            <circle cx="1379" cy="246" r="10" fill="#e0b25e" opacity=".85" />
          </svg>
        </div>
        <div className="lp-fog lp-fog-a" aria-hidden="true" />
        <div className="lp-fog lp-fog-b" aria-hidden="true" />
        <div className="lp-street" aria-hidden="true" />

        <div className="lp-wrap lp-hero-copy">
          <h1 className="lp-logo-head lp-load-logo">
            <img src={headImg} alt="CampusHub" width="1301" height="597" />
          </h1>
          <h2 className="lp-disp lp-headline lp-load" style={{ "--lp-d": "0.55s" }}>Your campus marketplace universe</h2>
          <p className="lp-sub lp-load" style={{ "--lp-d": "0.7s" }}>Buy, sell and offer services to students on your campus.</p>
          <div className="lp-ctas lp-load" style={{ "--lp-d": "0.85s" }}>
            <Link className="lp-btn lp-btn-main" to="/signup" onClick={click}>Sign up</Link>
            <Link className="lp-btn lp-btn-ghost" to="/login" onClick={click}>Log in</Link>
          </div>
        </div>

        <div className="lp-spot" aria-hidden="true" />
        <div className="lp-pool" aria-hidden="true" />
        <div className="lp-walker">
          <img src={mascotGif} alt="The CampusHub mascot, a pixel-art student in a black hoodie" />
        </div>
        <div className="lp-bubble">Welcome to CampusHub!</div>
      </section>

      <div className="lp-wrap lp-cards">
        {[
          [shotMarketplace, "Marketplace page with listings", "Browse", "left top"],
          [shotPost, "Post an item form", "Post it", "38% top"],
          [shotDashboard, "Student dashboard", "Your hub", "left top"],
          [shotServices, "Services page", "Find help", "center top"],
          [shotService, "Service detail page", "Offer skills", "center top"],
        ].map(([src, alt, cap, pos], i) => (
          <figure className="lp-card" key={cap} data-lp="card" data-lp-delay={(0.1 + i * 0.12).toFixed(2)}>
            <img className="lp-shot" src={src} alt={alt} style={{ objectPosition: pos }} />
            <figcaption className="lp-cap">{cap}</figcaption>
          </figure>
        ))}
      </div>

      {/* ═════ HOW IT WORKS ═════ */}
      <Tear fill="#15120d" />
      <section className="lp-band lp-b-route" style={{ color: "#5fb3c4" }}>
        <div className="lp-wrap lp-how">
          <div className="lp-map" data-lp="pop">
            <div className="lp-map-disc">
              <svg viewBox="0 0 400 400" aria-hidden="true">
                <rect x="40" y="60" width="90" height="70" fill="#1b2d31" />
                <rect x="160" y="40" width="70" height="110" fill="#1b2d31" />
                <rect x="260" y="70" width="100" height="60" fill="#1b2d31" />
                <rect x="50" y="170" width="120" height="80" fill="#1b2d31" />
                <rect x="230" y="180" width="120" height="70" fill="#1b2d31" />
                <rect x="70" y="290" width="80" height="70" fill="#1b2d31" />
                <rect x="190" y="280" width="140" height="80" fill="#1b2d31" />
                <path className="lp-map-path" d="M120 90 C 200 120, 160 200, 210 215 S 280 300, 260 330" fill="none" stroke="#f4e6cd" strokeWidth="6" strokeLinecap="round" />
                <circle cx="120" cy="90" r="24" fill="#5fb3c4" stroke="#0d0b07" strokeWidth="4" />
                <text x="120" y="100" textAnchor="middle" fontFamily="Bowlby One, Impact, sans-serif" fontSize="26" fill="#0d0b07">1</text>
                <circle cx="210" cy="215" r="24" fill="#5fb3c4" stroke="#0d0b07" strokeWidth="4" />
                <text x="210" y="225" textAnchor="middle" fontFamily="Bowlby One, Impact, sans-serif" fontSize="26" fill="#0d0b07">2</text>
                <circle cx="260" cy="330" r="24" fill="#e0b25e" stroke="#0d0b07" strokeWidth="4" />
                <text x="260" y="340" textAnchor="middle" fontFamily="Bowlby One, Impact, sans-serif" fontSize="26" fill="#0d0b07">3</text>
              </svg>
            </div>
            <span className="lp-map-label">CAMPUS ROUTE</span>
          </div>
          <div>
            <Banner kicker="Start your journey on" letter="R" title="How it works" color="#5fb3c4" />
            <div className="lp-steps">
              <div className="lp-line" aria-hidden="true" />
              <div data-lp="rise"><Stop n="1" color="#5fb3c4" title="Sign up">Use your student details. It takes about a minute.</Stop></div>
              <div data-lp="rise" data-lp-delay="0.1"><Stop n="2" color="#5fb3c4" title="Get approved">An admin checks you are a real student before you can post.</Stop></div>
              <div data-lp="rise" data-lp-delay="0.2"><Stop n="3" color="#e0b25e" title="Buy, sell or offer">List an item, offer a service, or find what you need on campus.</Stop></div>
            </div>
          </div>
        </div>
      </section>

      {/* ═════ MARKETPLACE LINE ═════ */}
      <Tear fill="#1e160c" flip />
      <section className="lp-band lp-b-bronze" style={{ color: "#e0b25e" }}>
        <div className="lp-wrap">
          <Banner kicker="Hit the books on" letter="M" title="Marketplace" color="#e0b25e" />
          <div className="lp-route">
            <div className="lp-row">
              <div className="lp-laptop" data-lp="left">
                <div className="lp-screen"><img className="lp-shot" src={shotMarketplace} alt="CampusHub Marketplace page" loading="lazy" /></div>
                <img src={laptopImg} alt="" width="1280" height="873" />
              </div>
              <Stop n="1" color="#e0b25e" title="Browse the stalls">
                Search by name, pick a category (books, electronics, clothing, dorm, gaming) and set a price range in Ks.
              </Stop>
            </div>
            <div className="lp-row lp-flip">
              <Frame src={shotPost} alt="Post an item form" from="right" />
              <Stop n="2" color="#e0b25e" title="Post in a minute">
                Add a title, a price in Ks, a category and up to three photos. Your item goes live for every student on campus.
              </Stop>
            </div>
          </div>
          <div className="lp-panel" data-lp="rise" style={{ background: "#2a1f11", border: "3px solid rgba(224,178,94,.35)" }}>
            <div className="lp-icon-art" data-lp="pop" data-lp-delay="0.3">
              <svg viewBox="0 0 120 120" fill="none" stroke="#e0b25e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 26h64a10 10 0 0 1 10 10v30a10 10 0 0 1-10 10H50l-18 16V76H18A10 10 0 0 1 8 66V36a10 10 0 0 1 10-10z" /><path d="M44 44a8 8 0 1 1 10 8c-3 1-4 3-4 6" /><path d="M50 66h.01" /><path d="M100 46h4a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8h-6v12l-14-12H70" opacity=".6" /></svg>
            </div>
            <div>
              <h4>Ask before you buy</h4>
              <h3 className="lp-disp" style={{ color: "#e0b25e" }}>Q&amp;A comments</h3>
              <p>Ask the seller in public under any listing. They answer in the same thread, marked with an Owner badge, so the next buyer sees it too.</p>
            </div>
            <div className="lp-note" data-lp="drop" data-lp-delay="0.45"><span className="lp-ribbon">NEW</span>No private messages yet, so every question and answer lives right on the listing.</div>
          </div>
        </div>
      </section>

      {/* ═════ SERVICES LINE ═════ */}
      <Tear fill="#0f2529" />
      <section className="lp-band lp-b-teal" style={{ color: "#5fb3c4" }}>
        <div className="lp-wrap">
          <Banner kicker="Lend a hand on" letter="S" title="Services" color="#5fb3c4" />
          <div className="lp-route">
            <div className="lp-row">
              <Frame src={shotServices} alt="Services page" from="left" />
              <Stop n="1" color="#5fb3c4" title="Find the right person">
                Tutoring, tech and repair, design, writing, events and photography. Every card puts the student offering it first.
              </Stop>
            </div>
            <div className="lp-row lp-flip">
              <Frame src={shotService} alt="Service detail page" from="right" />
              <Stop n="2" color="#5fb3c4" title="Offer your skills">
                Set one fixed price, add up to three photos, and pause your service when you are too busy to take requests.
              </Stop>
            </div>
          </div>
          <div className="lp-panel" data-lp="rise" style={{ background: "#163338", border: "3px solid rgba(95,179,196,.35)" }}>
            <div className="lp-icon-art" data-lp="pop" data-lp-delay="0.3">
              <svg viewBox="0 0 120 120" fill="none" stroke="#5fb3c4" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M34 14h52a6 6 0 0 1 6 6v88l-32-20-32 20V20a6 6 0 0 1 6-6z" /><path d="M60 38l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" /></svg>
            </div>
            <div>
              <h4>Keep a shortlist with</h4>
              <h3 className="lp-disp" style={{ color: "#5fb3c4" }}>Save</h3>
              <p>Bookmark any listing or service as you browse. Your saved count shows on your Dashboard.</p>
            </div>
            <div className="lp-note" data-lp="drop" data-lp-delay="0.45"><span className="lp-ribbon">TIP</span>Save a few tutors before exam week and compare their prices.</div>
          </div>
        </div>
      </section>

      {/* ═════ SAFE CAMPUS LINE ═════ */}
      <Tear fill="#132015" flip />
      <section className="lp-band lp-b-green" style={{ color: "#8fcf6a" }}>
        <div className="lp-wrap">
          <Banner kicker="Keep it clean on" letter="C" title="Safe Campus" color="#8fcf6a" />
          <div className="lp-route">
            <div className="lp-row">
              <Frame src={shotDashboard} alt="Dashboard showing an approved student" from="left" position="left top" />
              <div className="lp-stop" style={{ gap: 28 }}>
                {[
                  ["1", "Students only", "Every account is approved by an admin before it can post."],
                  ["2", "Report anything", "Flag a listing, service or comment as a scam, prohibited, offensive, spam or something else."],
                  ["3", "Admins act", "Reported content can be removed and repeat offenders banned."],
                ].map(([n, t, d], i) => (
                  <div className="lp-stop-h" key={n} data-lp="rise" data-lp-delay={(i * 0.12).toFixed(2)}>
                    <span className="lp-num" style={{ background: "#8fcf6a" }}>{n}</span>
                    <div>
                      <h3 className="lp-disp">{t}</h3>
                      <p>{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lp-panel" data-lp="rise" style={{ background: "#1c2f1f", border: "3px solid rgba(143,207,106,.35)", marginTop: 150 }}>
            <img className="lp-popout" src={mascotGif} alt="" aria-hidden="true" />
            <div className="lp-icon-art" data-lp="pop" data-lp-delay="0.3">
              <svg viewBox="0 0 120 120" fill="none" stroke="#8fcf6a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M60 10l38 14v30c0 26-17 44-38 54-21-10-38-28-38-54V24z" /><path d="M42 60l12 12 24-26" /></svg>
            </div>
            <div>
              <h4>Watch out for</h4>
              <h3 className="lp-disp" style={{ color: "#8fcf6a" }}>Deals too good to be true</h3>
              <p>Meet on campus, check the item before you pay, and report anything that feels off. Reports go only to admins.</p>
            </div>
            <div className="lp-note" data-lp="drop" data-lp-delay="0.45"><span className="lp-ribbon">SAFETY</span>Your report is private. The poster is never told who reported them.</div>
          </div>
        </div>
      </section>

      {/* ═════ FINALE ═════ */}
      <Tear fill="#0d0b07" />
      <section className="lp-band lp-b-end" style={{ paddingBottom: 40 }}>
        <div className="lp-wrap lp-final">
          <span className="lp-kicker" style={{ background: "#e0b25e" }} data-lp="drop">Last stop</span>
          <h2 className="lp-disp" data-lp="blur" data-lp-delay="0.1">Ready to join?</h2>
          <p className="lp-sub" data-lp="rise" data-lp-delay="0.2">Sign up with your student details and start trading once an admin approves you.</p>
          <div className="lp-ctas" data-lp="rise" data-lp-delay="0.3">
            <Link className="lp-btn lp-btn-main" to="/signup" onClick={click}>Sign up</Link>
            <Link className="lp-btn lp-btn-ghost" to="/login" onClick={click}>Log in</Link>
          </div>
        </div>
        <div className="lp-wrap lp-foot">
          <span>CampusHub © {new Date().getFullYear()}</span>
          <span>Student marketplace · Finishing school project</span>
        </div>
      </section>
    </div>
  );
}
