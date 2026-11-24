import snowtifyTopbarIcon from "./assets/snowtify-topbar-icon.png";
import { waitFor } from "./shared/async.js";
import { isNewerVersion } from "./shared/version.js";

const updateCommand = "snowtify update";
const guardCommand = "snowtify guard install";
const guardURL = "http://127.0.0.1:47823";
const updateButtonIcon = `<img src="${snowtifyTopbarIcon}" alt="" aria-hidden="true" draggable="false" style="display:block;width:24px;height:24px;object-fit:contain;pointer-events:none">`;

const strings = {
  en: {
    updating: "Updating Snowtify",
    kept: "Your themes, extensions and settings stay exactly as they are.",
    downloading: "Downloading the new version",
    applying: "Applying your theme and extensions",
    restarting: "Restarting Spotify",
    slow: "This is taking longer than usual. You can keep listening; Snowtify will finish in the background.",
    failed: "The update could not be installed. Nothing was changed.",
    dismiss: "Continue",
    label: "Update available",
    title: "A fresh Snowtify build is ready",
    intro: "Turn on automatic updates once and Snowtify will update itself right here, with no commands.",
    enable: "Enable automatic updates (once)",
    manual: "Or update now",
    copyEnable: "Copy command",
    copyUpdate: "Copy update command",
    copied: "Command copied — paste it in PowerShell",
    notes: "Release notes",
    whatsNew: "What's new",
    stepOf: "Step {n} of {total}",
  },
  es: {
    updating: "Actualizando Snowtify",
    kept: "Tus temas, extensiones y ajustes se quedan tal cual.",
    downloading: "Descargando la nueva versión",
    applying: "Aplicando tu tema y extensiones",
    restarting: "Reiniciando Spotify",
    slow: "Está tardando más de lo normal. Puedes seguir escuchando; Snowtify terminará en segundo plano.",
    failed: "No se pudo instalar la actualización. No se ha cambiado nada.",
    dismiss: "Continuar",
    label: "Actualización disponible",
    title: "Hay una nueva versión de Snowtify",
    intro: "Activa las actualizaciones automáticas una vez y Snowtify se actualizará solo aquí mismo, sin comandos.",
    enable: "Activar actualizaciones automáticas (una vez)",
    manual: "O actualiza ahora",
    copyEnable: "Copiar comando",
    copyUpdate: "Copiar comando de actualización",
    copied: "Comando copiado: pégalo en PowerShell",
    notes: "Novedades",
    whatsNew: "Qué hay de nuevo",
    stepOf: "Paso {n} de {total}",
  },
};

function t(key) {
  let locale = "en";
  try {
    locale = String(Spicetify.Locale?.getLocale?.() ?? navigator.language ?? "en");
  } catch {}
  const table = locale.toLowerCase().startsWith("es") ? strings.es : strings.en;
  return table[key] ?? strings.en[key];
}

