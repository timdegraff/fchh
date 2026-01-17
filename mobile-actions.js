
import { renderApp } from './mobile-render.js';
import { math } from './utils.js';

let mobileSaveTimeout = null;

export function haptic() {
    try {
        if (navigator && navigator.vibrate) {
            navigator.vibrate(10);
        }
    } catch (e) {
        // Ignore haptic errors
    }
}

export function mobileAutoSave() {
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

export function showWarning(title, message) {
    haptic();
    const modal = document.getElementById('warning-modal');
    const t = document.getElementById('warning-title');
    const m = document.getElementById('warning-msg');
    
    if (modal && t && m) {
        t.textContent = title;
        m.textContent = message;
        modal.classList.remove('hidden');
    } else {
        alert(`${title}: ${message}`);
    }
}

// Attach these to window so Sortable/Listeners can call them
window.haptic = haptic;
window.mobileAutoSave = mobileAutoSave;
window.showWarning = showWarning;

// --- GLOBAL UI ACTIONS ---

window.moveItem = (path, index, direction) => {
    haptic();
    let ref = window.currentData;
    const parts = path.split('.');
    
    // Resolve array from path (handle nested budget paths)
    for (let i = 0; i < parts.length; i++) {
        ref = ref[parts[i]];
    }
    
    // Validate bounds
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= ref.length) return;
    
    // Swap items
    const temp = ref[index];
    ref[index] = ref[newIndex];
    ref[newIndex] = temp;
    
    mobileAutoSave();
    renderApp();
};

window.toggleIncomeHeaderMode = () => {
    haptic();
    window.mobileState.incomeDisplayMode = window.mobileState.incomeDisplayMode === 'current' ? 'retire' : 'current';
    renderApp();
};

window.toggleSection = (id) => {
    haptic();
    window.mobileState.collapsedSections[id] = !window.mobileState.collapsedSections[id];
    renderApp(); 
};

window.setBudgetMode = (mode) => {
    haptic();
    window.mobileState.budgetMode = mode;
    renderApp();
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
    else if (path === 'income') ref.push({ 
        name: 'New Income', amount: 0, increase: 3, contribution: 0, match: 0, bonusPct: 0, 
        contribOnBonus: false, matchOnBonus: false, nonTaxableUntil: '' 
    });
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

window.stepConfig = (path, step) => {
    haptic();
    let ref = window.currentData;
    const parts = path.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
        if (!ref[parts[i]]) ref[parts[i]] = {}; 
        ref = ref[parts[i]];
    }
    const key = parts[parts.length - 1];
    let val = parseFloat(ref[key]) || 0;
    
    let adjustedStep = step;
    // Handle Phase Config special case: View uses integers (5), Model uses floats (0.05)
    if (path.includes('phaseGo') && Math.abs(step) >= 1) {
        adjustedStep = step / 100;
    }

    // Bounds Checking
    let newVal = val + adjustedStep;
    if (path.includes('Age')) newVal = Math.max(18, Math.min(80, newVal));
    else if (path.includes('growth') || path.includes('inflation')) newVal = Math.max(0, Math.min(15, newVal));
    else if (path.includes('Monthly')) newVal = Math.max(0, newVal);
    else if (path.includes('phaseGo')) newVal = Math.max(0.5, Math.min(1.5, newVal));
    
    // Percentages vs Raw
    if (path.includes('phaseGo')) {
        ref[key] = parseFloat(newVal.toFixed(2));
    } else {
        ref[key] = parseFloat(newVal.toFixed(1));
    }
    
    renderApp();
    mobileAutoSave();
};

