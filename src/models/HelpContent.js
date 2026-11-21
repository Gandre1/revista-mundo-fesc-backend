const db = require('../config/db');

const columns = `id, title, slug, category, content_type, audience, content,
                 display_order, is_active, created_at, updated_at`;

const buildFilters = (filters = {}) => {
  const conditions = [];
  const values = [];
  for (const field of ['content_type', 'category', 'audience']) {
    if (filters[field] !== undefined) {
      conditions.push(`${field} = ?`);
      values.push(filters[field]);
    }
  }
  return { conditions, values };
};

exports.listActive = async (filters) => {
  const { conditions, values } = buildFilters(filters);
  conditions.push('is_active = 1');
  const [items] = await db.query(
    `SELECT ${columns}
     FROM help_contents
     WHERE ${conditions.join(' AND ')}
     ORDER BY display_order ASC, id ASC`,
    values
  );
  return items;
};

exports.listAll = async (filters) => {
  const { conditions, values } = buildFilters(filters);
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [items] = await db.query(
    `SELECT ${columns}
     FROM help_contents
     ${whereClause}
     ORDER BY display_order ASC, id ASC`,
    values
  );
  return items;
};

exports.findActiveBySlug = async (slug) => {
  const [items] = await db.query(
    `SELECT ${columns}
     FROM help_contents
     WHERE slug = ? AND is_active = 1
     LIMIT 1`,
    [slug]
  );
  return items[0] || null;
};

exports.create = async (item) => {
  const [result] = await db.query(
    `INSERT INTO help_contents
      (title, slug, category, content_type, audience, content, display_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.title,
      item.slug,
      item.category,
      item.content_type,
      item.audience,
      item.content,
      item.display_order,
      item.is_active,
    ]
  );
  return result.insertId;
};

exports.update = async (id, item) => {
  const [result] = await db.query(
    `UPDATE help_contents
     SET title = ?, slug = ?, category = ?, content_type = ?, audience = ?,
         content = ?, display_order = ?, is_active = ?
     WHERE id = ?`,
    [
      item.title,
      item.slug,
      item.category,
      item.content_type,
      item.audience,
      item.content,
      item.display_order,
      item.is_active,
      id,
    ]
  );
  return result.affectedRows;
};

exports.delete = async (id) => {
  const [result] = await db.query('DELETE FROM help_contents WHERE id = ?', [id]);
  return result.affectedRows;
};

exports.findById = async (id) => {
  const [items] = await db.query(
    `SELECT ${columns}
     FROM help_contents
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return items[0] || null;
};
