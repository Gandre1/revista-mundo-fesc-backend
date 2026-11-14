const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

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
