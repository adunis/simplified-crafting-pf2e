// In dc-calculator.js
import { MODULE_ID, SETTINGS } from "./constants.js"; // MODULE_ID for logging
import { getSetting, getParsedJsonSetting } from "./settings.js";

export class DCCalculator {
    constructor() {
        // Constructor is fine
    }

 calculateDC(level, { rarity = "common", specificDC = null, dcType = "item" } = {}) {
        // ... (specificDC and systemDC logic remains the same) ...

        const dcTable = getParsedJsonSetting(SETTINGS.CUSTOM_DC_TABLE, {});
        // No longer a JSON object for rarityAdjustments
        // const rarityAdjustments = getParsedJsonSetting(SETTINGS.RARITY_ADJUSTMENTS, {}); // OLD

        let baseDC = dcTable[level.toString()];
        if (typeof baseDC !== 'number') { /* ... fallback logic ... */ }
        
        let rarityAdjustment = 0;
        switch (rarity.toLowerCase()) {
            case "uncommon": rarityAdjustment = getSetting(SETTINGS.RARITY_ADJ_UNCOMMON); break;
            case "rare": rarityAdjustment = getSetting(SETTINGS.RARITY_ADJ_RARE); break;
            case "unique": rarityAdjustment = getSetting(SETTINGS.RARITY_ADJ_UNIQUE); break;
            case "common": // fall-through
            default: rarityAdjustment = getSetting(SETTINGS.RARITY_ADJ_COMMON); break;
        }
        
        const finalDC = baseDC + (rarityAdjustment || 0); // Ensure adjustment is a number

        return (finalDC > 0) ? finalDC : (dcTable["0"] ?? 10);
    }
}