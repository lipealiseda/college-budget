let BACKEND_URL = localStorage.getItem('backend_url') || '';
let syncPending = false;

function formatUSD(value) {
    return Math.round(value).toLocaleString('en-US');
}

let fourYearData = [];
let currentSemester = { name: "📌 Current Semester", expenses: [] };
let simActive = false, simAdjust = 0;
let charts = {};

// ✅ Backend API wrapper with error handling
async function backendRequest(method, endpoint, body = null) {
    if (!BACKEND_URL) {
        throw new Error('Backend URL not configured');
    }
    const url = `${BACKEND_URL}/api${endpoint}`;
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    
    const res = await fetch(url, options);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `HTTP ${res.status}`);
    }
    return res.json();
}

async function fetchAllRecords() {
    const data = await backendRequest('GET', '/records');
    return data.records || [];
}

async function upsertRecord(recordId, fields) {
    if (recordId) {
        return await backendRequest('PATCH', '/records', { records: [{ id: recordId, fields }] });
    } else {
        return await backendRequest('POST', '/records/create', { fields });
    }
}

async function deleteRecord(recordId) {
    await backendRequest('DELETE', `/records/${recordId}`);
}

// ---------- Data conversion ----------
const fourYearSemesters = [
    "🍂 Fall 2025 (Freshman)", "🌸 Spring 2026 (Freshman)", "☀️ Summer 2026",
    "🍂 Fall 2026 (Sophomore)", "🌸 Spring 2027 (Sophomore)", "☀️ Summer 2027",
    "🍂 Fall 2027 (Junior)", "🌸 Spring 2028 (Junior)", "☀️ Summer 2028",
    "🍂 Fall 2028 (Senior)", "🌸 Spring 2029 (Senior)", "☀️ Summer 2029"
];

function recordsToData(records) {
    const fourMap = new Map();
    const currentExps = [];
    let currentName = "📌 Current Semester";

    for (let rec of records) {
        const f = rec.fields;
        const semester = f.Semester || '';
        const type = f.Type || (fourYearSemesters.includes(semester) ? 'fouryear' : 'current');
        const expense = {
            id: rec.id,
            desc: f.Expense || '',
            amount: typeof f.Amount === 'number' ? f.Amount : parseFloat(f.Amount) || 0,
            parent: f.Parent || 'pai',
            status: f.Status || 'pending',
            comment: f.Comment || ''
        };
        if (type === 'current') {
            if (semester) currentName = semester;
            currentExps.push(expense);
        } else {
            if (!fourMap.has(semester)) fourMap.set(semester, []);
            fourMap.get(semester).push(expense);
        }
    }
    currentSemester = { name: currentName, expenses: currentExps };
    const fourYear = [];
    for (let semName of fourYearSemesters) {
        let exps = fourMap.get(semName) || [];
        exps.sort((a,b) => b.amount - a.amount);
        fourYear.push({ id: semName, name: semName, expenses: exps });
    }
    return fourYear;
}

async function syncToCloud() {
    if (syncPending || !BACKEND_URL) return;
    syncPending = true;
    try {
        const all = [];
        for (let sem of fourYearData) {
            for (let exp of sem.expenses) {
                all.push({ ...exp, semester: sem.name, type: 'fouryear' });
            }
        }
        for (let exp of currentSemester.expenses) {
            all.push({ ...exp, semester: currentSemester.name, type: 'current' });
        }

        const existing = await fetchAllRecords();
        const existingMap = new Map();
        for (let rec of existing) existingMap.set(rec.id, rec);

        for (let exp of all) {
            const fields = {
                Semester: exp.semester,
                Expense: exp.desc,
                Parent: exp.parent,
                Amount: exp.amount,
                Status: exp.status,
                Comment: exp.comment || '',
                Type: exp.type
            };
            if (exp.id && exp.id.startsWith('rec')) {
                await upsertRecord(exp.id, fields);
            } else {
                const result = await upsertRecord(null, fields);
                if (result && result.records && result.records[0]) exp.id = result.records[0].id;
            }
        }

        const currentIds = new Set(all.map(e => e.id).filter(id => id && id.startsWith('rec')));
        for (let rec of existing) {
            if (!currentIds.has(rec.id)) {
                await deleteRecord(rec.id);
            }
        }
    } finally {
        syncPending = false;
    }
}

