const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const controllerPath = require.resolve('../src/controllers/messageController');
const state = {
  users: ['author-1', 'editor-1', 'reviewer-1', 'reviewer-2'],
  submissions: [{ id: 'submission-1', autor_id: 'author-1' }],
  assignments: [{ submission_id: 'submission-1', reviewer_id: 'reviewer-1' }],
  messages: [],
};

function hasSubmissionAccess(userId, role, submissionId) {
  const submission = state.submissions.find((item) => item.id === submissionId);
  if (!submission) return false;
  if (role === 'admin' || role === 'editor') return true;
  if (role === 'author') return submission.autor_id === userId;
  return role === 'reviewer' && state.assignments.some(
    (assignment) => assignment.submission_id === submissionId && assignment.reviewer_id === userId
  );
}

const db = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalizedSql.startsWith('select id from users where id = ?')) {
      return [[{ id: values[0] }].filter(() => state.users.includes(values[0]))];
    }
    if (normalizedSql.startsWith('select s.id from submissions s')) {
      const [submissionId, role, , userId, , reviewerId] = values;
      return [[{ id: submissionId }].filter(() => hasSubmissionAccess(userId, role, submissionId) && reviewerId === userId)];
    }
    if (normalizedSql.startsWith('insert into messages')) {
      const message = {
        id: state.messages.length + 1,
        sender_id: values[0],
        recipient_id: values[1],
        submission_id: values[2],
        subject: values[3],
        body: values[4],
        is_read: 0,
        sender_deleted_at: null,
        recipient_deleted_at: null,
        created_at: '2026-11-27 10:00:00',
      };
      state.messages.push(message);
      return [{ insertId: message.id }];
    }
    if (normalizedSql.startsWith('select m.id, m.subject as asunto')) {
      let selected = state.messages;
      if (normalizedSql.includes('where m.id = ?')) {
        selected = selected.filter((item) => String(item.id) === String(values[0]));
        if (normalizedSql.includes('m.sender_id = ?')) {
          const userId = values[1];
          const role = values[3];
          selected = selected.filter((item) => (
            item.sender_id === userId || item.recipient_id === userId ||
            hasSubmissionAccess(userId, role, item.submission_id)
          ));
        }
      } else if (normalizedSql.includes('where (')) {
        const userId = values[0];
        const role = values[4];
        selected = selected.filter((item) => (
          item.sender_id === userId || item.recipient_id === userId ||
          hasSubmissionAccess(userId, role, item.submission_id)
        ));
      }
      return [selected.map((item) => ({
        id: item.id,
        asunto: item.subject,
        contenido: item.body,
        remitenteId: item.sender_id,
        remitenteNombre: item.sender_id,
        destinatarioId: item.recipient_id,
        destinatarioNombre: item.recipient_id,
        fecha: item.created_at,
        leido: item.is_read,
        submissionId: item.submission_id,
      }))];
    }
    if (normalizedSql.startsWith('select id from messages where id = ?')) {
      return [[{ id: values[0] }].filter(() => state.messages.some((item) => String(item.id) === String(values[0])))];
    }
    if (normalizedSql.startsWith('select id, recipient_id, recipient_deleted_at from messages where id = ?')) {
      const item = state.messages.find((message) => String(message.id) === String(values[0]));
      return [[item ? { id: item.id, recipient_id: item.recipient_id } : undefined].filter(Boolean)];
    }
    if (normalizedSql.startsWith('update messages set is_read = 1')) {
      const item = state.messages.find((message) => String(message.id) === String(values[0]) && message.recipient_id === values[1]);
      if (item) item.is_read = 1;
      return [{ affectedRows: item ? 1 : 0 }];
    }
    throw new Error(`Consulta no contemplada en la prueba: ${normalizedSql}`);
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && parent.filename === controllerPath) return db;
  return originalLoad.call(this, request, parent, isMain);
};
const controller = require(controllerPath);
Module._load = originalLoad;

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function resetState() {
  state.messages = [];
}

test('sends a message when the sender can access its submission', async () => {
  resetState();
  const res = response();
  await controller.sendMessage({
    user: { id: 'author-1', role: 'author' },
    body: {
      recipientId: 'editor-1',
      subject: 'Consulta editorial',
      body: '¿Hay novedades?',
      submissionId: 'submission-1',
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.message.remitenteId, 'author-1');
  assert.equal(res.body.message.destinatarioId, 'editor-1');
  assert.equal(state.messages[0].submission_id, 'submission-1');
});

test('rejects sending a submission message without role-based access', async () => {
  resetState();
  const res = response();
  await controller.sendMessage({
    user: { id: 'reviewer-2', role: 'reviewer' },
    body: {
      recipientId: 'editor-1',
      subject: 'Consulta editorial',
      body: '¿Hay novedades?',
      submissionId: 'submission-1',
    },
  }, res);

  assert.equal(res.statusCode, 403);
  assert.equal(state.messages.length, 0);
});

test('rejects an invalid submission identifier instead of treating it as an unlinked message', async () => {
  resetState();
  const res = response();
  await controller.sendMessage({
    user: { id: 'author-1', role: 'author' },
    body: {
      recipientId: 'editor-1',
      subject: 'Consulta editorial',
      body: '¿Hay novedades?',
      submissionId: 1,
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(state.messages.length, 0);
});

test('lists participant messages and submission messages authorized for the user only', async () => {
  resetState();
  state.messages = [
    { id: 1, sender_id: 'author-1', recipient_id: 'editor-1', submission_id: null, subject: 'Propio', body: 'Uno', created_at: '2026-11-27', is_read: 0 },
    { id: 2, sender_id: 'reviewer-1', recipient_id: 'editor-1', submission_id: null, subject: 'Ajeno', body: 'Dos', created_at: '2026-11-27', is_read: 0 },
    { id: 3, sender_id: 'reviewer-1', recipient_id: 'editor-1', submission_id: 'submission-1', subject: 'Envío propio', body: 'Tres', created_at: '2026-11-27', is_read: 0 },
  ];
  const res = response();
  await controller.listMessages({ user: { id: 'author-1', role: 'author' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.messages.map((item) => item.id), [1, 3]);
});

test('marks a message read only for its recipient', async () => {
  resetState();
  state.messages = [{
    id: 7,
    sender_id: 'author-1',
    recipient_id: 'editor-1',
    submission_id: null,
    is_read: 0,
  }];
  const allowed = response();
  await controller.markMessageAsRead({ user: { id: 'editor-1' }, params: { id: '7' } }, allowed);
  assert.equal(allowed.statusCode, 200);
  assert.equal(state.messages[0].is_read, 1);

  const denied = response();
  await controller.markMessageAsRead({ user: { id: 'author-1' }, params: { id: '7' } }, denied);
  assert.equal(denied.statusCode, 403);
});

test('returns 403 when a user requests another users unrelated message', async () => {
  resetState();
  state.messages = [{
    id: 9,
    sender_id: 'reviewer-1',
    recipient_id: 'editor-1',
    submission_id: null,
    subject: 'Privado',
    body: 'Contenido',
    created_at: '2026-11-27',
    is_read: 0,
  }];
  const res = response();
  await controller.getMessage({ user: { id: 'author-1', role: 'author' }, params: { id: '9' } }, res);
  assert.equal(res.statusCode, 403);
});
