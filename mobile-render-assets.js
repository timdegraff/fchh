
import { math, assetColors } from './utils.js';
import { renderCollapsible } from './mobile-components.js';

let assetChart = null;
const getState = () => window.mobileState;

export function renderAssets(el) {
    const d = window.currentData;
    const { collapsedSections } = getState();
    
    el.innerHTML = `
        <div class="chart-container flex items-center justify-between px-2 mb-4 h-[200px]">
            <div id="assetLegend" class="flex flex-col gap-1 w-1/2 pr-2 overflow-hidden"></div>
            <div class="w-1/2 h-full relative flex items-center justify-center">
                <canvas id="assetDonutChart"></canvas>
            </div>
        </div>
        <div id="assets-list-container"></div>
    `;
    
    setTimeout(() => initAssetChart(d), 0);

    const getTypeColor = (type) => {
        const map = {
            'Cash': 'text-type-cash', 'Taxable': 'text-type-taxable', 'Pre-Tax (401k/IRA)': 'text-type-pretax',
            'Roth IRA': 'text-type-posttax', 'Crypto': 'text-type-crypto', 'Metals': 'text-type-metals', 'HSA': 'text-type-hsa'
        };
        return map[type] || 'text-slate-400';
    };

    const isBasisNA = (type) => ['Cash', 'Pre-Tax (401k/IRA)', 'HSA'].includes(type);

    // Map section titles to shortened button text
    const addBtnLabels = {
        'INVESTMENTS': 'Investment',
        'REAL ESTATE': 'Real Estate',
        'OTHER ASSETS': 'Other Asset',
        'HELOCS': 'HELOC',
        'DEBTS': 'Debt',
        'EQUITY & OPTIONS': 'Option'
    };

    const sections = [
        { title: 'INVESTMENTS', icon: 'fa-chart-line', color: 'text-blue-400', data: d.investments, path: 'investments' },
        { title: 'REAL ESTATE', icon: 'fa-home', color: 'text-indigo-400', data: d.realEstate, path: 'realEstate', fields: ['value', 'mortgage'] },
        { title: 'OTHER ASSETS', icon: 'fa-car', color: 'text-teal-400', data: d.otherAssets, path: 'otherAssets', fields: ['value', 'loan'] },
        { title: 'HELOCS', icon: 'fa-university', color: 'text-red-400', data: d.helocs, path: 'helocs', fields: ['balance', 'limit'] },
        { title: 'DEBTS', icon: 'fa-credit-card', color: 'text-pink-400', data: d.debts, path: 'debts', fields: ['balance'] },
        { title: 'EQUITY & OPTIONS', icon: 'fa-briefcase', color: 'text-orange-400', data: d.stockOptions, path: 'stockOptions', isOption: true }
    ];

    document.getElementById('assets-list-container').innerHTML = sections.map((sect) => {
        let net = 0;
        let isDebt = false;
        
        (sect.data || []).forEach(item => {
            if (sect.isOption) {
                const shares = parseFloat(item.shares) || 0;
                const strike = math.fromCurrency(item.strikePrice);
                const fmv = math.fromCurrency(item.currentPrice);
                net += Math.max(0, (fmv - strike) * shares);
            } else if (sect.path === 'investments' || sect.path === 'otherAssets') {
                net += math.fromCurrency(item.value) - math.fromCurrency(item.loan || 0);
            } else if (sect.path === 'realEstate') {
                net += math.fromCurrency(item.value) - math.fromCurrency(item.mortgage);
            } else if (sect.path === 'helocs' || sect.path === 'debts') {
                net += math.fromCurrency(item.balance); // For display on card header, we show positive Debt amount
                isDebt = true;
            }
        });
        
        // Custom Header Colors
        let netColor = isDebt ? 'text-red-400' : 'text-emerald-400';
        if (sect.isOption) netColor = 'text-orange-400'; // Override for Options
        
        const prefix = isDebt ? '-' : '';
        const netDisplay = net !== 0 ? (isDebt ? math.toSmartCompactCurrency(-net) : math.toSmartCompactCurrency(net)) : '';
        
        // Add ID to the header display for live updates
        const headerId = `section-header-total-${sect.path}`;
        const isOpen = !collapsedSections[sect.title];

        const content = `
            ${(sect.data || []).map((item, i) => {
                const typeClass = sect.path === 'investments' ? getTypeColor(item.type) : 'text-slate-400';
                const valColorClass = (sect.path === 'debts' || sect.path === 'helocs') ? 'text-red-400' : 'text-white';
                
                return `
                <div class="swipe-container">
                    <div class="swipe-actions">
                        ${sect.isOption ? `<button class="swipe-action-btn bg-slate-700" onclick="window.openAdvancedPE(${i})">Settings</button>` : ''}
                        ${(sect.path === 'investments' && item.type === 'Cash') ? `<button class="swipe-action-btn bg-pink-600" onclick="window.openCashSettings(${i})">Reserve</button>` : ''}
                        <button class="swipe-action-btn bg-red-600" onclick="window.removeItem('${sect.path}', ${i})">Delete</button>
                    </div>
                    <div class="swipe-content p-3 border border-white/5 flex items-start gap-3">
                        ${sect.isOption ? '' : '<div class="drag-handle text-slate-600 px-1 mt-1"><i class="fas fa-grip-vertical"></i></div>'}
                        
                        ${sect.path === 'investments' ? `
                            <!-- Layout for Investments -->
                            <div class="flex-grow space-y-1 pt-0.5">
                                <input data-path="${sect.path}.${i}.name" value="${item.name}" class="bg-transparent border-none p-0 text-[11px] font-bold text-white w-full placeholder:text-slate-600 focus:ring-0 uppercase tracking-tight">
                                <select data-path="${sect.path}.${i}.type" class="bg-slate-900 border border-white/10 rounded-lg text-[8px] font-bold w-full p-1.5 ${typeClass}">
                                    <option value="Taxable" ${item.type === 'Taxable' ? 'selected' : ''}>Taxable</option>
                                    <option value="Pre-Tax (401k/IRA)" ${item.type === 'Pre-Tax (401k/IRA)' ? 'selected' : ''}>Pre-Tax</option>
                                    <option value="Roth IRA" ${item.type === 'Roth IRA' ? 'selected' : ''}>Roth IRA</option>
                                    <option value="Cash" ${item.type === 'Cash' ? 'selected' : ''}>Cash</option>
                                    <option value="Crypto" ${item.type === 'Crypto' ? 'selected' : ''}>Crypto</option>
                                    <option value="Metals" ${item.type === 'Metals' ? 'selected' : ''}>Metals</option>
                                    <option value="HSA" ${item.type === 'HSA' ? 'selected' : ''}>HSA</option>
                                </select>
                            </div>
                            <div class="text-right space-y-0.5 w-24 flex-shrink-0">
                                <input data-path="${sect.path}.${i}.value" data-type="currency" inputmode="decimal" value="${math.toCurrency(item.value)}" class="bg-transparent border-none p-0 text-sm font-black text-right text-white w-full focus:ring-0">
                                ${!isBasisNA(item.type) ? `
                                    <input data-path="${sect.path}.${i}.costBasis" data-type="currency" inputmode="decimal" value="${math.toCurrency(item.costBasis)}" class="bg-transparent border-none p-0 text-[10px] font-bold text-right text-blue-400 w-full focus:ring-0">
                                    <div class="text-[7px] text-slate-500 font-bold uppercase tracking-wider">Basis</div>
                                ` : ''}
                            </div>
                        ` : `
                            <!-- Layout for Other Sections -->
                            <div class="flex-grow space-y-0.5 pt-0.5">
                                <input data-path="${sect.path}.${i}.name" value="${item.name}" class="bg-transparent border-none p-0 text-[11px] font-bold text-white w-full placeholder:text-slate-600 focus:ring-0 uppercase tracking-tight">
                                ${sect.isOption ? `
                                <div class="grid grid-cols-3 gap-1 mt-1">
                                    <div>
                                        <span class="text-[7px] text-slate-500 uppercase block">Shares</span>
                                        <input data-path="${sect.path}.${i}.shares" type="number" inputmode="decimal" value="${item.shares}" class="bg-slate-900 border border-white/10 rounded p-1 text-[9px] text-white w-full">
                                    </div>
                                    <div>
                                        <span class="text-[7px] text-slate-500 uppercase block">Strike</span>
                                        <input data-path="${sect.path}.${i}.strikePrice" data-type="currency" inputmode="decimal" value="${math.toCurrency(item.strikePrice)}" class="bg-slate-900 border border-white/10 rounded p-1 text-[9px] text-orange-400 w-full">
                                    </div>
                                    <div>
                                        <span class="text-[7px] text-slate-500 uppercase block">FMV</span>
                                        <input data-path="${sect.path}.${i}.currentPrice" data-type="currency" inputmode="decimal" value="${math.toCurrency(item.currentPrice)}" class="bg-slate-900 border border-white/10 rounded p-1 text-[9px] text-white w-full">
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                            <div class="text-right space-y-0.5 w-24 flex-shrink-0">
                                ${sect.isOption ? `
                                    <div class="flex flex-col justify-center h-full pt-1">
                                        <div id="equity-display-${i}" class="text-orange-400 font-black text-sm mono-numbers">${math.toSmartCompactCurrency(Math.max(0, (math.fromCurrency(item.currentPrice) - math.fromCurrency(item.strikePrice)) * parseFloat(item.shares)))}</div>
                                        <span class="text-[8px] font-bold text-slate-500 uppercase mt-1">Equity</span>
                                    </div>
                                ` : `
                                    <div class="flex items-center justify-end">
                                        ${sect.path === 'helocs' ? '<span class="text-[7px] text-slate-500 font-bold mr-1">BAL</span>' : ''}
                                        <input data-path="${sect.path}.${i}.${sect.fields[0]}" data-type="currency" inputmode="decimal" value="${math.toCurrency(item[sect.fields[0]])}" class="bg-transparent border-none p-0 text-sm font-black text-right ${valColorClass} w-full focus:ring-0">
                                    </div>
                                    ${sect.fields[1] ? `
                                    <div class="flex items-center justify-end mt-1">
                                        ${sect.path === 'helocs' ? '<span class="text-[7px] text-slate-500 font-bold mr-1">LIM</span>' : ''}
                                        <input data-path="${sect.path}.${i}.${sect.fields[1]}" data-type="currency" inputmode="decimal" value="${math.toCurrency(item[sect.fields[1]])}" class="bg-transparent border-none p-0 text-[10px] font-bold text-right text-red-400 w-full focus:ring-0 block">
                                    </div>
                                    ` : ''}
                                `}
                            </div>
                        `}
                    </div>
                </div>`;
            }).join('')}
            <button class="section-add-btn" onclick="window.addItem('${sect.path}')">
                <i class="fas fa-plus"></i> Add ${addBtnLabels[sect.title]}
            </button>
        `;

        // Pass ID for Header span
        const headerSpanHtml = `<span id="${headerId}">${netDisplay}</span>`;
        return renderCollapsible(sect.title, sect.title, content, isOpen, sect.icon, netColor, headerSpanHtml);
    }).join('');
}

export function initAssetChart(data) {
    const ctx = document.getElementById('assetDonutChart');
    if (!ctx) return;
    
    const totals = {};
    const colorMap = {};
    
    data.investments?.forEach(i => {
        const val = math.fromCurrency(i.value);
        if (val > 0) {
            totals[i.type] = (totals[i.type] || 0) + val;
            colorMap[i.type] = assetColors[i.type] || '#fff';
        }
    });
    
    const optVal = data.stockOptions?.reduce((s, x) => {
        const sh = parseFloat(x.shares)||0;
        const st = math.fromCurrency(x.strikePrice);
        const fmv = math.fromCurrency(x.currentPrice);
        return s + Math.max(0, (fmv - st) * sh);
    }, 0) || 0;
    if (optVal > 0) { totals['Stock Options'] = optVal; colorMap['Stock Options'] = assetColors['Stock Options']; }
    
    const reVal = data.realEstate?.reduce((s, r) => s + Math.max(0, math.fromCurrency(r.value) - math.fromCurrency(r.mortgage)), 0) || 0;
    if (reVal > 0) { totals['Real Estate'] = reVal; colorMap['Real Estate'] = assetColors['Real Estate']; }
    
    // Sort by value desc
    const sortedKeys = Object.keys(totals).sort((a,b) => totals[b] - totals[a]);
    const values = sortedKeys.map(k => totals[k]);
    const colors = sortedKeys.map(k => colorMap[k]);
    
    // Populate Legend on Left
    const legend = document.getElementById('assetLegend');
    if (legend) {
        legend.innerHTML = sortedKeys.map(k => {
            const label = k === 'Stock Options' ? 'Options' : k.replace(/\(.*\)/, '').trim();
            return `
            <div class="flex items-center justify-between w-full">
                <div class="flex items-center gap-2 min-w-0 overflow-hidden">
                    <div class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background-color: ${colorMap[k]}"></div>
                    <span class="text-[9px] font-black uppercase truncate leading-none" style="color: ${colorMap[k]}">${label}</span>
                </div>
                <span class="text-[10px] font-bold text-white leading-tight mono-numbers ml-2">${math.toSmartCompactCurrency(totals[k])}</span>
            </div>
        `}).join('');
    }

    if (assetChart) assetChart.destroy();

    assetChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedKeys,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%', 
            layout: { padding: 0 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.label}: ${math.toSmartCompactCurrency(ctx.raw)}`
                    },
                    backgroundColor: '#1e293b',
                    bodyFont: { family: 'Inter', weight: 'bold' }
                }
            }
        }
    });
}

export function updateAssetChart(data) {
    if (!assetChart) return;
    initAssetChart(data); 
}