function getDefaultFourYear() {
    const result = [];
    for (let name of fourYearSemesters) result.push({ id: name, name, expenses: [] });
    result[0].expenses = [
        { desc: "15 Creditos", amount: 16549, parent: "pai", status: "paid", comment: "" },
        { desc: "Moradia Honors", amount: 4800, parent: "pai", status: "paid", comment: "" },
        { desc: "K Sig. (Meal+ Member)", amount: 2832, parent: "pai", status: "paid", comment: "" },
        { desc: "Mesada", amount: 250, parent: "mae", status: "paid", comment: "" },
        { desc: "Outros (Mãe)", amount: 581, parent: "mae", status: "paid", comment: "" }
    ];
    result[1].expenses = [
        { desc: "17 Creditos", amount: 18751, parent: "pai", status: "paid", comment: "" },
        { desc: "Moradia Honors", amount: 4800, parent: "pai", status: "paid", comment: "" },
        { desc: "Mesada", amount: 100, parent: "mae", status: "paid", comment: "" },
        { desc: "Outros (Mãe)", amount: 150, parent: "mae", status: "paid", comment: "" }
    ];
    result[2].expenses = [
        { desc: "13 Creditos", amount: 13421, parent: "pai", status: "paid", comment: "" },
        { desc: "Moradia K.Sig.", amount: 2950, parent: "pai", status: "paid", comment: "" },
        { desc: "Outros (Mãe)", amount: 130, parent: "mae", status: "paid", comment: "" }
    ];
    for (let i = 3; i < result.length; i++) {
        result[i].expenses = [{ desc: "Tuition & Housing", amount: 20000, parent: "pai", status: "pending", comment: "estimate" }];
    }
    return result;
}

async function seedDefaultData() {
    const defaultFour = getDefaultFourYear();
    const defaultCurrent = {
        name: "📌 Fall 2025 (Current)",
        expenses: [
            { desc: "Textbooks", amount: 320, parent: "pai", status: "paid", comment: "bought at bookstore" },
            { desc: "Lab supplies", amount: 85, parent: "mae", status: "partial", comment: "paid $50, pending $35" },
            { desc: "Weekend trip", amount: 150, parent: "pai", status: "pending", comment: "will pay next week" }
        ]
    };
    for (let sem of defaultFour) {
        for (let exp of sem.expenses) {
            await upsertRecord(null, { Semester: sem.name, Expense: exp.desc, Parent: exp.parent, Amount: exp.amount, Status: exp.status, Comment: exp.comment, Type: 'fouryear' });
        }
    }
    for (let exp of defaultCurrent.expenses) {
        await upsertRecord(null, { Semester: defaultCurrent.name, Expense: exp.desc, Parent: exp.parent, Amount: exp.amount, Status: exp.status, Comment: exp.comment, Type: 'current' });
    }
}

async function loadData() {
    if (!BACKEND_URL) return false;
    try {
        const records = await fetchAllRecords();
        if (records.length === 0) {
            await seedDefaultData();
            const newRecords = await fetchAllRecords();
            fourYearData = recordsToData(newRecords);
        } else {
            fourYearData = recordsToData(records);
        }
        return true;
    } catch (err) {
        console.error(err);
        document.getElementById('statusMsg').innerHTML = `<span class="error">❌ Error: ${err.message}</span>`;
        return false;
    }
}

// ---------- Totals and Charts ----------
function computeTotals() {
    let paid = 0, partial = 0, pending = 0;
    for (let sem of fourYearData) {
        for (let e of sem.expenses) {
            if (e.status === 'paid') paid += e.amount;
            else if (e.status === 'partial') partial += e.amount;
            else pending += e.amount;
        }
    }
    for (let e of currentSemester.expenses) {
        if (e.status === 'paid') paid += e.amount;
        else if (e.status === 'partial') partial += e.amount;
        else pending += e.amount;
    }
    return { paid, partial, pending };
}

function computeParentDetails() {
    let paiPaid=0, paiPartial=0, paiPending=0, maePaid=0, maePartial=0, maePending=0;
    const proc = (e) => {
        if (e.parent === 'pai') {
            if (e.status === 'paid') paiPaid += e.amount;
            else if (e.status === 'partial') paiPartial += e.amount;
            else paiPending += e.amount;
        } else {
            if (e.status === 'paid') maePaid += e.amount;
            else if (e.status === 'partial') maePartial += e.amount;
            else maePending += e.amount;
        }
    };
    for (let sem of fourYearData) for (let e of sem.expenses) proc(e);
    for (let e of currentSemester.expenses) proc(e);
    return { paiPaid, paiPartial, paiPending, maePaid, maePartial, maePending };
}

