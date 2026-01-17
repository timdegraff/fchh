
// v5.1.2 Bump
import { math, engine, assetColors, stateTaxRates, STATE_NAME_TO_CODE } from './utils.js';
import { simulateProjection } from './burndown-engine.js';
import { calculateDieWithZero } from './burndown-dwz.js';
import { renderCollapsible, renderStepperSlider } from './mobile-components.js';
import { renderAssets, updateAssetChart } from './mobile-render-assets.js';
import { renderAid, updateAidHeader, updateAidVisuals } from './mobile-render-benefits.js';
import { renderTrace } from './burndown-render.js';

// Re-export specific update functions for mobile.js/actions
export { updateAssetChart, updateAidHeader, updateAidVisuals };

// Constants
const assetMeta = {
    'cash': { label: 'Cash', short: 'Cash', color: assetColors['Cash'], isTaxable: false },
    'taxable': { label: 'Brokerage', short: 'Brokerage', color: assetColors['Taxable'], isTaxable: true }, 
    'roth-basis': { label: 'Roth Basis', short: 'Roth Basis', color: assetColors['Roth IRA'], isTaxable: false },
    'heloc': { label: 'HELOC', short: 'HELOC', color: assetColors['HELOC'], isTaxable: false },
    '401k': { label: '401k/IRA', short: '401k/IRA', color: assetColors['Pre-Tax (401k/IRA)'], isTaxable: true },
    'roth-earnings': { label: 'Roth Gains', short: 'Roth Gains', color: assetColors['Roth IRA'], isTaxable: false },
    'crypto': { label: 'Crypto', short: 'Crypto', color: assetColors['Crypto'], isTaxable: true },
    'metals': { label: 'Metals', short: 'Metals', color: assetColors['Metals'], isTaxable: true },
    'hsa': { label: 'HSA', short: 'HSA', color: assetColors['HSA'], isTaxable: false }
};
const defaultPriorityOrder = ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings'];

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
        
        // Inject FIRE Summary Cards into the sticky header toolbar
        if (toolbar) {
            const s = engine.calculateSummaries(d);
            const strategyMode = d.burndown?.strategyMode || 'RAW';
            const snapPreserve = d.burndown?.snapPreserve || 0;
            
            // Run headless simulation for metrics
            const results = simulateProjection(d, { 
                strategyMode: strategyMode,
                manualBudget: s.totalAnnualBudget,
                useSync: true,
                priority: ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings']
            });
            const dwzVal = calculateDieWithZero(d, { 
                strategyMode, 
                cashReserve: d.burndown?.cashReserve || 0,
                snapPreserve,
                useSync: true
            }, {});

            const currentAge = parseFloat(d.assumptions.currentAge) || 40;
            const insolvencyAge = results.firstInsolvencyAge;
            const runway = insolvencyAge ? (insolvencyAge - currentAge) : null;
            const presAge = insolvencyAge ? insolvencyAge : "100+";
            const runVal = runway !== null ? `${runway} Yrs` : "Forever";

            toolbar.innerHTML = `
                <div class="grid grid-cols-3 gap-2 px-1">
                    <div class="bg-slate-900/50 rounded-xl border border-slate-800 p-2 flex flex-col items-center justify-center text-center">
                        <i class="fas fa-shield-alt text-amber-500 text-[10px] mb-1"></i>
                        <div class="text-[8px] font-bold text-slate-500 uppercase tracking-tight">Preservation</div>
                        <div class="text-sm font-black text-amber-500 mono-numbers leading-none mt-0.5">${presAge}</div>
                    </div>
                    <div class="bg-slate-900/50 rounded-xl border border-slate-800 p-2 flex flex-col items-center justify-center text-center">
                        <i class="fas fa-road text-blue-400 text-[10px] mb-1"></i>
                        <div class="text-[8px] font-bold text-slate-500 uppercase tracking-tight">Runway</div>
                        <div class="text-sm font-black text-blue-400 mono-numbers leading-none mt-0.5">${runVal}</div>
                    </div>
                    <div class="bg-slate-900/50 rounded-xl border border-slate-800 p-2 flex flex-col items-center justify-center text-center">
                        <i class="fas fa-skull text-pink-400 text-[10px] mb-1"></i>
                        <div class="text-[8px] font-bold text-slate-500 uppercase tracking-tight">Die With $0</div>
                        <div class="text-sm font-black text-pink-400 mono-numbers leading-none mt-0.5">${math.toSmartCompactCurrency(dwzVal)}</div>
                    </div>
                </div>
            `;
            toolbar.classList.remove('hidden');
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

export function renderPriorityList() {
    const listEl = document.getElementById('priority-list-content');
    if (!listEl || !window.currentData) return;
    
    // Ensure priority exists
    if (!window.currentData.burndown) window.currentData.burndown = {};
    if (!window.currentData.burndown.priority) window.currentData.burndown.priority = [...defaultPriorityOrder];
    
    const priority = window.currentData.burndown.priority;
    
    listEl.innerHTML = priority.map((key, i) => {
        const meta = assetMeta[key] || { label: key, color: '#64748b' };
        return `
            <div class="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full" style="background-color: ${meta.color}"></div>
                    <span class="text-sm font-bold text-white">${meta.label}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.movePriorityItem(${i}, -1)" class="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg text-slate-400 hover:text-white" ${i === 0 ? 'disabled style="opacity:0.3"' : ''}>
                        <i class="fas fa-chevron-up"></i>
                    </button>
                    <button onclick="window.movePriorityItem(${i}, 1)" class="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg text-slate-400 hover:text-white" ${i === priority.length - 1 ? 'disabled style="opacity:0.3"' : ''}>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

export function renderFire(el) {
    if (!window.currentData) return;
    const { collapsedSections } = getState();
    const d = window.currentData;
    const s = engine.calculateSummaries(d);
    
    // Config Extraction (Force RAW/Iron Fist for now)
    const strategyMode = 'RAW'; 
    if (d.burndown) d.burndown.strategyMode = 'RAW';
    
    // Ensure Priority is set
    if (!d.burndown) d.burndown = {};
    if (!d.burndown.priority) d.burndown.priority = [...defaultPriorityOrder];
    
    const results = simulateProjection(d, { 
        strategyMode: strategyMode,
        manualBudget: s.totalAnnualBudget,
        useSync: true,
        priority: d.burndown.priority || defaultPriorityOrder
    });

    const priorityOrder = d.burndown.priority;

    // Helper for Asset Cells in the Table
    // IMPLEMENTATION OF "BURN PATH" HIGHLIGHTING
    const renderAssetCells = (r) => {
        return priorityOrder.map(k => {
            const meta = assetMeta[k];
            const draw = r.draws[k] || 0;
            const bal = r.balances[k] || 0;
            
            // ACTIVE BURN CELL
            if (draw > 50) {
                // Dynamic Styles using Asset Color
                const border = `border: 1px solid ${meta.color}60;`;
                const bg = `background: linear-gradient(180deg, ${meta.color}20 0%, ${meta.color}05 100%);`;
                const glow = `box-shadow: 0 0 10px -2px ${meta.color}40;`;
                
                return `
                    <td class="p-1 align-middle text-center">
                        <div class="flex flex-col items-center justify-center py-1.5 px-1 rounded-lg relative overflow-hidden group min-w-[40px]" style="${border} ${bg} ${glow}">
                            <!-- Active Indicator Dot -->
                            <div class="absolute top-1 right-1 w-1 h-1 rounded-full animate-pulse" style="background-color: ${meta.color}"></div>
                            
                            <!-- Draw Amount (Negative) -->
                            <span class="text-[10px] font-black tracking-tight leading-none mb-0.5" style="color: ${meta.color}; text-shadow: 0 0 8px ${meta.color}30;">
                                -${math.toSmartCompactCurrency(draw)}
                            </span>
                            
                            <!-- Remaining Balance (Subtle) -->
                            <span class="text-[7px] font-bold text-white/50 mono-numbers leading-none">
                                ${math.toSmartCompactCurrency(bal)}
                            </span>
                        </div>
                    </td>`;
            } 
            // DORMANT ASSET (Has Balance, No Draw)
            else if (bal > 100) {
                return `
                    <td class="p-1 align-middle text-center">
                        <div class="py-1">
                            <span class="text-[8px] font-bold text-slate-500 hover:text-slate-300 transition-colors cursor-default">
                                ${math.toSmartCompactCurrency(bal)}
                            </span>
                        </div>
                    </td>`;
            } 
            // DEPLETED ASSET
            else {
                return `
                    <td class="p-1 align-middle text-center">
                        <span class="text-[8px] text-slate-800/50 font-bold select-none">·</span>
                    </td>`;
            }
        }).join('');
    };

    const fireTable = `
        <div class="mobile-card p-0 overflow-hidden mt-4 bg-[#0B0F19] border border-white/10">
            <div class="overflow-x-auto">
                <table class="fire-table w-full whitespace-nowrap">
                    <thead class="bg-slate-900/90 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-white/10">
                        <tr>
                            <th class="sticky left-0 bg-[#1e293b] z-20 px-3 py-2 text-center shadow-[2px_0_5px_rgba(0,0,0,0.3)]">Age</th>
                            <th class="px-3 py-2 text-center">Budget</th>
                            <th class="px-3 py-2 text-center">Status</th>
                            <th class="px-3 py-2 text-center text-teal-400">Income</th>
                            <th class="px-3 py-2 text-center text-emerald-500">Aid</th>
                            <th class="px-3 py-2 text-center text-white cursor-pointer hover:bg-white/5 transition-colors bg-white/5 border border-white/10 rounded" onclick="window.openPriorityModal()">
                                <i class="fas fa-sort mr-1 text-[8px]"></i> Draw
                            </th>
                            <th class="px-3 py-2 text-center text-teal-400">Net Worth</th>
                            <th class="px-3 py-2 text-center text-red-400">Tax</th>
                            ${priorityOrder.map(k => `<th class="px-3 py-2 text-center text-[9px]" style="color:${assetMeta[k].color}">${assetMeta[k].short}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5 text-[10px]">
                        ${results.map(r => {
                            const totalDraw = Object.values(r.draws).reduce((a, b) => a + b, 0);
                            return `
                            <tr class="${r.status === 'INSOLVENT' ? 'bg-red-900/10' : ''}">
                                <td class="sticky left-0 bg-[#1e293b] z-10 px-3 py-2 font-bold text-white text-center shadow-[2px_0_5px_rgba(0,0,0,0.3)] border-r border-white/5">
                                    ${r.age}
                                </td>
                                <td class="px-3 py-2 text-center font-medium text-slate-300">
                                    ${math.toSmartCompactCurrency(r.budget)}
                                </td>
                                <td class="px-3 py-2 text-center">
                                    <span class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${r.status === 'INSOLVENT' ? 'bg-red-500/20 text-red-400' : (r.status.includes('Platinum') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400')}">
                                        ${r.status.substring(0,8)}
                                    </span>
                                </td>
                                <td class="px-3 py-2 text-center font-bold text-teal-400">
                                    ${math.toSmartCompactCurrency(r.floorGross)}
                                </td>
                                <td class="px-3 py-2 text-center font-bold text-emerald-500">
                                    ${math.toSmartCompactCurrency(r.snap)}
                                </td>
                                <td class="px-3 py-2 text-center font-black text-white bg-white/5">
                                    ${math.toSmartCompactCurrency(totalDraw)}
                                </td>
                                <td class="px-3 py-2 text-center font-black text-teal-400">
                                    ${math.toSmartCompactCurrency(r.netWorth)}
                                </td>
                                <td class="px-3 py-2 text-center font-bold text-red-400">
                                    ${math.toSmartCompactCurrency(r.taxes)}
                                </td>
                                ${renderAssetCells(r)}
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const traceContent = `
        <div class="p-2 bg-black/20">
            <div class="flex items-center justify-between mb-4 bg-slate-900/50 p-2 rounded-xl border border-white/5">
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-2">Simulation Year</span>
                <div class="flex items-center gap-1 bg-black/40 rounded-lg p-1">
                    <button class="w-8 h-8 flex items-center justify-center bg-white/5 rounded-md text-slate-400 hover:text-white active:bg-white/10" onclick="const el=document.getElementById('trace-year-input'); el.stepDown(); el.dispatchEvent(new Event('input'))"><i class="fas fa-minus text-[10px]"></i></button>
                    <input type="number" id="trace-year-input" class="bg-transparent border-none text-blue-400 font-black text-lg w-16 text-center p-0 mono-numbers focus:ring-0" value="${new Date().getFullYear()}">
                    <button class="w-8 h-8 flex items-center justify-center bg-white/5 rounded-md text-slate-400 hover:text-white active:bg-white/10" onclick="const el=document.getElementById('trace-year-input'); el.stepUp(); el.dispatchEvent(new Event('input'))"><i class="fas fa-plus text-[10px]"></i></button>
                </div>
            </div>
            <div id="mobile-trace-output" class="space-y-4 text-xs"></div>
        </div>
    `;

    el.innerHTML = `
        ${fireTable}
        <div class="mt-8">
            ${renderCollapsible('trace', 'Logic Trace', traceContent, !collapsedSections['trace'], 'fa-terminal', 'text-slate-400')}
        </div>
    `;
    
    setTimeout(() => {
        const inp = document.getElementById('trace-year-input');
        if (inp) {
            inp.oninput = () => {
                const y = parseInt(inp.value);
                const out = document.getElementById('mobile-trace-output');
                if (out) renderTrace(out, results, y);
            };
            inp.dispatchEvent(new Event('input'));
        }
    }, 100);
}

// --- MISSING RENDER FUNCTIONS ---

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
    
    const renderList = (items, type) => {
        if (!items || !items.length) return '<div class="text-[10px] text-slate-600 text-center italic py-2">No items added</div>';
        return items.map((item, i) => {
            const val = item.annual * factor;
            const path = `budget.${type}.${i}.annual`;
            const isSavings = type === 'savings';
            
            return `
            <div class="swipe-container mb-2">
                <div class="swipe-actions">
                    <button class="swipe-action-btn bg-red-600" onclick="window.removeItem('budget.${type}', ${i})">Delete</button>
                </div>
                <div class="swipe-content flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                    <div class="flex-grow pr-4">
                        ${isSavings ? `
                            <div class="flex items-center gap-2 mb-1">
                                <div class="w-1.5 h-1.5 rounded-full ${item.type === 'Pre-Tax (401k/IRA)' ? 'bg-blue-500' : (item.type === 'Roth IRA' ? 'bg-purple-500' : 'bg-emerald-500')}"></div>
                                <select data-path="budget.savings.${i}.type" class="bg-transparent border-none p-0 text-xs font-black uppercase tracking-wider text-white focus:ring-0 cursor-pointer w-full" ${item.isLocked ? 'disabled' : ''}>
                                    <option value="Taxable" ${item.type === 'Taxable' ? 'selected' : ''}>Taxable</option>
                                    <option value="Pre-Tax (401k/IRA)" ${item.type === 'Pre-Tax (401k/IRA)' ? 'selected' : ''}>Pre-Tax</option>
                                    <option value="Roth IRA" ${item.type === 'Roth IRA' ? 'selected' : ''}>Roth IRA</option>
                                    <option value="HSA" ${item.type === 'HSA' ? 'selected' : ''}>HSA</option>
                                    <option value="Cash" ${item.type === 'Cash' ? 'selected' : ''}>Cash</option>
                                    <option value="Crypto" ${item.type === 'Crypto' ? 'selected' : ''}>Crypto</option>
                                </select>
                            </div>
                        ` : `
                            <input data-path="budget.${type}.${i}.name" value="${item.name}" class="bg-transparent border-none p-0 text-xs font-bold text-white w-full placeholder:text-slate-600 focus:ring-0 mb-1" placeholder="Expense Name">
                        `}
                        
                        <div class="flex gap-2">
                            ${type === 'expenses' ? `
                                <button onclick="window.toggleBudgetBool('${type}', ${i}, 'remainsInRetirement')" class="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${item.remainsInRetirement ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}">
                                    ${item.remainsInRetirement ? 'Retires' : 'Ends'}
                                </button>
                                <button onclick="window.toggleBudgetBool('${type}', ${i}, 'isFixed')" class="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${item.isFixed ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'}">
                                    ${item.isFixed ? 'Fixed' : 'Inflates'}
                                </button>
                            ` : `
                                <span class="text-[8px] font-bold uppercase text-slate-600">${item.remainsInRetirement ? 'Active in Ret' : 'Accum Only'}</span>
                            `}
                        </div>
                    </div>
                    <div class="w-28 text-right">
                        <input data-path="${path}" data-type="currency" inputmode="decimal" value="${math.toCurrency(val)}" class="bg-transparent border-none p-0 text-lg font-black text-right ${isSavings ? 'text-emerald-400' : 'text-pink-400'} w-full focus:ring-0" ${item.isLocked ? 'disabled opacity-50' : ''}>
                    </div>
                </div>
            </div>`;
        }).join('');
    };

    const savingsHtml = `
        ${renderList(d.budget.savings, 'savings')}
        <button class="section-add-btn" onclick="window.addItem('budget.savings')"><i class="fas fa-plus"></i> Add Savings Goal</button>
    `;
    
    const expensesHtml = `
        ${renderList(d.budget.expenses, 'expenses')}
        <button class="section-add-btn" onclick="window.addItem('budget.expenses')"><i class="fas fa-plus"></i> Add Expense</button>
    `;

    el.innerHTML = `
        <div class="space-y-4">
            ${renderCollapsible('savings', 'Savings Targets', savingsHtml, !collapsedSections['savings'], 'fa-piggy-bank', 'text-emerald-400')}
            ${renderCollapsible('expenses', 'Living Expenses', expensesHtml, !collapsedSections['expenses'], 'fa-credit-card', 'text-pink-400')}
        </div>
    `;
}

function renderConfig(el) {
    const a = window.currentData.assumptions;
    const { collapsedSections } = getState();

    const sections = [
        {
            id: 'timeline', title: 'TIMELINE & PROFILE', icon: 'fa-clock', color: 'text-blue-400',
            content: `
                ${renderStepperSlider('Current Age', 'assumptions.currentAge', 18, 70, 1, a.currentAge, '')}
                ${renderStepperSlider('Retirement Age', 'assumptions.retirementAge', 30, 80, 1, a.retirementAge, '', 'text-blue-400')}
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
                ${renderStepperSlider('Stock Growth', 'assumptions.stockGrowth', 0, 15, 0.5, a.stockGrowth, '%', 'text-blue-400')}
                ${renderStepperSlider('Real Estate', 'assumptions.realEstateGrowth', 0, 10, 0.5, a.realEstateGrowth, '%', 'text-indigo-400')}
                ${renderStepperSlider('Crypto Growth', 'assumptions.cryptoGrowth', 0, 20, 1, a.cryptoGrowth, '%', 'text-slate-400')}
                ${renderStepperSlider('Metals Growth', 'assumptions.metalsGrowth', 0, 15, 0.5, a.metalsGrowth, '%', 'text-amber-500')}
                ${renderStepperSlider('Inflation', 'assumptions.inflation', 0, 10, 0.1, a.inflation, '%', 'text-red-400')}
            `
        },
        {
            id: 'phases', title: 'SPENDING PHASES', icon: 'fa-walking', color: 'text-purple-400',
            content: `
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
