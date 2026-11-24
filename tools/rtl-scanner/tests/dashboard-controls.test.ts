// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTROLS_MARKUP, CONTROLS_SCRIPT } from '../src/dashboard-controls.js';

// Runs the real injected controls script against the real markup, then inspects what the user would see.
function mount(config: Record<string, unknown>) {
  document.body.innerHTML = CONTROLS_MARKUP + '<main id="dashboard"></main>';
  const dialog = document.getElementById('rtl-preview-dialog') as HTMLDialogElement;
  // jsdom does not implement the modal dialog API; the page only needs `open` to track it.
  (dialog as unknown as { showModal: () => void }).showModal = function (this: HTMLDialogElement) { this.open = true; };
  (dialog as unknown as { close: () => void }).close = function (this: HTMLDialogElement) { this.open = false; };
  (window as unknown as { __RTL_PREVIEW_SESSION__: unknown }).__RTL_PREVIEW_SESSION__ = config;
  (0, eval)(CONTROLS_SCRIPT);
  return dialog;
}

const failure = {
  state: 'startup_failed',
  failure: {
    code: 'ORIGINAL_START_FAILED',
    message: 'Project dependencies are missing. vite is not installed in this project.',
    diagnostic: {
      category: 'missing-dependency',
      code: 'ORIGINAL_PREVIEW_STARTUP_FAILED',
      title: 'Project dependencies are missing',
      explanation: 'vite is not installed in this project. Install the dependencies, then choose Retry Preview.',
      recovery: 'npm ci',
      technical: { exitCode: 127, reason: 'exited', command: 'npm', startupScript: 'dev', cwd: '~/project', port: 4216, output: 'sh: vite: command not found\n<img src=x onerror="alert(1)">' },
    },
  },
};

afterEach(() => {
  document.body.innerHTML = '';
  delete (window as unknown as { rtlPreviewState?: unknown }).rtlPreviewState;
});

describe('recovery dialog', () => {
  it('shows a human title, the explanation, the copyable command and the redacted technical facts', () => {
    const dialog = mount({ secret: 's', ...failure });
    expect(document.getElementById('rtl-preview-title')?.textContent).toBe('Project dependencies are missing');
    expect(document.getElementById('rtl-preview-body')?.textContent).toContain('vite is not installed in this project');
    const recovery = document.getElementById('rtl-preview-recovery') as HTMLElement;
    expect(recovery.hidden).toBe(false);
    expect(recovery.querySelector('code')?.textContent).toBe('npm ci');
    const facts = document.getElementById('rtl-preview-details')?.textContent ?? '';
    expect(facts).toContain('Exit code');
    expect(facts).toContain('127');
    expect(facts).toContain('npm run dev');
    expect(facts).toContain('~/project');
    expect(dialog.open).toBe(true);
  });

  it('keeps child output as text: markup in output never becomes an element', () => {
    mount({ secret: 's', ...failure });
    const output = document.querySelector('.rtl-preview-output') as HTMLElement;
    expect(output.textContent).toContain('<img src=x');
    expect(output.querySelector('img')).toBeNull();
  });

  it('offers Retry, Continue, Cancel and Copy Diagnostics for a classified failure', () => {
    mount({ secret: 's', ...failure });
    const labels = [...document.querySelectorAll('#rtl-preview-actions button')].map(b => b.textContent);
    expect(labels).toEqual(['Retry Preview', 'Continue with Report', 'Cancel', 'Copy Diagnostics']);
  });

  it('falls back to the code alone when no diagnostic was classified', () => {
    mount({ secret: 's', state: 'startup_failed', failure: { code: 'PORT_CONFLICT_COMPANION', message: 'Port 4318 is in use.' } });
    expect(document.getElementById('rtl-preview-title')?.textContent).toBe("Couldn't Start Live Preview");
    expect((document.getElementById('rtl-preview-recovery') as HTMLElement).hidden).toBe(true);
    const labels = [...document.querySelectorAll('#rtl-preview-actions button')].map(b => b.textContent);
    expect(labels).not.toContain('Copy Diagnostics');
    expect(document.getElementById('rtl-preview-details')?.textContent).toContain('PORT_CONFLICT_COMPANION');
  });

  it('moves from starting to ready on its own, closes the dialog and announces readiness', async () => {
    const seen: unknown[] = [];
    const listener = (event: Event) => seen.push((event as CustomEvent).detail);
    window.addEventListener('rtl-preview-state', listener);
    mount({ secret: 's', state: 'starting' });
    vi.stubGlobal('fetch', async () => ({ json: async () => ({ state: 'ready' }) }));
    try {
      // The page polls /preview/status once a second while starting; wait for one poll to complete.
      await new Promise(resolve => setTimeout(resolve, 1200));
    } finally {
      vi.unstubAllGlobals();
      window.removeEventListener('rtl-preview-state', listener);
    }
    expect(seen).toContainEqual({ state: 'starting', ready: false });
    expect(seen).toContainEqual({ state: 'ready', ready: true });
    expect(document.getElementById('rtl-preview-status')?.textContent).toBe('Live preview ready');
    expect((window as unknown as { rtlPreviewState: unknown }).rtlPreviewState).toEqual({ state: 'ready' });
  });
});
