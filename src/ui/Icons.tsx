import type React from 'react';
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

// ---- ações (mesmo traço da barra de abas) ----
const a = (p: React.ReactNode, size = 22) => <svg width={size} height={size} viewBox="0 0 24 24" {...s}>{p}</svg>;
export const IReceipt = () => a(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>);
export const IImport = () => a(<><path d="M12 4v10" /><path d="M8 10l4 4 4-4" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>);
export const IImage = () => a(<><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8" /></>);
export const IPencil = () => a(<><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>);
export const ICalendar = ({ size = 20 }: { size?: number }) => a(<><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>, size);
export const ICheckCircle = ({ size = 20 }: { size?: number }) => a(<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" /></>, size);
export const IUndo = ({ size = 20 }: { size?: number }) => a(<><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>, size);
export const IFile = ({ size = 18 }: { size?: number }) => a(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>, size);
