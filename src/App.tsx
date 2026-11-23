import { AnimatePresence, m } from 'motion/react';
import { memo, useEffect, useState } from 'react';
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
// memo: trocar de aba re-renderiza o App, mas as telas só recalculam quando os próprios dados mudam
const SCREENS: Record<Tab, React.ComponentType> = { home: memo(Home), extrato: memo(Extrato), fixos: memo(Fixos), ajustes: memo(Ajustes) };

export default function App() {
  const onboarded = useData().onboarded;
  const tab = useUI((s) => s.tab);
  const sheetOpen = useUI((s) => !!s.sheet);
  const [, tick] = useState(0);
  const [visitadas, setVisitadas] = useState<Set<Tab>>(() => new Set([tab]));
  useEffect(() => { setVisitadas((v) => (v.has(tab) ? v : new Set(v).add(tab))); }, [tab]);

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

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [tab]);

  return (
      <div id="app">
        <AnimatePresence mode="wait" initial={false}>
          {!onboarded ? (
            <m.div key="ob" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.25 }}><Onboarding /></m.div>
          ) : (
            <m.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Telas ficam montadas depois da 1ª visita: trocar de aba não recria nada,
                  e a entrada é uma animação CSS curta (roda no compositor, sem JS por quadro). */}
              {TABS.filter((x) => visitadas.has(x.id)).map(({ id }) => {
                const S = SCREENS[id];
                return <main key={id} className={`screen tab-screen ${id === tab ? 'on' : 'off'}`} aria-hidden={id !== tab} inert={id !== tab}><S /></main>;
              })}
              <nav className="tabbar">
                <div className="tabs" data-tab={tab}>
                  <span className="tab-pill" aria-hidden />
                  {TABS.slice(0, 2).map((x) => <TabBtn key={x.id} {...x} />)}
                  <m.button className="fab" aria-label="Lançar" whileTap={{ scale: 0.88 }} animate={{ rotate: sheetOpen ? 45 : 0 }} transition={spring}
                    onClick={() => (sheetOpen ? useUI.getState().closeSheet() : openSheet(<QuickAdd />))}>
                    <IPlus />
                  </m.button>
                  {TABS.slice(2).map((x) => <TabBtn key={x.id} {...x} />)}
                </div>
              </nav>
            </m.div>
          )}
        </AnimatePresence>
        <SheetHost />
        <Toasts />
      </div>
  );
}

function TabBtn({ id, label, Icon }: (typeof TABS)[number]) {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  const on = tab === id;
  return (
    <m.button whileTap={{ scale: 0.9 }} className={`tab ${on ? 'on' : ''}`} onClick={() => setTab(id)}>
      <span className="tab-ic"><Icon /></span>
      <span className="tab-l">{label}</span>
    </m.button>
  );
}
