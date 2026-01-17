
import { initializeData, autoSave, forceSyncData } from './data.js';
import { math, engine, assetColors, stateTaxRates } from './utils.js';
import { PROFILE_25_SINGLE, PROFILE_45_COUPLE, PROFILE_55_RETIREE, BLANK_PROFILE } from './profiles.js';
import { simulateProjection } from './burndown-engine.js';

// State
let activeTab = 'assets';
let budgetMode = 'annual'; // 'monthly' | 'annual'
let incomeDisplayMode = 'current'; // 'current' | 'retire'
let collapsedSections = {}; 
let swipeStartX = 0;
let currentSwipeEl = null;
let assetChart = null;
let mobileSaveTimeout = null; // Local timeout var

// --- BOOTSTRAP ---
async function init() {
    console.log("Mobile App Initializing...");
    const hasData = localStorage.getItem('firecalc_data');
    
    // Always attach listeners first so buttons work even if data load fails
    attachListeners();

    if (!hasData) {
        const login = document.getElementById('login-screen');
        if (login) login.classList.remove('hidden');
    } else {
        try {
            await initializeData();
            const login = document.getElementById('login-screen');
            const app = document.getElementById('app-container');
            if (login) login.classList.add('hidden');
            if (app) app.classList.remove('hidden');
            renderApp();
        } catch (e) {
            console.error("Data load failed", e);
            // Fallback to login screen if data is corrupt
            const login = document.getElementById('login-screen');
            if (login) login.classList.remove('hidden');
        }
    }
}

function haptic() {
    try {
        if (navigator && navigator.vibrate) {
            navigator.vibrate(10);
        }
    } catch (e) {
        // Ignore haptic errors
    }
}

function mobileAutoSave() {
    if (!window.currentData) return;
    if (mobileSaveTimeout) clearTimeout(mobileSaveTimeout);
    
    mobileSaveTimeout = setTimeout(() => {
        try {
            localStorage.setItem('firecalc_data', JSON.stringify(window.currentData));
            console.log("Mobile state saved to storage.");
        } catch (e) {
            console.error("Mobile save failed:", e);
        }
    }, 1000);
}

function attachListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
            haptic();
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.dataset.tab;
            renderApp();
        };
    });

    // Profile Selection - Entry Point
    const guestBtn = document.getElementById('guest-btn');
    if (guestBtn) {
        guestBtn.onclick = async () => {
            haptic();
            // DIRECT LOAD: 45 Couple Profile
            const data = PROFILE_45_COUPLE;
            
            localStorage.setItem('firecalc_data', JSON.stringify(data));
            window.currentData = JSON.parse(JSON.stringify(data)); 
            
            const login = document.getElementById('login-screen');
            const app = document.getElementById('app-container');
            const modal = document.getElementById('profile-modal');
            
            if (login) login.classList.add('hidden');
            if (modal) modal.classList.add('hidden');
            if (app) app.classList.remove('hidden');
            
            await initializeData();
            renderApp();
        };
    } else {
        console.warn("Guest button not found during attachListeners");
    }

    document.querySelectorAll('[data-profile]').forEach(btn => {
        btn.onclick = async () => {
            haptic();
            const pid = btn.dataset.profile;
            let data = BLANK_PROFILE;
            if (pid === '25') data = PROFILE_25_SINGLE;
            if (pid === '45') data = PROFILE_45_COUPLE;
            if (pid === '55') data = PROFILE_55_RETIREE;
            if (pid === 'blank') data = BLANK_PROFILE;
            
            localStorage.setItem('firecalc_data', JSON.stringify(data));
            window.currentData = JSON.parse(JSON.stringify(data)); 
            
            const modal = document.getElementById('profile-modal');
            const app = document.getElementById('app-container');
            if (modal) modal.classList.add('hidden');
            if (app) app.classList.remove('hidden');
            
            await initializeData();
            renderApp();
        };
    });

    // Global Input Handler
    const container = document.getElementById('mobile-content');
    if (!container) return;
    
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
        const dataType = target.dataset.type;
        
        let val = target.value;

        // 1. VISUAL UPDATE FOR SLIDERS (Immediate Feedback)
        if (target.type === 'range') {
            const display = target.previousElementSibling?.querySelector('.mono-numbers');
            if (display) {
                // Heuristic: Replace the numeric part of the label but keep symbols like %, $
                // This makes sliders feel "alive" before the expensive render logic kicks in
                display.textContent = display.textContent.replace(/[0-9\.,]+/, val); 
            }
        }
        
        // 2. DATA TYPE HANDLING
        if (dataType === 'currency') {
            // While typing (number mode), keep as number
            val = parseFloat(val) || 0;
            // Handle Budget mode conversion
            if (activeTab === 'budget' && budgetMode === 'monthly') val = val * 12;
        } else if (dataType === 'percent') {
            val = parseFloat(val) || 0;
        } else if (target.type === 'checkbox') {
            val = target.checked;
            haptic();
        } else if (target.type === 'range') {
            val = parseFloat(val);
            // Config: Retirement Phase Special Case (Slider is 0-150, Data is 0.0-1.5)
            if (target.dataset.path.includes('phaseGo')) {
                val = val / 100;
            }
        }

        // Deep set
        let ref = window.currentData;
        for (let i = 0; i < path.length - 1; i++) {
            if (!ref[path[i]]) ref[path[i]] = {}; // Safety
            ref = ref[path[i]];
        }
        ref[path[path.length - 1]] = val;

        mobileAutoSave();
        // Don't re-render whole app on keystroke, just header/chart
        updateHeaderContext(); 
        if (activeTab === 'aid') {
            updateAidHeader();
            updateAidVisuals(); // Instant update for Sandbox
        }
        if (activeTab === 'assets' && assetChart) updateAssetChart(window.currentData);
    });
    
    // Change event for selects
    container.addEventListener('change', (e) => {
        if (e.target.tagName === 'SELECT') {
            haptic();
            // Manual update since select doesn't trigger 'input' bubbles the same way
            const target = e.target;
            const path = target.dataset.path.split('.');
            let ref = window.currentData;
            for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]];
            ref[path[path.length - 1]] = target.value;
            
            // Re-render to update color coding if type changed
            if (e.target.dataset.path?.includes('type')) {
                renderApp(); 
            } else {
                mobileAutoSave();
            }
        }
    });
}