window.openCashSettings = (index) => {
    haptic();
    // We don't actually use the index for the data, as it's a global setting,
    // but we use the context of 'accessing via this asset'.
    const currentReserve = window.currentData.burndown?.cashReserve || 25000;
    
    const modal = document.getElementById('advanced-modal');
    const content = document.getElementById('advanced-modal-content');
    
    content.innerHTML = `
        <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Cash Strategy</h4>
        
        <div class="space-y-4">
            <div class="p-4 bg-black/20 rounded-xl border border-white/5">
                <div class="flex justify-between items-center mb-4">
                    <span class="text-sm font-bold text-white">Emergency Fund Floor</span>
                    <span class="text-sm font-black text-pink-400 mono-numbers">${math.toCurrency(currentReserve)}</span>
                </div>
                <input type="range" 
                       min="0" max="100000" step="1000" 
                       value="${currentReserve}" 
                       oninput="window.updateCashReserve(this.value, this.previousElementSibling.lastElementChild)"
                       class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer">
                <p class="text-[9px] text-slate-500 mt-2 leading-relaxed">
                    The simulator will stop drawing from Cash once this floor is reached, forcing the sale of other assets instead.
                </p>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
};

window.updateCashReserve = (val, labelEl) => {
    const v = parseInt(val);
    if (!window.currentData.burndown) window.currentData.burndown = {};
    window.currentData.burndown.cashReserve = v;
    if (labelEl) labelEl.textContent = math.toCurrency(v);
    mobileAutoSave();
    // No need to re-render full app immediately, but good to ensure state is consistent on close
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

window.openAdvancedPE = (index) => {
    haptic();
    const item = window.currentData.stockOptions[index];
    const modal = document.getElementById('advanced-modal');
    const content = document.getElementById('advanced-modal-content');
    
    content.innerHTML = `
        <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Settings for ${item.name}</h4>
        
        <div class="space-y-4">
            <div class="flex items-center justify-between p-3 bg-black/20 rounded-xl">
                <div>
                    <span class="text-sm font-bold text-white">Tax Treatment</span>
                    <p class="text-[9px] text-slate-500 uppercase">Long Term Capital Gains vs Ordinary</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" onchange="window.updatePEBool(${index}, 'isLtcg', this.checked)" ${item.isLtcg ? 'checked' : ''} class="sr-only peer">
                    <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>
            
            <div class="p-3 bg-black/20 rounded-xl">
                <div class="flex justify-between mb-2">
                    <span class="text-sm font-bold text-white">Projected Growth</span>
                </div>
                <div class="flex items-center bg-slate-900 border border-white/10 rounded-lg overflow-hidden">
                    <button class="px-4 py-2 text-slate-400 hover:text-white border-r border-white/10" onclick="window.stepValue('stockOptions.${index}.growth', -1)">-</button>
                    <input data-path="stockOptions.${index}.growth" type="number" value="${item.growth || 10}" class="bg-transparent text-center w-full font-black text-blue-400 p-2 outline-none">
                    <button class="px-4 py-2 text-slate-400 hover:text-white border-l border-white/10" onclick="window.stepValue('stockOptions.${index}.growth', 1)">+</button>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

window.updatePEBool = (index, key, val) => {
    haptic();
    window.currentData.stockOptions[index][key] = val;
    mobileAutoSave();
}

// Swipe Handler (Moved from mobile.js)
window.attachSwipeHandlers = () => {
    const containers = document.querySelectorAll('.swipe-container');
    const { currentSwipeEl } = window.mobileState;
    
    containers.forEach(el => {
        let startX = 0;
        let content = el.querySelector('.swipe-content');
        if (!content) return;

        el.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            const actions = el.querySelector('.swipe-actions');
            if(actions) actions.style.visibility = 'visible';

            if (window.mobileState.currentSwipeEl && window.mobileState.currentSwipeEl !== content) {
                window.mobileState.currentSwipeEl.style.transform = 'translateX(0)';
            }
            window.mobileState.currentSwipeEl = content;
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
                const actionsWidth = el.querySelector('.swipe-actions').offsetWidth;
                content.style.transform = `translateX(-${actionsWidth}px)`;
                haptic();
            } else {
                content.style.transform = 'translateX(0)';
                window.mobileState.currentSwipeEl = null;
                // Hide actions after transition to prevent bleed
                const actions = el.querySelector('.swipe-actions');
                if(actions) setTimeout(() => actions.style.visibility = 'hidden', 250);
            }
        });
    });
};