async function guardRequest(path, options = {}) {
  const response = await fetch(`${guardURL}${path}`, {
    ...options,
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok && response.status !== 409) throw new Error(`Guard returned ${response.status}`);
  return response.json();
}

const overlayStyles = `
  #snowtify-updater { --ice: #8fe3fb; --ice-soft: #c9f1ff; --ink: #05121a; --text: #eef8fc; --muted: #8ea4ae; --faint: #4d626b;
    position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; padding: 20px; overflow: hidden;
    background: radial-gradient(90% 70% at 50% 0%, rgba(143, 227, 251, 0.10), transparent 65%),
      radial-gradient(120% 120% at 50% 120%, rgba(0, 0, 0, 0.55), transparent 60%), rgba(4, 10, 14, 0.78);
    backdrop-filter: blur(28px) saturate(120%); -webkit-backdrop-filter: blur(28px) saturate(120%);
    color: var(--text); font-family: var(--font-family, "SpotifyMixUI", system-ui, sans-serif);
    -webkit-font-smoothing: antialiased; animation: su-fade 420ms ease-out both; }
  #snowtify-updater * { box-sizing: border-box; }
  #snowtify-updater canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  #snowtify-updater .su-card { position: relative; width: min(440px, 100%); padding: 28px 28px 22px;
    border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.07);
    background: linear-gradient(180deg, rgba(16, 30, 37, 0.86), rgba(8, 17, 22, 0.9));
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 40px 100px -20px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(0, 0, 0, 0.35);
    animation: su-rise 640ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  #snowtify-updater .su-card::before { content: ""; position: absolute; inset: -1px 24px auto; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(143, 227, 251, 0.55), transparent); }
  #snowtify-updater .su-head { display: flex; align-items: center; gap: 16px; }
  #snowtify-updater .su-mark { position: relative; flex: none; width: 60px; height: 60px; display: grid; place-items: center; }
  #snowtify-updater .su-mark svg { position: absolute; inset: 0; width: 100%; height: 100%; animation: su-spin 1.6s linear infinite; }
  #snowtify-updater .su-mark img { width: 34px; height: 34px; object-fit: contain; filter: drop-shadow(0 0 10px rgba(143, 227, 251, 0.35)); }
  #snowtify-updater .su-eyebrow { display: block; margin-bottom: 4px; color: var(--ice); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  #snowtify-updater h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.25; }
  #snowtify-updater .su-versions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 20px 0 0; }
  #snowtify-updater .su-pill { padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03); color: var(--muted); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
  #snowtify-updater .su-pill[data-new] { border-color: rgba(143, 227, 251, 0.35); background: rgba(143, 227, 251, 0.08); color: var(--ice-soft); }
  #snowtify-updater .su-versions svg { width: 14px; height: 14px; color: var(--faint); }
  #snowtify-updater .su-progress { margin: 22px 0 0; }
  #snowtify-updater .su-meta { display: flex; justify-content: space-between; margin-bottom: 8px; color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  #snowtify-updater .su-meta strong { color: var(--text); font-weight: 600; }
  #snowtify-updater .su-track { position: relative; height: 3px; border-radius: 999px; background: rgba(255, 255, 255, 0.07); overflow: hidden; }
  #snowtify-updater .su-fill { position: absolute; inset: 0 auto 0 0; width: 0; border-radius: inherit;
    background: linear-gradient(90deg, #4fc9ef, var(--ice-soft)); box-shadow: 0 0 12px rgba(143, 227, 251, 0.6); }
  #snowtify-updater .su-fill::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
    animation: su-sheen 1.8s ease-in-out infinite; }
  #snowtify-updater ol { position: relative; display: grid; gap: 14px; margin: 22px 0 0; padding: 0; list-style: none; }
  #snowtify-updater ol::before { content: ""; position: absolute; left: 9px; top: 10px; bottom: 10px; width: 1px; background: rgba(255, 255, 255, 0.08); }
  #snowtify-updater li { position: relative; display: flex; align-items: center; gap: 14px; color: var(--faint); font-size: 13px; font-weight: 500; transition: color 400ms; }
  #snowtify-updater li .su-dot { position: relative; flex: none; width: 19px; height: 19px; display: grid; place-items: center; border-radius: 50%;
    background: #0b171d; border: 1px solid rgba(255, 255, 255, 0.12); transition: all 400ms; }
  #snowtify-updater li .su-dot::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: 0.6; }
  #snowtify-updater li .su-dot svg { display: none; width: 11px; height: 11px; }
  #snowtify-updater li[data-state="active"] { color: var(--text); }
  #snowtify-updater li[data-state="active"] .su-dot { border-color: rgba(143, 227, 251, 0.25); border-top-color: var(--ice); animation: su-spin 0.9s linear infinite; }
  #snowtify-updater li[data-state="active"] .su-dot::before { background: var(--ice); opacity: 1; }
  #snowtify-updater li[data-state="done"] { color: var(--muted); }
  #snowtify-updater li[data-state="done"] .su-dot { background: var(--ice); border-color: var(--ice); color: var(--ink); }
  #snowtify-updater li[data-state="done"] .su-dot::before { display: none; }
  #snowtify-updater li[data-state="done"] .su-dot svg { display: block; animation: su-pop 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
  #snowtify-updater .su-foot { display: flex; align-items: center; gap: 10px; margin: 22px -28px 0; padding: 16px 28px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.06); color: var(--muted); font-size: 12px; line-height: 1.5; }
  #snowtify-updater .su-foot svg { flex: none; width: 16px; height: 16px; color: var(--ice); }
  #snowtify-updater .su-foot[data-tone="error"] { color: #ffb3ab; }
  #snowtify-updater .su-foot[data-tone="error"] svg { color: #ff8a7f; }
  #snowtify-updater button { display: block; width: 100%; margin-top: 16px; min-height: 40px; border: 0; border-radius: 10px; cursor: pointer;
    background: var(--ice-soft); color: var(--ink); font: inherit; font-size: 13px; font-weight: 700; transition: background 200ms; }
  #snowtify-updater button:hover { background: #fff; }
  #snowtify-updater[data-stalled] .su-mark svg, #snowtify-updater[data-stalled] li .su-dot { animation-play-state: paused; }
  #snowtify-updater[data-leaving] { animation: su-fade 280ms ease-in reverse both; }
  @keyframes su-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes su-rise { from { opacity: 0; transform: translateY(16px) scale(0.98); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
  @keyframes su-spin { to { transform: rotate(360deg); } }
  @keyframes su-sheen { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
  @keyframes su-pop { from { transform: scale(0.3); opacity: 0; } to { transform: none; opacity: 1; } }
  @media (max-width: 420px) { #snowtify-updater .su-card { padding: 22px 20px 18px; } #snowtify-updater .su-foot { margin-inline: -20px; padding-inline: 20px; } }
  @media (max-height: 480px) { #snowtify-updater ol { display: none; } }
  @media (prefers-reduced-motion: reduce) {
    #snowtify-updater, #snowtify-updater * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
  }
`;

const steps = ["downloading", "applying", "restarting"];
const stepProgress = [
  [4, 30],
  [34, 82],
  [86, 99],
];

const icons = {
  ring: `<svg viewBox="0 0 60 60" aria-hidden="true"><defs><linearGradient id="su-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fe3fb" stop-opacity="0"/><stop offset="1" stop-color="#c9f1ff"/></linearGradient></defs><circle cx="30" cy="30" r="28" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.5"/><circle cx="30" cy="30" r="28" fill="none" stroke="url(#su-ring)" stroke-width="2" stroke-linecap="round" stroke-dasharray="70 106"/></svg>`,
  arrow: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`,
  check: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.2 5 8.5l4.5-5"/></svg>`,
  shield: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.5 2.5 3.5v4c0 3.3 2.3 5.9 5.5 7 3.2-1.1 5.5-3.7 5.5-7v-4L8 1.5Z"/><path d="m5.6 8 1.7 1.7 3.2-3.4" stroke-linecap="round"/></svg>`,
};

// Layered snowfall on a canvas: far flakes are small, dim and slow; near
// flakes are larger and faster, with a gentle shared wind. Stops itself when
// the overlay is removed and draws a still frame for reduced motion.
function startSnow(canvas) {
  const context = canvas.getContext("2d");
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let width = 0;
  let height = 0;
  let flakes = [];

  const spawn = (anywhere) => {
    const depth = Math.random() ** 1.6; // more far flakes than near ones
    return {
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : -10,
      r: 0.6 + depth * 2.6,
      speed: 14 + depth * 58,
      alpha: 0.22 + depth * 0.65,
      sway: 6 + Math.random() * 18,
      phase: Math.random() * Math.PI * 2,
      depth,
    };
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(220, Math.round((width * height) / 7000));
    flakes = Array.from({ length: count }, () => spawn(true));
  };

  const draw = (time) => {
    context.clearRect(0, 0, width, height);
    for (const flake of flakes) {
      const x = flake.x + Math.sin(time / 1000 + flake.phase) * flake.sway;
      context.globalAlpha = flake.alpha;
      context.beginPath();
      context.arc(x, flake.y, flake.r, 0, Math.PI * 2);
      context.fill();
    }
  };

  resize();
  context.fillStyle = "#e9f8ff";
  window.addEventListener("resize", resize);

  if (reduced) {
    draw(0);
    return () => window.removeEventListener("resize", resize);
  }

  let last = performance.now();
  let frame = 0;
  const loop = (now) => {
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;
    const wind = Math.sin(now / 4200) * 14;
    for (let i = 0; i < flakes.length; i++) {
      const flake = flakes[i];
      flake.y += flake.speed * delta;
      flake.x += wind * flake.depth * delta;
      if (flake.y > height + 10 || flake.x < -30 || flake.x > width + 30) flakes[i] = spawn(false);
    }
    context.fillStyle = "#e9f8ff";
    draw(now);
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", resize);
  };
}

function createUpdatingOverlay({ currentVersion, latestVersion }) {
  const root = document.createElement("div");
  root.id = "snowtify-updater";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-live", "polite");

  root.innerHTML = `
    <style>${overlayStyles}</style>
    <canvas aria-hidden="true"></canvas>
    <div class="su-card">
      <div class="su-head">
        <div class="su-mark">${icons.ring}<img src="${snowtifyTopbarIcon}" alt="" draggable="false"></div>
        <div><span class="su-eyebrow" data-eyebrow></span><h2></h2></div>
      </div>
      <div class="su-versions"><span class="su-pill" data-current></span>${icons.arrow}<span class="su-pill" data-new data-latest></span></div>
      <div class="su-progress">
        <div class="su-meta"><span data-step-count></span><strong data-percent>0%</strong></div>
        <div class="su-track"><div class="su-fill"></div></div>
      </div>
      <ol>${steps.map((step) => `<li data-step="${step}"><span class="su-dot">${icons.check}</span><span data-label></span></li>`).join("")}</ol>
      <p class="su-foot">${icons.shield}<span data-note></span></p>
    </div>
  `;
  root.querySelector("h2").textContent = t("updating");
  root.querySelector("[data-eyebrow]").textContent = t("label");
  root.querySelector("[data-current]").textContent = `v${currentVersion}`;
  root.querySelector("[data-latest]").textContent = `v${latestVersion}`;
  for (const step of steps) root.querySelector(`[data-step="${step}"] [data-label]`).textContent = t(step);
  const foot = root.querySelector(".su-foot");
  const note = root.querySelector("[data-note]");
  note.textContent = t("kept");

  // Progress eases toward the current step's range and keeps creeping inside
  // it, so the bar never looks frozen while a step is running.
  const fill = root.querySelector(".su-fill");
  const percentLabel = root.querySelector("[data-percent]");
  let stepIndex = 0;
  let shown = 0;
  let stepStarted = performance.now();
  let progressFrame = 0;
  const animateProgress = (now) => {
    const [from, to] = stepProgress[stepIndex];
    const creep = from + (to - from) * (1 - Math.exp(-(now - stepStarted) / 9000));
    shown += (creep - shown) * 0.08;
    fill.style.width = `${shown.toFixed(2)}%`;
    percentLabel.textContent = `${Math.round(shown)}%`;
    progressFrame = requestAnimationFrame(animateProgress);
  };
  progressFrame = requestAnimationFrame(animateProgress);

  const setStep = (current) => {
    const index = Math.max(0, steps.indexOf(current));
    if (index !== stepIndex) {
      stepIndex = Math.max(stepIndex, index);
      stepStarted = performance.now();
    }
    root.querySelectorAll("li").forEach((item, i) => {
      item.dataset.state = i < stepIndex ? "done" : i === stepIndex ? "active" : "pending";
    });
    root.querySelector("[data-step-count]").textContent = t("stepOf")
      .replace("{n}", String(stepIndex + 1))
      .replace("{total}", String(steps.length));
  };

  let stopSnow = () => {};
  const close = () => {
    root.dataset.leaving = "";
    setTimeout(() => {
      cancelAnimationFrame(progressFrame);
      stopSnow();
      root.remove();
    }, 280);
  };

  const fail = (message, tone = "error") => {
    note.textContent = message;
    foot.dataset.tone = tone;
    root.dataset.stalled = "";
    if (!root.querySelector("button")) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = t("dismiss");
      button.addEventListener("click", close);
      root.querySelector(".su-card").append(button);
      button.focus();
    }
  };

  setStep("downloading");
  document.body.append(root);
  // Start after insertion so the canvas has real dimensions.
  stopSnow = startSnow(root.querySelector("canvas"));
  return { setStep, fail, close };
}

