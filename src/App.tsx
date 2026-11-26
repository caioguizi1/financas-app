import { AnimatePresence, m } from 'motion/react';
import { MontadaVisivel } from './ui/Lista';
import { memo, useEffect, useRef, useState } from 'react';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Ajustes, Extrato, Fixos } from './screens/Others';
import { QuickAdd } from './sheets/QuickAdd';
import { getData, openSheet, useData, useUI, type Tab } from './store';
import { preaquecerImagens } from './lib/imagens';
import { IGear, IHome, IList, IPlus, IRepeat } from './ui/Icons';
import { SheetHost } from './ui/Sheet';
import { Toasts } from './ui/Toasts';

const TABS: { id: Tab; label: string; Icon: () => React.ReactElement }[] = [
  { id: 'home', label: 'Início', Icon: IHome },
  { id: 'extrato', label: 'Extrato', Icon: IList },
  { id: 'fixos', label: 'Fixos', Icon: IRepeat },
  { id: 'ajustes', label: 'Ajustes', Icon: IGear },
];
// memo: trocar de aba re-renderiza o App, mas as telas só recalculam quando os próprios dados mudam
const SCREENS: Record<Tab, React.ComponentType> = { home: memo(Home), extrato: memo(Extrato), fixos: memo(Fixos), ajustes: memo(Ajustes) };

/**
 * Tela pré-montada escondida: listas já nascem prontas (sem animação de entrada).
 * Depois que a tela é vista uma vez, o que entrar novo (ex.: outro mês) volta a animar.
 */
function Tela({ visivel, children }: { visivel: boolean; children: React.ReactNode }) {
  const [jaVista, setJaVista] = useState(visivel);
  useEffect(() => { if (visivel) setJaVista(true); }, [visivel]);
  return <MontadaVisivel.Provider value={jaVista}>{children}</MontadaVisivel.Provider>;
}

export default function App() {
  const onboarded = useData().onboarded;
  const tab = useUI((s) => s.tab);
  const arrasto = useArrastoAbas();
  const [, tick] = useState(0);
  const [visitadas, setVisitadas] = useState<Set<Tab>>(() => new Set([tab]));
  useEffect(() => { setVisitadas((v) => (v.has(tab) ? v : new Set(v).add(tab))); }, [tab]);
  // Pré-monta as outras abas nos momentos ociosos logo após abrir: a 1ª visita fica tão rápida quanto as seguintes.
  useEffect(() => {
    if (!onboarded) return;
    const ocioso = (f: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 2500 }) : setTimeout(f, 1200)) as number;
    const cancelar = (id: number) => ('cancelIdleCallback' in window ? cancelIdleCallback(id) : clearTimeout(id));
    const fila = TABS.map((t) => t.id);
    let id = 0;
    const proxima = () => {
      const t = fila.shift();
      if (!t) return;
      setVisitadas((v) => (v.has(t) ? v : new Set(v).add(t)));
      id = ocioso(proxima); // uma tela por vez, sem competir com o que o usuário está fazendo
    };
    id = ocioso(proxima);
    // miniaturas dos cartões prontas antes do 1º toque no ＋ (chips de cartão sem custo na abertura)
    const img = ocioso(() => preaquecerImagens(getData().cartoes.map((c) => c.id)));
    return () => { cancelar(id); cancelar(img); };
  }, [onboarded]);

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
      if (e.key === 'Escape' && ui.sheet) return ui.confirmarSaida ? useUI.setState({ confirmarSaida: false }) : ui.pedirFechar();
      if (e.key !== 'Enter' || e.defaultPrevented) return;
      if (ui.confirmarSaida) { e.preventDefault(); return useUI.setState({ confirmarSaida: false }); } // "Sair sem salvar?": Enter = continuar editando
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
        <AnimatePresence presenceAffectsLayout={false} mode="wait" initial={false}>
          {!onboarded ? (
            <m.div key="ob" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.25 }}><Onboarding /></m.div>
          ) : (
            <m.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Telas ficam montadas depois da 1ª visita: trocar de aba não recria nada,
                  e a entrada é uma animação CSS curta (roda no compositor, sem JS por quadro). */}
              {TABS.filter((x) => visitadas.has(x.id)).map(({ id }) => {
                const S = SCREENS[id];
                return <main key={id} className={`screen tab-screen ${id === tab ? 'on' : 'off'}`} aria-hidden={id !== tab} inert={id !== tab}><Tela visivel={id === tab}><S /></Tela></main>;
              })}
              <nav className="tabbar">
                <div className="tabs" data-tab={tab} {...arrasto.handlers}>
                  <span className="tab-pill" aria-hidden ref={arrasto.pillRef} />
                  {TABS.slice(0, 2).map((x) => <TabBtn key={x.id} {...x} />)}
                  <Fab />
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

