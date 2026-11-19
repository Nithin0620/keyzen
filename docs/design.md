# Aegis Landing Page — UI/UX Recreation & Adaptation Specification

Based on the **Nectarline ("Supply Side Studio®")** visual & interactive architecture, adapted for **Aegis** (formerly Keyzen) — the enterprise secret-ops & programmatic key orchestration platform.

---

## 1. Overview & Vision

A high-fidelity, five-section landing page featuring:
- **Fixed Full-Viewport Interactive Scene Layer**:
  - Dusk lotus-pond video / WebGL ripple lens with chromatic aberration.
  - Crossfading violet gradient & night pond backdrop based on scroll position.
  - 3D crystal-glass koi fish (Tripo GLB via Three.js) that swims and articulates through all 5 sections, with swimming kinematics modulated by scroll velocity and mouse tilt.
- **Glassmorphic UI Overlay (HTML/CSS)**:
  - Responsive unit scaling (`--u` system based on 1440px desktop / 390px mobile).
  - Dynamic interactive dashboard with animated SVG sparklines, area charts, live status indicators, and typing JSON bid/key-exchange stream.
  - Role-based staircase use-case showcase.
  - Fully accessible reduced-motion fallback.

---

## 2. Asset & Media Pipeline

| Asset | Source / URL | Aegis Context |
|---|---|---|
| **Day Plate** (Still) | `https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261104_151305_25ef1f45-0886-491c-a7a8-81e296402d5a.png&w=2400&q=85` | Hero background plate before video decode & under `prefers-reduced-motion`. |
| **Pond Video Loop** | `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261104_160514_d8369d6e-d8ba-4532-9751-b32e0c8aaf75.mp4` | 5.04s seamless Kling 3.0 loop uploaded as WebGL texture for ripple simulation. |
| **Night Plate** | `https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261104_151304_3b7ab857-b4c2-4f5a-8d7f-e1ec429185a5.png&w=2400&q=85` | Deep night plate fading in for CTA & footer. |
| **3D Koi Model** | `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261104_151843_47d87652-1c40-465c-b0d6-cd94c22a9d3e.glb` | GLB crystal koi mesh with custom vertex swimming shader and Physical Material. |
| **Three.js Core & Addons** | `three@0.170.0` (ESM CDN via importmap) | `GLTFLoader`, `RoomEnvironment`. |

---

## 3. Typography & Design Tokens

### Fonts
- **Sans UI & Headlines**: `Inter Tight` (weights 300, 400, 500, 600)
- **Serif Accent**: `Instrument Serif` (400 italic only)
- **Monospace Code/Data**: `Fira Code` (400)

### Color Palette
- `ink`: `#f4f2ff` (Primary text)
- `ink-2`: `rgba(236, 232, 255, 0.72)` (Secondary / body copy)
- `ink-3`: `rgba(220, 214, 255, 0.50)` (Captions, tags, labels)
- `peri`: `#6f78ff` (Primary CTA fills)
- `peri-2`: `#8d94ff` (Accent text, hover highlights, step counters)
- `navy`: `#0d0830` (Base viewport background)
- `line`: `rgba(196, 178, 255, 0.15)` (Dividers & hairlines)
- `glass-surface`: `linear-gradient(160deg, rgba(110,90,240,0.14), rgba(60,40,150,0.08))` with `backdrop-filter: blur(22px) saturate(1.35)`

---

## 4. Architectural Layers & Rendering Stack

```
Z-Index 20: Fixed Nav Bar (Logo, Pill Controls, Blur Background)
Z-Index 1:  Content Sections (Hero -> Studio -> Packages -> Use Cases -> CTA/Footer)
Z-Index 0:  Fixed Scene Viewport (Pointer-events: none)
            ├── Layer 4: Three.js Koi Canvas (Perspective Camera, Physical Shaders)
            ├── Layer 3: Night Plate (Opacity controlled by smoothstep to bottom)
            ├── Layer 2: Violet Gradient Layer (Crossfade intermediate)
            └── Layer 1: Day Plate & WebGL Ripple Canvas (pondfx) / Video Texture
```

### 4.1 WebGL Ripple Lens (pondfx)
- Full-screen WebGL 1 shader quad.
- Frame update texture upload from `<video>` element with cover-fit math.
- Mouse distance ripple with chromatic aberration (`red offset = +(0.005, 0) * strength`, `blue offset = -(0.005, 0) * strength`).
- 3D parallax tilt response up to ~1° on cursor motion.

### 4.2 3D Swimming Koi Rig & Vertex Deformation
- **Material**: `MeshPhysicalMaterial` (lilac-pink crystal transmission, clearcoat 1.0, iridescence 0.85).
- **Vertex Shader Injection**:
  $$\text{tail} = \text{clamp}\left(\frac{0.32 - x}{0.82}, 0, 1\right)$$
  $$z += \sin(x \cdot \text{freq} - \text{time} \cdot \text{speed}) \cdot \text{amp} \cdot (0.15 + 1.6 \cdot \text{tail}^2)$$
  $$y += \cos(x \cdot \text{freq} \cdot 0.5 - \text{time} \cdot \text{speed} \cdot 0.5) \cdot \text{amp} \cdot 0.12 \cdot \text{tail}$$
- **Scroll Poses (Interpolated via easeInOutCubic)**:
  - Hero $(0, y=0, s=0.72)$
  - Statement $(Studio + 0.2h)$
  - Dashboard $(Dashboard center - 0.5h)$
  - Packages $(Packs + 0.3h)$
  - Use Cases $(Uses + 0.3h)$
  - CTA/Footer $(End - 0.1h)$

---

## 5. Five Sections Breakdown

1. **Hero**:
   - Split title with overflow-hidden reveal spans: "Introducing" / "Aegis" (or "Nectarline").
   - Subline with registered trademark superscript: "Supply Side Studio®".
   - CTA group and glassmorphic floating scroll indicator card with bouncing arrow.
2. **Studio / Engine Showcase**:
   - Headline & lede with serif accent.
   - 4-column metric counters with vertical divider hairlines.
   - Glassmorphic product console: sidebar, search with `⌘K`, deterministic SVG area chart + sparkline draw-in animations, format mix progress bars, and active deals table.
3. **Packages / Dynamic Exchange**:
   - Split view with auto-typing JSON stream (OpenRTB/Secret payload) with blinking block cursor.
   - 3 glass package cards (Lead highlight card + 2 secondary cards) with custom SVG icons.
   - 3-step numbered rollout strip with growing gradient highlight borders.
4. **Use Cases**:
   - Asymmetric staggered staircase layout (4 diagonal step cards: Media Agency, Direct Advertiser, Publisher, Ad Tech / Enterprise Security).
   - Sticky top-right heading block.
5. **CTA & Footer**:
   - Radial highlight glass CTA card.
   - Multi-column link grid with live system heartbeat indicator.
   - Giant low-opacity background gradient wordmark.

---

## 6. Implementation Strategies for Aegis

We have two clean options:
1. **Standalone Showcase File (`apps/web/public/landing.html` or root `nectarline.html`)**:
   - Exact 1:1 recreation as specified: single self-contained HTML file, zero bundler dependencies, pure CSS, WebGL shader and Three.js module.
   - Accessible immediately via browser or local dev server.
2. **Next.js Integrated Landing (`apps/web/src/app/(marketing)/page.tsx`)**:
   - Adapted into React components with `@react-three/fiber` or a dedicated custom canvas hook, seamlessly integrating with Aegis auth, dashboard, and design system.
