import { useEffect, useRef } from 'react';

export const useResizeObserver = (onResize) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onResize?.(entry.contentRect);
      }
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [onResize]);

  return ref;
};
