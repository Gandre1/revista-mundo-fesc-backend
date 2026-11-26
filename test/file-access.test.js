const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const controllerPath = require.resolve('../src/controllers/fileController');
const state = { assignedReviewerId: 'reviewer-1' };
const db = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalizedSql.startsWith('select sf.nombre_original')) {
      return [[{
        nombre_original: 'manuscrito.pdf',
        ruta_almacenamiento: 'uploads/manuscrito.pdf',
        submission_id: 'submission-1',
        autor_id: 'author-1',
      }]];
    }
    if (normalizedSql.startsWith('select id from submission_reviews')) {
      return [values[1] === state.assignedReviewerId ? [{ id: 1 }] : []];
    }
    if (normalizedSql.startsWith('select id, autor_id from submissions')) {
      return [[{ id: 'submission-1', autor_id: 'author-1' }]];
    }
    if (normalizedSql.startsWith('select id, nombre_original, tipo, tamano, fecha_subida')) {
      return [[{ id: 1, nombre_original: 'manuscrito.pdf', tipo: 'manuscrito', tamano: 100 }]];
    }
    throw new Error(`Consulta no contemplada en la prueba: ${normalizedSql}`);
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && parent.filename === controllerPath) return db;
  return originalLoad.call(this, request, parent, isMain);
};
const fileController = require('../src/controllers/fileController');
Module._load = originalLoad;

const originalJwtSecret = process.env.JWT_SECRET;

test.before(() => {
  process.env.JWT_SECRET = 'file-access-tests-secret';
});

test.after(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

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

test('reviewers can access file previews only for submissions assigned to them', async () => {
  state.assignedReviewerId = 'reviewer-1';
  const allowedResponse = response();
  await fileController.createFilePreviewToken({
    user: { id: 'reviewer-1', role: 'reviewer' },
    params: { fileId: '1' },
  }, allowedResponse);
  assert.equal(allowedResponse.statusCode, 200);
  assert.equal(typeof allowedResponse.body.token, 'string');

  const deniedResponse = response();
  await fileController.createFilePreviewToken({
    user: { id: 'reviewer-2', role: 'reviewer' },
    params: { fileId: '1' },
  }, deniedResponse);
  assert.equal(deniedResponse.statusCode, 403);
  assert.equal(deniedResponse.body.message, 'No tienes permiso para acceder a este archivo.');
});

test('reviewers can list files only for submissions assigned to them', async () => {
  state.assignedReviewerId = 'reviewer-1';
  const allowedResponse = response();
  await fileController.getFilesBySubmission({
    user: { id: 'reviewer-1', role: 'reviewer' },
    params: { submissionId: 'submission-1' },
  }, allowedResponse);
  assert.equal(allowedResponse.statusCode, 200);
  assert.equal(allowedResponse.body.files.length, 1);

  const deniedResponse = response();
  await fileController.getFilesBySubmission({
    user: { id: 'reviewer-2', role: 'reviewer' },
    params: { submissionId: 'submission-1' },
  }, deniedResponse);
  assert.equal(deniedResponse.statusCode, 404);
});
