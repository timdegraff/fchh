
import { math, engine, assetColors, stateTaxRates, STATE_NAME_TO_CODE } from './utils.js';
import { simulateProjection } from './burndown-engine.js';
import { renderCollapsible, renderStepperSlider } from './mobile-components.js';
import { renderAssets, updateAssetChart } from './mobile-render-assets.js';
import { renderAid, updateAidHeader, updateAidVisuals } from './mobile-render-benefits.js';

// Re-export specific update functions for mobile.js/actions
export { updateAssetChart, updateAidHeader, updateAidVisuals };

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
    
    // Initialize Sortable for reordering with Long Press
    if (typeof Sortable !== 'undefined' && (activeTab === 'assets' || activeTab === 'budget')) {
        document.querySelectorAll('.sortable-list').forEach(list => {
            new Sortable(list, {
                delay: 250, // 250ms Long Press
                delayOnTouchOnly: true,
                animation: 150,
                onChoose: () => window.haptic?.(), 
                onEnd: () => { window.haptic?.(); window.mobileAutoSave?.(); } 
            });
        });
    }
}

export function updateHeader() {
    const left = document.getElementById('header-left');
    const headerEl = document.querySelector('header');
    const toolbar = document.getElementById('header-toolbar');
    
    if (!left || !headerEl) return;

    const { activeTab, budgetMode } = getState();

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

    // Toolbar Logic (Sticky Controls)
    if (activeTab === 'budget') {
        if (toolbar) {
            toolbar.classList.remove('hidden');
            toolbar.innerHTML = `
                <div class="flex justify-center">
                    <div class="flex bg-slate-900/90 p-0.5 rounded-lg border border-white/10">
                        <button onclick="window.setBudgetMode('monthly')" class="px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${budgetMode === 'monthly' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}">Monthly</button>
                        <button onclick="window.setBudgetMode('annual')" class="px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${budgetMode === 'annual' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}">Annual</button>
                    </div>
                </div>
            `;
        }
    } else {
        if (toolbar) {
            toolbar.classList.add('hidden');
            toolbar.innerHTML = '';
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
    
    const { activeTab, incomeDisplayMode, budgetMode } = getState();
    const s = engine.calculateSummaries(window.currentData);
    
    let html = '';
    if (activeTab === 'assets') {
        const color = s.netWorth >= 0 ? 'text-emerald-400' : 'text-red-400';
        html = `
            <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Net Worth</div>
            <div class="font-black ${color} text-lg tracking-tighter mono-numbers">${math.toSmartCompactCurrency(s.netWorth)}</div>
        `;
    } else if (activeTab === 'income') {
        let valToShow, labelToShow, color;
        
        if (incomeDisplayMode === 'current') {
            valToShow = s.totalGrossIncome;
            labelToShow = 'Gross Inc';
            color = 'text-teal-400';
        } else {
            // Calculate Retirement Income logic retained for brevity, same as before
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
    } else if (activeTab === 'fire') {
        html = ''; 
    } else if (activeTab === 'aid') {
        html = '<div id="aid-header-placeholder"></div>';
    }
    
    right.innerHTML = html;
    if (activeTab === 'aid') updateAidHeader();
}

export function renderIncome(el) {
    const d = window.currentData;
    const age = d.assumptions?.currentAge || 40;
    const kLimit = age >= 50 ? 31000 : 23500;

    el.innerHTML = (d.income || []).map((inc, i) => `
        <div class="swipe-container rounded-xl mb-3">
            <div class="swipe-actions rounded-xl overflow-hidden">
                <button class="swipe-action-btn bg-slate-700" onclick="window.openAdvancedIncome(${i})">Settings</button>
                <button class="swipe-action-btn bg-red-600" onclick="window.removeItem('income', ${i})">Delete</button>
            </div>
            <div class="swipe-content mobile-card !mb-0 rounded-xl overflow-hidden">
                <div class="flex justify-between items-start mb-4 border-b border-white/5 pb-3">
                    <input data-path="income.${i}.name" value="${inc.name}" class="bg-transparent text-sm font-black text-white w-full border-none p-0 focus:ring-0 uppercase tracking-tight" placeholder="SOURCE NAME">
                    <label class="flex items-center gap-1.5">
                        <input type="checkbox" data-path="income.${i}.remainsInRetirement" ${inc.remainsInRetirement ? 'checked' : ''} class="w-3 h-3 rounded bg-slate-700 border-none text-blue-500">
                        <span class="text-[8px] font-bold text-slate-500 uppercase">Retirement?</span>
                    </label>
                </div>
                <div class="flex gap-4 mb-4">
                    <div class="flex-grow">
                        <label class="block text-[8px] font-bold text-slate-500 uppercase mb-1">Gross Annual</label>
                        <input data-path="income.${i}.amount" data-type="currency" inputmode="decimal" value="${math.toCurrency(inc.isMonthly ? inc.amount * 12 : inc.amount)}" class="w-full p-2 bg-black/20 rounded-lg text-teal-400 font-black text-sm text-left">
                    </div>
                     <div class="w-32">
                        <label class="block text-[8px] font-bold text-slate-500 uppercase mb-1">Annual Raise</label>
                        <div class="flex items-center bg-black/20 rounded-lg">
                            <button class="stepper-btn" onclick="window.stepValue('income.${i}.increase', -0.5)">-</button>
                            <input data-path="income.${i}.increase" data-type="percent" inputmode="decimal" value="${inc.increase}%" class="w-full p-2 bg-transparent text-white stepper-input text-center border-none focus:ring-0">
                            <button class="stepper-btn" onclick="window.stepValue('income.${i}.increase', 0.5)">+</button>
                        </div>
                    </div>
                </div>
                
                <div class="bg-slate-800/50 p-3 rounded-xl border border-white/5">
                    <div class="grid grid-cols-3 gap-2">
                        <div>
                            <div class="flex items-center justify-center gap-1 mb-1">
                                <span class="text-[8px] font-bold text-slate-400 uppercase">401k %</span>
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-[10px] hidden" id="warn-401k-${i}" onclick="alert('Exceeds 2026 IRS Limit of ${math.toCurrency(kLimit)}')"></i>
                            </div>
                            <div class="flex items-center bg-black/20 rounded-lg">
                                <button class="stepper-btn" onclick="window.stepValue('income.${i}.contribution', -1)">-</button>
                                <input data-path="income.${i}.contribution" data-type="percent" inputmode="decimal" value="${inc.contribution}%" class="w-full py-1 bg-transparent text-blue-400 stepper-input text-center border-none p-0 focus:ring-0">
                                <button class="stepper-btn" onclick="window.stepValue('income.${i}.contribution', 1)">+</button>
                            </div>
                        </div>
                        <div>
                            <span class="text-[8px] font-bold text-slate-400 uppercase block mb-1 text-center">Match %</span>
                            <div class="flex items-center bg-black/20 rounded-lg">
                                <button class="stepper-btn" onclick="window.stepValue('income.${i}.match', -1)">-</button>
                                <input data-path="income.${i}.match" data-type="percent" inputmode="decimal" value="${inc.match}%" class="w-full py-1 bg-transparent text-white stepper-input text-center border-none p-0 focus:ring-0">
                                <button class="stepper-btn" onclick="window.stepValue('income.${i}.match', 1)">+</button>
                            </div>
                        </div>
                        <div>
                            <span class="text-[8px] font-bold text-slate-400 uppercase block mb-1 text-center">Bonus %</span>
                            <div class="flex items-center bg-black/20 rounded-lg">
                                <button class="stepper-btn" onclick="window.stepValue('income.${i}.bonusPct', -1)">-</button>
                                <input data-path="income.${i}.bonusPct" data-type="percent" inputmode="decimal" value="${inc.bonusPct}%" class="w-full py-1 bg-transparent text-white stepper-input text-center border-none p-0 focus:ring-0">
                                <button class="stepper-btn" onclick="window.stepValue('income.${i}.bonusPct', 1)">+</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add Income Button
    el.innerHTML += `
        <button class="section-add-btn" onclick="window.addItem('income')">
            <i class="fas fa-plus"></i> Add Income Stream
        </button>
    `;
    
    d.income.forEach((inc, i) => {
        const annual = inc.amount * (inc.isMonthly ? 12 : 1);
        if ((annual * (inc.contribution/100)) > kLimit) {
            document.getElementById(`warn-401k-${i}`)?.classList.remove('hidden');
        }
    });
}

export function renderBudget(el) {
    const d = window.currentData;
    const { budgetMode, collapsedSections } = getState();
    const isMon = budgetMode === 'monthly';
    const factor = isMon ? 1/12 : 1;
    const valClass = isMon ? 'text-budget-monthly' : 'text-budget-annual';

    const renderRow = (item, i, type) => {
        let val = (type === 'savings' ? item.annual : item.annual) * factor;
        let warningHtml = '';
        if (type === 'savings' && item.type === 'HSA') {
            const hsaLimit = 8550;
            if (item.annual > hsaLimit) {
                warningHtml = `<i class="fas fa-exclamation-triangle text-yellow-500 text-[10px] absolute top-1 right-1" onclick="alert('Exceeds 2026 HSA Family Limit of $8,550')"></i>`;
            }
        }

        const getTypeColor = (t) => {
            const map = {
                'Cash': 'text-type-cash', 'Taxable': 'text-type-taxable', 'Pre-Tax (401k/IRA)': 'text-type-pretax',
                'Roth IRA': 'text-type-posttax', 'Crypto': 'text-type-crypto', 'Metals': 'text-type-metals', 'HSA': 'text-type-hsa'
            };
            return map[t] || 'text-slate-400';
        };

        const bgClass = item.isLocked ? 'bg-[#1e293b]' : 'bg-[#1e293b]';
        const disabledAttr = item.isLocked ? 'disabled style="pointer-events: none;"' : '';
        const opacityClass = item.isLocked ? '' : ''; 

        return `
        <div class="swipe-container relative">
            ${warningHtml}
            <div class="swipe-actions">
                ${type === 'expenses' ? `
                <button class="swipe-action-btn bg-slate-700 flex flex-col gap-1" onclick="window.toggleBudgetBool('${type}', ${i}, 'remainsInRetirement')">
                    <span class="text-[8px] opacity-60">Retire?</span>
                    <i class="fas ${item.remainsInRetirement ? 'fa-check text-emerald-400' : 'fa-times text-slate-500'}"></i>
                </button>
                <button class="swipe-action-btn bg-slate-800 flex flex-col gap-1" onclick="window.toggleBudgetBool('${type}', ${i}, 'isFixed')">
                    <span class="text-[8px] opacity-60">Fixed?</span>
                    <i class="fas ${item.isFixed ? 'fa-check text-blue-400' : 'fa-times text-slate-500'}"></i>
                </button>
                ` : `
                <button class="swipe-action-btn bg-slate-700 flex flex-col gap-1" onclick="window.toggleBudgetBool('${type}', ${i}, 'remainsInRetirement')">
                    <span class="text-[8px] opacity-60">Retire?</span>
                    <i class="fas ${item.remainsInRetirement ? 'fa-check text-emerald-400' : 'fa-times text-slate-500'}"></i>
                </button>
                `}
                <button class="swipe-action-btn bg-red-600" onclick="window.removeItem('budget.${type}', ${i})">Delete</button>
            </div>
            <div class="swipe-content ${bgClass} ${opacityClass} border-b border-white/5 py-3 flex items-center justify-between">
                <div class="drag-handle text-slate-600 px-2" ${item.isLocked ? 'style="visibility:hidden"' : ''}><i class="fas fa-grip-vertical"></i></div>
                <div class="flex-grow">
                     ${type === 'savings' ? `
                        <div class="relative">
                            <select data-path="budget.savings.${i}.type" class="bg-transparent border-none p-0 text-xs font-bold uppercase w-full cursor-pointer focus:ring-0 ${getTypeColor(item.type)}" ${disabledAttr}>
                                <option value="Taxable" ${item.type === 'Taxable' ? 'selected' : ''}>Taxable</option>
                                <option value="Pre-Tax (401k/IRA)" ${item.type === 'Pre-Tax (401k/IRA)' ? 'selected' : ''}>Pre-Tax</option>
                                <option value="Roth IRA" ${item.type === 'Roth IRA' ? 'selected' : ''}>Roth IRA</option>
                                <option value="Cash" ${item.type === 'Cash' ? 'selected' : ''}>Cash</option>
                                <option value="Crypto" ${item.type === 'Crypto' ? 'selected' : ''}>Crypto</option>
                                <option value="Metals" ${item.type === 'Metals' ? 'selected' : ''}>Metals</option>
                                <option value="HSA" ${item.type === 'HSA' ? 'selected' : ''}>HSA</option>
                            </select>
                        </div>
                     ` : `
                        <input data-path="budget.${type}.${i}.name" value="${item.name}" class="bg-transparent border-none p-0 text-xs font-bold text-white w-full focus:ring-0">
                     `}
                </div>
                <div class="text-right">
                    <input data-path="budget.${type}.${i}.annual" data-type="currency" inputmode="decimal" value="${math.toCurrency(val)}" class="bg-transparent border-none p-0 text-sm font-black text-right ${valClass} w-28 focus:ring-0 pr-1" ${disabledAttr}>
                </div>
            </div>
        </div>`;
    };

    const s = engine.calculateSummaries(d);
    const auto401k = { type: 'Pre-Tax (401k/IRA)', annual: s.total401kContribution, monthly: s.total401kContribution/12, isLocked: true };
    const savingsList = (d.budget?.savings || []).filter(s => !s.isLocked);
    
    // Using renderCollapsible for Budget Sections
    const savingsContent = `
        ${renderRow(auto401k, -1, 'savings')}
        ${savingsList.map((s, i) => renderRow(s, i, 'savings')).join('')}
        <button class="section-add-btn" onclick="window.addItem('budget.savings')">
            <i class="fas fa-plus"></i> Add Savings
        </button>
    `;

    const expensesContent = `
        ${(d.budget?.expenses || []).map((s, i) => renderRow(s, i, 'expenses')).join('')}
        <button class="section-add-btn" onclick="window.addItem('budget.expenses')">
            <i class="fas fa-plus"></i> Add Expense
        </button>
    `;

    el.innerHTML = `
        ${renderCollapsible('Savings', 'SAVINGS', savingsContent, !collapsedSections['Savings'], null, 'text-white', '', 'bg-black/20')}
        ${renderCollapsible('Expenses', 'EXPENSES', expensesContent, !collapsedSections['Expenses'], null, 'text-white', '', 'bg-black/20')}
    `;
}

export function renderConfig(el) {
    const a = window.currentData.assumptions;
    const { collapsedSections } = getState();
    
    const personalContent = `
        <div class="grid grid-cols-2 gap-3 mb-4">
            <label class="block">
                <span class="text-[10px] font-bold text-slate-500 uppercase block mb-1">State</span>
                <select data-path="assumptions.state" class="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white">
                    ${Object.keys(stateTaxRates || {}).sort().map(s => {
                        const abbr = STATE_NAME_TO_CODE[s] || s;
                        return `<option value="${s}" ${a.state === s ? 'selected' : ''}>${abbr}</option>`;
                    }).join('')}
                </select>
            </label>
             <label class="block">
                <span class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Filing</span>
                <select data-path="assumptions.filingStatus" class="w-full p-2 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white">
                    <option value="Single" ${a.filingStatus === 'Single' ? 'selected' : ''}>Single</option>
                    <option value="Married Filing Jointly" ${a.filingStatus === 'Married Filing Jointly' ? 'selected' : ''}>Married Jointly</option>
                    <option value="Head of Household" ${a.filingStatus === 'Head of Household' ? 'selected' : ''}>Head of Household</option>
                </select>
            </label>
        </div>
        ${renderStepperSlider('Current Age', 'currentAge', 18, 80, 1, a.currentAge, '', 'text-white')}
        ${renderStepperSlider('Retirement Age', 'retirementAge', 18, 80, 1, a.retirementAge, '', 'text-blue-400')}
        ${renderStepperSlider('SS Start Age', 'ssStartAge', 62, 70, 1, a.ssStartAge, '', 'text-teal-400')}
        ${renderStepperSlider('SS Monthly', 'ssMonthly', 0, 5000, 100, a.ssMonthly, '', 'text-teal-400')}
    `;

    const marketContent = `
        ${renderStepperSlider('Stocks (APY)', 'stockGrowth', 0, 15, 0.5, a.stockGrowth, '%', 'text-blue-400')}
        ${renderStepperSlider('Crypto (APY)', 'cryptoGrowth', 0, 15, 0.5, a.cryptoGrowth, '%', 'text-slate-400')}
        ${renderStepperSlider('Metals (APY)', 'metalsGrowth', 0, 15, 0.5, a.metalsGrowth || 6, '%', 'text-amber-400')}
        ${renderStepperSlider('Real Estate (APY)', 'realEstateGrowth', 0, 10, 0.5, a.realEstateGrowth, '%', 'text-indigo-400')}
        ${renderStepperSlider('Inflation', 'inflation', 0, 10, 0.1, a.inflation, '%', 'text-red-400')}
    `;

    const phasesContent = `
        ${renderStepperSlider('Go-Go (Age 60-70)', 'phaseGo1', 50, 150, 5, Math.round((a.phaseGo1 || 1.0) * 100), '%', 'text-purple-400')}
        ${renderStepperSlider('Slow-Go (Age 70-80)', 'phaseGo2', 50, 150, 5, Math.round((a.phaseGo2 || 0.9) * 100), '%', 'text-purple-400')}
        ${renderStepperSlider('No-Go (Age 80+)', 'phaseGo3', 50, 150, 5, Math.round((a.phaseGo3 || 0.8) * 100), '%', 'text-purple-400')}
    `;

    // Wrap contents in Collapsible helper
    el.innerHTML = `
        ${renderCollapsible('PersonalConfig', 'PERSONAL', personalContent, !collapsedSections['PersonalConfig'], null, 'text-white')}
        ${renderCollapsible('MarketConfig', 'MARKET', marketContent, !collapsedSections['MarketConfig'], null, 'text-white')}
        ${renderCollapsible('PhaseConfig', 'RETIREMENT PHASES', phasesContent, !collapsedSections['PhaseConfig'], null, 'text-white')}
        
        <div class="mt-8 p-4 bg-red-900/10 border border-red-500/20 rounded-xl text-center">
            <button onclick="if(confirm('Reset all data?')) { localStorage.removeItem('firecalc_data'); window.location.reload(); }" class="text-red-400 font-bold uppercase text-xs tracking-widest">
                Reset to Defaults
            </button>
        </div>
    `;
}

export function renderFire(el) {
    if (!window.currentData) return;
    const { collapsedSections } = getState();
    const s = engine.calculateSummaries(window.currentData);
    const results = simulateProjection(window.currentData, { 
        strategyMode: window.currentData.burndown?.strategyMode || 'RAW',
        manualBudget: s.totalAnnualBudget,
        useSync: true,
        priority: ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings']
    });

    // Fire Table is raw HTML for now, could be componentized later if needed
    const fireTable = `
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

    const traceContent = `
        <div class="p-4 bg-black/20 font-mono text-[10px] text-slate-400 max-h-60 overflow-y-auto">
            <div class="flex items-center gap-2 mb-2">
                <span>Year:</span>
                <input type="number" id="trace-year-input" class="bg-slate-800 text-white w-16 p-1 rounded" value="${new Date().getFullYear()}">
            </div>
            <div id="mobile-trace-output"></div>
        </div>
    `;

    el.innerHTML = `
        ${fireTable}
        <div class="mt-8">
            ${renderCollapsible('trace', 'Logic Trace', traceContent, !collapsedSections['trace'])}
        </div>
    `;
    
    setTimeout(() => {
        const inp = document.getElementById('trace-year-input');
        if (inp) {
            inp.oninput = () => {
                const y = parseInt(inp.value);
                const r = results.find(x => x.year === y);
                const out = document.getElementById('mobile-trace-output');
                if (out) out.innerHTML = r ? r.traceLog.join('<br>') : 'No Data';
            };
            inp.dispatchEvent(new Event('input'));
        }
    }, 100);
}
