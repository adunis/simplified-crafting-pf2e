import { MODULE_ID, SETTINGS } from "./constants.js";

export function registerSettings() {
    game.settings.register(MODULE_ID, SETTINGS.USE_PF2E_DC_SYSTEM, {
        name: "Use PF2e System's DC Calculation",
        hint: "If checked (default), the module attempts to use the Pathfinder 2e system's standard DC calculation. Uncheck to primarily use the custom DC table below.",
        scope: "world", config: true, type: Boolean, default: true,
    });

    game.settings.register(MODULE_ID, SETTINGS.CUSTOM_DC_TABLE, {
        name: "Custom DC by Level Table (JSON)",
        hint: `REQUIRED if "Use PF2e System's DC" is off or fails. JSON string mapping item levels (string keys) to base DC (numbers). Example: {"0": 14, "1": 15, "20": 40}. Essential for PWL.`,
        scope: "world", config: true, type: String,
        default: JSON.stringify({0:14, 1:15, 2:16, 3:18, 4:19, 5:20, 6:22, 7:23, 8:24, 9:26, 10:27, 11:28, 12:30, 13:31, 14:32, 15:34, 16:35, 17:36, 18:38, 19:39, 20:40, 21:42, 22:44, 23:46, 24:48, 25:50}),
    });

    game.settings.register(MODULE_ID, SETTINGS.RARITY_ADJ_COMMON, {
        name: "DC Adj: Common Rarity",
        hint: "Numerical DC adjustment for Common items. Default: 0.",
        scope: "world", config: true, type: Number, default: 0,
    });
    game.settings.register(MODULE_ID, SETTINGS.RARITY_ADJ_UNCOMMON, {
        name: "DC Adj: Uncommon Rarity",
        hint: "Numerical DC adjustment for Uncommon items. Default: 2.",
        scope: "world", config: true, type: Number, default: 2,
    });
    game.settings.register(MODULE_ID, SETTINGS.RARITY_ADJ_RARE, {
        name: "DC Adj: Rare Rarity",
        hint: "Numerical DC adjustment for Rare items. Default: 5.",
        scope: "world", config: true, type: Number, default: 5,
    });
    game.settings.register(MODULE_ID, SETTINGS.RARITY_ADJ_UNIQUE, {
        name: "DC Adj: Unique Rarity",
        hint: "Numerical DC adjustment for Unique items. Default: 10.",
        scope: "world", config: true, type: Number, default: 10,
    });

    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_LEVEL_THRESHOLDS, {
        name: "Crafting Time: Level Thresholds (JSON Array)",
        hint: `Item levels where base crafting time/unit changes. Ex: [0, 3, 6] -> L0 (1st set), L1-3 (2nd), L4-6 (3rd), L7+ (4th).`,
        scope: "world", config: true, type: String, default: JSON.stringify([0, 3, 6, 9, 12, 15, 18]),
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_BASE_VALUES, {
        name: "Crafting Time: Base Numerical Values (JSON Array)",
        hint: `Base time values (numbers) for crafting. Must have one more entry than 'Level Thresholds'.`,
        scope: "world", config: true, type: String, default: JSON.stringify([10, 1, 1, 1, 2, 1, 3, 6]),
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_BASE_UNITS, {
        name: "Crafting Time: Base Time Units (JSON Array)",
        hint: `Time units (strings: "minute", "hour", "day", "week", "month"). Same number of entries as 'Base Values'.`,
        scope: "world", config: true, type: String, default: JSON.stringify(["minute", "hour", "day", "week", "week", "month", "month", "month"]),
    });

    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_MULT_UNTRAINED, {
        name: "Crafting Time Multiplier: Untrained",
        hint: "Multiplier for Untrained Crafting (Rank 0). Default: 10.",
        scope: "world", config: true, type: Number, default: 10,
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_MULT_TRAINED, {
        name: "Crafting Time Multiplier: Trained",
        hint: "Multiplier for Trained Crafting (Rank 1). Default: 1.",
        scope: "world", config: true, type: Number, default: 1,
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_MULT_EXPERT, {
        name: "Crafting Time Multiplier: Expert",
        hint: "Multiplier for Expert Crafting (Rank 2). Default: 0.75.",
        scope: "world", config: true, type: Number, default: 0.75,
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_MULT_MASTER, {
        name: "Crafting Time Multiplier: Master",
        hint: "Multiplier for Master Crafting (Rank 3). Default: 0.5.",
        scope: "world", config: true, type: Number, default: 0.5,
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTING_TIME_MULT_LEGENDARY, {
        name: "Crafting Time Multiplier: Legendary",
        hint: "Multiplier for Legendary Crafting (Rank 4). Default: 0.25.",
        scope: "world", config: true, type: Number, default: 0.25,
    });

    game.settings.register(MODULE_ID, SETTINGS.SUCCESS_COLOR, {
        name: "Success Message Color", hint: "Color for success messages/indicators. Default: darkgreen.",
        scope: "client", config: true, type: String, default: "darkgreen"
    });
    game.settings.register(MODULE_ID, SETTINGS.FAILURE_COLOR, {
        name: "Failure Message Color", hint: "Color for failure messages/indicators. Default: darkred.",
        scope: "client", config: true, type: String, default: "darkred"
    });
    game.settings.register(MODULE_ID, SETTINGS.INFO_COLOR, {
        name: "Informational Message Color", hint: "Color for general info messages. Default: #005eff.",
        scope: "client", config: true, type: String, default: "#005eff"
    });
    game.settings.register(MODULE_ID, SETTINGS.NEUTRAL_COLOR, {
        name: "Neutral Message Color", hint: "Color for neutral/standard text. Default: #555.",
        scope: "client", config: true, type: String, default: "#555"
    });

    game.settings.register(MODULE_ID, SETTINGS.MAGICAL_CRAFTING_FEAT_SLUG, {
        name: "Magical Crafting Feat Slug", hint: "Feat slug for Magical Crafting. Default: 'magical-crafting'.",
        scope: "world", config: true, type: String, default: "magical-crafting"
    });
    game.settings.register(MODULE_ID, SETTINGS.ALCHEMICAL_CRAFTING_FEAT_SLUG, {
        name: "Alchemical Crafting Feat Slug", hint: "Feat slug for Alchemical Crafting. Default: 'alchemical-crafting'.",
        scope: "world", config: true, type: String, default: "alchemical-crafting"
    });
    game.settings.register(MODULE_ID, SETTINGS.REVERSE_ENGINEER_FORMULA_ICON, {
        name: "Reverse Engineer Formula Icon Path", hint: "Icon for formulas learned via RE. Default: icons/svg/book.svg.",
        scope: "world", config: true, type: String, default: "icons/svg/book.svg", filePicker: "imagevideo"
    });
    game.settings.register(MODULE_ID, SETTINGS.WRONGLY_IDENTIFIED_PREFIX, {
        name: "Wrongly Identified Item Name Prefix", hint: "Prefix for deceptively ID'd items. Ex: 'Misidentified'. Default: ''.",
        scope: "world", config: true, type: String, default: ""
    });
    game.settings.register(MODULE_ID, SETTINGS.COMPENDIUMS_TO_SEARCH, {
        name: "Compendiums for Formula/Item Search (Comma-separated)",
        hint: "Comma-separated compendium pack names. Used for finding items for formulas and deceptive ID replacements.",
        scope: "world", config: true, type: String,
        default: "pf2e.equipment-srd,pf2e.consumables-srd,pf2e.weapons-srd,pf2e.armor-srd,pf2e.treasure-vault-srd",
    });
    game.settings.register(MODULE_ID, SETTINGS.IDENTIFY_SPELL_COMPENDIUM, {
        name: "Identify Spells Compendium Name", hint: "Compendium for Detect Magic/Read Aura links. Default: 'pf2e.spells-srd'.",
        scope: "world", config: true, type: String, default: "pf2e.spells-srd"
    });
    game.settings.register(MODULE_ID, SETTINGS.DETECT_MAGIC_SPELL_ID, {
        name: "Detect Magic Spell Compendium ID", hint: "Compendium ID of 'Detect Magic'. Ex: 'gpzpAAAJ1Lza2JVl'.",
        scope: "world", config: true, type: String, default: "gpzpAAAJ1Lza2JVl"
    });
    game.settings.register(MODULE_ID, SETTINGS.READ_AURA_SPELL_ID, {
        name: "Read Aura Spell Compendium ID", hint: "Compendium ID of 'Read Aura'. Ex: 'OhD2Z6rIGGD5ocZA'.",
        scope: "world", config: true, type: String, default: "OhD2Z6rIGGD5ocZA"
    });
    game.settings.register(MODULE_ID, SETTINGS.BULK_IDENTIFY_COST_PER_ITEM_GP, {
        name: "Bulk Identify Cost Per Item (GP)",
        hint: "Cost in GP per item when using the 'Identify All' button. Default: 0 (no cost).",
        scope: "world", config: true, type: Number, default: 0,
    });

    game.settings.register(MODULE_ID, SETTINGS.DECEPTIVE_CRIT_FAIL_MARKER, {
        name: "Internal Deceptive Crit Fail Marker", hint: "Internal HTML comment for deceptively ID'd items.",
        scope: "world", config: false, type: String, default: "<!-- SCF:DECEPTIVE_CRIT_FAIL -->"
    });
    game.settings.register(MODULE_ID, SETTINGS.CRIT_FAIL_ORIGINAL_DATA_FLAG, {
        name: "Internal Crit Fail Original Data Flag Key", hint: "Internal flag key for original item data on misidentification.",
        scope: "world", config: false, type: String, default: "criticalFailureOriginalData"
    });
    game.settings.register(MODULE_ID, SETTINGS.WRONGLY_IDENTIFIED_DESC, {
        name: "Crit Fail ID Description (Player-Visible)",
        hint: "HTML description added to unidentified data of a deceptively replaced item. Default: ''.",
        scope: "world", config: true, type: String, default: ""
    });
    
    game.settings.register(MODULE_ID, SETTINGS.SCHOLASTIC_IDENTIFICATION_SLUG, {
        name: "Feat Slug: Scholastic Identification", hint: "Feat slug for Scholastic ID. Default: 'scholastic-identification'.",
        scope: "world", config: true, type: String, default: "scholastic-identification"
    });
    game.settings.register(MODULE_ID, SETTINGS.SCHOLASTIC_IDENTIFICATION_REQ_MASTER, {
        name: "Scholastic ID Requires Master Proficiency?", hint: "If checked, Scholastic ID needs Master Society. Default: true.",
        scope: "world", config: true, type: Boolean, default: true
    });
    game.settings.register(MODULE_ID, SETTINGS.ASSURED_IDENTIFICATION_SLUG, {
        name: "Feat Slug: Assured Identification", hint: "Feat slug for Assured ID. Default: 'assured-identification'.",
        scope: "world", config: true, type: String, default: "assured-identification"
    });
    game.settings.register(MODULE_ID, SETTINGS.QUICK_IDENTIFICATION_SLUG, {
        name: "Feat Slug: Quick Identification", hint: "Feat slug for Quick ID. Default: 'quick-identification'.",
        scope: "world", config: true, type: String, default: "quick-identification"
    });
    game.settings.register(MODULE_ID, SETTINGS.CRAFTERS_APPRAISAL_SLUG, {
        name: "Feat Slug: Crafter's Appraisal", hint: "Feat slug for Crafter's Appraisal. Default: 'crafters-appraisal'.",
        scope: "world", config: true, type: String, default: "crafters-appraisal"
    });
    game.settings.register(MODULE_ID, SETTINGS.ODDITY_IDENTIFICATION_SLUG, {
        name: "Feat Slug: Oddity Identification", hint: "Feat slug for Oddity ID. Default: 'oddity-identification'.",
        scope: "world", config: true, type: String, default: "oddity-identification"
    });
    game.settings.register(MODULE_ID, SETTINGS.ODDITY_IDENTIFICATION_BONUS, {
        name: "Oddity Identification Bonus Value", hint: "Circumstance bonus for Oddity ID. Default: 2.",
        scope: "world", config: true, type: Number, default: 2
    });
    game.settings.register(MODULE_ID, SETTINGS.ODDITY_IDENTIFICATION_REQ_TRAINED_OCC, {
        name: "Oddity ID Requires Trained Occultism?", hint: "If checked, Oddity ID needs Trained Occultism. Default: true.",
        scope: "world", config: true, type: Boolean, default: true
    });

    game.settings.register(MODULE_ID, SETTINGS.SOUND_CRAFTING_LOOP, {
        name: "Sound: Crafting Loop", hint: "Audio for crafting progress. Default: module sound.",
        scope: "client", config: true, type: String, default: `modules/${MODULE_ID}/sounds/BlackSmithCraftingA.ogg`, filePicker: "audio"
    });
    game.settings.register(MODULE_ID, SETTINGS.SOUND_DETECT_MAGIC, {
        name: "Sound: Detect Magic/Read Aura Scan", hint: "Audio for item scan. Default: module sound.",
        scope: "client", config: true, type: String, default: `modules/${MODULE_ID}/sounds/DetectMagic.ogg`, filePicker: "audio"
    });
    game.settings.register(MODULE_ID, SETTINGS.SOUND_REVERSE_ENGINEER_START, {
        name: "Sound: Reverse Engineer Start", hint: "Audio for RE start. Default: module sound.",
        scope: "client", config: true, type: String, default: `modules/${MODULE_ID}/sounds/ReverseEngineer.ogg`, filePicker: "audio"
    });
    game.settings.register(MODULE_ID, SETTINGS.SOUND_SUCCESS, {
        name: "Sound: Generic Success", hint: "Audio for successful outcome. Default: module sound.",
        scope: "client", config: true, type: String, default: `modules/${MODULE_ID}/sounds/Success.ogg`, filePicker: "audio"
    });
    game.settings.register(MODULE_ID, SETTINGS.SOUND_FAILURE, {
        name: "Sound: Generic Failure", hint: "Audio for failed outcome. Default: module sound.",
        scope: "client", config: true, type: String, default: `modules/${MODULE_ID}/sounds/Fail.ogg`, filePicker: "audio"
    });
}

export function getSetting(key) {
    return game.settings.get(MODULE_ID, key);
}

export function getParsedJsonSetting(key, defaultValue = {}) {
    try {
        const setting = game.settings.get(MODULE_ID, key);
        if (typeof setting === 'string' && setting.trim() !== "") {
            return JSON.parse(setting);
        } else if (typeof setting !== 'string') { 
            return setting;
        }
        return defaultValue;
    } catch (e) {
        return defaultValue;
    }
}