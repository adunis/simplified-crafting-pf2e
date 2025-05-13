import { MODULE_ID, SETTINGS } from "./constants.js";
import { getSetting } from "./settings.js";

// Helper for slug conversion
const KEBAB_TO_CAMEL_RUNE_SLUGS = {
    "greater-striking": "greaterStriking",
    "major-striking": "majorStriking",
    "greater-resilient": "greaterResilient",
    "major-resilient": "majorResilient",
};
const CAMEL_TO_KEBAB_RUNE_SLUGS = Object.fromEntries(
    Object.entries(KEBAB_TO_CAMEL_RUNE_SLUGS).map(([k, v]) => [v, k])
);


export class RuneEtchingHandler {
    constructor(dcCalculator, utils, craftingHandler) {
        this.dcCalculator = dcCalculator;
        this.utils = utils;
        this.craftingHandler = craftingHandler;
        // console.log(`${MODULE_ID} | RuneEtchingHandler constructed.`);
    }

    getStyles = () => ({
        successColor: getSetting(SETTINGS.SUCCESS_COLOR),
        failureColor: getSetting(SETTINGS.FAILURE_COLOR),
        infoColor: getSetting(SETTINGS.INFO_COLOR),
        neutralColor: getSetting(SETTINGS.NEUTRAL_COLOR),
    });

    getSounds = () => ({
        success: getSetting(SETTINGS.SOUND_SUCCESS),
        failure: getSetting(SETTINGS.SOUND_FAILURE),
    });

    startRuneEtchingProcess = async (actor) => {
        if (!actor) {
            ui.notifications.warn("Rune Etching: No actor selected.");
            return;
        }

        const baseItem = await this._selectBaseItem(actor);
        if (!baseItem) {
            return;
        }

        const runesToEtch = await this._selectRunesForEtching(actor, baseItem);
        if (!runesToEtch || runesToEtch.length === 0) {
            return;
        }

        let allAttemptsSuccessful = true;
        let attemptedEtches = 0;
        for (const etchOperation of runesToEtch) {
            attemptedEtches++;
            const success = await this._attemptSingleRuneEtch(actor, baseItem, etchOperation.runeItem, etchOperation.targetSlot);
            if (!success) {
                allAttemptsSuccessful = false;
            }
        }

        if (attemptedEtches > 0) {
            if (allAttemptsSuccessful) {
                ui.notifications.info(`All selected runes that were attempted were successfully etched onto ${baseItem.name}!`);
            } else {
                ui.notifications.warn(`Some runes could not be etched onto ${baseItem.name}. Check chat log for details.`);
            }
        }
        if (actor.sheet?.rendered) actor.sheet.render(true);
    };

    _selectBaseItem = async (actor) => {
        const eligibleItems = actor.items.filter(item =>
            (item.isOfType("weapon") || item.isOfType("armor")) &&
            !item.system.specific?.value &&
            ( (item.isOfType("weapon") && (item.system.runes?.potency ?? 0) < 3) ||
              (item.isOfType("armor")  && (item.system.runes?.potency ?? 0) < 3) ||
              ( (item.system.runes?.potency ?? 0) > 0 && (item.system.runes?.potency ?? 0) < 4 && this._hasEmptyPropertySlots(item) )
            )
        ).sort((a, b) => a.name.localeCompare(b.name));

        if (eligibleItems.length === 0) {
            ui.notifications.warn(`${actor.name} has no non-specific weapons or armor currently eligible for further rune etching.`);
            return null;
        }

        const optionsHtml = eligibleItems.map(item =>
            `<option value="${item.id}">${item.name} (${item.type}) ${this._getExistingRunesDisplay(item)}</option>`
        ).join("");

        const dialogContent = `
            <form>
                <div class="form-group">
                    <label for="select-base-item-etch">Select Item to Etch Runes Onto:</label>
                    <select name="itemId" id="select-base-item-etch" style="width: 100%;">${optionsHtml}</select>
                </div>
                <p style="font-size:0.9em; color:#555;">Only non-specific weapons and armor that can still receive rune upgrades or have empty property slots are shown.</p>
            </form>`;

        return new Promise((resolve) => {
            new Dialog({
                title: "Select Base Item for Rune Etching", content: dialogContent,
                buttons: {
                    select: { label: "Select Item", icon: '<i class="fas fa-check"></i>', callback: (html) => {
                        const itemId = html.find('select[name="itemId"]').val();
                        resolve(itemId ? actor.items.get(itemId) : null);
                    }},
                    cancel: { label: "Cancel", icon: '<i class="fas fa-times"></i>', callback: () => resolve(null) }
                },
                default: "select", close: () => resolve(null)
            }).render(true);
        });
    };

