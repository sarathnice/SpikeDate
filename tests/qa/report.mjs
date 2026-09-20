export function validateTarget(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const stage = url.origin === 'https://spikedate-stage.sarathnice.workers.dev';
  if (
    (!local && !stage) ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error(
      'QA permits only a local origin or the approved SpikeDate staging origin; production is blocked.',
    );
  return url.origin;
}

export function collectTests(report) {
  const rows = [];
  function visit(suites, parents = []) {
    for (const suite of suites ?? []) {
      const names = [...parents, suite.title].filter(Boolean);
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          rows.push({
            name: [...names, spec.title].join(' / '),
            project: test.projectName,
            status: test.status,
            attempts: (test.results ?? []).length,
            errors: (test.results ?? []).flatMap((r) =>
              (r.errors ?? []).map(
                (e) => e.message ?? e.value ?? 'Unknown error',
              ),
            ),
          });
        }
      }
      visit(suite.suites, names);
    }
  }
  visit(report?.suites);
  return rows;
}

export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ],
  );

export function renderReport(summary) {
  const e = escapeHtml;
  const rows = summary.tests ?? [];
  const labels = {
    expected: 'Passed',
    unexpected: 'Failed',
    flaky: 'Flaky',
    skipped: 'Skipped',
  };
  const count = (status) => rows.filter((row) => row.status === status).length;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SpikeDate QA report</title>
  <style>body{font:16px/1.5 system-ui;margin:0;background:#f5f6f8;color:#10142d}main{max-width:1100px;margin:32px auto;padding:24px}h1{font-weight:500}.card{padding:20px;background:white;border:1px solid #ddd;border-radius:14px;margin:16px 0}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #ddd}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.unexpected{color:#b00020}.expected{color:#146c32}.flaky{color:#865200}a{color:#124dba}.scroll{overflow:auto}</style>
  <main><h1>SpikeDate QA · ${e(summary.status)}</h1><p>${e(summary.startedAt)} · ${e(summary.mode)} · ${e(summary.url)}</p><p>Workspace commit: ${e(summary.workspaceCommit ?? 'not recorded')} · Uncommitted changes: ${e(summary.workspaceDirty ?? 'not recorded')}. The remote deployment revision is not automatically verified.</p>
  <div class="card">Passed: ${count('expected')} · Failed: ${count('unexpected')} · Flaky: ${count('flaky')} · Skipped: ${count('skipped')} · Total browser cases: ${rows.length}<p>Retries are not counted as new scenarios. Flaky is not a clean pass.</p></div>
  <div class="card"><h2>Validation steps</h2>${summary.steps.map((s) => `<p class="${s.status === 'passed' ? 'expected' : 'unexpected'}">${e(s.name)}: ${e(s.status)} (${e(s.seconds)}s) · <a href="${e(s.log)}">log</a></p>`).join('')}</div>
  <div class="card"><a href="browser-report/index.html">Detailed browser report, screenshots and traces</a> · <a href="summary.json">Machine-readable summary</a> · <a href="junit.xml">JUnit</a></div>
  <div class="card scroll"><h2>Browser scenarios</h2><table><thead><tr><th>Scenario</th><th>Device</th><th>Result</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${e(r.name)}${r.errors.length ? `<details><summary>Failure details</summary><pre>${e(r.errors.join('\n'))}</pre></details>` : ''}</td><td>${e(r.project)}</td><td class="${e(r.status)}">${e(labels[r.status] ?? r.status)} (${r.attempts} attempts)</td></tr>`).join('')}</tbody></table></div>
  <div class="card"><h2>Scope and limitations</h2><p>Browser mobile emulation, not native iOS/Android certification. Mock billing/SMS cannot prove real payments or carrier delivery. No database reset, automatic deployment, or production tests. Full regression changes synthetic accounts and consumes their test entitlements. Image failures remain failures; no substitute photos are installed.</p><p>Not covered automatically: native camera/push/background scheduling, real payment/SMS providers, legal compliance, every theme visual baseline, multi-device live chat delivery, and 24-hour wall-clock expiry. Existing tests cover selected registration, safety, subscriptions, discovery, planning and Today flows; passing does not mean every possible scenario is covered.</p></div></main></html>`;
}
