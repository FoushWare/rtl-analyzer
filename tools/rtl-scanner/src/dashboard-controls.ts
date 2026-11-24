// Preview status modals and the End Review action. Injected by the dashboard session into the generated dashboard
// page only when the page is served by a running session; the static report file is never modified.
// Plain browser JavaScript, kept free of template literals so it can be embedded verbatim. Text is always set with
// textContent, so evidence from a child process can never become markup.

export const CONTROLS_SCRIPT = String.raw`(function () {
  var cfg = window.__RTL_PREVIEW_SESSION__;
  if (!cfg) return;
  var state = cfg.state;
  var bar = document.getElementById('rtl-preview-bar');
  var statusText = document.getElementById('rtl-preview-status');
  var dialog = document.getElementById('rtl-preview-dialog');
  var title = document.getElementById('rtl-preview-title');
  var body = document.getElementById('rtl-preview-body');
  var details = document.getElementById('rtl-preview-details');
  var recovery = document.getElementById('rtl-preview-recovery');
  var actions = document.getElementById('rtl-preview-actions');
  var poll = null;

  function request(path) {
    return fetch(path, { method: 'POST', headers: { 'x-rtl-session': cfg.secret } }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status));
        return data;
      });
    });
  }
  function button(label, primary, onClick) {
    var element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.className = primary ? 'rtl-preview-primary' : 'rtl-preview-secondary';
    element.addEventListener('click', onClick);
    return element;
  }
  function closeDialog() { if (dialog.open) dialog.close(); }
  function setActions(buttons) {
    actions.replaceChildren.apply(actions, buttons);
  }
  function setBar(text) { statusText.textContent = text; }
  function setStartCancel(visible) { document.getElementById('rtl-preview-cancel-start').hidden = !visible; }
  function announce(next) {
    // The review view learns about readiness from this event, not by reloading. Each change is also kept on window,
    // so code that starts after a change can read the current state.
    window.rtlPreviewState = { state: next.state };
    window.dispatchEvent(new CustomEvent('rtl-preview-state', { detail: { state: next.state, ready: next.state === 'ready' } }));
  }
  function row(list, label, value) {
    if (value === undefined || value === null || value === '') return;
    var term = document.createElement('dt');
    term.textContent = label;
    var description = document.createElement('dd');
    description.textContent = String(value);
    list.append(term, description);
  }
  function renderRecovery(diagnostic) {
    recovery.replaceChildren();
    if (!diagnostic || !diagnostic.recovery) { recovery.hidden = true; return; }
    var label = document.createElement('p');
    label.textContent = 'Suggested command. Run it yourself in the project folder; RTL Analyzer does not run it.';
    var line = document.createElement('div');
    line.className = 'rtl-preview-command';
    var code = document.createElement('code');
    code.textContent = diagnostic.recovery;
    var copy = button('Copy command', false, function () { copyText(diagnostic.recovery, copy); });
    line.append(code, copy);
    recovery.append(label, line);
    recovery.hidden = false;
  }
  function renderTechnical(diagnostic, failure) {
    details.replaceChildren();
    var list = document.createElement('dl');
    list.className = 'rtl-preview-facts';
    if (diagnostic) {
      var t = diagnostic.technical || {};
      row(list, 'Category', diagnostic.category);
      row(list, 'Code', diagnostic.code);
      row(list, 'Reason', t.reason);
      row(list, 'Exit code', t.exitCode === null ? 'none' : t.exitCode);
      row(list, 'Signal', t.signal);
      row(list, 'Spawn error', t.spawnErrorCode);
      row(list, 'Command', t.command ? t.command + (t.startupScript ? ' run ' + t.startupScript : '') : '');
      row(list, 'Project folder', t.cwd);
      row(list, 'Port', t.port);
      row(list, 'Waited', t.waitedMs !== undefined ? Math.round(t.waitedMs / 100) / 10 + ' s' : '');
    } else {
      row(list, 'Code', failure ? failure.code : 'UNKNOWN');
    }
    details.append(list);
    var output = document.createElement('pre');
    output.className = 'rtl-preview-output';
    output.textContent = diagnostic && diagnostic.technical && diagnostic.technical.output ? diagnostic.technical.output : 'No output was captured.';
    details.append(output);
    if (failure && failure.message) {
      var message = document.createElement('p');
      message.textContent = failure.message;
      details.append(message);
    }
  }
  function copyText(text, element) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) { setBar('Copy is unavailable in this browser. Select the text in Technical details.'); return; }
    navigator.clipboard.writeText(text).then(function () {
      if (element) { var original = element.textContent; element.textContent = 'Copied'; setTimeout(function () { element.textContent = original; }, 1500); }
    }, function () { setBar('Copy was blocked by the browser. Select the text in Technical details.'); });
  }
  function copyDiagnostics(element) {
    request('/preview/diagnostics').then(function (data) { copyText(data.text, element); }, function (error) { setBar('Copy failed: ' + error.message); });
  }

  function apply(next) {
    state = next.state;
    setStartCancel(state === 'starting');
    announce(next);
    if (state === 'starting') {
      setBar('Starting live preview…');
      closeDialog();
      if (!poll) poll = setInterval(refresh, 1000);
      return;
    }
    if (poll) { clearInterval(poll); poll = null; }
    if (state === 'ready') { setBar('Live preview ready'); closeDialog(); return; }
    if (state === 'static') { setBar('Static report (live preview not running)'); closeDialog(); return; }
    if (state === 'ended') {
      setBar('Review ended. You can close this tab.');
      closeDialog();
      setActions([]);
      return;
    }
    if (state === 'unsupported') {
      setBar('Live preview unavailable');
      title.textContent = 'Live Preview Unavailable';
      body.textContent = 'The RTL report is available, but interactive Before/After previews cannot be started automatically.';
      renderRecovery(null);
      renderTechnical(null, next.failure);
      setActions([
        button('Continue with Report', true, function () { act('/preview/continue'); }),
        button('Cancel', false, function () { act('/preview/cancel'); }),
      ]);
      openDialog();
      return;
    }
    if (state === 'startup_failed') {
      var diagnostic = next.failure && next.failure.diagnostic;
      var setup = next.failure && next.failure.code === 'PREVIEW_DEPENDENCIES_MISSING';
      var headline = diagnostic ? diagnostic.title : (setup ? 'Live Preview needs setup' : "Couldn't Start Live Preview");
      setBar(setup ? 'Live preview needs setup' : headline);
      title.textContent = headline;
      body.textContent = diagnostic
        ? diagnostic.explanation
        : (setup ? 'The project\'s dependencies are not installed. Install them, then choose Retry Preview. The static report is still available.' : 'The live preview did not start. The static report is still available.');
      renderRecovery(diagnostic);
      renderTechnical(diagnostic, next.failure);
      var buttons = [
        button('Retry Preview', true, function () { act('/preview/retry'); }),
        button('Continue with Report', false, function () { act('/preview/continue'); }),
        button('Cancel', false, function () { act('/preview/cancel'); }),
      ];
      if (diagnostic) buttons.push(button('Copy Diagnostics', false, function (event) { copyDiagnostics(event.currentTarget); }));
      setActions(buttons);
      openDialog();
    }
  }
  function openDialog() {
    if (!dialog.open) dialog.showModal();
    var first = actions.querySelector('button');
    if (first) first.focus();
  }
  function act(path) {
    request(path).then(apply, function (error) { setBar('Action failed: ' + error.message); });
  }
  function refresh() {
    fetch('/preview/status').then(function (response) { return response.json(); }).then(apply, function () {});
  }

  // Escape closes the modal the same way as Continue with Report: the report stays open and nothing is stopped.
  dialog.addEventListener('cancel', function (event) {
    event.preventDefault();
    if (state === 'unsupported' || state === 'startup_failed') act('/preview/continue');
  });
  document.getElementById('rtl-review-end').addEventListener('click', function () {
    // Ending the session stops the dashboard and its services; saved review progress is kept and can be resumed.
    if (!window.confirm('End this dashboard session? Your review progress is saved and can be resumed.')) return;
    // The page releases its own leases first (keepalive), then the session ends and releases the CLI's lease.
    window.dispatchEvent(new CustomEvent('rtl-review-end'));
    request('/preview/end').then(apply, function (error) { setBar('End Review failed: ' + error.message); });
  });
  document.getElementById('rtl-preview-cancel-start').addEventListener('click', function () { act('/preview/cancel'); });
  apply({ state: cfg.state, failure: cfg.failure });
})();`;