function updateAllCharts() {
    let { paid, partial, pending } = computeTotals();
    let { paiPaid, paiPartial, paiPending, maePaid, maePartial, maePending } = computeParentDetails();

    if (charts.overall) charts.overall.destroy();
    charts.overall = new Chart(document.getElementById('overallChart'), {
        type: 'doughnut',
        data: { labels: ['Paid','Partial','Pending'], datasets: [{ data: [paid,partial,pending], backgroundColor: ['#2c6e9e','#f4a261','#e9a23b'] }] }
    });
    if (charts.pai) charts.pai.destroy();
    charts.pai = new Chart(document.getElementById('paiChart'), {
        type: 'doughnut',
        data: { labels: ['Paid','Partial','Pending'], datasets: [{ data: [paiPaid,paiPartial,paiPending], backgroundColor: ['#2c6e9e','#f4a261','#e9a23b'] }] }
    });
    if (charts.mae) charts.mae.destroy();
    charts.mae = new Chart(document.getElementById('maeChart'), {
        type: 'doughnut',
        data: { labels: ['Paid','Partial','Pending'], datasets: [{ data: [maePaid,maePartial,maePending], backgroundColor: ['#d96c8e','#e9b3c2','#e9a23b'] }] }
    });
    let totalPai = paiPaid+paiPartial+paiPending;
    let totalMae = maePaid+maePartial+maePending;
    if (charts.contrib) charts.contrib.destroy();
    charts.contrib = new Chart(document.getElementById('contribChart'), {
        type: 'doughnut',
        data: { labels: ['Pai','Mãe'], datasets: [{ data: [totalPai,totalMae], backgroundColor: ['#2c6e9e','#d96c8e'] }] }
    });
}

function updateTotalsUI() {
    let { paid, partial, pending } = computeTotals();
    let pendingAdj = pending + (simActive ? simAdjust : 0);
    if (pendingAdj < 0) pendingAdj = 0;
    document.getElementById('totalPaid').innerHTML = `$${formatUSD(paid)}`;
    document.getElementById('totalPartial').innerHTML = `$${formatUSD(partial)}`;
    document.getElementById('totalPending').innerHTML = simActive ? `$${formatUSD(pendingAdj)} *sim` : `$${formatUSD(pending)}`;
    document.getElementById('totalGrand').innerHTML = simActive ? `$${formatUSD(paid+partial+pendingAdj)} *sim` : `$${formatUSD(paid+partial+pending)}`;
    updateAllCharts();
}

// ---------- Rendering ----------
function renderFourYear() {
    const container = document.getElementById('fourYearContainer');
    container.innerHTML = '';
    for (let sem of fourYearData) {
        const div = document.createElement('div');
        div.className = 'semester-section';
        let semTotal = sem.expenses.reduce((s,e)=>s+e.amount,0);
        let semPai = sem.expenses.filter(e=>e.parent==='pai').reduce((s,e)=>s+e.amount,0);
        let semMae = sem.expenses.filter(e=>e.parent==='mae').reduce((s,e)=>s+e.amount,0);
        div.innerHTML = `
            <div class="section-header">
                <strong>${escapeHtml(sem.name)}</strong>
                <span>👨 Pai: $${formatUSD(semPai)} &nbsp; 👩 Mãe: $${formatUSD(semMae)} &nbsp; 📆 Total: $${formatUSD(semTotal)}</span>
            </div>
            <div class="table-wrapper"><table><thead><tr><th>Expense</th><th>Parent</th><th>Amount</th><th>Status</th><th>Comment</th><th></th></tr></thead><tbody id="tbody-${sem.id.replace(/[^a-z0-9]/gi,'_')}"></tbody></div>
            <div class="add-row" data-semester="${sem.id}">+ Add expense</div>
        `;
        container.appendChild(div);
        const tbody = div.querySelector('tbody');
        renderFourYearRows(tbody, sem);
        div.querySelector('.add-row').addEventListener('click', () => addFourYearExpense(sem.id));
    }
}

