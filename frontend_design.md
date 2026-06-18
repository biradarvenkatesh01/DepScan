---
name: frontend-design
description: 'A structured design-thinking workflow to build distinctive, production-grade web interfaces that avoid generic AI slop aesthetics.'
metadata:
  author: 'Utkarsh Patrikar'
  author_url: 'https://github.com/utkarsh232005'
---

# Frontend Design: Intentional Interface Craftsmanship

This skill guides the creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

---

## 1. Design Thinking Phase

Before writing a single line of markup or styling, define the conceptual foundation of the interface:

*   **Purpose & Target Audience**: What problem does this page solve, and what are the user expectations?
*   **Bold Aesthetic Direction**: Commit to an extreme, opinionated visual theme rather than defaulting to generic styles:
    *   *Brutalist Minimal*: Flat high-contrast monochromes, heavy grids, oversized typography.
    *   *Retro-Futurism/Cyber*: Cosmic obsidian, glowing neon accents, monospaced details.
    *   *Refined Luxury*: Warm sepia and cream tones, serif headings, deep negative space.
    *   *Industrial/Technical*: Structured grid modules, borders, and status lights.
*   **The Unforgettable Element**: Identify the "one thing" that elevates the interface (e.g. an interactive custom chart, floating nebula, or command action console).
*   **Technical Constraints**: Target framework, required responsive behavior, and accessibility benchmarks.

---

## 2. Overcoming "AI Slop" Anti-Patterns

Generic AI designs look identical. Avoid these common traps:

*   **Default Typography**: Never default to simple `sans-serif`, `Inter`, or standard system fonts for headers. Combine clean variable fonts (like `Outfit`, `Plus Jakarta Sans`, or `Playfair Display`) with tech-inspired details (like `JetBrains Mono` or `Courier`).
*   **Timid Spacing**: Do not pack elements closely. Professional UIs utilize generous negative space (use `clamp()` for fluid, viewport-responsive padding and margins).
*   **Gradient Overuse**: Avoid generic purple-to-blue gradients slapped onto every container. Use solid, curated HSL color schemes with subtle gradients only to highlight specific focus points.
*   **Ad-hoc Styles**: Do not write random inline styles or mix design systems. Define design tokens (`:root` variables) for spacing, colors, and shadows, and adhere to them strictly.

---

## 3. Aesthetic Guardrails for Production UI

*   **Typography Scale**: Maintain absolute hierarchy. Set standard clamps on headers:
    ```css
    h1 {
      font-size: clamp(2.2rem, 4vw, 4.5rem);
      line-height: 1.05;
      font-family: var(--font-heading);
    }
    ```
*   **Textures & Lighting**: Create depth using frosted glass layers (`backdrop-filter: blur(12px)`) and thin, low-opacity border strokes (`border: 1px solid rgba(255, 255, 255, 0.05)`).
*   **Hover States**: Make interactive items feel alive with transitions:
    ```css
    .card {
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s ease;
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: var(--accent-color);
    }
    ```