    _hasEmptyPropertySlots = (item) => {
        const systemRunes = item.system.runes;
        if (!systemRunes) return false;
        const potency = systemRunes.potency ?? 0;
        if (potency === 0) return false;

        for (let i = 1; i <= potency; i++) {
            if (!systemRunes[`propertyRune${i}`]) {
                return true;
            }
        }
        return false;
    };

    _getExistingRunesDisplay = (item) => {
        let runes = [];
        const systemRunes = item.system.runes;
        if (!systemRunes) return "(Error: No rune data)";

        if (systemRunes.potency) runes.push(`+${systemRunes.potency} Potency`);

        if (item.isOfType("weapon") && systemRunes.striking) {
            runes.push(game.i18n.localize(CONFIG.PF2E.weaponStrikingRunes[systemRunes.striking] || systemRunes.striking));
        } else if (item.isOfType("armor") && systemRunes.resilient) {
            runes.push(game.i18n.localize(CONFIG.PF2E.armorResiliencyRunes[systemRunes.resilient] || systemRunes.resilient));
        }

        for (let i = 1; i <= 4; i++) {
            const runeSlug = systemRunes[`propertyRune${i}`];
            if (runeSlug) {
                const runeName = game.i18n.localize(CONFIG.PF2E.weaponPropertyRunes[runeSlug] || CONFIG.PF2E.armorPropertyRunes[runeSlug] || runeSlug);
                runes.push(runeName);
            }
        }
        return runes.length > 0 ? `(${runes.join(", ")})` : "(No Runes)";
    };