function renderFourYearRows(tbody, sem) {
    tbody.innerHTML = '';
    for (let i=0; i<sem.expenses.length; i++) {
        const e = sem.expenses[i];
        const row = tbody.insertRow();
        row.insertCell(0).innerHTML = `<span class="clickable editable-value" onclick="editFourYearDesc('${sem.id}', ${i})">${escapeHtml(e.desc)}</span>`;
        row.insertCell(1).innerHTML = `<span class="responsible-badge badge-${e.parent}" onclick="toggleFourYearParent('${sem.id}', ${i})">${e.parent==='pai'?'👨 Pai':'👩 Mãe'}</span>`;
        const statusClass = e.status==='paid'?'status-paid':(e.status==='partial'?'status-partial':'status-pending');
        const statusText = e.status==='paid'?'✅ Paid':(e.status==='partial'?'🔸 Partial':'⚠️ Pending');
        row.insertCell(2).innerHTML = `<span class="editable-value" onclick="editFourYearAmount('${sem.id}', ${i})">
$${formatUSD(e.amount)}</span>`;
        row.insertCell(3).innerHTML = `<span class="status-badge ${statusClass}" onclick="cycleFourYearStatus('${sem.id}', ${i})">${statusText}</span>`;
        const shortComment = e.comment ? (e.comment.length>40 ? e.comment.substring(0,37)+'...' : e.comment) : '➕ Add comment';
        row.insertCell(4).innerHTML = `<span class="comment-cell" data-fulltext="${escapeHtml(e.comment)}" onclick="editFourYearComment('${sem.id}', ${i})">${escapeHtml(shortComment)}</span>`;
        const delBtn = document.createElement('button');
        delBtn.innerText = '✖';
        delBtn.style.background = '#b16254';
        delBtn.onclick = () => deleteFourYearExpense(sem.id, i);
        row.insertCell(5).appendChild(delBtn);
    }
    if (sem.expenses.length===0) tbody.innerHTML = '<tr><td colspan="6">No expenses. Click "+ Add expense"</td></tr>';
}

function renderCurrent() {
    const tbody = document.getElementById('currentTbody');
    tbody.innerHTML = '';
    for (let i=0; i<currentSemester.expenses.length; i++) {
        const e = currentSemester.expenses[i];
        const row = tbody.insertRow();
        row.insertCell(0).innerHTML = `<span class="clickable editable-value" onclick="editCurrentDesc(${i})">${escapeHtml(e.desc)}</span>`;
        row.insertCell(1).innerHTML = `<span class="responsible-badge badge-${e.parent}" onclick="toggleCurrentParent(${i})">${e.parent==='pai'?'👨 Pai':'👩 Mãe'}</span>`;
        const statusClass = e.status==='paid'?'status-paid':(e.status==='partial'?'status-partial':'status-pending');
        const statusText = e.status==='paid'?'✅ Paid':(e.status==='partial'?'🔸 Partial':'⚠️ Pending');
        row.insertCell(2).innerHTML = `<span class="editable-value" onclick="editCurrentAmount(${i})">
$${formatUSD(e.amount)}</span>`;
        row.insertCell(3).innerHTML = `<span class="status-badge ${statusClass}" onclick="cycleCurrentStatus(${i})">${statusText}</span>`;
        const shortComment = e.comment ? (e.comment.length>40 ? e.comment.substring(0,37)+'...' : e.comment) : '➕ Add comment';
        row.insertCell(4).innerHTML = `<span class="comment-cell" data-fulltext="${escapeHtml(e.comment)}" onclick="editCurrentComment(${i})">${escapeHtml(shortComment)}</span>`;
        const delBtn = document.createElement('button');
        delBtn.innerText = '✖';
        delBtn.style.background = '#b16254';
        delBtn.onclick = () => deleteCurrentExpense(i);
        row.insertCell(5).appendChild(delBtn);
    }
    if (currentSemester.expenses.length===0) tbody.innerHTML = '<tr><td colspan="6">No current expenses. Click "+ Add expense to current semester".</td></tr>';
    document.getElementById('currentSemesterName').innerText = currentSemester.name;
}

function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]); }

async function syncAndRender() {
    await syncToCloud();
    renderFourYear();
    renderCurrent();
    updateTotalsUI();
}

