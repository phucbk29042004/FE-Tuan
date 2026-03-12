
const API_BASE = 'https://projectahpss.onrender.com';
const HEADERS = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' };

const DEFAULT_CRITERIA = ['Giá thành', 'Hiệu năng', 'Camera', 'Pin', 'Thiết kế', 'Màn hình', 'Bộ nhớ', 'Kết nối'];
const DEFAULT_ALTS = ['Samsung A55', 'Samsung A35', 'Samsung A15', 'Samsung S24', 'Samsung A25',
    'Samsung A15 5G', 'Samsung S23 FE', 'Samsung A05', 'Samsung Z Fold6', 'Samsung Z Flip6'];
const DEFAULT_SCORES = [
    [0.7, 0.5, 0.6, 0.8, 0.7, 0.6, 0.5, 0.7],
    [0.5, 0.7, 0.5, 0.6, 0.8, 0.5, 0.6, 0.6],
    [0.3, 0.4, 0.4, 0.5, 0.6, 0.4, 0.4, 0.5],
    [0.8, 0.9, 0.7, 0.7, 0.9, 0.8, 0.7, 0.8],
    [0.4, 0.5, 0.3, 0.4, 0.5, 0.3, 0.3, 0.4]
];

// ───────────────────────────────────────────────────────
// STATE
// ───────────────────────────────────────────────────────
let curStep = 1;
let criteria = [], matrix = [];
let columnSums = [], normalizedMatrix = [], weights = [], consistData = {};

// ───────────────────────────────────────────────────────
// ICON FIX — re-append sau khi Tailwind CDN inject xong
// ───────────────────────────────────────────────────────
function applyIconFix() {
    const existing = document.getElementById('icon-fix-runtime');
    if (existing) existing.remove();
    const s = document.createElement('style');
    s.id = 'icon-fix-runtime';
    s.textContent = `
    span.material-symbols-outlined, .material-symbols-outlined {
      font-family:'Material Symbols Outlined'!important;
      font-weight:normal!important; font-style:normal!important;
      line-height:1!important; letter-spacing:normal!important;
      text-transform:none!important; display:inline-block!important;
      white-space:nowrap!important; direction:ltr!important;
      font-feature-settings:'liga' 1!important;
      -webkit-font-feature-settings:'liga' 1!important;
      -webkit-font-smoothing:antialiased!important;
      font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24!important;
    }`;
    document.head.appendChild(s);
}
// Gọi ngay + sau khi Tailwind inject (thường ~150ms)
document.addEventListener('DOMContentLoaded', () => { applyIconFix(); setTimeout(applyIconFix, 300); });

// ───────────────────────────────────────────────────────
// UTILITIES
// ───────────────────────────────────────────────────────
function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = 'toast-el';
    el.style.background = type === 'err' ? '#ef4444' : type === 'ok' ? '#22c55e' : '#1A3DBE';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 2800);
}

