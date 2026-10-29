const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const controllerPath = require.resolve('../src/controllers/notificationController');
const state = {
  notifications: [],
  calls: [],
};

const db = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    state.calls.push({ sql: normalizedSql, values });

    if (normalizedSql.startsWith('insert into notifications')) {
      const notification = {
        id: state.notifications.length + 1,
        user_id: values[0],
        submission_id: values[1],
        title: values[2],
        message: values[3],
        is_read: 0,
        created_at: '2026-10-28 10:00:00',
      };
      state.notifications.push(notification);
      return [{ insertId: notification.id }];
    }
    if (normalizedSql.startsWith('select id from notifications where id = ? and user_id = ?')) {
      return [state.notifications.filter((item) => String(item.id) === String(values[0]) && item.user_id === values[1])];
    }
    if (normalizedSql.startsWith('update notifications set is_read = 1')) {
      const notification = state.notifications.find((item) => String(item.id) === String(values[0]) && item.user_id === values[1]);
      if (notification) notification.is_read = 1;
      return [{ affectedRows: notification ? 1 : 0 }];
    }
    if (normalizedSql.startsWith('select id, user_id, submission_id')) {
      return [state.notifications.filter((item) => item.user_id === values[0]).reverse()];
    }
    if (normalizedSql.startsWith('delete from notifications where id = ? and user_id = ?')) {
      const initialLength = state.notifications.length;
      state.notifications = state.notifications.filter((item) => !(String(item.id) === String(values[0]) && item.user_id === values[1]));
      return [{ affectedRows: initialLength - state.notifications.length }];
    }
    if (normalizedSql.startsWith('delete from notifications where user_id = ?')) {
      const initialLength = state.notifications.length;
      state.notifications = state.notifications.filter((item) => item.user_id !== values[0]);
      return [{ affectedRows: initialLength - state.notifications.length }];
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
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function resetState() {
  state.notifications = [];
  state.calls = [];
}

test('creates a notification for a submission user', async () => {
  resetState();
  await controller.createNotification({
    userId: 'author-1',
    submissionId: 'submission-1',
    title: 'Estado actualizado',
    message: 'Tu envío fue aceptado.',
  });
  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].user_id, 'author-1');
  assert.equal(state.notifications[0].submission_id, 'submission-1');
  assert.equal(state.notifications[0].is_read, 0);
});

test('lists notifications only for the authenticated user', async () => {
  resetState();
  state.notifications = [
    { id: 1, user_id: 'author-1', submission_id: 'submission-1', title: 'Aviso', message: 'Mensaje', is_read: 0, created_at: '2026-10-28 09:00:00' },
    { id: 2, user_id: 'editor-1', submission_id: 'submission-2', title: 'Otro', message: 'Mensaje', is_read: 0, created_at: '2026-10-28 09:30:00' },
  ];
  const res = response();
  await controller.listNotifications({ user: { id: 'author-1' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.notifications.length, 1);
  assert.equal(res.body.notifications[0].user_id, 'author-1');
});

test('marks an owned notification as read', async () => {
  resetState();
  state.notifications = [{ id: 7, user_id: 'author-1', submission_id: 'submission-1', title: 'Aviso', message: 'Mensaje', is_read: 0, created_at: '2026-10-28 09:00:00' }];
  const res = response();
  await controller.markNotificationAsRead({ user: { id: 'author-1' }, params: { id: '7' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(state.notifications[0].is_read, 1);
});

test('returns 404 when the notification does not belong to the user', async () => {
  resetState();
  const res = response();
  await controller.markNotificationAsRead({ user: { id: 'author-1' }, params: { id: '99' } }, res);
  assert.equal(res.statusCode, 404);
});

test('deletes only the owned notification', async () => {
  resetState();
  state.notifications = [
    { id: 1, user_id: 'author-1', submission_id: null, title: 'Aviso', message: 'Mensaje', is_read: 0, created_at: '2026-10-28 09:00:00' },
    { id: 2, user_id: 'editor-1', submission_id: null, title: 'Aviso', message: 'Mensaje', is_read: 0, created_at: '2026-10-28 09:30:00' },
  ];
  const res = response();
  await controller.deleteNotification({ user: { id: 'author-1' }, params: { id: '1' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].user_id, 'editor-1');
});

test('clears notifications only for the authenticated user', async () => {
  resetState();
  state.notifications = [
    { id: 1, user_id: 'author-1', submission_id: null, title: 'Aviso', message: 'Mensaje', is_read: 0, created_at: '2026-10-28 09:00:00' },
    { id: 2, user_id: 'editor-1', submission_id: null, title: 'Aviso', message: 'Mensaje', is_read: 0, created_at: '2026-10-28 09:30:00' },
  ];
  const res = response();
  await controller.clearNotifications({ user: { id: 'author-1' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.deleted, 1);
  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].user_id, 'editor-1');
});
