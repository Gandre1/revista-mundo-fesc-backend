const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');
const test = require('node:test');
const jwt = require('jsonwebtoken');

const authControllerPath = require.resolve('../src/controllers/authController');
const userControllerPath = require.resolve('../src/controllers/userController');
const state = {
  user: { id: 'user-1', email: 'ana@example.org', nombre: 'Ana', password: 'hashed:OldPass1!' },
  resetToken: null,
  sentMessages: [],
};
const db = {
  async query(sql, values = []) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalizedSql.startsWith('select id, nombre, email from users where email')) {
      return [[state.user && state.user.email === values[0] ? state.user : null].filter(Boolean)];
    }
    if (normalizedSql.startsWith('delete from password_reset_tokens where user_id = ? and token_hash')) {
      if (state.resetToken?.user_id === values[0] && state.resetToken.token_hash === values[1]) {
        state.resetToken = null;
      }
      return [{ affectedRows: 1 }];
    }
    if (normalizedSql.startsWith('delete from password_reset_tokens where user_id')) {
      state.resetToken = null;
      return [{ affectedRows: 1 }];
    }
    if (normalizedSql.startsWith('insert into password_reset_tokens')) {
      state.resetToken = {
        user_id: values[0],
        token_hash: values[1],
        expires_at: values[2],
      };
      return [{ affectedRows: 1 }];
    }
    if (normalizedSql.startsWith('select user_id from password_reset_tokens')) {
      const isUnexpired = state.resetToken && new Date(state.resetToken.expires_at) > new Date();
      return [[
        isUnexpired && state.resetToken.token_hash === values[0]
          ? { user_id: state.resetToken.user_id }
          : null,
      ].filter(Boolean)];
    }
    if (normalizedSql.startsWith('delete from password_reset_tokens where token_hash')) {
      const isUnexpired = state.resetToken && new Date(state.resetToken.expires_at) > new Date();
      if (isUnexpired && state.resetToken.token_hash === values[0]) {
        state.resetToken = null;
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    }
    if (normalizedSql.startsWith('update users set password')) {
      if (state.user?.id === values[1]) {
        state.user.password = values[0];
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    }
    if (normalizedSql.startsWith('select password from users where id')) {
      return [[state.user?.id === values[0] ? { password: state.user.password } : null].filter(Boolean)];
    }
    throw new Error(`Consulta no contemplada en la prueba: ${normalizedSql}`);
  },
};
const emailService = {
  async sendPasswordResetEmail(to, name, url) {
    state.sentMessages.push({ to, name, url });
  },
};
const bcrypt = {
  async compare(password, hashedPassword) {
    return hashedPassword === `hashed:${password}`;
  },
  async hash(password) {
    return `hashed:${password}`;
  },
  async genSalt() {
    return 'test-salt';
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && [authControllerPath, userControllerPath].includes(parent.filename)) {
    return db;
  }
  if (request === '../services/emailService' && parent.filename === authControllerPath) {
    return emailService;
  }
  if (request === 'bcryptjs' && [authControllerPath, userControllerPath].includes(parent.filename)) {
    return bcrypt;
  }
  return originalLoad.call(this, request, parent, isMain);
};
const authController = require(authControllerPath);
const userController = require(userControllerPath);
Module._load = originalLoad;

const originalFrontendUrl = process.env.FRONTEND_URL;
process.env.FRONTEND_URL = 'https://journal.example.org';

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

function resetState() {
  state.user = { id: 'user-1', email: 'ana@example.org', nombre: 'Ana', password: 'hashed:OldPass1!' };
  state.resetToken = null;
  state.sentMessages = [];
}

test('forgot-password returns a generic response and mails only known accounts', async () => {
  resetState();
  const unknownResponse = response();
  await authController.forgotPassword({ body: { email: 'missing@example.org' } }, unknownResponse);
  assert.equal(unknownResponse.statusCode, 200);
  assert.equal(state.sentMessages.length, 0);

  const knownResponse = response();
  await authController.forgotPassword({ body: { email: ' ANA@EXAMPLE.ORG ' } }, knownResponse);

  assert.equal(knownResponse.statusCode, 200);
  assert.equal(knownResponse.body.message, unknownResponse.body.message);
  assert.equal(state.sentMessages.length, 1);
  assert.equal(state.sentMessages[0].to, 'ana@example.org');
  const resetToken = new URL(state.sentMessages[0].url).searchParams.get('token');
  assert.match(resetToken, /^[a-f0-9]{64}$/);
  assert.equal(state.resetToken.token_hash, crypto.createHash('sha256').update(resetToken).digest('hex'));
  assert.notEqual(state.resetToken.token_hash, resetToken);
});

test('reset-password validates requirements and consumes a valid token once', async () => {
  resetState();
  const weakPasswordResponse = response();
  await authController.resetPassword({ body: { token: 'token', password: 'weak' } }, weakPasswordResponse);
  assert.equal(weakPasswordResponse.statusCode, 400);
  assert.equal(state.resetToken, null);

  await authController.forgotPassword({ body: { email: state.user.email } }, response());
  const token = new URL(state.sentMessages[0].url).searchParams.get('token');

  const resetResponse = response();
  await authController.resetPassword({ body: { token, password: 'NewPass2!' } }, resetResponse);
  assert.equal(resetResponse.statusCode, 200);
  assert.equal(state.user.password, 'hashed:NewPass2!');
  assert.equal(state.resetToken, null);

  const reusedTokenResponse = response();
  await authController.resetPassword({ body: { token, password: 'OtherPass3!' } }, reusedTokenResponse);
  assert.equal(reusedTokenResponse.statusCode, 400);
  assert.equal(state.user.password, 'hashed:NewPass2!');
});

test('reset-password rejects expired tokens', async () => {
  resetState();
  const token = 'a'.repeat(64);
  state.resetToken = {
    user_id: state.user.id,
    token_hash: crypto.createHash('sha256').update(token).digest('hex'),
    expires_at: new Date(Date.now() - 1000),
  };
  const res = response();

  await authController.resetPassword({ body: { token, password: 'NewPass2!' } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(state.user.password, 'hashed:OldPass1!');
});

test('change-password verifies the current password and hashes the new one', async () => {
  resetState();
  const wrongPasswordResponse = response();
  await userController.changePassword({
    user: { id: state.user.id },
    body: { currentPassword: 'wrong', newPassword: 'NewPass2!' },
  }, wrongPasswordResponse);
  assert.equal(wrongPasswordResponse.statusCode, 400);
  assert.equal(state.user.password, 'hashed:OldPass1!');

  const successResponse = response();
  await userController.changePassword({
    user: { id: state.user.id },
    body: { currentPassword: 'OldPass1!', newPassword: 'NewPass2!' },
  }, successResponse);
  assert.equal(successResponse.statusCode, 200);
  assert.equal(state.user.password, 'hashed:NewPass2!');
});

test('expired JWTs return HTTP 401', () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'password-endpoint-test-secret';
  const middlewarePath = require.resolve('../src/middlewares/authMiddleware');
  delete require.cache[middlewarePath];
  const authenticateToken = require(middlewarePath);
  const expiredToken = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET, { expiresIn: -1 });
  const res = response();

  authenticateToken({ headers: { authorization: `Bearer ${expiredToken}` } }, res, () => {
    assert.fail('El token expirado no debe autenticarse.');
  });

  assert.equal(res.statusCode, 401);
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
  delete require.cache[middlewarePath];
});

test.after(() => {
  if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = originalFrontendUrl;
});
