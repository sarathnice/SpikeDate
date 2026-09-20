import assert from 'node:assert/strict';

const baseUrl = process.env.SPIKEDATE_API_URL || 'http://127.0.0.1:3002';
const seedSecret = process.env.SPIKEDATE_TEST_SEED_SECRET || 'local-e2e-secret';
const password = 'SpikeDate2026!';

const results = [];
const record = async (name, operation) => {
  try {
    await operation();
    results.push({ name, status: 'passed' });
  } catch (error) {
    results.push({ name, status: 'failed', error: error.message });
  }
};

const jsonRequest = async (path, options = {}) => {
  const response = await fetch(baseUrl + path, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  let body;
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return { response, body };
};

const login = async (email) => {
  const { response, body } = await jsonRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, JSON.stringify(body));
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie, 'login did not return a session cookie');
  return cookie;
};

let firstCookie = '';
let secondCookie = '';
let conversationId = '';
let reportId = '';

await jsonRequest('/api/test/seed', {
  method: 'DELETE',
  headers: { 'x-spikedate-seed-secret': seedSecret },
});

await record('seed exactly 50 isolated accounts', async () => {
  await jsonRequest('/api/test/seed', {
    method: 'DELETE',
    headers: { 'x-spikedate-seed-secret': seedSecret },
  });
  const { response, body } = await jsonRequest('/api/test/seed', {
    method: 'POST',
    headers: { 'x-spikedate-seed-secret': seedSecret },
  });
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.created, 50);
});

await record('authenticate all 50 synthetic accounts', async () => {
  const sessions = await Promise.all(
    Array.from({ length: 50 }, (_, index) =>
      login(`test${String(index + 1).padStart(3, '0')}@spikedate.test`),
    ),
  );
  assert.equal(sessions.length, 50);
  assert.ok(sessions.every(Boolean), 'every synthetic account needs a session');
});

await record('reject under-18 registration', async () => {
  const currentYear = new Date().getUTCFullYear();
  const { response, body } = await jsonRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'underage-' + Date.now() + '@spikedate.test',
      password,
      birthDate: currentYear - 17 + '-01-01',
      displayName: 'Under Age',
      gender: 'woman',
      relationshipGoal: 'Dating',
      termsAccepted: true,
    }),
  });
  assert.equal(response.status, 400, JSON.stringify(body));
});

await record('complete adult registration and session', async () => {
  const email = 'registration-' + Date.now() + '@spikedate.test';
  const phoneNumber = '+1202555' + String(Date.now()).slice(-4);
  let phoneResult = await jsonRequest('/api/auth/phone/start', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  });
  assert.equal(
    phoneResult.response.status,
    201,
    JSON.stringify(phoneResult.body),
  );
  assert.ok(phoneResult.body.challengeId);
  phoneResult = await jsonRequest('/api/auth/phone/verify', {
    method: 'POST',
    body: JSON.stringify({
      challengeId: phoneResult.body.challengeId,
      code: phoneResult.body.testCode || '123456',
    }),
  });
  assert.equal(
    phoneResult.response.status,
    200,
    JSON.stringify(phoneResult.body),
  );
  assert.ok(phoneResult.body.registrationToken);
  const { response, body } = await jsonRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      birthDate: '1995-01-01',
      displayName: 'Registration QA',
      gender: 'woman',
      relationshipGoal: 'Long-term',
      termsAccepted: true,
      phoneVerificationToken: phoneResult.body.registrationToken,
    }),
  });
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.profile.displayName, 'Registration QA');
});

await record('sign in first synthetic profile', async () => {
  firstCookie = await login('test001@spikedate.test');
});

