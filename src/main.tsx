import { LazyMotion, MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';
import { aplicarTema } from './lib/tema';

aplicarTema();

import { today } from './lib/dates';
import { recalcular, toast } from './store';

// Atualizações sem botão: o app procura versão nova ao abrir/voltar e recalcula quando o dia vira.
let registro: ServiceWorkerRegistration | undefined;
registerSW({ immediate: true, onRegisteredSW: (_url, r) => { registro = r; } });
let dia = today();
const conferirDia = () => { if (today() !== dia) { dia = today(); recalcular(); } };
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  conferirDia();
  registro?.update().catch(() => { /* sem internet: segue com a versão atual */ });
});
setInterval(conferirDia, 60_000);
// avisa quando acabou de atualizar sozinho
try {
  const antes = localStorage.getItem('fluxo.versao');
  localStorage.setItem('fluxo.versao', __APP_VERSION__);
  if (antes && antes !== __APP_VERSION__) setTimeout(() => toast(`Atualizado para v${__APP_VERSION__}`), 900);
} catch { /* sem armazenamento */ }
const loadFeatures = () => import('./motion-features').then((r) => r.default);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Provedores fora do App: trocar de aba não recria o contexto de animação
        (antes isso fazia todo componente animado de todas as telas re-renderizar). */}
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
);
