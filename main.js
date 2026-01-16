
/** FIRECalc Stable v4.1.2 - Production Build **/
import { initializeUI } from './core.js';
import { initializeData, updateSummaries, loadUserDataIntoUI, refreshAllModules } from './data.js';
import { benefits } from './benefits.js';
import { burndown } from './burndown.js';
import { projection } from './projection.js';
import { PROFILE_25_SINGLE, PROFILE_45_COUPLE, PROFILE_55_RETIREE, BLANK_PROFILE } from './profiles.js';

async function bootstrap() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');

    // 1. Aggressive Safety Net: If spinner is still visible after 500ms, start forcing
    const safetyTimer = setTimeout(() => {
        if (loginScreen && !loginScreen.classList.contains('hidden')) {
            console.warn("Safety net triggered: Booting app forcibly.");
            proceedToApp();
        }
    }, 500);

    async function proceedToApp() {
        clearTimeout(safetyTimer);
        try {
            // Ensure data is initialized before module logic runs
            await initializeData();
            
            // Late Module Init (Wait for data)
            initializeUI();
            if (benefits.init) benefits.init();
            if (burndown.init) burndown.init();
            if (projection.init) projection.init();

            showApp();
        } catch (e) {
            console.error("Boot sequence failed:", e);
            showApp(); // Final fallback
        }
    }

    function showApp() {
        if (loginScreen) loginScreen.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
        setupAppHeader(null, "Local User", "Reset App", true);
        updateSummaries();
    }

    // Start the process
    proceedToApp();
}

function showProfileSelection() {
    const modal = document.getElementById('profile-modal');
    const loginScreen = document.getElementById('login-screen');
    
    if (loginScreen) {
        const textEl = loginScreen.querySelector('.flex.items-center');
        if (textEl) {
            textEl.innerHTML = `
                <button id="btn-guest-entry" class="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-900/40 active:scale-95 transition-all">
                    Enter App
                </button>
            `;
            document.getElementById('btn-guest-entry').onclick = () => {
                loginScreen.classList.add('hidden');
                if (modal) modal.classList.remove('hidden');
            };
        } else {
            loginScreen.classList.add('hidden');
            if (modal) modal.classList.remove('hidden');
        }
    } else if (modal) {
        modal.classList.remove('hidden');
    }
    
    if (!modal) return;
    
    modal.querySelectorAll('button').forEach(b => {
        b.onclick = async () => {
            const type = b.dataset.profile;
            let data;
            
            if (type === '25') data = JSON.parse(JSON.stringify(PROFILE_25_SINGLE));
            else if (type === '55') data = JSON.parse(JSON.stringify(PROFILE_55_RETIREE));
            else if (type === '45') data = JSON.parse(JSON.stringify(PROFILE_45_COUPLE));
            else {
                data = JSON.parse(JSON.stringify(BLANK_PROFILE));
            }

            try {
                localStorage.setItem('firecalc_data', JSON.stringify(data));
            } catch (e) {
                console.warn("Could not save to local storage");
            }

            modal.classList.add('hidden');
            window.currentData = data; 
            await initializeData();
            setupAppHeader(null, "Local User", "Reset App", true);
            document.getElementById('app-container').classList.remove('hidden');
            loadUserDataIntoUI();
            refreshAllModules();
        };
    });
}

function setupAppHeader(avatarUrl, userName, logoutText, isLoggedIn) {
    const name = document.getElementById('user-name');
    if (name) name.textContent = userName || "Local User";
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.textContent = logoutText;
        logoutBtn.onclick = async () => {
            if (confirm("This will PERMANENTLY clear your local data and reset the simulator. Are you sure?")) {
                try {
                    localStorage.removeItem('firecalc_data');
                } catch (e) {}
                window.location.reload();
            }
        };
    }
}

// Ensure bootstrap runs after DOM is fully parsed
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
