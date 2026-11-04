export const TOAST_EVENT = 'depscan:toast';

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

export async function copyText(text: string, message = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    toast('Copy failed — your browser blocked clipboard access');
  }
}
