
import { initializeData, autoSave, forceSyncData } from './data.js';
import { math, engine, assetColors, stateTaxRates } from './utils.js';
import { PROFILE_25_SINGLE, PROFILE_45_COUPLE, PROFILE_55_RETIREE, BLANK_PROFILE } from './profiles.js';
import { simulateProjection } from './burndown-engine.js';

// State
let activeTab = 'assets';
let budgetMode = 'monthly'; // 'monthly' | 'annual'
let collapsedSections = {}; 
let swipeStartX = 0;
let currentSwipeEl = null;

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
            if (pid === 'blank') data = BLANK_PROFILE;
            
            localStorage.setItem('firecalc_data', JSON.stringify(data));
            window.currentData = JSON.parse(JSON.stringify(data)); 
            document.getElementById('profile-modal').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            await initializeData();
            renderApp();
        };
    });

    // Global Input Handler
    const container = document.getElementById('mobile-content');
    
    // Focus: Select all, strip units for editing
    container.addEventListener('focusin', (e) => {
        const target = e.target;
        if (target.tagName !== 'INPUT') return;
        
        if (target.dataset.type === 'currency') {
            const raw = math.fromCurrency(target.value);
            target.value = raw === 0 ? '' : raw; // Clear zero for easy typing
            target.type = 'number'; // Switch to number keypad
        } else if (target.dataset.type === 'percent') {
            const raw = parseFloat(target.value.replace('%', ''));
            target.value = isNaN(raw) ? '' : raw;
            target.type = 'number';
        }
    });

    // Blur: Reformat with units
    container.addEventListener('focusout', (e) => {
        const target = e.target;
        if (target.tagName !== 'INPUT') return;

        if (target.dataset.type === 'currency') {
            const val = parseFloat(target.value) || 0;
            target.type = 'text';
            target.value = math.toCurrency(val);
        } else if (target.dataset.type === 'percent') {
            const val = parseFloat(target.value) || 0;
            target.type = 'text';
            target.value = val + '%';
        }
        
        // Trigger save if changed
        target.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Input Logic
    container.addEventListener('input', (e) => {
        const target = e.target;
        if (!target.dataset.path) return;
        
        const path = target.dataset.path.split('.');
        const type = target.dataset.type;
        
        let val = target.value;
        if (type === 'currency') {
            // While typing (number mode), keep as number
            val = parseFloat(val) || 0;
            // Handle Budget mode conversion
            if (activeTab === 'budget' && budgetMode === 'monthly') val = val * 12;
        } else if (type === 'percent') {
            val = parseFloat(val) || 0;
        } else if (target.type === 'checkbox') {
            val = target.checked;
        }

        // Deep set
        let ref = window.currentData;
        for (let i = 0; i < path.length - 1; i++) {
            ref = ref[path[i]];
        }
        ref[path[path.length - 1]] = val;

        window.debouncedAutoSave();
        // Don't re-render whole app on keystroke, just header
        updateHeaderContext(); 
        if (activeTab === 'aid') updateAidHeader();
    });
    
    // Change event for selects
    container.addEventListener('change', (e) => {
        if (e.target.tagName === 'SELECT') {
            e.target.dispatchEvent(new Event('input', { bubbles: true }));
            // Re-render to update color coding if type changed
            if (e.target.dataset.path?.includes('type')) renderApp();
        }
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
    
    attachSwipeHandlers();
}

function updateHeader() {
    const left = document.getElementById('header-left');
    const right = document.getElementById('header-right');
    const toolbar = document.getElementById('header-toolbar');
    
    toolbar.classList.add('hidden');
    toolbar.innerHTML = '';

    const titles = {
        'assets': 'Assets',
        'income': 'Income',
        'budget': 'Budget',
        'config': 'Config',
        'aid': 'Benefits',
        'fire': 'Burn Down'
    };

    left.innerHTML = `
        <h1 class="font-black text-white text-lg leading-none tracking-tight">FireCalc</h1>
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">${titles[activeTab]}</p>
    `;

    updateHeaderContext();

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
        const color = s.netWorth >= 0 ? 'text-emerald-400' : 'text-red-400';
        html = `
            <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Net Worth</div>
            <div class="font-black ${color} text-lg tracking-tighter mono-numbers">${math.toSmartCompactCurrency(s.netWorth)}</div>
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
        html = ''; // FIRE has summary in view
    } else if (activeTab === 'aid') {
        // Handled by updateAidHeader
        html = '<div id="aid-header-placeholder"></div>';
    }
    
    right.innerHTML = html;
    if (activeTab === 'aid') updateAidHeader();
}

function renderAssets(el) {
    const d = window.currentData;
    
    const getTypeColor = (type) => {
        const map = {
            'Cash': 'text-type-cash', 'Taxable': 'text-type-taxable', 'Pre-Tax (401k/IRA)': 'text-type-pretax',
            'Roth IRA': 'text-type-posttax', 'Crypto': 'text-type-crypto', 'Metals': 'text-type-metals', 'HSA': 'text-type-hsa'
        };
        return map[type] || 'text-slate-400';
    };

    const isBasisNA = (type) => ['Cash', 'Pre-Tax (401k/IRA)', 'HSA'].includes(type);

    const sections = [
        { title: 'Investments', icon: 'fa-chart-line', color: 'text-blue-400', data: d.investments, path: 'investments' },
        { title: 'Real Estate', icon: 'fa-home', color: 'text-indigo-400', data: d.realEstate, path: 'realEstate', fields: ['value', 'mortgage'] },
        { title: 'HELOCs', icon: 'fa-university', color: 'text-red-400', data: d.helocs, path: 'helocs', fields: ['balance', 'limit'] },
        { title: 'Other Assets', icon: 'fa-car', color: 'text-teal-400', data: d.otherAssets, path: 'otherAssets', fields: ['value', 'loan'] },
        { title: 'Debts', icon: 'fa-credit-card', color: 'text-pink-400', data: d.debts, path: 'debts', fields: ['balance'] }
    ];

    el.innerHTML = sections.map((sect) => {
        // Calculate Net for Section
        let net = 0;
        (sect.data || []).forEach(item => {
            if (sect.path === 'investments' || sect.path === 'otherAssets') net += math.fromCurrency(item.value) - math.fromCurrency(item.loan || 0);
            else if (sect.path === 'realEstate') net += math.fromCurrency(item.value) - math.fromCurrency(item.mortgage);
            else if (sect.path === 'helocs' || sect.path === 'debts') net -= math.fromCurrency(item.balance);
        });
        const netColor = net >= 0 ? 'text-emerald-400' : 'text-red-400';
        const netDisplay = net !== 0 ? math.toSmartCompactCurrency(net) : '';

        return `
        <div class="collapsible-section">
            <div class="collapsible-header ${collapsedSections[sect.title] ? '' : 'active'}" onclick="window.toggleSection('${sect.title}')">
                <div class="flex items-center gap-3">
                    <i class="fas ${sect.icon} ${sect.color} w-5 text-center"></i>
                    <span class="font-bold text-white text-sm">${sect.title}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-black ${netColor} mono-numbers">${netDisplay}</span>
                    <i class="fas fa-chevron-down text-slate-500 transition-transform ${collapsedSections[sect.title] ? '' : 'rotate-180'}"></i>
                </div>
            </div>
            <div class="collapsible-content ${collapsedSections[sect.title] ? '' : 'open'}">
                <div class="p-3 space-y-3">
                    ${(sect.data || []).map((item, i) => {
                        const typeClass = sect.path === 'investments' ? getTypeColor(item.type) : 'text-slate-400';
                        return `
                        <div class="swipe-container rounded-xl">
                            <div class="swipe-actions">
                                <button class="swipe-action-btn bg-red-600" onclick="window.removeItem('${sect.path}', ${i})">Delete</button>
                            </div>
                            <div class="swipe-content bg-black/20 p-3 border border-white/5 rounded-xl flex items-center gap-3">
                                <div class="flex-grow space-y-2">
                                    <input data-path="${sect.path}.${i}.name" value="${item.name}" class="bg-transparent border-none p-0 text-xs font-bold text-white w-full placeholder:text-slate-600 focus:ring-0 uppercase tracking-tight">
                                    ${sect.path === 'investments' ? `
                                    <div class="relative">
                                        <select data-path="${sect.path}.${i}.type" class="bg-slate-900 border border-white/10 rounded-lg text-[10px] font-bold uppercase w-full p-1.5 ${typeClass}">
                                            <option value="Taxable" ${item.type === 'Taxable' ? 'selected' : ''}>Taxable</option>
                                            <option value="Pre-Tax (401k/IRA)" ${item.type === 'Pre-Tax (401k/IRA)' ? 'selected' : ''}>Pre-Tax</option>
                                            <option value="Roth IRA" ${item.type === 'Roth IRA' ? 'selected' : ''}>Roth IRA</option>
                                            <option value="Cash" ${item.type === 'Cash' ? 'selected' : ''}>Cash</option>
                                            <option value="Crypto" ${item.type === 'Crypto' ? 'selected' : ''}>Crypto</option>
                                            <option value="Metals" ${item.type === 'Metals' ? 'selected' : ''}>Metals</option>
                                            <option value="HSA" ${item.type === 'HSA' ? 'selected' : ''}>HSA</option>
                                        </select>
                                    </div>
                                    ` : ''}
                                </div>
                                <div class="text-right space-y-1">
                                    ${sect.path === 'investments' ? `
                                        <input data-path="${sect.path}.${i}.value" data-type="currency" value="${math.toCurrency(item.value)}" class="bg-transparent border-none p-0 text-sm font-black text-right text-white w-28 focus:ring-0">
                                        <div class="flex items-center justify-end gap-1">
                                            <span class="text-[8px] text-slate-500 font-bold uppercase">Basis</span>
                                            <input data-path="${sect.path}.${i}.costBasis" data-type="currency" 
                                                value="${isBasisNA(item.type) ? 'N/A' : math.toCurrency(item.costBasis)}" 
                                                class="bg-transparent border-none p-0 text-[10px] font-bold text-right text-blue-400 w-20 focus:ring-0 ${isBasisNA(item.type) ? 'opacity-30 pointer-events-none' : ''}">
                                        </div>
                                    ` : `
                                        <input data-path="${sect.path}.${i}.${sect.fields[0]}" data-type="currency" value="${math.toCurrency(item[sect.fields[0]])}" class="bg-transparent border-none p-0 text-sm font-black text-right text-white w-28 focus:ring-0">
                                        ${sect.fields[1] ? `<input data-path="${sect.path}.${i}.${sect.fields[1]}" data-type="currency" value="${math.toCurrency(item[sect.fields[1]])}" class="bg-transparent border-none p-0 text-[10px] font-bold text-right text-red-400 w-28 focus:ring-0 block mt-1">` : ''}
                                    `}
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                     <button class="w-full py-3 border border-dashed border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-white/5" onclick="window.addItem('${sect.path}')">+ Add Item</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderIncome(el) {
    const d = window.currentData;
    el.innerHTML = (d.income || []).map((inc, i) => `
        <div class="swipe-container rounded-xl mb-3">
            <div class="swipe-actions">
                <button class="swipe-action-btn bg-slate-700" onclick="window.openAdvancedIncome(${i})">Settings</button>
                <button class="swipe-action-btn bg-red-600" onclick="window.removeItem('income', ${i})">Delete</button>
            </div>
            <div class="swipe-content mobile-card !mb-0">
                <div class="flex justify-between items-start mb-4 border-b border-white/5 pb-3">
                    <input data-path="income.${i}.name" value="${inc.name}" class="bg-transparent text-sm font-black text-white w-full border-none p-0 focus:ring-0 uppercase tracking-tight" placeholder="SOURCE NAME">
                    <label class="flex items-center gap-1.5">
                        <input type="checkbox" data-path="income.${i}.remainsInRetirement" ${inc.remainsInRetirement ? 'checked' : ''} class="w-3 h-3 rounded bg-slate-700 border-none text-blue-500">
                        <span class="text-[8px] font-bold text-slate-500 uppercase">Retirement?</span>
                    </label>
                </div>
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="block text-[8px] font-bold text-slate-500 uppercase mb-1">Gross Annual</label>
                        <input data-path="income.${i}.amount" data-type="currency" value="${math.toCurrency(inc.isMonthly ? inc.amount * 12 : inc.amount)}" class="w-full p-2 bg-black/20 rounded-lg text-teal-400 font-black text-sm text-right">
                    </div>
                     <div>
                        <label class="block text-[8px] font-bold text-slate-500 uppercase mb-1">Growth %</label>
                        <div class="flex items-center bg-black/20 rounded-lg">
                            <button class="stepper-btn" onclick="window.stepValue('income.${i}.increase', -0.5)">-</button>
                            <input data-path="income.${i}.increase" data-type="percent" value="${inc.increase}%" class="w-full p-2 bg-transparent text-white font-bold text-sm text-center border-none focus:ring-0">
                            <button class="stepper-btn" onclick="window.stepValue('income.${i}.increase', 0.5)">+</button>
                        </div>
                    </div>
                </div>
                
                <div class="bg-slate-800/50 p-3 rounded-xl border border-white/5">
                    <div class="grid grid-cols-3 gap-2">
                        <div>
                            <span class="text-[8px] font-bold text-slate-400 uppercase block mb-1">401k %</span>
                            <div class="flex items-center bg-black/20 rounded-lg">
                                <button class="stepper-btn" onclick="window.stepValue('income.${i}.contribution', -1)">-</button>
                                <input data-path="income.${i}.contribution" data-type="percent" value="${inc.contribution}%" class="w-full py-1 bg-transparent text-blue-400 font-bold text-xs text-center border-none p-0 focus:ring-0">
                                <button class="stepper-btn" onclick="window.stepValue('income.${i}.contribution', 1)">+</button>
                            </div>
                        </div>
                        <div>
                            <span class="text-[8px] font-bold text-slate-400 uppercase block mb-1">Match %</span>
                            <div class="flex items-center bg-black/20 rounded-lg">
                                <button class="stepper-btn" onclick="window.stepValue('income.${i}.match', -1)">-</button>
                                <input data-path="income.${i}.match" data-type="percent" value="${inc.match}%" class="w-full py-1 bg-transparent text-white font-bold text-xs text-center border-none p-0 focus:ring-0">
                                <button class="stepper-btn" onclick="window.stepValue('income.${i}.match', 1)">+</button>
                            </div>
                        </div>
                        <div>
                            <span class="text-[8px] font-bold text-slate-400 uppercase block mb-1">Bonus %</span>
                            <div class="flex items-center bg-black/20 rounded-lg">
                                <button class="stepper-btn" onclick="window.stepValue('income.${i}.bonusPct', -1)">-</button>
                                <input data-path="income.${i}.bonusPct" data-type="percent" value="${inc.bonusPct}%" class="w-full py-1 bg-transparent text-white font-bold text-xs text-center border-none p-0 focus:ring-0">
                                <button class="stepper-btn" onclick="window.stepValue('income.${i}.bonusPct', 1)">+</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('') + `<button class="w-full py-4 border border-dashed border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 mb-8" onclick="window.addItem('income')">+ Add Income Stream</button>`;
}

function renderBudget(el) {
    const d = window.currentData;
    const isMon = budgetMode === 'monthly';
    const factor = isMon ? 1/12 : 1;

    const renderRow = (item, i, type) => {
        let val = (type === 'savings' ? item.annual : item.annual) * factor;
        return `
        <div class="swipe-container">
            <div class="swipe-actions">
                <button class="swipe-action-btn bg-red-600" onclick="window.removeItem('budget.${type}', ${i})">Delete</button>
            </div>
            <div class="swipe-content bg-[#1e293b] border-b border-white/5 py-3 flex items-center justify-between">
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
                </div>
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
    
    const slider = (label, path, min, max, step, val, suffix = '', color='text-white') => `
        <div class="mb-5">
            <div class="flex justify-between items-end mb-2">
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">${label}</span>
                <span class="${color} font-black text-sm mono-numbers">${val}${suffix}</span>
            </div>
            <input type="range" data-path="assumptions.${path}" min="${min}" max="${max}" step="${step}" value="${val}" class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer">
        </div>
    `;

    el.innerHTML = `
        <div class="mobile-card">
            <h3 class="text-xs font-black text-white uppercase mb-4 border-b border-white/10 pb-2">Personal</h3>
            <div class="grid grid-cols-2 gap-3 mb-4">
                <label class="block">
                    <span class="text-[10px] font-bold text-slate-500 uppercase block mb-1">State</span>
                    <select data-path="assumptions.state" class="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white">
                        ${Object.keys(stateTaxRates || {}).sort().map(s => `<option value="${s}" ${a.state === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </label>
                 <label class="block">
                    <span class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filing</span>
                    <select data-path="assumptions.filingStatus" class="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white">
                        <option value="Single" ${a.filingStatus === 'Single' ? 'selected' : ''}>Single</option>
                        <option value="Married Filing Jointly" ${a.filingStatus === 'Married Filing Jointly' ? 'selected' : ''}>Married Jointly</option>
                    </select>
                </label>
            </div>
            ${slider('Current Age', 'currentAge', 18, 80, 1, a.currentAge, '', 'text-white')}
            ${slider('Retirement Age', 'retirementAge', a.currentAge, 80, 1, a.retirementAge, '', 'text-blue-400')}
            ${slider('SS Start Age', 'ssStartAge', 62, 70, 1, a.ssStartAge, '', 'text-teal-400')}
            ${slider('SS Monthly', 'ssMonthly', 0, 5000, 100, a.ssMonthly, '', 'text-teal-400')}
        </div>

        <div class="mobile-card">
            <h3 class="text-xs font-black text-white uppercase mb-4 border-b border-white/10 pb-2">Market</h3>
            ${slider('Stocks (APY)', 'stockGrowth', 0, 15, 0.5, a.stockGrowth, '%', 'text-blue-400')}
            ${slider('Crypto (APY)', 'cryptoGrowth', 0, 15, 0.5, a.cryptoGrowth, '%', 'text-slate-400')}
            ${slider('Real Estate (APY)', 'realEstateGrowth', 0, 10, 0.5, a.realEstateGrowth, '%', 'text-indigo-400')}
            ${slider('Inflation', 'inflation', 0, 10, 0.1, a.inflation, '%', 'text-red-400')}
        </div>
        
        <div class="mt-8 p-4 bg-red-900/10 border border-red-500/20 rounded-xl text-center">
            <button onclick="if(confirm('Reset all data?')) { localStorage.removeItem('firecalc_data'); window.location.reload(); }" class="text-red-400 font-bold uppercase text-xs tracking-widest">
                Reset to Defaults
            </button>
        </div>
    `;
}

function updateAidHeader() {
    // Determine status & snap
    const d = window.currentData;
    const ben = d.benefits;
    const size = 1 + (d.assumptions.filingStatus === 'Married Filing Jointly' ? 1 : 0) + (ben.dependents || []).length;
    const magi = ben.unifiedIncomeAnnual;
    const fpl = math.getFPL(size, d.assumptions.state);
    const ratio = magi / fpl;
    
    let status = 'MARKET';
    let statusColor = 'text-slate-500';
    if (ratio <= 1.38 || ben.isPregnant || ben.isDisabled) { status = 'PLATINUM'; statusColor = 'text-emerald-400'; }
    else if (ratio <= 2.5) { status = 'SILVER'; statusColor = 'text-blue-400'; }
    
    // Quick SNAP Calc
    const snap = engine.calculateSnapBenefit(
        ben.isEarnedIncome ? magi/12 : 0, 
        ben.isEarnedIncome ? 0 : magi/12, 
        0, size, ben.shelterCosts, ben.hasSUA, ben.isDisabled, 
        ben.childSupportPaid, ben.depCare, ben.medicalExps, 
        d.assumptions.state, 1, true
    );

    const right = document.getElementById('header-right');
    right.innerHTML = `
        <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">${status}</div>
        <div class="font-black text-emerald-400 text-lg tracking-tighter mono-numbers">${math.toCurrency(snap)}/mo</div>
    `;
}

function renderAid(el) {
    const d = window.currentData;
    const ben = d.benefits || { dependents: [] };
    
    el.innerHTML = `
        <div class="mobile-card bg-amber-500/10 border-amber-500/20">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500"><i class="fas fa-users"></i></div>
                    <h3 class="font-black text-white text-sm">Household</h3>
                </div>
            </div>
            
            <div class="space-y-2 mb-4">
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
            
            <div class="grid grid-cols-2 gap-4">
                <label class="flex items-center gap-2">
                    <input type="checkbox" data-path="benefits.isDisabled" ${ben.isDisabled ? 'checked' : ''} class="rounded bg-slate-800 border-none text-purple-500">
                    <span class="text-[10px] font-bold text-slate-400 uppercase">Disabled</span>
                </label>
                <label class="flex items-center gap-2">
                    <input type="checkbox" data-path="benefits.isPregnant" ${ben.isPregnant ? 'checked' : ''} class="rounded bg-slate-800 border-none text-teal-500">
                    <span class="text-[10px] font-bold text-slate-400 uppercase">Pregnant</span>
                </label>
            </div>
        </div>

        <div class="mobile-card">
             <div class="mb-4">
                 <div class="flex justify-between items-center mb-1">
                     <span class="text-xs font-bold text-white uppercase">Sandbox Income</span>
                     <span class="text-teal-400 font-black text-sm mono-numbers">${math.toCurrency(ben.unifiedIncomeAnnual)}/yr</span>
                 </div>
                 <input type="range" data-path="benefits.unifiedIncomeAnnual" min="0" max="150000" step="1000" value="${ben.unifiedIncomeAnnual}" class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer">
                 <div class="flex items-center gap-2 mt-2">
                    <label class="flex items-center gap-2">
                        <input type="checkbox" data-path="benefits.isEarnedIncome" ${ben.isEarnedIncome ? 'checked' : ''} class="rounded bg-slate-800 border-none text-blue-500">
                        <span class="text-[10px] font-bold text-slate-500 uppercase">Is W2 Income?</span>
                    </label>
                 </div>
             </div>
             
             <div class="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                 <div>
                     <label class="block text-[8px] font-bold text-slate-500 uppercase mb-1">Shelter</label>
                     <input data-path="benefits.shelterCosts" data-type="currency" value="${math.toCurrency(ben.shelterCosts)}" class="w-full bg-black/20 border border-white/5 rounded p-1.5 text-xs text-white font-bold text-right">
                 </div>
                 <div>
                     <label class="block text-[8px] font-bold text-slate-500 uppercase mb-1">Medical</label>
                     <input data-path="benefits.medicalExps" data-type="currency" value="${math.toCurrency(ben.medicalExps)}" class="w-full bg-black/20 border border-white/5 rounded p-1.5 text-xs text-blue-400 font-bold text-right">
                 </div>
             </div>
        </div>
        
        <div class="p-4 text-[10px] text-slate-500 leading-relaxed space-y-2">
            <p><strong>Asset Test:</strong> This calculator ignores asset tests. Be aware that states like TX, ID, IN, IA enforce limits ($2,750 - $5,000).</p>
            <p><strong>Expansion:</strong> Non-expansion states provide NO coverage for adults under 100% FPL unless disabled/pregnant.</p>
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

    el.innerHTML = `
        <div class="mobile-card p-0 overflow-hidden mt-4">
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
}


// --- GLOBAL HELPERS ---

window.toggleSection = (id) => {
    collapsedSections[id] = !collapsedSections[id];
    renderAssets(document.getElementById('mobile-content')); 
    attachSwipeHandlers();
};

window.toggleBudgetMode = () => {
    budgetMode = budgetMode === 'monthly' ? 'annual' : 'monthly';
    updateHeader(); 
    renderBudget(document.getElementById('mobile-content')); 
    attachSwipeHandlers();
};

window.addItem = (path) => {
    let ref = window.currentData;
    const parts = path.split('.');
    // Traverse down
    for (let i = 0; i < parts.length; i++) {
        if (!ref[parts[i]]) ref[parts[i]] = [];
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

window.stepValue = (path, step) => {
    let ref = window.currentData;
    const parts = path.split('.');
    for (let i = 0; i < parts.length - 1; i++) ref = ref[parts[i]];
    const key = parts[parts.length - 1];
    let val = parseFloat(ref[key]) || 0;
    ref[key] = parseFloat((val + step).toFixed(1));
    renderApp(); // Re-render to update
    window.debouncedAutoSave();
};

window.openAdvancedIncome = (index) => {
    const inc = window.currentData.income[index];
    const modal = document.getElementById('advanced-modal');
    const content = document.getElementById('advanced-modal-content');
    
    content.innerHTML = `
        <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Settings for ${inc.name}</h4>
        
        <div class="space-y-4">
            <div class="flex items-center justify-between p-3 bg-black/20 rounded-xl">
                <span class="text-sm font-bold text-white">401k on Bonus?</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" onchange="window.updateIncomeBool(${index}, 'contribOnBonus', this.checked)" ${inc.contribOnBonus ? 'checked' : ''} class="sr-only peer">
                    <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>
            
            <div class="flex items-center justify-between p-3 bg-black/20 rounded-xl">
                <span class="text-sm font-bold text-white">Match on Bonus?</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" onchange="window.updateIncomeBool(${index}, 'matchOnBonus', this.checked)" ${inc.matchOnBonus ? 'checked' : ''} class="sr-only peer">
                    <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>
            
            <div class="p-3 bg-black/20 rounded-xl">
                <div class="flex justify-between mb-2">
                    <span class="text-sm font-bold text-white">Deductions</span>
                    <button class="text-blue-400 text-xs font-bold uppercase" onclick="window.toggleIncDedFreq(${index})">${inc.incomeExpensesMonthly ? 'Monthly' : 'Annual'}</button>
                </div>
                <input data-path="income.${index}.incomeExpenses" data-type="currency" value="${math.toCurrency(inc.incomeExpenses)}" class="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-right text-pink-400 font-black">
            </div>
            
            <div class="p-3 bg-black/20 rounded-xl flex justify-between items-center">
                <span class="text-sm font-bold text-white">No Tax Until Year</span>
                <input type="number" data-path="income.${index}.nonTaxableUntil" value="${inc.nonTaxableUntil || ''}" placeholder="YYYY" class="w-24 bg-slate-900 border border-white/10 rounded-lg p-2 text-center text-white font-bold">
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
};

window.updateIncomeBool = (index, key, val) => {
    window.currentData.income[index][key] = val;
    window.debouncedAutoSave();
};

window.toggleIncDedFreq = (index) => {
    const inc = window.currentData.income[index];
    const wasMon = !!inc.incomeExpensesMonthly;
    // convert value
    if (wasMon) inc.incomeExpenses = inc.incomeExpenses * 12; 
    else inc.incomeExpenses = inc.incomeExpenses / 12;
    inc.incomeExpensesMonthly = !wasMon;
    
    window.debouncedAutoSave();
    window.openAdvancedIncome(index); // Re-render modal
    renderApp(); // Update background
};

// --- SWIPE LOGIC ---
function attachSwipeHandlers() {
    const containers = document.querySelectorAll('.swipe-container');
    
    containers.forEach(el => {
        let startX = 0;
        let content = el.querySelector('.swipe-content');
        if (!content) return;

        el.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            // Close others
            if (currentSwipeEl && currentSwipeEl !== content) {
                currentSwipeEl.style.transform = 'translateX(0)';
            }
            currentSwipeEl = content;
        }, { passive: true });

        el.addEventListener('touchmove', (e) => {
            const diff = e.touches[0].clientX - startX;
            if (diff < 0 && diff > -150) { // Limit drag
                content.style.transform = `translateX(${diff}px)`;
            }
        }, { passive: true });

        el.addEventListener('touchend', (e) => {
            const diff = e.changedTouches[0].clientX - startX;
            if (diff < -60) {
                // Snap open (reveal actions)
                // Width depends on number of buttons. 2 buttons ~140px, 1 button ~80px
                const actionsWidth = el.querySelector('.swipe-actions').offsetWidth;
                content.style.transform = `translateX(-${actionsWidth}px)`;
            } else {
                // Snap close
                content.style.transform = 'translateX(0)';
                currentSwipeEl = null;
            }
        });
    });
}

window.currentData = null;
window.mobileSaveTimeout = null;

// INIT
document.addEventListener('DOMContentLoaded', init);
