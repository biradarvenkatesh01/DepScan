import { useEffect, useState } from 'react';
import { IconCheck } from './Icons';
import { TOAST_EVENT as EVENT } from '../lib/toast';


export default function Toaster() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const onToast = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), 2200);
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className={`toast ${message ? 'is-visible' : ''}`} role="status" aria-live="polite">
      <IconCheck size={15} />
      <span>{message}</span>
    </div>
  );
}
