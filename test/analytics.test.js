const assert = require('node:assert/strict');
const http = require('node:http');
const Module = require('node:module');
const test = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');

const controllerPath = require.resolve('../src/controllers/analyticsController');
const state = { calls: [] };
const db = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    state.calls.push({ sql: normalizedSql, values });

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
    if (normalizedSql.startsWith('select concat_ws')) {
      return [[
        {
          nombre: 'Ana Evaluadora',
          correo: 'ana@example.org',
          assigned_reviews: '4',
          completed_reviews: '2',
          average_response_days: '5.256',
        },
        {
          nombre: 'Eva Sin asignaciones',
          correo: 'eva@example.org',
          assigned_reviews: '0',
          completed_reviews: null,
          average_response_days: null,
        },
      ]];
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

async function getCsv(path, role) {
  const headers = role ? { Authorization: `Bearer ${tokenFor(role)}` } : {};
  const response = await fetch(`${baseUrl}/api/analytics${path}`, { headers });
  const body = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await response.arrayBuffer());
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    contentDisposition: response.headers.get('content-disposition'),
    body,
  };
}

test('requires authentication and restricts analytics to editorial roles', async () => {
  const anonymousResponse = await get('/overview');
  assert.equal(anonymousResponse.status, 401);
  const anonymousCsvResponse = await getCsv('/export/csv');
  assert.equal(anonymousCsvResponse.status, 401);

  const authorResponse = await get('/overview', 'author');
  assert.equal(authorResponse.status, 403);
  const authorCsvResponse = await getCsv('/export/csv', 'author');
  assert.equal(authorCsvResponse.status, 403);
  assert.equal(state.calls.length, 0);

  const reviewerResponse = await get('/reviewers', 'reviewer');
  assert.equal(reviewerResponse.status, 403);
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
  assert.deepEqual(state.calls[0].values, []);
});

test('editorial times returns average decision days and review completion statistics', async () => {
  state.calls = [];
  const response = await get('/editorial-times', 'editor');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    averageDecisionDays: 4.5,
    reviews: { assigned: 5, completed: 3, pending: 2, completionRate: 60 },
  });
  assert.ok(state.calls.some(({ sql }) => sql.includes('submission_audit_logs')));
});

test('CSV export includes analytics and editorial metrics, download headers, and filters', async () => {
  state.calls = [];
  const filters = '?startDate=2026-01-01&endDate=2026-12-31&issueId=4&section=Art%C3%ADculos%20de%20Investigaci%C3%B3n';
  const response = await getCsv(`/export/csv${filters}`, 'editor');

  assert.equal(response.status, 200);
  assert.match(response.contentType, /^text\/csv(?:;|$)/);
  assert.equal(response.contentDisposition, 'attachment; filename="analytics-report.csv"');
  assert.ok(response.body.startsWith('\uFEFF"Categoría","Métrica","Valor"'));
  assert.match(response.body, /"Resumen","Total de artículos","10"/);
  assert.match(response.body, /"Artículos por estado","published","2"/);
  assert.match(response.body, /"Resumen","Tasa de aceptación \(%\)","66\.67"/);
  assert.match(response.body, /"Métricas editoriales","Promedio de días hasta la decisión","4\.5"/);
  assert.match(response.body, /"Revisiones","Pendientes","2"/);

  const filteredQueries = state.calls.filter(({ sql }) => sql.includes('issue_id = ?') && sql.includes('seccion = ?'));
  assert.equal(filteredQueries.length, 3);
  assert.ok(filteredQueries.every(({ values }) => (
    values.includes('2026-01-01 00:00:00')
      && values.includes('2026-12-31 00:00:00')
      && values.includes(4)
      && values.includes('Artículos de Investigación')
  )));
});

test('issues summary includes published article counts and issue publication dates', async () => {
  state.calls = [];
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
  assert.equal(state.calls.length, 1);
});

test('all analytics endpoints apply date, issue, and section filters with bound parameters', async () => {
  const filters = '?startDate=2026-01-01&endDate=2026-12-31&issueId=4&section=Art%C3%ADculos%20de%20Investigaci%C3%B3n';
  state.calls = [];

  for (const endpoint of ['/overview', '/editorial-times', '/issues-summary', '/reviewers']) {
    const response = await get(`${endpoint}${filters}`, 'editor');
    assert.equal(response.status, 200);
  }

  const filteredQueries = state.calls.filter(({ sql }) => sql.includes('issue_id = ?') && sql.includes('seccion = ?'));
  assert.ok(filteredQueries.length >= 5);
  assert.ok(filteredQueries.every(({ sql }) => (
    sql.includes('fecha_envio >= ?')
      && sql.includes('fecha_envio < date_add(?, interval 1 day)')
  )));
  assert.ok(filteredQueries.some(({ values }) => (
    values.includes('2026-01-01 00:00:00')
      && values.includes('2026-12-31 00:00:00')
      && values.includes(4)
      && values.includes('Artículos de Investigación')
  )));
});

test('reviewer performance returns assignment, completion, compliance, and response metrics', async () => {
  state.calls = [];
  const response = await get('/reviewers', 'admin');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    reviewers: [
      {
        nombre: 'Ana Evaluadora',
        correo: 'ana@example.org',
        assignedReviews: 4,
        completedReviews: 2,
        pendingReviews: 2,
        completionRate: 50,
        averageResponseDays: 5.26,
      },
      {
        nombre: 'Eva Sin asignaciones',
        correo: 'eva@example.org',
        assignedReviews: 0,
        completedReviews: 0,
        pendingReviews: 0,
        completionRate: 0,
        averageResponseDays: null,
      },
    ],
  });
  assert.ok(state.calls[0].sql.includes("where u.role = 'reviewer'"));
});

test('rejects invalid analytics filters without querying the database', async () => {
  state.calls = [];
  const response = await get('/overview?startDate=2026-02-30', 'admin');

  assert.equal(response.status, 400);
  assert.match(response.body.message, /fecha/i);
  assert.equal(state.calls.length, 0);
});
