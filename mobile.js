
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
    
    // Updated Layout: Legend on Left, Chart on Right
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

    // Reordered sections
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
                                <div class="flex-grow space-y-0.5">
                                    <input data-path="${sect.path}.${i}.name" value="${item.name}" class="bg-transparent border-none p-0 text-[11px] font-bold text-white w-full placeholder:text-slate-600 focus:ring-0 uppercase tracking-tight">
                                    ${sect.path === 'investments' ? `
                                    <div class="relative w-[70%]">
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
                                <div class="text-right space-y-0.5">
                                    ${sect.path === 'investments' ? `
                                        <input data-path="${sect.path}.${i}.value" data-type="currency" inputmode="decimal" value="${math.toCurrency(item.value)}" class="bg-transparent border-none p-0 text-sm font-black text-right text-white w-36 focus:ring-0">
                                        <div class="flex items-center justify-end gap-1">
                                            <span class="text-[8px] text-slate-500 font-bold uppercase">Basis</span>
                                            <input data-path="${sect.path}.${i}.costBasis" data-type="currency" inputmode="decimal" 
                                                value="${isBasisNA(item.type) ? 'N/A' : math.toCurrency(item.costBasis)}" 
                                                class="bg-transparent border-none p-0 text-[10px] font-bold text-right text-blue-400 w-24 focus:ring-0 ${isBasisNA(item.type) ? 'opacity-30 pointer-events-none' : ''}">
                                        </div>
                                    ` : (sect.isOption ? `
                                        <div class="flex flex-col justify-center h-full pt-4">
                                            <div class="text-orange-400 font-black text-sm mono-numbers">${math.toSmartCompactCurrency(Math.max(0, (math.fromCurrency(item.currentPrice) - math.fromCurrency(item.strikePrice)) * parseFloat(item.shares)))}</div>
                                            <span class="text-[8px] font-bold text-slate-500 uppercase mt-1">Equity</span>
                                        </div>
                                    ` : `
                                        <input data-path="${sect.path}.${i}.${sect.fields[0]}" data-type="currency" inputmode="decimal" value="${math.toCurrency(item[sect.fields[0]])}" class="bg-transparent border-none p-0 text-sm font-black text-right ${valColorClass} w-36 focus:ring-0">
                                        ${sect.fields[1] ? `<input data-path="${sect.path}.${i}.${sect.fields[1]}" data-type="currency" inputmode="decimal" value="${math.toCurrency(item[sect.fields[1]])}" class="bg-transparent border-none p-0 text-[10px] font-bold text-right text-red-400 w-36 focus:ring-0 block mt-1">` : ''}
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
    
    // Sort by value desc
    const sortedKeys = Object.keys(totals).sort((a,b) => totals[b] - totals[a]);
    const values = sortedKeys.map(k => totals[k]);
    const colors = sortedKeys.map(k => colorMap[k]);
    
    // Populate Legend on Left
    const legend = document.getElementById('assetLegend');
    if (legend) {
        legend.innerHTML = sortedKeys.map(k => `
            <div class="flex items-center gap-1.5 min-w-0">
                <div class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background-color: ${colorMap[k]}"></div>
                <div class="flex flex-col min-w-0">
                    <span class="text-[9px] font-black uppercase text-slate-400 truncate leading-none">${k.replace(/\(.*\)/, '')}</span>
                    <span class="text-[10px] font-bold text-white leading-tight">${math.toSmartCompactCurrency(totals[k])}</span>
                </div>
            </div>
        `).join('');
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
                    <option value="Head of Household" ${a.filingStatus === 'Head of Household' ? 'selected' : ''}>Head of Household</option>
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