window.editFourYearDesc = async (semId, idx) => { let sem = fourYearData.find(s=>s.id===semId); if(sem){ let v = prompt('Edit expense name:', sem.expenses[idx].desc); if(v && v.trim()){ sem.expenses[idx].desc = v.trim(); await syncAndRender(); } } };
window.toggleFourYearParent = async (semId, idx) => { let sem = fourYearData.find(s=>s.id===semId); if(sem){ sem.expenses[idx].parent = sem.expenses[idx].parent==='pai'?'mae':'pai'; await syncAndRender(); } };
window.editFourYearAmount = async (semId, idx) => { let sem = fourYearData.find(s=>s.id===semId); if(sem){ let v = prompt('Amount (USD):', sem.expenses[idx].amount); if(v && !isNaN(parseFloat(v))){ sem.expenses[idx].amount = Math.abs(parseFloat(v)); sem.expenses.sort((a,b)=>b.amount - a.amount); await syncAndRender(); } } };
window.cycleFourYearStatus = async (semId, idx) => { let sem = fourYearData.find(s=>s.id===semId); if(sem){ let c = sem.expenses[idx].status; sem.expenses[idx].status = c==='paid'?'partial':(c==='partial'?'pending':'paid'); await syncAndRender(); } };
window.editFourYearComment = async (semId, idx) => { let sem = fourYearData.find(s=>s.id===semId); if(sem){ let v = prompt('Edit comment:', sem.expenses[idx].comment||''); if(v!==null){ sem.expenses[idx].comment = v.trim(); await syncAndRender(); } } };
async function deleteFourYearExpense(semId, idx) { if(confirm('Delete this expense?')){ let sem = fourYearData.find(s=>s.id===semId); sem.expenses.splice(idx,1); await syncAndRender(); } }
async function addFourYearExpense(semId) { let desc = prompt('Expense name:'); if(!desc) return; let amt = parseFloat(prompt('Amount (USD):')); if(isNaN(amt)) return; let parent = prompt('Responsible: pai or mae?').toLowerCase(); if(parent!=='pai' && parent!=='mae') return; let status = prompt('Status: paid, partial, pending').toLowerCase(); let st = 'pending'; if(status==='paid') st='paid'; else if(status==='partial') st='partial'; let comment = prompt('Comment:',''); let sem = fourYearData.find(s=>s.id===semId); sem.expenses.push({ desc, amount: amt, parent, status: st, comment: comment||'' }); sem.expenses.sort((a,b)=>b.amount - a.amount); await syncAndRender(); }

window.editCurrentDesc = async (idx) => { let v = prompt('Edit expense name:', currentSemester.expenses[idx].desc); if(v && v.trim()){ currentSemester.expenses[idx].desc = v.trim(); await syncAndRender(); } };
window.toggleCurrentParent = async (idx) => { currentSemester.expenses[idx].parent = currentSemester.expenses[idx].parent==='pai'?'mae':'pai'; await syncAndRender(); };
window.editCurrentAmount = async (idx) => { let v = prompt('Amount (USD):', currentSemester.expenses[idx].amount); if(v && !isNaN(parseFloat(v))){ currentSemester.expenses[idx].amount = Math.abs(parseFloat(v)); await syncAndRender(); } };
window.cycleCurrentStatus = async (idx) => { let c = currentSemester.expenses[idx].status; currentSemester.expenses[idx].status = c==='paid'?'partial':(c==='partial'?'pending':'paid'); await syncAndRender(); };
window.editCurrentComment = async (idx) => { let v = prompt('Edit comment:', currentSemester.expenses[idx].comment||''); if(v!==null){ currentSemester.expenses[idx].comment = v.trim(); await syncAndRender(); } };
async function deleteCurrentExpense(idx) { if(confirm('Delete this current expense?')){ currentSemester.expenses.splice(idx,1); await syncAndRender(); } }
async function addCurrentExpense() { let desc = prompt('Expense name:'); if(!desc) return; let amt = parseFloat(prompt('Amount (USD):')); if(isNaN(amt)) return; let parent = prompt('Responsible: pai or mae?').toLowerCase(); if(parent!=='pai' && parent!=='mae') return; let status = prompt('Status: paid, partial, pending').toLowerCase(); let st = 'pending'; if(status==='paid') st='paid'; else if(status==='partial') st='partial'; let comment = prompt('Comment:',''); currentSemester.expenses.push({ desc, amount: amt, parent, status: st, comment: comment||'' }); await syncAndRender(); }
async function editSemesterName() { let newName = prompt('Edit current semester name:', currentSemester.name); if(newName && newName.trim()){ currentSemester.name = newName.trim(); await syncAndRender(); } }
async function clearCurrentSemester() { if(confirm('Clear ALL current semester expenses?')){ currentSemester.expenses = []; await syncAndRender(); } }
async function resetFourYearToDefault() { if(confirm('Reset 4-year plan to default? Current semester unchanged.')){ fourYearData = getDefaultFourYear(); await syncAndRender(); } }

