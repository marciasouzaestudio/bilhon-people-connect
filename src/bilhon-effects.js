/* ============================================================================
   GERADO por apply-bilhon-ds (make-effects-layer) — runtime dos efeitos, DROP-IN reversível.
   Cópia verbatim de C:/Users/tech/bilhonos/_shared/bilhon-packages/ds/official/js/effects.js
   Liga: scroll-progress, scroll-to-top, reveal/stagger (IntersectionObserver),
   magnetic buttons, hover 3D tilt. Self-init no DOMContentLoaded.
   Para reverter: remova o import/script. NÃO editar à mão.
   ============================================================================ */

/* ============================================================
   BILHON OS Design System v2.0 — Effects
   Scroll progress, reveal, magnetic buttons, tilt.
   Author: Homer (Romulo Henricco)
   ============================================================ */

(function () {
  'use strict';

  /* ── 1. Scroll Progress Bar ──────────────────────────────── */
  function initScrollProgress() {
    var bar = document.querySelector('.bl-scroll-progress');
    if (!bar) return;

    function update() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = progress + '%';
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ── 2. Scroll-to-Top Button ─────────────────────────────── */
  function initScrollToTop() {
    var btn = document.querySelector('.bl-scroll-top');
    if (!btn) return;

    function toggle() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      if (scrollTop > 300) {
        btn.classList.add('bl-visible');
      } else {
        btn.classList.remove('bl-visible');
      }
    }

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  /* ── 3. Reveal on Scroll (Stagger) ──────────────────────── */
  function initRevealOnScroll() {
    var items = document.querySelectorAll('.bl-stagger');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      // Fallback: reveal everything immediately
      items.forEach(function (el) { el.classList.add('bl-revealed'); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('bl-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ── 4. Magnetic Buttons ─────────────────────────────────── */
  function initMagneticButtons() {
    var selectors = '.bl-btn--primary, .bl-action-btn--primary';
    var buttons = document.querySelectorAll(selectors);
    if (!buttons.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = 'translate(' + (x * 0.15) + 'px, ' + (y * 0.15) + 'px)';
      });

      btn.addEventListener('mouseleave', function () {
        btn.style.transform = 'translate(0, 0)';
      });
    });
  }

  /* ── 5. Tilt Effect ──────────────────────────────────────── */
  function initTilt() {
    var cards = document.querySelectorAll('.bl-tilt');
    if (!cards.length) return;

    var maxDeg = 12;

    cards.forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width;
        var y = (e.clientY - rect.top) / rect.height;
        var rotateY = (x - 0.5) * maxDeg * 2;
        var rotateX = (0.5 - y) * maxDeg * 2;
        card.style.transform =
          'perspective(800px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
      });

      card.addEventListener('mouseleave', function () {
        card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
      });
    });
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    initScrollProgress();
    initScrollToTop();
    initRevealOnScroll();
    initMagneticButtons();
    initTilt();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
