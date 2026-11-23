import { LazyMotion, MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';
import { aplicarTema } from './lib/tema';

aplicarTema();

registerSW({ immediate: true });
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
