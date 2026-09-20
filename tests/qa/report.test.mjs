import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectTests,
  escapeHtml,
  renderReport,
  validateTarget,
} from './report.mjs';

test('reject production, lookalike staging hosts and embedded credentials', () => {
  for (const value of [
    'https://spikedate.app',
    'https://spikedate-stage.sarathnice.workers.dev.evil.test',
    'https://admin:secret@spikedate-stage.sarathnice.workers.dev',
    'http://localhost:3002/?secret=yes',
  ])
    assert.throws(() => validateTarget(value));
  assert.equal(
    validateTarget('http://localhost:3002/'),
    'http://localhost:3002',
  );
  assert.equal(
    validateTarget('https://spikedate-stage.sarathnice.workers.dev/'),
    'https://spikedate-stage.sarathnice.workers.dev',
  );
});
test('nested projects and retries are counted accurately', () => {
  const rows = collectTests({
    suites: [
      {
        title: 'file',
        suites: [
          {
            title: 'group',
            specs: [
              {
                title: 'case',
                tests: [
                  {
                    projectName: 'ios',
                    status: 'flaky',
                    results: [
                      { errors: [{ message: 'Timeout <script>' }] },
                      { errors: [] },
                    ],
                  },
                  { projectName: 'android', status: 'skipped', results: [] },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].attempts, 2);
  assert.equal(rows[0].status, 'flaky');
  assert.equal(rows[1].status, 'skipped');
  const html = renderReport({ tests: rows, steps: [], status: 'FAILED' });
  assert.ok(html.includes('Flaky: 1'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('Timeout <script>'));
});
test('report escapes user-facing text', () =>
  assert.equal(escapeHtml('<a "x">&'), '&lt;a &quot;x&quot;&gt;&amp;'));
