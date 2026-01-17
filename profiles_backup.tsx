export const BLANK_PROFILE = {
    investments: [
        { name: '401K', type: 'Pre-Tax (401k/IRA)', value: 670600, costBasis: 0 },
        { name: 'ROTH', type: 'Roth IRA', value: 248850, costBasis: 80000 },
        { name: 'ROTH', type: 'Roth IRA', value: 197560, costBasis: 50000 },
        { name: 'BROKERAGE', type: 'Taxable', value: 86269, costBasis: 85000 },
        { name: 'BITCOIN', type: 'Crypto', value: 100805, costBasis: 100500 },
        { name: 'GOLD', type: 'Metals', value: 19000, costBasis: 15000 },
        { name: 'SILVER', type: 'Metals', value: 4000, costBasis: 3000 },
        { name: 'HSA', type: 'HSA', value: 35000, costBasis: 0 },
        { name: 'BONUS1', type: 'Taxable', value: 30000, costBasis: 30000 },
        { name: 'BONUS2', type: 'Taxable', value: 50000, costBasis: 50000 },
        { name: 'CHECKING ACCOUNT', type: 'Cash', value: 25000, costBasis: 25000 }
    ],
    stockOptions: [],
    realEstate: [
        { name: 'Home', value: 550000, mortgage: 199000, principalPayment: 500 },
        { name: 'Rental 1', value: 200000, mortgage: 0, principalPayment: 0 }
    ],
    helocs: [
        { name: 'HOME', balance: 0, limit: 273750, rate: 6.75 },
        { name: 'RENTAL', balance: 0, limit: 120000, rate: 6.75 }
    ],
    otherAssets: [
        { name: 'RV', value: 25000, loan: 0 },
        { name: 'RANGER', value: 12000, loan: 0 },
        { name: 'TRACTOR', value: 40000, loan: 25000 }
    ],
    debts: [
        { name: 'HOME DEPOT', balance: 16500, principalPayment: 160 }
    ],
    income: [
        { name: 'SALARY', amount: 186561, increase: 3.5, contribution: 12.5, match: 10, bonusPct: 23, isMonthly: false, incomeExpenses: 0, remainsInRetirement: false, contribOnBonus: false, matchOnBonus: false },
        { name: 'TOWER', amount: 1200, increase: 1.5, contribution: 0, match: 0, bonusPct: 0, isMonthly: true, incomeExpenses: 0, remainsInRetirement: true, contribOnBonus: false, matchOnBonus: false },
        { name: 'RENTAL1', amount: 1575, increase: 3, contribution: 0, match: 0, bonusPct: 0, isMonthly: true, incomeExpenses: 450, incomeExpensesMonthly: true, remainsInRetirement: true, contribOnBonus: false, matchOnBonus: false }
    ],
    budget: {
        savings: [
            { type: 'HSA', monthly: 604, annual: 7250, remainsInRetirement: false },
            { type: 'Metals', monthly: 750, annual: 9000, remainsInRetirement: false },
            { type: 'Taxable', monthly: 833, annual: 10000, remainsInRetirement: false }
        ],
        expenses: [
            { name: 'MORTGAGE', monthly: 1417, annual: 17004, remainsInRetirement: true, isFixed: true },
            { name: 'COSTCO', monthly: 752, annual: 9024, remainsInRetirement: true, isFixed: false },
            { name: 'GROCERY', monthly: 690, annual: 8280, remainsInRetirement: true, isFixed: false },
            { name: 'AMAZON', monthly: 630, annual: 7560, remainsInRetirement: true, isFixed: false },
            { name: 'CAR PAYMENT LOSS', monthly: 600, annual: 7200, remainsInRetirement: true, isFixed: false },
            { name: 'VACATION CANCUN', monthly: 548, annual: 6576, remainsInRetirement: true, isFixed: false },
            { name: 'TRACTOR', monthly: 533, annual: 6396, remainsInRetirement: false, isFixed: false },
            { name: 'CAPITAL SPEND', monthly: 512, annual: 6144, remainsInRetirement: true, isFixed: false },
            { name: 'DISCRETIONARY', monthly: 472, annual: 5664, remainsInRetirement: true, isFixed: false },
            { name: 'VACATION CAMPING', monthly: 392, annual: 4704, remainsInRetirement: true, isFixed: false },
            { name: 'RESTAURANTS', monthly: 354, annual: 4248, remainsInRetirement: true, isFixed: false },
            { name: 'VACATION DISNEY', monthly: 282, annual: 3384, remainsInRetirement: true, isFixed: false },
            { name: 'GAS + MAINTENANCE', monthly: 248, annual: 2976, remainsInRetirement: true, isFixed: false },
            { name: 'ELECTRIC', monthly: 200, annual: 2400, remainsInRetirement: true, isFixed: false },
            { name: 'KID STUFF', monthly: 200, annual: 2400, remainsInRetirement: true, isFixed: false },
            { name: 'VERIZON', monthly: 191, annual: 2292, remainsInRetirement: true, isFixed: false },
            { name: 'MEDICAL', monthly: 185, annual: 2220, remainsInRetirement: false, isFixed: false },
            { name: 'HOMESCHOOL + SUNDROP', monthly: 175, annual: 2100, remainsInRetirement: true, isFixed: false },
            { name: 'CAR + RV INSURANCE', monthly: 153, annual: 1836, remainsInRetirement: true, isFixed: false },
            { name: 'STARLINK', monthly: 125, annual: 1500, remainsInRetirement: true, isFixed: false },
            { name: 'PROPANE', monthly: 116, annual: 1392, remainsInRetirement: true, isFixed: false },
            { name: 'HUNTING', monthly: 114, annual: 1368, remainsInRetirement: true, isFixed: false },
            { name: 'SUBSCRIPTIONS', monthly: 96, annual: 1152, remainsInRetirement: true, isFixed: false },
            { name: 'HAIRCUTS', monthly: 88, annual: 1056, remainsInRetirement: true, isFixed: false },
            { name: 'LIFE INSURANCE', monthly: 85, annual: 1020, remainsInRetirement: true, isFixed: false },
            { name: 'COFFEE', monthly: 50, annual: 600, remainsInRetirement: true, isFixed: false },
            { name: 'GARDEN', monthly: 43, annual: 516, remainsInRetirement: true, isFixed: false }
        ]
    },
    assumptions: { 
        currentAge: 39, retirementAge: 40, ssStartAge: 62, ssMonthly: 3200, 
        stockGrowth: 9, cryptoGrowth: 9, metalsGrowth: 7, realEstateGrowth: 3, 
        inflation: 3, filingStatus: 'Married Filing Jointly', 
        helocRate: 6.75, state: 'Michigan', workYearsAtRetirement: 25,
        phaseGo1: 1.0, phaseGo2: 0.9, phaseGo3: 0.8,
        advancedGrowth: false,
        ltcgRate: 15
    },
    benefits: { 
        unifiedIncomeAnnual: 43000,
        shelterCosts: 2000,
        hasSUA: true,
        dependents: [
            { name: "kid 1", birthYear: 2014 },
            { name: "kid 2", birthYear: 2016 },
            { name: "kid 3", birthYear: 2018 },
            { name: "kid 4", birthYear: 2024 }
        ]
    },
    burndown: {
        strategyMode: 'RAW',
        priority: ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings'],
        cashReserve: 20000,
        snapPreserve: 700,
        useSync: true,
        isRealDollars: false
    }
};