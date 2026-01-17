
export const BLANK_PROFILE = {
    investments: [
        { name: '401K', type: 'Pre-Tax (401k/IRA)', value: 0, costBasis: 0 }
    ],
    stockOptions: [],
    realEstate: [
        { name: 'HOME', value: 0, mortgage: 0, principalPayment: 0 }
    ],
    helocs: [
        { name: 'HOME', balance: 0, limit: 0, rate: 4.99 }
    ],
    otherAssets: [
        { name: 'CAR', value: 0, loan: 0 }
    ],
    debts: [
        { name: 'CREDIT CARD', balance: 0, principalPayment: 0 }
    ],
    income: [
        { name: 'SALARY', amount: 0, increase: 0, contribution: 0, match: 0, bonusPct: 0, isMonthly: false, incomeExpenses: 0, remainsInRetirement: false, contribOnBonus: false, matchOnBonus: false }
    ],
    budget: {
        savings: [
            { type: 'Taxable', monthly: 0, annual: 0, remainsInRetirement: false }
        ],
        expenses: [
            { name: 'BUDGET 1', annual: 0, monthly: 0, remainsInRetirement: true, isFixed: true },
            { name: 'BUDGET 2', annual: 0, monthly: 0, remainsInRetirement: false, isFixed: false }
        ]
    },
    assumptions: { 
        currentAge: 40, retirementAge: 45, ssStartAge: 62, ssMonthly: 3200, 
        stockGrowth: 9, cryptoGrowth: 9, metalsGrowth: 7, realEstateGrowth: 3, 
        inflation: 3, filingStatus: 'Married Filing Jointly', 
        helocRate: 6.75, state: 'Michigan', workYearsAtRetirement: 25,
        phaseGo1: 1.0, phaseGo2: 0.9, phaseGo3: 0.8,
        advancedGrowth: false,
        ltcgRate: 15
    },
    benefits: { 
        unifiedIncomeAnnual: 25000,
        shelterCosts: 2000,
        hasSUA: true,
        dependents: [
            { name: "Kid Name", birthYear: 2014 }
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
        { name: 'Bitcoin', type: 'Crypto', value: 90000, costBasis: 60000 },
        { name: 'His Roth', type: 'Roth IRA', value: 150000, costBasis: 100000 },
        { name: 'Her Roth', type: 'Roth IRA', value: 150000, costBasis: 100000 },
        { name: 'HSA', type: 'HSA', value: 50000, costBasis: 30000 },
        { name: 'Checking', type: 'Cash', value: 25000, costBasis: 25000 }
    ],
    stockOptions: [
        { name: 'COMPANY RSU', shares: 2000, strikePrice: 1, currentPrice: 23, growth: 10, isLtcg: false }
    ],
    realEstate: [
        { name: 'Michigan Home', value: 550000, mortgage: 250000, principalPayment: 1400 }
    ],
    otherAssets: [
        { name: 'Family SUV', value: 30000, loan: 12000 }
    ],
    helocs: [
        { name: 'Emergency Line', balance: 0, limit: 100000, rate: 8.5 }
    ],
    debts: [
        { name: 'Credit Cards', balance: 7000, principalPayment: 200 }
    ],
    income: [
        { name: 'Primary Income', amount: 175000, increase: 3, contribution: 12, match: 4, bonusPct: 10, isMonthly: false, incomeExpenses: 0, contribOnBonus: false, matchOnBonus: false, remainsInRetirement: false },
        { name: 'Secondary Income', amount: 125000, increase: 3, contribution: 10, match: 3, bonusPct: 0, isMonthly: false, incomeExpenses: 0, contribOnBonus: false, matchOnBonus: false, remainsInRetirement: false }
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
        unifiedIncomeAnnual: 25000,
        shelterCosts: 3250,
        hasSUA: true,
        dependents: [
            { name: "Kid 1", birthYear: 2019 },
            { name: "Kid 2", birthYear: 2017 },
            { name: "Kid 3", birthYear: 2015 }
        ]
    },
    burndown: {
        strategyMode: 'PLATINUM',
        priority: ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings'],
        cashReserve: 20000,
        snapPreserve: 700,
        useSync: true,
        isRealDollars: false
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
        { name: 'COMPANY RSU', shares: 2200, strikePrice: 75, currentPrice: 100, growth: 10, isLtcg: false },
        { name: 'Series D RSUs', shares: 400, strikePrice: 40, currentPrice: 100, growth: 10, isLtcg: false }
    ],
    realEstate: [],
    helocs: [
        { name: 'Emergency Line', balance: 0, limit: 100000, rate: 8.5 }
    ],
    income: [
        { name: 'Tech Salary', amount: 125000, increase: 3, contribution: 19.0, match: 3, bonusPct: 10, isMonthly: false, incomeExpenses: 0, contribOnBonus: false, matchOnBonus: false }
    ],
    debts: [
        { name: 'Student Loans', balance: 12000, principalPayment: 250 },
        { name: 'Credit Cards', balance: 7000, principalPayment: 200 }
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
        priority: ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings'],
        cashReserve: 20000,
        snapPreserve: 0,
        useSync: true,
        isRealDollars: false
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
    helocs: [
        { name: 'Emergency Line', balance: 0, limit: 100000, rate: 8.5 }
    ],
    debts: [
        { name: 'Credit Cards', balance: 7000, principalPayment: 200 }
    ],
    income: [
        { name: 'Executive Salary', amount: 0, increase: 2, contribution: 0, match: 0, bonusPct: 0, isMonthly: false, incomeExpenses: 0, remainsInRetirement: false, contribOnBonus: false, matchOnBonus: false },
        { name: 'Corporate Pension', amount: 48000, increase: 0, contribution: 0, match: 0, bonusPct: 0, isMonthly: false, incomeExpenses: 0, remainsInRetirement: true, contribOnBonus: false, matchOnBonus: false }
    ],
    budget: {
        savings: [
            { type: 'Taxable', annual: 0, monthly: 0, remainsInRetirement: false },
            { type: 'Pre-Tax (401k/IRA)', annual: 0, monthly: 0, remainsInRetirement: false } 
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
        currentAge: 65, retirementAge: 65, ssStartAge: 67, ssMonthly: 4200, 
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
        priority: ['cash', 'roth-basis', 'taxable', 'crypto', 'metals', 'heloc', '401k', 'hsa', 'roth-earnings'],
        cashReserve: 20000,
        snapPreserve: 700,
        useSync: true,
        isRealDollars: false
    }
};
