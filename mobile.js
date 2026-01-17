
import { initializeData } from './data.js';
import { math } from './utils.js';
import { PROFILE_25_SINGLE, PROFILE_45_COUPLE, PROFILE_55_RETIREE, BLANK_PROFILE } from './profiles.js';
import { renderApp, updateHeaderContext, updateAidHeader, updateAidVisuals, updateAssetChart } from './mobile-render.js';
import './mobile-actions.js'; // Registers window globals

// --- APP STATE ---
window.mobileState = {
    activeTab: 'assets',
    budgetMode: 'annual',
    incomeDisplayMode: 'current',
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
            target.type = 'number'; 
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

        if (target.type === 'range') {
            const display = target.previousElementSibling?.querySelector('.mono-numbers');
            if (display) {
                display.textContent = display.textContent.replace(/[0-9\.,]+/, val); 
            }
        }
        
        if (dataType === 'currency') {
            val = parseFloat(val) || 0;
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
        }

        // Deep set
        let ref = window.currentData;
        for (let i = 0; i < path.length - 1; i++) {
            if (!ref[path[i]]) ref[path[i]] = {}; 
            ref = ref[path[i]];
        }
        ref[path[path.length - 1]] = val;

        // Special Logic for Stock Options Equity Calculation
        if (target.dataset.path.startsWith('stockOptions.')) {
            const parts = target.dataset.path.split('.');
            const index = parseInt(parts[1]);
            if (!isNaN(index) && window.currentData.stockOptions[index]) {
                const opt = window.currentData.stockOptions[index];
                const shares = parseFloat(opt.shares) || 0;
                const strike = math.fromCurrency(opt.strikePrice);
                const fmv = math.fromCurrency(opt.currentPrice);
                const equity = Math.max(0, (fmv - strike) * shares);
                
                const displayEl = document.getElementById(`equity-display-${index}`);
                if (displayEl) displayEl.textContent = math.toSmartCompactCurrency(equity);
                
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
