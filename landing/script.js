/* 11 Gol landing — live matches + scroll reveals + countdown + EN/ES. Vanilla JS. */
(function () {
  "use strict";

  // App Store listing — every element with [data-store-link] gets this href.
  const APP_STORE_URL = "https://apps.apple.com/app/11-gol/id6775887761";

  // Public Supabase REST (anon key is safe to expose; RLS protects the data).
  // Football data lives in Supabase, populated from football-data.org — the app's API.
  const SB_URL = "https://xqjupomaqomneqiugbft.supabase.co";
  const SB_ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxanVwb21hcW9tbmVxaXVnYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjM1MjcsImV4cCI6MjA5NTg5OTUyN30.NsDoA5OKf3id16fPZHf4b8TaoHExbTOiejNl4ULTf5k";

  // ── i18n ────────────────────────────────────────────────────────────────
  const I18N = {
    en: {
      nav_matches: "Matches",
      nav_features: "Features",
      nav_download: "Download",
      nav_results: "Results",
      nav_videos: "Videos",
      res_title: "Latest results",
      boot_title: "👟 Golden Boot",
      vid_title: "World Cup 2026 highlights",
      vid_sub: "Official recaps and recent match moments",
      vid_badge_1: "Latest recap",
      vid_card_1_title: "Recent match summaries",
      vid_card_1_text:
        "Follow short recaps of the biggest moments, key goals, and turning points from the 2026 tournament.",
      vid_link_1: "Open FIFA World Cup 2026",
      vid_badge_2: "Official videos",
      vid_card_2_title: "Highlights & full match reels",
      vid_card_2_text:
        "Watch official tournament clips and the best plays from recent matches in one place.",
      vid_link_2: "Watch on FIFA YouTube",
      vid_badge_3: "Live moments",
      vid_card_3_title: "Find the latest highlights",
      vid_card_3_text:
        "Search for the newest World Cup 2026 highlights and match recaps directly from the official channels.",
      vid_link_3: "Find recent highlights",
      goalsAbbr: "G",
      liveLabel: "LIVE",
      hero_eyebrow: "Football 2026 · USA · MEX · CAN",
      hero_title: "The 2026 tournament,<br>in your pocket.",
      hero_title_1: "The 2026 tournament,",
      hero_title_2: "in your pocket.",
      hero_badge: "Free · No ads · Bilingual",
      tagline: "Predict · Compete · Win",
      hero_lead:
        "Schedule, live scores, squads, and a prediction game with friends. Free, dark, and bilingual.",
      store_apple_small: "Download on the",
      store_google_small: "Get it on",
      cd_label: "Kickoff in",
      cd_d: "Days",
      cd_h: "Hours",
      cd_m: "Min",
      cd_s: "Sec",
      st_teams: "Teams",
      st_matches: "Matches",
      st_venues: "Venues",
      st_hosts: "Host nations",
      up_title: "Upcoming matches",
      up_live: "Live from the app",
      feat_title: "Everything for the tournament",
      f1_t: "Live scores",
      f1_d: "Real-time updates with a breathing LIVE badge and goal animations.",
      f2_t: "Full schedule",
      f2_d: "All 104 matches in your local time, with filters by stage, group and host.",
      f3_t: "Predictions",
      f3_d: "Call the score before kickoff. Exact = 3 pts, right result = 1 pt.",
      f4_t: "1v1 Challenges",
      f4_d: "Challenge a friend on a match — closest pick wins ranking points.",
      f5_t: "Leaderboard",
      f5_d: "Climb the global ranking with predictions and challenge wins.",
      f6_t: "Teams & squads",
      f6_d: "All 48 nations, full squads by position, and coaches.",
      how_title: "Play in 3 steps",
      s1_t: "Predict",
      s1_d: "Pick the score of any match before it kicks off.",
      s2_t: "Challenge",
      s2_d: "Dare a friend head-to-head: who wins and by how many.",
      s3_t: "Climb",
      s3_d: "Earn points and rise on the global leaderboard.",
      banner_title: "Ready for June 11?",
      banner_sub: "Download 11 Gol and don't miss a single match.",
      foot_privacy: "Privacy",
      foot_terms: "Terms",
      foot_contact: "Contact",
      foot_disclaimer:
        "An independent app, not affiliated with any football organization or competition. Match data by football-data.org.",
      carousel_prev: "Previous highlight",
      carousel_next: "Next highlight",
      live: "The tournament is on!",
      vs: "vs",
      noData: "Schedule loads in the app.",
      stages: {
        group: "Group",
        r32: "Round of 32",
        r16: "Round of 16",
        qf: "Quarter-final",
        sf: "Semi-final",
        third: "Third place",
        final: "Final",
      },
    },
    es: {
      nav_matches: "Partidos",
      nav_features: "Funciones",
      nav_download: "Descargar",
      nav_results: "Resultados",
      nav_videos: "Videos",
      res_title: "Últimos resultados",
      boot_title: "👟 Bota de Oro",
      vid_title: "Highlights del Mundial 2026",
      vid_sub: "Resúmenes oficiales y momentos recientes",
      vid_badge_1: "Último resumen",
      vid_card_1_title: "Resumen de partidos recientes",
      vid_card_1_text:
        "Sigue resúmenes cortos de los momentos clave, goles y cambios de juego del torneo 2026.",
      vid_link_1: "Abrir FIFA Mundial 2026",
      vid_badge_2: "Videos oficiales",
      vid_card_2_title: "Highlights y repeticiones completas",
      vid_card_2_text:
        "Mira clips oficiales del torneo y las mejores jugadas de los partidos recientes.",
      vid_link_2: "Ver en YouTube de FIFA",
      vid_badge_3: "Momentos en vivo",
      vid_card_3_title: "Encuentra los últimos highlights",
      vid_card_3_text:
        "Busca los highlights y resúmenes más recientes del Mundial 2026 en los canales oficiales.",
      vid_link_3: "Encontrar highlights recientes",
      goalsAbbr: "G",
      liveLabel: "EN VIVO",
      hero_eyebrow: "Fútbol 2026 · EE.UU. · MÉX · CAN",
      hero_title: "El torneo 2026,<br>en tu bolsillo.",
      hero_title_1: "El torneo 2026,",
      hero_title_2: "en tu bolsillo.",
      hero_badge: "Gratis · Sin anuncios · Bilingüe",
      tagline: "Predice · Compite · Gana",
      hero_lead:
        "Calendario, marcadores en vivo, plantillas y un juego de predicciones con amigos. Gratis, oscuro y bilingüe.",
      store_apple_small: "Descarga en el",
      store_google_small: "Disponible en",
      cd_label: "El torneo arranca en",
      cd_d: "Días",
      cd_h: "Horas",
      cd_m: "Min",
      cd_s: "Seg",
      st_teams: "Equipos",
      st_matches: "Partidos",
      st_venues: "Sedes",
      st_hosts: "Anfitriones",
      up_title: "Próximos partidos",
      up_live: "En vivo desde la app",
      feat_title: "Todo para el torneo",
      f1_t: "Marcadores en vivo",
      f1_d: "Actualización en tiempo real con indicador EN VIVO y animaciones de gol.",
      f2_t: "Calendario completo",
      f2_d: "Los 104 partidos en tu hora local, con filtros por fase, grupo y sede.",
      f3_t: "Predicciones",
      f3_d: "Predice el marcador antes del pitazo. Exacto = 3 pts, resultado = 1 pt.",
      f4_t: "Retos 1v1",
      f4_d: "Reta a un amigo en un partido — el pronóstico más cercano gana puntos.",
      f5_t: "Ranking",
      f5_d: "Sube en el ranking global con predicciones y retos ganados.",
      f6_t: "Equipos y plantillas",
      f6_d: "Las 48 selecciones, plantillas por posición y entrenadores.",
      how_title: "Juega en 3 pasos",
      s1_t: "Predice",
      s1_d: "Elige el marcador de cualquier partido antes de que empiece.",
      s2_t: "Reta",
      s2_d: "Desafía a un amigo: quién gana y por cuántos goles.",
      s3_t: "Sube",
      s3_d: "Gana puntos y escala en el ranking global.",
      banner_title: "¿Listo para el 11 de junio?",
      banner_sub: "Descarga 11 Gol y no te pierdas ni un partido.",
      foot_privacy: "Privacidad",
      foot_terms: "Términos",
      foot_contact: "Contacto",
      foot_disclaimer:
        "App independiente, no afiliada a ninguna organización ni competición de fútbol. Datos de partidos por football-data.org.",
      carousel_prev: "Highlight anterior",
      carousel_next: "Siguiente highlight",
      live: "¡El torneo está en marcha!",
      vs: "vs",
      noData: "El calendario carga en la app.",
      stages: {
        group: "Grupo",
        r32: "Dieciseisavos",
        r16: "Octavos",
        qf: "Cuartos",
        sf: "Semifinal",
        third: "Tercer puesto",
        final: "Final",
      },
    },
  };

  let lang =
    (navigator.language || "en").toLowerCase().indexOf("es") === 0
      ? "es"
      : "en";
  let locale = lang === "es" ? "es" : "en";

  function updateCarouselLabels() {
    const prev = document.getElementById("videoPrev");
    const next = document.getElementById("videoNext");
    if (prev) {
      prev.setAttribute("aria-label", I18N[lang].carousel_prev);
    }
    if (next) {
      next.setAttribute("aria-label", I18N[lang].carousel_next);
    }
  }

  function apply(l) {
    lang = l;
    locale = l;
    document.documentElement.lang = l;
    const d = I18N[l];
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      const k = el.getAttribute("data-i18n");
      if (d[k] != null) el.innerHTML = d[k];
    });
    const btn = document.getElementById("lang");
    btn.querySelectorAll("span").forEach(function (s) {
      s.classList.remove("on");
    });
    btn.querySelectorAll("span")[l === "en" ? 0 : 1].classList.add("on");
    updateCarouselLabels();
    if (window.__matches) renderMatches(window.__matches); // re-render in new lang
    loadResults();
    loadScorers();
  }
  document.getElementById("lang").addEventListener("click", function () {
    apply(lang === "en" ? "es" : "en");
  });

  // ── countdown ──────────────────────────────────────────────────────────
  const TARGET = Date.UTC(2026, 5, 11, 16, 0, 0);
  const cd = document.getElementById("cd");
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function tick() {
    const diff = TARGET - Date.now();
    if (diff <= 0) {
      cd.innerHTML =
        '<div style="min-width:auto;padding:14px 22px"><b style="font-size:20px">⚽ ' +
        I18N[lang].live +
        "</b></div>";
      return;
    }
    const s = Math.floor(diff / 1000);
    set("d", Math.floor(s / 86400));
    set("h", Math.floor((s % 86400) / 3600));
    set("m", Math.floor((s % 3600) / 60));
    set("s", s % 60);
  }
  function set(k, v) {
    const el = cd.querySelector('[data-cd="' + k + '"]');
    if (el) el.textContent = pad(v);
  }

  // ── reveal on scroll ─────────────────────────────────────────────────────
  const io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll(".reveal").forEach(function (el) {
    io.observe(el);
  });

  // ── live matches from the app's API (Supabase REST) ──────────────────────
  function stageLabel(m) {
    const s = I18N[lang].stages;
    if (m.stage === "group")
      return (s.group + " " + (m.group_letter || "")).trim();
    return s[m.stage] || m.stage;
  }
  function esc(t) {
    return (t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }

  // Real flag image via flagcdn (by ISO-3166 code); falls back to emoji.
  function flag(team) {
    const iso = team && team.iso2;
    if (iso)
      return (
        '<img class="fl-img" loading="lazy" alt="" ' +
        'src="https://flagcdn.com/w40/' +
        iso.toLowerCase() +
        '.png" ' +
        'srcset="https://flagcdn.com/w80/' +
        iso.toLowerCase() +
        '.png 2x">'
      );
    return (
      '<span class="fl">' + ((team && team.flag_emoji) || "🏳️") + "</span>"
    );
  }

  function renderMatches(list) {
    const box = document.getElementById("matchList");
    if (!list || !list.length) {
      box.innerHTML =
        '<p class="muted" style="grid-column:1/-1">' +
        I18N[lang].noData +
        "</p>";
      return;
    }
    box.innerHTML = list
      .map(function (m, i) {
        const d = new Date(m.kickoff_utc);
        const day = d.toLocaleDateString(locale, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const time = d.toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
        });
        const venue = m.venue ? m.venue.name + " · " + m.venue.city : "";
        const isLive = m.status === "live";
        const tag = isLive
          ? '<span class="tag live-tag"><i></i>' +
            I18N[lang].liveLabel +
            (m.minute != null ? " " + m.minute + "′" : "") +
            "</span>"
          : '<span class="tag">' + day + "</span>";
        const mid = isLive
          ? '<div class="m-vs m-live-score">' +
            (m.home_score != null ? m.home_score : 0) +
            " : " +
            (m.away_score != null ? m.away_score : 0) +
            "</div>"
          : '<div class="m-vs">' + I18N[lang].vs + "</div>";
        return (
          '<div class="m-card' +
          (isLive ? " m-card-live" : "") +
          '" style="animation-delay:' +
          i * 70 +
          'ms">' +
          '<div class="m-top"><span>' +
          esc(stageLabel(m)) +
          "</span>" +
          tag +
          "</div>" +
          '<div class="m-team">' +
          flag(m.home) +
          esc((m.home && m.home.name) || "TBD") +
          "</div>" +
          mid +
          '<div class="m-team">' +
          flag(m.away) +
          esc((m.away && m.away.name) || "TBD") +
          "</div>" +
          '<div class="m-foot">📍 ' +
          esc(venue) +
          (isLive ? "" : "  ·  " + time) +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function loadMatches() {
    // Live matches first (with score + minute), then the next kickoffs.
    const q =
      "/rest/v1/matches?select=id,kickoff_utc,stage,group_letter,status,minute,home_score,away_score," +
      "home:teams!home_team_id(name,flag_emoji,iso2),away:teams!away_team_id(name,flag_emoji,iso2)," +
      "venue:venues(name,city)&status=in.(live,scheduled)&order=kickoff_utc.asc&limit=6";
    fetch(SB_URL + q, { headers: { apikey: SB_ANON } })
      .then(function (r) {
        return r.ok ? r.json() : [];
      })
      .then(function (data) {
        data.sort(function (a, b) {
          if (a.status === "live" && b.status !== "live") return -1;
          if (b.status === "live" && a.status !== "live") return 1;
          return new Date(a.kickoff_utc) - new Date(b.kickoff_utc);
        });
        window.__matches = data;
        renderMatches(data);
        // Refresh every 60s while something is live, so scores tick.
        if (
          data.some(function (m) {
            return m.status === "live";
          })
        ) {
          setTimeout(function () {
            loadMatches();
            loadResults();
          }, 60000);
        }
      })
      .catch(function () {
        renderMatches([]);
      });
  }

  // ── latest results with real scorers ─────────────────────────────────────
  function renderResults(list, eventsByMatch) {
    const box = document.getElementById("resultList");
    if (!list.length) {
      box.innerHTML =
        '<p class="muted" style="grid-column:1/-1">' +
        I18N[lang].noData +
        "</p>";
      return;
    }
    box.innerHTML = list
      .map(function (m, i) {
        const d = new Date(m.kickoff_utc);
        const day = d.toLocaleDateString(locale, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const goals = (eventsByMatch[m.id] || []).filter(function (e) {
          return e.type === "goal";
        });
        const reds = (eventsByMatch[m.id] || []).filter(function (e) {
          return e.type === "red";
        });
        const scorers = goals
          .map(function (g) {
            return (
              '<span class="r-scorer">⚽ ' +
              esc(g.player_name || "") +
              (g.minute != null ? " <i>" + g.minute + "′</i>" : "") +
              "</span>"
            );
          })
          .join("");
        const redRow = reds
          .map(function (g) {
            return (
              '<span class="r-scorer red">🟥 ' +
              esc(g.player_name || "") +
              (g.minute != null ? " <i>" + g.minute + "′</i>" : "") +
              "</span>"
            );
          })
          .join("");
        return (
          '<div class="m-card" style="animation-delay:' +
          i * 70 +
          'ms">' +
          '<div class="m-top"><span>' +
          esc(stageLabel(m)) +
          '</span><span class="tag">' +
          day +
          "</span></div>" +
          '<div class="m-team">' +
          flag(m.home) +
          esc((m.home && m.home.name) || "TBD") +
          '<b class="m-score">' +
          (m.home_score != null ? m.home_score : "–") +
          "</b></div>" +
          '<div class="m-team">' +
          flag(m.away) +
          esc((m.away && m.away.name) || "TBD") +
          '<b class="m-score">' +
          (m.away_score != null ? m.away_score : "–") +
          "</b></div>" +
          (scorers || redRow
            ? '<div class="r-scorers">' + scorers + redRow + "</div>"
            : "") +
          "</div>"
        );
      })
      .join("");
  }

  function loadResults() {
    const q =
      "/rest/v1/matches?select=id,kickoff_utc,stage,group_letter,home_score,away_score," +
      "home:teams!home_team_id(name,flag_emoji,iso2),away:teams!away_team_id(name,flag_emoji,iso2)" +
      "&status=eq.finished&order=kickoff_utc.desc&limit=6";
    fetch(SB_URL + q, { headers: { apikey: SB_ANON } })
      .then(function (r) {
        return r.ok ? r.json() : [];
      })
      .then(function (list) {
        if (!list.length) {
          renderResults([], {});
          return;
        }
        const ids = list
          .map(function (m) {
            return m.id;
          })
          .join(",");
        fetch(
          SB_URL +
            "/rest/v1/match_events?select=match_id,type,minute,player_name&match_id=in.(" +
            ids +
            ")&order=seq",
          { headers: { apikey: SB_ANON } },
        )
          .then(function (r) {
            return r.ok ? r.json() : [];
          })
          .then(function (events) {
            const byMatch = {};
            events.forEach(function (e) {
              (byMatch[e.match_id] = byMatch[e.match_id] || []).push(e);
            });
            renderResults(list, byMatch);
          })
          .catch(function () {
            renderResults(list, {});
          });
      })
      .catch(function () {
        renderResults([], {});
      });
  }

  // ── golden boot ──────────────────────────────────────────────────────────
  function loadScorers() {
    const q =
      "/rest/v1/top_scorers?select=rank,player_name,goals,team:teams(name,flag_emoji,iso2),player:players(photo_url)&order=rank.asc&limit=5";
    fetch(SB_URL + q, { headers: { apikey: SB_ANON } })
      .then(function (r) {
        return r.ok ? r.json() : [];
      })
      .then(function (list) {
        const box = document.getElementById("scorerList");
        if (!list.length) {
          box.style.display = "none";
          return;
        }
        box.innerHTML = list
          .map(function (s) {
            const photo =
              s.player && s.player.photo_url
                ? '<img class="boot-photo" loading="lazy" src="' +
                  s.player.photo_url +
                  '" alt="">'
                : '<span class="boot-photo boot-initial">' +
                  esc((s.player_name || "?")[0]) +
                  "</span>";
            return (
              '<div class="boot-row' +
              (s.rank === 1 ? " first" : "") +
              '">' +
              '<b class="boot-rank">' +
              s.rank +
              "</b>" +
              photo +
              '<span class="boot-name">' +
              esc(s.player_name) +
              "</span>" +
              flag(s.team) +
              '<b class="boot-goals">' +
              s.goals +
              "<i> " +
              I18N[lang].goalsAbbr +
              "</i></b>" +
              "</div>"
            );
          })
          .join("");
      })
      .catch(function () {});
  }

  function initVideoCarousel() {
    const track = document.getElementById("videoTrack");
    const prev = document.getElementById("videoPrev");
    const next = document.getElementById("videoNext");
    const dots = document.getElementById("videoDots");
    if (!track || !prev || !next || !dots) return;

    const cards = Array.prototype.slice.call(
      track.querySelectorAll(".video-card"),
    );
    if (!cards.length) return;

    let currentIndex = 0;

    function setActive(index) {
      currentIndex = index;
      cards.forEach(function (card, i) {
        card.classList.toggle("active", i === index);
      });
      Array.prototype.slice.call(dots.children).forEach(function (dot, i) {
        dot.classList.toggle("active", i === index);
        dot.setAttribute("aria-current", i === index ? "true" : "false");
      });
    }

    function getCardIndexFromScroll() {
      const trackLeft = track.getBoundingClientRect().left;
      let closest = 0;
      let closestDist = Number.POSITIVE_INFINITY;
      cards.forEach(function (card, index) {
        const cardLeft = card.getBoundingClientRect().left - trackLeft;
        const dist = Math.abs(cardLeft);
        if (dist < closestDist) {
          closestDist = dist;
          closest = index;
        }
      });
      return closest;
    }

    function goTo(index, smooth) {
      const safeIndex = Math.max(0, Math.min(index, cards.length - 1));
      const card = cards[safeIndex];
      if (!card) return;
      track.scrollTo({
        left: card.offsetLeft,
        behavior: smooth ? "smooth" : "auto",
      });
      setActive(safeIndex);
    }

    function nextSlide() {
      goTo(currentIndex + 1, true);
    }

    function prevSlide() {
      goTo(currentIndex - 1, true);
    }

    dots.innerHTML = "";
    cards.forEach(function (_, index) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "video-dot";
      dot.setAttribute("aria-label", "Go to highlight " + (index + 1));
      dot.addEventListener("click", function () {
        goTo(index, true);
      });
      dots.appendChild(dot);
    });

    prev.addEventListener("click", function () {
      prevSlide();
    });
    next.addEventListener("click", function () {
      nextSlide();
    });

    track.addEventListener(
      "scroll",
      function () {
        window.requestAnimationFrame(function () {
          const visibleIndex = getCardIndexFromScroll();
          if (visibleIndex !== currentIndex) {
            setActive(visibleIndex);
          }
        });
      },
      { passive: true },
    );

    window.addEventListener("resize", function () {
      goTo(currentIndex, false);
    });

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      let autoplay = null;
      function startAutoplay() {
        if (autoplay) clearInterval(autoplay);
        autoplay = window.setInterval(nextSlide, 5500);
      }
      function stopAutoplay() {
        if (autoplay) clearInterval(autoplay);
        autoplay = null;
      }
      track.addEventListener("mouseenter", stopAutoplay);
      track.addEventListener("mouseleave", startAutoplay);
      prev.addEventListener("mouseenter", stopAutoplay);
      prev.addEventListener("mouseleave", startAutoplay);
      next.addEventListener("mouseenter", stopAutoplay);
      next.addEventListener("mouseleave", startAutoplay);
      startAutoplay();
    }

    updateCarouselLabels();
    goTo(0, false);
  }

  // ── App Store links ──────────────────────────────────────────────────────
  document.querySelectorAll("[data-store-link]").forEach(function (a) {
    a.setAttribute("href", APP_STORE_URL);
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener");
  });

  // ── init ─────────────────────────────────────────────────────────────────
  document.getElementById("year").textContent = new Date().getFullYear();
  initVideoCarousel();
  apply(lang);
  tick();
  setInterval(tick, 1000);
  loadMatches();
  loadResults();
  loadScorers();

  // ── motion engine (no deps; respects reduced-motion) ─────────────────────
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // scroll progress bar + sticky-nav state (rAF-throttled)
  const bar = document.getElementById("progress");
  const nav = document.getElementById("nav");
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (bar)
        bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
      if (nav) nav.classList.toggle("scrolled", h.scrollTop > 12);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // stagger reveals that share a parent (cards, features, steps, stats)
  document
    .querySelectorAll(".hero-copy,.grid,.steps,.stats")
    .forEach(function (group) {
      group.querySelectorAll(".reveal").forEach(function (el, i) {
        el.style.setProperty("--rd", i * 80 + "ms");
      });
    });

  // count-up numbers when the stat scrolls into view
  function animateCount(el) {
    const to = parseInt(el.getAttribute("data-to"), 10) || 0;
    if (reduce) {
      el.textContent = to;
      return;
    }
    const dur = 1100,
      t0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * eased);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  const countIO = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          animateCount(e.target);
          countIO.unobserve(e.target);
        }
      });
    },
    { threshold: 0.6 },
  );
  document.querySelectorAll(".count").forEach(function (el) {
    countIO.observe(el);
  });

  if (!reduce) {
    // magnetic buttons — pull toward the cursor, spring back on leave
    document.querySelectorAll(".magnetic").forEach(function (el) {
      el.addEventListener("pointermove", function (ev) {
        const r = el.getBoundingClientRect();
        const x = ev.clientX - r.left - r.width / 2;
        const y = ev.clientY - r.top - r.height / 2;
        el.style.transform = "translate(" + x * 0.3 + "px," + y * 0.4 + "px)";
      });
      el.addEventListener("pointerleave", function () {
        el.style.transform = "";
      });
    });

    // 3D tilt + parallax chips, driven by cursor over the hero
    const phone = document.getElementById("phone");
    const stage = phone && phone.closest(".phone-stage");
    const chips = document.querySelectorAll(".parallax");
    if (stage) {
      const hero = stage.closest(".hero");
      hero.addEventListener("pointermove", function (ev) {
        const r = hero.getBoundingClientRect();
        const nx = (ev.clientX - r.left) / r.width - 0.5;
        const ny = (ev.clientY - r.top) / r.height - 0.5;
        phone.style.setProperty(
          "--tilt",
          "rotateY(" + nx * 14 + "deg) rotateX(" + -ny * 12 + "deg)",
        );
        chips.forEach(function (c) {
          const s = parseFloat(c.getAttribute("data-speed")) || 1;
          c.style.setProperty(
            "--px",
            "translate(" + nx * 18 * s + "px," + ny * 18 * s + "px)",
          );
        });
      });
      hero.addEventListener("pointerleave", function () {
        phone.style.removeProperty("--tilt");
        chips.forEach(function (c) {
          c.style.removeProperty("--px");
        });
      });
    }
  }
})();
