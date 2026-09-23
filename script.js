(function () {
  "use strict";

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  var motion = !!(gsap && ScrollTrigger) && !reduced;

  if (motion) gsap.registerPlugin(ScrollTrigger);
  else {
    root.classList.add("reduced");
    root.classList.remove("anim");
  }

  /* ---------------------------------------------------------
     Theme
     --------------------------------------------------------- */
  var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  var themeListeners = [];

  function isDark() {
    return root.dataset.theme ? root.dataset.theme === "dark" : darkQuery.matches;
  }
  function applyTheme(next) {
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) {}
    themeListeners.forEach(function (fn) { fn(); });
  }
  function toggleTheme(x, y) {
    var next = isDark() ? "light" : "dark";
    if (!document.startViewTransition || reduced) { applyTheme(next); return; }
    if (x == null) { x = window.innerWidth / 2; y = window.innerHeight / 2; }
    var r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    var vt = document.startViewTransition(function () { applyTheme(next); });
    vt.ready.then(function () {
      root.animate(
        { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + r + "px at " + x + "px " + y + "px)"] },
        { duration: 700, easing: "cubic-bezier(.7,0,.3,1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(function () {});
  }
  var themeBtn = $(".theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function (e) {
      var r = themeBtn.getBoundingClientRect();
      toggleTheme(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
    });
  }
  darkQuery.addEventListener && darkQuery.addEventListener("change", function () {
    themeListeners.forEach(function (fn) { fn(); });
  });

  /* ---------------------------------------------------------
     Dates, clocks, durations
     --------------------------------------------------------- */
  var now = new Date();
  $$("[data-year]").forEach(function (el) { el.textContent = now.getFullYear(); });

  var careerStart = new Date(2016, 6, 1); // July 2016
  var years = Math.floor((now - careerStart) / (365.25 * 24 * 3600 * 1000));
  $$("[data-years]").forEach(function (el) { el.textContent = years; el.dataset.count = years; });

  function monthsBetween(start, end) {
    var s = start.split("-").map(Number);
    var e = end ? end.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
    return (e[0] - s[0]) * 12 + (e[1] - s[1]) + 1; // inclusive, like LinkedIn
  }
  function formatMonths(m) {
    var y = Math.floor(m / 12), mo = m % 12, out = [];
    if (y) out.push(y + (y === 1 ? " yr" : " yrs"));
    if (mo) out.push(mo + (mo === 1 ? " mo" : " mos"));
    return out.join(" ");
  }
  $$("[data-duration]").forEach(function (el) {
    el.textContent = formatMonths(monthsBetween(el.dataset.start, el.dataset.end));
  });

  var fmtShort, fmtLong;
  try {
    fmtShort = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit", hour12: false });
    fmtLong = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  } catch (e) {}
  function tickClock() {
    if (!fmtShort) return;
    var d = new Date();
    var s = fmtShort.format(d), l = fmtLong.format(d);
    $$("[data-clock]").forEach(function (el) { el.textContent = s; });
    $$("[data-clock-full]").forEach(function (el) { el.textContent = l; });
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ---------------------------------------------------------
     Smooth scroll (Lenis) + anchor links
     --------------------------------------------------------- */
  var lenis = null;
  if (motion && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToTarget(hash) {
    var el = hash === "#top" ? document.body : $(hash);
    if (!el) return;
    var behavior = reduced ? "auto" : "smooth";
    if (lenis) {
      lenis.scrollTo(hash === "#top" ? 0 : el, { offset: hash === "#top" ? 0 : -24, duration: 1.4 });
    } else if (hash === "#top") {
      window.scrollTo({ top: 0, behavior: behavior });
    } else {
      el.scrollIntoView({ behavior: behavior });
    }
    if (hash === "#main" || hash === "#top") return;
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var hash = a.getAttribute("href");
    if (hash.length < 2) return;
    e.preventDefault();
    scrollToTarget(hash);
    if (history.replaceState) history.replaceState(null, "", hash === "#top" ? location.pathname : hash);
  });

  /* ---------------------------------------------------------
     Header: hide on scroll down, progress bar, active nav
     --------------------------------------------------------- */
  var header = $(".site-header");
  var progress = $(".progress");
  var navLinks = $$(".nav a");
  var indicator = $(".nav-indicator");
  var cmdkOpen = false;
  var lastY = window.scrollY;

  var navTargets = navLinks.map(function (a) { return { link: a, el: $(a.getAttribute("href")) }; })
    .filter(function (t) { return t.el; })
    .sort(function (a, b) { return a.el.getBoundingClientRect().top - b.el.getBoundingClientRect().top; });

  function moveIndicator(link) {
    if (!indicator) return;
    if (!link) { indicator.style.opacity = "0"; return; }
    indicator.style.opacity = "1";
    indicator.style.width = link.offsetWidth + "px";
    indicator.style.transform = "translateX(" + link.offsetLeft + "px)";
  }

  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";

    if (header && !cmdkOpen) {
      if (y > lastY + 4 && y > 240) header.classList.add("is-hidden");
      else if (y < lastY - 4 || y < 240) header.classList.remove("is-hidden");
    }
    lastY = y;

    var mark = window.innerHeight * 0.45, active = null;
    navTargets.forEach(function (t) { if (t.el.getBoundingClientRect().top <= mark) active = t.link; });
    navLinks.forEach(function (a) { a.classList.toggle("active", a === active); });
    moveIndicator(active);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  /* ---------------------------------------------------------
     Text splitting
     --------------------------------------------------------- */
  function splitChars(el, mode) {
    var chars = [];
    if (!el.hasAttribute("aria-label") && !el.closest("[aria-label]")) {
      el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    }
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            var word = document.createElement("span");
            word.className = "word";
            word.setAttribute("aria-hidden", "true");
            var pieces = mode === "word" ? [part] : Array.from(part);
            pieces.forEach(function (ch) {
              var mask = document.createElement("span");
              mask.className = "char-mask";
              var c = document.createElement("span");
              c.className = "char";
              c.textContent = ch;
              mask.appendChild(c);
              word.appendChild(mask);
              chars.push(c);
            });
            frag.appendChild(word);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== "BR") {
          walk(n);
        }
      });
    })(el);
    return chars;
  }

  function splitWords(el) {
    var words = [];
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    var parts = el.textContent.replace(/\s+/g, " ").trim().split(" ");
    el.textContent = "";
    parts.forEach(function (p, i) {
      var s = document.createElement("span");
      s.className = "w";
      s.setAttribute("aria-hidden", "true");
      s.textContent = p;
      el.appendChild(s);
      if (i < parts.length - 1) el.appendChild(document.createTextNode(" "));
      words.push(s);
    });
    return words;
  }

  /* ---------------------------------------------------------
     Intro loader + hero entrance
     --------------------------------------------------------- */
  var heroChars = [];
  if (motion) {
    $$(".hero-title [data-split]").forEach(function (el) {
      heroChars = heroChars.concat(splitChars(el, el.tagName === "EM" ? "word" : "char"));
    });
  }

  function heroIntro() {
    if (!motion) { root.classList.remove("anim"); return; }
    var fades = $$("[data-hero-fade]");
    gsap.set(heroChars, { yPercent: 115, rotate: 7 });
    gsap.set(fades, { opacity: 0, y: 26 });
    root.classList.remove("anim");
    gsap.timeline({ defaults: { ease: "expo.out" } })
      .to(heroChars, { yPercent: 0, rotate: 0, duration: 1.5, stagger: 0.055 })
      .to(fades, { opacity: 1, y: 0, duration: 1.2, stagger: 0.08 }, "-=1.15")
      .add(function () { if (field) field.ripple(0.72, 0.42); }, "-=1.1");
  }

  function runLoader(done) {
    var loader = $(".loader");
    var seen = false;
    try { seen = sessionStorage.getItem("introSeen") === "1"; } catch (e) {}
    if (!motion || seen || !loader) {
      if (loader) loader.remove();
      done();
      return;
    }
    try { sessionStorage.setItem("introSeen", "1"); } catch (e) {}
    loader.classList.add("is-on");
    if (lenis) lenis.stop();
    var count = $("[data-loader-count]", loader);
    var bar = $(".loader-bar span", loader);
    var o = { v: 0 };
    gsap.set(loader, { clipPath: "inset(0% 0% 0% 0%)" });
    gsap.timeline({ onComplete: function () { loader.remove(); if (lenis) lenis.start(); } })
      .to(o, { v: 100, duration: 1.3, ease: "power2.inOut", onUpdate: function () { count.textContent = Math.round(o.v); } })
      .to(bar, { scaleX: 1, duration: 1.3, ease: "power2.inOut" }, 0)
      .to(loader, { clipPath: "inset(0% 0% 100% 0%)", duration: 1, ease: "expo.inOut" }, "+=.1")
      .add(done, "-=.55");
  }

  /* ---------------------------------------------------------
     Hero: rotating phrase
     --------------------------------------------------------- */
  (function rotator() {
    var items = $$(".rotator > span");
    if (items.length < 2) return;
    var i = 0;
    setInterval(function () {
      if (document.hidden) return;
      var cur = items[i];
      i = (i + 1) % items.length;
      var next = items[i];
      cur.classList.remove("is-active");
      cur.classList.add("is-leaving");
      next.classList.remove("is-leaving");
      next.classList.add("is-active");
      setTimeout(function () { cur.classList.remove("is-leaving"); }, 750);
    }, 2600);
  })();

  /* ---------------------------------------------------------
     Hero: interactive dot field
     --------------------------------------------------------- */
  var field = (function dotField() {
    var canvas = $(".field");
    var hero = $(".hero");
    if (!canvas || !hero || !canvas.getContext) return null;
    var ctx = canvas.getContext("2d");
    var dots = [], w = 0, h = 0, gap = 28, radius = 160;
    var mouse = { x: -1e4, y: -1e4, sx: -1e4, sy: -1e4, active: false };
    var ripples = [];
    var colors = { dot: "242,240,236", acc: "255,77,99" };
    var visible = true, raf = 0;

    function readColors() {
      var cs = getComputedStyle(root);
      colors.dot = cs.getPropertyValue("--dot-rgb").trim() || colors.dot;
      colors.acc = cs.getPropertyValue("--accent-rgb").trim() || colors.acc;
      if (!raf) draw(performance.now());
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = hero.clientWidth; h = hero.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gap = w < 640 ? 22 : 28;
      radius = w < 640 ? 110 : 160;
      dots = [];
      var ox = (w % gap) / 2 + gap / 2, oy = (h % gap) / 2 + gap / 2;
      for (var y = oy; y < h; y += gap) {
        for (var x = ox; x < w; x += gap) dots.push({ x: x, y: y, dx: 0, dy: 0 });
      }
      if (!raf) draw(performance.now());
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      mouse.sx += (mouse.x - mouse.sx) * 0.16;
      mouse.sy += (mouse.y - mouse.sy) * 0.16;
      ripples = ripples.filter(function (r) { return t - r.t < 1800; });
      var reach = Math.max(w, h);

      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var mx = d.x - mouse.sx, my = d.y - mouse.sy;
        var dist = Math.sqrt(mx * mx + my * my) || 1;
        var f = mouse.active ? Math.max(0, 1 - dist / radius) : 0;
        var tx = (mx / dist) * f * f * 26, ty = (my / dist) * f * f * 26;
        var glow = f;

        for (var j = 0; j < ripples.length; j++) {
          var r = ripples[j];
          var age = (t - r.t) / 1800;
          var rr = age * reach;
          var rx = d.x - r.x, ry = d.y - r.y;
          var rd = Math.sqrt(rx * rx + ry * ry) || 1;
          var band = 1 - Math.abs(rd - rr) / 80;
          if (band > 0) {
            var amp = band * (1 - age);
            tx += (rx / rd) * amp * 16;
            ty += (ry / rd) * amp * 16;
            if (amp > glow) glow = amp;
          }
        }

        d.dx += (tx - d.dx) * 0.14;
        d.dy += (ty - d.dy) * 0.14;

        var wave = reduced ? 0 : (Math.sin(d.x * 0.011 + t * 0.0008) + Math.sin(d.y * 0.016 - t * 0.0006)) * 0.5;
        var a = 0.12 + wave * 0.05 + glow * 0.8;
        var s = 1.4 + glow * 2.2;
        ctx.fillStyle = "rgba(" + (glow > 0.03 ? colors.acc : colors.dot) + "," + a.toFixed(3) + ")";
        ctx.fillRect(d.x + d.dx - s / 2, d.y + d.dy - s / 2, s, s);
      }
    }

    function loop(t) {
      draw(t);
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && !reduced && visible && !document.hidden) raf = requestAnimationFrame(loop); }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

    window.addEventListener("pointermove", function (e) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      if (!mouse.active) { mouse.sx = mouse.x; mouse.sy = mouse.y; }
      mouse.active = mouse.y >= 0 && mouse.y <= rect.height;
    }, { passive: true });
    document.addEventListener("pointerleave", function () { mouse.active = false; });

    hero.addEventListener("pointerdown", function (e) {
      if (e.target.closest("a, button")) return;
      var rect = canvas.getBoundingClientRect();
      ripples.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() });
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        visible ? start() : stop();
      }).observe(hero);
    }
    document.addEventListener("visibilitychange", function () { document.hidden ? stop() : start(); });

    if ("ResizeObserver" in window) {
      var pending = 0;
      new ResizeObserver(function () {
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(resize);
      }).observe(hero);
    } else {
      window.addEventListener("resize", resize);
    }

    themeListeners.push(readColors);
    readColors();
    resize();
    start();

    return {
      ripple: function (fx, fy) { ripples.push({ x: w * fx, y: h * fy, t: performance.now() }); }
    };
  })();

  /* ---------------------------------------------------------
     Marquee — speeds up and flips direction with scroll
     --------------------------------------------------------- */
  (function marquee() {
    if (!motion) return;
    $$(".marquee-track").forEach(function (track) {
      var list = $(".marquee-list", track);
      if (!list) return;
      var copies = Math.max(2, Math.ceil((window.innerWidth * 2) / Math.max(list.offsetWidth, 1)) + 1);
      for (var i = 1; i < copies; i++) {
        var c = list.cloneNode(true);
        c.setAttribute("aria-hidden", "true");
        track.appendChild(c);
      }
      var x = 0, dir = -1, boost = 0, slow = 1, prevY = window.scrollY;
      track.addEventListener("pointerenter", function () { slow = 0.2; });
      track.addEventListener("pointerleave", function () { slow = 1; });

      gsap.ticker.add(function (time, delta) {
        var width = list.offsetWidth;
        if (!width) return;
        var y = window.scrollY, v = y - prevY;
        prevY = y;
        if (v > 0.5) dir = -1; else if (v < -0.5) dir = 1;
        boost += (Math.min(Math.abs(v) * 0.6, 12) - boost) * 0.1;
        x += dir * (1 + boost) * slow * (delta / 16.67);
        while (x <= -width) x += width;
        while (x > 0) x -= width;
        track.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)";
      });
    });
  })();

  /* ---------------------------------------------------------
     Scroll animations
     --------------------------------------------------------- */
  if (motion) {
    // Statement: words light up as you scroll through it
    var statement = $("[data-words]");
    if (statement) {
      var words = splitWords(statement);
      gsap.fromTo(words, { opacity: 0.14 }, {
        opacity: 1, ease: "none", stagger: 0.05,
        scrollTrigger: { trigger: statement, start: "top 78%", end: "bottom 42%", scrub: true }
      });
    }

    // Headings: characters rise in
    $$("[data-split-scroll]").forEach(function (el) {
      var chars = splitChars(el, "char");
      gsap.from(chars, {
        yPercent: 115, rotate: 6, duration: 1.2, ease: "expo.out", stagger: 0.022,
        scrollTrigger: { trigger: el, start: "top 85%" }
      });
    });

    // Generic reveals
    var reveals = $$("[data-reveal]");
    gsap.set(reveals, { opacity: 0, y: 48 });
    ScrollTrigger.batch(reveals, {
      start: "top 90%",
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, { opacity: 1, y: 0, duration: 1.2, ease: "expo.out", stagger: 0.09, overwrite: true });
      }
    });

    // Count-up numbers
    $$("[data-count]").forEach(function (el) {
      var target = Number(el.dataset.count) || 0, o = { v: 0 };
      el.textContent = "0";
      ScrollTrigger.create({
        trigger: el, start: "top 90%", once: true,
        onEnter: function () {
          gsap.to(o, { v: target, duration: 1.8, ease: "power3.out", onUpdate: function () { el.textContent = Math.round(o.v); } });
        }
      });
    });

    // Career ladder steps light up one after another
    var ladder = $$(".ladder span");
    if (ladder.length) {
      gsap.from(ladder, {
        opacity: 0, x: -12, duration: 0.6, ease: "power3.out", stagger: 0.12,
        scrollTrigger: { trigger: ".ladder", start: "top 92%" }
      });
    }

    // Timeline: rail fills with scroll; roles and the big year follow along
    var fill = $(".tl-fill");
    if (fill) {
      gsap.to(fill, {
        scaleY: 1, ease: "none",
        scrollTrigger: { trigger: ".timeline", start: "top 60%", end: "bottom 60%", scrub: true }
      });
    }
    var yearEl = $("[data-year-display]");
    var currentYear = yearEl ? yearEl.textContent : "";
    function setYear(y) {
      if (!yearEl || y === currentYear) return;
      currentYear = y;
      gsap.timeline()
        .to(yearEl, { yPercent: -100, opacity: 0, duration: 0.25, ease: "power2.in" })
        .add(function () { yearEl.textContent = y; })
        .fromTo(yearEl, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: "expo.out" });
    }
    var roles = $$(".tl-role");
    roles.forEach(function (role, i) {
      ScrollTrigger.create({
        trigger: role, start: "top 60%",
        onEnter: function () { role.classList.add("on"); setYear(role.dataset.roleYear); },
        onLeaveBack: function () {
          role.classList.remove("on");
          setYear(i > 0 ? roles[i - 1].dataset.roleYear : roles[0].dataset.roleYear);
        }
      });
    });

    // "How I work": connecting line draws across the steps
    if ($(".steps")) {
      gsap.to(".steps", {
        "--p": 1, ease: "none",
        scrollTrigger: { trigger: ".steps", start: "top 85%", end: "bottom 55%", scrub: true }
      });
    }

    // Parallax on the hero while scrolling away
    gsap.to(".hero-title", {
      yPercent: 18, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
    gsap.to(".aurora", {
      yPercent: 30, opacity: 0.2, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); onScroll(); });
    }
  } else {
    $$(".tl-role").forEach(function (r) { r.classList.add("on"); });
  }

  /* ---------------------------------------------------------
     Card spotlight + tilt
     --------------------------------------------------------- */
  $$("[data-tilt]").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty("--mx", px * 100 + "%");
      card.style.setProperty("--my", py * 100 + "%");
      if (motion && finePointer) {
        gsap.to(card, { rotationX: (0.5 - py) * 7, rotationY: (px - 0.5) * 7, transformPerspective: 1000, duration: 0.6, ease: "power3.out" });
      }
    });
    card.addEventListener("pointerleave", function () {
      if (motion && finePointer) gsap.to(card, { rotationX: 0, rotationY: 0, duration: 0.9, ease: "elastic.out(1, .5)" });
    });
  });

  /* ---------------------------------------------------------
     Magnetic elements
     --------------------------------------------------------- */
  if (motion && finePointer) {
    $$("[data-magnetic]").forEach(function (el) {
      var xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3" });
      var yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" });
      var strength = el.classList.contains("orb") ? 0.3 : 0.35;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      });
      el.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });
  }

  /* ---------------------------------------------------------
     Custom cursor
     --------------------------------------------------------- */
  var cursor = $(".cursor"), cursorDot = $(".cursor-dot");
  var cursorLabel = cursor ? $(".cursor-label", cursor) : null;
  var useCursor = motion && finePointer && cursor && cursorDot;
  if (useCursor) {
    root.classList.add("has-cursor");
    cursor.classList.add("is-hidden");
    cursorDot.classList.add("is-hidden");
    var cx = gsap.quickTo(cursor, "x", { duration: 0.5, ease: "power3" });
    var cy = gsap.quickTo(cursor, "y", { duration: 0.5, ease: "power3" });
    var dx = gsap.quickTo(cursorDot, "x", { duration: 0.08, ease: "none" });
    var dy = gsap.quickTo(cursorDot, "y", { duration: 0.08, ease: "none" });

    window.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      cursor.classList.remove("is-hidden");
      cursorDot.classList.remove("is-hidden");
      cx(e.clientX); cy(e.clientY); dx(e.clientX); dy(e.clientY);
    }, { passive: true });

    document.addEventListener("pointerover", function (e) {
      var t = e.target.closest && e.target.closest("a, button, [data-cursor], .stack-list li");
      var label = t && t.getAttribute("data-cursor");
      cursor.classList.toggle("is-hover", !!t && !label);
      cursor.classList.toggle("is-label", !!label);
      if (cursorLabel) cursorLabel.textContent = label || "";
    });
    document.documentElement.addEventListener("pointerleave", function () {
      cursor.classList.add("is-hidden");
      cursorDot.classList.add("is-hidden");
    });
  }

  /* ---------------------------------------------------------
     Command palette
     --------------------------------------------------------- */
  (function commandPalette() {
    var dialog = $(".cmdk");
    if (!dialog || typeof dialog.showModal !== "function") {
      $$("[data-open-cmdk]").forEach(function (b) { b.hidden = true; });
      return;
    }
    var input = $("input", dialog);
    var list = $(".cmdk-list", dialog);
    var empty = $(".cmdk-empty", dialog);
    var items = $$("li[role=option]", list);
    var active = 0;

    var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    $$("[data-mod]").forEach(function (k) { k.textContent = isMac ? "⌘" : "Ctrl"; });

    // Group headings
    var lastGroup = null;
    items.forEach(function (li) {
      if (li.dataset.group !== lastGroup) {
        lastGroup = li.dataset.group;
        var h = document.createElement("li");
        h.className = "group-label";
        h.setAttribute("role", "presentation");
        h.dataset.groupLabel = lastGroup;
        h.textContent = lastGroup;
        list.insertBefore(h, li);
      }
    });
    var labels = $$(".group-label", list);

    function visibleItems() { return items.filter(function (li) { return !li.hidden; }); }
    function setActive(i) {
      var vis = visibleItems();
      if (!vis.length) return;
      active = (i + vis.length) % vis.length;
      items.forEach(function (li) { li.classList.remove("is-active"); li.setAttribute("aria-selected", "false"); });
      vis[active].classList.add("is-active");
      vis[active].setAttribute("aria-selected", "true");
      vis[active].scrollIntoView({ block: "nearest" });
    }
    function filter(q) {
      q = q.trim().toLowerCase();
      items.forEach(function (li) {
        li.hidden = q && li.textContent.toLowerCase().indexOf(q) === -1 && li.dataset.group.toLowerCase().indexOf(q) === -1;
      });
      labels.forEach(function (l) {
        l.hidden = !items.some(function (li) { return !li.hidden && li.dataset.group === l.dataset.groupLabel; });
      });
      empty.hidden = visibleItems().length > 0;
      setActive(0);
    }
    function open() {
      if (dialog.open) return;
      cmdkOpen = true;
      input.value = "";
      filter("");
      dialog.showModal();
      input.focus();
      if (lenis) lenis.stop();
      if (useCursor) root.classList.remove("has-cursor");
    }
    // The dialog's "close" event fires asynchronously, so restore scrolling right away
    // (a scroll requested while Lenis is stopped would be ignored).
    function onClosed() {
      if (!cmdkOpen) return;
      cmdkOpen = false;
      if (lenis) lenis.start();
      if (useCursor) root.classList.add("has-cursor");
    }
    function close() {
      if (dialog.open) dialog.close();
      onClosed();
    }
    dialog.addEventListener("close", onClosed);

    function run(li) {
      if (!li) return;
      var action = li.dataset.action, target = li.dataset.target;
      close();
      if (action === "goto") {
        scrollToTarget(target);
      } else if (action === "open") {
        window.open(target, "_blank", "noopener");
      } else if (action === "theme") {
        toggleTheme();
      } else if (action === "href") {
        window.location.href = target;
      } else if (action === "copy") {
        var done = li.dataset.toast || "Copied";
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(target).then(function () { toast(done); }, function () { toast(target); });
        } else {
          toast(target);
        }
      }
    }

    input.addEventListener("input", function () { filter(input.value); });
    dialog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
      else if (e.key === "Enter") { e.preventDefault(); run(visibleItems()[active]); }
    });
    list.addEventListener("click", function (e) {
      var li = e.target.closest("li[role=option]");
      if (li) run(li);
    });
    list.addEventListener("pointermove", function (e) {
      var li = e.target.closest("li[role=option]");
      if (li) setActive(visibleItems().indexOf(li));
    });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) close(); });

    $$("[data-open-cmdk]").forEach(function (b) { b.addEventListener("click", open); });
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        dialog.open ? close() : open();
      }
    });
  })();

  var toastEl = $(".toast"), toastTimer = 0;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-on"); }, 2200);
  }

  /* ---------------------------------------------------------
     Go
     --------------------------------------------------------- */
  runLoader(heroIntro);
})();
