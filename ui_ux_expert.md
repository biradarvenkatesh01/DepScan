---
name: ui-ux-expert
description: 'A structured framework to build React interfaces prioritizing accessibility, visual consistency, and strict design token adherence.'
metadata:
  author: 'Utkarsh Patrikar'
  author_url: 'https://github.com/utkarsh232005'
---

# UI/UX Expert: Accessible & Consistent Component Architecture

The UI/UX Expert skill provides a structured framework for building React interfaces that prioritize accessibility and visual consistency. It acts as an automated guide for developers using shadcn/ui and Tailwind CSS, enforcing strict adherence to design tokens and component patterns. By integrating with Context7 for real-time library documentation and requiring a predefined analysis phase, it ensures that your UI implementation respects the project's established constraints. This tool eliminates arbitrary styling and guarantees clean, production-grade output.

---

## 1. Style Guide Study Phase

Before generating React components, study and internalize the project's existing design token structure:

*   **Color Palettes**: Strictly map styles to semantic colors (e.g. `var(--bg-primary)`, `var(--text-secondary)`, `var(--accent-cyan)`) instead of using hardcoded hex values (like `#121212`).
*   **Spacing Scales**: Follow the Tailwind spacing scale (e.g. `space-y-4`, `p-6`, `gap-3`) to maintain mathematical alignment consistency.
*   **Typography Sets**: Align font weight, size, and leading with the project's typographic system (e.g., `font-heading`, `font-sans`, `font-mono`).

---

## 2. API Documentation Lookup

To prevent outdated syntax errors or legacy parameters from stale training data:

*   **shadcn/ui & Radix Primitives**: Verify proper prop structures and slots (e.g., checking Radix `asChild` behaviors).
*   **Tailwind Utilities**: Avoid duplicate utility classes or conflicting plugins. Enforce clean configuration mappings.

---

## 3. Accessibility & Specification Mapping

### 3.1 WCAG 2.1 AA Compliance
*   **Keyboard Focus**: Ensure all interactive elements have clear focus states (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`).
*   **Contrast Standards**: Contrast ratios must meet WCAG 2.1 AA standards (minimum `4.5:1` for normal text and `3:1` for large text).
*   **Screen Readers**: Set descriptive `aria-label` tags, appropriate `role` definitions, and handle modal focus-traps correctly.

### 3.2 E2E Test Mapping
Ensure all interactive buttons, inputs, and custom triggers expose consistent testing attributes to allow automated E2E test scripts to locate them:
```html
<!-- Example Test ID mapping -->
<button data-testid="scan-trigger-btn" className="btn btn-primary">
  Scan Project
</button>
```

---

## 4. Code Standards & Named Imports

*   **Named Imports**: Import React hooks individually (`import { useState, useEffect } from 'react'`) instead of namespace pollution.
*   **Clean Tailwind Architectures**: Leverage `tailwind-merge` and `clsx` to safely override component class names without styling conflicts.
