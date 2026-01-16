import { initializeData, autoSave, forceSyncData } from './data.js';
import { math, engine, assetColors } from './utils.js';
import { PROFILE_25_SINGLE, PROFILE_45_COUPLE, PROFILE_55_RETIREE, BLANK_PROFILE } from './profiles.js';
import { simulateProjection } from './burndown-engine.js'; // Direct engine access

// State
let activeTab = 'assets';
let budgetMode = 'monthly'; // 'monthly' | 'annual'
let collapsedSections = {}; // track collapsible state

// --- BOOTSTRAP ---
async function init() {
    const hasData = localStorage.getItem('firecalc_data');
    if (!hasData) {
        document.getElementById('login-screen').classList.remove('hidden');
    } else {
        await initializeData();
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        renderApp();
    }
    attachListeners();
}

function attachListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.dataset.tab;
            renderApp();
        };
    });

    // Profile Selection
    document.getElementById('guest-btn').onclick = () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('profile-modal').classList.remove('hidden');
    };

    document.querySelectorAll('[data-profile]').forEach(btn => {
        btn.onclick = async () => {
            const pid = btn.dataset.profile;
            let data = BLANK_PROFILE;
            if (pid === '25') data = PROFILE_25_SINGLE;
            if (pid === '45') data = PROFILE_45_COUPLE;
            if (pid === '55') data = PROFILE_55_RETIREE;
            
            localStorage.setItem('firecalc_data', JSON.stringify(data));
            window.currentData = JSON.parse(JSON.stringify(data)); // Force immediate update
            document.getElementById('profile-modal').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            await initializeData();
            renderApp();
        };
    });

    // Global Input Handler (Delegation)
    document.getElementById('mobile-content').addEventListener('input', (e) => {
        const target = e.target;
        if (!target.dataset.path) return;
        
        const path = target.dataset.path.split('.');
        const type = target.dataset.type;
        
        let val = target.value;
        if (type === 'currency' || type === 'percent') {
            val = parseFloat(val.replace(/[^0-9.-]+/g, '')) || 0;
            // Handle Budget conversion logic when saving
            if (activeTab === 'budget' && type === 'currency') {
                if (budgetMode === 'monthly') val = val * 12; // Always save as annual
            }
        } else if (target.type === 'checkbox') {
            val = target.checked;
        }

        // Deep set value
        let ref = window.currentData;
        for (let i = 0; i < path.length - 1; i++) {
            ref = ref[path[i]];
        }
        ref[path[path.length - 1]] = val;

        // Debounced Save & UI Refresh
        window.debouncedAutoSave();
        updateHeaderContext(); // Immediate feedback
    });
}

// --- RENDERERS ---

function renderApp() {
    updateHeader();
    const content = document.getElementById('mobile-content');
    content.innerHTML = '';
    
    switch (activeTab) {
        case 'assets': renderAssets(content); break;
        case 'income': renderIncome(content); break;
        case 'budget': renderBudget(content); break;
        case 'config': renderConfig(content); break;
        case 'aid': renderAid(content); break;
        case 'fire': renderFire(content); break;
    }
}

function updateHeader() {
    const left = document.getElementById('header-left');
    const right = document.getElementById('header-right');
    const toolbar = document.getElementById('header-toolbar');
    const summaries = engine.calculateSummaries(window.currentData);
    
    // Default Toolbar State
    toolbar.classList.add('hidden');
    toolbar.innerHTML = '';

    // Title Logic
    const titles = {
        'assets': ['Assets', 'text-orange-400', 'fa-wallet'],
        'income': ['Income', 'text-teal-400', 'fa-money-bill-wave'],
        'budget': ['Budget', 'text-pink-500', 'fa-chart-pie'],
        'config': ['Config', 'text-emerald-400', 'fa-sliders-h'],
        'aid': ['Benefit Aid', 'text-amber-500', 'fa-hand-holding-heart'],
        'fire': ['Burn Down', 'text-purple-400', 'fa-fire']
    };
    const [title, color, icon] = titles[activeTab];

    left.innerHTML = `
        <div class="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center ${color}">
            <i class="fas ${icon}"></i>
        </div>
        <div>
            <h1 class="font-black text-white text-lg leading-none tracking-tight">${title}</h1>
            <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Mobile View</p>
        </div>
    `;

    // Context Logic
    updateHeaderContext(); // Call separately to handle live updates

    // Specific Toolbar for Budget
    if (activeTab === 'budget') {
        toolbar.classList.remove('hidden');
        toolbar.innerHTML = `
            <div class="toggle-switch-container w-full" data-state="${budgetMode === 'annual' ? 'right' : 'left'}" onclick="window.toggleBudgetMode()">
                <div class="toggle-pill"></div>
                <div class="toggle-option ${budgetMode === 'monthly' ? 'active' : ''}">Monthly</div>
                <div class="toggle-option ${budgetMode === 'annual' ? 'active' : ''}">Annual</div>
            </div>
        `;
    }
}

