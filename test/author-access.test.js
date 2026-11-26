const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const controllerPath = require.resolve('../src/controllers/authorController');
const state = { inserts: 0, deletes: 0, authorReads: 0 };
const db = {
  async query(sql) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalizedSql === 'select autor_id from submissions where id = ?') {
      return [[{ autor_id: 'owner-1' }]];
    }
    if (normalizedSql.startsWith('select a.submission_id, s.autor_id')) {
      return [[{ submission_id: 'submission-1', autor_id: 'owner-1' }]];
    }
    if (normalizedSql.startsWith('select * from authors')) {
      state.authorReads += 1;
      return [[{ id: 1, nombre: 'Coautor' }]];
    }
    if (normalizedSql.startsWith('insert into authors')) {
      state.inserts += 1;
      return [{ insertId: state.inserts }];
    }
    if (normalizedSql === 'delete from authors where id = ?') {
      state.deletes += 1;
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Consulta no contemplada en la prueba: ${normalizedSql}`);
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && parent.filename === controllerPath) return db;
  return originalLoad.call(this, request, parent, isMain);
};
const authorController = require('../src/controllers/authorController');
Module._load = originalLoad;

function response() {
  return {
    statusCode: 200,
    body: null,
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

test('non-owners cannot add, list, or delete authors on another submission', async () => {
  state.inserts = 0;
  state.deletes = 0;
  state.authorReads = 0;

  const addResponse = response();
  await authorController.addAuthor({
    user: { id: 'reviewer-1', role: 'reviewer' },
    body: {
      submission_id: 'submission-1',
      nombre: 'Invitado',
      apellidos: 'No autorizado',
      email: 'guest@example.org',
    },
  }, addResponse);
  assert.equal(addResponse.statusCode, 404);
  assert.equal(state.inserts, 0);

  const listResponse = response();
  await authorController.getAuthorsBySubmission({
    user: { id: 'author-2', role: 'author' },
    params: { submissionId: 'submission-1' },
  }, listResponse);
  assert.equal(listResponse.statusCode, 404);
  assert.equal(state.authorReads, 0);

  const deleteResponse = response();
  await authorController.deleteAuthor({
    user: { id: 'author-2', role: 'author' },
    params: { id: '1' },
  }, deleteResponse);
  assert.equal(deleteResponse.statusCode, 404);
  assert.equal(state.deletes, 0);
});

test('submission owners can still add and list their authors', async () => {
  state.inserts = 0;
  state.authorReads = 0;
  const user = { id: 'owner-1', role: 'author' };
  const addResponse = response();

  await authorController.addAuthor({
    user,
    body: {
      submission_id: 'submission-1',
      nombre: 'Coautor',
      apellidos: 'Prueba',
      email: 'coauthor@example.org',
    },
  }, addResponse);

  assert.equal(addResponse.statusCode, 201);
  assert.equal(state.inserts, 1);

  const listResponse = response();
  await authorController.getAuthorsBySubmission({
    user,
    params: { submissionId: 'submission-1' },
  }, listResponse);

  assert.equal(listResponse.statusCode, 200);
  assert.equal(state.authorReads, 1);
});
