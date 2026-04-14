'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useEffect, MouseEventHandler } from 'react';

export default function Modal({ children }: { children: React.ReactNode }) {
  const overlay = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const onDismiss = useCallback(() => {
    router.back();
  }, [router]);

  const onClick: MouseEventHandler = useCallback(
    (e) => {
      if (e.target === overlay.current || e.target === wrapper.current) {
        onDismiss();
      }
    },
    [onDismiss]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    },
    [onDismiss]
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return (
    <div
      ref={overlay}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md
        p-4"
      onClick={onClick}
    >
      <div
        ref={wrapper}
        className="relative rounded-3xl ring-2 ring-zinc-800 border-white/10 bg-black/90 p-8
          animate-in fade-in zoom-in duration-200"
      >
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors
            cursor-pointer p-2 rounded-full bg-white hover:bg-white/80 duration-200"
          aria-label="Close modal"
        >
          <X className="text-black" size={16}/>
        </button>
        {children}
      </div>
    </div>
  );
}