    _selectRunesForEtching = async (actor, baseItem) => {
        const availableSlots = this._getAvailableRuneSlots(baseItem);
        const eligibleRunes = actor.items.filter(item => {
            if (item.isStowed) return false;
            const usage = item.system.usage?.value?.toLowerCase().trim() || "";
            const traits = item.system.traits?.value || [];
            const category = item.system.category?.toLowerCase().trim() || "";

            // An item is considered a potential rune if it's meant to be etched AND
            // is identified as a rune by trait or category, or is general equipment.
            if (!usage.startsWith("etched-onto-")) return false;

            const pf2eRuneCategories = ["weaponpropertyrune", "armorpropertyrune", "weaponfundamentalrune", "armorfundamentalrune", "rune"];
            if (traits.includes("rune") || pf2eRuneCategories.includes(category)) return true;
            
            // Broader fallback, ensure it's not a talisman
            if (item.type === "equipment" && item.system.consumableType !== "talisman") {
                return true; 
            }
            return false;
        }).sort((a,b) => a.name.localeCompare(b.name));
        
         console.log(`${MODULE_ID} | Filtered eligible runes for ${actor.name} on ${baseItem.name}:`, eligibleRunes.map(r => ({name: r.name, slug: r.slug, type: r.type, usage: r.system.usage?.value, traits: r.system.traits?.value, category: r.system.category }) ));

        if (Object.keys(availableSlots).length === 0) {
            ui.notifications.info(`'${baseItem.name}' has no available rune slots for new runes or upgrades.`);
            return [];
        }
        if (eligibleRunes.length === 0) {
            ui.notifications.warn(`${actor.name} has no items identified as etchable runes in their inventory.`);
            return [];
        }

        let slotsHtml = "";
        let hasCompatibleOptions = false;
        for (const slotKey in availableSlots) {
            const slotData = availableSlots[slotKey];
            const compatibleRunesForSlot = eligibleRunes.filter(rune => this._isRuneCompatibleWithSlot(rune, slotData, baseItem));
            
            // if(compatibleRunesForSlot.length > 0) console.log(`${MODULE_ID} | Compatible runes for slot ${slotKey} (${slotData.label}):`, compatibleRunesForSlot.map(r => r.name));
            // else console.log(`${MODULE_ID} | No compatible runes for slot ${slotKey} (${slotData.label})`);


            slotsHtml += `<div class="form-group" style="display: flex; align-items: center; margin-bottom: 5px;">
                            <label for="rune-for-${slotKey}" style="flex-basis: 220px; margin-right: 10px; white-space: nowrap;">${slotData.label}:</label>`;
            if (compatibleRunesForSlot.length > 0) {
                hasCompatibleOptions = true;
                slotsHtml += `
                        <select name="rune-for-${slotKey}" id="rune-for-${slotKey}" data-slot-key="${slotKey}" data-slot-type="${slotData.type}" style="flex-grow: 1;">
                            <option value="">-- ${slotData.isEmpty || slotData.canUpgrade ? "None / No Change" : "No Change"} --</option>
                            ${compatibleRunesForSlot.map(rune => `<option value="${rune.id}">${rune.name} (Lvl ${rune.level ?? 0})</option>`).join("")}
                        </select>`;
            } else if (slotData.isFundamental && !slotData.canUpgrade) {
                slotsHtml += `<span style="flex-grow: 1;"><em>Maxed Out</em></span>`;
            } else if (!slotData.isEmpty && !slotData.canUpgrade && slotData.currentValue) {
                 const currentRuneName = game.i18n.localize(CONFIG.PF2E.weaponPropertyRunes[slotData.currentValue] || CONFIG.PF2E.armorPropertyRunes[slotData.currentValue] || slotData.currentValue);
                 slotsHtml += `<span style="flex-grow: 1;"><em>Currently: ${currentRuneName}</em></span>`;
            } else {
                 slotsHtml += `<span style="flex-grow: 1;">No compatible runes in inventory.</span>`;
            }
            slotsHtml += `</div>`;
        }

        if (!hasCompatibleOptions) {
             ui.notifications.info(`No compatible runes in inventory for any available slots on '${baseItem.name}'. Check rune usage, type, and level.`);
            return [];
        }

        const dialogContent = `
            <form id="etch-rune-selection-form">
                <p>Select runes from your inventory to etch onto <strong>${baseItem.name}</strong>. Choosing a rune for a filled slot will replace the existing one (if different and compatible).</p>
                <div style="max-height: 400px; overflow-y: auto; margin-bottom: 10px;">${slotsHtml}</div>
                <p style="font-size:0.9em; color:#555;">Etching each rune typically takes 1 day and a Crafting check.</p>
            </form>`;

        return new Promise((resolve) => {
            new Dialog({
                title: `Select Runes for '${baseItem.name}'`, content: dialogContent,
                buttons: {
                    etch: { label: "Confirm Selections", icon: '<i class="fas fa-check"></i>', callback: (html) => {
                        const selectedRunes = [];
                        html.find('select[name^="rune-for-"]').each(function() {
                            const runeId = $(this).val();
                            if (runeId) {
                                const runeItem = actor.items.get(runeId);
                                const targetSlotKey = $(this).data('slotKey');
                                if (runeItem && targetSlotKey) {
                                    selectedRunes.push({ runeItem, targetSlot: targetSlotKey });
                                }
                            }
                        });
                        resolve(selectedRunes);
                    }},
                    cancel: { label: "Cancel", icon: '<i class="fas fa-times"></i>', callback: () => resolve([]) }
                },
                default: "etch", close: () => resolve([]),
                render: (html) => { html.closest('.dialog').css('height', 'auto');}
            }).render(true);
        });
    };

