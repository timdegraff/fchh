
/** FIRECalc Stable v4.1.2 - Production Build **/
import { engine, math } from './utils.js';
import { benefits } from './benefits.js';
import { burndown } from './burndown.js';
import { projection } from './projection.js';
import { PROFILE_45_COUPLE } from './profiles.js';

window.currentData = null;
window.saveTimeout = null;

export async function initializeData() {
    try {
        // 1. Memory Check
        if (window.currentData) {
            loadUserDataIntoUI();
            refreshAllModules();
            return true;
        }

        // 2. Storage Check
        let local = null;
        try {
            local = localStorage.getItem('firecalc_data');
        } catch (e) {
            console.warn("Local storage access blocked or failed.");
        }

        if (local) {
            window.currentData = JSON.parse(local);
            console.log("Data loaded from storage.");
        } else {
            // 3. FORCE DEFAULT
            console.warn("No data found. Seeding default profile.");
            window.currentData = JSON.parse(JSON.stringify(PROFILE_45_COUPLE));
        }

        loadUserDataIntoUI();
        refreshAllModules();
        return true;
    } catch (err) {
        console.error("InitializeData fatal error:", err);
        // Fallback to absolute bare minimum to prevent hang
        window.currentData = window.currentData || JSON.parse(JSON.stringify(PROFILE_45_COUPLE));
        return true; 
    }
}

export function refreshAllModules() {
    try {
        if(window.updateSidebarChart) window.updateSidebarChart(window.currentData);
        if(window.createAssumptionControls) window.createAssumptionControls(window.currentData);
        if(benefits.load) benefits.load(window.currentData.benefits);
        if(burndown.load) burndown.load(window.currentData.burndown);
        if(projection.load) projection.load(window.currentData.projectionSettings);
        updateSummaries();
    } catch (e) {
        console.warn("Module refresh encountered minor error:", e);
    }
}

export function loadUserDataIntoUI() {
    if (!window.addRow || !window.currentData) return; 
    
    ['investment-rows', 'real-estate-rows', 'other-assets-rows', 'debt-rows', 'heloc-rows', 'budget-savings-rows', 'budget-expenses-rows', 'income-cards', 'stock-option-rows'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });

    const d = window.currentData;
    d.investments?.forEach(i => window.addRow('investment-rows', 'investment', i));
    d.realEstate?.forEach(i => window.addRow('real-estate-rows', 'realEstate', i));
    d.otherAssets?.forEach(i => window.addRow('other-assets-rows', 'otherAsset', i));
    d.helocs?.forEach(i => window.addRow('heloc-rows', 'heloc', i));
    d.debts?.forEach(i => window.addRow('debt-rows', 'debt', i));
    d.stockOptions?.forEach(i => window.addRow('stock-option-rows', 'stockOption', i));
    d.income?.forEach(i => window.addRow('income-cards', 'income', i));
    d.budget?.expenses?.forEach(i => window.addRow('budget-expenses-rows', 'budget-expense', i));

    const summaries = engine.calculateSummaries(d);
    window.addRow('budget-savings-rows', 'budget-savings', { 
        type: 'Pre-Tax (401k/IRA)', 
        annual: summaries.total401kContribution, 
        monthly: summaries.total401kContribution / 12, 
        isLocked: true 
    });

    d.budget?.savings?.forEach(i => {
        if (!i.isLocked) window.addRow('budget-savings-rows', 'budget-savings', i);
    });
}