await record(
  'require consent, verify camera quality, expose status, and delete verification',
  async () => {
    let result = await jsonRequest('/api/verification', {
      method: 'POST',
      headers: { cookie: firstCookie },
      body: JSON.stringify({ action: 'start', consent: false }),
    });
    assert.equal(result.response.status, 400, JSON.stringify(result.body));

    result = await jsonRequest('/api/verification', {
      method: 'POST',
      headers: { cookie: firstCookie },
      body: JSON.stringify({ action: 'start', consent: true }),
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    assert.ok(result.body.request?.id, 'camera check did not create a request');
    const requestId = result.body.request.id;

    result = await jsonRequest('/api/verification', {
      method: 'POST',
      headers: { cookie: firstCookie },
      body: JSON.stringify({
        action: 'complete',
        requestId,
        metrics: {
          brightness: 128,
          sharpness: 18,
          faceCount: 1,
          frameCount: 1,
          captureDigest: 'a'.repeat(64),
        },
      }),
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.status, 'photo_verified');
    assert.equal(result.body.retainedImage, false);

    result = await jsonRequest('/api/verification', {
      headers: { cookie: firstCookie },
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.status, 'photo_verified');

    result = await jsonRequest('/api/verification', {
      method: 'DELETE',
      headers: { cookie: firstCookie },
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.status, 'unverified');

    result = await jsonRequest('/api/verification', {
      method: 'POST',
      headers: { cookie: firstCookie },
      body: JSON.stringify({ action: 'start', consent: true }),
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    result = await jsonRequest('/api/verification', {
      method: 'POST',
      headers: { cookie: firstCookie },
      body: JSON.stringify({
        action: 'complete',
        requestId: result.body.request.id,
        metrics: {
          brightness: 128,
          sharpness: 18,
          faceCount: 1,
          frameCount: 1,
          captureDigest: 'b'.repeat(64),
        },
      }),
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.status, 'photo_verified');
  },
);

await record(
  'validate, upload, order, serve, and remove profile media',
  async () => {
    let result = await jsonRequest('/api/media', {
      method: 'POST',
      headers: { cookie: firstCookie, 'content-type': 'image/png' },
      body: new Uint8Array([
        0x6e, 0x6f, 0x74, 0x2d, 0x61, 0x2d, 0x70, 0x6e, 0x67,
      ]),
    });
    assert.equal(result.response.status, 415, JSON.stringify(result.body));

    const onePixelPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    result = await jsonRequest('/api/media', {
      method: 'POST',
      headers: { cookie: firstCookie, 'content-type': 'image/png' },
      body: onePixelPng,
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    const uploadedId = result.body.media.id;
    assert.ok(uploadedId);

    result = await jsonRequest('/api/media/' + uploadedId + '?variant=card', {
      method: 'PUT',
      headers: { cookie: firstCookie, 'content-type': 'image/png' },
      body: onePixelPng,
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.variant, 'card');

    const served = await fetch(baseUrl + '/api/media/' + uploadedId, {
      headers: { cookie: firstCookie },
    });
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/png');

    const servedCard = await fetch(
      baseUrl + '/api/media/' + uploadedId + '?variant=card',
      { headers: { cookie: firstCookie } },
    );
    assert.equal(servedCard.status, 200);
    assert.equal(servedCard.headers.get('x-spikedate-image-variant'), 'card');
    assert.equal(servedCard.headers.get('content-type'), 'image/png');

    result = await jsonRequest('/api/profile', {
      headers: { cookie: firstCookie },
    });
    const mediaIds = result.body.media.map((item) => item.id).reverse();
    result = await jsonRequest('/api/media', {
      method: 'PATCH',
      headers: { cookie: firstCookie },
      body: JSON.stringify({ mediaIds }),
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.deepEqual(result.body.mediaIds, mediaIds);

    result = await jsonRequest('/api/media/' + uploadedId, {
      method: 'DELETE',
      headers: { cookie: firstCookie },
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
  },
);

await record(
  'enforce premium profile-video limits before storage',
  async () => {
    const result = await jsonRequest('/api/media', {
      method: 'POST',
      headers: {
        cookie: firstCookie,
        'content-type': 'video/mp4',
        'x-spikedate-duration-seconds': '16',
      },
      body: Buffer.from('fake-video'),
    });
    assert.equal(result.response.status, 413, JSON.stringify(result.body));
    assert.match(result.body.error, /15 seconds/i);
  },
);

await record(
  'save notification categories and local-time quiet hours',
  async () => {
    let result = await jsonRequest('/api/notifications/preferences', {
      headers: { cookie: firstCookie },
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.preferences.newMatches, true);
    result = await jsonRequest('/api/notifications/preferences', {
      method: 'PATCH',
      headers: { cookie: firstCookie },
      body: JSON.stringify({
        ...result.body.preferences,
        activityBriefing: true,
        quietHours: {
          start: '22:00',
          end: '08:00',
          timeZone: 'America/New_York',
        },
      }),
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.preferences.activityBriefing, true);
    assert.equal(
      result.body.preferences.quietHours.timeZone,
      'America/New_York',
    );
  },
);

await record('load and edit all profile foundations', async () => {
  let result = await jsonRequest('/api/profile', {
    headers: { cookie: firstCookie },
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.user.email, 'test001@spikedate.test');
  result = await jsonRequest('/api/profile', {
    method: 'PATCH',
    headers: { cookie: firstCookie },
    body: JSON.stringify({
      section: 'preferences',
      data: {
        genders: [],
        minAge: 21,
        maxAge: 55,
        maxDistanceKm: 100,
        relationshipGoals: [],
        dealbreakers: ['Smoking'],
      },
    }),
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
});

await record('create and replace one 24-hour daily update', async () => {
  let result = await jsonRequest('/api/daily-update', {
    method: 'POST',
    headers: { cookie: firstCookie },
    body: JSON.stringify({
      text: 'Coffee and a waterfront walk today.',
      visibility: 'discover',
      availableTonight: true,
    }),
  });
  assert.ok(
    [200, 201].includes(result.response.status),
    JSON.stringify(result.body),
  );
  result = await jsonRequest('/api/daily-update', {
    method: 'POST',
    headers: { cookie: firstCookie },
    body: JSON.stringify({
      text: 'Updated: bookstore and coffee.',
      visibility: 'discover',
      availableTonight: false,
    }),
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.replaced, true);
});

await record('discover ranked eligible profiles', async () => {
  const { response, body } = await jsonRequest('/api/discover?limit=50', {
    headers: { cookie: firstCookie },
  });
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.ok(
    body.profiles.length >= 49,
    'expected the remaining synthetic profiles',
  );
  assert.ok(!body.profiles.some((profile) => profile.user_id === 'test-001'));
});

await record('like, reciprocal like, and match', async () => {
  let result = await jsonRequest('/api/interactions', {
    method: 'POST',
    headers: { cookie: firstCookie },
    body: JSON.stringify({
      targetUserId: 'test-002',
      kind: 'like',
      targetType: 'profile',
      idempotencyKey: 'like-001-to-002',
    }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  secondCookie = await login('test002@spikedate.test');
  result = await jsonRequest('/api/interactions', {
    method: 'POST',
    headers: { cookie: secondCookie },
    body: JSON.stringify({
      targetUserId: 'test-001',
      kind: 'like',
      targetType: 'profile',
      idempotencyKey: 'like-002-to-001',
    }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  assert.ok(result.body.match?.id, 'reciprocal like did not create a match');
});

await record('send, deliver, and read a matched message', async () => {
  let result = await jsonRequest('/api/conversations', {
    headers: { cookie: firstCookie },
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  conversationId = result.body.conversations[0]?.id;
  assert.ok(conversationId, 'missing match conversation');
  result = await jsonRequest(
    '/api/conversations/' + conversationId + '/messages',
    {
      method: 'POST',
      headers: { cookie: firstCookie },
      body: JSON.stringify({
        body: 'Would you like to meet for coffee?',
        clientId: 'message-client-001',
      }),
    },
  );
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.message.deliveredAt, null);
  const messageId = result.body.message.id;
  result = await jsonRequest(
    '/api/conversations/' + conversationId + '/messages',
    {
      headers: { cookie: secondCookie },
    },
  );
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(
    result.body.messages.at(-1).body,
    'Would you like to meet for coffee?',
  );
  result = await jsonRequest(
    '/api/conversations/' + conversationId + '/messages',
    {
      method: 'PATCH',
      headers: { cookie: secondCookie },
      body: JSON.stringify({ deliveredIds: [messageId] }),
    },
  );
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.ok(result.body.messages[0].delivered_at);
  assert.equal(result.body.messages[0].read_at, null);
  result = await jsonRequest(
    '/api/conversations/' + conversationId + '/messages',
    {
      method: 'PATCH',
      headers: { cookie: secondCookie },
      body: JSON.stringify({ messageIds: [messageId] }),
    },
  );
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.ok(result.body.messages[0].read_at);
});

await record('create a Galaxy plan for an active match', async () => {
  const { response, body } = await jsonRequest('/api/galaxy/plans', {
    method: 'POST',
    headers: { cookie: firstCookie },
    body: JSON.stringify({
      name: 'Saturday coffee',
      activity: 'Coffee',
      venue: {
        name: 'Harbor Café',
        address: '1 Main Street, Boston',
        latitude: 42.36,
        longitude: -71.06,
      },
      startsAt: Date.now() + 24 * 60 * 60 * 1000,
      publicVenueConfirmed: true,
      safetyAcknowledged: true,
      inviteeIds: ['test-002'],
    }),
  });
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.plan.status, 'sent');
});

await record('reject an unsafe or multi-person date plan', async () => {
  const { response, body } = await jsonRequest('/api/galaxy/plans', {
    method: 'POST',
    headers: { cookie: firstCookie },
    body: JSON.stringify({
      name: 'Unsafe plan',
      activity: 'Coffee',
      venue: { name: 'Public Café', address: '2 Main Street, Boston' },
      startsAt: Date.now() + 24 * 60 * 60 * 1000,
      publicVenueConfirmed: true,
      safetyAcknowledged: false,
      inviteeIds: ['test-002', 'test-003'],
    }),
  });
  assert.equal(response.status, 400, JSON.stringify(body));
});

await record('purchase and activate a standalone Profile Lift', async () => {
  let result = await jsonRequest('/api/billing/purchase', {
    method: 'POST',
    headers: { cookie: firstCookie },
    body: JSON.stringify({
      productId: 'spikedate.lifts.3',
      provider: 'mock',
      transactionId: 'mock-lifts-' + Date.now(),
    }),
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.ok(result.body.wallet.profile_lifts >= 5);
  result = await jsonRequest('/api/billing/lift', {
    method: 'POST',
    headers: { cookie: firstCookie },
    body: JSON.stringify({
      source: 'purchased',
      idempotencyKey: 'activate-lift-' + Date.now(),
    }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  assert.ok(result.body.activation.endsAt > Date.now());
});

await record('send a Super Spike and decrement allowance', async () => {
  const { response, body } = await jsonRequest('/api/interactions', {
    method: 'POST',
    headers: { cookie: firstCookie },
    body: JSON.stringify({
      targetUserId: 'test-003',
      kind: 'super_spike',
      note: 'Your cooking prompt made me smile.',
      targetType: 'prompt',
      idempotencyKey: 'super-spike-001-to-003',
    }),
  });
  assert.equal(response.status, 201, JSON.stringify(body));
});

await record('report and block a profile', async () => {
  let result = await jsonRequest('/api/safety', {
    method: 'POST',
    headers: { cookie: firstCookie },
    body: JSON.stringify({
      targetUserId: 'test-002',
      action: 'report',
      reason: 'Suspicious behavior',
      details: 'Synthetic moderation test.',
    }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  reportId = result.body.actionId;
  assert.ok(reportId, 'report did not return a case id');
  result = await jsonRequest('/api/galaxy/plans', {
    headers: { cookie: firstCookie },
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(
    result.body.plans.find((plan) => plan.name === 'Saturday coffee')?.status,
    'cancelled',
    'reporting a date participant should cancel the shared plan',
  );
  result = await jsonRequest('/api/safety', {
    method: 'POST',
    headers: { cookie: firstCookie },
    body: JSON.stringify({ targetUserId: 'test-004', action: 'block' }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
});

await record('load protected role-based admin overview', async () => {
  const { response, body } = await jsonRequest('/api/admin/overview', {
    headers: { cookie: firstCookie },
  });
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.ok(body.metrics.activeUsers >= 50);
  assert.ok(body.metrics.openReports >= 1);
  assert.ok(body.admin.roles.includes('super_admin'));
});

await record('resolve a moderation case with an audit note', async () => {
  const { response, body } = await jsonRequest('/api/admin/cases/' + reportId, {
    method: 'PATCH',
    headers: { cookie: firstCookie },
    body: JSON.stringify({
      outcome: 'dismissed',
      note: 'Synthetic case reviewed during the automated end-to-end run.',
    }),
  });
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.case.status, 'dismissed');
});

const failed = results.filter((item) => item.status === 'failed');
console.table(results);
console.log(
  JSON.stringify(
    {
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      failures: failed,
    },
    null,
    2,
  ),
);
if (failed.length) process.exitCode = 1;
