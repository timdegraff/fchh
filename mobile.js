import { initializeData, autoSave, forceSyncData } from './data.js';
import { logoutUser } from './auth.js';
import { math, engine, assumptions, stateTaxRates, assetColors } from './utils.js';
import { benefits } from './benefits.js';
import { burndown } from './burndown.js';
import { projection } from './projection.js';
import { formatter } from './formatter.js';
import { PROFILE_25_SINGLE, PROFILE_45_COUPLE, PROFILE_55_RETIREE } from './profiles.js';

// --- DEVELOPER / RESET MODE ---
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('reset') === 'true') {
    const keysToClear = [
        'firecalc_data',
        'firecalc_guest_acknowledged',
        'firecalc_guest_mode',
        'firecalc_guest_profile_selected',
        'firecalc_app_version'
    ];
    keysToClear.forEach(k => localStorage.removeItem(k));
    window.location.href = window.location.pathname;
}

// --- SAFE VERSION CHECK LOGIC ---
const APP_VERSION = "4.0"; 
const currentSavedVersion = localStorage.getItem('firecalc_app_version');
if (currentSavedVersion !== APP_VERSION) {
    localStorage.setItem('firecalc_app_version', APP_VERSION);
}

function setIndicatorColor(el, colorClass) {
    if (!el) return;
    el.classList.remove('text-slate-600', 'text-green-500', 'text-red-500', 'text-orange-500', 'text-slate-400');
    el.classList.add(colorClass, 'transition-colors', 'duration-200');
}

window.addRow = (id, type, data) => {};
window.updateSidebarChart = () => {};
window.createAssumptionControls = () => {};
window.debouncedAutoSave = () => {
    if (window.mobileSaveTimeout) clearTimeout(window.mobileSaveTimeout);
    window.mobileSaveTimeout = setTimeout(() => {
        const indicators = document.querySelectorAll('#save-indicator');
        indicators.forEach(el => setIndicatorColor(el, 'text-orange-500'));
        autoSave(false);
    }, 1500);
};

function triggerHaptic() {
    if (navigator.vibrate) navigator.vibrate(10); 
}

let currentTab = 'assets-debts';

function init() {
    attachGlobal();
    
    // Check if data exists
    const localData = localStorage.getItem('firecalc_data');
    if (localData) {
        loadApp();
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
    }
}

async function loadApp() {
    await initializeData(); 
    document.getElementById('login-screen').classList.add('hidden'); 
    document.getElementById('app-container').classList.remove('hidden');
    renderTab();
}

function showProfileSelection() {
    const profileModal = document.getElementById('profile-modal');
    if (!profileModal) return;
    
    profileModal.classList.remove('hidden');
    
    const handleProfileSelect = async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        
        const type = btn.dataset.profile;
        let dataToLoad = PROFILE_45_COUPLE; 
        
        if (type === '25') dataToLoad = PROFILE_25_SINGLE;
        else if (type === '55') dataToLoad = PROFILE_55_RETIREE;
        
        localStorage.setItem('firecalc_data', JSON.stringify(dataToLoad));
        profileModal.classList.add('hidden');
        await loadApp();
    };

    profileModal.querySelectorAll('button').forEach(b => {
        b.onclick = handleProfileSelect;
    });
}

function attachGlobal() {
    const guestBtn = document.getElementById('guest-btn'); 
    if (guestBtn) {
        guestBtn.onclick = () => { 
            const loginScreen = document.getElementById('login-screen');
            if (loginScreen) loginScreen.classList.add('hidden');
            showProfileSelection();
        };
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => { 
            if (confirm("Reset application?")) {
                localStorage.removeItem('firecalc_data');
                window.location.reload();
            }
        };
    }

    document.querySelectorAll('.mobile-nav-btn').forEach(btn => btn.onclick = () => { 
        triggerHaptic(); 
        currentTab = btn.dataset.tab; 
        document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active')); 
        btn.classList.add('active'); 
        if (currentTab === 'burndown' || currentTab === 'projection' || currentTab === 'benefits') {
            forceSyncData();
        }
        renderTab(); 
    });

    document.body.addEventListener('input', (e) => {
        triggerHaptic(); const input = e.target;
        if (input.dataset.id && document.getElementById('m-assumptions-container') && input.closest('#m-assumptions-container')) {
            const val = parseFloat(input.value) || 0, id = input.dataset.id;
            if (['stockGrowth', 'cryptoGrowth', 'metalsGrowth', 'realEstateGrowth'].includes(id) && window.currentData.assumptions) window.currentData.assumptions[id + 'Perpetual'] = val;
            const display = input.parentElement.querySelector('.mono-numbers');
            if (display) display.textContent = id.includes('Growth') || id === 'inflation' ? val + '%' : (id === 'ssMonthly' ? math.toCurrency(val) : val);
            if (window.currentData.assumptions) window.currentData.assumptions[id] = val;
        }
        // ... (rest of standard input logic)
        if (window.debouncedAutoSave) window.debouncedAutoSave();
        updateMobileSummaries(); updateMobileNW();
    });
}

// ... (renderTab and other helpers as exists in previous version)
init();