function updateHeaderContext() {
    const right = document.getElementById('header-right');
    const s = engine.calculateSummaries(window.currentData);
    
    let html = '';
    if (activeTab === 'assets') {
        html = `
            <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Net Worth</div>
            <div class="font-black text-white text-lg tracking-tighter mono-numbers">${math.toSmartCompactCurrency(s.netWorth)}</div>
        `;
    } else if (activeTab === 'income') {
        html = `
            <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Gross Inc</div>
            <div class="font-black text-teal-400 text-lg tracking-tighter mono-numbers">${math.toSmartCompactCurrency(s.totalGrossIncome)}</div>
        `;
    } else if (activeTab === 'budget') {
        const val = budgetMode === 'monthly' ? s.totalAnnualBudget / 12 : s.totalAnnualBudget;
        html = `
            <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total Spend</div>
            <div class="font-black text-pink-500 text-lg tracking-tighter mono-numbers">${math.toCurrency(val, true)}</div>
        `;
    } else if (activeTab === 'fire') {
        // Run quick sim to get insolvency age
        const sim = simulateProjection(window.currentData, { 
            strategyMode: window.currentData.burndown?.strategyMode || 'RAW',
            manualBudget: s.totalAnnualBudget,
            useSync: true
        });
        const failAge = sim.firstInsolvencyAge;
        html = `
            <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Solvency</div>
            <div class="font-black ${failAge ? 'text-red-400' : 'text-emerald-400'} text-lg tracking-tighter mono-numbers">${failAge ? 'Age ' + failAge : 'Forever'}</div>
        `;
    }
    
    right.innerHTML = html;
}

// --- TAB RENDERERS ---

