// In module/constants.js
export const MODULE_ID = "simplified-crafting-pf2e";

export const SETTINGS = {
    // --- DC Settings ---
    USE_PF2E_DC_SYSTEM: "usePf2eDcSystem",
    CUSTOM_DC_TABLE: "customDcTable", // Kept as JSON for now
    // RARITY_ADJUSTMENTS: "rarityAdjustments", // OLD - REMOVED
    RARITY_ADJ_COMMON: "rarityAdjustmentCommon",     // NEW
    RARITY_ADJ_UNCOMMON: "rarityAdjustmentUncommon", // NEW
    RARITY_ADJ_RARE: "rarityAdjustmentRare",         // NEW
    RARITY_ADJ_UNIQUE: "rarityAdjustmentUnique",     // NEW

    // --- Crafting Time Settings ---
    CRAFTING_TIME_LEVEL_THRESHOLDS: "craftingTimeLevelThresholds", // Kept as JSON
    CRAFTING_TIME_BASE_VALUES: "craftingTimeBaseValues",           // Kept as JSON
    CRAFTING_TIME_BASE_UNITS: "craftingTimeBaseUnits",             // Kept as JSON
    // CRAFTING_TIME_PROFICIENCY_MULTIPLIERS: "craftingTimeProficiencyMultipliers", // OLD - REMOVED
    CRAFTING_TIME_MULT_UNTRAINED: "craftingTimeMultiplierUntrained",   // NEW
    CRAFTING_TIME_MULT_TRAINED: "craftingTimeMultiplierTrained",     // NEW
    CRAFTING_TIME_MULT_EXPERT: "craftingTimeMultiplierExpert",       // NEW
    CRAFTING_TIME_MULT_MASTER: "craftingTimeMultiplierMaster",       // NEW
    CRAFTING_TIME_MULT_LEGENDARY: "craftingTimeMultiplierLegendary", // NEW

    // ... (rest of your setting keys: UI, Core Config, Feat Slugs, Deceptive Crit, Sounds)
    // Feat slugs are kept for now as discussed.
    MAGICAL_CRAFTING_FEAT_SLUG: "magicalCraftingFeatSlug",
    ALCHEMICAL_CRAFTING_FEAT_SLUG: "alchemicalCraftingFeatSlug",
    REVERSE_ENGINEER_FORMULA_ICON: "reverseEngineerFormulaIcon",
    WRONGLY_IDENTIFIED_PREFIX: "wronglyIdentifiedPrefix",
    COMPENDIUMS_TO_SEARCH: "compendiumsToSearch", 
    IDENTIFY_SPELL_COMPENDIUM: "identifySpellCompendium",
    DETECT_MAGIC_SPELL_ID: "detectMagicSpellId",
    READ_AURA_SPELL_ID: "readAuraSpellId",
    DECEPTIVE_CRIT_FAIL_MARKER: "deceptiveCritFailMarker",
    CRIT_FAIL_ORIGINAL_DATA_FLAG: "critFailOriginalDataFlag",
    WRONGLY_IDENTIFIED_DESC: "wronglyIdentifiedDesc",
    SCHOLASTIC_IDENTIFICATION_SLUG: "scholasticIdentificationSlug",
    SCHOLASTIC_IDENTIFICATION_REQ_MASTER: "scholasticIdentificationReqMaster",
    ASSURED_IDENTIFICATION_SLUG: "assuredIdentificationSlug",
    QUICK_IDENTIFICATION_SLUG: "quickIdentificationSlug",
    CRAFTERS_APPRAISAL_SLUG: "craftersAppraisalSlug",
    ODDITY_IDENTIFICATION_SLUG: "oddityIdentificationSlug",
    ODDITY_IDENTIFICATION_BONUS: "oddityIdentificationBonus",
    ODDITY_IDENTIFICATION_REQ_TRAINED_OCC: "oddityIdentificationReqTrainedOcc",
    SUCCESS_COLOR: "successColor",
    FAILURE_COLOR: "failureColor",
    INFO_COLOR: "infoColor",
    NEUTRAL_COLOR: "neutralColor",
    SOUND_CRAFTING_LOOP: "soundCraftingLoop",
    SOUND_DETECT_MAGIC: "soundDetectMagic",
    SOUND_REVERSE_ENGINEER_START: "soundReverseEngineerStart",
    SOUND_SUCCESS: "soundSuccess",
    SOUND_FAILURE: "soundFailure",
};

// Default values for some complex configurations (can be overridden by settings if needed)
// These are kept here for easier management than very long JSON strings in settings registration
export const DEFAULT_SUPPORTED_IDENTIFY_FEATS_CONFIG = {
  "scholastic-identification": { name: "Scholastic Identification", type: "skill_substitution", substituteSkill: "soc" },
  "assured-identification": { name: "Assured Identification", type: "outcome_modifier", effect: "crit_fail_becomes_fail" },
  "quick-identification": { name: "Quick Identification", type: "time_modifier" },
  "crafters-appraisal": { name: "Crafter's Appraisal", type: "skill_substitution", substituteSkill: "cra", appliesTo: "magic_items" },
  "oddity-identification": { name: "Oddity Identification (+X Circ.)", type: "roll_modifier" }
};

export const DEFAULT_IDENTIFY_ICONS_SKILL_MAP = {
    arc: "fa-atom", nat: "fa-leaf", occ: "fa-eye", rel: "fa-crosshairs", soc: "fa-landmark", cra: "fa-hammer",
};
export const DEFAULT_IDENTIFY_ICONS_SKILL_TOOLTIPS = {
    arc: "Arcana", nat: "Nature", occ: "Occultism", rel: "Religion", soc: "Society", cra: "Crafting",
};
export const DEFAULT_IDENTIFY_ICONS_SKILL_DATA_MAP = {
    arc: "arcana", nat: "nature", occ: "occultism", rel: "religion", soc: "society", cra: "crafting",
};

export const DEFAULT_CRAFTING_FEAT_SLUGS = new Set([
  "magical-crafting", "alchemical-crafting", "inventor", "quick-setup", "improvise-tool",
  "snare-crafting", "specialty-crafting", "impeccable-crafter", "quick-repair",
  "rapid-affixture", "gadget-specialist", "efficient-construction", "ubiquitous-gadgets",
  "construct-crafting", "master-crafter", "craft-anything", "legendary-crafter",
]);