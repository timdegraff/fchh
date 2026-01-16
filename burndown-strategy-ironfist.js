
import { math, engine } from './utils.js';
import { assetMeta } from './burndown-render.js';

export function solveIronFist(ctx) {
    // Unpack Context
    const { 
        bal, startOfYearBal, targetBudget, rates, priorityOrder, age, 
        filingStatus, state, infFac, floorGross, floorTaxable, 
        cashFloor, helocLimit, benefits, hhSize, traceLog 
    } = ctx;

    // --- SMART HELOC LOGIC (Pre-Solver) ---
    // 1. HELOC Arbitrage & Medicare Flush
    // NOTE: This modifies 'bal' in-place before the main burn down loop starts.
    if (bal['heloc'] > 0) {
        const currentStockRate = math.getGrowthForAge('Stock', age, ctx.currentAge, ctx.assumptions); // Assuming assumptions passed in ctx
        const helocInterestRate = rates.heloc;
        const isArbitrage = helocInterestRate > (currentStockRate - 0.02); 
        let helocPaydown = 0;

        // RULE A: Medicare Flush (Age 65) - Unlock Roth Earnings & HSA to wipe debt
        if (age === 65) {
            if (bal['roth-earnings'] > 0) {
                const pay = Math.min(bal['heloc'], bal['roth-earnings']);
                bal['heloc'] -= pay;
                bal['roth-earnings'] -= pay;
                helocPaydown += pay;
            }
            if (bal['heloc'] > 0 && bal['hsa'] > 0) {
                const pay = Math.min(bal['heloc'], bal['hsa']);
                bal['heloc'] -= pay;
                bal['hsa'] -= pay;
                helocPaydown += pay;
            }
            if (helocPaydown > 0) traceLog.push(`Smart HELOC (Medicare Flush): Unlocked ${math.toCurrency(helocPaydown)} Roth/HSA to wipe debt at Age 65.`);
        }

        // RULE B: Ghost Money Arbitrage (Pre-65) - Cash & Roth Basis Only
        if (bal['heloc'] > 0 && age < 65 && isArbitrage) {
            const availCash = Math.max(0, bal['cash'] - cashFloor);
            const payCash = Math.min(bal['heloc'], availCash);
            if (payCash > 0) {
                bal['heloc'] -= payCash;
                bal['cash'] -= payCash;
                helocPaydown += payCash;
            }
            if (bal['heloc'] > 0 && bal['roth-basis'] > 0) {
                const payRoth = Math.min(bal['heloc'], bal['roth-basis']);
                bal['heloc'] -= payRoth;
                bal['roth-basis'] -= payRoth;
                helocPaydown += payRoth;
            }
            if (helocPaydown > 0) {
                traceLog.push(`Smart HELOC (Arbitrage): Paid down ${math.toCurrency(helocPaydown)} using Ghost Money.`);
            }
        }
    }

    // --- SEQUENTIAL BINARY SEARCH SOLVER ---
    let currentTaxes = engine.calculateTax(floorTaxable, 0, 0, filingStatus, state, infFac);
    let currentSnap = engine.calculateSnapBenefit(floorTaxable / 12, 0, 0, hhSize, (benefits.shelterCosts || 700) * infFac, true, false, 0, 0, 0, state, infFac, true) * 12;
    let currentNet = floorGross + currentSnap - currentTaxes;

    let drawMap = {};
    let preTaxDraw = 0;
    let runningOrd = floorTaxable;
    let runningLtcg = 0;
    let runningColl = 0;

    for (const pk of priorityOrder) {
        let deficit = targetBudget - currentNet;
        if (deficit <= 1) break; // Gap is filled

        const av = (pk === 'cash' ? Math.max(0, bal[pk] - cashFloor) : (pk === 'heloc' ? Math.max(0, helocLimit - bal[pk]) : bal[pk]));
        if (av <= 1) continue;

        // Binary search for precise draw from THIS specific asset
        let low = 0, high = av, bestDraw = 0;
        const bR = (['taxable', 'crypto', 'metals'].includes(pk) && startOfYearBal[pk] > 0) ? startOfYearBal[pk+'Basis'] / startOfYearBal[pk] : 1;

        // Increased iterations from 15 to 30 to ensure precision on large balances ($10M+ accounts)
        for (let j = 0; j < 30; j++) {
            let testDraw = (low + high) / 2;
            let testOrd = runningOrd + (pk === '401k' ? testDraw : 0);
            let testLtcg = runningLtcg + (['taxable', 'crypto'].includes(pk) ? testDraw * (1 - bR) : 0);
            let testColl = runningColl + (pk === 'metals' ? testDraw * (1 - bR) : 0);

            let testTaxes = engine.calculateTax(testOrd, testLtcg, testColl, filingStatus, state, infFac);
            let testSnap = engine.calculateSnapBenefit(testOrd / 12, 0, 0, hhSize, (benefits.shelterCosts || 700) * infFac, true, false, 0, 0, 0, state, infFac, true) * 12;
            
            // Net Gain = Gross Draw - Tax Impact + Aid Impact
            let netGain = testDraw - (testTaxes - currentTaxes) + (testSnap - currentSnap);
            
            if (netGain < deficit) {
                bestDraw = testDraw;
                low = testDraw;
            } else {
                high = testDraw;
            }
        }
        
        // Commit the draw
        bestDraw = high; 
        let finalOrd = runningOrd + (pk === '401k' ? bestDraw : 0);
        let finalLtcg = runningLtcg + (['taxable', 'crypto'].includes(pk) ? bestDraw * (1 - bR) : 0);
        let finalColl = runningColl + (pk === 'metals' ? bestDraw * (1 - bR) : 0);
        
        let finalTaxes = engine.calculateTax(finalOrd, finalLtcg, finalColl, filingStatus, state, infFac);
        let finalSnap = engine.calculateSnapBenefit(finalOrd / 12, 0, 0, hhSize, (benefits.shelterCosts || 700) * infFac, true, false, 0, 0, 0, state, infFac, true) * 12;

        traceLog.push(`Iron Fist: Drew ${math.toCurrency(bestDraw)} from ${assetMeta[pk].label} to cover deficit.`);

        drawMap[pk] = bestDraw;
        preTaxDraw += bestDraw;
        runningOrd = finalOrd;
        runningLtcg = finalLtcg;
        runningColl = finalColl;
        currentTaxes = finalTaxes;
        currentSnap = finalSnap;
        currentNet = floorGross + preTaxDraw + currentSnap - currentTaxes;

        if (pk === 'heloc') bal['heloc'] += bestDraw;
        else {
            if (bal[pk+'Basis']) bal[pk+'Basis'] -= (bal[pk+'Basis'] * (bestDraw / bal[pk]));
            bal[pk] -= bestDraw;
        }
    }

    const fMAGI = runningOrd + runningLtcg + runningColl;
    const status = (age >= 65 ? 'Medicare' : (fMAGI/ctx.fpl100 <= 1.38 ? 'Platinum' : 'Silver'));
    traceLog.push(`Final Cycle MAGI: ${math.toCurrency(fMAGI)} (${status}).`);

    return { 
        drawMap, 
        taxes: currentTaxes, 
        snap: currentSnap, 
        status, 
        surplus: Math.max(0, currentNet - targetBudget)
    };
}
