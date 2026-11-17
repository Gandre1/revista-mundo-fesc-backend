const assert = require('node:assert/strict');
const http = require('node:http');
const Module = require('node:module');
const test = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');

const modelPath = require.resolve('../src/models/AuditLog');
const state = { query: null, values: null };
const db = {
  async query(sql, values) {
    state.query = sql.replace(/\s+/g, ' ').trim();
    state.values = values;
    return [{ insertId: 12 }];
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && parent.filename === modelPath) return db;
  return originalLoad.call(this, request, parent, isMain);
};
const AuditLog = require(modelPath);
Module._load = originalLoad;

test('creates an audit log with its actor, target, details, and IP address', async () => {
  const entry = {
    user: { id: 'user-1' },
    action: 'update',
    targetModel: 'Issue',
    targetId: 7,
    details: { statusCode: 200 },
    ipAddress: '127.0.0.1',
  };

  const created = await AuditLog.create(entry);

  assert.match(state.query, /INSERT INTO audit_logs/);
  assert.deepEqual(state.values, [
    'user-1',
    'update',
    'Issue',
    '7',
    '{"statusCode":200}',
    '127.0.0.1',
  ]);
  assert.deepEqual(created, {
    id: 12,
    user: 'user-1',
    action: 'update',
    targetModel: 'Issue',
    targetId: '7',
    details: { statusCode: 200 },
    ipAddress: '127.0.0.1',
  });
});

const auditControllerPath = require.resolve('../src/controllers/auditController');
const auditState = { calls: [] };
const auditDb = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    auditState.calls.push({ sql: normalizedSql, values });
    if (normalizedSql.startsWith('select audit_logs.*')) {
      return [[{
        id: 8,
        user_id: 'user-1',
        action: 'update',
        target_model: 'Issue',
        user_name: 'Ana García',
        user_email: 'ana@example.org',
      }]];
    }
    if (normalizedSql.includes('group by action')) {
      return [[
        { action: 'create', total: '2' },
        { action: 'update', total: '3' },
      ]];
    }
    if (normalizedSql.startsWith('select count(*) as total from audit_logs')) {
      return [[{ total: '5' }]];
    }
    throw new Error(`Consulta de auditoría no contemplada: ${normalizedSql}`);
  },
};

const auditOriginalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && parent.filename === auditControllerPath) return auditDb;
  return auditOriginalLoad.call(this, request, parent, isMain);
};
const auditRoutes = require('../src/routes/auditRoutes');
Module._load = auditOriginalLoad;

const auditApp = express();
auditApp.use('/api/audit-logs', auditRoutes);
let auditServer;
let auditBaseUrl;
const originalAuditJwtSecret = process.env.JWT_SECRET;
const auditTestSecret = 'audit-route-tests-secret';

test.before(async () => {
  process.env.JWT_SECRET = auditTestSecret;
  auditServer = http.createServer(auditApp);
  await new Promise((resolve) => auditServer.listen(0, '127.0.0.1', resolve));
  auditBaseUrl = `http://127.0.0.1:${auditServer.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => auditServer.close((error) => error ? reject(error) : resolve()));
  if (originalAuditJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalAuditJwtSecret;
});

function auditTokenFor(role) {
  return jwt.sign({ id: `${role}-1`, role }, auditTestSecret);
}

async function getAudit(path, role) {
  const headers = role ? { Authorization: `Bearer ${auditTokenFor(role)}` } : {};
  const response = await fetch(`${auditBaseUrl}/api/audit-logs${path}`, { headers });
  return { status: response.status, body: await response.json() };
}

test('lists audit logs with pagination, actor data, and all optional filters', async () => {
  auditState.calls = [];
  const query = '?page=2&limit=10&userId=user-1&user=Ana&action=update&target=Issue&startDate=2026-01-01&endDate=2026-01-31';
  const response = await getAudit(query, 'admin');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    logs: [{
      id: 8,
      user_id: 'user-1',
      action: 'update',
      target_model: 'Issue',
      user_name: 'Ana García',
      user_email: 'ana@example.org',
    }],
    pagination: { page: 2, limit: 10, total: 5, totalPages: 1 },
  });

  const listCall = auditState.calls.find(({ sql }) => sql.startsWith('select audit_logs.*'));
  assert.ok(listCall.sql.includes('left join users on users.id = audit_logs.user_id'));
  assert.ok(listCall.sql.includes('order by audit_logs.created_at desc, audit_logs.id desc'));
  assert.ok(listCall.sql.includes('user_id = ? and action = ? and target_model = ?'));
  assert.ok(listCall.sql.includes('users.nombre like ? or users.apellidos like ? or concat_ws'));
  assert.ok(listCall.sql.includes('audit_logs.created_at >= ?'));
  assert.ok(listCall.sql.includes('audit_logs.created_at < date_add(?, interval 1 day)'));
  assert.deepEqual(listCall.values, [
    'user-1', 'update', 'Issue',
    '%Ana%', '%Ana%', '%Ana%', '%Ana%',
    '2026-01-01 00:00:00', '2026-01-31 00:00:00',
    10, 10,
  ]);
  const countCall = auditState.calls.find(({ sql }) => sql.startsWith('select count(*)'));
  assert.ok(countCall.sql.includes('left join users on users.id = audit_logs.user_id'));
  assert.deepEqual(countCall.values, listCall.values.slice(0, -2));
});

test('audit summary returns total logs and counts by action', async () => {
  auditState.calls = [];
  const response = await getAudit('/summary', 'admin');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    total: 5,
    byAction: [
      { action: 'create', total: 2 },
      { action: 'update', total: 3 },
    ],
  });
  assert.equal(auditState.calls.length, 2);
});

test('audit endpoints require authentication and reject every non-admin role', async () => {
  auditState.calls = [];
  assert.equal((await getAudit('')).status, 401);

  for (const role of ['editor', 'reviewer', 'author']) {
    assert.equal((await getAudit('', role)).status, 403);
    assert.equal((await getAudit('/summary', role)).status, 403);
  }
  assert.equal(auditState.calls.length, 0);
});