// --- RENDERERS ---

function renderApp() {
    updateHeader();
    const content = document.getElementById('mobile-content');
    if (!content) return;
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
    
    // Initialize Sortable for reordering with Long Press
    if (typeof Sortable !== 'undefined' && (activeTab === 'assets' || activeTab === 'budget')) {
        document.querySelectorAll('.sortable-list').forEach(list => {
            new Sortable(list, {
                delay: 250, // 250ms Long Press
                delayOnTouchOnly: true,
                animation: 150,
                onChoose: () => haptic(), // Feedback on pickup
                onEnd: () => { haptic(); mobileAutoSave(); } 
            });
        });
    }
}

function updateHeader() {
    const left = document.getElementById('header-left');
    const right = document.getElementById('header-right');
    const headerEl = document.querySelector('header');
    
    if (!left || !headerEl) return;

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

    // Dynamic Header Height Adjustment
    requestAnimationFrame(() => {
        const height = headerEl.offsetHeight;
        document.documentElement.style.setProperty('--header-height', `${height}px`);
    });
}

function updateHeaderContext() {
    const right = document.getElementById('header-right');
    if (!right || !window.currentData) return;
    
    const s = engine.calculateSummaries(window.currentData);
    
    let html = '';
    if (activeTab === 'assets') {
        const color = s.netWorth >= 0 ? 'text-emerald-400' : 'text-red-400';
        html = `
            <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Net Worth</div>
            <div class="font-black ${color} text-lg tracking-tighter mono-numbers">${math.toSmartCompactCurrency(s.netWorth)}</div>
        `;
    } else if (activeTab === 'income') {
        // Toggle Logic
        let valToShow, labelToShow, color;
        
        if (incomeDisplayMode === 'current') {
            valToShow = s.totalGrossIncome;
            labelToShow = 'Gross Inc';
            color = 'text-teal-400';
        } else {
            // Calculate Retirement Income (Real $)
            const d = window.currentData;
            const a = d.assumptions || {};
            const curAge = parseFloat(a.currentAge) || 40;
            const retAge = parseFloat(a.retirementAge) || 65;
            const yrs = Math.max(0, retAge - curAge);
            const inf = (a.inflation || 3) / 100;
            const infFac = Math.pow(1 + inf, yrs);
            
            // Social Security
            const ssStart = parseFloat(a.ssStartAge) || 67;
            const ssMonthly = parseFloat(a.ssMonthly) || 0;
            const ssFull = (retAge >= ssStart) ? engine.calculateSocialSecurity(ssMonthly, a.workYearsAtRetirement || 35, infFac) : 0;

            // Income Streams (Retained)
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
        const spent = s.totalAnnualBudget * factor;
        const suffix = budgetMode === 'monthly' ? '/mo' : '/yr';
        
        // Only show total expenses here in pink
        html = `
            <div class="text-right">
                <div class="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Total Spend</div>
                <div class="font-black text-pink-500 text-sm tracking-tighter mono-numbers">${math.toSmartCompactCurrency(spent)}${suffix}</div>
            </div>
        `;
    } else if (activeTab === 'fire') {
        html = ''; // FIRE has summary in view
    } else if (activeTab === 'aid') {
        html = '<div id="aid-header-placeholder"></div>';
    }
    
    right.innerHTML = html;
    if (activeTab === 'aid') updateAidHeader();
}

function renderAssets(el) {
    const d = window.currentData;
    
    el.innerHTML = `
        <div class="chart-container">
            <canvas id="assetDonutChart"></canvas>
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

    // Reordered sections: Investments -> Real Estate -> Other Assets -> HELOCs -> Debts -> Private Equity
    const sections = [
        { title: 'Investments', icon: 'fa-chart-line', color: 'text-blue-400', data: d.investments, path: 'investments' },
        { title: 'Real Estate', icon: 'fa-home', color: 'text-indigo-400', data: d.realEstate, path: 'realEstate', fields: ['value', 'mortgage'] },
        { title: 'Other Assets', icon: 'fa-car', color: 'text-teal-400', data: d.otherAssets, path: 'otherAssets', fields: ['value', 'loan'] },
        { title: 'HELOCs', icon: 'fa-university', color: 'text-red-400', data: d.helocs, path: 'helocs', fields: ['balance', 'limit'] },
        { title: 'Debts', icon: 'fa-credit-card', color: 'text-pink-400', data: d.debts, path: 'debts', fields: ['balance'] },
        { title: 'Private Equity & Options', icon: 'fa-briefcase', color: 'text-orange-400', data: d.stockOptions, path: 'stockOptions', isOption: true }
    ];

    document.getElementById('assets-list-container').innerHTML = sections.map((sect) => {
        let net = 0;
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
                net -= math.fromCurrency(item.balance);
            }
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
                <div class="p-3 space-y-2 sortable-list">
                    ${(sect.data || []).map((item, i) => {
                        const typeClass = sect.path === 'investments' ? getTypeColor(item.type) : 'text-slate-400';
                        const valColorClass = (sect.path === 'debts' || sect.path === 'helocs') ? 'text-red-400' : 'text-white';
                        
                        return `
                        <div class="swipe-container">
                            <div class="swipe-actions">
                                ${sect.isOption ? `<button class="swipe-action-btn bg-slate-700" onclick="window.openAdvancedPE(${i})">Settings</button>` : ''}
                                <button class="swipe-action-btn bg-red-600" onclick="window.removeItem('${sect.path}', ${i})">Delete</button>
                            </div>
                            <div class="swipe-content p-3 border border-white/5 flex items-center gap-3">
                                ${sect.isOption ? '' : '<div class="drag-handle text-slate-600 px-1"><i class="fas fa-grip-vertical"></i></div>'}
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
                                    ${sect.isOption ? `
                                    <div class="grid grid-cols-3 gap-1">
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
                                <div class="text-right space-y-1">
                                    ${sect.path === 'investments' ? `
                                        <input data-path="${sect.path}.${i}.value" data-type="currency" inputmode="decimal" value="${math.toCurrency(item.value)}" class="bg-transparent border-none p-0 text-sm font-black text-right text-white w-28 focus:ring-0">
                                        <div class="flex items-center justify-end gap-1">
                                            <span class="text-[8px] text-slate-500 font-bold uppercase">Basis</span>
                                            <input data-path="${sect.path}.${i}.costBasis" data-type="currency" inputmode="decimal" 
                                                value="${isBasisNA(item.type) ? 'N/A' : math.toCurrency(item.costBasis)}" 
                                                class="bg-transparent border-none p-0 text-[10px] font-bold text-right text-blue-400 w-20 focus:ring-0 ${isBasisNA(item.type) ? 'opacity-30 pointer-events-none' : ''}">
                                        </div>
                                    ` : (sect.isOption ? `
                                        <div class="flex flex-col justify-center h-full pt-4">
                                            <div class="text-orange-400 font-black text-sm mono-numbers">${math.toSmartCompactCurrency(Math.max(0, (math.fromCurrency(item.currentPrice) - math.fromCurrency(item.strikePrice)) * parseFloat(item.shares)))}</div>
                                            <span class="text-[8px] font-bold text-slate-500 uppercase mt-1">Equity</span>
                                        </div>
                                    ` : `
                                        <input data-path="${sect.path}.${i}.${sect.fields[0]}" data-type="currency" inputmode="decimal" value="${math.toCurrency(item[sect.fields[0]])}" class="bg-transparent border-none p-0 text-sm font-black text-right ${valColorClass} w-28 focus:ring-0">
                                        ${sect.fields[1] ? `<input data-path="${sect.path}.${i}.${sect.fields[1]}" data-type="currency" inputmode="decimal" value="${math.toCurrency(item[sect.fields[1]])}" class="bg-transparent border-none p-0 text-[10px] font-bold text-right text-red-400 w-28 focus:ring-0 block mt-1">` : ''}
                                    `)}
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                    <button class="section-add-btn" onclick="window.addItem('${sect.path}')">
                        <i class="fas fa-plus"></i> Add ${sect.title} Item
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function initAssetChart(data) {
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
    
    const labels = Object.keys(totals).sort((a,b) => totals[b] - totals[a]);
    const values = labels.map(k => totals[k]);
    const colors = labels.map(k => colorMap[k]);
    
    if (assetChart) assetChart.destroy();
    
    const shortNames = {
        'Pre-Tax (401k/IRA)': 'Pre-Tax',
        'Taxable': 'Brokerage',
        'Roth IRA': 'Roth',
        'Stock Options': 'PE',
        'Real Estate': 'RE',
        'Crypto': 'Crypto',
        'Metals': 'Metals',
        'Cash': 'Cash',
        'HSA': 'HSA'
    };

    assetChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%', 
            layout: { padding: 60 }, // Increased padding for labels
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
        },
        plugins: [{
            id: 'percentLabels',
            afterDraw: (chart) => {
                const ctx = chart.ctx;
                ctx.save();
                const total = chart.config.data.datasets[0].data.reduce((a, b) => a + b, 0);
                
                chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((element, index) => {
                        const value = dataset.data[index];
                        const percent = value / total;
                        
                        if (percent > 0.05) {
                            const model = element;
                            const midAngle = (model.startAngle + model.endAngle) / 2;
                            // Calculate variable radius to push horizontal labels out further
                            const horizFactor = Math.abs(Math.cos(midAngle)) * 25; 
                            const radius = model.outerRadius + 25 + horizFactor; 
                            
                            const x = model.x + Math.cos(midAngle) * radius;
                            const y = model.y + Math.sin(midAngle) * radius;

                            const labelFull = chart.data.labels[index];
                            const labelShort = shortNames[labelFull] || labelFull;
                            const sliceColor = dataset.backgroundColor[index];
                            
                            ctx.fillStyle = sliceColor; // Text color matches slice
                            ctx.font = '900 10px Inter';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            
                            // Outline for contrast
                            ctx.strokeStyle = '#0B0F19';
                            ctx.lineWidth = 4;
                            
                            const line1 = labelShort;
                            const line2 = `${math.toSmartCompactCurrency(value)} ${Math.round(percent * 100)}%`;
                            
                            ctx.strokeText(line1, x, y - 6);
                            ctx.fillText(line1, x, y - 6);
                            
                            ctx.font = 'bold 9px Inter'; 
                            ctx.strokeText(line2, x, y + 5);
                            ctx.fillText(line2, x, y + 5);
                        }
                    });
                });
                ctx.restore();
            }
        }]
    });
}

function updateAssetChart(data) {
    if (!assetChart) return;
    initAssetChart(data); 
}

function renderIncome(el) {
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
                        <input data-path="income.${i}.amount" data-type="currency" inputmode="decimal" value="${math.toCurrency(inc.isMonthly ? inc.amount * 12 : inc.amount)}" class="w-full p-2 bg-black/20 rounded-lg text-teal-400 font-black text-sm text-right">
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

function renderBudget(el) {
    const d = window.currentData;
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
            <div class="swipe-content bg-[#1e293b] border-b border-white/5 py-3 flex items-center justify-between">
                <div class="drag-handle text-slate-600 px-2"><i class="fas fa-grip-vertical"></i></div>
                <div class="flex-grow">
                     ${type === 'savings' ? `
                        <div class="relative">
                            <select data-path="budget.savings.${i}.type" class="bg-transparent border-none p-0 text-xs font-bold uppercase w-full cursor-pointer focus:ring-0 ${getTypeColor(item.type)}">
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
                    <input data-path="budget.${type}.${i}.annual" data-type="currency" inputmode="decimal" value="${math.toCurrency(val)}" class="bg-transparent border-none p-0 text-sm font-black text-right ${valClass} w-28 focus:ring-0 pr-1">
                </div>
            </div>
        </div>`;
    };

    // Check if 401k auto-row exists in data or needs calculation
    const s = engine.calculateSummaries(d);
    const auto401k = { type: 'Pre-Tax (401k/IRA)', annual: s.total401kContribution, monthly: s.total401kContribution/12, isLocked: true };
    
    // Filter out old locked items to prevent duplicates if any
    const savingsList = (d.budget?.savings || []).filter(s => !s.isLocked);
    
    el.innerHTML = `
        <div class="flex justify-center mb-4">
            <div class="flex bg-slate-900/50 p-1 rounded-lg border border-white/10">
                <button onclick="window.setBudgetMode('monthly')" class="px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${budgetMode === 'monthly' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}">Monthly</button>
                <button onclick="window.setBudgetMode('annual')" class="px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${budgetMode === 'annual' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}">Annual</button>
            </div>
        </div>

        <div class="collapsible-section">
            <div class="collapsible-header ${collapsedSections['Savings'] ? '' : 'active'}" onclick="window.toggleSection('Savings')">
                <span class="font-bold text-white text-sm">Savings</span>
                <i class="fas fa-chevron-down text-slate-500 transition-transform ${collapsedSections['Savings'] ? '' : 'rotate-180'}"></i>
            </div>
            <div class="collapsible-content ${collapsedSections['Savings'] ? '' : 'open'} bg-black/20">
                <div class="px-4 sortable-list">
                    ${renderRow(auto401k, -1, 'savings').replace('onclick="window.removeItem', 'onclick="alert(\'Calculated automatically from Income settings\') || null" style="opacity:0.5" disabled').replace('bg-red-600', 'bg-slate-700 hidden').replace('swipe-container', 'swipe-container opacity-80')}
                    ${savingsList.map((s, i) => renderRow(s, i, 'savings')).join('')}
                    <button class="section-add-btn" onclick="window.addItem('budget.savings')">
                        <i class="fas fa-plus"></i> Add Savings
                    </button>
                </div>
            </div>
        </div>

        <div class="collapsible-section">
             <div class="collapsible-header ${collapsedSections['Expenses'] ? '' : 'active'}" onclick="window.toggleSection('Expenses')">
                <span class="font-bold text-white text-sm">Expenses</span>
                <i class="fas fa-chevron-down text-slate-500 transition-transform ${collapsedSections['Expenses'] ? '' : 'rotate-180'}"></i>
            </div>
            <div class="collapsible-content ${collapsedSections['Expenses'] ? '' : 'open'} bg-black/20">
                <div class="px-4 sortable-list">
                     ${(d.budget?.expenses || []).map((s, i) => renderRow(s, i, 'expenses')).join('')}
                     <button class="section-add-btn" onclick="window.addItem('budget.expenses')">
                        <i class="fas fa-plus"></i> Add Expense
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.setBudgetMode = (mode) => {
    haptic();
    budgetMode = mode;
    updateHeader();
    renderBudget(document.getElementById('mobile-content'));
    attachSwipeHandlers();
};

function renderConfig(el) {
    const a = window.currentData.assumptions;
    
    const slider = (label, path, min, max, step, val, suffix = '', color='text-white') => `
        <div class="mb-5">
            <div class="flex justify-between items-end mb-2">
                <span class="text-[10px] font-bold ${color} uppercase tracking-widest">${label}</span>
                <span class="${color} font-black text-sm mono-numbers">${val}${suffix}</span>
            </div>
            <input type="range" data-path="assumptions.${path}" min="${min}" max="${max}" step="${step}" value="${val}" class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer">
        </div>
    `;

    // Render Collapsible Card helper
    const renderCard = (title, content, id) => `
        <div class="collapsible-section">
            <div class="collapsible-header ${collapsedSections[id] ? '' : 'active'}" onclick="window.toggleSection('${id}')">
                <span class="font-bold text-white text-sm uppercase tracking-widest">${title}</span>
                <i class="fas fa-chevron-down text-slate-500 transition-transform ${collapsedSections[id] ? '' : 'rotate-180'}"></i>
            </div>
            <div class="collapsible-content ${collapsedSections[id] ? '' : 'open'}">
                <div class="mobile-card !border-none !bg-transparent !mb-0">
                    ${content}
                </div>
            </div>
        </div>
    `;

    const personalContent = `
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
    `;

    const marketContent = `
        ${slider('Stocks (APY)', 'stockGrowth', 0, 15, 0.5, a.stockGrowth, '%', 'text-blue-400')}
        ${slider('Crypto (APY)', 'cryptoGrowth', 0, 15, 0.5, a.cryptoGrowth, '%', 'text-slate-400')}
        ${slider('Real Estate (APY)', 'realEstateGrowth', 0, 10, 0.5, a.realEstateGrowth, '%', 'text-indigo-400')}
        ${slider('Metals (APY)', 'metalsGrowth', 0, 15, 0.5, a.metalsGrowth || 6, '%', 'text-amber-400')}
        ${slider('Inflation', 'inflation', 0, 10, 0.1, a.inflation, '%', 'text-red-400')}
    `;

    const phasesContent = `
        ${slider('Go-Go (Age 60-70)', 'phaseGo1', 50, 150, 5, Math.round((a.phaseGo1 || 1.0) * 100), '%', 'text-purple-400')}
        ${slider('Slow-Go (Age 70-80)', 'phaseGo2', 50, 150, 5, Math.round((a.phaseGo2 || 0.9) * 100), '%', 'text-purple-400')}
        ${slider('No-Go (Age 80+)', 'phaseGo3', 50, 150, 5, Math.round((a.phaseGo3 || 0.8) * 100), '%', 'text-purple-400')}
    `;

    el.innerHTML = `
        ${renderCard('Personal', personalContent, 'PersonalConfig')}
        ${renderCard('Market', marketContent, 'MarketConfig')}
        ${renderCard('Retirement Phases', phasesContent, 'PhaseConfig')}
        
        <div class="mt-8 p-4 bg-red-900/10 border border-red-500/20 rounded-xl text-center">
            <button onclick="if(confirm('Reset all data?')) { localStorage.removeItem('firecalc_data'); window.location.reload(); }" class="text-red-400 font-bold uppercase text-xs tracking-widest">
                Reset to Defaults
            </button>
        </div>
    `;
}

function updateAidHeader() {
    const d = window.currentData;
    const ben = d.benefits;
    const size = 1 + (d.assumptions.filingStatus === 'Married Filing Jointly' ? 1 : 0) + (ben.dependents || []).length;
    const magi = ben.unifiedIncomeAnnual;
    const fpl = math.getFPL(size, d.assumptions.state);
    const ratio = magi / fpl;
    
    let status = 'MARKET';
    if (ratio <= 1.38 || ben.isPregnant || ben.isDisabled) { status = 'PLATINUM'; }
    else if (ratio <= 2.5) { status = 'SILVER'; }
    
    const snap = engine.calculateSnapBenefit(
        ben.isEarnedIncome ? magi/12 : 0, 
        ben.isEarnedIncome ? 0 : magi/12, 
        0, size, ben.shelterCosts, ben.hasSUA, ben.isDisabled, 
        ben.childSupportPaid, ben.depCare, ben.medicalExps, 
        d.assumptions.state, 1, true
    );

    const right = document.getElementById('header-right');
    if (!right) return;
    right.innerHTML = `
        <div class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">${status}</div>
        <div class="font-black text-emerald-400 text-lg tracking-tighter mono-numbers">${math.toCurrency(snap)}/mo</div>
    `;
}

function updateAidVisuals() {
    const d = window.currentData;
    const ben = d.benefits;
    const size = 1 + (d.assumptions.filingStatus === 'Married Filing Jointly' ? 1 : 0) + (ben.dependents || []).length;
    const magi = ben.unifiedIncomeAnnual;
    
    // Update MAGI Label
    const magiLabel = document.getElementById('aid-magi-val');
    if (magiLabel) magiLabel.textContent = `${math.toCurrency(magi)}/yr`;

    // Recalc SNAP
    const snapVal = engine.calculateSnapBenefit(
        ben.isEarnedIncome ? magi/12 : 0, 
        ben.isEarnedIncome ? 0 : magi/12, 
        0, size, ben.shelterCosts, ben.hasSUA, ben.isDisabled, 
        ben.childSupportPaid, ben.depCare, ben.medicalExps, 
        d.assumptions.state, 1, true
    );
    const snapEl = document.getElementById('aid-snap-val');
    if (snapEl) snapEl.textContent = math.toCurrency(snapVal);

    // Dynamic Plan Name & Styling
    const fpl = math.getFPL(size, d.assumptions.state);
    const ratio = magi / fpl;
    const medLimitRatio = ben.isPregnant ? 2.0 : 1.38;
    const stateId = d.assumptions.state;
    const stateMeta = stateTaxRates[stateId];
    const isExpandedState = stateMeta?.expanded !== false;
    const hasMedicaidPathway = isExpandedState || ben.isPregnant || ben.isDisabled;
    const isInMedicaidGap = !hasMedicaidPathway && ratio < 1.0;

    const planTitle = document.getElementById('aid-plan-title');
    const planSub = document.getElementById('aid-plan-sub');
    const planPrem = document.getElementById('aid-plan-prem');
    const planDed = document.getElementById('aid-plan-ded');
    const planCard = document.getElementById('aid-plan-card');

    if (planTitle && planCard) {
        // Simple class reset (brute force for stability)
        planCard.className = "mobile-card border-2 transition-colors duration-300";
        planTitle.className = "text-xl font-black uppercase tracking-tight";
        
        let theme = {}, pName = "", pSub = "", pPrem = "", pDed = "";
        
        // Cliff Logic for Subsidy
        let dynamicPremium = 0;
        const cliffRatio = 4.0;
        if (ratio > medLimitRatio) {
             let contributionPct = 0;
             if (ratio < cliffRatio) {
                const minScale = 0.021, maxScale = 0.095;
                contributionPct = minScale + (ratio - 1) * (maxScale - minScale) / (cliffRatio - 1);
             } else {
                contributionPct = 1.0;
             }
             dynamicPremium = (magi * contributionPct) / 12;
             if (ratio >= cliffRatio) dynamicPremium = 1100;
        }

        if (isInMedicaidGap) {
            pName = "MEDICAID GAP"; pSub = "NO COVERAGE"; pPrem = math.toCurrency(1100); pDed = "$10,000+";
            theme = { text: "text-red-400", border: "border-red-500/50", bg: "bg-red-900/10" };
        } else if (ratio <= medLimitRatio && hasMedicaidPathway) {
            pName = ben.isPregnant ? "Platinum (Pregnancy)" : (ben.isDisabled ? "Platinum (Disability)" : "Platinum (Medicaid)");
            pSub = "100% Full Coverage"; pPrem = "$0"; pDed = "$0";
            theme = { text: "text-emerald-400", border: "border-emerald-500/50", bg: "bg-emerald-900/10" };
        } else if (ratio <= 2.5) {
            pName = "Silver CSR"; pSub = "High Subsidy / Low Copay"; pPrem = math.toCurrency(dynamicPremium); pDed = "~$800";
            theme = { text: "text-blue-400", border: "border-blue-500/50", bg: "bg-blue-900/10" };
        } else {
            pName = "Market ACA"; pSub = "Standard Subsidy / Cliff"; pPrem = math.toCurrency(dynamicPremium); pDed = "$4,000+";
            theme = { text: "text-slate-400", border: "border-white/10", bg: "bg-slate-900/30" };
        }

        planCard.classList.add(theme.bg, theme.border);
        planTitle.classList.add(theme.text);
        planTitle.textContent = pName;
        if(planSub) planSub.textContent = pSub;
        if(planPrem) planPrem.textContent = pPrem;
        if(planDed) planDed.textContent = pDed;
    }
}

function renderAid(el) {
    const d = window.currentData;
    const ben = d.benefits || { dependents: [] };
    const size = 1 + (d.assumptions.filingStatus === 'Married Filing Jointly' ? 1 : 0) + (ben.dependents || []).length;
    const magi = ben.unifiedIncomeAnnual;
    const fpl = math.getFPL(size, d.assumptions.state);
    const ratio = magi / fpl;
    const stateId = d.assumptions.state;
    const stateMeta = stateTaxRates[stateId];
    const isExpandedState = stateMeta?.expanded !== false;
    const hasMedicaidPathway = isExpandedState || ben.isPregnant || ben.isDisabled;
    const isInMedicaidGap = !hasMedicaidPathway && ratio < 1.0;

    // Initial Static Render Logic (same as updateAidVisuals but for initial HTML generation)
    // Duplicate logic to ensure first paint is correct
    let planName = "", planSub = "", prem = "", ded = "", theme = {};
    const medLimitRatio = ben.isPregnant ? 2.0 : 1.38;
    
    let dynamicPremium = 0;
    const cliffRatio = 4.0;
    if (ratio > medLimitRatio) {
         let contributionPct = 0;
         if (ratio < cliffRatio) {
            const minScale = 0.021, maxScale = 0.095;
            contributionPct = minScale + (ratio - 1) * (maxScale - minScale) / (cliffRatio - 1);
         } else {
            contributionPct = 1.0;
         }
         dynamicPremium = (magi * contributionPct) / 12;
         if (ratio >= cliffRatio) dynamicPremium = 1100;
    }

    if (isInMedicaidGap) {
        planName = "MEDICAID GAP"; planSub = "NO COVERAGE"; prem = math.toCurrency(1100); ded = "$10,000+";
        theme = { text: "text-red-400", border: "border-red-500/50", bg: "bg-red-900/10" };
    } else if (ratio <= medLimitRatio && hasMedicaidPathway) {
        planName = ben.isPregnant ? "Platinum (Pregnancy)" : (ben.isDisabled ? "Platinum (Disability)" : "Platinum (Medicaid)");
        planSub = "100% Full Coverage"; prem = "$0"; ded = "$0";
        theme = { text: "text-emerald-400", border: "border-emerald-500/50", bg: "bg-emerald-900/10" };
    } else if (ratio <= 2.5) {
        planName = "Silver CSR"; planSub = "High Subsidy / Low Copay"; prem = math.toCurrency(dynamicPremium); ded = "~$800";
        theme = { text: "text-blue-400", border: "border-blue-500/50", bg: "bg-blue-900/10" };
    } else {
        planName = "Market ACA"; planSub = "Standard Subsidy / Cliff"; prem = math.toCurrency(dynamicPremium); ded = "$4,000+";
        theme = { text: "text-slate-400", border: "border-white/10", bg: "bg-slate-900/30" };
    }
    
    el.innerHTML = `
        <!-- CARD 1: HEALTHCARE & INCOME -->
        <div id="aid-plan-card" class="mobile-card ${theme.bg} border-2 ${theme.border}">
            <div class="flex items-center gap-3 mb-4 border-b border-white/5 pb-2">
                <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400"><i class="fas fa-heartbeat"></i></div>
                <h3 class="font-black text-white text-sm uppercase tracking-widest">Healthcare & Income</h3>
            </div>

            <div class="text-center py-2 mb-4">
                <div id="aid-plan-title" class="text-xl font-black uppercase tracking-tight ${theme.text}">${planName}</div>
                <div id="aid-plan-sub" class="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-1">${planSub}</div>
                <div class="flex justify-center gap-4 mt-2">
                     <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">PREM: <span id="aid-plan-prem" class="text-white">${prem}</span></span>
                     <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">DED: <span id="aid-plan-ded" class="text-white">${ded}</span></span>
                </div>
            </div>

            <div class="space-y-4">
                 <div>
                     <div class="flex justify-between items-center mb-1">
                         <span class="text-[10px] font-bold text-slate-500 uppercase">Sandbox MAGI</span>
                         <span id="aid-magi-val" class="text-teal-400 font-black text-sm mono-numbers">${math.toCurrency(magi)}/yr</span>
                     </div>
                     <input type="range" data-path="benefits.unifiedIncomeAnnual" min="0" max="150000" step="1000" value="${magi}" class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer">
                 </div>
                 <div class="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                    <span class="text-[10px] font-bold text-slate-500 uppercase">Income Type</span>
                    <label class="flex items-center gap-2">
                        <input type="checkbox" data-path="benefits.isEarnedIncome" ${ben.isEarnedIncome ? 'checked' : ''} class="rounded bg-slate-800 border-none text-blue-500">
                        <span class="text-[10px] font-bold text-white uppercase">${ben.isEarnedIncome ? 'Earned (W2)' : 'Unearned (1099/Div)'}</span>
                    </label>
                 </div>
            </div>
        </div>

        <!-- CARD 2: SNAP & HOUSEHOLD -->
        <div class="mobile-card bg-amber-500/5 border border-amber-500/20">
            <div class="flex items-center gap-3 mb-4 border-b border-white/5 pb-2">
                <div class="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500"><i class="fas fa-shopping-basket"></i></div>
                <h3 class="font-black text-white text-sm uppercase tracking-widest">SNAP & Household</h3>
            </div>

            <div class="flex flex-col items-center mb-6">
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Monthly Food Benefit</span>
                <span id="aid-snap-val" class="text-4xl font-black text-emerald-400 mono-numbers tracking-tight">$0</span>
            </div>

            <div class="space-y-4">
                <!-- Household List -->
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-[10px] font-bold text-slate-500 uppercase">Children</span>
                        <button onclick="window.addItem('benefits.dependents')" class="text-[9px] font-bold text-blue-400 uppercase bg-blue-500/10 px-2 py-1 rounded hover:bg-blue-500/20 transition-colors">+ Add Child</button>
                    </div>
                    <div class="space-y-2">
                        ${(ben.dependents || []).map((dep, i) => `
                            <div class="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5">
                                <div class="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 text-[10px]"><i class="fas fa-child"></i></div>
                                <input data-path="benefits.dependents.${i}.name" value="${dep.name}" class="bg-transparent border-none text-xs font-bold text-white flex-grow focus:ring-0 placeholder:text-slate-600" placeholder="Name">
                                <div class="flex items-center gap-1">
                                    <span class="text-[8px] font-bold text-slate-600 uppercase">Born</span>
                                    <input data-path="benefits.dependents.${i}.birthYear" type="number" inputmode="numeric" value="${dep.birthYear}" class="bg-transparent border-none text-xs font-black text-blue-400 w-12 text-center focus:ring-0">
                                </div>
                                <button onclick="window.removeItem('benefits.dependents', ${i})" class="text-slate-600 px-2 hover:text-red-400"><i class="fas fa-times"></i></button>
                            </div>
                        `).join('')}
                        ${(ben.dependents || []).length === 0 ? '<div class="text-[10px] text-slate-600 text-center italic py-2">No dependents added</div>' : ''}
                    </div>
                </div>

                <!-- Expense Grid -->
                <div class="grid grid-cols-2 gap-3 pt-2">
                     <div>
                         <label class="block text-[8px] font-bold text-slate-500 uppercase mb-1">Shelter Costs</label>
                         <input data-path="benefits.shelterCosts" data-type="currency" inputmode="decimal" value="${math.toCurrency(ben.shelterCosts)}" class="w-full bg-black/20 border border-white/5 rounded p-2 text-xs text-white font-bold text-right">
                     </div>
                     <div>
                         <label class="block text-[8px] font-bold text-slate-500 uppercase mb-1">Medical Exp</label>
                         <input data-path="benefits.medicalExps" data-type="currency" inputmode="decimal" value="${math.toCurrency(ben.medicalExps)}" class="w-full bg-black/20 border border-white/5 rounded p-2 text-xs text-blue-400 font-bold text-right">
                     </div>
                     <div>
                         <label class="block text-[8px] font-bold text-slate-500 uppercase mb-1">Child Support Pd</label>
                         <input data-path="benefits.childSupportPaid" data-type="currency" inputmode="decimal" value="${math.toCurrency(ben.childSupportPaid)}" class="w-full bg-black/20 border border-white/5 rounded p-2 text-xs text-pink-400 font-bold text-right">
                     </div>
                     <div>
                         <label class="block text-[8px] font-bold text-slate-500 uppercase mb-1">Dependent Care</label>
                         <input data-path="benefits.depCare" data-type="currency" inputmode="decimal" value="${math.toCurrency(ben.depCare)}" class="w-full bg-black/20 border border-white/5 rounded p-2 text-xs text-white font-bold text-right">
                     </div>
                </div>

                <!-- Toggles Footer -->
                <div class="flex justify-between items-center pt-2 border-t border-white/5">
                    <label class="flex flex-col items-center gap-1 cursor-pointer">
                        <input type="checkbox" data-path="benefits.isDisabled" ${ben.isDisabled ? 'checked' : ''} class="peer sr-only">
                        <div class="w-8 h-4 bg-slate-800 rounded-full peer-checked:bg-purple-600 transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-full"></div>
                        <span class="text-[8px] font-bold text-slate-500 uppercase peer-checked:text-white">Disabled</span>
                    </label>
                    <label class="flex flex-col items-center gap-1 cursor-pointer">
                        <input type="checkbox" data-path="benefits.isPregnant" ${ben.isPregnant ? 'checked' : ''} class="peer sr-only">
                        <div class="w-8 h-4 bg-slate-800 rounded-full peer-checked:bg-teal-600 transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-full"></div>
                        <span class="text-[8px] font-bold text-slate-500 uppercase peer-checked:text-white">Pregnant</span>
                    </label>
                    <label class="flex flex-col items-center gap-1 cursor-pointer">
                        <input type="checkbox" data-path="benefits.hasSUA" ${ben.hasSUA ? 'checked' : ''} class="peer sr-only">
                        <div class="w-8 h-4 bg-slate-800 rounded-full peer-checked:bg-blue-600 transition-colors relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-full"></div>
                        <span class="text-[8px] font-bold text-slate-500 uppercase peer-checked:text-white">Utility Allowance</span>
                    </label>
                </div>
            </div>
        </div>
        
        <!-- DISCLAIMERS (DESKTOP COPY) -->
        <div class="space-y-4 pb-4">
            <div class="p-3 bg-blue-900/10 border border-blue-500/20 rounded-xl">
                <h4 class="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-2"><i class="fas fa-info-circle"></i> Benefit Modeling Logic</h4>
                <div class="space-y-2">
                    <p class="text-[10px] text-slate-400 leading-relaxed">
                        <strong class="text-white">Asset Test:</strong> This calculator ignores asset tests. Be aware that the following states typically enforce asset limits ($2,750 - $5,000) which may disqualify you if you have savings: <strong>Texas, Idaho, Indiana, Iowa, Kansas, Mississippi, Missouri, South Dakota, Tennessee, Wyoming.</strong>
                    </p>
                    <p class="text-[10px] text-slate-400 leading-relaxed">
                        <strong class="text-white">Birth Years:</strong> Dependents are modeled as independent at age 19. Birth years making a child 19 or older in the current year are excluded from the effective household size.
                    </p>
                </div>
            </div>
            <div class="p-3 bg-orange-900/10 border border-orange-500/20 rounded-xl">
                <h4 class="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-2"><i class="fas fa-shield-virus"></i> Medicaid Expansion Logic</h4>
                <div class="space-y-2">
                    <p class="text-[10px] text-slate-400 leading-relaxed">
                        <strong class="text-white">Expansion States:</strong> Cover adults up to 138% FPL ($0 cost). 
                    </p>
                    <p class="text-[10px] text-slate-400 leading-relaxed">
                        <strong class="text-white">Non-Expansion:</strong> Adults under 100% FPL receive no ACA subsidy and no Medicaid. Recommend increasing MAGI to qualify for premium tax credits.
                    </p>
                </div>
            </div>
        </div>

        <!-- GLOSSARY -->
        <div class="collapsible-section">
            <div class="collapsible-header" onclick="window.toggleSection('glossary')">
                <span class="font-bold text-white text-sm">Glossary & Definitions</span>
                <i class="fas fa-chevron-down text-slate-500 transition-transform ${collapsedSections['glossary'] ? '' : 'rotate-180'}"></i>
            </div>
            <div class="collapsible-content ${collapsedSections['glossary'] ? '' : 'open'}">
                <div class="p-4 bg-black/20 space-y-3">
                    <div>
                        <h5 class="text-[10px] font-black text-teal-400 uppercase">MAGI (Modified Adjusted Gross Income)</h5>
                        <p class="text-[10px] text-slate-400 leading-relaxed mt-1">Income used to determine eligibility for ACA subsidies and Medicaid. Includes wages, taxable interest, and social security, but excludes most pre-tax deductions.</p>
                    </div>
                    <div>
                        <h5 class="text-[10px] font-black text-teal-400 uppercase">SUA (Standard Utility Allowance)</h5>
                        <p class="text-[10px] text-slate-400 leading-relaxed mt-1">A fixed dollar amount deduction for household utility costs (heating/cooling) used in SNAP calculations. Qualifying for SUA often significantly increases food benefits.</p>
                    </div>
                    <div>
                        <h5 class="text-[10px] font-black text-teal-400 uppercase">FPL (Federal Poverty Level)</h5>
                        <p class="text-[10px] text-slate-400 leading-relaxed mt-1">A measure of income issued annually by HHS. Subsidy levels are tied to percentages of FPL (e.g. Medicaid is 138% FPL, ACA Cliffs are 400% FPL).</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Update SNAP Visual (Post-Render)
    updateAidVisuals();
}

function renderFire(el) {
    // Run Simulation
    if (!window.currentData) return;
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
        
        <div class="mt-8">
            <div class="collapsible-section">
                <div class="collapsible-header" onclick="window.toggleSection('trace')">
                    <span class="font-bold text-white text-sm">Logic Trace</span>
                    <i class="fas fa-chevron-down text-slate-500 transition-transform ${collapsedSections['trace'] ? '' : 'rotate-180'}"></i>
                </div>
                <div class="collapsible-content ${collapsedSections['trace'] ? '' : 'open'}">
                    <div class="p-4 bg-black/20 font-mono text-[10px] text-slate-400 max-h-60 overflow-y-auto">
                        <div class="flex items-center gap-2 mb-2">
                            <span>Year:</span>
                            <input type="number" id="trace-year-input" class="bg-slate-800 text-white w-16 p-1 rounded" value="${new Date().getFullYear()}">
                        </div>
                        <div id="mobile-trace-output"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Init trace
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


// --- GLOBAL HELPERS ---

window.toggleIncomeHeaderMode = () => {
    haptic();
    incomeDisplayMode = incomeDisplayMode === 'current' ? 'retire' : 'current';
    updateHeaderContext();
};

window.toggleSection = (id) => {
    haptic();
    collapsedSections[id] = !collapsedSections[id];
    renderApp(); 
};

window.toggleBudgetMode = () => {
    haptic();
    budgetMode = budgetMode === 'monthly' ? 'annual' : 'monthly';
    updateHeader(); 
    renderBudget(document.getElementById('mobile-content')); 
    attachSwipeHandlers();
};

window.toggleBudgetBool = (type, index, key) => {
    haptic();
    const item = window.currentData.budget[type][index];
    item[key] = !item[key];
    mobileAutoSave();
    renderApp();
};

window.addItem = (path) => {
    haptic();
    let ref = window.currentData;
    const parts = path.split('.');
    for (let i = 0; i < parts.length; i++) {
        if (!ref[parts[i]]) ref[parts[i]] = [];
        ref = ref[parts[i]];
    }
    
    if (path.includes('budget')) ref.push({ name: 'New Item', annual: 0, remainsInRetirement: true });
    else if (path === 'income') ref.push({ name: 'New Income', amount: 0, increase: 3, contribution: 0, match: 0, bonusPct: 0 });
    else if (path.includes('dependents')) ref.push({ name: 'Child', birthYear: new Date().getFullYear() });
    else ref.push({ name: 'New Asset', value: 0 });
    
    renderApp();
    mobileAutoSave();
};

window.removeItem = (path, index) => {
    haptic();
    let ref = window.currentData;
    const parts = path.split('.');
    for (let i = 0; i < parts.length; i++) {
        ref = ref[parts[i]];
    }
    ref.splice(index, 1);
    renderApp();
    mobileAutoSave();
};

window.stepValue = (path, step) => {
    haptic();
    let ref = window.currentData;
    const parts = path.split('.');
    for (let i = 0; i < parts.length - 1; i++) ref = ref[parts[i]];
    const key = parts[parts.length - 1];
    let val = parseFloat(ref[key]) || 0;
    ref[key] = parseFloat((val + step).toFixed(1));
    renderApp(); 
    mobileAutoSave();
};

window.openAdvancedIncome = (index) => {
    haptic();
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
                <input data-path="income.${index}.incomeExpenses" data-type="currency" inputmode="decimal" value="${math.toCurrency(inc.incomeExpenses)}" class="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-right text-pink-400 font-black">
            </div>
            
            <div class="p-3 bg-black/20 rounded-xl flex justify-between items-center">
                <span class="text-sm font-bold text-white">No Tax Until Year</span>
                <input type="number" inputmode="numeric" data-path="income.${index}.nonTaxableUntil" value="${inc.nonTaxableUntil || ''}" placeholder="YYYY" class="w-24 bg-slate-900 border border-white/10 rounded-lg p-2 text-center text-white font-bold">
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
};

window.updateIncomeBool = (index, key, val) => {
    haptic();
    window.currentData.income[index][key] = val;
    mobileAutoSave();
};

window.toggleIncDedFreq = (index) => {
    haptic();
    const inc = window.currentData.income[index];
    const wasMon = !!inc.incomeExpensesMonthly;
    // convert value
    if (wasMon) inc.incomeExpenses = inc.incomeExpenses * 12; 
    else inc.incomeExpenses = inc.incomeExpenses / 12;
    inc.incomeExpensesMonthly = !wasMon;
    
    mobileAutoSave();
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
            // Ensure actions are visible for interaction
            const actions = el.querySelector('.swipe-actions');
            if(actions) actions.style.visibility = 'visible';

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
                haptic();
            } else {
                // Snap close
                content.style.transform = 'translateX(0)';
                currentSwipeEl = null;
            }
        });
    });
}

window.currentData = null;

// INIT Safety Check
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
