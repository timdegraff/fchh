
export const BLANK_PROFILE = {
    investments: [
        { name: 'TIM 401K', type: 'Pre-Tax (401k/IRA)', value: 670600, costBasis: 0 },
        { name: 'TIM ROTH', type: 'Roth IRA', value: 248850, costBasis: 80000 },
        { name: 'JESS ROTH', type: 'Roth IRA', value: 197560, costBasis: 50000 },
        { name: 'JESS BROKERAGE', type: 'Taxable', value: 86269, costBasis: 85000 },
        { name: 'BITCOIN', type: 'Crypto', value: 100805, costBasis: 100500 },
        { name: 'GOLD', type: 'Metals', value: 19000, costBasis: 15000 },
        { name: 'SILVER', type: 'Metals', value: 4000, costBasis: 3000 },
        { name: 'HSA', type: 'HSA', value: 35000, costBasis: 0 },
        { name: 'TEAMGM', type: 'Taxable', value: 30000, costBasis: 30000 },
        { name: 'APRIL CTT', type: 'Taxable', value: 50000, costBasis: 50000 },
        { name: 'CHECKING ACCOUNT', type: 'Cash', value: 25000, costBasis: 25000 }
    ],
    stockOptions: [],
    realEstate: [
        { name: '11581 BILLMAN', value: 550000, mortgage: 199000, principalPayment: 500 },
        { name: '11475 BILLMAN', value: 200000, mortgage: 0, principalPayment: 0 }
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
        { name: 'GM SALARY', amount: 186561, increase: 3.5, contribution: 12.5, match: 10, bonusPct: 23, isMonthly: false, incomeExpenses: 0, remainsInRetirement: false, contribOnBonus: false, matchOnBonus: false },
        { name: 'CELL TOWER', amount: 1200, increase: 1.5, contribution: 0, match: 0, bonusPct: 0, isMonthly: true, incomeExpenses: 0, remainsInRetirement: true, contribOnBonus: false, matchOnBonus: false },
        { name: '11475 RENTAL', amount: 1575, increase: 3, contribution: 0, match: 0, bonusPct: 0, isMonthly: true, incomeExpenses: 450, incomeExpensesMonthly: true, remainsInRetirement: true, contribOnBonus: false, matchOnBonus: false }
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
        dependents: [
            { name: "EVAN", birthYear: 2014 },
            { name: "COLIN", birthYear: 2016 },
            { name: "EMMA", birthYear: 2018 },
            { name: "HANNAH", birthYear: 2024 }
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

export const PROFILE_45_COUPLE = {
    investments: [
        { name: 'His 401k', type: 'Pre-Tax (401k/IRA)', value: 350000, costBasis: 0 },
        { name: 'Her 401k', type: 'Pre-Tax (401k/IRA)', value: 250000, costBasis: 0 },
        { name: 'Brokerage', type: 'Taxable', value: 100000, costBasis: 70000 },
        { name: 'Bitcoin (Cold Storage)', type: 'Crypto', value: 90000, costBasis: 60000 },
        { name: 'His Roth', type: 'Roth IRA', value: 150000, costBasis: 100000 },
        { name: 'Her Roth', type: 'Roth IRA', value: 150000, costBasis: 100000 },
        { name: 'HSA', type: 'HSA', value: 50000, costBasis: 30000 },
        { name: 'Checking', type: 'Cash', value: 25000, costBasis: 25000 }
    ],
    stockOptions: [
        { name: 'Company RSUs', shares: 20000, strikePrice: 1, currentPrice: 23, growth: 10, isLtcg: false }
    ],
    realEstate: [
        { name: 'Michigan Home', value: 550000, mortgage: 250000, principalPayment: 1400 }
    ],
    income: [
        { name: 'Primary Income', amount: 175000, increase: 3, contribution: 12, match: 4, bonusPct: 10, isMonthly: false, incomeExpenses: 0, contribOnBonus: true, remainsInRetirement: false },
        { name: 'Secondary Income', amount: 125000, increase: 3, contribution: 10, match: 3, bonusPct: 0, isMonthly: false, incomeExpenses: 0, contribOnBonus: true, remainsInRetirement: false }
    ],
    budget: {
        savings: [
            { type: 'Taxable', annual: 36000, monthly: 3000, remainsInRetirement: false },
            { type: 'HSA', annual: 7200, monthly: 600, remainsInRetirement: false }
        ],
        expenses: [
            { name: 'MORTGAGE W/ ESCROW', annual: 33000, monthly: 2750, remainsInRetirement: true, isFixed: true },
            { name: 'CHILDCARE', annual: 18000, monthly: 1500, remainsInRetirement: false, isFixed: false },
            { name: 'GROCERIES', annual: 14400, monthly: 1200, remainsInRetirement: true, isFixed: false },
            { name: 'VACATIONS/TRAVEL', annual: 14400, monthly: 1200, remainsInRetirement: true, isFixed: false },
            { name: 'CAR PAYMENTS', annual: 12000, monthly: 1000, remainsInRetirement: true, isFixed: false },
            { name: 'RESTAURANTS', annual: 7200, monthly: 600, remainsInRetirement: true, isFixed: false },
            { name: 'UTILITIES', annual: 6000, monthly: 500, remainsInRetirement: true, isFixed: false },
            { name: 'AMAZON', annual: 6000, monthly: 500, remainsInRetirement: true, isFixed: false },
            { name: 'MISC', annual: 6000, monthly: 500, remainsInRetirement: true, isFixed: false },
            { name: 'GAS & AUTO MAINT', annual: 3600, monthly: 300, remainsInRetirement: true, isFixed: false }
        ]
    },
    assumptions: { 
        currentAge: 45, retirementAge: 55, ssStartAge: 62, ssMonthly: 3400, 
        stockGrowth: 9, cryptoGrowth: 8, metalsGrowth: 6, realEstateGrowth: 3.5, 
        inflation: 3, filingStatus: 'Married Filing Jointly', 
        helocRate: 6.5, state: 'Michigan', workYearsAtRetirement: 30,
        phaseGo1: 1.0, phaseGo2: 0.9, phaseGo3: 0.8,
        advancedGrowth: false,
        ltcgRate: 15
    },
    benefits: { 
        unifiedIncomeAnnual: 45000,
        shelterCosts: 3250,
        dependents: [
            { name: "Kid 1", birthYear: 2019 },
            { name: "Kid 2", birthYear: 2017 },
            { name: "Kid 3", birthYear: 2015 }
        ]
    },
    burndown: {
        strategyMode: 'PLATINUM',
        priority: ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings']
    }
};

export const PROFILE_25_SINGLE = {
    investments: [
        { name: 'Work 401k', type: 'Pre-Tax (401k/IRA)', value: 40000, costBasis: 0 },
        { name: 'Robinhood', type: 'Taxable', value: 15000, costBasis: 12000 },
        { name: 'Coinbase (Bitcoin)', type: 'Crypto', value: 15000, costBasis: 10000 },
        { name: 'Checking Account', type: 'Cash', value: 10000, costBasis: 10000 }
    ],
    stockOptions: [
        { name: 'Series E RSUs', shares: 2200, strikePrice: 75, currentPrice: 100, growth: 10, isLtcg: false },
        { name: 'Series D RSUs', shares: 400, strikePrice: 40, currentPrice: 100, growth: 10, isLtcg: false }
    ],
    realEstate: [],
    income: [
        { name: 'Tech Salary', amount: 125000, increase: 3, contribution: 19.0, match: 3, bonusPct: 10, isMonthly: false, incomeExpenses: 0, contribOnBonus: false }
    ],
    debts: [
        { name: 'Student Loans', balance: 12000, principalPayment: 250 }
    ],
    budget: {
        savings: [
            { type: 'Roth IRA', annual: 7000, monthly: 583, remainsInRetirement: false },
            { type: 'HSA', annual: 4150, monthly: 346, remainsInRetirement: false }
        ],
        expenses: [
            { name: 'Rent (NY)', annual: 24000, monthly: 2000, remainsInRetirement: true, isFixed: false },
            { name: 'Social & Dining', annual: 12000, monthly: 1000, remainsInRetirement: true, isFixed: false },
            { name: 'Travel & Lifestyle', annual: 8000, monthly: 666, remainsInRetirement: true, isFixed: false },
            { name: 'Groceries', annual: 6000, monthly: 500, remainsInRetirement: true, isFixed: false },
            { name: 'Shopping & Tech', annual: 6000, monthly: 500, remainsInRetirement: true, isFixed: false },
            { name: 'Utilities & Internet', annual: 4000, monthly: 333, remainsInRetirement: true, isFixed: false },
            { name: 'Gym & Misc', annual: 4000, monthly: 333, remainsInRetirement: true, isFixed: false },
            { name: 'Student Loan Payment', annual: 3000, monthly: 250, remainsInRetirement: false, isFixed: true },
            { name: 'Health Insurance Premium', annual: 3000, monthly: 250, remainsInRetirement: true, isFixed: false }
        ]
    },
    assumptions: { 
        currentAge: 25, retirementAge: 50, ssStartAge: 62, ssMonthly: 2800, 
        stockGrowth: 9, cryptoGrowth: 8, metalsGrowth: 6, realEstateGrowth: 3.5, 
        inflation: 3, filingStatus: 'Single', 
        helocRate: 6.5, state: 'Michigan', workYearsAtRetirement: 25,
        phaseGo1: 1.0, phaseGo2: 0.9, phaseGo3: 0.8,
        advancedGrowth: false,
        ltcgRate: 15
    },
    benefits: { 
        unifiedIncomeAnnual: 109850,
        shelterCosts: 2333,
        dependents: [] 
    },
    burndown: {
        strategyMode: 'SILVER',
        priority: ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings']
    }
};

export const PROFILE_55_RETIREE = {
    investments: [
        { name: '401k (Career)', type: 'Pre-Tax (401k/IRA)', value: 1900000, costBasis: 0 },
        { name: 'Roth IRA', type: 'Roth IRA', value: 400000, costBasis: 250000 },
        { name: 'Money Market', type: 'Cash', value: 50000, costBasis: 50000 }
    ],
    realEstate: [
        { name: 'Florida Home (Paid Off)', value: 600000, mortgage: 0, principalPayment: 0 }
    ],
    income: [
        { name: 'Executive Salary', amount: 250000, increase: 2, contribution: 20, match: 4, bonusPct: 15, isMonthly: false, incomeExpenses: 0, remainsInRetirement: false, contribOnBonus: true },
        { name: 'Corporate Pension', amount: 48000, increase: 0, contribution: 0, match: 0, bonusPct: 0, isMonthly: false, incomeExpenses: 0, remainsInRetirement: true }
    ],
    budget: {
        savings: [
            { type: 'Taxable', annual: 60000, monthly: 5000, remainsInRetirement: false },
            { type: 'Pre-Tax (401k/IRA)', annual: 30500, monthly: 2541, remainsInRetirement: false } 
        ],
        expenses: [
            { name: 'Living Expenses', annual: 72000, monthly: 6000, remainsInRetirement: true, isFixed: false },
            { name: 'High-End Travel', annual: 48000, monthly: 4000, remainsInRetirement: true, isFixed: false },
            { name: 'Healthcare (Pre-Medicare)', annual: 30000, monthly: 2500, remainsInRetirement: true, isFixed: false },
            { name: 'Property Tax/Ins', annual: 14400, monthly: 1200, remainsInRetirement: true, isFixed: false },
            { name: 'Club Dues', annual: 12000, monthly: 1000, remainsInRetirement: true, isFixed: false }
        ]
    },
    assumptions: { 
        currentAge: 55, retirementAge: 60, ssStartAge: 67, ssMonthly: 4200, 
        stockGrowth: 9, cryptoGrowth: 8, metalsGrowth: 6, realEstateGrowth: 3.5, 
        inflation: 3, filingStatus: 'Married Filing Jointly', 
        helocRate: 6.5, state: 'Florida', workYearsAtRetirement: 38,
        phaseGo1: 1.0, phaseGo2: 0.9, phaseGo3: 0.8,
        advancedGrowth: false,
        ltcgRate: 15 
    },
    benefits: { 
        unifiedIncomeAnnual: 30000,
        shelterCosts: 2200,
        dependents: [] 
    },
    burndown: {
        strategyMode: 'UNCONSTRAINED',
        priority: ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings']
    }
};