async function apiPost(endpoint, body) {
    const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${endpoint}`);
    return res.json();
}

// ───────────────────────────────────────────────────────
// MODAL OPEN / CLOSE
// ───────────────────────────────────────────────────────
function openModal() {
    resetModal();
    document.getElementById('ahp-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeModal() {
    document.getElementById('ahp-modal').classList.remove('open');
    document.body.style.overflow = '';
}
function resetModal() {
    curStep = 1; criteria = []; matrix = [];
    columnSums = []; normalizedMatrix = []; weights = []; consistData = {};
    document.getElementById('criteria-count').value = 6;
    renderCriteriaInputs(6);
    document.querySelectorAll('.step-panel').forEach((p, i) => {
        p.className = 'step-panel' + (i === 0 ? ' active' : '');
    });
    updateDots(); updateNavButtons();
}

// ───────────────────────────────────────────────────────
// NAVIGATION
// ───────────────────────────────────────────────────────
function goToStep(next, dir = 'fwd') {
    const curEl = document.getElementById(`step-${curStep}`);
    const nextEl = document.getElementById(`step-${next}`);
    if (!curEl || !nextEl) return;

    nextEl.style.transform = dir === 'fwd' ? 'translateX(60px)' : 'translateX(-60px)';
    nextEl.style.opacity = '0';
    nextEl.classList.remove('active');

    requestAnimationFrame(() => requestAnimationFrame(() => {
        curEl.style.transform = dir === 'fwd' ? 'translateX(-60px)' : 'translateX(60px)';
        curEl.style.opacity = '0';
        nextEl.style.transform = 'translateX(0)';
        nextEl.style.opacity = '1';
    }));

    setTimeout(() => {
        curEl.style.cssText = ''; curEl.classList.remove('active');
        nextEl.style.cssText = ''; nextEl.classList.add('active');
    }, 420);

    curStep = next;
    updateDots(); updateNavButtons();
}

function updateDots() {
    const titles = ['Thiết lập tiêu chí', 'Nhập ma trận', 'Kết quả tính toán', 'Kết quả xếp hạng'];
    document.getElementById('modal-title').textContent = titles[curStep - 1] || '';
    document.getElementById('step-counter').textContent = `${curStep} / 4`;

    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`dot-${i}`);
        if (!dot) continue;
        if (i < curStep) { dot.className = 'step-dot w-8 h-8 rounded-full bg-white/50 text-white text-xs font-bold flex items-center justify-center'; dot.innerHTML = '✓'; }
        else if (i === curStep) { dot.className = 'step-dot w-8 h-8 rounded-full bg-white text-primary text-xs font-bold flex items-center justify-center ring-4 ring-white/40'; dot.textContent = i; }
        else { dot.className = 'step-dot w-8 h-8 rounded-full bg-white/25 text-white text-xs font-bold flex items-center justify-center'; dot.textContent = i; }
    }
}

function updateNavButtons() {
    const back = document.getElementById('btn-back');
    const next = document.getElementById('btn-next');
    back.style.visibility = curStep === 1 ? 'hidden' : 'visible';
    next.disabled = false;
    if (curStep === 4) {
        next.innerHTML = '🔄 Làm lại<span class="material-symbols-outlined" style="font-size:18px;">refresh</span>';
    } else {
        next.innerHTML = 'Tiếp theo<span class="material-symbols-outlined" style="font-size:18px;">arrow_forward</span>';
    }
}

function prevStep() {
    if (curStep > 1) goToStep(curStep - 1, 'back');
}

// ───────────────────────────────────────────────────────
// STEP 1 — Criteria inputs
// ───────────────────────────────────────────────────────
function renderCriteriaInputs(n) {
    const c = document.getElementById('criteria-names-container');
    c.innerHTML = '';
    for (let i = 0; i < n; i++) {
        c.innerHTML += `
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex-shrink-0 flex items-center justify-center">${i + 1}</div>
        <input id="cn-${i}" class="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          placeholder="${DEFAULT_CRITERIA[i] || `Tiêu chí ${i + 1}`}"
          value="${DEFAULT_CRITERIA[i] || ''}"/>
      </div>`;
    }
}

function readCriteria() {
    const n = parseInt(document.getElementById('criteria-count').value);
    if (isNaN(n) || n < 2 || n > 8) { toast('Số tiêu chí phải từ 2 đến 8', 'err'); return false; }
    criteria = [];
    for (let i = 0; i < n; i++) {
        const v = (document.getElementById(`cn-${i}`)?.value || '').trim();
        if (!v) { toast(`Nhập tên tiêu chí ${i + 1}`, 'err'); return false; }
        criteria.push(v);
    }
    return true;
}

// ───────────────────────────────────────────────────────
// STEP 2 — Matrix
// ───────────────────────────────────────────────────────
function buildMatrix() {
    const n = criteria.length;
    matrix = Array.from({ length: n }, () => Array(n).fill(1));

    // Legend
    let legend = '<div class="mx-legend">';
    criteria.forEach((c, i) => legend += `<div class="mx-legend-row"><span class="mx-code">C${i + 1}</span><span class="mx-name">${c}</span></div>`);
    legend += '</div>';

    // Note
    const note = '<div class="mx-note">Chỉ nhập ở tam giác phía <strong>trên đường chéo</strong> với giá trị từ 1 đến 9. Ô dưới tự động sinh nghịch đảo.</div>';

    // Table
    let tbl = `<div class="mx-scroll"><table class="mx-tbl"><thead><tr>
    <th class="mx-th-label">Tiêu chí</th>
    ${criteria.map((_, i) => `<th>C${i + 1}</th>`).join('')}
  </tr></thead><tbody>`;

    for (let i = 0; i < n; i++) {
        tbl += '<tr>';
        tbl += `<td class="mx-row-label">C${i + 1}</td>`;
        for (let j = 0; j < n; j++) {
            if (i === j) tbl += `<td class="mx-diag">1</td>`;
            else if (j > i) tbl += `<td class="mx-inp-cell"><input class="mx-inp-new" id="m_${i}_${j}" type="number" min="1" max="9" step="1" value="1" oninput="setRecip(${i},${j},this.value);updateColSums()"/></td>`;
            else tbl += `<td class="mx-recip" id="m_${i}_${j}">1</td>`;
        }
        tbl += '</tr>';
    }

    // Sum row
    tbl += `<tr class="mx-sum-row"><td class="mx-row-label">Σ Tổng</td>${criteria.map((_, j) => `<td id="col-sum-${j}">—</td>`).join('')}</tr>`;
    tbl += '</tbody></table></div>';

    document.getElementById('matrix-container').innerHTML = legend + note + tbl;
    updateColSums();
}

function setRecip(i, j, val) {
    const v = parseFloat(val);
    if (!isNaN(v) && v > 0) {
        const el = document.getElementById(`m_${j}_${i}`);
        if (el) { const iv = Math.round(v); el.textContent = (iv === v) ? (v === 1 ? '1' : `1/${iv}`) : `1/${v.toFixed(1)}`; }
    }
    updateColSums();
}

function updateColSums() {
    const n = criteria.length;
    for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let i = 0; i < n; i++) {
            if (i === j) sum += 1;
            else if (j > i) { const v = parseFloat(document.getElementById(`m_${i}_${j}`)?.value); sum += isNaN(v) ? 1 : v; }
            else { const v = parseFloat(document.getElementById(`m_${j}_${i}`)?.value); sum += (isNaN(v) || v === 0) ? 1 : 1 / v; }
        }
        const el = document.getElementById(`col-sum-${j}`);
        if (el) el.textContent = sum.toFixed(4);
    }
}

function readMatrix() {
    const n = criteria.length;
    matrix = [];
    for (let i = 0; i < n; i++) {
        matrix.push([]);
        for (let j = 0; j < n; j++) {
            let v;
            if (i === j) v = 1;
            else if (j > i) {
                v = parseFloat(document.getElementById(`m_${i}_${j}`)?.value);
                if (isNaN(v) || v < 1 || v > 9) { toast(`Giá trị [C${i + 1}/C${j + 1}] phải từ 1 đến 9`, 'err'); return false; }
            } else {
                v = 1 / (parseFloat(document.getElementById(`m_${j}_${i}`)?.value) || 1);
            }
            matrix[i].push(v);
        }
    }
    return true;
}

// ───────────────────────────────────────────────────────
// STEP 3 — AHP Pipeline
// ───────────────────────────────────────────────────────
async function runPipeline() {
    const el = document.getElementById('pipeline-result');
    el.innerHTML = '<div class="flex flex-col items-center gap-4 py-12"><div class="spinner"></div><p class="text-sm text-slate-400">Đang tính toán AHP...</p></div>';
    document.getElementById('btn-next').disabled = true;
    try {
        const r1 = await apiPost('/ahp/step/column-sum', { matrix });
        columnSums = r1.column_sums;

        const r2 = await apiPost('/ahp/step/normalize', { matrix, column_sums: columnSums });
        normalizedMatrix = r2.normalized_matrix;

        const r3 = await apiPost('/ahp/step/weights', { normalized_matrix: normalizedMatrix });
        weights = r3.weights;

        const r4 = await apiPost('/ahp/step/consistency', { matrix, weights });
        consistData = r4;

        renderPipelineResult();
        document.getElementById('btn-next').disabled = !consistData.is_consistent;
    } catch (err) {
        el.innerHTML = `<div class="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
      <div class="font-bold text-red-700 mb-1">⚠️ Lỗi kết nối API</div>
      <div class="text-sm text-red-600 mb-3">${err.message}</div>
      <button class="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold" onclick="runPipeline()">↺ Thử lại</button>
    </div>`;
        document.getElementById('btn-next').disabled = false;
    }
}

function renderPipelineResult() {
    const maxW = Math.max(...weights);
    const { lambda_max, CI, CR, is_consistent } = consistData;

    const bars = criteria.map((name, i) => {
        const pct = (weights[i] / maxW * 100).toFixed(1);
        return `<div class="flex items-center gap-3 mb-2">
      <span class="text-xs text-slate-600 w-24 truncate flex-shrink-0">${name}</span>
      <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div class="score-bar" style="width:0%" data-w="${pct}%"></div>
      </div>
      <span class="text-xs font-bold text-primary w-10 text-right">${(weights[i] * 100).toFixed(1)}%</span>
    </div>`;
    }).join('');

    const crOk = is_consistent;
    document.getElementById('pipeline-result').innerHTML = `
    <div class="mb-5">
      <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Trọng số (Priority Vector)</div>
      ${bars}
    </div>
    <div class="grid grid-cols-3 gap-3 mb-3">
      <div class="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
        <div class="text-xl font-black text-slate-900">${lambda_max?.toFixed(4) ?? '—'}</div>
        <div class="text-xs text-slate-400 mt-0.5">λ<sub>max</sub></div>
      </div>
      <div class="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
        <div class="text-xl font-black text-slate-900">${CI?.toFixed(4) ?? '—'}</div>
        <div class="text-xs text-slate-400 mt-0.5">CI</div>
      </div>
      <div class="text-center p-3 rounded-xl border ${crOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}">
        <div class="text-xl font-black ${crOk ? 'text-green-700' : 'text-red-600'}">${CR?.toFixed(4) ?? '—'}</div>
        <div class="text-xs text-slate-400 mt-0.5">CR</div>
      </div>
    </div>
    <div class="rounded-xl p-3 text-sm font-semibold text-center ${crOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">
      ${crOk ? '✓ Nhất quán (CR < 0.1) — Tiếp tục được' : '✗ Không nhất quán (CR ≥ 0.1) — Nhấn Quay lại để nhập lại ma trận'}
    </div>`;

    setTimeout(() => {
        document.querySelectorAll('#pipeline-result .score-bar[data-w]').forEach(el => { el.style.width = el.dataset.w; });
    }, 80);
}

// ───────────────────────────────────────────────────────
// DATA RENDER RANKING BY CRITERIA (Step 4)
// ───────────────────────────────────────────────────────
let activeTabIndicator = 0;

function runRanking() {
    activeTabIndicator = 0; // Default to C1

    // Fixed alternatives (3) and fixed criteria (6)
    const count = 3;
    const names = [DEFAULT_ALTS[0], DEFAULT_ALTS[1], DEFAULT_ALTS[2]];
    const scores = [];
    for (let a = 0; a < count; a++) {
        const row = [];
        for (let c = 0; c < 6; c++) {
            row.push(DEFAULT_SCORES[a][c]);
        }
        scores.push(row);
    }

    const el = document.getElementById('ranking-result');
    el.innerHTML = '<div class="flex flex-col items-center gap-4 py-12"><div class="spinner"></div><p class="text-sm text-slate-400">Đang chuẩn bị dữ liệu...</p></div>';
    document.getElementById('btn-next').disabled = true;

    try {
        renderTabsAndRanking(names, scores);
    } catch (err) {
        el.innerHTML = `<div class="p-4 bg-red-50 border border-red-200 rounded-xl text-center">
      <div class="font-bold text-red-700 mb-1">⚠️ Lỗi render UI</div>
      <div class="text-sm text-red-600 mb-3">${err.message}</div>
    </div>`;
    } finally {
        document.getElementById('btn-next').disabled = false;
    }
}

function renderTabsAndRanking(names, scores) {
    const tabsContainer = document.getElementById('ranking-tabs');
    if (!tabsContainer) return;

    let tabsHTML = '';
    // criteria is user-input names array, length = 6
    criteria.forEach((cItem, idx) => {
        const isActive = activeTabIndicator === idx;
        tabsHTML += `<button onclick="switchTab(${idx})" class="px-4 py-2 text-sm font-bold rounded-full whitespace-nowrap transition-colors ${isActive ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}">${cItem}</button>`;
    });
    tabsContainer.innerHTML = tabsHTML;

    renderTabContent(activeTabIndicator, names, scores);
}

window.switchTab = function (idx) {
    activeTabIndicator = idx;

    // Re-generate
    const count = 3;
    const names = [DEFAULT_ALTS[0], DEFAULT_ALTS[1], DEFAULT_ALTS[2]];
    const scores = [];
    for (let a = 0; a < count; a++) {
        const row = [];
        for (let c = 0; c < 6; c++) {
            row.push(DEFAULT_SCORES[a][c]);
        }
        scores.push(row);
    }

    renderTabsAndRanking(names, scores);
}

function renderTabContent(cIdx, names, scores) {
    const rankData = names.map((name, aIdx) => {
        return { name: name, score: scores[aIdx][cIdx] };
    });
    // Sort descending by score
    rankData.sort((a, b) => b.score - a.score);

    const medals = ['🥇', '🥈', '🥉'];
    const top = rankData[0]?.score || 1;
    const cards = rankData.map((item, i) => {
        const pct = (item.score / top * 100).toFixed(1);
        return `<div class="flex items-center gap-4 p-4 rounded-2xl border ${i === 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-100 bg-white'} mb-3">
      <span class="text-3xl flex-shrink-0">${medals[i] || `#${i + 1}`}</span>
      <div class="flex-1 min-w-0">
        <div class="font-bold text-slate-900">${item.name}</div>
        <div class="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
          <div class="score-bar h-full" style="width:0%" data-w="${pct}%"></div>
        </div>
      </div>
      <div class="text-right flex-shrink-0">
        <div class="text-xl font-black ${i === 0 ? 'text-amber-700' : 'text-primary'}">${item.score.toFixed(2)}</div>
        <div class="text-xs text-slate-400">điểm</div>
      </div>
    </div>`;
    }).join('');

    document.getElementById('ranking-result').innerHTML = `
    <div class="text-center mb-5 mt-2">
      <div class="text-2xl mb-2">🏆</div>
      <div class="font-bold text-slate-900">Xếp hạng trên tiêu chí <span class="text-primary">${criteria[cIdx]}</span></div>
    </div>
    ${cards}`;

    setTimeout(() => {
        document.querySelectorAll('#ranking-result .score-bar[data-w]').forEach(el => { el.style.width = el.dataset.w; });
    }, 80);
}

// ───────────────────────────────────────────────────────
// MAIN HANDLER — Next button
// ───────────────────────────────────────────────────────
async function handleNext() {
    if (curStep === 1) {
        if (!readCriteria()) return;
        goToStep(2, 'fwd');
        buildMatrix();
    }
    else if (curStep === 2) {
        if (!readMatrix()) return;
        goToStep(3, 'fwd');
        await runPipeline();
    }
    else if (curStep === 3) {
        goToStep(4, 'fwd');
        await runRanking();
    }
    else if (curStep === 4) {
        // Làm lại
        resetModal();
    }
}

// ───────────────────────────────────────────────────────
// INIT
// ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderCriteriaInputs(6);

    updateDots();
    updateNavButtons();
});