    _getAvailableRuneSlots = (item) => {
        const slots = {};
        const systemRunes = item.system.runes;
        if (!systemRunes) return slots;
        const potency = systemRunes.potency ?? 0;

        if (item.isOfType("weapon")) {
            slots.potency = { label: `Potency (Current: ${potency})`, type: "potency", currentValue: potency, isFundamental: true, canUpgrade: potency < 3, isEmpty: potency === 0 };
            
            const strikingSlugsCamel = ["", "striking", "greaterStriking", "majorStriking"];
            const currentStrikingSlugCamel = systemRunes.striking ?? "";
            const currentStrikingIndex = strikingSlugsCamel.indexOf(currentStrikingSlugCamel);
            const currentStrikingDisplay = currentStrikingSlugCamel ? (game.i18n.localize(CONFIG.PF2E.weaponStrikingRunes[currentStrikingSlugCamel] || currentStrikingSlugCamel)) : "None";
            slots.striking = { label: `Striking (Current: ${currentStrikingDisplay})`, type: "striking", currentValue: currentStrikingSlugCamel, isFundamental: true, canUpgrade: currentStrikingIndex >=0 && currentStrikingIndex < 3, isEmpty: !currentStrikingSlugCamel };
            
            const maxPropertySlotsBasedOnPotency = potency;
            for (let i = 1; i <= 4; i++) { 
                const slotKey = `propertyRune${i}`;
                const existingRuneSlug = systemRunes[slotKey]; // This is property rune slug (kebab-case)
                const existingRuneName = existingRuneSlug ? (game.i18n.localize(CONFIG.PF2E.weaponPropertyRunes[existingRuneSlug] || existingRuneSlug)) : null;
                
                if (i <= maxPropertySlotsBasedOnPotency) {
                    slots[slotKey] = { 
                        label: `Property Slot ${i}${existingRuneName ? ` (${existingRuneName})` : ` (Empty)`}`, 
                        type: "property", 
                        currentValue: existingRuneSlug || null, 
                        isFundamental: false, 
                        isEmpty: !existingRuneSlug 
                    };
                } else if (existingRuneSlug) {
                     slots[slotKey] = { 
                        label: `Property Slot ${i} (${existingRuneName}) (Extra)`, 
                        type: "property", 
                        currentValue: existingRuneSlug, 
                        isFundamental: false, 
                        isEmpty: false,
                        isExtraSlot: true 
                    };
                }
            }
        } else if (item.isOfType("armor")) {
            slots.potency = { label: `Potency (Current: ${potency})`, type: "potency", currentValue: potency, isFundamental: true, canUpgrade: potency < 3, isEmpty: potency === 0 };

            const resilientSlugsCamel = ["", "resilient", "greaterResilient", "majorResilient"];
            const currentResilientSlugCamel = systemRunes.resilient ?? "";
            const currentResilientIndex = resilientSlugsCamel.indexOf(currentResilientSlugCamel);
            const currentResilientDisplay = currentResilientSlugCamel ? (game.i18n.localize(CONFIG.PF2E.armorResiliencyRunes[currentResilientSlugCamel] || currentResilientSlugCamel)) : "None";
            slots.resilient = { label: `Resilient (Current: ${currentResilientDisplay})`, type: "resilient", currentValue: currentResilientSlugCamel, isFundamental: true, canUpgrade: currentResilientIndex >=0 && currentResilientIndex < 3, isEmpty: !currentResilientSlugCamel };
            
            const maxPropertySlotsBasedOnPotency = potency;
            for (let i = 1; i <= 4; i++) {
                const slotKey = `propertyRune${i}`;
                const existingRuneSlug = systemRunes[slotKey]; // This is property rune slug (kebab-case)
                const existingRuneName = existingRuneSlug ? (game.i18n.localize(CONFIG.PF2E.armorPropertyRunes[existingRuneSlug] || existingRuneSlug)) : null;
                if (i <= maxPropertySlotsBasedOnPotency) {
                    slots[slotKey] = { 
                        label: `Property Slot ${i}${existingRuneName ? ` (${existingRuneName})` : ` (Empty)`}`, 
                        type: "property", 
                        currentValue: existingRuneSlug || null, 
                        isFundamental: false, 
                        isEmpty: !existingRuneSlug 
                    };
                } else if (existingRuneSlug) {
                     slots[slotKey] = { 
                        label: `Property Slot ${i} (${existingRuneName}) (Extra)`, 
                        type: "property", 
                        currentValue: existingRuneSlug, 
                        isFundamental: false, 
                        isEmpty: false,
                        isExtraSlot: true
                    };
                }
            }
        }
        return slots;
    };

