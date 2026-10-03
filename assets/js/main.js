/* ============================================================================
   SAFAL RETREAT - BEHAVIOUR

   Rules this file follows:
   - Nothing starts hidden unless this script has already proved it can reveal
     it. The `is-enhanced` class on <html> is the switch, and it is added only
     after GSAP is confirmed present and reduced motion is confirmed off.
   - No scroll listeners. ScrollTrigger and IntersectionObserver only.
   - Every animation here answers "what does this communicate?" in its comment.
     If it could not, it was deleted rather than kept because it looked nice.
   ========================================================================= */

(() => {
  "use strict";

  const root   = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* --- Footer year ------------------------------------------------------ */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* --- Header state -----------------------------------------------------
     The header is transparent over the hero photograph and solid once the
     page has moved past it, so the nav is legible against both. Driven by an
     observer on a sentinel rather than a scroll handler. */

  const header = document.getElementById("header");
  if (header) {
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:70vh;pointer-events:none";
    document.body.prepend(sentinel);

    new IntersectionObserver(
      ([entry]) => header.classList.toggle("is-stuck", !entry.isIntersecting),
      { threshold: 0 }
    ).observe(sentinel);
  }

  /* --- Mobile drawer ---------------------------------------------------- */

  const menuBtn = document.getElementById("menuBtn");
  const drawer  = document.getElementById("drawer");

  if (menuBtn && drawer) {
    const setOpen = (open) => {
      drawer.dataset.open = String(open);
      menuBtn.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("is-open", open);
      document.body.style.overflow = open ? "hidden" : "";
    };

    menuBtn.addEventListener("click", () => {
      setOpen(drawer.dataset.open !== "true");
    });

    drawer.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => setOpen(false))
    );

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.dataset.open === "true") {
        setOpen(false);
        menuBtn.focus();
      }
    });
  }

  /* --- Hero slideshow ---------------------------------------------------
     Five frames of the property behind a wordmark that does not move.

     The first frame ships in the markup with its own src so it is the LCP
     image and is never waiting on this script. The other four carry
     data-src and are fetched one ahead of where the viewer is, so opening
     the page costs one photograph rather than five.

     It stops on hover, on focus anywhere inside the hero, when the tab is
     hidden, when the hero scrolls away, and permanently if the visitor asks
     for reduced motion. All four of those are cases where a picture
     changing by itself is either wasted or unwanted. */

  const slideWrap = document.getElementById("heroSlides");

  if (slideWrap) {
    const slides = [...slideWrap.querySelectorAll(".hero__slide")];
    const caption = document.getElementById("heroCaption");
    const playBtn = document.getElementById("heroPlay");
    const heroEl = document.querySelector(".hero");
    const DWELL = 6500;

    let index = 0;
    let timer = null;
    let wantsAuto = !reduce.matches;
    let onScreen = true;

    const preload = (i) => {
      const img = slides[i]?.querySelector("img[data-src]");
      if (!img) return;
      img.src = img.dataset.src;
      delete img.dataset.src;
    };

    // One ahead is enough to make the next change seamless.
    preload(1);

    const go = (next) => {
      index = (next + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle("is-active", i === index));
      if (caption) caption.textContent = slides[index].dataset.caption || "";
      preload((index + 1) % slides.length);
    };

    const stop = () => { clearInterval(timer); timer = null; };

    const start = () => {
      stop();
      if (!wantsAuto || !onScreen) return;
      timer = setInterval(() => go(index + 1), DWELL);
    };

    const setAuto = (on) => {
      wantsAuto = on;
      if (playBtn) {
        playBtn.setAttribute("aria-pressed", String(on));
        playBtn.querySelector(".hero__play-label").textContent = on ? "Pause" : "Play";
      }
      on ? start() : stop();
    };

    document.querySelectorAll("[data-slide]").forEach((btn) =>
      btn.addEventListener("click", () => {
        go(index + (btn.dataset.slide === "next" ? 1 : -1));
        // A deliberate step means they are driving now; don't yank it back.
        setAuto(false);
      })
    );

    playBtn?.addEventListener("click", () => setAuto(!wantsAuto));

    // Pause while a pointer or the keyboard is inside the hero, so nothing
    // moves under someone who is reading or tabbing through the controls.
    ["pointerenter", "focusin"].forEach((ev) =>
      heroEl?.addEventListener(ev, stop)
    );
    ["pointerleave", "focusout"].forEach((ev) =>
      heroEl?.addEventListener(ev, () => { if (wantsAuto) start(); })
    );

    // A hidden tab freezes rAF anyway; this stops the interval queueing up
    // changes nobody saw.
    document.addEventListener("visibilitychange", () =>
      document.hidden ? stop() : (wantsAuto && onScreen && start())
    );

    new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        onScreen && wantsAuto ? start() : stop();
      },
      { threshold: 0.2 }
    ).observe(slideWrap);

    reduce.addEventListener("change", (e) => { if (e.matches) setAuto(false); });

    setAuto(wantsAuto);
  }

  /* --- The dock ---------------------------------------------------------
     Book and Enquire, pinned once the hero has gone. Kept out of the way
     while the hero is on screen, because the hero carries the availability
     bar and two sets of competing actions in one view is noise. */

  const dock = document.getElementById("dock");
  const hero = document.querySelector(".hero");

  if (dock && hero) {
    new IntersectionObserver(
      ([entry]) => { dock.dataset.visible = String(!entry.isIntersecting); },
      { threshold: 0, rootMargin: "-40% 0px 0px 0px" }
    ).observe(hero);
  }

  /* --- The estate ------------------------------------------------------
     Pins on the property photograph. One card open at a time; clicking the
     open pin closes it. Buttons and aria-expanded rather than hover alone,
     so this is reachable on a keyboard and on a touch screen. */

  const pins = [...document.querySelectorAll(".pin")];
  const cards = [...document.querySelectorAll(".estate__card")];

  if (pins.length && cards.length) {
    const openPin = (name) => {
      pins.forEach((p) => p.setAttribute("aria-expanded", String(p.dataset.pin === name)));
      cards.forEach((c) => { c.dataset.open = String(c.dataset.card === name); });
    };

    const closeAll = () => {
      pins.forEach((p) => p.setAttribute("aria-expanded", "false"));
      cards.forEach((c) => { c.dataset.open = "false"; });
    };

    closeAll();

    pins.forEach((pin) => {
      pin.addEventListener("click", () => {
        const isOpen = pin.getAttribute("aria-expanded") === "true";
        if (isOpen) closeAll();
        else openPin(pin.dataset.pin);
      });

      // Pointer only. A hover preview is a nice touch with a mouse and a
      // trap with a finger, where hover and tap are the same gesture.
      pin.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "mouse") openPin(pin.dataset.pin);
      });
    });

    document.querySelector(".estate__stage")?.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") closeAll();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });
  }

  /* --- Availability bar -------------------------------------------------
     Hands the guest to the booking engine with their dates already chosen.

     The engine holds its property id in the URL hash, so the link has to be
     built rather than submitted. BOOKING_URL below is the live engine URL
     exactly as the hotel supplied it; the date parameters appended after it
     are a best effort and have NOT been confirmed against SwiftBook's docs.
     If the engine ignores them the guest still lands on the correct property
     and simply re-picks dates, which is no worse than today. Confirm the
     parameter names with SwiftBook and update PARAM_IN / PARAM_OUT. */

  const BOOKING_URL =
    "https://www.swiftbook.io/inst/#home?propertyId=441MFHxi23FfwanL1IEITQ7RpyjM0MTU=&JDRN=Y";
  const PARAM_IN  = "checkIn";
  const PARAM_OUT = "checkOut";

  const availability = document.getElementById("availabilityBar");
  if (availability) {
    const inEl  = document.getElementById("a-in");
    const outEl = document.getElementById("a-out");

    // Default to tonight and tomorrow, and never let the picker offer a date
    // in the past.
    const iso = (d) => d.toISOString().slice(0, 10);
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 864e5);

    inEl.min = iso(today);
    outEl.min = iso(tomorrow);
    inEl.value = iso(today);
    outEl.value = iso(tomorrow);

    inEl.addEventListener("change", () => {
      const next = new Date(new Date(inEl.value).getTime() + 864e5);
      outEl.min = iso(next);
      if (!outEl.value || outEl.value <= inEl.value) outEl.value = iso(next);
    });

    availability.addEventListener("submit", (e) => {
      e.preventDefault();
      let url = BOOKING_URL;
      if (inEl.value && outEl.value) {
        url += `&${PARAM_IN}=${inEl.value}&${PARAM_OUT}=${outEl.value}`;
      }
      window.open(url, "_blank", "noopener");
    });
  }

  /* --- Enquiry form -----------------------------------------------------
     Validates on submit, then per-field once a field has been touched, so a
     guest is not told they are wrong while still typing the first character.
     The demo has no backend, so it reports success without claiming to have
     sent anything it did not. */

  const form = document.getElementById("enquiryForm");
  if (form) {
    const status = document.getElementById("formStatus");
    const submit = document.getElementById("submitBtn");

    const fieldOf = (input) => input.closest(".field");

    const validate = (input) => {
      let ok = input.checkValidity();

      if (ok && input.id === "f-out") {
        const inEl = document.getElementById("f-in");
        if (inEl.value && input.value && input.value <= inEl.value) ok = false;
      }

      const field = fieldOf(input);
      if (field) field.dataset.invalid = String(!ok);
      input.setAttribute("aria-invalid", String(!ok));
      return ok;
    };

    const inputs = [...form.querySelectorAll("input, select, textarea")];

    inputs.forEach((input) => {
      input.addEventListener("blur", () => {
        if (input.dataset.touched) validate(input);
      });
      input.addEventListener("input", () => {
        input.dataset.touched = "1";
        if (fieldOf(input)?.dataset.invalid === "true") validate(input);
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const required = inputs.filter((i) => i.required);
      const bad = required.filter((i) => {
        i.dataset.touched = "1";
        return !validate(i);
      });

      if (bad.length) {
        status.dataset.state = "err";
        status.textContent = "Please check the highlighted fields.";
        bad[0].focus();
        return;
      }

      submit.disabled = true;
      submit.textContent = "Sending";
      status.dataset.state = "";
      status.textContent = "";

      // Demo build: no mail transport is wired, so this stands in for the
      // POST. Replace with the live endpoint before this goes to production.
      window.setTimeout(() => {
        form.reset();
        inputs.forEach((i) => {
          delete i.dataset.touched;
          const f = fieldOf(i);
          if (f) f.dataset.invalid = "false";
        });
        submit.disabled = false;
        submit.textContent = "Send enquiry";
        status.dataset.state = "ok";
        status.textContent =
          "Thank you. The house will reply within a few hours. For same day arrivals, please call +91 93299 29609.";
      }, 900);
    });
  }

  /* ======================================================================
     Everything below is motion. Past this point the page is already
     complete, correct and usable.
     ================================================================== */

  if (reduce.matches) return;

  // GSAP is deferred and may not have arrived. If it has not, we stop here
  // and the page stays exactly as it rendered.
  const start = () => {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    if (!gsap || !ScrollTrigger) return;

    gsap.registerPlugin(ScrollTrigger);

    // Only now is it safe for anything to begin hidden.
    root.classList.add("is-enhanced");

    /* --- Hero arrival --------------------------------------------------
       Communicates hierarchy on load: headline, then the sentence that
       qualifies it, then the two things you can do. In that order, because
       that is the order they matter. */

    // fromTo, not from. The stylesheet already holds these at opacity 0 so
    // they cannot flash before this runs, and gsap.from() would read that 0
    // as the destination and animate nothing.
    gsap.timeline({ defaults: { ease: "expo.out", duration: 1.2 } })
      .fromTo(".wordmark",
        { yPercent: 14, letterSpacing: "0.22em" },
        { yPercent: 0, letterSpacing: "0.08em", delay: 0.1, duration: 1.6 })
      .fromTo(".hero__rule",
        { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 1 }, "-=1.1")
      .fromTo(".hero__tagline",
        { yPercent: 10, opacity: 0 }, { yPercent: 0, opacity: 1 }, "-=0.85")
      .set([".wordmark", ".hero__rule", ".hero__tagline"], { clearProps: "transform" });

    /* --- The hero recedes ----------------------------------------------
       The opening frame scales down and lifts as the page leaves it, rather
       than simply scrolling off the top. Scrubbed to scroll position and
       clamped, so it is a continuous response to where the reader is and not
       an animation that fires. This is the single move that most separates a
       site that feels built from one that feels composed: nothing triggers,
       everything responds. */

    gsap.to(".hero__inner", {
      scale: 0.82,
      yPercent: -6,
      opacity: 0.35,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: 0.4,
      },
    });

    /* The photograph behind it moves at its own, slower rate. Two layers
       travelling at different speeds is what reads as depth. */
    gsap.to(".hero__media", {
      yPercent: 12,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: 0.4,
      },
    });

    /* --- Section reveals -----------------------------------------------
       Communicates hierarchy on scroll: the eye is given the top of a
       section before the detail under it.

       IntersectionObserver, deliberately, not ScrollTrigger. The grounds
       section pins and adds roughly two thousand pixels of scroll distance
       when it initialises, which invalidates any trigger position cached
       before that happened. The browser recomputes an observer instead of
       caching it, so it cannot go stale. The failure mode this avoids is
       content that starts hidden and never reveals, which is the worst thing
       a reveal can do and is not worth the nicer stagger API. */

    const revealEls = [...document.querySelectorAll("[data-reveal]")];

    const show = (el, delay = 0) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.85,
        delay,
        ease: "expo.out",
        overwrite: true,
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        // Stagger only across the items arriving in this same tick, so a row
        // of four facts lands as one gesture rather than four.
        const arriving = entries.filter((e) => e.isIntersecting);
        arriving.forEach((entry, i) => {
          observer.unobserve(entry.target);
          show(entry.target, Math.min(i * 0.07, 0.35));
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0 }
    );

    revealEls.forEach((el) => observer.observe(el));

    /* Failsafe, and not an optional one.

       An observer reports a change in intersection state. If the page jumps
       far enough in one go that an element is never sampled on screen, which
       is what an anchor link, the End key and a scrollbar drag all do, no
       callback ever fires and that content stays invisible forever. Scrolling
       smoothly hides the problem, which is exactly what makes it dangerous.

       So after every scroll settles, anything still hidden that has reached
       the viewport is shown without ceremony. ScrollTrigger's own scrollEnd
       event, not a raw scroll listener. */

    const sweep = () => {
      let remaining = 0;
      revealEls.forEach((el) => {
        if (parseFloat(getComputedStyle(el).opacity) > 0.9) return;
        if (el.getBoundingClientRect().top < window.innerHeight) {
          observer.unobserve(el);
          gsap.set(el, { opacity: 1, y: 0 });
        } else {
          remaining++;
        }
      });
      // Nothing left below the fold means nothing left to watch.
      if (!remaining) ScrollTrigger.removeEventListener("scrollEnd", sweep);
    };

    ScrollTrigger.addEventListener("scrollEnd", sweep);
    window.setTimeout(sweep, 2500);

    /* --- Grounds, horizontal pan ---------------------------------------
       Communicates the shape of the property. The grounds are a sequence of
       outdoor spaces you walk between, so the section moves sideways rather
       than stacking them into a vertical list of cards.

       Desktop only. Below 1024 the track is already a native scroll-snap
       rail, which is the better interaction on a phone and needs no script. */

    const viewport = document.getElementById("spacesViewport");
    const track    = document.getElementById("spacesTrack");

    if (viewport && track) {
      ScrollTrigger.matchMedia({
        "(min-width: 1024px)": () => {
          const distance = () => track.scrollWidth - window.innerWidth + 80;

          const tween = gsap.to(track, {
            x: () => -distance(),
            ease: "none",
            scrollTrigger: {
              trigger: viewport,
              start: "top top",
              end: () => "+=" + distance(),
              pin: true,
              scrub: 0.8,
              invalidateOnRefresh: true,
              anticipatePin: 1,
            },
          });

          return () => {
            tween.scrollTrigger?.kill();
            tween.kill();
            gsap.set(track, { clearProps: "x" });
          };
        },
      });
    }

    /* --- Photographs settle --------------------------------------------
       Communicates depth. Scrubbed to scroll position so the image is tied
       to where the reader is rather than playing on a timer. Scale only: the
       media is object-fit cover inside an overflow-hidden frame, so scaling
       can never expose an edge. */

    gsap.utils
      .toArray(".intro__figure img, .celebrate__media img")
      .forEach((img) => {
        gsap.fromTo(
          img,
          { scale: 1.12 },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: img.closest("section"),
              start: "top bottom",
              end: "bottom top",
              scrub: 0.7,
            },
          }
        );
      });

    /* --- Housekeeping ---------------------------------------------------
       Lazy images change the height of the document, and every trigger
       measured before that was measured against the wrong page. */
    window.addEventListener("load", () => ScrollTrigger.refresh());

    // Reduced motion turned on mid-session: tear it all down, leave the page
    // in its finished state.
    reduce.addEventListener("change", (e) => {
      if (!e.matches) return;
      ScrollTrigger.getAll().forEach((t) => t.kill(false));
      gsap.globalTimeline.clear();
      gsap.set("[data-reveal]", { clearProps: "all" });
      root.classList.remove("is-enhanced");
    });
  };

  /* Run as soon as the libraries exist, not on window.load.

     This file and the two GSAP files are all deferred, and deferred scripts
     execute in document order before DOMContentLoaded, so by the time this
     line runs GSAP is already here. Waiting for load instead would mean the
     hero text paints visible, then `is-enhanced` arrives and hides it, then
     it fades back in. On a slow connection that blink is long enough to read
     as a bug. ScrollTrigger still gets its refresh on load, further up, once
     the images have settled the final page height. */

  if (window.gsap && window.ScrollTrigger) start();
  else window.addEventListener("load", start, { once: true });
})();
