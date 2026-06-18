---
name: interaction-design
description: 'A comprehensive guide to creating engaging, intuitive web interactions using micro-interactions, smooth state transitions, skeleton loaders, and scroll animations.'
metadata:
  author: 'Utkarsh Patrikar'
  author_url: 'https://github.com/utkarsh232005'
---

# Interaction Design: Creating Engaging UI Motion & Transitions

This skill provides a systematic framework for introducing motion, feedback, and thoughtful state transitions in your user interfaces to enhance usability, guide focus, and delight users.

---

## When to Use This Skill

*   **Microinteractions**: Enhancing buttons, inputs, and toggle switches with responsive tactile feedback.
*   **Component Transitions**: Sliding side drawers, expanding modals, and collapsing accordion grids.
*   **Loading States**: Displaying custom skeleton screen frameworks while assets resolve.
*   **Toast Notifications**: Animated success, warning, or error messages sliding in dynamically.
*   **Scroll-Triggered Animations**: Fading, translating, or pivoting layout content based on user scroll coordinates.

---

## 1. Core Principles of Motion

Every animation must serve a structural or functional purpose. Avoid introducing "decorational fluff" that slows down interactions.

*   **Feedback**: Confirm that a user's action has been registered (e.g., a button slightly sinking on click or showing a success check).
*   **Orientation**: Illustrate spatial relationships (e.g., a detail drawer sliding from the right shows that the context resides off-screen).
*   **Focus**: Direct attention to new elements (e.g., an error banner shaking slightly to alert the user of failed input validation).
*   **Continuity**: Maintain user context through page or layout changes (e.g., an element expanding from its grid spot to fill the screen rather than instantly popping).

---

## 2. Timing & Easing Standards

Use consistent, lifelike velocity curves for your transitions.

### 2.1 Easing Curves
*   **Ease-Out (Decelerating)**: `cubic-bezier(0.16, 1, 0.3, 1)` - Use for entrance transitions (elements coming into the screen). It starts fast and slows down gracefully.
*   **Ease-In (Accelerating)**: `cubic-bezier(0.7, 0, 0.84, 0)` - Use for exit transitions (elements leaving the screen).
*   **Standard (Ease-in-out)**: `cubic-bezier(0.4, 0, 0.2, 1)` - Use for point-to-point movements on screen.

### 2.2 Duration Guidelines
*   **100ms - 150ms**: Micro-feedback (button hovers, scale-press, active checks).
*   **200ms - 300ms**: Small components (toggles, dropdown expands, accordion sliders).
*   **300ms - 500ms**: Medium layouts (sliding side drawers, modals, overlay fade-ins).
*   **500ms+**: Complex, orchestrated grid reveals or scroll journeys.

---

## 3. UI Component States & Skeleton Templates

Never leave a user guessing during network operations. Always define clear states.

### 3.1 Skeleton Screen Templates (CSS)
Skeletons provide the illusion of fast page loads by loading placeholders that mimic the content layout.

```css
/* Animated Shimmer Skeleton */
.skeleton-placeholder {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.03) 25%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.03) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 4. Implementation Code Templates

### 4.1 React Framer Motion Entry Animation
When working in React, leverage spring physics to create organic-feeling movement:

```typescript
import { motion, AnimatePresence } from 'framer-motion';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function SideDrawer({ isOpen, onClose, children }: DrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Drawer Body */}
          <motion.div 
            className="fixed right-0 top-0 bottom-0 w-80 bg-slate-900 border-l border-white/10 p-6 z-50"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

---

## 5. Accessibility & Performance Guardrails

*   **Respect System Preferences**: Always wrap heavy motion in a media query targeting user preferences to avoid causing motion sickness:
    ```css
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
    ```
*   **Hardware Acceleration**: Restrict transitions to composited layers (`transform` and `opacity`). Animating layout recalculators (like `width`, `height`, `top`, `left`, `margin`) triggers reflows and degrades FPS.
