
import { math, engine } from './utils.js';

export function solveHandoutHunter(ctx) {
    const { 
        bal, startOfYearBal, targetBudget, priorityOrder, age, 
        filingStatus, state, infFac, floorGross, floorTaxable, 
        cashFloor, helocLimit, benefits, hhSize, fpl100, traceLog 
    } = ctx;

    // --- HANDOUT HUNTER: MULTI-PASS ITERATIVE OPTIMIZER ---
    // Strategy: Fill MAGI "Net Room" with High-Income-Density assets first to utilize low tax brackets.
    // Then fill remaining budget gap with Zero-Income-Density assets.

    // 1. Calibration: Define MAGI Ceiling & Net Room
    const magiLimit = fpl100 * 1.38; // 138% FPL Ceiling for Medicaid/ACA Max
    const mandatoryMagi = floorTaxable; // From fixed income sources
    let netMagiRoom = Math.max(0, magiLimit - mandatoryMagi);
    traceLog.push(`Calibration: MAGI Limit ${math.toCurrency(magiLimit)}. Unavoidable Income: ${math.toCurrency(mandatoryMagi)}. Net Room: ${math.toCurrency(netMagiRoom)}.`);

    // 2. Asset Scan & Density Scoring
    let assets = [
        { key: '401k', type: 'Ordinary', val: bal['401k'], basis: 0, density: 1.0, label: '401k/IRA' },
        { key: 'metals', type: 'Collectibles', val: bal['metals'], basis: bal['metalsBasis'], density: 0, label: 'Metals' },
        { key: 'crypto', type: 'LTCG', val: bal['crypto'], basis: bal['cryptoBasis'], density: 0, label: 'Crypto' },
        { key: 'taxable', type: 'LTCG', val: bal['taxable'], basis: bal['taxableBasis'], density: 0, label: 'Brokerage' },
        { key: 'cash', type: 'Zero', val: bal['cash'], basis: bal['cash'], density: 0.0, label: 'Cash' },
        { key: 'roth-basis', type: 'Zero', val: bal['roth-basis'], basis: bal['roth-basis'], density: 0.0, label: 'Roth Basis' },
        { key: 'heloc', type: 'Debt', val: (helocLimit - bal['heloc']), basis: 0, density: 0.0, label: 'HELOC' }
    ];

    assets.forEach(a => {
        if (a.val > 0) {
            if (a.key === 'metals') { 
                const gainRatio = 1 - (a.basis / a.val);
                a.density = Math.max(0, gainRatio / 0.72); 
            } else if (a.type === 'LTCG') {
                const gainRatio = 1 - (a.basis / a.val);
                a.density = Math.max(0, gainRatio);
            }
        }
    });

    // 3. Iterative Optimization Loop
    let bestDraws = {};
    let currentOrdDraw = 0, currentLtcgDraw = 0, currentCollDraw = 0;
    let currentMagi = mandatoryMagi;
    let cashGenerated = 0;

    // PASS 1: MAGI FILL (High Density)
    let magiFillAssets = assets.filter(a => a.density > 0).sort((a,b) => b.density - a.density);
    
    for (let asset of magiFillAssets) {
        let room = magiLimit - currentMagi;
        if (room <= 1) break; 
        if (asset.val <= 0) continue;

        let drawNeeded = room / asset.density;
        let draw = Math.min(drawNeeded, asset.val);
        
        bestDraws[asset.key] = (bestDraws[asset.key] || 0) + draw;
        cashGenerated += draw;
        
        if (asset.key === '401k') {
            currentOrdDraw += draw;
            currentMagi += draw;
        } else if (asset.key === 'metals') {
            let taxablePart = draw * (1 - (asset.basis / asset.val));
            currentCollDraw += taxablePart;
            currentMagi += taxablePart;
        } else { // LTCG
            let taxablePart = draw * (1 - (asset.basis / asset.val));
            currentLtcgDraw += taxablePart;
            currentMagi += taxablePart;
        }
    }
    
    // PASS 2: BUDGET FILL (Gap Closure with Zero-ID Assets)
    let taxes = engine.calculateTax(floorTaxable + currentOrdDraw, currentLtcgDraw, currentCollDraw, filingStatus, state, infFac);
    let snap = engine.calculateSnapBenefit((floorTaxable + currentOrdDraw)/12, 0, 0, hhSize, (benefits.shelterCosts||700)*infFac, true, false, 0, 0, 0, state, infFac, true) * 12;
    
    let currentTotalCash = floorGross + cashGenerated + snap - taxes;
    let gap = targetBudget - currentTotalCash;
    
    if (gap > 0) {
        traceLog.push(`Pass 1 (MAGI Fill) complete. Gap: ${math.toCurrency(gap)}. Engaging Zero-ID assets.`);
        
        for (const pk of priorityOrder) {
            if (gap <= 0) break;
            
            let asset = assets.find(a => a.key === pk);
            if (!asset && pk === 'heloc') asset = { val: helocLimit - bal['heloc'], key: 'heloc' };
            
            if (!asset || asset.val <= 0) continue;
            
            let used = bestDraws[pk] || 0;
            let remaining = asset.val - used;
            if (remaining <= 0) continue;

            let draw = Math.min(gap, remaining);
            bestDraws[pk] = (bestDraws[pk] || 0) + draw;
            gap -= draw;
            
            if (asset.density > 0) {
                if (pk === '401k') currentOrdDraw += draw;
                else if (pk === 'metals') currentCollDraw += draw * (1 - (bal[pk+'Basis']/bal[pk]));
                else currentLtcgDraw += draw * (1 - (bal[pk+'Basis']/bal[pk]));
                
                let newTaxes = engine.calculateTax(floorTaxable + currentOrdDraw, currentLtcgDraw, currentCollDraw, filingStatus, state, infFac);
                let taxDrag = newTaxes - taxes;
                taxes = newTaxes;
                gap += taxDrag;
            }
        }
    }

    // Apply Draws
    Object.entries(bestDraws).forEach(([key, amount]) => {
        if (amount <= 0) return;
        if (key === 'heloc') {
            bal['heloc'] += amount;
        } else {
            if (bal[key+'Basis']) {
                const ratio = amount / bal[key];
                bal[key+'Basis'] -= (bal[key+'Basis'] * ratio);
            }
            bal[key] -= amount;
        }
    });
    
    // Recalculate finals
    let curOrdDraw = bestDraws['401k'] || 0;
    let curCollectiblesDraw = 0; 
    let curLtcgDraw = 0;
    
    if (bestDraws['metals'] > 0) {
        let bR = startOfYearBal['metalsBasis'] / startOfYearBal['metals'];
        curCollectiblesDraw += bestDraws['metals'] * (1 - bR);
    }
    ['taxable', 'crypto'].forEach(k => {
        if (bestDraws[k] > 0) {
            let bR = startOfYearBal[k+'Basis'] / startOfYearBal[k];
            curLtcgDraw += bestDraws[k] * (1 - bR);
        }
    });

    const fMAGI = floorTaxable + curOrdDraw + curLtcgDraw + curCollectiblesDraw;
    const status = (age >= 65 ? 'Medicare' : (fMAGI/fpl100 <= 1.38 ? 'Platinum' : 'Silver'));
    
    let pass1Names = magiFillAssets.filter(a => bestDraws[a.key] > 0).map(a => a.label);
    if (pass1Names.length) traceLog.push(`Optimizer Pass 1 (MAGI Fill): Drew from ${pass1Names.join(', ')} to hit ${math.toCurrency(fMAGI)} MAGI.`);
    
    let pass2Names = Object.keys(bestDraws).filter(k => bestDraws[k] > 0);
    if (pass2Names.length) traceLog.push(`Optimizer Pass 2 (Budget Fill): Final draw set: ${pass2Names.join(', ')}.`);

    return {
        drawMap: bestDraws,
        taxes,
        snap,
        status,
        surplus: Math.max(0, (floorGross + cashGenerated + snap - taxes) - targetBudget)
    };
}
