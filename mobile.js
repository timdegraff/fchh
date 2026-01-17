
import { initializeData } from './data.js';
import { math } from './utils.js';
import { PROFILE_25_SINGLE, PROFILE_45_COUPLE, PROFILE_55_RETIREE, BLANK_PROFILE } from './profiles.js';
import { renderApp, updateHeaderContext, updateAidHeader, updateAidVisuals, updateAssetChart } from './mobile-render.js';
import './mobile-actions.js'; // Registers window globals

// --- APP STATE ---
window.mobileState = {
    activeTab: 'assets',
    budgetMode: 'monthly', // Changed default to Monthly
    incomeDisplayMode: 'current',
    assetDisplayMode: 'networth',
    collapsedSections: {},
    currentSwipeEl: null
};

// --- BOOTSTRAP ---
async function init() {
    console.log("Mobile App Initializing...");
    const hasData = localStorage.getItem('firecalc_data');
    
    attachListeners();

    if (!hasData) {
        const login = document.getElementById('login-screen');
        if (login) login.classList.remove('hidden');
    } else {
        try {
            await initializeData();
            
            // Restore User UI Preferences
            if (window.currentData && window.currentData.ui && window.currentData.ui.mobileBudgetMode) {
                window.mobileState.budgetMode = window.currentData.ui.mobileBudgetMode;
            }

            const login = document.getElementById('login-screen');
            const app = document.getElementById('app-container');
            if (login) login.classList.add('hidden');
            if (app) app.classList.remove('hidden');
            renderApp();
        } catch (e) {
            console.error("Data load failed", e);
            const login = document.getElementById('login-screen');
            if (login) login.classList.remove('hidden');
        }
    }
}

function attachListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
            window.haptic?.();
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window.mobileState.activeTab = btn.dataset.tab;
            
            // Scroll to top
            const content = document.getElementById('mobile-content');
            if (content) content.scrollTop = 0;
            window.scrollTo(0, 0);
            
            renderApp();
        };
    });

    // Profile Selection - Entry Point
    const guestBtn = document.getElementById('guest-btn');
    if (guestBtn) {
        guestBtn.onclick = async () => {
            window.haptic?.();
            console.log("Guest button clicked. Initializing default profile...");
            try {
                const data = PROFILE_45_COUPLE;
                if (!data) throw new Error("Profile Data Missing");
                
                localStorage.setItem('firecalc_data', JSON.stringify(data));
                window.location.reload();
            } catch (e) {
                console.error("Initialization Failed:", e);
                alert("Failed to initialize app: " + e.message);
            }
        };
    } else {
        console.warn("Guest button not found during attachListeners");
    }

    document.querySelectorAll('[data-profile]').forEach(btn => {
        btn.onclick = async () => {
            window.haptic?.();
            const pid = btn.dataset.profile;
            let data = BLANK_PROFILE;
            if (pid === '25') data = PROFILE_25_SINGLE;
            if (pid === '45') data = PROFILE_45_COUPLE;
            if (pid === '55') data = PROFILE_55_RETIREE;
            if (pid === 'blank') data = BLANK_PROFILE;
            
            localStorage.setItem('firecalc_data', JSON.stringify(data));
            window.location.reload();
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
            target.value = raw === 0 ? '' : raw; 
            // NOTE: Do not switch type to 'number' here; it breaks iOS focus.
            // inputmode="decimal" handles the keyboard.
        } else if (target.dataset.type === 'percent') {
            const raw = parseFloat(target.value.replace('%', ''));
            target.value = isNaN(raw) ? '' : raw;
            // Also avoid type switching for percent to be safe
        }
    });

    // Blur: Reformat with units
    container.addEventListener('focusout', (e) => {
        const target = e.target;
        if (target.tagName !== 'INPUT') return;

        if (target.dataset.type === 'currency') {
            const val = math.fromCurrency(target.value); // Use helper to handle partial inputs
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
        
        const pathParts = target.dataset.path.split('.');
        const dataType = target.dataset.type;
        const key = pathParts[pathParts.length - 1];
        
        let val = target.value;

        if (target.type === 'range') {
            const display = target.previousElementSibling?.querySelector('.mono-numbers');
            if (display) {
                display.textContent = display.textContent.replace(/[0-9\.,]+/, val); 
            }
        }
        
        if (dataType === 'currency') {
            val = math.fromCurrency(val); // FIXED: Handle "$1,000" strings from blur event
            if (window.mobileState.activeTab === 'budget' && window.mobileState.budgetMode === 'monthly') val = val * 12;
        } else if (dataType === 'percent') {
            val = parseFloat(val) || 0;
        } else if (target.type === 'checkbox') {
            val = target.checked;
            window.haptic?.();
        } else if (target.type === 'range') {
            val = parseFloat(val);
            if (target.dataset.path.includes('phaseGo')) {
                val = val / 100;
            }
        } else if (target.type === 'number') {
            val = parseFloat(val) || 0;
        }

        // Prevent negatives for key financial inputs
        const nonNegativeFields = ['growth', 'increase', 'contribution', 'match', 'bonusPct', 'rate', 'shares', 'strikePrice', 'currentPrice', 'value', 'balance', 'limit', 'mortgage', 'loan', 'costBasis', 'annual', 'monthly', 'amount', 'incomeExpenses'];
        if (nonNegativeFields.includes(key)) {
            val = Math.max(0, val);
        }

        // Deep set
        let ref = window.currentData;
        for (let i = 0; i < pathParts.length - 1; i++) {
            if (!ref[pathParts[i]]) ref[pathParts[i]] = {}; 
            ref = ref[pathParts[i]];
        }
        ref[pathParts[pathParts.length - 1]] = val;

        // Auto-update Collapsible Section Headers (Totals)
        const collectionName = pathParts[0];
        if (collectionName && window.currentData[collectionName] && Array.isArray(window.currentData[collectionName])) {
            const headerId = `section-header-total-${collectionName}`;
            const headerEl = document.getElementById(headerId);
            
            if (headerEl) {
                let net = 0;
                let isDebt = false;
                window.currentData[collectionName].forEach(item => {
                    if (collectionName === 'stockOptions') {
                        // Using raw parseFloat on item.shares string if it comes from text input without currency formatting
                        const s = parseFloat(item.shares) || 0;
                        const st = math.fromCurrency(item.strikePrice);
                        const f = math.fromCurrency(item.currentPrice);
                        net += Math.max(0, (f - st) * s);
                    } else if (collectionName === 'investments' || collectionName === 'otherAssets') {
                        net += math.fromCurrency(item.value) - math.fromCurrency(item.loan || 0);
                    } else if (collectionName === 'realEstate') {
                        net += math.fromCurrency(item.value) - math.fromCurrency(item.mortgage);
                    } else if (collectionName === 'helocs' || collectionName === 'debts') {
                        // Display POSITIVE balance for debt headers
                        net += math.fromCurrency(item.balance);
                        isDebt = true;
                    }
                });
                
                const disp = isDebt ? math.toSmartCompactCurrency(-net) : math.toSmartCompactCurrency(net);
                headerEl.textContent = disp;
                
                // Also update color if needed (though existing class should handle it)
                if (headerEl.parentElement) {
                    if (collectionName === 'stockOptions') {
                        // Maintain orange color override for stock options
                    } else {
                        headerEl.parentElement.classList.remove('text-emerald-400', 'text-red-400');
                        headerEl.parentElement.classList.add(isDebt ? 'text-red-400' : 'text-emerald-400');
                    }
                }
            }
        }

        // Special Logic for Stock Options Equity Calculation (Card Internal)
        if (target.dataset.path.startsWith('stockOptions.')) {
            const index = parseInt(pathParts[1]);
            
            if (!isNaN(index) && window.currentData.stockOptions && window.currentData.stockOptions[index]) {
                const opt = window.currentData.stockOptions[index];
                
                // Fallback: If opt.shares is "200,000", parseFloat handles it if no comma, but if string has comma?
                // Inputs are text for shares? mobile-render-assets uses type="number" so commas shouldn't exist.
                // Just in case, strip non-numeric characters before parse.
                const rawShares = String(opt.shares).replace(/[^0-9\.]/g, '');
                const shares = parseFloat(rawShares) || 0;
                
                const strike = math.fromCurrency(opt.strikePrice);
                const fmv = math.fromCurrency(opt.currentPrice);
                
                let equity = Math.max(0, (fmv - strike) * shares);
                if (isNaN(equity)) equity = 0;
                
                const displayEl = document.getElementById(`equity-display-${index}`);
                if (displayEl) {
                    displayEl.textContent = math.toSmartCompactCurrency(equity);
                }
                
                updateAssetChart(window.currentData);
            }
        }

        window.mobileAutoSave?.();
        
        updateHeaderContext(); 
        if (window.mobileState.activeTab === 'aid') {
            updateAidHeader();
            updateAidVisuals(); 
        }
        if (window.mobileState.activeTab === 'assets') updateAssetChart(window.currentData);
    });
    
    // Change event for selects
    container.addEventListener('change', (e) => {
        if (e.target.tagName === 'SELECT') {
            window.haptic?.();
            const target = e.target;
            const path = target.dataset.path.split('.');
            let ref = window.currentData;
            for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]];
            ref[path[path.length - 1]] = target.value;
            
            if (e.target.dataset.path?.includes('type')) {
                renderApp(); 
            } else {
                window.mobileAutoSave?.();
            }
        }
    });
}

// INIT Safety Check
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
