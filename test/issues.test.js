const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const controllerPath = require.resolve('../src/controllers/issueController');
const state = {
  issues: [],
  calls: [],
};

const db = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    state.calls.push({ sql: normalizedSql, values });

    if (normalizedSql.startsWith('select id, volume, number, year')) {
      return [state.issues];
    }
    if (normalizedSql.startsWith('insert into issues')) {
      return [{ insertId: 12, affectedRows: 1 }];
    }
    if (normalizedSql.startsWith("select id from users where role in")) {
      return [[]];
    }
    if (normalizedSql.startsWith('insert into notifications')) {
      return [{ insertId: 1, affectedRows: 1 }];
    }
    throw new Error(`Consulta no contemplada en la prueba: ${normalizedSql}`);
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && parent.filename === controllerPath) {
    return db;
  }
  return originalLoad.call(this, request, parent, isMain);
};

const controller = require(controllerPath);
Module._load = originalLoad;

function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('creates an issue with normalized publication data', async () => {
  state.calls = [];
  const res = response();

  await controller.createIssue({
    body: {
      volume: '5',
      number: 2,
      year: 2026,
      title: '  Ciencia y tecnología  ',
      description: ' Volumen de investigación ',
      status: 'draft',
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.issue.id, 12);
  assert.equal(res.body.issue.volume, 5);
  assert.equal(res.body.issue.number, 2);
  assert.equal(res.body.issue.title, 'Ciencia y tecnología');
  assert.deepEqual(state.calls[0].values, [
    5,
    2,
    2026,
    'Ciencia y tecnología',
    'Volumen de investigación',
    'draft',
  ]);
});

test('rejects incomplete issue data and lists issues', async () => {
  state.calls = [];
  const invalidResponse = response();

  await controller.createIssue({ body: { volume: 1, number: 1 } }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);
  assert.equal(state.calls.length, 0);

  state.issues = [{ id: 12, volume: 5, number: 2, year: 2026, status: 'draft' }];
  const listResponse = response();
  await controller.listIssues({}, listResponse);

  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.body.issues, state.issues);
  assert.match(state.calls[0].sql, /order by year desc, volume desc, number desc/);
});