export const CONTROLS_MARKUP = String.raw`<div id="rtl-preview-bar" class="rtl-preview-bar" role="status" aria-live="polite">
  <span id="rtl-preview-status"></span>
  <button type="button" id="rtl-preview-cancel-start" class="rtl-preview-secondary" hidden>Cancel startup</button>
  <button type="button" id="rtl-review-end" class="rtl-preview-secondary">End Review</button>
</div>
<dialog id="rtl-preview-dialog" class="workflow-dialog rtl-preview-dialog" aria-labelledby="rtl-preview-title" aria-describedby="rtl-preview-body">
  <h1 id="rtl-preview-title"></h1>
  <p id="rtl-preview-body"></p>
  <div id="rtl-preview-recovery" class="rtl-preview-recovery" hidden></div>
  <details class="rtl-preview-technical">
    <summary>Technical details</summary>
    <div id="rtl-preview-details"></div>
  </details>
  <div id="rtl-preview-actions" class="rtl-preview-actions"></div>
</dialog>
<style>
.rtl-preview-bar{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center;margin:8px 12px;padding:6px 12px;border:1px solid var(--line,#263c5d);border-radius:10px;background:var(--surface,#0e1a2e);color:var(--text,#f4f7ff);font-size:13px}
.rtl-preview-bar button,.rtl-preview-actions button,.rtl-preview-command button{border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer;border:1px solid var(--line,#263c5d);background:var(--surface-hi,#14243c);color:var(--text,#f4f7ff)}
.rtl-preview-primary{background:var(--purple,#9a63ff)!important;border-color:var(--purple,#9a63ff)!important;color:#fff!important}
.rtl-preview-bar button:focus-visible,.rtl-preview-actions button:focus-visible,.rtl-preview-command button:focus-visible,.rtl-preview-dialog summary:focus-visible{outline:3px solid var(--blue,#42a4ff);outline-offset:2px}
.rtl-preview-dialog{max-width:min(560px,calc(100vw - 32px));width:100%}
.rtl-preview-dialog h1{font-size:24px;margin:0 0 8px}
.rtl-preview-dialog p{color:var(--muted,#9aaac1)}
.rtl-preview-recovery{margin:12px 0 0}
.rtl-preview-recovery p{margin:0 0 6px}
.rtl-preview-command{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.rtl-preview-command code{padding:6px 8px;border-radius:6px;background:var(--surface,#0e1a2e);color:var(--text,#f4f7ff);font-size:13px}
.rtl-preview-technical{margin-top:12px}
.rtl-preview-technical summary{cursor:pointer;color:var(--text,#f4f7ff)}
.rtl-preview-facts{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 12px;margin:8px 0;font-size:12px}
.rtl-preview-facts dt{color:var(--muted,#9aaac1)}
.rtl-preview-facts dd{margin:0;overflow-wrap:anywhere;color:var(--text,#f4f7ff)}
.rtl-preview-output{max-height:200px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:8px;border-radius:6px;background:var(--surface,#0e1a2e);color:var(--text,#f4f7ff);font-size:12px}
.rtl-preview-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
</style>`;
