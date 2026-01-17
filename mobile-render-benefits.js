
import { math, engine, stateTaxRates } from './utils.js';

export function updateAidHeader() {
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

export function updateAidVisuals() {
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

export function renderAid(el) {
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
    
    // Q&A State
    const isQaOpen = window.mobileState.collapsedSections['glossary'];

    // Initial Static Render Logic
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
        <div id="aid-plan-card" class="mobile-card ${theme.bg} border-2 ${theme.border} py-3">
            <div class="flex items-center gap-3 mb-2 border-b border-white/5 pb-2">
                <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400"><i class="fas fa-heartbeat"></i></div>
                <h3 class="font-black text-white text-sm uppercase tracking-widest">Healthcare & Income</h3>
            </div>

            <div class="text-center py-1 mb-2">
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
                         <span id="aid-magi-val" class="text-emerald-400 font-black text-sm mono-numbers">${math.toCurrency(magi)}/yr</span>
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
        <div class="mobile-card bg-blue-900/10 border border-blue-500/20 py-3">
            <div class="flex items-center gap-3 mb-2 border-b border-white/5 pb-2">
                <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-500"><i class="fas fa-shopping-basket"></i></div>
                <h3 class="font-black text-white text-sm uppercase tracking-widest">SNAP & Household</h3>
            </div>

            <div class="flex flex-col items-center mb-3">
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Monthly Food Benefit</span>
                <span id="aid-snap-val" class="text-4xl font-black text-emerald-400 mono-numbers tracking-tight">$0</span>
            </div>

            <div class="space-y-2"> <!-- Reduced space from space-y-4 -->
                <!-- Household List -->
                <div>
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[10px] font-bold text-slate-500 uppercase">Children</span>
                        <button onclick="window.addItem('benefits.dependents')" class="text-[9px] font-bold text-blue-400 uppercase bg-blue-500/10 px-2 py-1 rounded hover:bg-blue-500/20 transition-colors">+ Add Child</button>
                    </div>
                    <div class="space-y-1">
                        ${(ben.dependents || []).map((dep, i) => `
                            <div class="flex items-center gap-2 bg-black/20 p-1.5 rounded-lg border border-white/5">
                                <div class="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-blue-400 text-[10px]"><i class="fas fa-child"></i></div>
                                <input data-path="benefits.dependents.${i}.name" value="${dep.name}" class="bg-transparent border-none text-xs font-bold text-white flex-grow focus:ring-0 placeholder:text-slate-600" placeholder="Name">
                                <div class="flex items-center gap-1">
                                    <span class="text-[8px] font-bold text-slate-600 uppercase">Born</span>
                                    <input data-path="benefits.dependents.${i}.birthYear" type="number" inputmode="numeric" value="${dep.birthYear}" class="bg-transparent border-none text-xs font-black text-blue-400 w-12 text-center focus:ring-0">
                                </div>
                                <button onclick="window.removeItem('benefits.dependents', ${i})" class="text-slate-600 px-2 hover:text-red-400"><i class="fas fa-times"></i></button>
                            </div>
                        `).join('')}
                        ${(ben.dependents || []).length === 0 ? '<div class="text-[10px] text-slate-600 text-center italic py-1">No dependents added</div>' : ''}
                    </div>
                </div>

                <!-- Expense Grid -->
                <div class="grid grid-cols-2 gap-2 pt-1">
                     <div>
                         <label class="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Shelter Costs</label>
                         <input data-path="benefits.shelterCosts" data-type="currency" inputmode="decimal" value="${math.toCurrency(ben.shelterCosts)}" class="w-full bg-black/20 border border-white/5 rounded p-2 text-xs text-white font-bold text-right">
                     </div>
                     <div>
                         <label class="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Medical Exp</label>
                         <input data-path="benefits.medicalExps" data-type="currency" inputmode="decimal" value="${math.toCurrency(ben.medicalExps)}" class="w-full bg-black/20 border border-white/5 rounded p-2 text-xs text-white font-bold text-right">
                     </div>
                     <div>
                         <label class="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Child Support Pd</label>
                         <input data-path="benefits.childSupportPaid" data-type="currency" inputmode="decimal" value="${math.toCurrency(ben.childSupportPaid)}" class="w-full bg-black/20 border border-white/5 rounded p-2 text-xs text-white font-bold text-right">
                     </div>
                     <div>
                         <label class="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Dependent Care</label>
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
        
        <!-- GLOSSARY / Q&A -->
        <div class="collapsible-section">
            <div class="collapsible-header ${isQaOpen ? 'active' : ''}" onclick="window.toggleSection('glossary')">
                <span class="font-bold text-white text-base">Q&A</span>
                <i class="fas fa-chevron-down text-slate-500 transition-transform ${isQaOpen ? 'rotate-180' : ''}"></i>
            </div>
            <div class="collapsible-content ${isQaOpen ? 'open' : ''}">
                <div class="p-4 bg-black/20 space-y-3">
                    <div>
                        <h5 class="text-[10px] font-black text-teal-400 uppercase">MAGI (Modified Adjusted Gross Income)</h5>
                        <p class="text-[10px] text-slate-400 leading-relaxed mt-1">Income used to determine eligibility for ACA subsidies and Medicaid.</p>
                    </div>
                    <div>
                        <h5 class="text-[10px] font-black text-teal-400 uppercase">SUA (Standard Utility Allowance)</h5>
                        <p class="text-[10px] text-slate-400 leading-relaxed mt-1">A fixed dollar amount deduction for household utility costs in SNAP.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    updateAidVisuals();
}