function exportCSV() {
    let rows = [['Type','Semester','Expense','Parent','Amount','Status','Comment']];
    for (let sem of fourYearData) for (let e of sem.expenses) rows.push(['4-Year', sem.name, e.desc, e.parent, e.amount, e.status, e.comment||'']);
    for (let e of currentSemester.expenses) rows.push(['Current', currentSemester.name, e.desc, e.parent, e.amount, e.status, e.comment||'']);
    let csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    let blob = new Blob(["\uFEFF"+csv], {type:'text/csv'});
    let a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'college_budget.csv'; a.click(); URL.revokeObjectURL(a.href);
}

function applySim() { let monthly = parseFloat(document.getElementById('simMonthly').value); let months = parseInt(document.getElementById('simMonths').value); if (isNaN(monthly)||isNaN(months)||months<1) return; simAdjust = monthly*months; simActive=true; document.getElementById('simMsg').innerHTML = `💡 Active: ${monthly>=0?'+':''}$${Math.abs(monthly)}/mo × ${months}mo = ${simAdjust>=0?'increase':'reduction'} of $${formatUSD(Math.abs(simAdjust))} in pending.`; updateTotalsUI(); }
function resetSim() { simActive=false; simAdjust=0; document.getElementById('simMonthly').value=0; document.getElementById('simMsg').innerHTML='No simulation'; updateTotalsUI(); }

async function testConnection() {
    const url = document.getElementById('backendUrlInput').value.trim();
    if (!url) { alert('Please enter backend URL'); return; }
    const msgDiv = document.getElementById('statusMsg');
    msgDiv.innerHTML = '<span>Testing...</span>';
    try {
        const res = await fetch(`${url}/api/health`);
        if (res.ok) msgDiv.innerHTML = '<span class="success">✅ Backend connection successful! Click "Save & Load".</span>';
        else msgDiv.innerHTML = `<span class="error">❌ Failed: ${res.status}</span>`;
    } catch(e) { msgDiv.innerHTML = `<span class="error">❌ Error: ${e.message}</span>`; }
}

async function saveAndLoad() {
    const url = document.getElementById('backendUrlInput').value.trim();
    if (!url) { alert('Please enter backend URL'); return; }
    localStorage.setItem('backend_url', url);
    BACKEND_URL = url;
    document.getElementById('statusMsg').innerHTML = '<span>Loading data...</span>';
    const success = await loadData();
    if (success) {
        document.getElementById('statusMsg').innerHTML = '<span class="success">✅ Data loaded! All 4 graphs active. No credentials exposed!</span>';
        renderFourYear(); renderCurrent(); updateTotalsUI();
    } else {
        document.getElementById('statusMsg').innerHTML = '<span class="error">❌ Failed to load data from backend.</span>';
    }
}

document.getElementById('saveBtn').addEventListener('click', saveAndLoad);
document.getElementById('testBtn').addEventListener('click', testConnection);
document.getElementById('addCurrentBtn').addEventListener('click', addCurrentExpense);
document.getElementById('editSemesterNameBtn').addEventListener('click', editSemesterName);
document.getElementById('clearCurrentBtn').addEventListener('click', clearCurrentSemester);
document.getElementById('exportBtn').addEventListener('click', exportCSV);
document.getElementById('resetDefaultBtn').addEventListener('click', resetFourYearToDefault);
document.getElementById('applySim').addEventListener('click', applySim);
document.getElementById('resetSim').addEventListener('click', resetSim);

if (BACKEND_URL) {
    document.getElementById('backendUrlInput').value = BACKEND_URL;
    saveAndLoad();
} else {
    document.getElementById('fourYearContainer').innerHTML = '<div style="text-align:center; padding:2rem;">👆 Enter your backend URL above and click "Save & Load"</div>';
    document.getElementById('currentTbody').innerHTML = '<tr><td colspan="6">Waiting for backend URL...</td></tr>';
}
