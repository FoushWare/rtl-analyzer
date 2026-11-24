// Preview status modals and the End Review action. Injected by the dashboard session into the generated dashboard
// page only when the page is served by a running session; the static report file is never modified.
// Plain browser JavaScript, kept free of template literals so it can be embedded verbatim.

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

  function apply(next) {
    state = next.state;
    setStartCancel(state === 'starting');
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
      details.replaceChildren(document.createTextNode(next.failure ? next.failure.message : ''));
      setActions([
        button('Continue with Report', true, function () { act('/preview/continue'); }),
        button('Cancel', false, function () { act('/preview/cancel'); }),
      ]);
      openDialog();
      return;
    }
    if (state === 'startup_failed') {
      var setup = next.failure && next.failure.code === 'PREVIEW_DEPENDENCIES_MISSING';
      setBar(setup ? 'Live preview needs setup' : "Couldn't start live preview");
      title.textContent = setup ? 'Live Preview needs setup' : "Couldn't Start Live Preview";
      body.textContent = setup ? 'The project\'s dependencies are not installed. Install them, then choose Retry Preview. The static report is still available.' : 'The live preview did not start. The static report is still available.';
      var code = document.createElement('code');
      code.textContent = next.failure ? next.failure.code : 'UNKNOWN';
      var message = document.createElement('p');
      message.textContent = next.failure ? next.failure.message : '';
      details.replaceChildren(code, message);
      setActions([
        button('Retry Preview', true, function () { act('/preview/retry'); }),
        button('Continue with Report', false, function () { act('/preview/continue'); }),
        button('Cancel', false, function () { act('/preview/cancel'); }),
      ]);
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
  <details>
    <summary>Details</summary>
    <div id="rtl-preview-details"></div>
  </details>
  <div id="rtl-preview-actions" class="rtl-preview-actions"></div>
</dialog>
<style>
.rtl-preview-bar{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center;margin:8px 12px;padding:6px 12px;border:1px solid var(--line,#263c5d);border-radius:10px;background:var(--surface,#0e1a2e);color:var(--text,#f4f7ff);font-size:13px}
.rtl-preview-bar button,.rtl-preview-actions button{border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer;border:1px solid var(--line,#263c5d);background:var(--surface-hi,#14243c);color:var(--text,#f4f7ff)}
.rtl-preview-primary{background:var(--purple,#9a63ff)!important;border-color:var(--purple,#9a63ff)!important;color:#fff!important}
.rtl-preview-bar button:focus-visible,.rtl-preview-actions button:focus-visible,.rtl-preview-dialog summary:focus-visible{outline:3px solid var(--blue,#42a4ff);outline-offset:2px}
.rtl-preview-dialog{max-width:min(560px,calc(100vw - 32px));width:100%}
.rtl-preview-dialog h1{font-size:24px;margin:0 0 8px}
.rtl-preview-dialog p{color:var(--muted,#9aaac1)}
.rtl-preview-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
</style>`;