/**
 * Arrastar o dedo pela barra de abas (como a barra nativa do iOS 26): a bolha segue o dedo,
 * a aba embaixo acende e, ao soltar, abre a aba mais próxima. Toque simples continua igual.
 */
function useArrastoAbas() {
  const pillRef = useRef<HTMLSpanElement>(null);
  const st = useRef<{ x0: number; ativo: boolean; tabs: { id: Tab; el: HTMLElement; l: number; w: number }[]; base: number; alvo?: Tab; fim: number } | null>(null);
  const ignorarClique = useRef(0);
  const marcar = (alvo?: Tab) => st.current?.tabs.forEach((t) => t.el.classList.toggle('alvo', t.id === alvo));
  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('.fab') || e.button > 0) return;
      const box = e.currentTarget.getBoundingClientRect();
      const els = [...e.currentTarget.querySelectorAll<HTMLElement>('.tab')];
      st.current = { x0: e.clientX, ativo: false, base: box.left, fim: 0, tabs: els.map((el, k) => { const r = el.getBoundingClientRect(); return { id: TABS[k].id, el, l: r.left - box.left, w: r.width }; }) };
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const s = st.current, pill = pillRef.current;
      if (!s || !pill) return;
      if (!s.ativo) {
        if (Math.abs(e.clientX - s.x0) < 8) return;
        s.ativo = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.classList.add('arrastando');
      }
      const x = e.clientX - s.base;
      const w = s.tabs[0].w;
      const pos = Math.max(s.tabs[0].l, Math.min(s.tabs[s.tabs.length - 1].l, x - w / 2));
      pill.style.transform = `translateX(${pos - 6}px)`; // 6px = padding da barra (left da bolha)
      // aba mais perto do dedo
      let alvo = s.tabs[0], d = Infinity;
      for (const t of s.tabs) { const dd = Math.abs(t.l + t.w / 2 - x); if (dd < d) { d = dd; alvo = t; } }
      if (alvo.id !== s.alvo) { s.alvo = alvo.id; marcar(alvo.id); }
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      const s = st.current; st.current = null;
      if (!s?.ativo) return;
      ignorarClique.current = performance.now();
      e.currentTarget.classList.remove('arrastando');
      marcar(undefined);
      if (pillRef.current) pillRef.current.style.transform = ''; // a regra do CSS leva a bolha pro lugar com a mola
      if (s.alvo) useUI.getState().setTab(s.alvo);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => {
      const s = st.current; st.current = null;
      if (!s?.ativo) return;
      e.currentTarget.classList.remove('arrastando');
      marcar(undefined);
      if (pillRef.current) pillRef.current.style.transform = '';
    },
    // o clique que o navegador dispara ao soltar o arrasto não deve trocar de aba de novo
    onClickCapture: (e: React.MouseEvent) => { if (performance.now() - ignorarClique.current < 400) { e.stopPropagation(); e.preventDefault(); } },
  };
  return { pillRef, handlers };
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

/** Botão + isolado: só ele escuta se há janela aberta (antes o App inteiro re-renderizava a cada abrir/fechar). */
function Fab() {
  const sheetOpen = useUI((s) => !!s.sheet);
  return (
    // giro e toque em CSS (compositor): nada de JS por quadro competindo com a abertura da janela
    <button className={`fab ${sheetOpen ? 'x' : ''}`} aria-label={sheetOpen ? 'Fechar' : 'Lançar'}
      onClick={() => (sheetOpen ? useUI.getState().closeSheet() : openSheet(<QuickAdd />))}>
      <IPlus />
    </button>
  );
}
