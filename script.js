(function () {
  var root = document.documentElement;

  // Theme toggle: remembers an explicit choice, otherwise follows the OS setting.
  var toggle = document.querySelector(".theme-toggle");
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function isDark() {
    return root.dataset.theme ? root.dataset.theme === "dark" : media.matches;
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  // Keep the year and years-of-experience current without editing the HTML.
  var now = new Date();
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = now.getFullYear();
  });
  var careerStart = new Date(2016, 6, 1); // July 2016
  var years = Math.floor((now - careerStart) / (365.25 * 24 * 3600 * 1000));
  document.querySelectorAll("[data-years]").forEach(function (el) {
    el.textContent = years;
  });

  // Header border once the page scrolls.
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (!("IntersectionObserver" in window)) return;

  // Highlight the nav link for the section in view.
  var links = {};
  document.querySelectorAll(".nav a").forEach(function (a) {
    links[a.getAttribute("href").slice(1)] = a;
  });
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var link = links[entry.target.id];
      if (link && entry.isIntersecting) {
        Object.keys(links).forEach(function (k) { links[k].classList.remove("active"); });
        link.classList.add("active");
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("main section[id]").forEach(function (s) { spy.observe(s); });

  // Fade sections in as they scroll into view.
  var reveal = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        reveal.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".section .wrap").forEach(function (el) {
    el.classList.add("reveal");
    reveal.observe(el);
  });
})();