function renderAssets(el) {
    const d = window.currentData;
    
    const sections = [
        { title: 'Investments', icon: 'fa-chart-line', color: 'text-blue-400', data: d.investments, path: 'investments', fields: ['value'] },
        { title: 'Real Estate', icon: 'fa-home', color: 'text-indigo-400', data: d.realEstate, path: 'realEstate', fields: ['value', 'mortgage'] },
        { title: 'HELOCs', icon: 'fa-university', color: 'text-red-400', data: d.helocs, path: 'helocs', fields: ['balance', 'limit'] },
        { title: 'Other Assets', icon: 'fa-car', color: 'text-teal-400', data: d.otherAssets, path: 'otherAssets', fields: ['value', 'loan'] },
        { title: 'Debts', icon: 'fa-credit-card', color: 'text-pink-400', data: d.debts, path: 'debts', fields: ['balance'] }
    ];

    el.innerHTML = sections.map((sect, idx) => `
        <div class="collapsible-section">
            <div class="collapsible-header ${collapsedSections[sect.title] ? '' : 'active'}" onclick="window.toggleSection('${sect.title}')">
                <div class="flex items-center gap-3">
                    <i class="fas ${sect.icon} ${sect.color} w-5 text-center"></i>
                    <span class="font-bold text-white text-sm">${sect.title}</span>
                </div>
                <i class="fas fa-chevron-down text-slate-500 transition-transform ${collapsedSections[sect.title] ? '' : 'rotate-180'}"></i>
            </div>
            <div class="collapsible-content ${collapsedSections[sect.title] ? '' : 'open'}">
                <div class="p-3 space-y-3">
                    ${(sect.data || []).map((item, i) => `
                        <div class="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                            <div class="flex-grow">
                                <input data-path="${sect.path}.${i}.name" value="${item.name}" class="bg-transparent border-none p-0 text-xs font-bold text-white w-full placeholder:text-slate-600 focus:ring-0" placeholder="Name">
                                <div class="text-[9px] text-slate-500 uppercase font-bold tracking-wider mt-1">${sect.fields[0]}</div>
                            </div>
                            <div class="text-right">
                                <input data-path="${sect.path}.${i}.${sect.fields[0]}" data-type="currency" value="${math.toCurrency(item[sect.fields[0]])}" class="bg-transparent border-none p-0 text-sm font-black text-right text-white w-24 focus:ring-0">
                                ${sect.fields[1] ? `<input data-path="${sect.path}.${i}.${sect.fields[1]}" data-type="currency" value="${math.toCurrency(item[sect.fields[1]])}" class="bg-transparent border-none p-0 text-[10px] font-bold text-right text-red-400 w-24 focus:ring-0 block mt-1">` : ''}
                            </div>
                        </div>
                    `).join('')}
                    <!-- Add Button -->
                     <button class="w-full py-3 border border-dashed border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-white/5" onclick="window.addItem('${sect.path}')">+ Add Item</button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderIncome(el) {
    const d = window.currentData;
    el.innerHTML = (d.income || []).map((inc, i) => `
        <div class="mobile-card">
            <div class="flex justify-between items-start mb-4 border-b border-white/5 pb-3">
                <input data-path="income.${i}.name" value="${inc.name}" class="bg-transparent text-sm font-black text-white w-full border-none p-0 focus:ring-0 uppercase tracking-tight" placeholder="SOURCE NAME">
                <button onclick="window.removeItem('income', ${i})" class="text-slate-600 px-2"><i class="fas fa-times"></i></button>
            </div>
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-[8px] font-bold text-slate-500 uppercase mb-1">Gross Annual</label>
                    <input data-path="income.${i}.amount" data-type="currency" value="${math.toCurrency(inc.isMonthly ? inc.amount * 12 : inc.amount)}" class="w-full p-2 bg-black/20 rounded-lg text-teal-400 font-black text-sm text-right">
                </div>
                 <div>
                    <label class="block text-[8px] font-bold text-slate-500 uppercase mb-1">Growth %</label>
                    <input data-path="income.${i}.increase" data-type="percent" value="${inc.increase}%" class="w-full p-2 bg-black/20 rounded-lg text-white font-bold text-sm text-center">
                </div>
            </div>
            
            <div class="bg-slate-800/50 p-3 rounded-xl border border-white/5">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[9px] font-bold text-slate-400 uppercase">401k Contribution</span>
                    <input data-path="income.${i}.contribution" data-type="percent" value="${inc.contribution}%" class="bg-transparent text-right text-blue-400 font-bold text-xs w-12 border-none p-0 focus:ring-0">
                </div>
                 <div class="flex items-center justify-between">
                    <span class="text-[9px] font-bold text-slate-400 uppercase">Employer Match</span>
                    <input data-path="income.${i}.match" data-type="percent" value="${inc.match}%" class="bg-transparent text-right text-white font-bold text-xs w-12 border-none p-0 focus:ring-0">
                </div>
            </div>
        </div>
    `).join('') + `<button class="w-full py-4 border border-dashed border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 mb-8" onclick="window.addItem('income')">+ Add Income Stream</button>`;
}

function renderBudget(el) {
    const d = window.currentData;
    const isMon = budgetMode === 'monthly';
    const factor = isMon ? 1/12 : 1;

    // Helper for rendering rows
    const renderRow = (item, i, type) => {
        let val = (type === 'savings' ? item.annual : item.annual) * factor;
        return `
        <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
            <div class="flex-grow">
                 <input data-path="budget.${type}.${i}.${type === 'savings' ? 'type' : 'name'}" value="${type === 'savings' ? item.type : item.name}" class="bg-transparent border-none p-0 text-xs font-bold text-white w-full focus:ring-0">
                 <div class="flex items-center gap-2 mt-1">
                     <label class="flex items-center gap-1.5">
                        <input type="checkbox" data-path="budget.${type}.${i}.remainsInRetirement" ${item.remainsInRetirement ? 'checked' : ''} class="rounded bg-slate-700 border-none w-3 h-3 text-emerald-500 focus:ring-0">
                        <span class="text-[8px] font-bold text-slate-500 uppercase">Retirement?</span>
                     </label>
                 </div>
            </div>
            <div class="text-right">
                <input data-path="budget.${type}.${i}.annual" data-type="currency" value="${math.toCurrency(val)}" class="bg-transparent border-none p-0 text-sm font-black text-right ${type === 'savings' ? 'text-teal-400' : 'text-pink-400'} w-28 focus:ring-0">
                <button onclick="window.removeItem('budget.${type}', ${i})" class="block ml-auto mt-1 text-[9px] text-red-500 opacity-50"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    };

    el.innerHTML = `
        <div class="collapsible-section">
            <div class="collapsible-header active">
                <span class="font-bold text-white text-sm">Savings (After-Tax)</span>
            </div>
            <div class="collapsible-content open bg-black/20">
                <div class="px-4">
                    ${(d.budget?.savings || []).filter(s => !s.isLocked).map((s, i) => renderRow(s, i, 'savings')).join('')}
                    <button class="w-full py-3 text-[10px] font-bold text-slate-500 uppercase" onclick="window.addItem('budget.savings')">+ Add Savings</button>
                </div>
            </div>
        </div>

        <div class="collapsible-section">
             <div class="collapsible-header active">
                <span class="font-bold text-white text-sm">Expenses</span>
            </div>
            <div class="collapsible-content open bg-black/20">
                <div class="px-4">
                     ${(d.budget?.expenses || []).map((s, i) => renderRow(s, i, 'expenses')).join('')}
                     <button class="w-full py-3 text-[10px] font-bold text-slate-500 uppercase" onclick="window.addItem('budget.expenses')">+ Add Expense</button>
                </div>
            </div>
        </div>
    `;
}

