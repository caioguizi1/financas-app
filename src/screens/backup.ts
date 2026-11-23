import { today } from '../lib/dates';
import { blank, getData, restore, toast } from '../store';

export async function exportar() {
  const name = `fluxo-backup-${today()}.json`;
  const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' });
  try {
    const f = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: 'Backup Fluxo' }); return; }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function importar() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    try {
      const d = JSON.parse(await inp.files![0].text());
      if (!d?.v) throw new Error('inválido');
      restore({ ...blank(), ...d, onboarded: true });
      toast('Backup restaurado');
    } catch {
      toast('Arquivo inválido');
    }
  };
  inp.click();
}