    _isRuneCompatibleWithSlot = (runeItem, slotData, baseItem) => {
        const runeSystem = runeItem.system;
        const rawRuneUsage = runeSystem.usage?.value;
        const runeUsage = rawRuneUsage?.toLowerCase().trim();
        const runeSlug = runeItem.slug?.toLowerCase().trim(); // Rune item's slug (kebab-case for striking/resilient)
        const baseItemType = baseItem.type;
        const baseIsShield = !!baseItem.isShield; // PF2e system items have an isShield getter

//         console.log(`--- _isRuneCompatibleWithSlot ---
// Rune: ${runeItem.name} (ID: ${runeItem.id}, Slug: '${runeSlug}', Raw Usage: '${rawRuneUsage}', Processed Usage: '${runeUsage}')
// Slot Type: ${slotData.type} (Label: '${slotData.label}', Current Value on Item: '${slotData.currentValue}', Is Empty: ${slotData.isEmpty}, Can Upgrade: ${slotData.canUpgrade})
// Base Item: ${baseItem.name} (Type: ${baseItemType}, Is Shield: ${baseIsShield})`);

        // 1. General Usage Match
        const TARGET_WEAPON_USAGE = "etched-onto-a-weapon";
        const TARGET_ARMOR_USAGE = "etched-onto-a-armor";
        const TARGET_SHIELD_USAGE = "etched-onto-a-shield"; // Or "etched-onto-shield"

        let usageSuitable = false;
        if (baseItemType === "weapon" && !baseIsShield && runeUsage === TARGET_WEAPON_USAGE) usageSuitable = true;
        else if (baseItemType === "armor" && !baseIsShield && runeUsage === TARGET_ARMOR_USAGE) usageSuitable = true;
        else if (baseIsShield) {
            // Shields can take shield-specific runes.
            // They can also take armor runes (for general protection).
            // Shield attachments (boss, spikes) can take weapon runes. We assume baseItem is the shield itself.
            if (runeUsage === TARGET_SHIELD_USAGE) usageSuitable = true;
            else if (runeUsage === TARGET_ARMOR_USAGE) usageSuitable = true; // Armor runes generally fine for shield body
            else if (runeUsage === TARGET_WEAPON_USAGE && (slotData.type === "potency" || slotData.type === "striking" || (slotData.type === "property" && (runeSlug?.includes("weapon") || !runeSlug?.includes("armor"))))) {
                 // Allow weapon runes if slot is for weapon-like aspects (potency, striking) or if property rune seems weapon-y
                 // This is a simplification; shield attachments are complex.
                 usageSuitable = true;
            }
        }


        if (!usageSuitable) {
            // console.log(`Compatibility FAIL (Stage 1 - Usage): Rune usage '${runeUsage}' not suitable for base item type '${baseItemType}' (Is Shield: ${baseIsShield}) or slot type '${slotData.type}'.`);
            return false;
        }
        // console.log("Compatibility PASS (Stage 1 - Usage)");

        // 2. Specific Slot Type Compatibility
        switch (slotData.type) {
            case "potency":
                const currentPotencyLevelOnItem = slotData.currentValue ?? 0; // Potency on item is a number
                const requiredNextPotencyLevel = currentPotencyLevelOnItem + 1;
                
                if (requiredNextPotencyLevel > 3) return false;

                let expectedPotencyRuneSlug;
                if (baseItemType === "weapon" || (baseIsShield && (runeUsage === TARGET_WEAPON_USAGE || runeUsage === TARGET_SHIELD_USAGE))) { // Shield taking weapon potency
                    expectedPotencyRuneSlug = `weapon-potency-${requiredNextPotencyLevel}`;
                } else if (baseItemType === "armor" || (baseIsShield && runeUsage === TARGET_ARMOR_USAGE)) { // Shield taking armor potency
                    expectedPotencyRuneSlug = `armor-potency-${requiredNextPotencyLevel}`;
                } else {
                    // console.log(`Potency Check FAIL: Base item type '${baseItemType}'/shield status not clear for potency rune type.`);
                    return false;
                }
                
                // console.log(`Potency Check: Rune Slug: '${runeSlug}', Expected Slug: '${expectedPotencyRuneSlug}'`);
                return runeSlug === expectedPotencyRuneSlug;

            case "striking": // Weapon Fundamental (runeSlug is kebab-case)
                if (baseItemType !== "weapon" && !baseIsShield) return false; // Must be a weapon or shield

                const strikingTiersByKebabSlug = { "": 0, "striking": 1, "greater-striking": 2, "major-striking": 3 };
                const strikingTiersByCamelSlug = { "": 0, "striking": 1, "greaterStriking": 2, "majorStriking": 3 };

                const currentStrikingTier = strikingTiersByCamelSlug[slotData.currentValue ?? ""]; // slotData.currentValue is camelCase
                const runeStrikingTier = strikingTiersByKebabSlug[runeSlug]; // runeSlug is kebab-case from rune item

                // console.log(`Striking Check: Rune Slug: '${runeSlug}' (Tier: ${runeStrikingTier}), Current Item Striking: '${slotData.currentValue}' (Tier: ${currentStrikingTier})`);
                return runeStrikingTier !== undefined && currentStrikingTier !== undefined && (runeStrikingTier === currentStrikingTier + 1);

            case "resilient": // Armor Fundamental (runeSlug is kebab-case)
                if (baseItemType !== "armor" && !baseIsShield) return false; // Must be armor or shield

                const resilientTiersByKebabSlug = { "": 0, "resilient": 1, "greater-resilient": 2, "major-resilient": 3 };
                const resilientTiersByCamelSlug = { "": 0, "resilient": 1, "greaterResilient": 2, "majorResilient": 3 };

                const currentResilientTier = resilientTiersByCamelSlug[slotData.currentValue ?? ""]; // slotData.currentValue is camelCase
                const runeResilientTier = resilientTiersByKebabSlug[runeSlug]; // runeSlug is kebab-case from rune item

                // console.log(`Resilient Check: Rune Slug: '${runeSlug}' (Tier: ${runeResilientTier}), Current Item Resilient: '${slotData.currentValue}' (Tier: ${currentResilientTier})`);
                return runeResilientTier !== undefined && currentResilientTier !== undefined && (runeResilientTier === currentResilientTier + 1);

            case "property":
                // Must not be a fundamental rune
                const isWeaponPotency = runeSlug?.startsWith("weapon-potency-");
                const isArmorPotency = runeSlug?.startsWith("armor-potency-");
                const isStrikingOrResilient = [
                    "striking", "greater-striking", "major-striking",
                    "resilient", "greater-resilient", "major-resilient"
                ].includes(runeSlug);

                if (isWeaponPotency || isArmorPotency || isStrikingOrResilient) {
                    // console.log(`Property Check FAIL: Rune '${runeSlug}' is a fundamental rune.`);
                    return false;
                }
                
                const baseItemRunes = baseItem.system.runes;
                if (baseItemRunes) {
                    for (let i = 1; i <= 4; i++) {
                        if (baseItemRunes[`propertyRune${i}`] === runeSlug) {
                            // console.log(`Property Check FAIL: Rune '${runeSlug}' already etched in another slot (propertyRune${i}).`);
                            return false; 
                        }
                    }
                }
                
                if (!slotData.isEmpty && slotData.currentValue === runeSlug) {
                    // console.log(`Property Check FAIL: Rune '${runeSlug}' is already in this specific slot.`);
                    return false; 
                }
                
                // console.log(`Property Check PASS for rune '${runeSlug}'.`);
                return true;

            default:
                // console.log(`Compatibility FAIL: Unknown slotData.type: ${slotData.type}`);
                return false;
        }
    };
    
