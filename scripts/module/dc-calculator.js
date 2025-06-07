import { MODULE_ID, SETTINGS } from "./constants.js";
import { getSetting, getParsedJsonSetting } from "./settings.js";

export class DCCalculator {
    constructor() {
    }

    calculateDC(level, { rarity = "common", specificDC = null, dcType = "item" } = {}) {
        if (specificDC && typeof specificDC === 'number' && specificDC > 0) {
            return specificDC;
        }

        let calculatedBaseDC;
        const usePf2eSystem = getSetting(SETTINGS.USE_PF2E_DC_SYSTEM);

        if (usePf2eSystem && game.pf2e?.actions?.calculateDC) {
            try {
                const isPWOL = game.settings.get("pf2e", "proficiencyVariant") === "ProficiencyWithoutLevel";
                calculatedBaseDC = game.pf2e.actions.calculateDC(level, { pwol: isPWOL });
            } catch (e) {
                calculatedBaseDC = null; 
            }
        }

        if (typeof calculatedBaseDC !== 'number' || calculatedBaseDC <= 0) {
            const dcTable = getParsedJsonSetting(SETTINGS.CUSTOM_DC_TABLE, {});
            calculatedBaseDC = dcTable[level.toString()];
            if (typeof calculatedBaseDC !== 'number') {
                const levels = Object.keys(dcTable).map(Number).sort((a, b) => a - b);
                let fallbackLevelKey = levels.filter(l => l <= level).pop()?.toString() ?? "0";
                if (!dcTable[fallbackLevelKey] && levels.length > 0) fallbackLevelKey = levels[0].toString();
                
                calculatedBaseDC = dcTable[fallbackLevelKey] ?? dcTable["0"] ?? 10;
            }
        }
        
        let rarityAdjustmentValue = 0;
        switch (rarity?.toLowerCase() ?? "common") {
            case "uncommon": rarityAdjustmentValue = getSetting(SETTINGS.RARITY_ADJ_UNCOMMON); break;
            case "rare": rarityAdjustmentValue = getSetting(SETTINGS.RARITY_ADJ_RARE); break;
            case "unique": rarityAdjustmentValue = getSetting(SETTINGS.RARITY_ADJ_UNIQUE); break;
            case "common":
            default: rarityAdjustmentValue = getSetting(SETTINGS.RARITY_ADJ_COMMON); break;
        }
        
        const finalDCValue = calculatedBaseDC + (rarityAdjustmentValue || 0);
        const dcTableForMin = getParsedJsonSetting(SETTINGS.CUSTOM_DC_TABLE, {});
        const minimumDCFallback = dcTableForMin["0"] ?? 10;

        return Math.max(finalDCValue, minimumDCFallback);
    }
}