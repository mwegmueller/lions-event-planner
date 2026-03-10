// ── Lions Club Event Planner - Frontend App ─────────────────
let currentPage = 'home';
let currentStatusFilter = '';
let adminToken = localStorage.getItem('adminToken');
let currentEditId = null;

// ── Navigation ──────────────────────────────────────────────
function navigate(page, param) {
  document.querySelectorAll('[id^="page-"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav a[data-page]').forEach(a => a.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.remove('hidden');
    const navLink = document.querySelector(`.nav a[data-page="${page}"]`);
    if (navLink) navLink.classList.add('active');
  }

  currentPage = page;
  document.querySelector('.nav').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (page === 'home') loadIdeas();
  if (page === 'detail') loadIdeaDetail(param);
  if (page === 'admin') initAdmin();
}

// ── Toast ───────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── API Helper ──────────────────────────────────────────────
async function api(url, options = {}) {
  if (adminToken) {
    options.headers = { ...options.headers, 'x-admin-token': adminToken };
  }
  if (options.body && typeof options.body === 'object') {
    options.headers = { ...options.headers, 'Content-Type': 'application/json' };
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Load Ideas ──────────────────────────────────────────────
async function loadIdeas() {
  const grid = document.getElementById('ideasGrid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div>Ideen werden geladen...</div>';
  try {
    const search = document.getElementById('searchInput').value;
    let url = '/api/ideas?';
    if (currentStatusFilter) url += `status=${currentStatusFilter}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    const ideas = await api(url);
    document.getElementById('ideaCount').textContent = ideas.length;
    if (ideas.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          <h3>Noch keine Ideen</h3>
          <p>Sei der Erste und reiche eine Event-Idee ein!</p>
          <button class="btn btn-primary" onclick="navigate('submit')">Neue Idee einreichen</button>
        </div>`;
      return;
    }
    grid.innerHTML = ideas.map(idea => renderIdeaCard(idea)).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>Fehler beim Laden</h3><p>${err.message}</p></div>`;
  }
}

function renderIdeaCard(idea) {
  const statusLabels = { new: 'Neu', discussion: 'Diskussion', approved: 'Genehmigt', rejected: 'Abgelehnt', archived: 'Archiviert' };
  const npsClass = idea.nps_avg === null ? '' : idea.nps_avg >= 9 ? 'nps-promoter' : idea.nps_avg >= 7 ? 'nps-passive' : 'nps-detractor';
  const dateStr = idea.event_date ? new Date(idea.event_date).toLocaleDateString('de-CH') : '';
  return `
    <div class="idea-card" onclick="navigate('detail', ${idea.id})">
      <div class="idea-card-header">
        <h3>${esc(idea.title)}</h3>
        <span class="status-badge status-${idea.status}">${statusLabels[idea.status] || idea.status}</span>
      </div>
      <p class="description">${esc(idea.description)}</p>
      <div class="idea-meta">
        ${dateStr ? `<span>&#128197; ${dateStr}</span>` : ''}
        ${idea.event_place ? `<span>&#128205; ${esc(idea.event_place)}</span>` : ''}
        <span>&#128100; ${esc(idea.author_name)}</span>
      </div>
      <div class="idea-footer">
        <div class="idea-stats">
          <span>&#128172; ${idea.comment_count} Kommentare</span>
          <span>&#127919; ${idea.nps_votes} Bewertungen</span>
        </div>
        ${idea.nps_avg !== null ? `<span class="nps-badge ${npsClass}">NPS ${idea.nps_avg}</span>` : ''}
      </div>
    </div>`;
}

function filterIdeas() { loadIdeas(); }
function setStatusFilter(btn, status) {
  document.querySelectorAll('.status-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentStatusFilter = status;
  loadIdeas();
}

// ── Idea Detail ─────────────────────────────────────────────
async function loadIdeaDetail(id) {
  const content = document.getElementById('ideaDetailContent');
  content.innerHTML = '<div class="loading"><div class="spinner"></div>Wird geladen...</div>';
  try {
    const idea = await api(`/api/ideas/${id}`);
    const statusLabels = { new: 'Neu', discussion: 'Diskussion', approved: 'Genehmigt', rejected: 'Abgelehnt', archived: 'Archiviert' };
    const dateStr = idea.event_date ? new Date(idea.event_date).toLocaleDateString('de-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Noch nicht festgelegt';

    content.innerHTML = `
      <div class="idea-detail-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <h2>${esc(idea.title)}</h2>
          <span class="status-badge status-${idea.status}">${statusLabels[idea.status]}</span>
        </div>
        <div class="idea-info-grid">
          <div class="info-item">
            <label>Datum</label>
            <span>&#128197; ${dateStr}</span>
          </div>
          <div class="info-item">
            <label>Ort</label>
            <span>&#128205; ${idea.event_place ? esc(idea.event_place) : 'Noch nicht festgelegt'}</span>
          </div>
          <div class="info-item">
            <label>Eingereicht von</label>
            <span>&#128100; ${esc(idea.author_name)}</span>
          </div>
          <div class="info-item">
            <label>Erstellt am</label>
            <span>${new Date(idea.created_at).toLocaleDateString('de-CH')}</span>
          </div>
        </div>
        <div class="idea-description-full">${esc(idea.description).replace(/\n/g, '<br>')}</div>
        ${idea.details ? `<div class="idea-details-full"><h4>Zusaetzliche Details</h4><p>${esc(idea.details).replace(/\n/g, '<br>')}</p></div>` : ''}
      </div>

      <!-- NPS Section -->
      <div class="nps-section">
        <h3>&#127919; Wie findest du diese Idee? (NPS Bewertung)</h3>
        <div class="nps-labels">
          <span>Gar nicht wahrscheinlich</span>
          <span>Sehr wahrscheinlich</span>
        </div>
        <div class="nps-scale" id="npsScale">
          ${[0,1,2,3,4,5,6,7,8,9,10].map(n => {
            const cls = n <= 6 ? 'detractor' : n <= 8 ? 'passive' : 'promoter';
            return `<button class="nps-btn ${cls}" onclick="selectNps(${n})" data-score="${n}">${n}</button>`;
          }).join('')}
        </div>
        <div class="nps-voter-row">
          <input type="text" class="nps-voter-input" id="npsVoterName" placeholder="Dein Name (optional)">
          <button class="btn btn-primary btn-sm" onclick="submitNps(${idea.id})" id="npsSubmitBtn" disabled>Bewerten</button>
        </div>
        ${renderNpsResults(idea)}
      </div>

      <!-- Forum Section -->
      <div class="forum-section">
        <h3>&#128172; Diskussion (${idea.comments.length})</h3>
        <div class="comment-form">
          <div class="comment-form-row">
            <input type="text" id="commentAuthor" placeholder="Dein Name *" required>
          </div>
          <textarea id="commentContent" placeholder="Dein Kommentar... *" required></textarea>
          <div>
            <button class="btn btn-primary btn-sm" onclick="submitComment(${idea.id})">Kommentar hinzufuegen</button>
          </div>
        </div>
        <div class="comment-list" id="commentList">
          ${idea.comments.length === 0
            ? '<div class="no-comments">Noch keine Kommentare. Starte die Diskussion!</div>'
            : idea.comments.map(c => renderComment(c)).join('')}
        </div>
      </div>`;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Fehler</h3><p>${err.message}</p></div>`;
  }
}

function renderNpsResults(idea) {
  if (!idea.nps_votes || idea.nps_votes === 0) {
    return '<div class="nps-results"><p style="color:var(--gray-500)">Noch keine Bewertungen abgegeben.</p></div>';
  }
  const maxCount = Math.max(...(idea.nps_distribution || []).map(d => d.count), 1);
  const avgClass = idea.nps_avg >= 9 ? 'var(--nps-promoter)' : idea.nps_avg >= 7 ? 'var(--nps-passive)' : 'var(--nps-detractor)';
  const bars = [];
  for (let i = 0; i <= 10; i++) {
    const found = (idea.nps_distribution || []).find(d => d.score === i);
    const count = found ? found.count : 0;
    const pct = (count / maxCount * 100).toFixed(0);
    const color = i <= 6 ? 'var(--nps-detractor)' : i <= 8 ? 'var(--nps-passive)' : 'var(--nps-promoter)';
    bars.push(`<div class="nps-bar-row"><span class="num">${i}</span><div class="nps-bar-track"><div class="nps-bar-fill" style="width:${pct}%;background:${color}"></div></div><span style="width:28px;font-size:0.75rem;color:var(--gray-500)">${count}</span></div>`);
  }
  return `
    <div class="nps-results">
      <div class="nps-score-display">
        <div class="score" style="color:${avgClass}">${idea.nps_avg}</div>
        <div class="label">${idea.nps_votes} Bewertung${idea.nps_votes !== 1 ? 'en' : ''}</div>
      </div>
      <div class="nps-bar-chart">${bars.join('')}</div>
    </div>`;
}

function renderComment(c) {
  const date = new Date(c.created_at).toLocaleDateString('de-CH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `
    <div class="comment-item">
      <div class="comment-header">
        <span class="comment-author">${esc(c.author_name)}</span>
        <span class="comment-date">${date}</span>
      </div>
      <div class="comment-content">${esc(c.content).replace(/\n/g, '<br>')}</div>
    </div>`;
}

let selectedNps = null;
function selectNps(score) {
  selectedNps = score;
  document.querySelectorAll('.nps-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector(`.nps-btn[data-score="${score}"]`).classList.add('selected');
  document.getElementById('npsSubmitBtn').disabled = false;
}

async function submitNps(ideaId) {
  if (selectedNps === null) return;
  try {
    const voter_name = document.getElementById('npsVoterName').value || 'Anonymous';
    await api(`/api/ideas/${ideaId}/nps`, { method: 'POST', body: { score: selectedNps, voter_name } });
    showToast('Bewertung abgegeben!', 'success');
    selectedNps = null;
    loadIdeaDetail(ideaId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitComment(ideaId) {
  const author_name = document.getElementById('commentAuthor').value.trim();
  const content = document.getElementById('commentContent').value.trim();
  if (!author_name || !content) {
    showToast('Bitte Name und Kommentar ausfuellen.', 'error');
    return;
  }
  try {
    await api(`/api/ideas/${ideaId}/comments`, { method: 'POST', body: { author_name, content } });
    showToast('Kommentar hinzugefuegt!', 'success');
    loadIdeaDetail(ideaId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Submit Idea ─────────────────────────────────────────────
async function submitIdea(e) {
  e.preventDefault();
  try {
    await api('/api/ideas', {
      method: 'POST',
      body: {
        title: document.getElementById('formTitle').value.trim(),
        description: document.getElementById('formDescription').value.trim(),
        event_date: document.getElementById('formDate').value || null,
        event_place: document.getElementById('formPlace').value.trim() || null,
        details: document.getElementById('formDetails').value.trim() || null,
        author_name: document.getElementById('formAuthor').value.trim()
      }
    });
    showToast('Idee erfolgreich eingereicht!', 'success');
    document.getElementById('submitForm').reset();
    navigate('home');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Admin ───────────────────────────────────────────────────
function initAdmin() {
  if (adminToken) {
    api('/api/admin/check').then(() => {
      showAdminDashboard();
    }).catch(() => {
      adminToken = null;
      localStorage.removeItem('adminToken');
      showAdminLogin();
    });
  } else {
    showAdminLogin();
  }
}

function showAdminLogin() {
  document.getElementById('adminLogin').classList.remove('hidden');
  document.getElementById('adminDashboard').classList.add('hidden');
}
function showAdminDashboard() {
  document.getElementById('adminLogin').classList.add('hidden');
  document.getElementById('adminDashboard').classList.remove('hidden');
  loadAdminStats();
  loadAdminIdeas();
}

async function adminLogin(e) {
  e.preventDefault();
  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: {
        username: document.getElementById('loginUsername').value,
        password: document.getElementById('loginPassword').value
      }
    });
    adminToken = data.token;
    localStorage.setItem('adminToken', adminToken);
    showToast('Erfolgreich angemeldet!', 'success');
    showAdminDashboard();
  } catch (err) {
    showToast('Ungueltige Anmeldedaten', 'error');
  }
}

async function adminLogout() {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch (_) {}
  adminToken = null;
  localStorage.removeItem('adminToken');
  showToast('Abgemeldet', 'info');
  showAdminLogin();
}

async function loadAdminStats() {
  try {
    const stats = await api('/api/admin/stats');
    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card"><div class="number">${stats.totalIdeas}</div><div class="label">Event-Ideen</div></div>
      <div class="stat-card"><div class="number">${stats.totalComments}</div><div class="label">Kommentare</div></div>
      <div class="stat-card"><div class="number">${stats.totalVotes}</div><div class="label">NPS Bewertungen</div></div>
      ${stats.byStatus.map(s => {
        const labels = { new: 'Neu', discussion: 'Diskussion', approved: 'Genehmigt', rejected: 'Abgelehnt', archived: 'Archiviert' };
        return `<div class="stat-card"><div class="number">${s.count}</div><div class="label">${labels[s.status] || s.status}</div></div>`;
      }).join('')}`;
  } catch (err) {
    showToast('Fehler beim Laden der Statistiken', 'error');
  }
}

async function loadAdminIdeas() {
  try {
    const search = document.getElementById('adminSearch')?.value || '';
    let url = '/api/ideas?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    const ideas = await api(url);
    const statusLabels = { new: 'Neu', discussion: 'Diskussion', approved: 'Genehmigt', rejected: 'Abgelehnt', archived: 'Archiviert' };
    document.getElementById('adminTableBody').innerHTML = ideas.length === 0
      ? '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--gray-500)">Keine Ideen vorhanden</td></tr>'
      : ideas.map(idea => `
        <tr>
          <td>#${idea.id}</td>
          <td><strong>${esc(idea.title)}</strong></td>
          <td>${esc(idea.author_name)}</td>
          <td>${idea.event_date ? new Date(idea.event_date).toLocaleDateString('de-CH') : '-'}</td>
          <td><span class="status-badge status-${idea.status}">${statusLabels[idea.status]}</span></td>
          <td>${idea.nps_avg !== null ? idea.nps_avg : '-'}</td>
          <td>${idea.comment_count}</td>
          <td class="actions">
            <button class="btn btn-sm btn-outline" onclick="openEdit(${idea.id})">Bearbeiten</button>
            <button class="btn btn-sm btn-danger" onclick="deleteIdea(${idea.id}, '${esc(idea.title)}')">Loeschen</button>
          </td>
        </tr>`).join('');
  } catch (err) {
    showToast('Fehler beim Laden der Ideen', 'error');
  }
}

async function openEdit(id) {
  try {
    const idea = await api(`/api/ideas/${id}`);
    currentEditId = id;
    document.getElementById('editTitle').value = idea.title;
    document.getElementById('editDescription').value = idea.description;
    document.getElementById('editDate').value = idea.event_date || '';
    document.getElementById('editPlace').value = idea.event_place || '';
    document.getElementById('editDetails').value = idea.details || '';
    document.getElementById('editStatus').value = idea.status;
    document.getElementById('editId').value = id;
    document.getElementById('editModal').classList.add('open');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeModal() {
  document.getElementById('editModal').classList.remove('open');
  currentEditId = null;
}

async function saveEdit(e) {
  e.preventDefault();
  try {
    await api(`/api/ideas/${currentEditId}`, {
      method: 'PUT',
      body: {
        title: document.getElementById('editTitle').value,
        description: document.getElementById('editDescription').value,
        event_date: document.getElementById('editDate').value || null,
        event_place: document.getElementById('editPlace').value || null,
        details: document.getElementById('editDetails').value || null,
        status: document.getElementById('editStatus').value
      }
    });
    showToast('Idee aktualisiert!', 'success');
    closeModal();
    loadAdminIdeas();
    loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteIdea(id, title) {
  if (!confirm(`Idee "${title}" wirklich loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden.`)) return;
  try {
    await api(`/api/ideas/${id}`, { method: 'DELETE' });
    showToast('Idee geloescht', 'success');
    loadAdminIdeas();
    loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Escape HTML ─────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Initialize ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadIdeas();
});