    _attemptSingleRuneEtch = async (actor, baseItem, runeItem, targetSlotKey) => {
        const craftSkill = actor.skills.crafting;
        if (!craftSkill) { ui.notifications.error(`${actor.name} lacks Crafting skill.`); return false; }

        const runeLevel = runeItem.level ?? 0;
        const dc = this.dcCalculator.calculateDC(runeLevel, { dcType: "etchingRune" });
        if (!dc || dc <= 0) { ui.notifications.error(`Could not determine DC for etching ${runeItem.name}.`); return false; }
        
        const timeToEtch = this.craftingHandler.calculateCraftingTime(runeLevel, craftSkill.rank);

        const roll = await craftSkill.roll({
            dc: { value: dc },
            item: runeItem,     // The rune item being used/consumed for the check
            target: null,       // <<< CORRECTED: No specific actor/token target for this craft check
            extraRollOptions: [
                "action:craft",
                "action:etch-rune",
                `item:level:${runeLevel}`, // Refers to runeItem's level
                // Optional: Add baseItem context if needed by any specific downstream system/module effects
                // `crafting:targetitem:id:${baseItem.id}`,
                // `crafting:targetitem:slug:${baseItem.slug}`,
                // `crafting:targetitem:level:${baseItem.level}`
            ],
            title: `Etch Rune: ${runeItem.name} onto ${baseItem.name}`,
            flavor: `Attempting to etch ${runeItem.name} (Lvl ${runeLevel}, DC ${dc}) onto ${baseItem.name}.<br>Expected Time: ${timeToEtch}.`,
            // Ensure the actor performing the roll is implicitly craftSkill.actor
        });

        if (!roll) { ui.notifications.warn("Rune etching roll cancelled."); return false; }

        const styles = this.getStyles();
        let outcomeMessage = "", etchSuccessful = false;

        if (roll.degreeOfSuccess >= 2) { // Success or Critical Success
            outcomeMessage = `<strong>${CONFIG.PF2E.degreeOfSuccessStrings[roll.degreeOfSuccess]}!</strong> You successfully etch ${runeItem.name} onto ${baseItem.name}.`;
            etchSuccessful = true;
            
            let updatePayload = {};
            const runeSlugToEtch = runeItem.slug?.toLowerCase().trim();

            if (targetSlotKey === "potency") {
                const potencyValueMatch = runeSlugToEtch?.match(/-(?:potency-)?(\d)$/);
                if (potencyValueMatch && potencyValueMatch[1]) {
                    updatePayload[`system.runes.potency`] = parseInt(potencyValueMatch[1]);
                } else {
                    etchSuccessful = false;
                    outcomeMessage = `Error: Could not parse potency level from ${runeSlugToEtch}.`;
                    console.error(`${MODULE_ID} | Error parsing potency level from rune slug '${runeSlugToEtch}' during update.`);
                }
            } else if (targetSlotKey === "striking") {
                updatePayload[`system.runes.striking`] = KEBAB_TO_CAMEL_RUNE_SLUGS[runeSlugToEtch] || runeSlugToEtch;
            } else if (targetSlotKey === "resilient") {
                updatePayload[`system.runes.resilient`] = KEBAB_TO_CAMEL_RUNE_SLUGS[runeSlugToEtch] || runeSlugToEtch;
            } else if (targetSlotKey.startsWith("propertyRune")) {
                updatePayload[`system.runes.${targetSlotKey}`] = runeSlugToEtch;
            } else {
                etchSuccessful = false;
                outcomeMessage = "Error: Invalid rune slot key during update.";
                console.error(`${MODULE_ID} | Invalid targetSlotKey: ${targetSlotKey}`);
            }

            if (etchSuccessful && Object.keys(updatePayload).length > 0) {
                await baseItem.update(updatePayload);
                await runeItem.delete(); 
            } else if (etchSuccessful) {
                 outcomeMessage += " (However, an internal error occurred applying the update).";
                 etchSuccessful = false;
            }

        } else { // Failure or Critical Failure
            outcomeMessage = `<strong>${CONFIG.PF2E.degreeOfSuccessStrings[roll.degreeOfSuccess]}.</strong> You fail to etch ${runeItem.name}.`;
            if (roll.degreeOfSuccess === 0) { // Critical Failure
                outcomeMessage += " The rune is destroyed!";
                if (runeItem) await runeItem.delete();
            }
        }
        
        const chatMessageColor = etchSuccessful ? styles.successColor : styles.failureColor;

        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: actor }), // Explicitly use the actor passed to the function
            flavor: `<span style="color:${chatMessageColor};">Attempt to Etch ${runeItem.name} onto ${baseItem.name}</span>`,
            content: `${outcomeMessage}<hr>Rolled ${roll.total} vs DC ${dc} (${CONFIG.PF2E.degreeOfSuccessStrings[roll.degreeOfSuccess]})`,
            roll: roll.toJSON(), // Convert the Rolled<Check> object to a plain object for saving
            flags: { "pf2e.origin": { type: "skill", uuid: craftSkill.item?.uuid, slug: craftSkill.slug } }
        });
        return etchSuccessful;
    };
}