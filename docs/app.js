"use strict";

/* ---------------------------------------------------------------------------
 * Snowtify website
 * - i18n (English in the HTML, Spanish below), auto-detected and switchable
 * - live release version from GitHub (cached for an hour)
 * - copy buttons, snowfall canvas, update-card demo, scroll reveals
 * - docs search + active section highlighting (docs.html)
 * ------------------------------------------------------------------------- */

const REPO = "SnoW-099/snowtify";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- i18n ---------- */

const es = {
  skip: "Saltar al contenido",
  copy: "Copiar",
  copied: "Copiado al portapapeles",
  "nav.repair": "Auto-reparación",
  "nav.updates": "Actualizaciones",
  "nav.features": "Funciones",
  "nav.themes": "Temas",
  "nav.docs": "Docs",
  "nav.install": "Instalar",
  "hero.new": "Nuevo",
  "hero.pill": "Auto-reparación y actualizaciones en la app",
  "hero.title1": "Tu Spotify,",
  "hero.title2": "bajo cero.",
  "hero.lead": "Temas, extensiones y Marketplace para Spotify — y cuando Spotify se actualiza solo, Snowtify lo vuelve a dejar todo como estaba.",
  "hero.install": "Instalar en Windows",
  "hero.docs": "Ver la documentación",
  "hero.hint": "Pégalo en PowerShell como usuario normal. Se conservan tus temas y extensiones actuales.",
  "trust.1a": "Nunca se queda roto",
  "trust.1b": "Vuelve a Spotify original si algo falla",
  "trust.2a": "Se arregla solo",
  "trust.2b": "Reaplicado segundos después de que Spotify se actualice",
  "trust.3a": "Listo para Marketplace",
  "trust.3b": "Todos los temas y extensiones de Spicetify",
  "trust.4a": "Ultraligero",
  "trust.4b": "En reposo en segundo plano, sin ventanas",
  "repair.label": "Hecho para volver",
  "repair.title": "¿Spotify se actualizó? Ya está arreglado.",
  "repair.lead": "Spotify se actualiza solo y borra toda la personalización. El guardián de Snowtify lo detecta en segundos y lo deja todo como estaba, antes de que abras una playlist.",
  "repair.s1a": "Spotify se actualiza solo",
  "repair.s1b": "Sus archivos nuevos sustituyen tu tema y extensiones.",
  "repair.s2a": "El guardián lo detecta",
  "repair.s2b": "Una comprobación mínima cada pocos segundos ve el cambio.",
  "repair.s3a": "Todo vuelve",
  "repair.s3b": "Snowtify reaplica tu configuración exacta y reinicia Spotify.",
  "repair.safeA": "Nunca un Spotify roto.",
  "repair.safeB": "Si un Spotify recién salido aún no es compatible, Snowtify restaura el Spotify original y lo vuelve a intentar en cuanto haya actualización.",
  "repair.log": "Registro en vivo",
  "log.1": "Spotify actualizado 1.3.6 → 1.3.9",
  "log.2": "Falta la personalización — confirmando…",
  "log.3": "Regenerando copia de seguridad para Spotify 1.3.9",
  "log.4": "Tema, extensiones y apps reaplicados",
  "log.5": "✓ Reparación completada · Spotify reiniciado",
  "updates.label": "Actualizaciones sin comandos",
  "updates.title": "¿Versión nueva? Se instala sola.",
  "updates.lead": "Cuando sale una versión nueva de Snowtify, la verás dentro de Spotify. Se descarga, reaplica tu configuración y reinicia Spotify — sin PowerShell, sin copiar y pegar.",
  "updates.replay": "Repetir",
  "updates.c1a": "Mantiene tu configuración.",
  "updates.c1b": "Temas, extensiones, apps y ajustes se quedan como están.",
  "updates.c2a": "Al día con Spicetify.",
  "updates.c2b": "Las nuevas versiones de Spicetify se integran y publican en horas.",
  "updates.c3a": "Seguro por diseño.",
  "updates.c3b": "Solo el propio Spotify puede pedir al guardián que actualice; las webs no.",
  "features.label": "Lo esencial",
  "features.title": "Todo lo que hace Spicetify. Sin tener que vigilarlo.",
  "features.lead": "Snowtify es un fork de Spicetify CLI centrado en la estabilidad, así que todo el ecosistema sigue funcionando.",
  "f.1a": "Temas",
  "f.1b": "Cambia el color y el estilo de cada parte de Spotify, desde Marketplace o con tu propio CSS.",
  "f.2a": "Extensiones",
  "f.2b": "Añade funciones al reproductor: letras, mejoras del aleatorio, estadísticas y cientos más.",
  "f.3a": "Apps personalizadas",
  "f.3b": "Páginas nuevas dentro de Spotify, incluido el propio Marketplace.",
  "f.4a": "Doctor y registros",
  "f.4b": "<code>snowtify doctor</code> lo revisa todo sin tocar nada; <code>logs</code> te enseña qué pasó.",
  "f.5a": "Tu tema es tuyo",
  "f.5b": "Snowtify nunca cambia tu tema. Instala, actualiza, repara: tu estilo no se toca.",
  "f.6a": "Código abierto",
  "f.6b": "LGPL-2.1, basado en Spicetify CLI. Lee cada línea en GitHub.",
  "themes.label": "Tu estilo",
  "themes.title": "Spotify, a tu manera.",
  "themes.lead": "Cientos de temas de la comunidad en Marketplace funcionan sin hacer nada.",
  "themes.credit": "Capturas de temas de",
  "faq.label": "Preguntas",
  "faq.title": "Conviene saber",
  "faq.q1": "Ya uso Spicetify. ¿Pierdo algo?",
  "faq.a1": "No. Snowtify usa la misma carpeta de configuración, así que tus temas, extensiones y Marketplace se quedan exactamente igual.",
  "faq.q2": "¿Qué pasa cuando Spotify se actualiza?",
  "faq.a2": "El guardián reaplica Snowtify automáticamente, normalmente en menos de un minuto. Si esa versión de Spotify aún no es compatible, restaura el Spotify original para que siga funcionando y lo reintenta cuando salga una actualización de Snowtify.",
  "faq.q3": "¿El guardián ralentiza el PC?",
  "faq.a3": "No. Lee una carpeta cada pocos segundos y el resto del tiempo duerme. Solo trabaja de verdad justo después de que Spotify se actualice.",
  "faq.q4": "¿Es seguro?",
  "faq.a4": "Snowtify solo toca los archivos de la interfaz de Spotify y guarda una copia de seguridad limpia. El guardián solo escucha en tu propio ordenador y solo acepta peticiones de Spotify.",
  "faq.q5": "¿Cómo lo desinstalo?",
  "faq.a5": "Ejecuta el desinstalador de la documentación. Primero restaura Spotify y luego elimina Snowtify; el resto de tu configuración de Spicetify no se toca.",
  "cta.title": "Haz Spotify tuyo.",
  "cta.lead": "Un comando. Después, se cuida solo.",
  "footer.by": "Un proyecto independiente de SnoW-099, basado en Spicetify CLI. Sin relación con Spotify.",
  "footer.releases": "Versiones",
  "uc.label": "Actualización disponible",
  "uc.title": "Actualizando Snowtify",
  "uc.done": "Snowtify está al día",
  "uc.s1": "Descargando la nueva versión",
  "uc.s2": "Aplicando tu tema y extensiones",
  "uc.s3": "Reiniciando Spotify",
  "uc.step": "Paso {n} de 3",
  "uc.finished": "Listo",
  "uc.kept": "Tus temas, extensiones y ajustes se quedan tal cual.",
};

