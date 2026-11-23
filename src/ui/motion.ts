import type { Transition } from 'motion/react';

/** Molas padrão do app — um só "sotaque" de movimento em todas as telas. */
export const spring = { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 } satisfies Transition;
export const springSoft = { type: 'spring', stiffness: 260, damping: 30 } satisfies Transition;
export const springSnappy = { type: 'spring', stiffness: 700, damping: 40 } satisfies Transition;
export const tap = { scale: 0.96 };