function scrapeData() {
    if (!window.currentData) return null; 

    const getData = (id, fields) => {
        const container = document.getElementById(id);
        if (!container) return null; 
        const rows = Array.from(container.children).filter(row => !row.classList.contains('locked-row'));
        return rows.map(row => {
            const obj = {};
            fields.forEach(field => {
                const el = row.querySelector(`[data-id="${field}"]`);
                if (el) {
                    if (el.type === 'checkbox') obj[field] = el.checked;
                    else if (el.dataset.type === 'currency' || el.dataset.type === 'percent') obj[field] = math.fromCurrency(el.value);
                    else if (el.type === 'number') obj[field] = parseFloat(el.value) || 0;
                    else {
                        let val = el.value;
                        if (val === 'true') val = true;
                        else if (val === 'false') val = false;
                        obj[field] = val;
                    }
                }
            });
            return obj;
        });
    };

    const newData = {
        ...window.currentData,
        investments: getData('investment-rows', ['name', 'type', 'value', 'costBasis']) ?? window.currentData.investments,
        realEstate: getData('real-estate-rows', ['name', 'value', 'mortgage', 'principalPayment']) ?? window.currentData.realEstate,
        otherAssets: getData('other-assets-rows', ['name', 'value', 'loan']) ?? window.currentData.otherAssets,
        helocs: getData('heloc-rows', ['name', 'balance', 'limit', 'rate']) ?? window.currentData.helocs,
        debts: getData('debt-rows', ['name', 'balance', 'principalPayment']) ?? window.currentData.debts,
        stockOptions: getData('stock-option-rows', ['name', 'shares', 'strikePrice', 'currentPrice', 'growth', 'isLtcg']) ?? window.currentData.stockOptions,
        income: getData('income-cards', ['name', 'amount', 'increase', 'contribution', 'match', 'bonusPct', 'isMonthly', 'incomeExpenses', 'incomeExpensesMonthly', 'nonTaxableUntil', 'remainsInRetirement', 'contribOnBonus', 'matchOnBonus']) ?? window.currentData.income
    };

    const budgetSavings = getData('budget-savings-rows', ['type', 'monthly', 'annual', 'remainsInRetirement']);
    const budgetExpenses = getData('budget-expenses-rows', ['name', 'monthly', 'annual', 'remainsInRetirement', 'isFixed']);
    
    newData.budget = {
        savings: budgetSavings ?? window.currentData.budget?.savings,
        expenses: budgetExpenses ?? window.currentData.budget?.expenses
    };

    const assumptionsContainer = document.getElementById('assumptions-container');
    if (assumptionsContainer) {
        const aObj = { ...window.currentData.assumptions };
        assumptionsContainer.querySelectorAll('[data-id]').forEach(el => {
            const key = el.dataset.id;
            if (el.type === 'checkbox') aObj[key] = el.checked;
            else if (el.dataset.type === 'currency') aObj[key] = math.fromCurrency(el.value);
            else if (el.dataset.type === 'percent') {
                const val = math.fromCurrency(el.value);
                const isMultiplier = ['phaseGo1', 'phaseGo2', 'phaseGo3'].includes(key);
                aObj[key] = isMultiplier ? val : (val * 100);
            }
            else if (el.tagName === 'SELECT') aObj[key] = el.value;
            else {
                let val = parseFloat(el.value);
                aObj[key] = isNaN(val) ? el.value : val;
            }
        });
        newData.assumptions = aObj;
    }

    if (benefits.scrape) newData.benefits = benefits.scrape();
    if (burndown.scrape) newData.burndown = burndown.scrape();
    if (projection.scrape) newData.projectionSettings = projection.scrape();

    return newData;
}

export function forceSyncData() {
    const newData = scrapeData();
    if (!newData) return;
    window.currentData = newData;
    updateSummaries();
    if(window.updateSidebarChart) window.updateSidebarChart(newData);
}

export function autoSave(updateUI = true) {
    if (!window.currentData) return; 
    if (window.saveTimeout) clearTimeout(window.saveTimeout);
    window.saveTimeout = setTimeout(() => {
        const newData = scrapeData();
        if (!newData) return;
        window.currentData = newData; 
        
        if (updateUI) {
            updateSummaries();
            if(window.updateSidebarChart) window.updateSidebarChart(newData);
        }

        try {
            localStorage.setItem('firecalc_data', JSON.stringify(newData));
        } catch (e) {
            console.warn("Auto-save to localStorage failed (restricted environment)");
        }
        showSaveIndicator();
    }, 1000);
}

window.debouncedAutoSave = () => autoSave(true);

