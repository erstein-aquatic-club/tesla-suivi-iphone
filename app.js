const STORAGE_KEY = 'tesla-suivi-v1';
let annonces = loadAnnonces();
let editingId = null;
let deleteId = null;

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('fr-FR');
const $ = (id) => document.getElementById(id);
const form = $('listingForm');

function loadAnnonces() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) { console.warn('Impossible de lire le stockage local', e); }
  return INITIAL_ANNONCES.map(x => ({...x}));
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(annonces)); }
function autopilotKind(value = '') {
  const v = value.toLowerCase();
  if (v.includes('fsd')) return 'fsd';
  if (v.includes('eap') || v.includes('amélioré') || v.includes('ameliore')) return 'eap';
  return 'base';
}
function autopilotLabel(kind) {
  if (kind === 'fsd') return '🥇 FSD';
  if (kind === 'eap') return '🥈 Autopilot amélioré';
  return '🥉 Base';
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function computeDerived(a) {
  const prix = Number(a.prix || 0);
  const importation = Number(a.coutImportation || 0);
  const covering = Number(a.covering || 0);
  const km = Number(a.kilometrage || 0);
  const kind = autopilotKind(a.autopilot || a.optionEap || '');
  const fsd24 = kind === 'fsd' ? 0 : kind === 'eap' ? 1176 : 2376;
  const prixTotal = prix + importation;
  const budgetToutCompris = prixTotal + covering;
  const budget2ansFsd = budgetToutCompris + fsd24;

  // Reprise de la logique du fichier : Autopilot 35% + km 30% + budget 20% + Performance 15%.
  const autopilotScore = kind === 'fsd' ? 100 : kind === 'eap' ? 80 : 20;
  const kmScore = clamp(100 - km / 1000, 0, 100);
  const budgetScore = clamp((45000 - budget2ansFsd) / 150, 0, 100);
  const perfScore = String(a.modele || '').toLowerCase().includes('performance') ? 100 : 0;
  const score = +(autopilotScore * 0.35 + kmScore * 0.30 + budgetScore * 0.20 + perfScore * 0.15).toFixed(1);

  return { ...a, fsd24, prixTotal, budgetToutCompris, budget2ansFsd, score, autopilot: a.autopilot || autopilotLabel(kind) };
}
function getFiltered() {
  const search = $('searchInput').value.trim().toLowerCase();
  const model = $('modelFilter').value;
  const status = $('statusFilter').value;
  const autopilot = $('autopilotFilter').value;
  const favOnly = $('favOnly').checked;
  const sort = $('sortSelect').value;

  let rows = annonces.filter(a => {
    const haystack = [a.modele, a.couleur, a.origine, a.localisation, a.autopilot, a.processeur, a.remarques, a.lien].join(' ').toLowerCase();
    if (search && !haystack.includes(search)) return false;
    if (model && a.modele !== model) return false;
    if (status && a.statut !== status) return false;
    if (autopilot && autopilotKind(a.autopilot) !== autopilot) return false;
    if (favOnly && !a.favori) return false;
    return true;
  });

  const by = {
    score: (a, b) => b.score - a.score,
    budget: (a, b) => a.budget2ansFsd - b.budget2ansFsd,
    km: (a, b) => a.kilometrage - b.kilometrage,
    prix: (a, b) => a.prix - b.prix,
    fav: (a, b) => Number(b.favori) - Number(a.favori) || b.score - a.score,
  }[sort] || ((a,b) => b.score - a.score);
  return rows.sort(by);
}
function uniqueValues(key) {
  return [...new Set(annonces.map(a => a[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'fr'));
}
function hydrateFilters() {
  const currentModel = $('modelFilter').value;
  $('modelFilter').innerHTML = '<option value="">Tous les modèles</option>' + uniqueValues('modele').map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  $('modelFilter').value = currentModel;
}
function render() {
  annonces = annonces.map(computeDerived);
  persist();
  hydrateFilters();
  const rows = getFiltered();
  renderKpis(rows);
  renderList(rows);
  $('resultCount').textContent = `${rows.length} annonce${rows.length > 1 ? 's' : ''}`;
}
function renderKpis(rows) {
  const best = rows[0];
  const avgBudget = rows.length ? rows.reduce((sum, a) => sum + Number(a.budget2ansFsd || 0), 0) / rows.length : 0;
  const favs = annonces.filter(a => a.favori).length;
  $('kpiBestScore').textContent = best ? best.score.toFixed(1) : '—';
  $('kpiBestCar').textContent = best ? `${best.modele} · ${euro.format(best.budget2ansFsd)}` : 'Aucune annonce';
  $('kpiAvgBudget').textContent = rows.length ? euro.format(avgBudget) : '—';
  $('kpiAvgBudgetSub').textContent = 'Budget 2 ans FSD inclus';
  $('kpiCount').textContent = String(rows.length);
  $('kpiCountSub').textContent = `${favs} favori${favs > 1 ? 's' : ''}`;
}
function renderList(rows) {
  const list = $('cards');
  if (!rows.length) {
    list.innerHTML = `<section class="empty"><h2>Aucune annonce</h2><p>Modifie les filtres ou ajoute une nouvelle annonce.</p></section>`;
    return;
  }
  list.innerHTML = rows.map(a => cardHtml(a)).join('');
}
function cardHtml(a) {
  const kind = autopilotKind(a.autopilot);
  const soh = a.soh ? `${Math.round(Number(a.soh) * 100)}% SOH` : 'SOH à vérifier';
  return `
    <article class="card ${a.favori ? 'is-fav' : ''}">
      <div class="card-top">
        <div>
          <p class="eyebrow">${escapeHtml(a.origine || 'Origine ?')} · ${escapeHtml(a.localisation || 'Localisation ?')}</p>
          <h2>${escapeHtml(a.modele || 'Tesla Model 3')} ${a.couleur ? `<span>${escapeHtml(a.couleur)}</span>` : ''}</h2>
        </div>
        <button class="icon-btn" aria-label="Favori" onclick="toggleFav('${a.id}')">${a.favori ? '★' : '☆'}</button>
      </div>
      <div class="score-row">
        <div class="score"><strong>${Number(a.score || 0).toFixed(1)}</strong><span>score</span></div>
        <div class="price"><strong>${euro.format(a.budget2ansFsd || 0)}</strong><span>budget 2 ans</span></div>
      </div>
      <div class="chips">
        <span class="chip ${kind}">${escapeHtml(a.autopilot || autopilotLabel(kind))}</span>
        <span class="chip">${number.format(a.kilometrage || 0)} km</span>
        <span class="chip">${escapeHtml(a.processeur || 'CPU ?')}</span>
        <span class="chip">${soh}</span>
      </div>
      <dl class="details">
        <div><dt>Prix</dt><dd>${euro.format(a.prix || 0)}</dd></div>
        <div><dt>Import</dt><dd>${euro.format(a.coutImportation || 0)}</dd></div>
        <div><dt>Covering</dt><dd>${euro.format(a.covering || 0)}</dd></div>
        <div><dt>FSD 24 mois</dt><dd>${euro.format(a.fsd24 || 0)}</dd></div>
      </dl>
      ${a.remarques ? `<p class="notes">${escapeHtml(a.remarques)}</p>` : ''}
      <div class="status-line">
        <label>Statut</label>
        <select onchange="updateStatus('${a.id}', this.value)">
          ${['À suivre','Contacté','À voir','Écarté','Acheté'].map(s => `<option ${a.statut === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="actions">
        ${a.lien ? `<a class="primary" href="${escapeAttr(a.lien)}" target="_blank" rel="noopener">Ouvrir l'annonce</a>` : ''}
        <button onclick="openEditor('${a.id}')">Modifier</button>
        <button class="danger" onclick="confirmDelete('${a.id}')">Supprimer</button>
      </div>
    </article>`;
}
function openEditor(id = null) {
  editingId = id;
  const a = id ? annonces.find(x => x.id === id) : {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    prix: '', origine: 'France', autopilot: '🥉 Base', processeur: 'Ryzen (probable)', modele: 'LR AWD', couleur: '', coutImportation: 0,
    kilometrage: '', interieur: 'Noir', soh: '', remarques: '', lien: '', localisation: '', covering: 0, statut: 'À suivre', favori: false
  };
  $('modalTitle').textContent = id ? 'Modifier l’annonce' : 'Nouvelle annonce';
  fillForm(a);
  $('editor').showModal();
}
function fillForm(a) {
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') el.checked = Boolean(a[el.name]);
    else if (el.name === 'soh' && a.soh && Number(a.soh) <= 1) el.value = +(Number(a.soh) * 100).toFixed(1);
    else el.value = a[el.name] ?? '';
  }
}
function formToListing() {
  const data = new FormData(form);
  const a = {};
  for (const [k, v] of data.entries()) a[k] = v;
  for (const k of ['prix','coutImportation','kilometrage','covering']) a[k] = Number(a[k] || 0);
  a.soh = a.soh === '' ? null : Number(a.soh) / (Number(a.soh) > 1 ? 100 : 1);
  a.favori = form.elements.favori.checked;
  a.id = editingId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  return computeDerived(a);
}
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const saved = formToListing();
  if (editingId) annonces = annonces.map(a => a.id === editingId ? saved : a);
  else annonces.unshift(saved);
  $('editor').close();
  render();
});
function toggleFav(id) { annonces = annonces.map(a => a.id === id ? {...a, favori: !a.favori} : a); render(); }
function updateStatus(id, statut) { annonces = annonces.map(a => a.id === id ? {...a, statut} : a); render(); }
function confirmDelete(id) { deleteId = id; $('deleteDialog').showModal(); }
function deleteListing() { annonces = annonces.filter(a => a.id !== deleteId); deleteId = null; $('deleteDialog').close(); render(); }
function resetData() {
  if (!confirm('Réinitialiser avec les données du fichier Excel fourni ? Les modifications locales seront perdues.')) return;
  annonces = INITIAL_ANNONCES.map(x => ({...x}));
  render();
}
function exportJson() { downloadFile('suivi-tesla.json', JSON.stringify(annonces, null, 2), 'application/json'); }
function exportCsv() {
  const headers = ['modele','prix','origine','autopilot','processeur','couleur','kilometrage','soh','score','budget2ansFsd','localisation','statut','favori','lien','remarques'];
  const lines = [headers.join(';')];
  annonces.forEach(a => { lines.push(headers.map(h => csvCell(a[h])).join(';')); });
  downloadFile('suivi-tesla.csv', lines.join('\n'), 'text/csv;charset=utf-8');
}
function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('Format attendu: liste JSON');
      annonces = data.map(computeDerived);
      render();
      alert('Import terminé.');
    } catch (e) { alert('Import impossible: ' + e.message); }
  };
  reader.readAsText(file);
  event.target.value = '';
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function csvCell(value) { const s = String(value ?? '').replace(/"/g, '""'); return `"${s}"`; }
function escapeHtml(s) { return String(s ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function escapeAttr(s) { return escapeHtml(s).replace(/`/g, '&#96;'); }

['searchInput','modelFilter','statusFilter','autopilotFilter','sortSelect','favOnly'].forEach(id => $(id).addEventListener('input', render));
$('addBtn').addEventListener('click', () => openEditor());
$('closeEditor').addEventListener('click', () => $('editor').close());
$('deleteYes').addEventListener('click', deleteListing);
$('deleteNo').addEventListener('click', () => $('deleteDialog').close());
$('resetBtn').addEventListener('click', resetData);
$('exportJsonBtn').addEventListener('click', exportJson);
$('exportCsvBtn').addEventListener('click', exportCsv);
$('importJsonInput').addEventListener('change', importJson);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
render();
