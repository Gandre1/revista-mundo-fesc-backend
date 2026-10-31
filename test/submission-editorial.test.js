const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const controllerPath = require.resolve('../src/controllers/submissionController');
const state = {
  calls: [],
  editors: [{ id: 'editor-1', nombre: 'Editora FESC' }],
  reviewers: [{ id: 'reviewer-1', reviewer_nombre: 'Revisor FESC' }],
  listRows: [],
  listTotal: 0,
  stats: {
    total: 10,
    nuevos: 2,
    en_revision: 2,
    ajustes_solicitados: 1,
    aceptados: 2,
    rechazados: 1,
    publicados: 2,
  },
  submissionExists: true,
  issueExists: true,
  issueAssignment: null,
  reviewAssignment: null,
  auditLogs: [],
  submission: {
    id: 'submission-1',
    autor_id: 'author-1',
    estado: 'enviado',
    issue_id: null,
    editor_id: null,
    editor_nombre: null,
    comentarios_editor: null,
    doi: null,
    pdf_galley_url: null,
    html_galley_url: null,
  },
};

const db = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    state.calls.push({ sql: normalizedSql, values });

    if (normalizedSql.startsWith('select count(*) as total from submissions s')) {
      return [[{ total: state.listTotal }]];
    }

    if (normalizedSql.startsWith('select count(*) as total, count(case when')) {
      return [[{ ...state.stats }]];
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

    if (normalizedSql === 'select id, estado, issue_id from submissions where id = ?') {
      return [state.submissionExists ? [{ id: values[0], estado: state.submission.estado, issue_id: state.submission.issue_id }] : []];
    }

    if (normalizedSql === 'select id, volume, number, year, title from issues where id = ?') {
      return [state.issueExists ? [{ id: values[0], volume: 1, number: 1, year: 2026, title: 'Volumen inaugural' }] : []];
    }

    if (normalizedSql.startsWith('insert into submission_audit_logs')) {
      state.auditLogs.push({
        submission_id: values[0],
        user_id: values[1],
        action: values[2],
        description: values[3],
      });
      return [{ affectedRows: 1 }];
    }

    if (normalizedSql.startsWith('select s.autor_id, s.editor_id, sr.reviewer_id')) {
      return [[{ autor_id: state.submission.autor_id || null, editor_id: state.submission.editor_id || null, reviewer_id: null }]];
    }

    if (normalizedSql.startsWith('insert into notifications')) {
      return [{ insertId: 1, affectedRows: 1 }];
    }

    if (normalizedSql.startsWith('select audit.id, audit.submission_id, audit.user_id')) {
      return [state.auditLogs];
    }

    if (normalizedSql.startsWith('update submissions set ')) {
      if (normalizedSql.includes('estado = ?')) {
        state.submission.estado = values[0];
      }
      let metadataIndex = 0;
      if (normalizedSql.includes('doi = ?')) {
        state.submission.doi = values[metadataIndex++];
      }
      if (normalizedSql.includes('pdf_galley_url = ?')) {
        state.submission.pdf_galley_url = values[metadataIndex++];
      }
      if (normalizedSql.includes('html_galley_url = ?')) {
        state.submission.html_galley_url = values[metadataIndex++];
      }
      if (normalizedSql.includes('editor_id = ?')) {
        state.submission.editor_id = values[normalizedSql.includes('estado = ?') ? 1 : 0];
        state.submission.editor_nombre = state.submission.editor_id ? 'Editora FESC' : null;
      }
      if (normalizedSql.includes('comentarios_editor = ?')) {
        state.submission.comentarios_editor = values[values.length - 2];
      }
      if (normalizedSql === 'update submissions set issue_id = ? where id = ?') {
        state.issueAssignment = { issue_id: values[0], submission_id: values[1] };
        state.submission.issue_id = values[0];
      }
      return [{ affectedRows: 1 }];
    }

    if (normalizedSql === 'select id, doi, pdf_galley_url, html_galley_url from submissions where id = ?') {
      return [[{ ...state.submission }]];
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
  state.editors = [{ id: 'editor-1', nombre: 'Editora FESC' }];
  state.reviewers = [{ id: 'reviewer-1', reviewer_nombre: 'Revisor FESC' }];
  state.listRows = [];
  state.listTotal = 0;
  state.stats = {
    total: 10,
    nuevos: 2,
    en_revision: 2,
    ajustes_solicitados: 1,
    aceptados: 2,
    rechazados: 1,
    publicados: 2,
  };
  state.submissionExists = true;
  state.issueExists = true;
  state.issueAssignment = null;
  state.reviewAssignment = null;
  state.auditLogs = [];
  state.submission = {
    id: 'submission-1',
    autor_id: 'author-1',
    estado: 'enviado',
    issue_id: null,
    editor_id: null,
    editor_nombre: null,
    comentarios_editor: null,
    doi: null,
    pdf_galley_url: null,
    html_galley_url: null,
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

test('returns submission counts and percentages by editorial status', async () => {
  resetState();
  const res = response();

  await controller.getSubmissionStats({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    total: 10,
    estados: {
      nuevos: { conteo: 2, porcentaje: 20 },
      en_revision: { conteo: 2, porcentaje: 20 },
      ajustes_solicitados: { conteo: 1, porcentaje: 10 },
      aceptados: { conteo: 2, porcentaje: 20 },
      rechazados: { conteo: 1, porcentaje: 10 },
      publicados: { conteo: 2, porcentaje: 20 },
    },
  });
  assert.match(state.calls[0].sql, /from submissions$/);
  assert.match(state.calls[0].sql, /count\(case when/);
});

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

  await controller.updateSubmissionStatus({
    ...request({ estado: ' Evaluated ' }),
    user: { id: 'editor-user-1' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.submission.estado, 'evaluado');
  assert.equal(res.body.submissionId, 'submission-1');
  assert.ok(state.calls.some(({ sql }) => sql.startsWith('update submissions set estado = ?')));
  assert.deepEqual(state.auditLogs, [{
    submission_id: 'submission-1',
    user_id: 'editor-user-1',
    action: 'status_updated',
    description: 'Estado actualizado a evaluado.',
  }]);
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
  assert.equal(state.auditLogs.length, 2);
  assert.equal(state.auditLogs[0].action, 'editor_assigned');
  assert.equal(state.auditLogs[0].description, 'Editor Editora FESC asignado.');
  assert.equal(state.auditLogs[1].description, 'Editor desasignado.');
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

test('assigns accepted submissions to issues and rejects non-publishable states', async () => {
  resetState();
  state.submission.estado = 'aceptado';
  const acceptedResponse = response();

  await controller.assignSubmissionIssue(
    { ...request({ issue_id: 3 }), user: { id: 'editor-user-1' } },
    acceptedResponse
  );

  assert.equal(acceptedResponse.statusCode, 200);
  assert.deepEqual(state.issueAssignment, {
    issue_id: 3,
    submission_id: 'submission-1',
  });
  assert.equal(state.auditLogs[0].action, 'issue_assigned');
  assert.match(
    state.auditLogs[0].description,
    /Volumen asignado: Volumen 1 · Número 1 · Año 2026/
  );

  await controller.assignSubmissionIssue(
    { ...request({ issue_id: 3 }), user: { id: 'editor-user-1' } },
    response()
  );
  assert.equal(state.auditLogs.length, 1, 'no debe registrar asignaciones duplicadas del mismo volumen');

  resetState();
  state.submission.estado = 'en_revision';
  const rejectedResponse = response();
  await controller.assignSubmissionIssue(request({ issue_id: 3 }), rejectedResponse);

  assert.equal(rejectedResponse.statusCode, 409);
  assert.equal(state.issueAssignment, null);
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
  assert.equal(state.auditLogs[0].action, 'reviewer_assigned');
  assert.equal(state.auditLogs[0].description, 'Revisor Revisor FESC asignado con fecha límite 2026-11-20.');
});

test('returns a submission audit history in chronological order', async () => {
  resetState();
  state.auditLogs = [{
    id: 1,
    action: 'status_updated',
    description: 'Estado actualizado a aceptado.',
    user_nombre: 'Editora FESC',
    created_at: '2026-01-01 10:00:00',
  }];
  const res = response();

  await controller.getSubmissionAuditLogs(request(), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.auditLogs, state.auditLogs);
  assert.match(state.calls[1].sql, /left join users actor/);
  assert.match(state.calls[1].sql, /locate\(target\.id, audit\.description\)/);
  assert.match(state.calls[1].sql, /order by audit\.created_at asc, audit\.id asc/);
});

test('returns 404 when requesting the audit history of a missing submission', async () => {
  resetState();
  state.submissionExists = false;
  const res = response();

  await controller.getSubmissionAuditLogs(request(), res);

  assert.equal(res.statusCode, 404);
  assert.equal(state.calls.length, 1);
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

test('saves publication DOI and PDF/HTML galley URLs', async () => {
  resetState();
  const res = response();

  await controller.updatePublicationMetadata({
    ...request({
      doi: '10.1234/fesc.2026.001',
      pdf_galley_url: 'https://revista.example.org/articles/001.pdf',
      html_galley_url: 'https://revista.example.org/articles/001',
    }),
    user: { id: 'editor-user-1', role: 'editor' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(state.submission.doi, '10.1234/fesc.2026.001');
  assert.equal(state.submission.pdf_galley_url, 'https://revista.example.org/articles/001.pdf');
  assert.equal(state.submission.html_galley_url, 'https://revista.example.org/articles/001');
  assert.equal(res.body.submission.doi, '10.1234/fesc.2026.001');
  assert.ok(state.calls.some(({ sql }) =>
    sql.startsWith('update submissions set doi = ?') &&
    sql.includes('pdf_galley_url = ?') &&
    sql.includes('html_galley_url = ?')
  ));
  assert.equal(state.auditLogs.at(-1).action, 'metadata_updated');
  assert.ok(state.calls.some(({ sql }) => sql.startsWith('insert into notifications')));
});

test('rejects invalid publication galley URLs', async () => {
  resetState();
  const res = response();

  await controller.updatePublicationMetadata(
    request({ pdf_galley_url: 'ftp://revista.example.org/article.pdf' }),
    res
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /URL HTTP o HTTPS válida/);
  assert.equal(state.calls.length, 0);
});
