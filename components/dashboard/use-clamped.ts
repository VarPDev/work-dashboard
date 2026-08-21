'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Whether a line-clamped element is really cutting its text off.
 *
 * Measured, not guessed from the string length: where the cut falls depends on
 * the font, the column width and the zoom level. A button offering to expand
 * text that is already fully visible is worse than no button at all.
 *
 * Pass the text so the measurement is redone when the content changes; the
 * observer only catches the element being resized.
 */
export function useClamped<T extends HTMLElement>(text: string) {
  const ref = useRef<T | null>(null);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let alive = true;
    // One pixel of slack: sub-pixel line heights round the wrong way.
    const measure = (): void => {
      if (alive) setClamped(node.scrollHeight - node.clientHeight > 1);
    };

    measure();
    // The first paint can still be on the fallback font, whose metrics differ.
    void document.fonts?.ready.then(measure);

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [text]);

  return [ref, clamped] as const;
}
