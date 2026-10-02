import { useEffect, useRef } from 'react';

export function useLiveEvents(onUpdate) {
  const callbackRef = useRef(onUpdate);
  useEffect(() => { callbackRef.current = onUpdate; }, [onUpdate]);

  useEffect(() => {
    const stream = new EventSource('/api/events');
    const handler = event => {
      try { callbackRef.current?.(JSON.parse(event.data)); }
      catch { callbackRef.current?.(null); }
    };
    stream.addEventListener('update', handler);
    return () => {
      stream.removeEventListener('update', handler);
      stream.close();
    };
  }, []);
}
