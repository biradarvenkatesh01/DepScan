import { useEffect, useRef } from 'react';

/** Focuses the returned input when the user presses "/" outside a text field. */
export function useSlashFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== '/' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return ref;
}
