
import { math, engine, assetColors, stateTaxRates } from './utils.js';
import { assetMeta, defaultPriorityOrder } from './burndown-render.js';
import { solveIronFist } from './burndown-strategy-ironfist.js';
import { solveHandoutHunter } from './burndown-strategy-handout.js';

export function simulateProjection(data, config) {
    const { 
        assumptions = {}, 
        investments = [], 
        income = [], 
        budget = {}, 
        benefits = {}, 
        helocs = [], 
        realEstate = [], 
        otherAssets = [], 
        debts = [], 
        stockOptions = [] 
    } = data || {};

    const inflationRate = (assumptions.inflation || 3) / 100, filingStatus = assumptions.filingStatus || 'Single', persona = config.strategyMode, rAge = parseFloat(assumptions.retirementAge) || 65, cashFloor = config.cashReserve;
    const ssStartAge = parseFloat(assumptions.ssStartAge) || 67, ssMonthly = parseFloat(assumptions.ssMonthly) || 0, workYears = parseFloat(assumptions.workYearsAtRetirement) || 35;
    
    let firstInsolvencyAge = null;
    const summaries = engine.calculateSummaries(data);
    
    // Safely parse HELOC rate
    let hRateRaw = parseFloat((helocs[0] || {}).rate);
    if (isNaN(hRateRaw)) hRateRaw = 7.0;
    const helocInterestRate = hRateRaw / 100;

    let bal = {
        'cash': investments.filter(i => i.type === 'Cash').reduce((s, i) => s + math.fromCurrency(i.value), 0),
        'taxable': investments.filter(i => i.type === 'Taxable').reduce((s, i) => s + math.fromCurrency(i.value), 0),
        'taxableBasis': investments.filter(i => i.type === 'Taxable').reduce((s, i) => s + math.fromCurrency(i.costBasis), 0),
        'roth-basis': investments.filter(i => i.type === 'Roth IRA').reduce((s, i) => s + math.fromCurrency(i.costBasis), 0),
        'roth-earnings': investments.filter(i => i.type === 'Roth IRA').reduce((s, i) => s + Math.max(0, math.fromCurrency(i.value) - math.fromCurrency(i.costBasis)), 0),
        '401k': investments.filter(i => i.type === 'Pre-Tax (401k/IRA)').reduce((s, i) => s + math.fromCurrency(i.value), 0),
        'crypto': investments.filter(i => i.type === 'Crypto').reduce((s, i) => s + math.fromCurrency(i.value), 0),
        'cryptoBasis': investments.filter(i => i.type === 'Crypto').reduce((s, i) => s + math.fromCurrency(i.costBasis), 0),
        'metals': investments.filter(i => i.type === 'Metals').reduce((s, i) => s + math.fromCurrency(i.value), 0),
        'metalsBasis': investments.filter(i => i.type === 'Metals').reduce((s, i) => s + math.fromCurrency(i.costBasis), 0),
        'hsa': investments.filter(i => i.type === 'HSA').reduce((s, i) => s + math.fromCurrency(i.value), 0),
        'heloc': helocs.reduce((s, h) => s + math.fromCurrency(h.balance), 0)
    };

    const helocLimit = helocs.reduce((s, h) => s + math.fromCurrency(h.limit), 0);
    const startAge = Math.floor(parseFloat(assumptions.currentAge) || 40);
    const results = [];
    const basePriority = config.priority || defaultPriorityOrder;

    for (let i = 0; i <= (100 - startAge); i++) {
        const age = startAge + i, year = new Date().getFullYear() + i, isRet = age >= rAge, infFac = Math.pow(1 + inflationRate, i);
        const effectiveKidsCount = (benefits.dependents || []).filter(d => (d.birthYear + 19) >= year).length;
        const totalHhSize = 1 + (filingStatus === 'Married Filing Jointly' ? 1 : 0) + effectiveKidsCount;
        const fpl100 = math.getFPL(totalHhSize, assumptions.state) * infFac;

        // PRIORITY SWAP: LATE RETIREMENT SAFEGUARD (Age 65+)
        let currentYearPriority = [...basePriority];
        if (age >= 65) {
            currentYearPriority = currentYearPriority.filter(p => p !== 'heloc');
            currentYearPriority.push('heloc'); 
        }

        let baseBudget = config.useSync ? summaries.totalAnnualBudget : config.manualBudget;
        let targetBudget = baseBudget * infFac;

        if (isRet) {
            let phaseMult = 1.0;
            if (age < 60) phaseMult = assumptions.phaseGo1 ?? 1.0;
            else if (age < 80) phaseMult = assumptions.phaseGo2 ?? 0.9;
            else phaseMult = assumptions.phaseGo3 ?? 0.8;
            targetBudget *= phaseMult;
        }

        const helocInterestThisYear = bal['heloc'] * helocInterestRate;
        targetBudget += helocInterestThisYear;

        let floorGross = 0, floorTaxable = 0, incomeBreakdown = [];
        let traceLog = [];
        
        if (helocInterestThisYear > 50) {
            traceLog.push(`Debt Service: ${math.toCurrency(helocInterestThisYear)} interest due on ${math.toCurrency(bal['heloc'])} HELOC balance. Added to budget.`);
        }

        // 1. INJECT ANNUAL SAVINGS (Post-Growth, Pre-Withdrawal)
        (budget.savings || []).forEach(sav => {
            if (isRet && !sav.remainsInRetirement) return;
            const amt = math.fromCurrency(sav.annual) * infFac;
            if (sav.type === 'Taxable') { bal['taxable'] += amt; bal['taxableBasis'] += amt; }
            else if (sav.type === 'Roth IRA') { bal['roth-basis'] += amt; }
            else if (sav.type === 'Cash') { bal['cash'] += amt; }
            else if (sav.type === 'HSA') { bal['hsa'] += amt; }
            else if (sav.type === 'Crypto') { bal['crypto'] += amt; bal['cryptoBasis'] += amt; }
            else if (sav.type === 'Metals') { bal['metals'] += amt; bal['metalsBasis'] += amt; }
            else if (sav.type === 'Pre-Tax (401k/IRA)') { bal['401k'] += amt; }
        });

        const processIncome = (inc) => {
            const isMon = inc.isMonthly === true || inc.isMonthly === 'true';
            let gross = math.fromCurrency(inc.amount) * (isMon ? 12 : 1) * Math.pow(1 + (inc.increase / 100 || 0), i);
            const bonus = (gross * (parseFloat(inc.bonusPct) / 100 || 0));
            
            let personal401k = 0, match401k = 0;
            if (!isRet) {
                const irsLimit = (age >= 50 ? 31000 : 23500) * infFac;
                let rawP = (gross * (parseFloat(inc.contribution) / 100 || 0));
                if (inc.contribOnBonus) rawP += (bonus * (parseFloat(inc.contribution) / 100 || 0));
                personal401k = Math.min(rawP, irsLimit);
                
                let rawM = (gross * (parseFloat(inc.match) / 100 || 0));
                if (inc.matchOnBonus) rawM += (bonus * (parseFloat(inc.match) / 100 || 0));
                match401k = rawM;
                bal['401k'] += (personal401k + match401k);
            }

            const isExpMon = inc.incomeExpensesMonthly === true || inc.incomeExpensesMonthly === 'true';
            let ded = (math.fromCurrency(inc.incomeExpenses) * (isExpMon ? 12 : 1));
            
            let netSrc = (gross + bonus) - ded - personal401k; 

            if (isNaN(parseInt(inc.nonTaxableUntil)) || year >= inc.nonTaxableUntil) floorTaxable += netSrc;
            floorGross += netSrc;
            incomeBreakdown.push({ name: inc.name || 'Income Source', amount: netSrc });
        };

        if (!isRet) {
            income.forEach(processIncome);
        } else {
            income.filter(inc => inc.remainsInRetirement).forEach(processIncome);
            
            if (age >= 75 && bal['401k'] > 0) {
                const rmd = engine.calculateRMD(bal['401k'], age);
                if (rmd > 0) {
                    floorGross += rmd;
                    floorTaxable += rmd;
                    bal['401k'] = Math.max(0, bal['401k'] - rmd);
                    incomeBreakdown.push({ name: 'RMD (401k/IRA)', amount: rmd });
                    traceLog.push(`RMD: Mandatory withdrawal of ${math.toCurrency(rmd)} from Pre-Tax at Age ${age}.`);
                }
            }

            if (age >= ssStartAge) {
                const ssFull = engine.calculateSocialSecurity(ssMonthly, workYears, infFac);
                const taxableSS = engine.calculateTaxableSocialSecurity(ssFull, floorTaxable, filingStatus, assumptions.state, infFac);
                floorGross += ssFull;
                floorTaxable += taxableSS;
                incomeBreakdown.push({ name: 'Social Security', amount: ssFull });
            }
        }

        const startOfYearBal = { ...bal };
        
        // --- CALL STRATEGY ---
        const context = {
            bal, startOfYearBal, targetBudget, rates: { heloc: helocInterestRate },
            priorityOrder: currentYearPriority, age, currentAge: assumptions.currentAge,
            filingStatus, state: assumptions.state, infFac, floorGross, floorTaxable,
            cashFloor, helocLimit, benefits, hhSize: totalHhSize, fpl100, traceLog, assumptions
        };

        let strategyResult;
        if (!isRet) {
            // Pre-retirement: Accumulation Phase Logic (Simulated by Iron Fist usually, but surplus logic differs)
            // We use Iron Fist solver to determine if income covers expenses, but ignore surplus
            strategyResult = solveIronFist(context);
            strategyResult.status = 'Active';
        } else {
            // Post-Retirement
            strategyResult = (persona === 'PLATINUM') 
                ? solveHandoutHunter(context) 
                : solveIronFist(context);
        }

        const { drawMap, taxes, snap, status, surplus } = strategyResult;
        let preTaxDraw = Object.values(drawMap).reduce((a, b) => a + b, 0);
        let postTaxInc = (floorGross + preTaxDraw + snap) - taxes;

        // --- SURPLUS HANDLING (Critical) ---
        if (surplus > 0) {
            if (!isRet) {
                traceLog.push(`Surplus Income: ${math.toCurrency(surplus)} assumed spent (Lifestyle Creep) prior to retirement.`);
            } else {
                // Post-Retirement: Reinvest to Brokerage at 100% Cost Basis
                bal['taxable'] += surplus;
                bal['taxableBasis'] += surplus;
                traceLog.push(`Surplus Reinvestment: ${math.toCurrency(surplus)} added to Brokerage.`);
            }
        }

        if (isRet && (targetBudget - postTaxInc) > (targetBudget * 0.02)) {
            if (firstInsolvencyAge === null) firstInsolvencyAge = age;
            strategyResult.status = 'INSOLVENT';
        }

        // GROWTH
        const stockGrowth = math.getGrowthForAge('Stock', age, assumptions.currentAge, assumptions);
        const cryptoGrowth = math.getGrowthForAge('Crypto', age, assumptions.currentAge, assumptions);
        const metalsGrowth = math.getGrowthForAge('Metals', age, assumptions.currentAge, assumptions);
        const reGrowth = Math.pow(1 + (assumptions.realEstateGrowth / 100), i);
        const oaGrowth = Math.pow(1 + 0.02, i);
        const optGrowth = Math.pow(1 + (assumptions.stockGrowth / 100), i);

        ['taxable', '401k', 'hsa'].forEach(k => bal[k] *= (1 + stockGrowth));
        bal['crypto'] *= (1 + cryptoGrowth);
        bal['metals'] *= (1 + metalsGrowth);
        bal['roth-earnings'] += ((bal['roth-basis'] + bal['roth-earnings']) * stockGrowth);

        // NW Calculation for Trace
        const sRE = realEstate.reduce((s, r) => s + (math.fromCurrency(r.value) * reGrowth), 0);
        const sOA = otherAssets.reduce((s, o) => s + (math.fromCurrency(o.value) * oaGrowth), 0);
        const sOptNW = stockOptions.reduce((s, x) => {
            const fmv = math.fromCurrency(x.currentPrice) * optGrowth;
            return s + (Math.max(0, (fmv - math.fromCurrency(x.strikePrice)) * parseFloat(x.shares)));
        }, 0);
        const sLiquid = bal.cash + bal.taxable + bal.crypto + bal.metals + bal['401k'] + bal['roth-basis'] + bal['roth-earnings'] + bal.hsa;
        const sLiabilities = bal['heloc'] + 
            realEstate.reduce((s, r) => s + Math.max(0, math.fromCurrency(r.mortgage) - (math.fromCurrency(r.principalPayment)*12*i)), 0) +
            otherAssets.reduce((s, o) => s + Math.max(0, math.fromCurrency(o.loan) - (math.fromCurrency(o.principalPayment)*12*i)), 0) +
            debts.reduce((s, d) => s + Math.max(0, math.fromCurrency(d.balance) - (math.fromCurrency(d.principalPayment)*12*i)), 0);

        const nwBreakdown = [
            { name: 'Cash', value: bal['cash'], color: assetColors['Cash'] },
            { name: 'Brokerage', value: bal['taxable'], color: assetColors['Taxable'] },
            { name: 'Roth IRA', value: bal['roth-basis'] + bal['roth-earnings'], color: assetColors['Roth IRA'] },
            { name: '401k/IRA', value: bal['401k'], color: assetColors['Pre-Tax (401k/IRA)'] },
            { name: 'Crypto', value: bal['crypto'], color: assetColors['Crypto'] },
            { name: 'Metals', value: bal['metals'], color: assetColors['Metals'] },
            { name: 'HSA', value: bal['hsa'], color: assetColors['HSA'] },
            { name: 'Real Estate', value: sRE, color: assetColors['Real Estate'] },
            { name: 'Stock Options', value: sOptNW, color: assetColors['Stock Options'] },
            { name: 'Other Assets', value: sOA, color: assetColors['Other'] }
        ];

        results.push({ 
            age, year, budget: targetBudget, helocInt: helocInterestThisYear, isFirstRetYear: age === rAge, 
            preTaxDraw, taxes, snap, balances: { ...startOfYearBal }, draws: drawMap, postTaxInc, 
            status: strategyResult.status, netWorth: (sLiquid + sRE + sOA + sOptNW) - sLiabilities, 
            startNW: (sLiquid + sRE + sOA + sOptNW) - sLiabilities - (strategyResult.surplus || 0), // Approx
            floorGross, incomeBreakdown, traceLog, nwBreakdown
        });
    }

    results.firstInsolvencyAge = firstInsolvencyAge;
    return results;
}
