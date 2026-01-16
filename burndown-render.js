
import { math, assetColors } from './utils.js';

export const assetMeta = {
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

export const defaultPriorityOrder = ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings'];

export function renderPriorityList(container, currentOrder, callback) {
    if (!container) return;
    container.innerHTML = currentOrder.map(k => {
        const meta = assetMeta[k];
        return `
            <div data-id="${k}" class="flex items-center gap-1.5 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg cursor-grab active:cursor-grabbing hover:border-slate-500 transition-colors">
                <div class="w-1.5 h-1.5 rounded-full" style="background-color: ${meta.color}"></div>
                <span class="text-[9px] font-black uppercase text-slate-300 tracking-tight">${meta.short}</span>
            </div>
        `;
    }).join('');

    if (typeof Sortable !== 'undefined') {
        new Sortable(container, {
            animation: 150,
            onEnd: () => {
                const newOrder = Array.from(container.children).map(el => el.dataset.id);
                if (callback) callback(newOrder);
            }
        });
    }
}

export function updateToggleStyle(btn, isRealDollars) {
    if (!btn) return;
    btn.classList.toggle('bg-blue-600/20', isRealDollars);
    btn.classList.toggle('text-blue-400', isRealDollars);
    btn.textContent = isRealDollars ? '2026 Dollars' : 'Nominal Dollars';
}

export function renderTrace(container, results, targetYear) {
    if (!container) return;
    const cycle = results.find(r => r.year === targetYear);

    if (!cycle) {
        container.innerHTML = `<div class="flex items-center justify-center h-full text-slate-600 italic">No simulation data found for Year ${targetYear}.</div>`;
        return;
    }

    const fmt = (v) => math.toCurrency(v);
    const fmtNW = (v) => math.toSmartCompactCurrency(v);
    const l = cycle.traceLog || [];
    const breakdown = cycle.incomeBreakdown || [];
    const inventory = (cycle.nwBreakdown || []).filter(item => Math.abs(item.value) > 1).sort((a, b) => b.value - a.value);
    const nwDelta = cycle.netWorth - cycle.startNW;

    container.innerHTML = `
        <div class="space-y-4">
            <div class="border-b border-white/5 pb-2 mb-4 flex justify-between items-center">
                <span class="text-white font-black tracking-widest uppercase">--- AGE ${cycle.age} (${cycle.year}) ---</span>
                <span class="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-blue-500/20 text-blue-400">${cycle.status}</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <p class="text-teal-400 font-bold tracking-tight">Financial Inflows</p>
                        <span class="text-[8px] font-black text-slate-500 uppercase">Gross Total: ${fmt(cycle.floorGross)}</span>
                    </div>
                    <ul class="space-y-1 pl-4 border-l border-teal-500/20">
                        ${breakdown.map(item => `
                            <li class="flex justify-between items-center text-[11px]">
                                <span class="text-slate-500 uppercase tracking-tighter">${item.name}:</span>
                                <span class="text-white font-bold">${fmt(item.amount)}</span>
                            </li>
                        `).join('')}
                        <li class="pt-1 mt-1 border-t border-white/5 flex justify-between items-center text-[11px]">
                            <span class="text-slate-500 uppercase tracking-tighter">Withdrawals:</span>
                            <span class="text-white font-bold">${fmt(cycle.preTaxDraw)}</span>
                        </li>
                        <li class="flex justify-between items-center text-[11px]">
                            <span class="text-emerald-500 uppercase tracking-tighter">SNAP Aid:</span>
                            <span class="text-emerald-400 font-bold">${fmt(cycle.snap)}</span>
                        </li>
                    </ul>
                </div>
                <div class="space-y-2">
                    <p class="text-red-400 font-bold tracking-tight">Total Costs</p>
                    <ul class="space-y-1 pl-4 border-l border-red-500/20">
                        <li class="flex justify-between items-center text-[11px]">
                            <span class="text-slate-500 uppercase tracking-tighter">Target Budget:</span>
                            <span class="text-white font-bold">${fmt(cycle.budget)}</span>
                        </li>
                        <li class="flex justify-between items-center text-[11px]">
                            <span class="text-slate-500 uppercase tracking-tighter">Taxes (Est):</span>
                            <span class="text-white font-bold">-${fmt(cycle.taxes)}</span>
                        </li>
                        <li class="flex justify-between items-center text-[11px]">
                            <span class="text-slate-500 uppercase tracking-tighter">HELOC Interest:</span>
                            <span class="text-white font-bold">-${fmt(cycle.helocInt)}</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div class="bg-black/40 p-4 rounded-xl border border-white/5 space-y-2 mt-4">
                <p class="text-blue-400 font-black uppercase tracking-widest text-[9px] mb-2">Step-by-Step Solver Logic</p>
                ${l.map(entry => `
                    <div class="flex items-start gap-3">
                        <span class="text-slate-600 font-bold">»</span>
                        <p class="text-[11px] leading-relaxed text-slate-300">${entry}</p>
                    </div>
                `).join('')}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/5">
                <div>
                    <span class="text-slate-500 uppercase tracking-widest text-[9px] block mb-1">Cycle Net Result:</span>
                    <span class="font-black text-white text-sm">${fmt(cycle.postTaxInc)} / ${fmt(cycle.budget)} Target</span>
                </div>
                <div class="text-center md:border-x border-white/5">
                    <span class="text-slate-500 uppercase tracking-widest text-[9px] block mb-1">Year NW Delta:</span>
                    <span class="font-black ${nwDelta >= 0 ? 'text-emerald-400' : 'text-red-400'} text-sm">${nwDelta >= 0 ? '+' : ''}${fmtNW(nwDelta)}</span>
                </div>
                <div class="text-right">
                    <span class="text-slate-500 uppercase tracking-widest text-[9px] block mb-1">NW: Start » End</span>
                    <span class="font-black text-teal-400 text-sm">${fmtNW(cycle.startNW)} » ${fmtNW(cycle.netWorth)}</span>
                </div>
            </div>

            <div class="mt-6 pt-6 border-t border-white/5">
                <div class="flex items-center justify-between mb-4">
                    <p class="text-[10px] font-black text-white uppercase tracking-[0.2em]">End of Year Asset Inventory</p>
                    <span class="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Sorted by Value (Desc)</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    ${inventory.map(item => `
                        <div class="bg-white/5 border border-white/5 p-2 rounded-lg flex flex-col justify-between">
                            <div class="flex items-center gap-1.5 mb-1 truncate">
                                <div class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background-color: ${item.color || '#fff'}"></div>
                                <span class="text-[8px] font-bold text-slate-400 uppercase tracking-tighter truncate">${item.name}</span>
                            </div>
                            <div class="text-[11px] font-black ${item.value >= 0 ? 'text-white' : 'text-red-400'} mono-numbers">
                                ${fmt(item.value)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

export function renderTable(results, currentData, priorityOrder, isRealDollars, strategyMode) {
    const infRate = (currentData.assumptions.inflation || 3) / 100;
    
    let columns = [...priorityOrder];
    if (strategyMode === 'PLATINUM') {
        const harvestables = ['taxable', 'crypto', 'metals'];
        columns = [...columns.filter(k => harvestables.includes(k)), ...columns.filter(k => !harvestables.includes(k))];
    }

    const header = `<tr class="sticky top-0 bg-[#1e293b] !text-slate-500 label-std z-20 border-b border-white/5">
        <th class="p-2 w-10 text-center !bg-[#1e293b]">Age</th>
        <th class="p-2 text-center !bg-[#1e293b]">Budget</th>
        <th class="p-2 text-center !bg-[#1e293b]">Status</th>
        <th class="p-2 text-center !bg-[#1e293b] text-teal-400">Income</th>
        <th class="p-2 text-center !bg-[#1e293b] text-emerald-500">Aid</th>
        <th class="p-2 text-center !bg-[#1e293b] text-orange-400">Gap</th>
        <th class="p-2 text-center !bg-[#1e293b]">Gross Draw</th>
        <th class="p-2 text-center !bg-[#1e293b]">Tax</th>
        ${columns.map(k => `<th class="p-2 text-center !bg-[#1e293b] text-[7px]" style="color:${assetMeta[k].color}">${assetMeta[k].short}</th>`).join('')}
        <th class="p-2 text-center !bg-[#1e293b] text-teal-400">Net Worth</th>
    </tr>`;

    const rows = results.map((r, i) => {
        const inf = isRealDollars ? Math.pow(1 + infRate, i) : 1;
        const formatVal = (v) => math.toSmartCompactCurrency(v / inf);
        
        let badgeClass = r.status === 'INSOLVENT' ? 'bg-red-600 text-white' 
            : (r.status === 'Platinum' ? 'bg-emerald-500 text-white' 
            : (r.status === 'Active' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'));
            
        const assetGap = Math.max(0, r.budget - r.floorGross - r.snap);
        const helocSub = r.helocInt > 50 ? `<div class="text-[7px] font-black text-amber-500 uppercase mt-0.5">HELOC ${formatVal(r.helocInt)}</div>` : '';
        
        return `<tr class="border-b border-white/5 hover:bg-white/5 text-[9px]">
            <td class="p-2 text-center font-bold">${r.age}</td>
            <td class="p-2 text-center"><div class="${r.isFirstRetYear ? 'text-white' : 'text-slate-400'}">${formatVal(r.budget)}</div>${helocSub}</td>
            <td class="p-2 text-center"><span class="px-2 py-0.5 rounded-[4px] text-[7px] font-black uppercase ${badgeClass}">${r.status}</span></td>
            <td class="p-2 text-center text-teal-400 font-bold">${formatVal(r.floorGross)}</td>
            <td class="p-2 text-center text-emerald-500 font-bold">${formatVal(r.snap)}</td>
            <td class="p-2 text-center text-orange-400 font-black">${formatVal(assetGap)}</td>
            <td class="p-2 text-center text-white font-bold">${formatVal(r.preTaxDraw)}</td>
            <td class="p-2 text-center text-red-400 font-bold">${formatVal(r.taxes)}</td>
            ${columns.map(k => {
                const draw = r.draws[k];
                const threshold = (k === 'taxable' ? 50 : 1);
                const shouldShow = draw > threshold;
                return `<td class="p-1.5 text-center leading-tight"><div class="font-black" style="color: ${shouldShow ? assetMeta[k].color : '#475569'}">${shouldShow ? formatVal(draw) : '$0'}</div><div class="text-slate-600 text-[7px] font-bold">${formatVal(r.balances[k] || 0)}</div></td>`;
            }).join('')}
            <td class="p-2 text-center font-black text-teal-400 bg-teal-400/5">${math.toSmartCompactCurrency(r.netWorth / inf)}</td>
        </tr>`;
    }).join('');

    return `<table class="w-full text-left border-collapse table-auto">${header}<tbody>${rows}</tbody></table>`;
}
