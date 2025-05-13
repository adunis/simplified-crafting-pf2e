
import { MODULE_ID, SETTINGS } from "./constants.js";

export function registerSettings() {
    // --- DC Calculation Settings ---
    game.settings.register(MODULE_ID, SETTINGS.USE_PF2E_DC_SYSTEM, {
        name: "Use PF2e System's DC Calculation",
        hint: "If checked (default), the module attempts to use the Pathfinder 2e system's standard DC calculation. Uncheck to primarily use the custom DC table below, or if the system's calculation is not desired (e.g., for PWL).",
        scope: "world", config: true, type: Boolean, default: true,
    });

    game.settings.register(MODULE_ID, SETTINGS.CUSTOM_DC_TABLE, {
        name: "Custom DC by Level Table (JSON)",
        hint: `REQUIRED if "Use PF2e System's DC" is off or fails. This JSON string maps item levels (as string keys, e.g., "0", "1", "20") to their base Difficulty Class (as numbers).
               Example: {"0": 14, "1": 15, "5": 20, "10": 27, "15": 34, "20": 40}.
               This is essential for Proficiency Without Level (PWL) or other custom DC progressions. Ensure you cover all relevant levels for your game.
               A level "0" entry is recommended for items without a defined level. If a specific level is missing, the system will try to find the closest lower defined level or a default.`,
        scope: "world", config: true, type: String,
        default: JSON.stringify({0:14, 1:15, 2:16, 3:18, 4:19, 5:20, 6:22, 7:23, 8:24, 9:26, 10:27, 11:28, 12:30, 13:31, 14:32, 15:34, 16:35, 17:36, 18:38, 19:39, 20:40, 21:42, 22:44, 23:46, 24:48, 25:50}),
    });

    // --- BROKEN DOWN RARITY ADJUSTMENTS ---
    game.settings.register(MODULE_ID, SETTINGS.RARITY_ADJ_COMMON, { // NEW SETTING KEY
        name: "DC Adj: Common Rarity",
        hint: "Numerical DC adjustment for Common items. Default: 0 (no change). Applied after base DC calculation.",
        scope: "world", config: true, type: Number, default: 0,
    });
    game.settings.register(MODULE_ID, SETTINGS.RARITY_ADJ_UNCOMMON, { // NEW SETTING KEY
        name: "DC Adj: Uncommon Rarity",
        hint: "Numerical DC adjustment for Uncommon items. Default: 2 (DC +2). Applied after base DC calculation.",
        scope: "world", config: true, type: Number, default: 2,
    });
    game.settings.register(MODULE_ID, SETTINGS.RARITY_ADJ_RARE, { // NEW SETTING KEY
        name: "DC Adj: Rare Rarity",
        hint: "Numerical DC adjustment for Rare items. Default: 5 (DC +5). Applied after base DC calculation.",
        scope: "world", config: true, type: Number, default: 5,
    });
    game.settings.register(MODULE_ID, SETTINGS.RARITY_ADJ_UNIQUE, { // NEW SETTING KEY
        name: "DC Adj: Unique Rarity",
        hint: "Numerical DC adjustment for Unique items. Default: 10 (DC +10). Applied after base DC calculation.",
        scope: "world", config: true, type: Number, default: 10,
    });
    // Old RARITY_ADJUSTMENTS (JSON) would be removed or marked as deprecated if you fully switch.

    // --- Crafting Time Settings ---
    // Keeping these as JSON arrays for now due to their tabular nature.
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_LEVEL_THRESHOLDS, {
        name: "Crafting Time: Level Thresholds (JSON Array)",
        hint: `Defines item levels where base crafting time/unit changes. Corresponds to 'Base Values' and 'Base Units' below (must have one more entry than this array).
               Ex: [0, 3, 6] means: Level 0 uses 1st set; Levels 1-3 use 2nd; Levels 4-6 use 3rd; L7+ use 4th.
               The first value (e.g., "0") covers items *at or below* that level.`,
        scope: "world", config: true, type: String, default: JSON.stringify([0, 3, 6, 9, 12, 15, 18]),
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_BASE_VALUES, {
        name: "Crafting Time: Base Numerical Values (JSON Array)",
        hint: `Base time values (numbers) for crafting, matching 'Level Thresholds' and 'Base Units'.
               Ex (for thresholds [0,3,6]): [10, 1, 1, 1] means 10 for L0, 1 for L1-3, etc.
               Must have one more entry than 'Level Thresholds'.`,
        scope: "world", config: true, type: String, default: JSON.stringify([10, 1, 1, 1, 2, 1, 3, 6]),
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_BASE_UNITS, {
        name: "Crafting Time: Base Time Units (JSON Array)",
        hint: `Time units (strings: "minute", "hour", "day", "week", "month") for 'Base Values'.
               Ex: ["minute", "hour", "day", "day"]
               Must have the same number of entries as 'Base Values'.`,
        scope: "world", config: true, type: String, default: JSON.stringify(["minute", "hour", "day", "week", "week", "month", "month", "month"]),
    });

    // --- BROKEN DOWN PROFICIENCY MULTIPLIERS ---
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_MULT_UNTRAINED, { // NEW
        name: "Crafting Time Multiplier: Untrained",
        hint: "Multiplier for crafting time if Untrained in Crafting (Rank 0). Default: 10 (10x longer).",
        scope: "world", config: true, type: Number, default: 10,
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_MULT_TRAINED, { // NEW
        name: "Crafting Time Multiplier: Trained",
        hint: "Multiplier for crafting time if Trained in Crafting (Rank 1). Default: 1 (no change).",
        scope: "world", config: true, type: Number, default: 1,
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_MULT_EXPERT, { // NEW
        name: "Crafting Time Multiplier: Expert",
        hint: "Multiplier for crafting time if Expert in Crafting (Rank 2). Default: 0.75 (25% faster).",
        scope: "world", config: true, type: Number, default: 0.75,
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_MULT_MASTER, { // NEW
        name: "Crafting Time Multiplier: Master",
        hint: "Multiplier for crafting time if Master in Crafting (Rank 3). Default: 0.5 (50% faster).",
        scope: "world", config: true, type: Number, default: 0.5,
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_MULT_LEGENDARY, { // NEW
        name: "Crafting Time Multiplier: Legendary",
        hint: "Multiplier for crafting time if Legendary in Crafting (Rank 4). Default: 0.25 (75% faster).",
        scope: "world", config: true, type: Number, default: 0.25,
    });

    // --- UI & Style Settings ---
    game.settings.register(MODULE_ID, SETTINGS.SUCCESS_COLOR, {
        name: "Success Message Color",
        hint: "The color used for success messages and indicators in chat messages and UI elements generated by this module. Default: darkgreen.",
        scope: "client", config: true, type: String, default: "darkgreen"
    });
    game.settings.register(MODULE_ID, SETTINGS.FAILURE_COLOR, {
        name: "Failure Message Color",
        hint: "The color used for failure messages and indicators. Default: darkred.",
        scope: "client", config: true, type: String, default: "darkred"
    });
    game.settings.register(MODULE_ID, SETTINGS.INFO_COLOR, {
        name: "Informational Message Color",
        hint: "The color used for general informational messages (e.g., magical aura detected). Default: #005eff (a vibrant blue).",
        scope: "client", config: true, type: String, default: "#005eff"
    });
    game.settings.register(MODULE_ID, SETTINGS.NEUTRAL_COLOR, {
        name: "Neutral Message Color",
        hint: "The color used for neutral or standard text elements in module UIs. Default: #555 (a dark gray).",
        scope: "client", config: true, type: String, default: "#555"
    });

    // --- Core Configuration & Integration Settings ---
    game.settings.register(MODULE_ID, SETTINGS.MAGICAL_CRAFTING_FEAT_SLUG, {
        name: "Magical Crafting Feat Slug",
        hint: "The exact feat slug (e.g., 'magical-crafting') required to craft magical items. Used to check prerequisites on the character sheet. Important if your game uses a different feat for this.",
        scope: "world", config: true, type: String, default: "magical-crafting"
    });
    game.settings.register(MODULE_ID, SETTINGS.ALCHEMICAL_CRAFTING_FEAT_SLUG, {
        name: "Alchemical Crafting Feat Slug",
        hint: "The exact feat slug (e.g., 'alchemical-crafting') required to craft alchemical items. Used for prerequisite checks.",
        scope: "world", config: true, type: String, default: "alchemical-crafting"
    });
    game.settings.register(MODULE_ID, SETTINGS.REVERSE_ENGINEER_FORMULA_ICON, {
        name: "Reverse Engineer Formula Icon Path",
        hint: "File path for the icon displayed next to formulas learned via Reverse Engineering on the character sheet (if such a feature is visually implemented; currently used internally). Default: icons/svg/book.svg",
        scope: "world", config: true, type: String, default: "icons/svg/book.svg", filePicker: "imagevideo"
    });
    game.settings.register(MODULE_ID, SETTINGS.WRONGLY_IDENTIFIED_PREFIX, {
        name: "Wrongly Identified Item Name Prefix",
        hint: "A prefix added to the name of an item that a player critically fails to identify, when the deceptive item replacement occurs. Example: 'Misidentified Magic Sword' might become 'WRONGLY IDENTIFIED Magic Sword (Id by Player)'.",
        scope: "world", config: true, type: String, default: ""
    });
    game.settings.register(MODULE_ID, SETTINGS.COMPENDIUMS_TO_SEARCH, {
        name: "Compendiums for Formula Target Search (Comma-separated)",
        hint: "A comma-separated list of compendium pack machine names (e.g., 'pf2e.equipment-srd,mymodule.custom-items'). The module searches these to find the target item for a crafting formula if the formula's UUID link is broken or missing. Order might matter if items with the same name exist in multiple packs.",
        scope: "world",
        config: true,
        type: String,
        default: "pf2e.equipment-srd,pf2e.consumables-srd,pf2e.weapons-srd,pf2e.armor-srd,pf2e.treasure-vault-srd,pf2e.spells-srd,pf2e.feats-srd,pf2e.actions-srd,pf2e.conditionitems-srd",
    });
    game.settings.register(MODULE_ID, SETTINGS.IDENTIFY_SPELL_COMPENDIUM, {
        name: "Identify Spells Compendium Name",
        hint: "The machine name of the compendium pack containing the 'Detect Magic' and 'Read Aura' spells (e.g., 'pf2e.spells-srd'). Used for creating quick links in identification dialogs.",
        scope: "world", config: true, type: String, default: "pf2e.spells-srd"
    });
    game.settings.register(MODULE_ID, SETTINGS.DETECT_MAGIC_SPELL_ID, {
        name: "Detect Magic Spell Compendium ID",
        hint: "The specific compendium ID (not slug) of the 'Detect Magic' spell within the 'Identify Spells Compendium' defined above. Example: 'gpzpAAAJ1Lza2JVl'.",
        scope: "world", config: true, type: String, default: "gpzpAAAJ1Lza2JVl"
    });
    game.settings.register(MODULE_ID, SETTINGS.READ_AURA_SPELL_ID, {
        name: "Read Aura Spell Compendium ID",
        hint: "The specific compendium ID (not slug) of the 'Read Aura' spell within the 'Identify Spells Compendium'. Example: 'OhD2Z6rIGGD5ocZA'.",
        scope: "world", config: true, type: String, default: "OhD2Z6rIGGD5ocZA"
    });

    // --- Deceptive Critical Failure Settings (mostly for Identification) ---
    game.settings.register(MODULE_ID, SETTINGS.DECEPTIVE_CRIT_FAIL_MARKER, {
        name: "Internal Deceptive Crit Fail Marker",
        hint: "An HTML comment used internally to mark items that have been deceptively identified due to a critical failure. Not typically user-facing.",
        scope: "world", config: false, type: String, default: "<!-- SCF:DECEPTIVE_CRIT_FAIL -->"
    });
    game.settings.register(MODULE_ID, SETTINGS.CRIT_FAIL_ORIGINAL_DATA_FLAG, {
        name: "Internal Crit Fail Original Data Flag Key",
        hint: "The key used for a flag on an item to store its original data if it was misidentified on a critical failure (legacy or specific use cases). Not typically user-facing.",
        scope: "world", config: false, type: String, default: "criticalFailureOriginalData"
    });
    game.settings.register(MODULE_ID, SETTINGS.WRONGLY_IDENTIFIED_DESC, {
        name: "Crit Fail Identification Description (Player-Visible)",
        hint: "The HTML description text added to an item's 'unidentified' data when a player critically fails to identify it and receives a deceptive replacement. This text is what they would see if they could somehow view the 'unidentified' details of the item they *think* they identified.",
        scope: "world",
        config: true,
        type: String, 
        default: ""
    });
    
    // --- Identify Feat Configuration ---
    game.settings.register(MODULE_ID, SETTINGS.SCHOLASTIC_IDENTIFICATION_SLUG, {
        name: "Feat Slug: Scholastic Identification",
        hint: "The feat slug for 'Scholastic Identification' or its equivalent. Allows using Society for Identify Items checks.",
        scope: "world", config: true, type: String, default: "scholastic-identification"
    });
    game.settings.register(MODULE_ID, SETTINGS.SCHOLASTIC_IDENTIFICATION_REQ_MASTER, {
        name: "Scholastic ID Requires Master Proficiency?",
        hint: "If checked, the 'Scholastic Identification' feat requires Master proficiency in Society to be used for identification.",
        scope: "world", config: true, type: Boolean, default: true
    });
    game.settings.register(MODULE_ID, SETTINGS.ASSURED_IDENTIFICATION_SLUG, {
        name: "Feat Slug: Assured Identification",
        hint: "The feat slug for 'Assured Identification'. Changes a critical failure on Identify Items to a regular failure.",
        scope: "world", config: true, type: String, default: "assured-identification"
    });
    game.settings.register(MODULE_ID, SETTINGS.QUICK_IDENTIFICATION_SLUG, {
        name: "Feat Slug: Quick Identification",
        hint: "The feat slug for 'Quick Identification'. Reduces the time taken for Identify Items checks.",
        scope: "world", config: true, type: String, default: "quick-identification"
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTERS_APPRAISAL_SLUG, {
        name: "Feat Slug: Crafter's Appraisal",
        hint: "The feat slug for 'Crafter's Appraisal'. Allows using Crafting skill to Identify Magic on magic items.",
        scope: "world", config: true, type: String, default: "crafters-appraisal"
    });
    game.settings.register(MODULE_ID, SETTINGS.ODDITY_IDENTIFICATION_SLUG, {
        name: "Feat Slug: Oddity Identification",
        hint: "The feat slug for 'Oddity Identification' or a similar feat granting a conditional bonus to Identify Items.",
        scope: "world", config: true, type: String, default: "oddity-identification"
    });
    game.settings.register(MODULE_ID, SETTINGS.ODDITY_IDENTIFICATION_BONUS, {
        name: "Oddity Identification Bonus Value",
        hint: "The numerical circumstance bonus granted by the 'Oddity Identification' feat when its conditions are met.",
        scope: "world", config: true, type: Number, default: 2
    });
    game.settings.register(MODULE_ID, SETTINGS.ODDITY_IDENTIFICATION_REQ_TRAINED_OCC, {
        name: "Oddity ID Requires Trained Occultism?",
        hint: "If checked, the 'Oddity Identification' feat requires at least Trained proficiency in Occultism for its conditional bonus to be applicable.",
        scope: "world", config: true, type: Boolean, default: true
    });

    // --- Sound Settings ---
    game.settings.register(MODULE_ID, SETTINGS.SOUND_CRAFTING_LOOP, {
        name: "Sound: Crafting Loop",
        hint: "Path to the audio file played as a loop during crafting progress animations.",
        scope: "client", config: true, type: String, default: `modules/${MODULE_ID}/sounds/BlackSmithCraftingA.ogg`, filePicker: "audio"
    });
    game.settings.register(MODULE_ID, SETTINGS.SOUND_DETECT_MAGIC, {
        name: "Sound: Detect Magic/Read Aura Scan",
        hint: "Path to the audio file played briefly for each item scanned during Detect Magic or Read Aura.",
        scope: "client", config: true, type: String, default: `modules/${MODULE_ID}/sounds/DetectMagic.ogg`, filePicker: "audio"
    });
    game.settings.register(MODULE_ID, SETTINGS.SOUND_REVERSE_ENGINEER_START, {
        name: "Sound: Reverse Engineer Start",
        hint: "Path to the audio file played when a Reverse Engineering attempt begins.",
        scope: "client", config: true, type: String, default: `modules/${MODULE_ID}/sounds/ReverseEngineer.ogg`, filePicker: "audio"
    });
    game.settings.register(MODULE_ID, SETTINGS.SOUND_SUCCESS, {
        name: "Sound: Generic Success",
        hint: "Path to the audio file played on a successful outcome (e.g., successful craft, successful RE).",
        scope: "client", config: true, type: String, default: `modules/${MODULE_ID}/sounds/Success.ogg`, filePicker: "audio"
    });
    game.settings.register(MODULE_ID, SETTINGS.SOUND_FAILURE, {
        name: "Sound: Generic Failure",
        hint: "Path to the audio file played on a failed outcome.",
        scope: "client", config: true, type: String, default: `modules/${MODULE_ID}/sounds/Fail.ogg`, filePicker: "audio"
    });

    console.log(`${MODULE_ID} | Settings registered with detailed hints.`);
}

// getSetting and getParsedJsonSetting remain the same
export function getSetting(key) {
    return game.settings.get(MODULE_ID, key);
}

export function getParsedJsonSetting(key, defaultValue = {}) {
    try {
        const setting = game.settings.get(MODULE_ID, key);
        if (typeof setting === 'string' && setting.trim() !== "") {
            return JSON.parse(setting);
        } else if (typeof setting !== 'string') { // If it's already parsed (e.g. boolean, number)
            return setting;
        }
        // If it's an empty string or whitespace, return default
        console.warn(`${MODULE_ID} | JSON setting for key "${key}" was empty or whitespace. Returning default.`);
        return defaultValue;
    } catch (e) {
        console.warn(`${MODULE_ID} | Could not parse JSON setting for key "${key}". Value: "${game.settings.get(MODULE_ID, key)}". Returning default. Error:`, e);
        return defaultValue;
    }
}