function renderConfig(el) {
    const a = window.currentData.assumptions;
    
    const slider = (label, path, min, max, step, val, suffix = '') => `
        <div class="mb-5">
            <div class="flex justify-between items-end mb-2">
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">${label}</span>
                <span class="text-white font-black text-sm mono-numbers">${val}${suffix}</span>
            </div>
            <input type="range" data-path="assumptions.${path}" min="${min}" max="${max}" step="${step}" value="${val}" class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer">
        </div>
    `;

    el.innerHTML = `
        <div class="mobile-card">
            <h3 class="text-xs font-black text-white uppercase mb-4 border-b border-white/10 pb-2">Timeline</h3>
            ${slider('Current Age', 'currentAge', 18, 80, 1, a.currentAge)}
            ${slider('Retirement Age', 'retirementAge', a.currentAge, 80, 1, a.retirementAge)}
            ${slider('SS Start Age', 'ssStartAge', 62, 70, 1, a.ssStartAge)}
        </div>

        <div class="mobile-card">
            <h3 class="text-xs font-black text-white uppercase mb-4 border-b border-white/10 pb-2">Market Growth</h3>
            ${slider('Stocks (APY)', 'stockGrowth', 0, 15, 0.5, a.stockGrowth, '%')}
            ${slider('Crypto (APY)', 'cryptoGrowth', 0, 15, 0.5, a.cryptoGrowth, '%')}
            ${slider('Real Estate (APY)', 'realEstateGrowth', 0, 10, 0.5, a.realEstateGrowth, '%')}
            ${slider('Inflation', 'inflation', 0, 10, 0.1, a.inflation, '%')}
        </div>
        
        <div class="mobile-card">
            <h3 class="text-xs font-black text-white uppercase mb-4 border-b border-white/10 pb-2">Location & Tax</h3>
            <label class="block mb-4">
                <span class="text-[10px] font-bold text-slate-500 uppercase block mb-1">State</span>
                <select data-path="assumptions.state" class="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-sm font-bold text-white">
                    ${Object.keys(window.stateTaxRates || {}).sort().map(s => `<option value="${s}" ${a.state === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </label>
             <label class="block">
                <span class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filing Status</span>
                <select data-path="assumptions.filingStatus" class="w-full p-3 bg-slate-900 border border-white/10 rounded-xl text-sm font-bold text-white">
                    <option value="Single" ${a.filingStatus === 'Single' ? 'selected' : ''}>Single</option>
                    <option value="Married Filing Jointly" ${a.filingStatus === 'Married Filing Jointly' ? 'selected' : ''}>Married Jointly</option>
                </select>
            </label>
        </div>
    `;
}

function renderAid(el) {
    // Rely on benefits.js logic via update
    // But for mobile we just render simple inputs for dependents
    const ben = window.currentData.benefits || { dependents: [] };
    
    el.innerHTML = `
        <div class="mobile-card bg-amber-500/10 border-amber-500/20">
            <div class="flex items-center gap-4 mb-4">
                <div class="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500"><i class="fas fa-users"></i></div>
                <div>
                    <h3 class="font-black text-white text-lg">Household</h3>
                    <p class="text-[10px] text-amber-200 font-bold uppercase tracking-widest">For Medicaid & SNAP</p>
                </div>
            </div>
            
            <div class="space-y-3">
                ${(ben.dependents || []).map((dep, i) => `
                    <div class="flex items-center gap-3 bg-black/20 p-2 rounded-lg">
                        <i class="fas fa-child text-slate-500 pl-2"></i>
                        <input data-path="benefits.dependents.${i}.name" value="${dep.name}" class="bg-transparent border-none text-xs font-bold text-white flex-grow focus:ring-0">
                        <input data-path="benefits.dependents.${i}.birthYear" type="number" value="${dep.birthYear}" class="bg-transparent border-none text-xs font-black text-blue-400 w-16 text-right focus:ring-0">
                         <button onclick="window.removeItem('benefits.dependents', ${i})" class="text-slate-600 px-2"><i class="fas fa-times"></i></button>
                    </div>
                `).join('')}
                <button class="w-full py-2 bg-black/20 rounded-lg text-[10px] font-bold text-slate-400 uppercase" onclick="window.addItem('benefits.dependents')">+ Add Dependent</button>
            </div>
        </div>

        <div class="mobile-card">
             <div class="flex justify-between items-center mb-4">
                 <span class="text-xs font-bold text-slate-400 uppercase">Monthly Shelter Cost</span>
                 <input data-path="benefits.shelterCosts" data-type="currency" value="${math.toCurrency(ben.shelterCosts)}" class="bg-slate-900 border border-white/10 rounded-lg text-white font-black text-sm p-2 w-24 text-right">
             </div>
             <p class="text-[9px] text-slate-500 leading-relaxed">
                Includes rent/mortgage + property tax + insurance + utilities. Used for SNAP deduction.
             </p>
        </div>
    `;
}

function renderFire(el) {
    // Run Simulation
    const s = engine.calculateSummaries(window.currentData);
    const results = simulateProjection(window.currentData, { 
        strategyMode: window.currentData.burndown?.strategyMode || 'RAW',
        manualBudget: s.totalAnnualBudget,
        useSync: true,
        priority: ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings']
    });

    // Chart Container
    const canvasId = 'mobile-fire-chart';
    el.innerHTML = `
        <div class="mobile-card p-4 h-64 relative mb-6">
            <canvas id="${canvasId}"></canvas>
        </div>
        
        <div class="mobile-card p-0 overflow-hidden">
            <table class="fire-table">
                <thead class="bg-slate-900/50">
                    <tr><th>Age</th><th>Year</th><th>Draw</th><th>Net Worth</th></tr>
                </thead>
                <tbody>
                    ${results.map(r => `
                        <tr class="${r.status === 'INSOLVENT' ? 'fire-row-insolvent' : (r.status === 'Platinum' ? 'fire-row-platinum' : '')}">
                            <td>${r.age}</td>
                            <td>${r.year}</td>
                            <td>${math.toSmartCompactCurrency(r.postTaxInc)}</td>
                            <td>${math.toSmartCompactCurrency(r.netWorth)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Render Chart
    setTimeout(() => {
        const ctx = document.getElementById(canvasId).getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: results.filter((_, i) => i % 5 === 0).map(r => r.age),
                datasets: [{
                    label: 'Net Worth',
                    data: results.filter((_, i) => i % 5 === 0).map(r => r.netWorth),
                    borderColor: '#2dd4bf',
                    backgroundColor: 'rgba(45, 212, 191, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#64748b' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: v => math.toSmartCompactCurrency(v), color: '#64748b' } }
                }
            }
        });
    }, 100);
}


// --- GLOBAL HELPERS ---

window.toggleSection = (id) => {
    collapsedSections[id] = !collapsedSections[id];
    renderAssets(document.getElementById('mobile-content')); // Re-render to animate
};

window.toggleBudgetMode = () => {
    budgetMode = budgetMode === 'monthly' ? 'annual' : 'monthly';
    updateHeader(); // Update toggle visual
    renderBudget(document.getElementById('mobile-content')); // Re-render content
};

window.addItem = (path) => {
    let ref = window.currentData;
    const parts = path.split('.');
    for (let i = 0; i < parts.length; i++) {
        ref = ref[parts[i]];
    }
    
    // Default objects
    if (path.includes('budget')) ref.push({ name: 'New Item', annual: 0, remainsInRetirement: true });
    else if (path === 'income') ref.push({ name: 'New Income', amount: 0, increase: 3, contribution: 0, match: 0, bonusPct: 0 });
    else if (path.includes('dependents')) ref.push({ name: 'Child', birthYear: new Date().getFullYear() });
    else ref.push({ name: 'New Asset', value: 0 });
    
    renderApp();
    window.debouncedAutoSave();
};

window.removeItem = (path, index) => {
    let ref = window.currentData;
    const parts = path.split('.');
    for (let i = 0; i < parts.length; i++) {
        ref = ref[parts[i]];
    }
    ref.splice(index, 1);
    renderApp();
    window.debouncedAutoSave();
};

window.currentData = null;
window.mobileSaveTimeout = null;

// INIT
document.addEventListener('DOMContentLoaded', init);