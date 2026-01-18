
import { math, engine, assetColors } from './utils.js';
import { simulateProjection } from './burndown-engine.js';
import { calculateDieWithZero } from './burndown-dwz.js';
import { renderTrace, assetMeta } from './burndown-render.js';
import { renderCollapsible, renderStepperSlider } from './mobile-components.js';

// Helper to access state
const getState = () => window.mobileState;

export function renderFire(el) {
    const d = window.currentData;
    if (!d) return;
    const { collapsedSections } = getState();
    const s = engine.calculateSummaries(d);
    
    // 1. Setup Configuration Defaults if missing
    if (!d.burndown) d.burndown = {};
    if (!d.burndown.priority) d.burndown.priority = ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings'];
    const strategyMode = d.burndown.strategyMode || 'RAW';
    const isIronFist = strategyMode === 'RAW';

    // 2. Run Simulation
    const results = simulateProjection(d, { 
        strategyMode: strategyMode,
        manualBudget: s.totalAnnualBudget, // Or sync logic
        useSync: true,
        priority: d.burndown.priority,
        cashReserve: d.burndown.cashReserve || 0,
        snapPreserve: d.burndown.snapPreserve || 0
    });

    // 3. Calculate Hero Metrics
    const currentAge = parseFloat(d.assumptions.currentAge) || 40;
    const insolvencyAge = results.firstInsolvencyAge;
    const runway = insolvencyAge ? (insolvencyAge - currentAge) : null;
    const presAgeVal = insolvencyAge ? insolvencyAge : "100+";
    const runVal = runway !== null ? `${runway} Yrs` : "Forever";
    
    // Die With Zero Calc (Headless)
    const dwzVal = calculateDieWithZero(d, { 
        strategyMode, 
        cashReserve: d.burndown.cashReserve || 0,
        snapPreserve: d.burndown.snapPreserve || 0,
        useSync: true 
    }, {});

    // --- HTML GENERATION ---

    // A. HERO CARDS
    const heroSection = `
        <div class="grid grid-cols-3 gap-2 mb-4">
            <div class="mobile-card !p-2 flex flex-col items-center justify-center text-center bg-amber-900/10 border-amber-500/20">
                <i class="fas fa-shield-alt text-amber-500 text-lg mb-1"></i>
                <div class="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Preserve</div>
                <div class="text-xl font-black text-amber-500 mono-numbers leading-none mt-1">${presAgeVal}</div>
            </div>
            <div class="mobile-card !p-2 flex flex-col items-center justify-center text-center bg-blue-900/10 border-blue-500/20">
                <i class="fas fa-road text-blue-400 text-lg mb-1"></i>
                <div class="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Runway</div>
                <div class="text-xl font-black text-blue-400 mono-numbers leading-none mt-1">${runVal}</div>
            </div>
            <div class="mobile-card !p-2 flex flex-col items-center justify-center text-center bg-pink-900/10 border-pink-500/20">
                <i class="fas fa-skull text-pink-400 text-lg mb-1"></i>
                <div class="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Die w/ $0</div>
                <div class="text-xl font-black text-pink-400 mono-numbers leading-none mt-1">${math.toSmartCompactCurrency(dwzVal)}</div>
            </div>
        </div>
    `;

    // B. STRATEGY CONTROLS
    const strategyContent = `
        <div class="grid grid-cols-2 gap-2 mb-4">
            <button onclick="window.setBurndownMode('PLATINUM')" class="p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${!isIronFist ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-800 border-white/5 text-slate-500 opacity-60'}">
                <i class="fas fa-hand-holding-dollar text-xl"></i>
                <span class="text-[9px] font-black uppercase tracking-widest">Handout Hunter</span>
            </button>
            <button onclick="window.setBurndownMode('RAW')" class="p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${isIronFist ? 'bg-slate-500/20 border-slate-400 text-slate-200 shadow-[0_0_15px_rgba(148,163,184,0.2)]' : 'bg-slate-800 border-white/5 text-slate-500 opacity-60'}">
                <i class="fas fa-fist-raised text-xl"></i>
                <span class="text-[9px] font-black uppercase tracking-widest">Iron Fist</span>
            </button>
        </div>
        
        ${!isIronFist ? `
            <div class="bg-emerald-900/20 border border-emerald-500/20 p-3 rounded-xl mb-4">
                ${renderStepperSlider('Food Aid Target', 'burndown.snapPreserve', 0, 2000, 50, d.burndown.snapPreserve || 0, '/mo', 'text-emerald-400')}
            </div>
        ` : ''}
        
        ${renderStepperSlider('Cash Safety Net', 'burndown.cashReserve', 0, 100000, 1000, d.burndown.cashReserve || 0, '', 'text-pink-400')}
    `;

    // C. THE DATA TABLE
    const priorityOrder = d.burndown.priority;
    const renderAssetCells = (r) => {
        return priorityOrder.map(k => {
            const meta = assetMeta[k];
            const draw = r.draws[k] || 0;
            const bal = r.balances[k] || 0;
            
            // ACTIVE BURN CELL
            if (draw > 50) {
                const border = `border: 1px solid ${meta.color}60;`;
                const bg = `background: linear-gradient(180deg, ${meta.color}20 0%, ${meta.color}05 100%);`;
                
                return `
                    <td class="p-1 align-middle text-center">
                        <div class="flex flex-col items-center justify-center py-1 px-1 rounded-lg min-w-[45px]" style="${border} ${bg}">
                            <span class="text-[9px] font-black leading-none mb-0.5" style="color: ${meta.color}">
                                -${math.toSmartCompactCurrency(draw)}
                            </span>
                            <span class="text-[7px] font-bold text-white/40 mono-numbers leading-none">
                                ${math.toSmartCompactCurrency(bal)}
                            </span>
                        </div>
                    </td>`;
            } 
            // DORMANT
            else if (bal > 100) {
                return `<td class="p-1 align-middle text-center"><span class="text-[8px] font-bold text-slate-600">${math.toSmartCompactCurrency(bal)}</span></td>`;
            } 
            return `<td class="p-1 align-middle text-center"><span class="text-[8px] text-slate-800 font-bold">·</span></td>`;
        }).join('');
    };

    const fireTable = `
        <div class="mobile-card p-0 overflow-hidden bg-[#0B0F19] border border-white/10">
            <div class="overflow-x-auto relative">
                <table class="fire-table w-full whitespace-nowrap">
                    <thead class="bg-slate-900/90 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/10">
                        <tr>
                            <th class="sticky left-0 bg-[#1e293b] z-20 px-2 py-2 text-center border-r border-white/10 shadow-lg">Age</th>
                            <th class="px-2 py-2 text-center">Budget</th>
                            <th class="px-2 py-2 text-center">Status</th>
                            <th class="px-2 py-2 text-center text-teal-400">Inc</th>
                            <th class="px-2 py-2 text-center text-emerald-500">Aid</th>
                            <th class="px-2 py-2 text-center text-orange-400">Gap</th>
                            <th class="px-2 py-2 text-center text-white cursor-pointer bg-white/5" onclick="window.openPriorityModal()">
                                <i class="fas fa-sort mr-1"></i> Draw
                            </th>
                            <th class="px-2 py-2 text-center text-red-400">Tax</th>
                            ${priorityOrder.map(k => `<th class="px-2 py-2 text-center text-[8px]" style="color:${assetMeta[k].color}">${assetMeta[k].short}</th>`).join('')}
                            <th class="px-2 py-2 text-center text-teal-400">NW</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5 text-[10px]">
                        ${results.map(r => {
                            const assetGap = Math.max(0, r.budget - r.floorGross - r.snap);
                            const totalDraw = Object.values(r.draws).reduce((a, b) => a + b, 0);
                            const helocSub = r.helocInt > 50 ? `<div class="text-[7px] font-black text-amber-500 uppercase mt-0.5">HELOC ${math.toSmartCompactCurrency(r.helocInt)}</div>` : '';
                            
                            return `
                            <tr class="${r.status === 'INSOLVENT' ? 'bg-red-900/10' : ''}">
                                <td class="sticky left-0 bg-[#1e293b] z-10 px-2 py-1.5 font-bold text-white text-center border-r border-white/10 shadow-lg">
                                    ${r.age}
                                </td>
                                <td class="px-2 py-1.5 text-center text-slate-300">
                                    ${math.toSmartCompactCurrency(r.budget)}${helocSub}
                                </td>
                                <td class="px-2 py-1.5 text-center">
                                    <span class="px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${r.status === 'INSOLVENT' ? 'bg-red-500/20 text-red-400' : (r.status.includes('Platinum') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400')}">
                                        ${r.status.substring(0,4)}
                                    </span>
                                </td>
                                <td class="px-2 py-1.5 text-center font-bold text-teal-400">${math.toSmartCompactCurrency(r.floorGross)}</td>
                                <td class="px-2 py-1.5 text-center font-bold text-emerald-500">${math.toSmartCompactCurrency(r.snap)}</td>
                                <td class="px-2 py-1.5 text-center font-bold text-orange-400">${math.toSmartCompactCurrency(assetGap)}</td>
                                <td class="px-2 py-1.5 text-center font-black text-white bg-white/5">${math.toSmartCompactCurrency(totalDraw)}</td>
                                <td class="px-2 py-1.5 text-center font-bold text-red-400">${math.toSmartCompactCurrency(r.taxes)}</td>
                                ${renderAssetCells(r)}
                                <td class="px-2 py-1.5 text-center font-black text-teal-400 bg-teal-500/5">${math.toSmartCompactCurrency(r.netWorth)}</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // D. TRACE
    const traceContent = `
        <div class="p-2 bg-black/20">
            <div class="flex items-center justify-between mb-4 bg-slate-900/50 p-2 rounded-xl border border-white/5">
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-2">Simulation Year</span>
                <div class="flex items-center gap-1 bg-black/40 rounded-lg p-1">
                    <button class="w-8 h-8 flex items-center justify-center bg-white/5 rounded-md text-slate-400 hover:text-white" onclick="const el=document.getElementById('trace-year-input'); el.stepDown(); el.dispatchEvent(new Event('input'))"><i class="fas fa-minus text-[10px]"></i></button>
                    <input type="number" id="trace-year-input" class="bg-transparent border-none text-blue-400 font-black text-lg w-16 text-center p-0 mono-numbers focus:ring-0" value="${new Date().getFullYear()}">
                    <button class="w-8 h-8 flex items-center justify-center bg-white/5 rounded-md text-slate-400 hover:text-white" onclick="const el=document.getElementById('trace-year-input'); el.stepUp(); el.dispatchEvent(new Event('input'))"><i class="fas fa-plus text-[10px]"></i></button>
                </div>
            </div>
            <div id="mobile-trace-output" class="space-y-4 text-xs"></div>
        </div>
    `;

    el.innerHTML = `
        ${heroSection}
        ${renderCollapsible('fireSettings', 'Strategy & Settings', strategyContent, !collapsedSections['fireSettings'], 'fa-sliders-h', 'text-white')}
        ${fireTable}
        <div class="mt-8">
            ${renderCollapsible('trace', 'Logic Trace', traceContent, !collapsedSections['trace'], 'fa-terminal', 'text-slate-400')}
        </div>
    `;
    
    // Init Trace Listener
    setTimeout(() => {
        const inp = document.getElementById('trace-year-input');
        if (inp) {
            inp.oninput = () => {
                const y = parseInt(inp.value);
                const out = document.getElementById('mobile-trace-output');
                if (out) renderTrace(out, results, y);
            };
            inp.dispatchEvent(new Event('input')); // Trigger initial load
        }
    }, 100);
}

export function renderPriorityList() {
    const listEl = document.getElementById('priority-list-content');
    if (!listEl || !window.currentData) return;
    
    // Ensure priority exists
    if (!window.currentData.burndown) window.currentData.burndown = {};
    if (!window.currentData.burndown.priority) window.currentData.burndown.priority = ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings'];
    
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
