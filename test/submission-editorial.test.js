const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const controllerPath = require.resolve('../src/controllers/submissionController');
const state = {
  calls: [],
  editors: [{ id: 'editor-1' }],
  reviewers: [{ id: 'reviewer-1' }],
  listRows: [],
  listTotal: 0,
  submissionExists: true,
  reviewAssignment: null,
  submission: {
    id: 'submission-1',
    estado: 'enviado',
    editor_id: null,
    editor_nombre: null,
    comentarios_editor: null,
  },
};

const db = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    state.calls.push({ sql: normalizedSql, values });

    if (normalizedSql.startsWith('select count(*) as total from submissions s')) {
      return [[{ total: state.listTotal }]];
    }

    if (normalizedSql.includes('left join users author')) {
      return [state.listRows];
    }

    if (normalizedSql.includes("from users where id = ? and role = 'editor'")) {
      return [state.editors.filter((editor) => editor.id === values[0])];
    }

    if (normalizedSql.includes("from users where id = ? and role = 'reviewer'")) {
      return [state.reviewers.filter((reviewer) => reviewer.id === values[0])];
    }

    if (normalizedSql.includes("from users where role = 'reviewer'")) {
      return [state.reviewers];
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
      if (normalizedSql.includes('comentarios_editor = ?')) {
        state.submission.comentarios_editor = values[values.length - 2];
      }
      return [{ affectedRows: 1 }];
    }

    if (normalizedSql.startsWith('select s.id, s.estado, s.editor_id')) {
      return [[{ ...state.submission }]];
    }

    if (normalizedSql.startsWith('insert into submission_reviews')) {
      state.reviewAssignment = {
        submission_id: values[0],
        reviewer_id: values[1],
        fecha_limite: values[2],
      };
      return [{ affectedRows: 1 }];
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
  state.reviewers = [{ id: 'reviewer-1' }];
  state.listRows = [];
  state.listTotal = 0;
  state.submissionExists = true;
  state.reviewAssignment = null;
  state.submission = {
    id: 'submission-1',
    estado: 'enviado',
    editor_id: null,
    editor_nombre: null,
    comentarios_editor: null,
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

test('returns the complete editorial list and pagination metadata', async () => {
  resetState();
  state.listRows = [{ id: 'submission-1', palabras_clave: 'revistas', editor_id: null }];
  state.listTotal = 1;
  const res = response();

  await controller.getAllSubmissions({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.submissions, state.listRows);
  assert.deepEqual(res.body.pagination, { page: 1, limit: 1, total: 1, totalPages: 1 });
  assert.match(state.calls[1].sql, /left join users author/);
  assert.match(state.calls[1].sql, /left join users editor/);
  assert.match(state.calls[1].sql, /s\.palabras_clave/);
  assert.match(state.calls[1].sql, /s\.estado/);
});

test('paginates and sorts editorial submissions with validated parameters', async () => {
  resetState();
  state.listRows = [{ id: 'submission-1' }];
  state.listTotal = 21;
  const res = response();

  await controller.getAllSubmissions({ query: { page: '2', limit: '10', sortBy: 'titulo', order: 'asc' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.pagination, { page: 2, limit: 10, total: 21, totalPages: 3 });
  assert.match(state.calls[1].sql, /order by s\.titulo asc limit \? offset \?$/);
  assert.deepEqual(state.calls[1].values, [10, 10]);
});

test('applies search and status filters to both the result count and page query', async () => {
  resetState();
  state.listTotal = 1;
  const res = response();

  await controller.getAllSubmissions({
    query: { page: '1', limit: '10', search: 'artículo', status: 'enviado' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(state.calls[0].values[0], '%artículo%');
  assert.equal(state.calls[0].values[1], '%artículo%');
  assert.deepEqual(state.calls[0].values.slice(2), ['enviado', 'submitted', 'recibido']);
  assert.deepEqual(state.calls[1].values, [
    '%artículo%',
    '%artículo%',
    'enviado',
    'submitted',
    'recibido',
    10,
    0,
  ]);
});

test('rejects invalid pagination and sorting parameters', async () => {
  resetState();
  const invalidPagination = response();
  await controller.getAllSubmissions({ query: { page: '0' } }, invalidPagination);
  assert.equal(invalidPagination.statusCode, 400);

  const invalidSorting = response();
  await controller.getAllSubmissions({ query: { sortBy: 'id; DROP TABLE submissions' } }, invalidSorting);
  assert.equal(invalidSorting.statusCode, 400);
  assert.equal(state.calls.length, 0);
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

test('saves optional editorial comments with a status decision', async () => {
  resetState();
  const res = response();

  await controller.updateSubmissionStatus(request({
    estado: 'revisiones_requeridas',
    comentarios_editor: '  Aclare la metodología.  ',
  }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(state.submission.estado, 'revisiones_requeridas');
  assert.equal(state.submission.comentarios_editor, 'Aclare la metodología.');
  assert.ok(state.calls.some(({ sql }) => sql.includes('comentarios_editor = ?')));
});

test('rejects non-text editorial comments', async () => {
  resetState();
  const res = response();

  await controller.updateSubmissionStatus(request({ estado: 'aceptado', comentarios_editor: 42 }), res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /comentarios/);
  assert.equal(state.calls.length, 0);
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

test('returns the available reviewers', async () => {
  resetState();
  const res = response();

  await controller.getReviewers({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.reviewers, state.reviewers);
  assert.match(state.calls[0].sql, /where role = 'reviewer'/);
});

test('assigns a reviewer with a valid deadline', async () => {
  resetState();
  const res = response();

  await controller.assignSubmissionReviewer(
    request({ reviewer_id: 'reviewer-1', fecha_limite: '2026-11-20' }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.submissionId, 'submission-1');
  assert.deepEqual(state.reviewAssignment, {
    submission_id: 'submission-1',
    reviewer_id: 'reviewer-1',
    fecha_limite: '2026-11-20',
  });
});

test('rejects invalid reviewer IDs and calendar dates', async () => {
  resetState();
  const invalidReviewerResponse = response();

  await controller.assignSubmissionReviewer(
    request({ reviewer_id: 'unknown', fecha_limite: '2026-11-20' }),
    invalidReviewerResponse
  );

  assert.equal(invalidReviewerResponse.statusCode, 400);
  assert.equal(state.reviewAssignment, null);

  resetState();
  const invalidDateResponse = response();
  await controller.assignSubmissionReviewer(
    request({ reviewer_id: 'reviewer-1', fecha_limite: '2026-02-30' }),
    invalidDateResponse
  );

  assert.equal(invalidDateResponse.statusCode, 400);
  assert.equal(state.calls.length, 0);
});