// Runs the update through the guard. Resolves once the guard reports a
// failure; on success the guard restarts Spotify and this page goes away.
async function runGuardUpdate(status) {
  const overlay = createUpdatingOverlay({ currentVersion: status.version, latestVersion: status.latest });
  try {
    await guardRequest("/update", { method: "POST" });
  } catch {
    overlay.fail(t("failed"));
    return;
  }

  const startedAt = Date.now();
  let warnedSlow = false;
  let unreachable = 0;
  const poll = async () => {
    try {
      const current = await guardRequest("/status");
      unreachable = 0;
      if (current.phase === "error") return overlay.fail(current.message || t("failed"));
      overlay.setStep(current.version === status.latest ? "restarting" : current.step || "downloading");
    } catch {
      // The guard restarts itself after installing the update.
      if (++unreachable > 40) return overlay.fail(t("slow"), "info");
      overlay.setStep("restarting");
    }
    if (!warnedSlow && Date.now() - startedAt > 180000) {
      warnedSlow = true;
      overlay.fail(t("slow"), "info");
    }
    setTimeout(poll, 700);
  };
  setTimeout(poll, 700);
}

function getReleaseHighlights(body) {
  return String(body ?? "")
    .split("\n")
    .map((line) => line.match(/^[-*]\s+(.+)/)?.[1])
    .filter(Boolean)
    .slice(0, 4)
    .map((line) => line.replaceAll(/\*\*|`/g, "").replaceAll(/\[([^\]]+)]\([^)]+\)/g, "$1"));
}

// Fallback when the guard is not installed: explain how to enable automatic
// updates once, and still offer the manual command.
function createUpdateContent({ currentVersion, latestVersion, releaseUrl, releaseBody }) {
  const content = document.createElement("div");
  content.id = "snowtify-update";
  content.innerHTML = `
    <style>
      #snowtify-update { --snowtify-ice: #b9eaff; --snowtify-ink: #06141b; width: min(100%, 480px); color: var(--spice-text); }
      #snowtify-update * { box-sizing: border-box; }
      #snowtify-update .su-hero { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 14px; align-items: center; padding-bottom: 18px; border-bottom: 1px solid var(--spice-highlight-elevated); }
      #snowtify-update .su-logo { width: 52px; height: 52px; padding: 7px; object-fit: contain; border: 1px solid var(--spice-highlight-elevated); background: var(--spice-main); border-radius: 12px; }
      #snowtify-update .su-label { display: block; margin-bottom: 5px; color: var(--snowtify-ice); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
      #snowtify-update h2 { margin: 0; font-size: 21px; line-height: 1.2; }
      #snowtify-update .su-versions { margin-top: 9px; color: var(--spice-subtext); font-size: 12px; }
      #snowtify-update .su-versions strong { color: var(--snowtify-ice); }
      #snowtify-update .su-intro { margin: 16px 0; color: var(--spice-subtext); font-size: 13px; line-height: 1.5; }
      #snowtify-update details { margin: 0 0 16px; border-block: 1px solid var(--spice-highlight-elevated); }
      #snowtify-update summary { display: flex; align-items: center; justify-content: space-between; min-height: 42px; font-size: 13px; font-weight: 700; cursor: pointer; list-style: none; }
      #snowtify-update summary::-webkit-details-marker { display: none; }
      #snowtify-update summary::after { content: "+"; color: var(--snowtify-ice); font-size: 20px; font-weight: 400; }
      #snowtify-update details[open] summary::after { content: "−"; }
      #snowtify-update ul { max-height: 120px; margin: 0 0 14px; padding: 0 0 0 18px; overflow-y: auto; color: var(--spice-subtext); }
      #snowtify-update li { margin: 6px 0; font-size: 12px; line-height: 1.45; }
      #snowtify-update .su-cmd-label { display: block; margin: 14px 0 8px; color: var(--spice-subtext); font-size: 11px; font-weight: 600; }
      #snowtify-update .su-cmd { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 6px 6px 14px; border: 1px solid var(--spice-highlight-elevated); background: var(--spice-main); border-radius: 10px; }
      #snowtify-update code { flex: 1; overflow-wrap: anywhere; color: var(--snowtify-ice); font-size: 13px; }
      #snowtify-update button { flex: none; min-height: 36px; padding: 0 14px; border: 0; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; background: var(--snowtify-ice); color: var(--snowtify-ink); }
      #snowtify-update button:hover { background: #d7f4ff; }
      #snowtify-update button[data-secondary] { background: var(--spice-highlight); color: var(--spice-text); }
      #snowtify-update .su-release { display: inline-block; margin-top: 14px; color: var(--spice-subtext); font-size: 12px; }
      @media (max-width: 520px) { #snowtify-update .su-cmd { flex-wrap: wrap; } #snowtify-update button { width: 100%; } }
    </style>
    <div class="su-hero">
      <img class="su-logo" src="${snowtifyTopbarIcon}" alt="" aria-hidden="true" draggable="false">
      <div>
        <span class="su-label"></span>
        <h2></h2>
        <div class="su-versions"><span data-current></span> → <strong data-latest></strong></div>
      </div>
    </div>
    <p class="su-intro"></p>
    <details data-highlights-section><summary></summary><ul data-highlights></ul></details>
    <span class="su-cmd-label" data-enable-label></span>
    <div class="su-cmd"><code data-enable-code></code><button type="button" data-copy="${guardCommand}"></button></div>
    <span class="su-cmd-label" data-manual-label></span>
    <div class="su-cmd"><code data-manual-code></code><button type="button" data-secondary data-copy="${updateCommand}"></button></div>
    <a class="su-release" target="_blank" rel="noopener noreferrer"></a>
  `;

  const set = (selector, text) => (content.querySelector(selector).textContent = text);
  set(".su-label", t("label"));
  set("h2", t("title"));
  set("[data-current]", `v${currentVersion}`);
  set("[data-latest]", `v${latestVersion}`);
  set(".su-intro", t("intro"));
  set("summary", t("whatsNew"));
  set("[data-enable-label]", t("enable"));
  set("[data-enable-code]", guardCommand);
  set("[data-manual-label]", t("manual"));
  set("[data-manual-code]", updateCommand);
  set(`[data-copy="${guardCommand}"]`, t("copyEnable"));
  set(`[data-copy="${updateCommand}"]`, t("copyUpdate"));
  set(".su-release", `${t("notes")} ↗`);
  content.querySelector(".su-release").href = releaseUrl;

  const highlights = getReleaseHighlights(releaseBody);
  if (highlights.length === 0) {
    content.querySelector("[data-highlights-section]").remove();
  } else {
    const list = content.querySelector("[data-highlights]");
    for (const highlight of highlights) {
      const item = document.createElement("li");
      item.textContent = highlight;
      list.append(item);
    }
  }

  content.querySelectorAll("[data-copy]").forEach((button) =>
    button.addEventListener("click", () => {
      Spicetify.Platform.ClipboardAPI.copy(button.dataset.copy);
      Spicetify.showNotification(t("copied"));
    }),
  );

  return content;
}

async function showManualUpdate(currentVersion) {
  const response = await fetch("https://api.github.com/repos/SnoW-099/snowtify/releases/latest", {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);

  const release = await response.json();
  const latestVersion = String(release.tag_name ?? "").replace(/^v/i, "");
  if (!isNewerVersion(latestVersion, currentVersion)) return;

  const updateModal = {
    title: "Snowtify",
    content: createUpdateContent({ currentVersion, latestVersion, releaseUrl: release.html_url, releaseBody: release.body }),
    isLarge: false,
  };

  new Spicetify.Topbar.Button(t("label"), updateButtonIcon, () => Spicetify.PopupModal.display(updateModal));
  await waitFor(() => Spicetify.PopupModal?.display, 300);
  Spicetify.PopupModal.display(updateModal);
}

void (async function checkForUpdate() {
  if (!Spicetify.Config) {
    setTimeout(checkForUpdate, 300);
    return;
  }

  const { check_spicetify_update: checkForUpdates, version: currentVersion } = Spicetify.Config;
  if (!checkForUpdates || !currentVersion || currentVersion === "Dev") return;

  let guardStatus = null;
  try {
    guardStatus = await guardRequest("/status");
  } catch {}

  try {
    if (guardStatus) {
      if (guardStatus.updateAvailable && guardStatus.latest && isNewerVersion(guardStatus.latest, currentVersion)) {
        await waitFor(() => document.body, 100);
        await runGuardUpdate(guardStatus);
      }
      return;
    }
    await showManualUpdate(currentVersion);
  } catch (error) {
    console.warn("[Snowtify] Could not check for updates", error);
  }
})();