const en = {
  "uc.label": "Update available",
  "uc.title": "Updating Snowtify",
  "uc.done": "Snowtify is up to date",
  "uc.s1": "Downloading the new version",
  "uc.s2": "Applying your theme and extensions",
  "uc.s3": "Restarting Spotify",
  "uc.step": "Step {n} of 3",
  "uc.finished": "Done",
  "uc.kept": "Your themes, extensions and settings stay exactly as they are.",
};

// English strings live in the HTML; capture them once so switching back works.
const i18nNodes = [...document.querySelectorAll("[data-i18n]")];
i18nNodes.forEach((node) => {
  en[node.dataset.i18n] ??= node.innerHTML;
});

let lang = "en";
const t = (key) => (lang === "es" ? es[key] : undefined) ?? en[key] ?? key;

function setLanguage(next) {
  if (!i18nNodes.length) return; // docs.html is English-only
  lang = next === "es" ? "es" : "en";
  document.documentElement.lang = lang;
  i18nNodes.forEach((node) => {
    node.innerHTML = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-lang]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.lang === lang)));
  try {
    localStorage.setItem("snowtify-lang", lang);
  } catch {}
  document.dispatchEvent(new CustomEvent("languagechange"));
}

document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => setLanguage(button.dataset.lang)));

let savedLang = null;
try {
  savedLang = localStorage.getItem("snowtify-lang");
} catch {}
const browserLang = (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en";
setLanguage(savedLang || browserLang);

/* ---------- Icons ---------- */

const renderIcons = () => window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
window.addEventListener("load", renderIcons);

/* ---------- Header ---------- */

const topbar = document.querySelector(".topbar");
const onScroll = () => topbar?.classList.toggle("scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---------- Copy buttons ---------- */

const toast = document.getElementById("toast");
let toastTimer = 0;

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy]");
  if (!button) return;
  const source = document.getElementById(button.dataset.copy);
  if (!source) return;
  try {
    await navigator.clipboard.writeText(source.textContent.trim());
  } catch {
    const range = document.createRange();
    range.selectNodeContents(source);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    document.execCommand("copy");
  }
  button.classList.add("copied");
  setTimeout(() => button.classList.remove("copied"), 1600);
  if (toast) {
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }
});

