const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3456;
const db = initDatabase();

// Simple session store (in-memory)
const sessions = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth Middleware ──────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.admin = sessions.get(token);
  next();
}

// ── Admin Auth ──────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { id: user.id, username: user.username });
  res.json({ token, username: user.username });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const token = req.headers['x-admin-token'];
  sessions.delete(token);
  res.json({ ok: true });
});

app.get('/api/admin/check', requireAdmin, (req, res) => {
  res.json({ authenticated: true, username: req.admin.username });
});

// ── Ideas CRUD ──────────────────────────────────────────────────
app.get('/api/ideas', (req, res) => {
  const { status, search } = req.query;
  let sql = 'SELECT * FROM ideas';
  const params = [];
  const conditions = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC';

  const ideas = db.prepare(sql).all(...params);

  // Attach comment count and NPS summary
  const commentCountStmt = db.prepare('SELECT COUNT(*) as count FROM comments WHERE idea_id = ?');
  const npsStmt = db.prepare('SELECT AVG(score) as avg_score, COUNT(*) as vote_count FROM nps_scores WHERE idea_id = ?');

  const enriched = ideas.map(idea => {
    const cc = commentCountStmt.get(idea.id);
    const nps = npsStmt.get(idea.id);
    return {
      ...idea,
      comment_count: cc.count,
      nps_avg: nps.avg_score ? Math.round(nps.avg_score * 10) / 10 : null,
      nps_votes: nps.vote_count
    };
  });

  res.json(enriched);
});

app.get('/api/ideas/:id', (req, res) => {
  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });

  const comments = db.prepare('SELECT * FROM comments WHERE idea_id = ? ORDER BY created_at ASC').all(req.params.id);
  const nps = db.prepare('SELECT AVG(score) as avg_score, COUNT(*) as vote_count FROM nps_scores WHERE idea_id = ?').get(req.params.id);
  const npsDistribution = db.prepare('SELECT score, COUNT(*) as count FROM nps_scores WHERE idea_id = ? GROUP BY score ORDER BY score').all(req.params.id);

  res.json({
    ...idea,
    comments,
    nps_avg: nps.avg_score ? Math.round(nps.avg_score * 10) / 10 : null,
    nps_votes: nps.vote_count,
    nps_distribution: npsDistribution
  });
});

app.post('/api/ideas', (req, res) => {
  const { title, description, event_date, event_place, details, author_name } = req.body;
  if (!title || !description || !author_name) {
    return res.status(400).json({ error: 'Title, description, and author name are required' });
  }
  const result = db.prepare(
    'INSERT INTO ideas (title, description, event_date, event_place, details, author_name) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title, description, event_date || null, event_place || null, details || null, author_name);

  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(idea);
});

app.put('/api/ideas/:id', requireAdmin, (req, res) => {
  const { title, description, event_date, event_place, details, status } = req.body;
  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });

  db.prepare(`
    UPDATE ideas SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      event_date = COALESCE(?, event_date),
      event_place = COALESCE(?, event_place),
      details = COALESCE(?, details),
      status = COALESCE(?, status),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(title, description, event_date, event_place, details, status, req.params.id);

  const updated = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.delete('/api/ideas/:id', requireAdmin, (req, res) => {
  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });
  db.prepare('DELETE FROM ideas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Comments ────────────────────────────────────────────────────
app.post('/api/ideas/:id/comments', (req, res) => {
  const { author_name, content } = req.body;
  if (!author_name || !content) {
    return res.status(400).json({ error: 'Author name and content are required' });
  }
  const idea = db.prepare('SELECT id FROM ideas WHERE id = ?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });

  const result = db.prepare(
    'INSERT INTO comments (idea_id, author_name, content) VALUES (?, ?, ?)'
  ).run(req.params.id, author_name, content);

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(comment);
});

app.delete('/api/comments/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── NPS Scores ──────────────────────────────────────────────────
app.post('/api/ideas/:id/nps', (req, res) => {
  const { score, voter_name } = req.body;
  if (score === undefined || score < 0 || score > 10) {
    return res.status(400).json({ error: 'Score must be between 0 and 10' });
  }
  const idea = db.prepare('SELECT id FROM ideas WHERE id = ?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });

  db.prepare(
    'INSERT INTO nps_scores (idea_id, score, voter_name) VALUES (?, ?, ?)'
  ).run(req.params.id, score, voter_name || 'Anonymous');

  const nps = db.prepare('SELECT AVG(score) as avg_score, COUNT(*) as vote_count FROM nps_scores WHERE idea_id = ?').get(req.params.id);
  res.status(201).json({
    avg_score: Math.round(nps.avg_score * 10) / 10,
    vote_count: nps.vote_count
  });
});

// ── Admin Stats ─────────────────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const totalIdeas = db.prepare('SELECT COUNT(*) as count FROM ideas').get().count;
  const totalComments = db.prepare('SELECT COUNT(*) as count FROM comments').get().count;
  const totalVotes = db.prepare('SELECT COUNT(*) as count FROM nps_scores').get().count;
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM ideas GROUP BY status').all();
  const recentIdeas = db.prepare('SELECT * FROM ideas ORDER BY created_at DESC LIMIT 5').all();

  res.json({ totalIdeas, totalComments, totalVotes, byStatus, recentIdeas });
});

// ── SPA Fallback ────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Lions Event Planner running at http://localhost:${PORT}`);
});
