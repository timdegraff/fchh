
// v5.2 Modularized Render
import { math, engine, assetColors, stateTaxRates } from './utils.js';
import { renderCollapsible, renderStepperSlider } from './mobile-components.js';
import { renderAssets, updateAssetChart } from './mobile-render-assets.js';
import { renderAid, updateAidHeader, updateAidVisuals } from './mobile-render-benefits.js';
import { renderFire, renderPriorityList } from './mobile-render-fire.js';

// Re-export specific update functions for mobile.js/actions
export { updateAssetChart, updateAidHeader, updateAidVisuals, renderPriorityList };

// Helper to access state safely
const getState = () => window.mobileState;

export function renderApp() {
    updateHeader();
    const content = document.getElementById('mobile-content');
    if (!content) return;
    content.innerHTML = '';
    
    const { activeTab } = getState();

    switch (activeTab) {
        case 'assets': renderAssets(content); break;
        case 'income': renderIncome(content); break;
        case 'budget': renderBudget(content); break;
        case 'config': renderConfig(content); break;
        case 'aid': renderAid(content); break;
        case 'fire': renderFire(content); break;
    }
    
    // Call the global swipe handler if available (defined in actions)
    if (window.attachSwipeHandlers) window.attachSwipeHandlers();
}

export function updateHeader() {
    const left = document.getElementById('header-left');
    const right = document.getElementById('header-right');
    const center = document.getElementById('header-center');
    const toolbar = document.getElementById('header-toolbar');
    const headerEl = document.querySelector('header');
    
    if (!left || !headerEl) return;

    const { activeTab, budgetMode } = getState();

    // Default: hide toolbar
    if (toolbar) {
        toolbar.classList.add('hidden');
        toolbar.innerHTML = '';
    }

    const titles = {
        'assets': 'Assets',
        'income': 'Income',
        'budget': 'Budget',
        'config': 'Config',
        'aid': 'Benefits',
        'fire': 'Burn Down'
    };

    const colors = {
        'assets': 'text-orange-400',
        'income': 'text-teal-400',
        'budget': 'text-pink-500',
        'config': 'text-emerald-400',
        'aid': 'text-amber-400',
        'fire': 'text-purple-400'
    };

    left.innerHTML = `
        <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-900/20 ring-1 ring-white/10">
                <i class="fas fa-fire text-sm text-white"></i>
            </div>
            <div>
                <h1 class="font-black text-white text-lg leading-none tracking-tight">FireCalc</h1>
                <p class="text-[10px] font-bold ${colors[activeTab]} uppercase tracking-widest mt-0.5">${titles[activeTab]}</p>
            </div>
        </div>
    `;

    updateHeaderContext();

    // Center Controls Logic
    if (center) center.innerHTML = '';
    
    if (activeTab === 'budget') {
        if (center) {
            center.innerHTML = `
                <div class="flex bg-slate-900/90 p-0.5 rounded-lg border border-white/10 shadow-xl">
                    <button onclick="window.setBudgetMode('monthly')" class="px-3 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all ${budgetMode === 'monthly' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}">Monthly</button>
                    <button onclick="window.setBudgetMode('annual')" class="px-3 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all ${budgetMode === 'annual' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}">Annual</button>
                </div>
            `;
        }
    } else if (activeTab === 'fire') {
        const d = window.currentData;
        const retAge = d.assumptions?.retirementAge || 65;
        if (center) {
            center.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="text-[7px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Retirement Age</div>
                    <div class="flex items-center gap-1.5 bg-slate-900/80 p-0.5 rounded-lg border border-white/10 shadow-xl">
                        <button onclick="window.stepConfig('assumptions.retirementAge', -1)" class="w-6 h-6 flex items-center justify-center bg-white/5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><i class="fas fa-minus text-[8px]"></i></button>
                        <span class="text-blue-400 font-black mono-numbers text-sm w-6 text-center">${retAge}</span>
                        <button onclick="window.stepConfig('assumptions.retirementAge', 1)" class="w-6 h-6 flex items-center justify-center bg-white/5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><i class="fas fa-plus text-[8px]"></i></button>
                    </div>
                </div>
            `;
        }
    }

    requestAnimationFrame(() => {
        const height = headerEl.offsetHeight;
        document.documentElement.style.setProperty('--header-height', `${height}px`);
    });
}

export function updateHeaderContext() {
    const right = document.getElementById('header-right');
    if (!right || !window.currentData) return;
    
    const { activeTab, incomeDisplayMode, budgetMode, assetDisplayMode } = getState();
    const s = engine.calculateSummaries(window.currentData);
    
    let html = '';
    if (activeTab === 'assets') {
        const d = window.currentData;
        let val, label, color;
        
        if (assetDisplayMode === 'investments') {
            const invSum = (d.investments || []).reduce((acc, i) => acc + math.fromCurrency(i.value), 0);
            const optSum = (d.stockOptions || []).reduce((acc, i) => {
                 const eq = Math.max(0, (math.fromCurrency(i.currentPrice) - math.fromCurrency(i.strikePrice)) * parseFloat(i.shares));
                 return acc + eq;
            }, 0);
            val = invSum + optSum;
            label = 'Investments';
            color = 'text-blue-400';
        } else {
            val = s.netWorth;
            label = 'Net Worth';
            color = val >= 0 ? 'text-emerald-400' : 'text-red-400';
        }

        html = `
            <div class="text-right cursor-pointer" onclick="window.toggleAssetHeaderMode()">
                <div class="flex items-center justify-end gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    ${label} <i class="fas fa-sync-alt text-[8px] opacity-50"></i>
                </div>
                <div class="font-black ${color} text-lg tracking-tighter mono-numbers">${math.toSmartCompactCurrency(val)}</div>
            </div>
        `;
    } else if (activeTab === 'income') {
        let valToShow, labelToShow, color;
        
        if (incomeDisplayMode === 'current') {
            valToShow = s.totalGrossIncome;
            labelToShow = 'Gross Inc';
            color = 'text-teal-400';
        } else {
            // Calculate Retirement Income logic
            const d = window.currentData;
            const a = d.assumptions || {};
            const curAge = parseFloat(a.currentAge) || 40;
            const retAge = parseFloat(a.retirementAge) || 65;
            const yrs = Math.max(0, retAge - curAge);
            const inf = (a.inflation || 3) / 100;
            const infFac = Math.pow(1 + inf, yrs);
            const ssStart = parseFloat(a.ssStartAge) || 67;
            const ssMonthly = parseFloat(a.ssMonthly) || 0;
            const ssFull = (retAge >= ssStart) ? engine.calculateSocialSecurity(ssMonthly, a.workYearsAtRetirement || 35, infFac) : 0;
            const incStreams = (d.income || []).filter(i => i.remainsInRetirement).reduce((acc, inc) => {
                 const isMon = inc.isMonthly || inc.isMonthly === 'true';
                 const base = (parseFloat(inc.amount) || 0) * (isMon ? 12 : 1);
                 const growth = Math.pow(1 + (parseFloat(inc.increase)/100 || 0), yrs);
                 const expMon = inc.incomeExpensesMonthly || inc.incomeExpensesMonthly === 'true';
                 const ded = (parseFloat(inc.incomeExpenses) || 0) * (expMon ? 12 : 1);
                 return acc + (base * growth) - ded;
            }, 0);
            const retireNominal = ssFull + incStreams;
            const retireReal = retireNominal / infFac;
            valToShow = retireReal;
            labelToShow = 'Retire (Real)';
            color = 'text-blue-400';
        }

        html = `
            <div class="text-right cursor-pointer" onclick="window.toggleIncomeHeaderMode()">
                <div class="flex items-center justify-end gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    ${labelToShow} <i class="fas fa-sync-alt text-[8px] opacity-50"></i>
                </div>
                <div class="font-black ${color} text-lg tracking-tighter mono-numbers">${math.toSmartCompactCurrency(valToShow)}</div>
            </div>
        `;
    } else if (activeTab === 'budget') {
        const factor = budgetMode === 'monthly' ? 1/12 : 1;
        const expenses = s.totalAnnualBudget * factor;
        const savings = s.totalAnnualSavings * factor;
        
        html = `
            <div class="flex flex-col items-end justify-center">
                <div class="flex items-center gap-1.5">
                    <span class="text-[8px] font-bold text-emerald-500 uppercase tracking-tight">Save</span>
                    <span class="font-black text-emerald-400 text-[10px] tracking-tighter mono-numbers">${math.toSmartCompactCurrency(savings)}</span>
                </div>
                <div class="flex items-center gap-1.5 mt-0.5">
                    <span class="text-[8px] font-bold text-pink-500 uppercase tracking-tight">Spend</span>
                    <span class="font-black text-pink-400 text-[10px] tracking-tighter mono-numbers">${math.toSmartCompactCurrency(expenses)}</span>
                </div>
            </div>
        `;
    } else if (activeTab === 'config') {
        const d = window.currentData;
        const curAge = parseFloat(d.assumptions?.currentAge) || 40;
        const retAge = parseFloat(d.assumptions?.retirementAge) || 65;
        const yrs = Math.max(0, retAge - curAge);
        
        html = `
            <div class="text-right">
                <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Yrs to Retire</div>
                <div class="font-black text-blue-400 text-lg tracking-tighter mono-numbers">${yrs}</div>
            </div>
        `;
    } else if (activeTab === 'fire') {
        const d = window.currentData;
        const mode = d.burndown?.strategyMode || 'RAW';
        const isIronFist = mode === 'RAW';
        
        html = `
            <div class="text-right cursor-pointer" onclick="window.toggleFireMode()">
                <div class="flex items-center justify-end gap-1.5">
                    <i class="fas fa-sync-alt text-[8px] opacity-50"></i>
                    <i class="fas ${isIronFist ? 'fa-fist-raised text-slate-400' : 'fa-hand-holding-dollar text-emerald-400'} text-lg"></i>
                </div>
                <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 flex flex-col items-end leading-none">
                    ${isIronFist ? '<span>Iron Fist</span>' : '<span>Handout</span><span>Hunter</span>'}
                </div>
            </div>
        `;
    } else if (activeTab === 'aid') {
        html = '<div id="aid-header-placeholder"></div>';
    }
    
    right.innerHTML = html;
    if (activeTab === 'aid') updateAidHeader();
}

function renderConfig(el) {
    const a = window.currentData.assumptions;
    const { collapsedSections } = getState();

    const sections = [
        {
            id: 'timeline', title: 'TIMELINE & PROFILE', icon: 'fa-clock', color: 'text-blue-400',
            content: `
                ${renderStepperSlider('Current Age', 'assumptions.currentAge', 18, 80, 1, a.currentAge, '')}
                ${renderStepperSlider('Retirement Age', 'assumptions.retirementAge', 18, 80, 1, a.retirementAge, '', 'text-blue-400')}
                <div class="grid grid-cols-2 gap-4 mt-4">
                    <div>
                        <label class="text-[9px] font-bold text-slate-500 uppercase block mb-1">Filing Status</label>
                        <select data-path="assumptions.filingStatus" class="bg-slate-900 border border-white/10 rounded-lg text-xs font-bold text-white w-full p-2">
                            <option value="Single" ${a.filingStatus === 'Single' ? 'selected' : ''}>Single</option>
                            <option value="Married Filing Jointly" ${a.filingStatus === 'Married Filing Jointly' ? 'selected' : ''}>Married Jointly</option>
                            <option value="Head of Household" ${a.filingStatus === 'Head of Household' ? 'selected' : ''}>Head of HH</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[9px] font-bold text-slate-500 uppercase block mb-1">State Tax</label>
                        <select data-path="assumptions.state" class="bg-slate-900 border border-white/10 rounded-lg text-xs font-bold text-white w-full p-2">
                            ${Object.keys(stateTaxRates).sort().map(s => `<option value="${s}" ${a.state === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                </div>
            `
        },
        {
            id: 'market', title: 'MARKET ASSUMPTIONS', icon: 'fa-chart-line', color: 'text-orange-400',
            content: `
                <p class="text-[10px] text-blue-300 leading-relaxed font-medium mb-4 px-1">
                    These growth rates determine how fast your assets compound annually. Inflation reduces purchasing power.
                </p>
                ${renderStepperSlider('Stock Growth', 'assumptions.stockGrowth', 1, 15, 0.5, a.stockGrowth, '%', 'text-blue-400')}
                ${renderStepperSlider('Crypto Growth', 'assumptions.cryptoGrowth', 1, 15, 0.5, a.cryptoGrowth, '%', 'text-slate-400')}
                ${renderStepperSlider('Metals Growth', 'assumptions.metalsGrowth', 1, 15, 0.5, a.metalsGrowth, '%', 'text-amber-500')}
                ${renderStepperSlider('Real Estate', 'assumptions.realEstateGrowth', 0, 10, 0.5, a.realEstateGrowth, '%', 'text-indigo-400')}
                ${renderStepperSlider('Inflation', 'assumptions.inflation', 1, 10, 0.1, a.inflation, '%', 'text-red-400')}
            `
        },
        {
            id: 'phases', title: 'SPENDING PHASES', icon: 'fa-walking', color: 'text-purple-400',
            content: `
                <p class="text-[10px] text-purple-300 leading-relaxed font-medium mb-4 px-1">
                    Adjust your retirement spending budget for different life stages. 100% means full budget, <100% reduces spending as you age.
                </p>
                ${renderStepperSlider('Go-Go (Age 30-60)', 'assumptions.phaseGo1', 50, 150, 5, Math.round(a.phaseGo1 * 100), '%', 'text-purple-400')}
                ${renderStepperSlider('Slow-Go (Age 60-80)', 'assumptions.phaseGo2', 50, 150, 5, Math.round(a.phaseGo2 * 100), '%', 'text-purple-400')}
                ${renderStepperSlider('No-Go (Age 80+)', 'assumptions.phaseGo3', 50, 150, 5, Math.round(a.phaseGo3 * 100), '%', 'text-purple-400')}
            `
        }
    ];

    el.innerHTML = sections.map(s => renderCollapsible(s.id, s.title, s.content, !collapsedSections[s.id], s.icon, s.color)).join('') + `
        <button onclick="if(confirm('This will wipe all data and reload the app. Continue?')) { localStorage.removeItem('firecalc_data'); window.location.reload(); }" class="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold uppercase text-xs rounded-xl transition-colors border border-red-500/20 mb-8 mt-4">
            Reset Data & Reload
        </button>
    `;
}

function renderIncome(el) {
    const d = window.currentData;
    const income = d.income || [];
    
    const html = income.map((inc, i) => {
        return `
        <div class="swipe-container">
            <div class="swipe-actions">
                <button class="swipe-action-btn bg-slate-700" onclick="window.openAdvancedIncome(${i})">Settings</button>
                <button class="swipe-action-btn bg-red-600" onclick="window.removeItem('income', ${i})">Delete</button>
            </div>
            <div class="swipe-content mobile-card p-4 border border-white/5 !mb-0">
                <div class="flex justify-between items-center mb-3">
                    <input data-path="income.${i}.name" value="${inc.name}" class="bg-transparent border-none p-0 text-sm font-black text-white uppercase tracking-wider w-full focus:ring-0 placeholder:text-slate-600">
                    <button class="text-[9px] font-bold ${inc.isMonthly ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 bg-slate-800'} uppercase px-2 py-1 rounded-md transition-colors" onclick="const d = window.currentData.income[${i}]; d.isMonthly = !d.isMonthly; d.amount = d.isMonthly ? d.amount / 12 : d.amount * 12; window.mobileAutoSave(); window.renderApp();">
                        ${inc.isMonthly ? 'Monthly' : 'Annual'}
                    </button>
                </div>
                
                <div class="mb-4">
                    <label class="text-[8px] font-bold text-slate-500 uppercase block mb-0.5">Gross Amount</label>
                    <input data-path="income.${i}.amount" data-type="currency" inputmode="decimal" value="${math.toCurrency(inc.amount)}" class="bg-transparent border-none p-0 text-2xl font-black text-teal-400 w-full focus:ring-0 tracking-tight">
                </div>

                <div class="grid grid-cols-3 gap-3 pt-3 border-t border-white/5">
                    <div>
                        <label class="text-[7px] font-bold text-slate-500 uppercase block mb-1">Growth</label>
                        <div class="flex items-center gap-1">
                            <input data-path="income.${i}.increase" type="number" step="0.5" value="${inc.increase}" class="bg-slate-900 border border-white/10 rounded px-1 py-1 text-xs font-bold text-white w-full text-center focus:ring-0">
                            <span class="text-[8px] text-slate-500 font-bold">%</span>
                        </div>
                    </div>
                    <div>
                        <label class="text-[7px] font-bold text-slate-500 uppercase block mb-1">401k</label>
                        <div class="flex items-center gap-1">
                            <input data-path="income.${i}.contribution" type="number" step="1" value="${inc.contribution}" class="bg-slate-900 border border-white/10 rounded px-1 py-1 text-xs font-bold text-blue-400 w-full text-center focus:ring-0">
                            <span class="text-[8px] text-slate-500 font-bold">%</span>
                        </div>
                    </div>
                    <div>
                        <label class="text-[7px] font-bold text-slate-500 uppercase block mb-1">Match</label>
                        <div class="flex items-center gap-1">
                            <input data-path="income.${i}.match" type="number" step="1" value="${inc.match}" class="bg-slate-900 border border-white/10 rounded px-1 py-1 text-xs font-bold text-slate-300 w-full text-center focus:ring-0">
                            <span class="text-[8px] text-slate-500 font-bold">%</span>
                        </div>
                    </div>
                </div>

                <div class="flex justify-between items-center pt-3 border-t border-white/5 mt-3">
                    <span class="text-[9px] font-bold text-slate-500 uppercase">Stays in Retirement?</span>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" onchange="window.updateIncomeBool(${i}, 'remainsInRetirement', this.checked); window.haptic();" ${inc.remainsInRetirement ? 'checked' : ''} class="sr-only peer">
                        <div class="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>
        </div>`;
    }).join('');

    el.innerHTML = `
        <div class="space-y-3">
            ${html}
            <button class="section-add-btn" onclick="window.addItem('income')">
                <i class="fas fa-plus"></i> Add Income Stream
            </button>
        </div>
    `;
}

function renderBudget(el) {
    const d = window.currentData;
    const { collapsedSections, budgetMode } = getState();
    const isMonthly = budgetMode === 'monthly';
    const factor = isMonthly ? 1/12 : 1;
    
    // Inject Computed 401k Row (Locked)
    const summaries = engine.calculateSummaries(d);
    const locked401k = {
        type: 'Pre-Tax (401k/IRA)',
        annual: summaries.total401kContribution,
        isLocked: true,
        remainsInRetirement: false
    };
    
    // Virtual Savings List: [Locked, ...UserItems]
    const savingsItems = [locked401k, ...(d.budget.savings || [])];
    const expensesItems = d.budget.expenses || [];

    // Helper to get asset color
    const getTypeColor = (type) => {
        const map = {
            'Cash': 'text-type-cash', 'Taxable': 'text-type-taxable', 'Pre-Tax (401k/IRA)': 'text-type-pretax',
            'Roth IRA': 'text-type-posttax', 'Crypto': 'text-type-crypto', 'Metals': 'text-type-metals', 'HSA': 'text-type-hsa'
        };
        return map[type] || 'text-slate-400';
    };

    const renderSavings = (items) => items.map((item, i) => {
        // Locked row (index 0 in virtual list) vs User rows (index i-1 in real data)
        const isLocked = !!item.isLocked;
        const realIndex = i - 1; 
        const val = item.annual * factor;
        const path = isLocked ? '' : `budget.savings.${realIndex}.annual`;
        const typeClass = getTypeColor(item.type);
        
        // Locked Row Rendering
        if (isLocked) {
            return `
            <div class="swipe-container mb-2 opacity-80">
                <div class="swipe-actions"></div> <!-- No actions for locked row -->
                <div class="swipe-content p-3 border border-white/5 flex items-center gap-3">
                    <div class="flex-grow space-y-1 pt-0.5">
                        <div class="text-[11px] font-bold text-slate-500 uppercase tracking-tight">401k From Income</div>
                        <div class="flex items-center gap-2">
                            <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span class="text-[8px] font-bold text-blue-400 uppercase">Pre-Tax</span>
                        </div>
                    </div>
                    <div class="text-right w-28 flex-shrink-0">
                        <div class="text-sm font-black text-right text-emerald-400 w-full mono-numbers opacity-50">${math.toCurrency(val)}</div>
                        <div class="text-[7px] text-slate-600 font-bold uppercase tracking-wider mt-0.5">Auto-Calculated</div>
                    </div>
                </div>
            </div>`;
        }

        // User Row Rendering
        return `
        <div class="swipe-container mb-2">
            <div class="swipe-actions">
                <button class="swipe-action-btn ${item.remainsInRetirement ? 'bg-emerald-600' : 'bg-slate-700'}" onclick="window.toggleSavingsRetirement(${realIndex})">
                    <div class="flex flex-col items-center justify-center">
                        <span class="text-[7px] font-bold uppercase tracking-tight leading-tight mb-1">Stays in<br>Retirement</span>
                        <i class="fas ${item.remainsInRetirement ? 'fa-check-circle text-white' : 'fa-times-circle text-white/50'} text-lg"></i>
                    </div>
                </button>
                <button class="swipe-action-btn bg-red-600" onclick="window.removeItem('budget.savings', ${realIndex})">Delete</button>
            </div>
            <div class="swipe-content p-3 border border-white/5 flex items-center gap-3">
                <div class="flex-grow space-y-1 pt-0.5">
                    <select data-path="budget.savings.${realIndex}.type" class="bg-slate-900 border border-white/10 rounded-lg text-[10px] font-bold w-full p-1.5 ${typeClass}">
                        <option value="Taxable" ${item.type === 'Taxable' ? 'selected' : ''}>Taxable</option>
                        <option value="Pre-Tax (401k/IRA)" ${item.type === 'Pre-Tax (401k/IRA)' ? 'selected' : ''}>Pre-Tax</option>
                        <option value="Roth IRA" ${item.type === 'Roth IRA' ? 'selected' : ''}>Roth IRA</option>
                        <option value="Cash" ${item.type === 'Cash' ? 'selected' : ''}>Cash</option>
                        <option value="Crypto" ${item.type === 'Crypto' ? 'selected' : ''}>Crypto</option>
                        <option value="Metals" ${item.type === 'Metals' ? 'selected' : ''}>Metals</option>
                        <option value="HSA" ${item.type === 'HSA' ? 'selected' : ''}>HSA</option>
                    </select>
                </div>
                <div class="text-right w-28 flex-shrink-0">
                    <input data-path="${path}" data-type="currency" inputmode="decimal" value="${math.toCurrency(val)}" class="bg-transparent border-none p-0 text-sm font-black text-right text-emerald-400 w-full focus:ring-0">
                </div>
            </div>
        </div>`;
    }).join('');

    const renderExpenses = (items) => items.map((item, i) => {
        const val = item.annual * factor;
        const path = `budget.expenses.${i}.annual`;
        
        return `
        <div class="swipe-container mb-2">
            <div class="swipe-actions">
                <button class="swipe-action-btn bg-slate-700" onclick="window.openAdvancedExpense(${i})">Settings</button>
                <button class="swipe-action-btn bg-red-600" onclick="window.removeItem('budget.expenses', ${i})">Delete</button>
            </div>
            <div class="swipe-content p-3 border border-white/5 flex items-center gap-3">
                <div class="flex-grow space-y-1 pt-0.5">
                    <input data-path="budget.expenses.${i}.name" value="${item.name}" class="bg-transparent border-none p-0 text-[11px] font-bold text-white w-full placeholder:text-slate-600 focus:ring-0 uppercase tracking-tight">
                    <div class="flex gap-2">
                        ${item.remainsInRetirement ? '<span class="text-[7px] font-bold text-blue-400 uppercase bg-blue-500/10 px-1 py-0.5 rounded">Retires</span>' : ''}
                        ${item.isFixed ? '<span class="text-[7px] font-bold text-amber-400 uppercase bg-amber-500/10 px-1 py-0.5 rounded">Fixed</span>' : ''}
                    </div>
                </div>
                <div class="text-right w-28 flex-shrink-0">
                    <input data-path="${path}" data-type="currency" inputmode="decimal" value="${math.toCurrency(val)}" class="bg-transparent border-none p-0 text-sm font-black text-right text-pink-400 w-full focus:ring-0">
                </div>
            </div>
        </div>`;
    }).join('');

    const savingsHtml = `
        ${renderSavings(savingsItems)}
        <button class="section-add-btn" onclick="window.addItem('budget.savings')"><i class="fas fa-plus"></i> Add Savings Goal</button>
    `;
    
    const expensesHtml = `
        ${renderExpenses(expensesItems)}
        <button class="section-add-btn" onclick="window.addItem('budget.expenses')"><i class="fas fa-plus"></i> Add Expense</button>
    `;

    // Totals for Headers
    const totalSave = savingsItems.reduce((acc, i) => acc + (i.annual * factor), 0);
    const totalSpend = expensesItems.reduce((acc, i) => acc + (i.annual * factor), 0);

    el.innerHTML = `
        <div class="space-y-4">
            ${renderCollapsible('savings', 'Savings Targets', savingsHtml, !collapsedSections['savings'], 'fa-piggy-bank', 'text-emerald-400', math.toSmartCompactCurrency(totalSave))}
            ${renderCollapsible('expenses', 'Living Expenses', expensesHtml, !collapsedSections['expenses'], 'fa-credit-card', 'text-pink-400', math.toSmartCompactCurrency(totalSpend))}
        </div>
    `;
}