/* ---------- Live release version ---------- */

let latestVersion = "2.46.7-snow.2";

function previousVersion(version) {
  const match = version.match(/^(.*-snow\.)(\d+)$/);
  return match && +match[2] > 1 ? `${match[1]}${+match[2] - 1}` : version.replace(/-snow\.\d+$/, "-snow.0");
}

async function loadVersion() {
  const cacheKey = "snowtify-release";
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (cached && Date.now() - cached.at < 3600000) return cached.version;
  } catch {}
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(String(response.status));
  const version = String((await response.json()).tag_name || "").replace(/^v/, "");
  if (!version) throw new Error("no tag");
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ version, at: Date.now() }));
  } catch {}
  return version;
}

loadVersion()
  .then((version) => {
    latestVersion = version;
    document.querySelectorAll("[data-version]").forEach((node) => (node.textContent = `v${version}`));
    document.dispatchEvent(new CustomEvent("languagechange"));
  })
  .catch(() => {});

/* ---------- Snowfall ---------- */

function makeSprite(size) {
  const pixels = Math.ceil(size * 2 * 1.5) + 2;
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = pixels;
  const context = sprite.getContext("2d");
  const center = pixels / 2;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(240, 250, 255, 1)");
  gradient.addColorStop(0.45, "rgba(225, 245, 255, 0.8)");
  gradient.addColorStop(1, "rgba(225, 245, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, pixels, pixels);
  return { canvas: sprite, size: size * 2 };
}

function startSnow(canvas) {
  const context = canvas.getContext("2d");
  const sprites = [1.5, 2.2, 3, 4].map(makeSprite);
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  let width = 0;
  let height = 0;
  let flakes = [];
  let running = false;
  let frame = 0;
  let last = 0;

  const spawn = (anywhere) => {
    const depth = Math.random() ** 1.7;
    return {
      x: Math.random() * width,
      y: anywhere ? Math.random() * height : -10,
      sprite: sprites[Math.min(3, Math.floor(depth * 4))],
      speed: 10 + depth * 42,
      alpha: 0.18 + depth * 0.55,
      sway: 5 + Math.random() * 14,
      phase: Math.random() * 6.28,
      depth,
    };
  };

  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    flakes = Array.from({ length: Math.min(110, Math.round((width * height) / 12000)) }, () => spawn(true));
    if (!running) draw(performance.now());
  };

  function draw(now) {
    context.clearRect(0, 0, width, height);
    const time = now / 1000;
    for (const flake of flakes) {
      const { canvas: image, size } = flake.sprite;
      context.globalAlpha = flake.alpha;
      context.drawImage(image, flake.x + Math.sin(time + flake.phase) * flake.sway - size / 2, flake.y - size / 2, size, size);
    }
    context.globalAlpha = 1;
  }

  const loop = (now) => {
    frame = requestAnimationFrame(loop);
    if (now - last < 31) return; // ~30 fps is plenty for drifting snow
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;
    const wind = Math.sin(now / 4500) * 10;
    for (let i = 0; i < flakes.length; i++) {
      const flake = flakes[i];
      flake.y += flake.speed * delta;
      flake.x += wind * flake.depth * delta;
      if (flake.y > height + 10 || flake.x < -30 || flake.x > width + 30) flakes[i] = spawn(false);
    }
    draw(now);
  };

  const setRunning = (next) => {
    if (reducedMotion || next === running) return;
    running = next;
    cancelAnimationFrame(frame);
    if (running) {
      last = performance.now();
      frame = requestAnimationFrame(loop);
    }
  };

  resize();
  new ResizeObserver(resize).observe(canvas);
  let visible = false;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    setRunning(visible && !document.hidden);
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => setRunning(visible && !document.hidden));
}

document.querySelectorAll("canvas.snow").forEach(startSnow);

/* ---------- Update card demo ---------- */

const ICON = {
  ring: '<svg viewBox="0 0 60 60" aria-hidden="true"><defs><linearGradient id="ucg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fe3fb" stop-opacity="0"/><stop offset="1" stop-color="#c9f1ff"/></linearGradient></defs><circle cx="30" cy="30" r="28" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.5"/><circle cx="30" cy="30" r="28" fill="none" stroke="url(#ucg)" stroke-width="2" stroke-linecap="round" stroke-dasharray="70 106"/></svg>',
  arrow: '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="#4d626b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
  check: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.2 5 8.5l4.5-5"/></svg>',
  shield: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.5 2.5 3.5v4c0 3.3 2.3 5.9 5.5 7 3.2-1.1 5.5-3.7 5.5-7v-4L8 1.5Z"/><path d="m5.6 8 1.7 1.7 3.2-3.4" stroke-linecap="round"/></svg>',
};

