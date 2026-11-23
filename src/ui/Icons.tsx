const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const IHome = () => <svg viewBox="0 0 24 24" {...s}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>;
export const IList = () => <svg viewBox="0 0 24 24" {...s}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>;
export const IRepeat = () => <svg viewBox="0 0 24 24" {...s}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>;
export const IGear = () => <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
export const IPlus = () => <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
export const IBack = () => <svg width="20" height="20" viewBox="0 0 24 24" {...s} strokeWidth={2.4}><path d="M15 18l-6-6 6-6" /></svg>;
export const IChevron = () => <svg width="16" height="16" viewBox="0 0 24 24" {...s} strokeWidth={2.4}><path d="M9 18l6-6-6-6" /></svg>;
export const ITrend = ({ size = 40 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} stroke="#fff" strokeWidth={2.4}><path d="M3 17l5-5 4 3 8-8" /><path d="M15 7h5v5" /></svg>;
export const ICheck = ({ size = 40 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" {...s} stroke="#fff" strokeWidth={2.6}><path d="M5 12l5 5L20 7" /></svg>;
export const ITrash = () => <svg width="20" height="20" viewBox="0 0 24 24" {...s}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" /></svg>;
export const IEdit = () => <svg width="20" height="20" viewBox="0 0 24 24" {...s}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>;
