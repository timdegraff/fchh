
/**
 * Burndown Controller v5.0.0 (Modular)
 */
import { math, engine } from './utils.js';
import { renderTable, renderTrace, renderPriorityList, updateToggleStyle, assetMeta, defaultPriorityOrder } from './burndown-render.js';
import { simulateProjection } from './burndown-engine.js';
import { calculateDieWithZero } from './burndown-dwz.js';
import { PROFILE_45_COUPLE } from './profiles.js';

let isRealDollars = false;
let firstInsolvencyAge = null; 
let fullSimulationResults = [];
let priorityOrder = [...defaultPriorityOrder];

// Debug Helper - Robust
const log = (msg) => {
    console.log(`[Burndown] ${msg}`);
    const el = document.getElementById('debug-console');
    if (el) {
        try {
            const div = document.createElement('div');
            div.textContent = `${new Date().toISOString().split('T')[1]} - ${msg}`;
            el.appendChild(div);
            el.scrollTop = el.scrollHeight;
        } catch (e) {}
    }
};

export const burndown = {
    getIsRealDollars: () => isRealDollars,
    toggleRealDollars: () => { isRealDollars = !isRealDollars; return isRealDollars; },
    getInsolvencyAge: () => firstInsolvencyAge,
    priorityOrder,
    assetMeta,

    init: () => {
        try {
            log("burndown.init() called");

            const viewContainer = document.getElementById('burndown-view-container');
            if (!viewContainer) {
                log("Warning: #burndown-view-container not found in current DOM state.");
                return;
            }

            viewContainer.innerHTML = `
                <div class="flex flex-col gap-2.5">
                    <div class="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-2 border-b border-white/5 pb-2">
                        <div class="flex items-center gap-4 px-1">
                            <div class="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                                <i class="fas fa-microchip text-sm"></i>
                            </div>
                            <div class="flex flex-col">
                                <h2 class="text-xl font-bold text-white tracking-tight leading-none uppercase tracking-tighter">Burndown Engine</h2>
                                <span class="text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-1">Decumulation Logic Orchestrator</span>
                            </div>
                        </div>

                        <div class="flex items-center gap-6">
                             <div class="flex flex-col items-end gap-1">
                                <label class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Retirement Age</label>
                                <div class="flex items-center gap-2 bg-slate-900/50 p-1 rounded-lg border border-white/10">
                                    <button data-step="down" data-target="retirementAge" class="w-6 h-6 flex items-center justify-center hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"><i class="fas fa-minus text-[10px]"></i></button>
                                    <input type="number" data-id="retirementAge" class="bg-transparent border-none text-blue-400 font-black mono-numbers text-sm w-10 text-center outline-none" value="65">
                                    <button data-step="up" data-target="retirementAge" class="w-6 h-6 flex items-center justify-center hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"><i class="fas fa-plus text-[10px]"></i></button>
                                </div>
                             </div>
                             
                             <div class="flex flex-col items-center gap-1">
                                <label class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Currency Mode</label>
                                <button id="toggle-burndown-real" class="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-all">
                                    Nominal $
                                </button>
                             </div>

                             <div class="flex flex-col items-end gap-1">
                                <label class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Budget Logic</label>
                                <div class="flex items-center gap-2">
                                    <input type="text" id="input-manual-budget" data-type="currency" inputmode="decimal" class="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-sm text-teal-400 font-bold text-right w-24 mono-numbers outline-none focus:border-blue-500 transition-all">
                                    <label class="flex items-center gap-2 cursor-pointer bg-slate-900/50 border border-white/10 px-2 py-1 rounded-lg hover:border-slate-600 transition-all">
                                        <span class="text-[9px] font-black text-slate-400 uppercase">Sync</span>
                                        <input type="checkbox" id="toggle-budget-sync" checked class="w-3 h-3 accent-blue-500 rounded bg-slate-800 border-slate-600">
                                    </label>
                                </div>
                             </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div id="card-preservation" class="bg-slate-900/50 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between h-28 relative overflow-hidden cursor-pointer hover:border-amber-500/30 transition-colors" title="Optimize for Legacy Preservation">
                            <div class="absolute right-0 top-0 p-3"><i class="fas fa-infinity text-4xl text-amber-500 opacity-20"></i></div>
                            <div>
                                <label class="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1"><i class="fas fa-shield-alt"></i> Preservation Age</label>
                                <div id="card-preservation-val" class="text-3xl font-black text-amber-500 mono-numbers tracking-tighter">--</div>
                            </div>
                            <div id="card-preservation-sub" class="text-[9px] font-bold text-amber-500/60 uppercase tracking-tighter leading-none">STAYS SOLVENT AT CURRENT BUDGET UNTIL AGE 100+</div>
                        </div>

                        <div class="bg-slate-900/50 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between h-28 relative overflow-hidden cursor-pointer hover:border-blue-500/30 transition-colors">
                            <div class="absolute right-0 top-0 p-3"><i class="fas fa-road text-4xl text-blue-400 opacity-20"></i></div>
                            <div>
                                <label class="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1"><i class="fas fa-flag-checkered"></i> Retirement Runway</label>
                                <div id="card-runway-val" class="text-3xl font-black text-blue-400 mono-numbers tracking-tighter">--</div>
                            </div>
                            <div id="card-runway-sub" class="text-[9px] font-bold text-blue-400/60 uppercase tracking-tighter leading-none">YEARS OF SOLVENCY REMAINING FROM TODAY</div>
                        </div>

                        <div id="card-dwz" class="bg-slate-900/50 rounded-2xl border border-slate-800 p-4 flex flex-col justify-between h-28 relative overflow-hidden cursor-pointer hover:border-pink-500/30 transition-colors" title="Solve for Max Sustainable Spend">
                            <div class="absolute right-0 top-0 p-3"><i class="fas fa-skull text-4xl text-pink-400 opacity-20"></i></div>
                            <div>
                                <label class="text-[9px] font-bold text-pink-400 uppercase tracking-widest mb-1 flex items-center gap-1"><i class="fas fa-glass-cheers"></i> Die With Zero</label>
                                <div id="card-dwz-val" class="text-3xl font-black text-pink-400 mono-numbers tracking-tighter">--</div>
                            </div>
                            <div id="card-dwz-sub" class="text-[9px] font-bold text-pink-500/60 uppercase tracking-tighter leading-none">MAX SUSTAINABLE SPEND OF $0K STARTING AT RETIREMENT</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                         <div class="bg-slate-900/30 rounded-xl border border-slate-800/50 p-3 flex flex-col justify-center h-28">
                            <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Burn Down Engines</label>
                            <div id="persona-selector" class="grid grid-cols-2 gap-1 p-1 bg-black/40 rounded-lg border border-white/5 h-full">
                                <button data-mode="PLATINUM" class="rounded-md text-[10px] font-black uppercase tracking-tight transition-all flex flex-col items-center justify-center border border-transparent hover:bg-emerald-500/5">
                                    <span class="text-emerald-400 text-xs font-black">HANDOUT HUNTER</span>
                                    <span class="text-[6.5px] opacity-40 leading-none mt-1 uppercase text-center">aggressive aid maximization</span>
                                </button>
                                <button data-mode="RAW" class="rounded-md text-[10px] font-black uppercase tracking-tight transition-all flex flex-col items-center justify-center border border-transparent hover:bg-slate-500/5">
                                    <span class="text-slate-400 text-xs font-black">IRON FIST</span>
                                    <span class="text-[6.5px] opacity-40 leading-none mt-1 uppercase text-center">strict priority burn</span>
                                </button>
                            </div>
                        </div>

                        <div id="card-snap-wrapper" class="bg-slate-900/30 rounded-xl border border-slate-800/50 p-3 flex flex-col justify-between h-28 transition-all duration-300">
                            <div class="flex justify-between items-start mb-1">
                                <div>
                                    <label class="text-[9px] font-bold text-emerald-500 uppercase tracking-widest block">Food Aid Target (MAX)</label>
                                    <div id="est-snap-indicator" class="text-2xl font-black text-emerald-400 mono-numbers leading-none mt-0.5">$0</div>
                                </div>
                                <div class="text-right">
                                    <span class="text-[7px] text-slate-500 font-black uppercase tracking-widest block">Simulation Goal</span>
                                    <span id="label-snap-preserve" class="text-[10px] font-bold text-emerald-400 mono-numbers">$0/mo</span>
                                </div>
                            </div>
                            <input type="range" id="input-snap-preserve" min="0" max="2000" step="100" value="0" class="input-range w-full accent-emerald-500">
                        </div>

                        <div class="bg-slate-900/30 rounded-xl border border-slate-800/50 p-3 flex flex-col justify-center h-28">
                            <div class="flex justify-between items-center mb-4">
                                <label class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Cash Safety Net</label>
                                <span id="label-cash-reserve" class="text-pink-400 font-black mono-numbers text-[10px]">$25,000</span>
                            </div>
                            <input type="range" id="input-cash-reserve" min="0" max="100000" step="1000" value="25000" class="input-range w-full">
                        </div>
                    </div>

                    <div id="priority-list-wrapper" class="bg-slate-900/30 rounded-xl border border-slate-800/50 p-3 flex flex-wrap items-center gap-3 transition-opacity">
                        <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Draw Priority:</span>
                        <div id="draw-priority-list" class="flex flex-wrap items-center gap-2"></div>
                    </div>

                    <div class="card-container bg-black/20 rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                        <div id="burndown-table-container" class="max-h-[65vh] overflow-auto mono-numbers"></div>
                        <div class="p-3 bg-slate-900/60 border-t border-white/5 text-[8px] text-slate-500 font-bold uppercase tracking-widest text-center">
                            <i class="fas fa-info-circle mr-1"></i> DISCLAIMER: Decumulation model assumes asset withdrawals as annual lump-sums to optimize for government benefit eligibility.
                        </div>
                    </div>
                </div>
            `;
            
            burndown.attachListeners();
            if (window.currentData) burndown.run();

        } catch (e) {
            log(`CRITICAL ERROR IN INIT: ${e.message}`);
        }
    },

    attachListeners: () => {
        ['input-cash-reserve', 'input-snap-preserve', 'toggle-budget-sync', 'input-manual-budget'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.oninput = () => {
                if (id === 'input-cash-reserve') document.getElementById('label-cash-reserve').textContent = math.toCurrency(parseInt(el.value));
                if (id === 'input-snap-preserve') document.getElementById('label-snap-preserve').textContent = `${math.toCurrency(parseInt(el.value))}/mo`;
                if (id === 'toggle-budget-sync') {
                    const inp = document.getElementById('input-manual-budget');
                    inp.disabled = el.checked;
                    inp.classList.toggle('opacity-40', el.checked);
                    if (el.checked && window.currentData) {
                         const summaries = engine.calculateSummaries(window.currentData);
                         inp.value = math.toCurrency(summaries.totalAnnualBudget);
                    }
                }
                burndown.run();
                if (window.debouncedAutoSave) window.debouncedAutoSave();
            };
        });

        const personaContainer = document.getElementById('persona-selector');
        if (personaContainer) {
            personaContainer.onclick = (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                const mode = btn.dataset.mode;
                personaContainer.querySelectorAll('button').forEach(b => {
                    b.classList.remove('bg-emerald-500/10', 'border-emerald-500/30', 'bg-slate-500/10', 'border-slate-500/30');
                });
                const styleMap = { 'PLATINUM': 'bg-emerald-500/10 border-emerald-500/30', 'RAW': 'bg-slate-500/10 border-slate-500/30' };
                btn.classList.add(...styleMap[mode].split(' '));
                personaContainer.dataset.value = mode;

                const snapWrapper = document.getElementById('card-snap-wrapper');
                if (snapWrapper) {
                    snapWrapper.classList.toggle('opacity-20', mode === 'RAW');
                    snapWrapper.classList.toggle('pointer-events-none', mode === 'RAW');
                }
                
                const priorityWrapper = document.getElementById('priority-list-wrapper');
                if (priorityWrapper) {
                    priorityWrapper.classList.toggle('opacity-40', mode === 'PLATINUM');
                    priorityWrapper.classList.toggle('pointer-events-none', mode === 'PLATINUM');
                }

                burndown.run();
                if (window.debouncedAutoSave) window.debouncedAutoSave();
            };
        }

        const realBtn = document.getElementById('toggle-burndown-real');
        if (realBtn) {
            realBtn.onclick = () => { isRealDollars = !isRealDollars; updateToggleStyle(realBtn, isRealDollars); burndown.run(); };
        }

        const ty = document.getElementById('input-trace-year');
        const ta = document.getElementById('input-trace-age');
        if (ty && ta) {
            ty.oninput = () => {
                const val = parseInt(ty.value);
                if (fullSimulationResults.length && !isNaN(val)) {
                    const match = fullSimulationResults.find(r => r.year === val);
                    if (match) {
                        ta.value = match.age;
                        renderTrace(document.getElementById('logic-trace-container'), fullSimulationResults, val);
                    }
                }
            };
            ta.oninput = () => {
                const val = parseInt(ta.value);
                if (fullSimulationResults.length && !isNaN(val)) {
                    const match = fullSimulationResults.find(r => r.age === val);
                    if (match) {
                        ty.value = match.year;
                        renderTrace(document.getElementById('logic-trace-container'), fullSimulationResults, match.year);
                    }
                }
            };
        }
    },

    load: (data) => {
        if (!data) return;
        if (data.priority) priorityOrder = [...new Set(data.priority)];
        isRealDollars = !!data.isRealDollars;
        
        const mode = data.strategyMode || 'RAW';
        const personaSelector = document.getElementById('persona-selector');
        if (personaSelector) { const btn = personaSelector.querySelector(`[data-mode="${mode}"]`); if (btn) btn.click(); }
        
        const sync = (id, val) => { const el = document.getElementById(id); if (el) { el.value = val; el.dispatchEvent(new Event('input')); } };
        sync('input-cash-reserve', data.cashReserve ?? 25000);
        sync('input-snap-preserve', data.snapPreserve ?? 0);
        
        const syncCheck = document.getElementById('toggle-budget-sync');
        if (syncCheck) syncCheck.checked = data.useSync ?? true;
        
        const manualBud = document.getElementById('input-manual-budget');
        if (manualBud && window.currentData) {
            const summaries = engine.calculateSummaries(window.currentData);
            manualBud.value = math.toCurrency(data.useSync ? summaries.totalAnnualBudget : (data.manualBudget || 100000));
            manualBud.disabled = data.useSync;
        }
        
        renderPriorityList(document.getElementById('draw-priority-list'), priorityOrder, (newOrder) => {
            priorityOrder = newOrder;
            burndown.run();
            if (window.debouncedAutoSave) window.debouncedAutoSave();
        });
        burndown.run();
    },

    scrape: () => ({
        priority: priorityOrder,
        strategyMode: document.getElementById('persona-selector')?.dataset.value || 'RAW',
        cashReserve: parseInt(document.getElementById('input-cash-reserve')?.value || 25000),
        snapPreserve: parseInt(document.getElementById('input-snap-preserve')?.value || 0), 
        useSync: document.getElementById('toggle-budget-sync')?.checked ?? true,
        manualBudget: math.fromCurrency(document.getElementById('input-manual-budget')?.value || "$100,000"),
        isRealDollars
    }),

    run: () => {
        try {
            const data = window.currentData; 
            if (!data) return;

            const config = burndown.scrape();
            const ben = data.benefits || {};
            const filingStatus = data.assumptions?.filingStatus || 'Single';
            const adults = filingStatus === 'Married Filing Jointly' ? 2 : 1;
            const currentYear = new Date().getFullYear();
            const effectiveKidsCount = (ben.dependents || []).filter(d => (d.birthYear + 19) >= currentYear).length;
            const totalSize = adults + effectiveKidsCount;
            
            const maxSnapPossible = engine.calculateSnapBenefit(0, 0, 0, totalSize, ben.shelterCosts || 700, ben.hasSUA ?? true, ben.isDisabled ?? false, ben.childSupportPaid || 0, ben.depCare || 0, ben.medicalExps || 0, data.assumptions?.state || 'Michigan', 1, true);
            
            const snapIndicator = document.getElementById('est-snap-indicator');
            if (snapIndicator) snapIndicator.textContent = math.toCurrency(maxSnapPossible);

            fullSimulationResults = simulateProjection(data, config);
            firstInsolvencyAge = fullSimulationResults.firstInsolvencyAge;
            
            const currentAge = parseFloat(data.assumptions.currentAge) || 40;
            const runwayVal = firstInsolvencyAge ? (firstInsolvencyAge - currentAge) : null;
            
            const runwayEl = document.getElementById('card-runway-val');
            if (runwayEl) {
                runwayEl.textContent = runwayVal !== null ? `${runwayVal} Years` : "Forever";
            }
            
            const presEl = document.getElementById('card-preservation-val');
            if (presEl) presEl.textContent = firstInsolvencyAge ? firstInsolvencyAge : "100+";

            const tableCont = document.getElementById('burndown-table-container');
            if (tableCont) tableCont.innerHTML = renderTable(fullSimulationResults, data, priorityOrder, isRealDollars, config.strategyMode);
            
            const ty = document.getElementById('input-trace-year');
            const traceYear = parseInt(ty?.value) || fullSimulationResults[0]?.year;
            renderTrace(document.getElementById('logic-trace-container'), fullSimulationResults, traceYear);
            
            const dwzResult = calculateDieWithZero(data, config, burndown);
            const dwzValEl = document.getElementById('card-dwz-val');
            if (dwzValEl) dwzValEl.textContent = math.toSmartCompactCurrency(dwzResult);

            // Close boot spinner if we're here
            const loginScreen = document.getElementById('login-screen');
            if (loginScreen && !loginScreen.classList.contains('hidden')) {
                loginScreen.classList.add('hidden');
                document.getElementById('app-container')?.classList.remove('hidden');
            }

        } catch (e) {
            console.warn("Burndown run error:", e);
        }
    }
};
