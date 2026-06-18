---
name: icon-design
description: 'A comprehensive guide to selecting and implementing production-grade icons across Lucide, Heroicons, and Phosphor icon sets.'
metadata:
  author: 'Utkarsh Patrikar'
  author_url: 'https://github.com/utkarsh232005'
---

# Icon Design: Select the right icon for the job

This skill provides a standardized approach to selecting, styling, and integrating production-grade iconography. It ensures consistency across user interfaces, prevents common alignment and scaling issues, and guides tree-shakeable implementation patterns.

---

## Quick Reference (Top 20 Concepts)

| Concept | Lucide | Heroicons | Phosphor |
|:---|:---|:---|:---|
| **Award/Quality** | `Trophy` | `trophy` | `Trophy` |
| **Price/Value** | `Tag` | `tag` | `Tag` |
| **Location** | `MapPin` | `map-pin` | `MapPin` |
| **Expertise** | `GraduationCap` | `academic-cap` | `GraduationCap` |
| **Support** | `MessageCircle` | `chat-bubble-left-right` | `ChatCircle` |
| **Search** | `Search` | `magnifying-glass` | `MagnifyingGlass` |
| **Settings** | `Settings` | `cog-6-tooth` | `Gear` |
| **Security** | `Shield` | `shield-check` | `Shield` |
| **User/Profile** | `User` | `user` | `User` |
| **Analytics/Growth** | `TrendingUp` | `arrow-trending-up` | `TrendingUp` |
| **Time/Schedule** | `Calendar` | `calendar` | `Calendar` |
| **Notification** | `Bell` | `bell` | `Bell` |
| **Download** | `Download` | `arrow-down-tray` | `Download` |
| **Upload** | `Upload` | `arrow-up-tray` | `Upload` |
| **Edit/Write** | `Edit` | `pencil-square` | `PencilSimple` |
| **Trash/Delete** | `Trash2` | `trash` | `Trash` |
| **Home** | `Home` | `home` | `House` |
| **Mail/Message** | `Mail` | `envelope` | `Envelope` |
| **Link/Attach** | `Link` | `link` | `Link` |
| **Error/Warning** | `AlertTriangle` | `exclamation-triangle` | `Warning` |

---

## 1. Icon Selection Rules

Consistency is critical for professional-grade design.

*   **Stick to One Library per Section**: Do not mix Lucide and Heroicons in the same row or group of elements. The differences in stroke weight and corner rounding create visual clutter.
*   **Keep Style Uniformity**: Use all outline or all solid (filled) icons across your components.
*   **Semantic Correctness**: Do not use "creative" mappings that confuse users (e.g. using a `Wrench` for "General Settings" instead of a `Gear`, or using a `Target` for "Location").

---

## 2. Accessibility Best Practices

Icons must remain accessible to users with screen readers.

### 2.1 Decorative Icons
If the icon is purely illustrative and is accompanied by text copy, hide it from screen readers:
```html
<!-- HTML / JSX -->
<button class="btn">
  <svg aria-hidden="true" ...></svg>
  <span>Download PDF</span>
</button>
```

### 2.2 Standalone Icon Buttons
If the button contains ONLY the icon, you must provide a descriptive label:
```html
<!-- HTML / JSX -->
<button aria-label="Close panel" class="btn-close">
  <svg aria-hidden="true" ...></svg>
</button>
```

---

## 3. Styling & Color Management

*   **Inherited Coloring**: Always set the icon fill or stroke color to `currentColor` in your SVG templates. This ensures the icon automatically inherits the color of its parent text elements:
    ```css
    svg {
      fill: currentColor;
      stroke: currentColor;
    }
    ```
*   **Consistent Sizing**: Rely on standard bounding boxes rather than raw pixel width/height:
    *   **Small (Actions / Table columns)**: `16px` (`w-4 h-4`)
    *   **Medium (Buttons / Standard navigation)**: `20px` (`w-5 h-5`)
    *   **Large (Feature cards / Hero headers)**: `24px - 32px` (`w-6 h-6` to `w-8 h-8`)

---

## 4. Implementation & Tree-Shaking Templates

### 4.1 React Import Patterns (Lucide)
Always use named imports to allow the bundler to strip unused icons (tree-shaking):

```typescript
// Good: Tree-shakeable named imports
import { Trophy, Tag, Settings } from 'lucide-react';

export default function Component() {
  return (
    <div>
      <Trophy className="w-5 h-5 text-yellow-500" />
      <Tag className="w-5 h-5 text-blue-500" />
    </div>
  );
}
```

```typescript
// Bad: Imports the entire icon bundle, inflating build size
import * as Icons from 'lucide-react';
```