function showSaveIndicator() {
    const el = document.getElementById('save-indicator');
    if (!el) return;
    el.classList.add('bg-emerald-400');
    setTimeout(() => el.classList.remove('bg-emerald-400'), 500);
}

export function updateSummaries() {
    const data = window.currentData;
    if (!data) return;
    
    const s = engine.calculateSummaries(data);
    const set = (id, val, isCurr = true) => {
        const el = document.getElementById(id);
        if (el) el.textContent = isCurr ? math.toCurrency(val) : val;
    };

    set('sum-assets', s.totalAssets);
    set('sum-liabilities', s.totalLiabilities);
    set('sum-networth', s.netWorth);
    set('sidebar-networth', s.netWorth);
    set('sum-gross-income', s.totalGrossIncome);
    set('sum-income-adjusted', s.magiBase);
    set('sum-budget-savings', s.totalAnnualSavings);
    set('sum-budget-annual', s.totalAnnualBudget);
    
    const currentAge = parseFloat(data.assumptions?.currentAge) || 40;
    const retirementAge = parseFloat(data.assumptions?.retirementAge) || 65;
    const ssStartAge = parseFloat(data.assumptions?.ssStartAge) || 67;
    const inflation = (data.assumptions?.inflation || 3) / 100;
    const currentYear = new Date().getFullYear();

    const yrsToRetire = Math.max(0, retirementAge - currentAge);
    const retYear = currentYear + yrsToRetire;
    
    const lblRet1 = document.getElementById('label-ret-year-summary');
    if (lblRet1) lblRet1.textContent = retYear;
    const lblRet2 = document.getElementById('label-ret-year-budget');
    if (lblRet2) lblRet2.textContent = retYear;

    const infFacRet = Math.pow(1 + inflation, yrsToRetire);
    const ssAtRet = (retirementAge >= ssStartAge) ? engine.calculateSocialSecurity(data.assumptions?.ssMonthly || 0, data.assumptions?.workYearsAtRetirement || 35, infFacRet) : 0;
    
    // Add retirement income cards logic
    const cardRetIncome = (data.income || []).filter(inc => inc.remainsInRetirement).reduce((s, inc) => {
        const isMon = inc.isMonthly === true || inc.isMonthly === 'true';
        let gross = math.fromCurrency(inc.amount) * (isMon ? 12 : 1);
        const growthFac = Math.pow(1 + (inc.increase / 100 || 0), yrsToRetire);
        
        const isExpMon = inc.incomeExpensesMonthly === true || inc.incomeExpensesMonthly === 'true';
        const deductions = math.fromCurrency(inc.incomeExpenses) * (isExpMon ? 12 : 1);
        
        // Subtract deduction from the grown gross
        return s + (gross * growthFac) - deductions;
    }, 0);

    set('sum-retirement-income-floor', ssAtRet + cardRetIncome);
    
    const realFloorEl = document.getElementById('sum-retirement-income-floor-real');
    if (realFloorEl) {
        const ssAtRetReal = (ssAtRet + cardRetIncome) / infFacRet;
        realFloorEl.textContent = `${math.toCurrency(ssAtRetReal)} in 2026 Dollars`;
    }

    // Refined retirement budget calculation
    const retireExp = (data.budget?.expenses || []).filter(e => e.remainsInRetirement).reduce((s, e) => {
        return s + math.fromCurrency(e.annual) * (e.isFixed ? 1 : infFacRet);
    }, 0);
    const retireSav = (data.budget?.savings || []).filter(s => s.remainsInRetirement).reduce((s, s_item) => {
        return s + math.fromCurrency(s_item.annual) * (s_item.isFixed ? 1 : infFacRet);
    }, 0);

    const retireTotal = retireExp + retireSav;
    set('sum-retire-budget', retireTotal);
    
    const retireTotalReal = retireTotal / infFacRet;
    set('sum-retire-budget-real', `${math.toCurrency(retireTotalReal)} IN 2026 DOLLARS`, false);
}
