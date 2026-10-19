const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const controllerPath = require.resolve('../src/controllers/submissionController');
const state = {
  calls: [],
  editors: [{ id: 'editor-1' }],
  listRows: [],
  submissionExists: true,
  submission: {
    id: 'submission-1',
    estado: 'enviado',
    editor_id: null,
    editor_nombre: null,
  },
};

const db = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    state.calls.push({ sql: normalizedSql, values });

    if (normalizedSql.includes('left join users author')) {
      return [state.listRows];
    }

    if (normalizedSql.includes("from users where id = ? and role = 'editor'")) {
      return [state.editors.filter((editor) => editor.id === values[0])];
    }

    if (normalizedSql === 'select id from submissions where id = ?') {
      return [state.submissionExists ? [{ id: values[0] }] : []];
    }

    if (normalizedSql.startsWith('update submissions set ')) {
      if (normalizedSql.includes('estado = ?')) {
        state.submission.estado = values[0];
      }
      if (normalizedSql.includes('editor_id = ?')) {
        state.submission.editor_id = values[normalizedSql.includes('estado = ?') ? 1 : 0];
        state.submission.editor_nombre = state.submission.editor_id ? 'Editora FESC' : null;
      }
      return [{ affectedRows: 1 }];
    }

    if (normalizedSql.startsWith('select s.id, s.estado, s.editor_id')) {
      return [[{ ...state.submission }]];
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

function resetState() {
  state.calls = [];
  state.editors = [{ id: 'editor-1' }];
  state.listRows = [];
  state.submissionExists = true;
  state.submission = {
    id: 'submission-1',
    estado: 'enviado',
    editor_id: null,
    editor_nombre: null,
  };
}

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

function request(body = {}) {
  return { params: { id: 'submission-1' }, body };
}

test('returns the complete editorial list with author and editor relations', async () => {
  resetState();
  state.listRows = [{ id: 'submission-1', palabras_clave: 'revistas', editor_id: null }];
  const res = response();

  await controller.getAllSubmissions({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.submissions, state.listRows);
  assert.match(state.calls[0].sql, /left join users author/);
  assert.match(state.calls[0].sql, /left join users editor/);
  assert.match(state.calls[0].sql, /s\.palabras_clave/);
  assert.match(state.calls[0].sql, /s\.estado/);
});

test('updates an editorial status and returns the updated submission', async () => {
  resetState();
  const res = response();

  await controller.updateSubmissionStatus(request({ estado: ' Evaluated ' }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.submission.estado, 'evaluado');
  assert.equal(res.body.submissionId, 'submission-1');
  assert.ok(state.calls.some(({ sql }) => sql.startsWith('update submissions set estado = ?')));
});

test('rejects invalid editorial statuses with HTTP 400', async () => {
  resetState();
  const res = response();

  await controller.updateSubmissionStatus(request({ estado: 'unknown' }), res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /estado/);
  assert.equal(state.calls.length, 0);
});

test('assigns and unassigns valid editors', async () => {
  resetState();
  let res = response();

  await controller.assignSubmissionEditor(request({ editor_id: 'editor-1' }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.submission.editor_id, 'editor-1');
  assert.equal(res.body.submission.editor_nombre, 'Editora FESC');

  res = response();
  await controller.assignSubmissionEditor(request({ editor_id: null }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.submission.editor_id, null);
});

test('rejects non-editor assignments and reports missing submissions', async () => {
  resetState();
  const invalidEditorResponse = response();

  await controller.assignSubmissionEditor(request({ editor_id: 'author-1' }), invalidEditorResponse);

  assert.equal(invalidEditorResponse.statusCode, 400);

  resetState();
  state.submissionExists = false;
  const missingSubmissionResponse = response();

  await controller.updateSubmissionStatus(request({ estado: 'aceptado' }), missingSubmissionResponse);

  assert.equal(missingSubmissionResponse.statusCode, 404);
});
