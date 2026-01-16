
import { math } from './utils.js';
import { simulateProjection } from './burndown-engine.js';

export function calculateDieWithZero(data, baseConfig, engineContext) {
    let low = 0;
    let high = 500000;
    let best = 0;
    
    // We run the engine headlessly
    // Note: We need to use 'simulateProjection' but it returns a full result set.
    // The engineContext passes necessary globals like 'firstInsolvencyAge' handling if needed,
    // but better if simulateProjection returns insolvency status directly.
    
    const solverConfig = { ...baseConfig, useSync: false };

    for (let i = 0; i < 20; i++) {
        const mid = (low + high) / 2;
        solverConfig.manualBudget = mid;
        
        const simResult = simulateProjection(data, solverConfig);
        
        if (simResult.firstInsolvencyAge !== null) {
            // Failed (Insolvent before death)
            high = mid;
        } else {
            // Survived
            best = mid;
            low = mid;
        }
    }
    
    return best;
}
