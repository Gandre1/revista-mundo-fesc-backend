const assert = require('node:assert/strict');
const http = require('node:http');
const Module = require('node:module');
const test = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');

const controllerPath = require.resolve('../src/controllers/analyticsController');
const state = { calls: [] };
const db = {
  async query(sql) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    state.calls.push(normalizedSql);

    if (normalizedSql.includes('from submissions') && normalizedSql.includes('group by status')) {
      return [[
        { status: 'submitted', total: 2 },
        { status: 'under_review', total: 1 },
        { status: 'changes_requested', total: 1 },
        { status: 'accepted', total: 2 },
        { status: 'rejected', total: 2 },
        { status: 'published', total: 2 },
      ]];
    }
    if (normalizedSql.startsWith('select role, count(*) as total')) {
      return [[
        { role: 'admin', total: 1 },
        { role: 'editor', total: 2 },
        { role: 'reviewer', total: 3 },
        { role: 'author', total: 8 },
      ]];
    }
    if (normalizedSql.startsWith('select avg(timestampdiff')) {
      return [[{ average_days: 4.5 }]];
    }
    if (normalizedSql.startsWith('select count(*) as assigned')) {
      return [[{ assigned: 5, completed: 3 }]];
    }
    if (normalizedSql.startsWith('select i.id, i.volume')) {
      return [[{
        id: 4,
        volume: 2,
        number: 1,
        year: 2026,
        title: 'Volumen 2',
        published_at: '2026-10-01 09:00:00',
        articles_count: '7',
      }]];
    }
    throw new Error(`Consulta no contemplada en la prueba: ${normalizedSql}`);
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && parent.filename === controllerPath) return db;
  return originalLoad.call(this, request, parent, isMain);
};
const analyticsRoutes = require('../src/routes/analyticsRoutes');
Module._load = originalLoad;

const app = express();
app.use('/api/analytics', analyticsRoutes);
let server;
let baseUrl;
const originalJwtSecret = process.env.JWT_SECRET;
const testSecret = 'analytics-route-tests-secret';

test.before(async () => {
  process.env.JWT_SECRET = testSecret;
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

function tokenFor(role) {
  return jwt.sign({ id: `${role}-1`, role }, testSecret);
}

async function get(path, role) {
  const headers = role ? { Authorization: `Bearer ${tokenFor(role)}` } : {};
  const response = await fetch(`${baseUrl}/api/analytics${path}`, { headers });
  return { status: response.status, body: await response.json() };
}

test('requires authentication and restricts analytics to editorial roles', async () => {
  const anonymousResponse = await get('/overview');
  assert.equal(anonymousResponse.status, 401);

  const authorResponse = await get('/overview', 'author');
  assert.equal(authorResponse.status, 403);
  assert.equal(state.calls.length, 0);
});

test('overview returns article totals, acceptance rate, and users by role', async () => {
  state.calls = [];
  const response = await get('/overview', 'admin');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    totalArticles: 10,
    articlesByStatus: {
      submitted: 2,
      under_review: 1,
      changes_requested: 1,
      accepted: 2,
      rejected: 2,
      published: 2,
    },
    acceptanceRate: 66.67,
    usersByRole: { admin: 1, editor: 2, reviewer: 3, author: 8 },
  });
  assert.equal(state.calls.length, 2);
});

test('editorial times returns average decision days and review completion statistics', async () => {
  state.calls = [];
  const response = await get('/editorial-times', 'editor');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    averageDecisionDays: 4.5,
    reviews: { assigned: 5, completed: 3, pending: 2, completionRate: 60 },
  });
  assert.ok(state.calls.some((sql) => sql.includes('submission_audit_logs')));
});

test('issues summary includes published article counts and issue publication dates', async () => {
  const response = await get('/issues-summary', 'admin');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    issues: [{
      id: 4,
      volume: 2,
      number: 1,
      year: 2026,
      title: 'Volumen 2',
      published_at: '2026-10-01 09:00:00',
      articles_count: 7,
    }],
  });
});
