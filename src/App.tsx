import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useEffect, useState } from 'react';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Ajustes, Extrato, Fixos } from './screens/Others';
import { QuickAdd } from './sheets/QuickAdd';
import { openSheet, useData, useUI, type Tab } from './store';
import { IGear, IHome, IList, IPlus, IRepeat } from './ui/Icons';
import { SheetHost } from './ui/Sheet';
import { Toasts } from './ui/Toasts';
import { spring } from './ui/motion';

const TABS: { id: Tab; label: string; Icon: () => React.ReactElement }[] = [
  { id: 'home', label: 'Início', Icon: IHome },
  { id: 'extrato', label: 'Extrato', Icon: IList },
  { id: 'fixos', label: 'Fixos', Icon: IRepeat },
  { id: 'ajustes', label: 'Ajustes', Icon: IGear },
];
const SCREENS: Record<Tab, () => React.ReactElement> = { home: Home, extrato: Extrato, fixos: Fixos, ajustes: Ajustes };

export default function App() {
  const onboarded = useData().onboarded;
  const tab = useUI((s) => s.tab);
  const sheetOpen = useUI((s) => !!s.sheet);
  const [, tick] = useState(0);

  // Ao voltar pro app (ex.: no dia seguinte), recalcula "hoje".
  useEffect(() => {
    const f = () => !document.hidden && tick((x) => x + 1);
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);

  // Teclado do computador: Enter confirma o botão principal; Esc fecha a janela.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUI.getState();
      if (e.key === 'Escape' && ui.sheet) return ui.closeSheet();
      if (e.key !== 'Enter' || e.defaultPrevented) return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'date') return;
      const scope = document.querySelector('.sheet') ?? document.querySelector('.ob .foot');
      const btn = scope?.querySelector<HTMLButtonElement>('[data-primary]:not([disabled])');
      if (btn) { e.preventDefault(); btn.click(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [tab]);

  const Screen = SCREENS[tab];
  return (
    <MotionConfig reducedMotion="user">
      <div id="app">
        <AnimatePresence mode="wait" initial={false}>
          {!onboarded ? (
            <motion.div key="ob" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.25 }}><Onboarding /></motion.div>
          ) : (
            <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.main key={tab} className="screen" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
                  <Screen />
                </motion.main>
              </AnimatePresence>
              <nav className="tabbar">
                <div className="tabs">
                  {TABS.slice(0, 2).map((x) => <TabBtn key={x.id} {...x} />)}
                  <motion.button className="fab" aria-label="Lançar" whileTap={{ scale: 0.88 }} animate={{ rotate: sheetOpen ? 45 : 0 }} transition={spring}
                    onClick={() => (sheetOpen ? useUI.getState().closeSheet() : openSheet(<QuickAdd />))}>
                    <IPlus />
                  </motion.button>
                  {TABS.slice(2).map((x) => <TabBtn key={x.id} {...x} />)}
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
        <SheetHost />
        <Toasts />
      </div>
    </MotionConfig>
  );
}

function TabBtn({ id, label, Icon }: (typeof TABS)[number]) {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const on = tab === id;
  return (
    <motion.button whileTap={{ scale: 0.9 }} className={`tab ${on ? 'on' : ''}`} onClick={() => setTab(id)}>
      {on && <motion.span layoutId="tab-pill" className="tab-pill" transition={spring} />}
      <span className="tab-ic"><Icon /></span>
      <span className="tab-l">{label}</span>
    </motion.button>
  );
}