const DEMO_STEPS = [
  { step: 0, percent: 28, at: 0 },
  { step: 1, percent: 64, at: 2600 },
  { step: 2, percent: 92, at: 5600 },
  { step: 3, percent: 100, at: 7800 },
];

function createUpdateDemo(card) {
  const loop = card.dataset.loop !== "false";
  let timers = [];
  let state = 0;
  let shownPercent = 5;

  const render = () => {
    const done = state >= 3;
    card.classList.toggle("complete", done);
    card.innerHTML = `
      <div class="uc-head">
        <div class="uc-mark">${ICON.ring}<img src="assets/snowtify-icon.png" alt=""></div>
        <div><span class="uc-eyebrow">${t("uc.label")}</span><div class="uc-title">${t(done ? "uc.done" : "uc.title")}</div></div>
      </div>
      <div class="uc-versions"><span class="uc-pill">v${previousVersion(latestVersion)}</span>${ICON.arrow}<span class="uc-pill new">v${latestVersion}</span></div>
      <div class="uc-meta"><span>${done ? t("uc.finished") : t("uc.step").replace("{n}", state + 1)}</span><strong data-percent></strong></div>
      <div class="uc-track"><div class="uc-fill"></div></div>
      <ol class="uc-steps">
        ${["uc.s1", "uc.s2", "uc.s3"].map((key, i) => `<li class="${i < state ? "done" : i === state ? "active" : ""}"><span class="uc-dot">${ICON.check}</span><span>${t(key)}</span></li>`).join("")}
      </ol>
      <p class="uc-foot">${ICON.shield}<span>${t("uc.kept")}</span></p>`;
    const percent = DEMO_STEPS[Math.min(state, 3)].percent;
    card.querySelector("[data-percent]").textContent = `${percent}%`;
    // Re-rendering replaces the bar, so start it where it was and let the
    // CSS transition carry it to the new value.
    const fill = card.querySelector(".uc-fill");
    fill.style.transform = `scaleX(${shownPercent / 100})`;
    requestAnimationFrame(() => requestAnimationFrame(() => (fill.style.transform = `scaleX(${percent / 100})`)));
    shownPercent = percent;
  };

  const play = () => {
    timers.forEach(clearTimeout);
    shownPercent = 5;
    timers = DEMO_STEPS.map(({ step, at }) =>
      setTimeout(() => {
        state = step;
        render();
      }, at),
    );
    if (loop) timers.push(setTimeout(play, 11500));
  };

  const stop = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  document.addEventListener("languagechange", render);
  render();

  if (reducedMotion) {
    state = 1;
    render();
    return { play: () => {}, stop };
  }
  return { play, stop };
}

document.querySelectorAll("[data-update-card]").forEach((card) => {
  const demo = createUpdateDemo(card);
  let playing = false;
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !playing) {
      playing = true;
      demo.play();
    } else if (!entry.isIntersecting && playing && card.dataset.loop !== "false") {
      playing = false;
      demo.stop();
    }
  }, { threshold: 0.35 }).observe(card);
  card.parentElement.querySelector("[data-replay]")?.addEventListener("click", () => demo.play());
});

/* ---------- Reveal on scroll ---------- */

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in");
      if (entry.target.matches("[data-console]")) {
        entry.target.querySelectorAll("li").forEach((item, i) => (item.style.transitionDelay = `${300 + i * 450}ms`));
        entry.target.classList.add("play");
      }
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.15 },
);
document.querySelectorAll(".reveal").forEach((node) => revealObserver.observe(node));

/* ---------- Docs: search + active section ---------- */

const searchInput = document.getElementById("docs-search");
const docSections = [...document.querySelectorAll(".searchable")];

searchInput?.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  let shown = 0;
  docSections.forEach((section) => {
    const match = !query || `${section.dataset.search || ""} ${section.textContent}`.toLowerCase().includes(query);
    section.hidden = !match;
    if (match) shown += 1;
  });
  const empty = document.querySelector(".no-results");
  if (empty) empty.hidden = shown !== 0;
});

if (docSections.length) {
  const links = [...document.querySelectorAll(".docs-sidebar nav a")];
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const current = entries.find((entry) => entry.isIntersecting);
      if (current) links.forEach((link) => link.classList.toggle("active", link.hash === `#${current.target.id}`));
    },
    { rootMargin: "-20% 0px -70%" },
  );
  docSections.forEach((section) => sectionObserver.observe(section));
}
