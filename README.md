# Safal Retreat

A two-page pitch demo for [Safal Retreat](https://safalretreat.in/), a lakefront boutique hotel on Bhopal's Upper Lake.

Static HTML, CSS and JavaScript. No build step, no framework, no bundler. GSAP and Three.js load from a CDN; everything else is hand-authored.

```bash
python -m http.server 4321
# then open http://127.0.0.1:4321
```

## Pages

| | |
|---|---|
| `index.html` | Hero with a WebGL water surface, an estate hotspot explorer, rooms, grounds, dining, weddings, location, enquiry |
| `events.html` | Weddings and events: the three venues, the full capacity table, an event enquiry |

## Design system

Everything lives in [`assets/css/tokens.css`](assets/css/tokens.css). No component uses a raw value; if a number isn't in the scale, the scale is wrong.

- **Palette** drawn from the property's setting rather than the navy-and-gold default: forest `#1B3A2F`, deep `#0E211A`, paper `#FBFAF7`, burnt sienna `#C2521C`
- **Type** Marcellus for the wordmark, Cormorant Garamond for display, Jost for interface
- **Scales** nine type steps, eleven space steps, corner radius locked at `0` throughout

Total CSS is 44 KB across two files, with three `!important` declarations, all of them inside the reduced-motion block.

## Motion

Measured off the reference sites rather than guessed at:

- **Native `position: sticky`** for held section headings, not JavaScript pinning. A GSAP pin earlier in this build silently invalidated every ScrollTrigger position created before it; sticky can't fail that way because the browser resolves it per frame.
- **Continuous scrubbed transforms** rather than one-shot triggers. The hero scales and fades against scroll position instead of firing an animation.
- **IntersectionObserver plus a `scrollEnd` sweep** for reveals. An observer alone misses elements when the page jumps far enough in one go, which is what anchor links, the End key and a scrollbar drag all do, and the failure mode is content that stays invisible forever.
- Everything is `transform` and `opacity`. `prefers-reduced-motion` tears the whole layer down, including mid-session.

The WebGL hero is an enhancement, not the content. It starts at zero opacity and fades in only after a frame has been drawn; if the CDN is blocked, WebGL is missing, the connection is metered or reduced motion is on, the photograph underneath is the hero and the page is complete without it.

## Measured

| | index | events |
|---|---|---|
| LCP | 104 ms | 96 ms |
| CLS | 0.0041 | 0 |
| Contrast failures | 0 | 0 |
| Stranded reveals | 0 / 41 | 0 / 30 |

Mobile-first: 36 `min-width` queries against 13 `max-width`.

## Not yet real

This is a pitch demo. Before it goes to the client:

- [ ] **Dining hours on the homepage are placeholders.** The hotel publishes none; these need to come from them.
- [ ] **Both enquiry forms have no backend.** They validate and confirm, but nothing is sent.
- [ ] **Estate hotspot positions are read off a single photograph** and need checking by someone who knows the grounds.
- [ ] **Distances to Bhojpur and Sanchi are approximate**, and labelled as such.
- [ ] **SwiftBook date parameters are unconfirmed.** `PARAM_IN` and `PARAM_OUT` in `main.js` are a best effort; if the engine ignores them the guest still lands on the right property.

Recommended to the hotel: CNAME `book.safalretreat.in` to the SwiftBook engine so guests aren't sent to an unfamiliar domain mid-booking.

## Photography

All photographs are Safal Retreat's own, taken from their public CDN for the purpose of pitching this work to them. They are reproduced here as part of that proposal and remain the property of Safal Venture. Not licensed for reuse.
