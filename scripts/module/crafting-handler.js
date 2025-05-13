import { MODULE_ID, SETTINGS } from "./constants.js";
import { getSetting, getParsedJsonSetting } from "./settings.js";

/**
 * Handles Crafting Actions, including Material Selection,
 * DC Calculation (via calculator), and Item Creation.
 */
export class CraftingHandler {
     /**
     * @param {DCCalculator} dcCalculator - Instance of the DCCalculator.
     * @param {Utils} utils - Instance of Utils (currently unused in this handler, but good practice).
     */
    constructor(dcCalculator, utils) {
        this.dcCalculator = dcCalculator;
        this.utils = utils; 
    }

    /** Gets Style-related settings */
     getStyles() {
        return {
            successColor: getSetting(SETTINGS.SUCCESS_COLOR),
            failureColor: getSetting(SETTINGS.FAILURE_COLOR),
            infoColor: getSetting(SETTINGS.INFO_COLOR),
            neutralColor: getSetting(SETTINGS.NEUTRAL_COLOR),
        };
    }
    
    /** Gets Sound-related settings */
    getSounds() {
        return {
            craftingLoop: getSetting(SETTINGS.SOUND_CRAFTING_LOOP),
            success: getSetting(SETTINGS.SOUND_SUCCESS),
            failure: getSetting(SETTINGS.SOUND_FAILURE),
        };
    }

    /**
     * Calculates the time required for crafting based on settings.
     * @param {number} level - The level of the item being crafted.
     * @param {number} proficiencyRank - The crafter's Crafting proficiency rank (0-4).
     * @returns {string} A formatted string representing the time (e.g., "1 Day").
     */
    calculateCraftingTime = (level, proficiencyRank) => {
        const levelThresholds = getParsedJsonSetting(SETTINGS.CRAFTING_TIME_LEVEL_THRESHOLDS, [0, 3, 6, 9, 12, 15, 18]);
        const baseValues = getParsedJsonSetting(SETTINGS.CRAFTING_TIME_BASE_VALUES, [10, 1, 1, 1, 2, 1, 3, 6]);
        const baseUnits = getParsedJsonSetting(SETTINGS.CRAFTING_TIME_BASE_UNITS, ["minute", "hour", "day", "week", "week", "month", "month", "month"]);

       // Find the index for the arrays based on the item level matching against the thresholds
        let thresholdIndex = levelThresholds.findIndex(t => level <= t);
        
        // If level is higher than all defined thresholds, use the values for the highest threshold
        if (thresholdIndex === -1) thresholdIndex = levelThresholds.length -1; // Use last valid index
        
        // Ensure index is valid, fallback to 0 if something went wrong
        if (thresholdIndex < 0) thresholdIndex = 0;

        let baseTimeValue = baseValues[thresholdIndex] ?? baseValues[baseValues.length -1];
        let baseTimeUnit = baseUnits[thresholdIndex] ?? baseUnits[baseUnits.length -1];
       
        let multiplier = 1; // Default multiplier
        switch (parseInt(proficiencyRank)) { // Ensure rank is number for switch
            case 0: multiplier = getSetting(SETTINGS.CRAFTING_TIME_MULT_UNTRAINED); break;
            case 1: multiplier = getSetting(SETTINGS.CRAFTING_TIME_MULT_TRAINED); break;
            case 2: multiplier = getSetting(SETTINGS.CRAFTING_TIME_MULT_EXPERT); break;
            case 3: multiplier = getSetting(SETTINGS.CRAFTING_TIME_MULT_MASTER); break;
            case 4: multiplier = getSetting(SETTINGS.CRAFTING_TIME_MULT_LEGENDARY); break;
        }
        if (typeof multiplier !== 'number') multiplier = 1; // Fallback if setting is weird

        let finalTimeValue = baseTimeValue * multiplier;

        // --- Convert to smaller units if multiplier made the value < 1 ---
        // Assuming 8-hour workday for Day -> Hour conversion. Could be made a setting.
        const HOURS_PER_DAY = 8; 
        const DAYS_PER_WEEK = 7;
        const WEEKS_PER_MONTH = 4; 
        
        if (baseTimeUnit === "month" && finalTimeValue < 1) { finalTimeValue *= WEEKS_PER_MONTH; baseTimeUnit = "week"; }
        if (baseTimeUnit === "week" && finalTimeValue < 1) { finalTimeValue *= DAYS_PER_WEEK; baseTimeUnit = "day"; }
        if (baseTimeUnit === "day" && finalTimeValue < 1) { finalTimeValue *= HOURS_PER_DAY; baseTimeUnit = "hour"; } 
        if (baseTimeUnit === "hour" && finalTimeValue < 1) { finalTimeValue *= 60; baseTimeUnit = "minute"; }

        // --- Rounding ---
        if (baseTimeUnit === "minute") {
             finalTimeValue = Math.max(1, Math.round(finalTimeValue)); // Minutes are whole
        }
        else if (baseTimeUnit === "hour" || baseTimeUnit === "day") {
             // Allow tenths for hours/days, but show as whole if it is whole.
            finalTimeValue = Math.max(1, Math.round(finalTimeValue * 10) / 10); 
             if (finalTimeValue === Math.floor(finalTimeValue)) finalTimeValue = Math.floor(finalTimeValue);
        } 
        else {
             finalTimeValue = Math.max(1, Math.round(finalTimeValue)); // Weeks/Months are whole
        }
        
        const unitString = finalTimeValue === 1 ? baseTimeUnit : `${baseTimeUnit}s`;
        return `${finalTimeValue} ${unitString}`;
    }

   _calculateMaterialConsumptionDetails(materials, consumeFiftyPercentChance) {
    const consumptionDetails = [];
    let consumedCount = 0;
    let savedCount = 0;

    materials.forEach((m) => {
      let unitsToConsume = 0;
      if (consumeFiftyPercentChance) {
        // 50% chance to consume each unit
        for (let i = 0; i < m.quantity; i++) {
          if (Math.random() < 0.5) unitsToConsume++;
        }
      } else {
         // Consume all units
        unitsToConsume = m.quantity;
      }

      if (unitsToConsume > 0) {
        consumptionDetails.push({
          id: m.id,
          name: m.name,
          quantityToConsume: unitsToConsume,
        });
      }
      consumedCount += unitsToConsume;
      savedCount += m.quantity - unitsToConsume;
    });

    return {
      consumptionDetails,
      totalUnitsConsumed: consumedCount,
      totalUnitsSaved: savedCount,
    };
  }


    _attemptCrafting = async (
        actor,
        targetItemUuid,
        targetData, // Contains name, icon, level, priceGP, dcFromSheet, timeString
        materialsUsed,
        valueUsed,
        requiredValue
    ) => {
        let roll = null;
        let successDegree = -1;
        let outcomeMessage = "";
        let soundInstance = null;
        let loadingIndicatorElement = null;
        let animationFrameId = null;

        const styles = this.getStyles();
        const sounds = this.getSounds();
        const crafterName = actor.name || "Unknown Crafter";
        const craftSkill = actor.skills.crafting;
        const timeStringPerItem = targetData.timeString;
        let chatMessageColor = styles.neutralColor || "#191813";

        if (!craftSkill) {
            ui.notifications.error(`Crafting skill missing for ${actor.name}. Cannot craft.`);
            return;
        }

        console.log(`${MODULE_ID} | Crafting: Attempting to craft ${targetData.name} by ${crafterName}.`);

        try {
            // --- DC Calculation ---
            let baseDC;
            const itemLevelForDC = Math.max(0, targetData.level);
            const craftingEntry = actor.system.crafting?.formulas?.find(f => f.uuid === targetItemUuid);
            let specificDCForCalc = targetData.dcFromSheet;
            if (!specificDCForCalc && craftingEntry?.dc && typeof craftingEntry.dc === 'number' && craftingEntry.dc > 0) {
                specificDCForCalc = craftingEntry.dc;
            }
            baseDC = this.dcCalculator.calculateDC(itemLevelForDC, { specificDC: specificDCForCalc, dcType: "crafting" });

            if (!baseDC || baseDC <= 0) {
                ui.notifications.error(`Could not determine valid Crafting DC for ${targetData.name}. Aborting.`);
                return;
            }

            // --- Roll ---
            roll = await craftSkill.roll({
                dc: { value: baseDC },
                extraRollOptions: ["action:craft", `item:level:${targetData.level}`],
                title: `Craft: ${targetData.name}`,
                flavor: `Using materials worth ${valueUsed.toFixed(2)} gp (Req: ${requiredValue.toFixed(2)} gp) for ${targetData.name}. DC ${baseDC}.`,
                skipDialog: false,
            });

            if (!roll) { ui.notifications.warn("Crafting roll cancelled."); return; }
            successDegree = roll.degreeOfSuccess;
            const rollOutcomeText = roll.outcome ? game.i18n.localize(`PF2E.Check.Result.Degree.Check.${roll.outcome}`) : `Degree ${successDegree}`;

            // --- Sound & Animation (Scrolling Text) ---
            AudioHelper.play({ src: (successDegree >= 2 ? sounds.success : sounds.failure), volume: 0.8, autoplay: true }, false);
            const token = actor.getActiveTokens()[0];
            if (token) {
                canvas.interface.createScrollingText(token.center, (successDegree >= 2 ? "Success!" : "Failure!"), {
                    anchor: CONST.TEXT_ANCHOR_POINTS.CENTER, fontSize: 28, fill: (successDegree >= 2 ? styles.successColor : styles.failureColor),
                    stroke: 0x000000, strokeThickness: 4, duration: 5000,
                });
            }

            // --- Progress Bar & Loop Sound ---
            if (sounds.craftingLoop) {
                soundInstance = await AudioHelper.play({ src: sounds.craftingLoop, volume: 0.6, autoplay: true, loop: true }, false);
            }
            // ... (loadingIndicatorElement creation and setup - same as before)
            loadingIndicatorElement = document.createElement("div");
            loadingIndicatorElement.id = `crafting-loading-${foundry.utils.randomID()}`;
            Object.assign(loadingIndicatorElement.style, { /* ... styles ... */ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", backgroundColor: "rgba(0,0,0,0.75)", color: "white", padding: "20px 30px", borderRadius: "8px", zIndex: 10000, textAlign: "center", fontSize: "1.2em" });
            loadingIndicatorElement.innerHTML = `<div style="margin-bottom:10px;"><i class="fas fa-hammer fa-spin fa-fw fa-2x"></i></div><div id="crafting-progress-bar-container" style="width:200px;height:20px;background-color:#555;border-radius:5px;margin:0 auto 10px auto;border:1px solid #777;overflow:hidden;"><div id="crafting-progress-bar" style="width:0%;height:100%;background-color:#4CAF50;transition:width 0.1s linear;"></div></div><div id="crafting-progress-text" style="font-size:0.9em;">Forging ${targetData.name}...</div>`;
            document.body.appendChild(loadingIndicatorElement);
            const progressBar = loadingIndicatorElement.querySelector("#crafting-progress-bar");
            const progressText = loadingIndicatorElement.querySelector("#crafting-progress-text");


            // --- Outcome, Quantity, Material Consumption ---
            let quantityCrafted = 0;
            let consumeFiftyPercentChance = false;
            if (successDegree === 3) {
                chatMessageColor = styles.successColor;
                quantityCrafted = Math.max(1, targetData.priceGP > 0 ? Math.floor(valueUsed / (targetData.priceGP / 2)) : 1);
                outcomeMessage = `<strong>Critical Success!</strong> Crafted ${quantityCrafted}x ${targetData.name}.`;
                consumeFiftyPercentChance = true;
            } else if (successDegree === 2) {
                chatMessageColor = styles.successColor;
                quantityCrafted = Math.max(1, targetData.priceGP > 0 ? Math.floor(valueUsed / targetData.priceGP) : 1);
                outcomeMessage = `<strong>Success!</strong> Crafted ${quantityCrafted}x ${targetData.name}.`;
                consumeFiftyPercentChance = false;
            } else if (successDegree === 1) {
                chatMessageColor = styles.failureColor;
                outcomeMessage = `<strong>Failure.</strong> No items crafted.`;
                consumeFiftyPercentChance = true;
            } else { // Crit Failure
                chatMessageColor = styles.failureColor;
                outcomeMessage = `<strong>Critical Failure!</strong> All materials ruined.`;
                consumeFiftyPercentChance = false;
            }

            const { consumptionDetails, totalUnitsConsumed, totalUnitsSaved } =
                this._calculateMaterialConsumptionDetails(materialsUsed, consumeFiftyPercentChance);
            if (consumptionDetails.length > 0) {
                const materialUpdates = [], materialDeletions = [];
                for (const detail of consumptionDetails) {
                    const item = actor.items.get(detail.id);
                    if (!item) continue;
                    if ((item.system.quantity ?? 1) > detail.quantityToConsume) {
                        materialUpdates.push({ _id: detail.id, "system.quantity": (item.system.quantity ?? 1) - detail.quantityToConsume });
                    } else {
                        materialDeletions.push(detail.id);
                    }
                }
                if (materialUpdates.length > 0) await actor.updateEmbeddedDocuments("Item", materialUpdates);
                if (materialDeletions.length > 0) await actor.deleteEmbeddedDocuments("Item", materialDeletions);
            }
            outcomeMessage += `\nTime: ${timeStringPerItem}.`;
            outcomeMessage += `\nMaterials: ${totalUnitsConsumed > 0 ? `Consumed/Ruined ${totalUnitsConsumed} unit(s).` : "No units consumed."}${totalUnitsSaved > 0 ? ` Kept/Saved ${totalUnitsSaved} unit(s).` : ""}`;

            // --- Item Creation ---
            let tempCreatedDoc = null;
            let finalCraftedName = "";

            if (quantityCrafted > 0) {
                if (!targetItemUuid) {
                    outcomeMessage += `\n<strong style="color:red;">Error: Missing target item UUID for creation!</strong>`;
                    console.error(`${MODULE_ID} | Crafting: ITEM CREATION FAILED - Missing targetItemUuid.`);
                } else {
                    try {
                        const sourceItem = await fromUuid(targetItemUuid);
                        if (sourceItem?.isOfType("physical")) {
                            const itemSource = sourceItem.toObject(false);
                            delete itemSource._id;

                            const baseNameFromFormula = targetData.name || sourceItem.name || "Crafted Item";
                            const craftSuffix = `(Crafted by ${crafterName})`;
                            finalCraftedName = baseNameFromFormula.endsWith(craftSuffix) ? baseNameFromFormula : `${baseNameFromFormula} ${craftSuffix}`;
                            
                            itemSource.name = finalCraftedName;
                            itemSource.img = sourceItem.img || targetData.icon;
                            
                            const newSystemData = foundry.utils.deepClone(sourceItem.system);
                            itemSource.system = {
                                ...newSystemData,
                                quantity: quantityCrafted,
                                identification: {
                                    status: "identified",
                                    identified: { name: finalCraftedName, img: itemSource.img, data: { description: { value: newSystemData.description?.value || "" } } },
                                    unidentified: { name: `Unidentified ${sourceItem.type || "Item"}`, img: "icons/svg/mystery-man.svg", data: { description: { value: "<p>This item has just been crafted.</p>" } } },
                                    misidentifiedData: null
                                }
                            };
                            console.log(`${MODULE_ID} | Crafting: Prepared itemSource for creation:`, foundry.utils.deepClone(itemSource));
                            const createdItemsArray = await actor.createEmbeddedDocuments("Item", [itemSource]);
                            if (createdItemsArray && createdItemsArray.length > 0) {
                                tempCreatedDoc = createdItemsArray[0];
                                console.log(`${MODULE_ID} | Crafting: Item ${tempCreatedDoc.id} (${tempCreatedDoc.name}) created.`);
                            } else {
                                outcomeMessage += `\n<strong style="color:red;">Error: Item creation returned no documents.</strong>`;
                            }
                        } else {
                            outcomeMessage += `\n<strong style="color:red;">Error: Source item (UUID: ${targetItemUuid}) not physical/invalid.</strong>`;
                        }
                    } catch (loadError) {
                        outcomeMessage += `\n<strong style="color:red;">Error loading/creating source item ${targetItemUuid}: ${loadError.message}</strong>`;
                        console.error(`${MODULE_ID} | Crafting: ITEM CREATION FAILED for ${targetItemUuid}:`, loadError);
                    }
                }
            } else {
                console.log(`${MODULE_ID} | Crafting: Quantity to craft is 0. No item creation attempted.`);
            }

            // --- Post-Creation Update: STORE CRAFTING INFO IN FLAG ---
            let itemLinkForChat = "";
            const createdDocOnActor = tempCreatedDoc ? actor.items.get(tempCreatedDoc.id) : null;
            
            console.log(`${MODULE_ID} | Crafting: tempCreatedDoc:`, tempCreatedDoc ? tempCreatedDoc.id : "null");
            console.log(`${MODULE_ID} | Crafting: createdDocOnActor found:`, !!createdDocOnActor, createdDocOnActor ? createdDocOnActor.id : "not found");


            if (createdDocOnActor instanceof Item && createdDocOnActor.id) {
                const materialListString = materialsUsed.map((m) => `${m.name} (x${m.quantity})`).join(", ") || "various materials";
                let gameDateTimeString = new Date().toLocaleString();
                if (game.modules.get("foundryvtt-simple-calendar")?.active && typeof SimpleCalendar !== "undefined" && SimpleCalendar.api?.currentDateTime) {
                    try {
                        const scCurrentDateTime = SimpleCalendar.api.currentDateTime();
                        let formatted = SimpleCalendar.api.formatDateTime?.(scCurrentDateTime, "MMMM Do, YYYY, HH:mm");
                        if (!formatted || formatted.toLowerCase().includes("invalid")) {
                            const display = SimpleCalendar.api.currentDateTimeDisplay?.();
                            formatted = (display?.date && display?.time) ? `${display.date}, ${display.time}` : new Date().toLocaleString();
                        }
                        gameDateTimeString = formatted;
                    } catch (scError) { console.warn(`${MODULE_ID} | Crafting: Error formatting SimpleCalendar date:`, scError); }
                }

                const craftInfoHtml = `<hr><p><em>Item crafted by ${crafterName} on ${gameDateTimeString} using: ${materialListString}.</em></p>`;
                
                const updateData = {
                    [`flags.${MODULE_ID}.craftedTimestamp`]: Date.now(),
                    [`flags.${MODULE_ID}.craftingInfo`]: craftInfoHtml // Store info in a flag
                };

                console.log(`${MODULE_ID} | Crafting: Preparing to update item ${createdDocOnActor.name} (ID: ${createdDocOnActor.id}) with flags. Update Data:`, foundry.utils.deepClone(updateData));

                try {
                    await createdDocOnActor.update(updateData);
                    console.log(`${MODULE_ID} | Crafting: Item ${createdDocOnActor.id} flags update promise resolved.`);
                    await new Promise(resolve => setTimeout(resolve, 150)); // Short pause

                    const finalUpdatedItemOnActor = actor.items.get(createdDocOnActor.id); // Re-fetch
                    if (finalUpdatedItemOnActor) {
                        console.log(`${MODULE_ID} | Crafting: Fetched finalUpdatedItemOnActor. Name: ${finalUpdatedItemOnActor.name}`);
                        console.log(`${MODULE_ID} | Crafting: Original Description:`, JSON.stringify(finalUpdatedItemOnActor.system.description?.value));
                        console.log(`${MODULE_ID} | Crafting: Flag 'craftingInfo':`, finalUpdatedItemOnActor.getFlag(MODULE_ID, "craftingInfo"));
                        console.log(`${MODULE_ID} | Crafting: Flag 'craftedTimestamp':`, finalUpdatedItemOnActor.getFlag(MODULE_ID, "craftedTimestamp"));

                        itemLinkForChat = `@UUID[${finalUpdatedItemOnActor.uuid}]{${finalUpdatedItemOnActor.name}}`;
                        if (actor.sheet?.rendered) {
                            console.log(`${MODULE_ID} | Crafting: Forcing sheet refresh for actor ${actor.name}`);
                            actor.sheet.render(true, { focus: false });
                        }
                    } else {
                        console.error(`${MODULE_ID} | Crafting: Item ${createdDocOnActor.id} NOT FOUND on actor after flags update.`);
                        itemLinkForChat = `@UUID[${createdDocOnActor.uuid}]{${createdDocOnActor.name}} (Final Verification Failed)`;
                    }
                } catch (updateError) {
                    console.error(`${MODULE_ID} | Crafting: Error during item flags update for ${createdDocOnActor.name}:`, updateError);
                    outcomeMessage += `\n<strong style="color:red;">Error updating final item details: ${updateError.message}</strong>`;
                    itemLinkForChat = `@UUID[${createdDocOnActor.uuid}]{${createdDocOnActor.name}} (Final Update Exception)`;
                }
                if (itemLinkForChat) outcomeMessage += `\nCreated: ${itemLinkForChat}`;
            } else if (quantityCrafted > 0) {
                console.error(`${MODULE_ID} | Crafting: Item was meant to be created (qty: ${quantityCrafted}), but createdDocOnActor is not a valid item. tempCreatedDoc ID was: ${tempCreatedDoc?.id}`);
                if (!outcomeMessage.includes("Error:")) outcomeMessage += `\n<strong style="color:red;">(Internal Error: Crafted item not found on actor for final modifications.)</strong>`;
            }

            // --- Animate Progress Bar Completion ---
            let totalDurationMs = Math.max(1000, valueUsed * 50);
            if (quantityCrafted === 0) totalDurationMs = 1500;
            const startTime = performance.now();
            animationFrameId = requestAnimationFrame(function animateProgress(timestamp) {
                const elapsedTime = timestamp - startTime;
                let progressPercentage = Math.min(100, (elapsedTime / totalDurationMs) * 100);
                if (progressBar) progressBar.style.width = `${progressPercentage}%`;
                if (elapsedTime < totalDurationMs) {
                    animationFrameId = requestAnimationFrame(animateProgress);
                } else {
                    if (progressBar) progressBar.style.width = "100%";
                    if (progressText && loadingIndicatorElement) progressText.innerHTML = `<i class="fas ${quantityCrafted>0?'fa-check-circle':'fa-times-circle'} fa-fw" style="color:${chatMessageColor};"></i> ${quantityCrafted>0?'Crafting Complete!':(successDegree===0?'Materials Ruined!':'Process Failed.')}`;
                    setTimeout(() => {
                        if(loadingIndicatorElement)loadingIndicatorElement.remove(); loadingIndicatorElement=null;
                        if(soundInstance)soundInstance.stop().then(()=>(soundInstance=null));
                    }, quantityCrafted>0?1500:1000);
                }
            });
            await new Promise((resolve) => setTimeout(resolve, totalDurationMs + 100)); // Ensure animation has time


            // --- Chat Message ---
            const materialListDisplay = materialsUsed.length > 0 ? materialsUsed.map((m) => `${m.name} x${m.quantity}`).join(", ") : "None selected";
            const targetItemDisplayLink = targetItemUuid ? `@UUID[${targetItemUuid}]{${targetData.name}}` : targetData.name;
            const finalChatMessage = `
                <div class="pf2e chat-card" style="padding:5px;border:2px solid ${chatMessageColor};border-radius:5px;font-size:14px;background-color:rgba(0,0,0,0.03);">
                  <header class="card-header flexrow"><img src="${actor.img}" title="${actor.name}" width="36" height="36" style="border:none;margin-right:5px;"><img src="${targetData.icon}" title="${targetData.name}" width="36" height="36" style="border:none;margin-right:5px;"><h3 style="flex-grow:1;margin:0;line-height:36px;color:${chatMessageColor};">Craft: ${targetItemDisplayLink}</h3></header>
                  <div class="card-content" style="font-size:0.95em;">
                    <p style="margin:2px 0;"><strong>Crafter:</strong> ${actor.name}</p>
                    <p style="margin:2px 0;"><strong>Materials Used (Value: ${valueUsed.toFixed(2)}gp / Req: ${requiredValue.toFixed(2)}gp):</strong> ${materialListDisplay}</p>
                    <p style="margin:2px 0;"><strong>Craft DC:</strong> ${baseDC??"?"}</p>
                    <p style="margin:2px 0;"><strong>Roll Result:</strong> ${roll?.total??"?"} vs DC ${baseDC??"?"} (<strong style="color:${chatMessageColor};">${rollOutcomeText||"No Roll"}</strong>)</p>
                    <hr style="margin:5px 0;"><p style="margin:2px 0;white-space:pre-wrap;">${outcomeMessage}</p>
                    <p style="font-size:0.9em;color:#555;margin-top:5px;"><em>GM Note: Verify material appropriateness & time. Base time/item: ${timeStringPerItem}.</em></p>
                  </div></div>`;
            ChatMessage.create({
                user: game.user.id, speaker: ChatMessage.getSpeaker({actor:actor}), content: finalChatMessage,
                roll: roll.toJSON(), flags: {"pf2e.origin":{type:"skill",uuid:craftSkill?.item?.uuid,slug:craftSkill?.slug},core:{canPopout:true}},
            });

        } catch (error) {
            console.error(`${MODULE_ID} | CRITICAL CRAFTING ERROR for ${targetData.name}:`, error);
            ui.notifications.error(`A critical error occurred while crafting ${targetData.name}. Check console (F12).`);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (loadingIndicatorElement) loadingIndicatorElement.remove();
            if (soundInstance) await soundInstance.stop().catch(e => console.warn("Error stopping sound", e));
            ChatMessage.create({
                user: game.user.id, speaker: ChatMessage.getSpeaker({alias:"System Error"}),
                content: `<b>${MODULE_ID} ERROR:</b> Critical error while ${crafterName} crafted ${targetData.name}. Error: ${error.message}.`,
                whisper: ChatMessage.getWhisperRecipients("GM").map(u=>u.id),
            });
        } finally {
            if (animationFrameId && !loadingIndicatorElement) cancelAnimationFrame(animationFrameId);
        }
    }
    // _openMaterialSelectionDialog remains an arrow function and should be mostly fine.
    // Ensure it calls this._attemptCrafting correctly.
    _openMaterialSelectionDialog = async (actor, targetItem, dcFromSheet) => {
        try {
            if (!targetItem || !(targetItem instanceof Item)) { ui.notifications.error(`Cannot craft: Invalid target item.`); return; }
            const itemPriceData = targetItem.system?.price?.value;
            if (!itemPriceData) { ui.notifications.error(`Cannot craft ${targetItem.name}: No price defined.`); return; }

            const itemLevel = targetItem.level ?? 0;
            const itemPriceGP = (itemPriceData.gp || 0) + (itemPriceData.sp || 0) / 10 + (itemPriceData.cp || 0) / 100;
            const proficiencyRank = actor.skills.crafting?.rank ?? 0;
            const finalTimeString = this.calculateCraftingTime(itemLevel, proficiencyRank);
            const targetName = targetItem.name, targetIcon = targetItem.img || "icons/svg/item-bag.svg", targetItemUuid = targetItem.uuid;
            let magicDisclaimer = "";
            if (targetItem.system.traits?.value?.includes("magical")) {
                magicDisclaimer = `<div style="border:1px solid orange;padding:5px;margin:5px 0;background-color:rgba(255,165,0,0.1);"><strong style="color:orange;"><i class="fas fa-exclamation-triangle"></i> Magical Item Note:</strong><p style="margin:2px 0 0 0;font-size:0.9em;">Crafting <strong>${targetName}</strong> requires Magical Crafting feat & magical components. Ensure half value from magical sources (GM discretion).</p></div>`;
            } else if (targetItem.system.traits?.value?.includes("alchemical")) {
                magicDisclaimer = `<div style="border:1px solid olivedrab;padding:5px;margin:5px 0;background-color:rgba(107,142,35,0.1);"><strong style="color:olivedrab;"><i class="fas fa-flask"></i> Alchemical Item Note:</strong><p style="margin:2px 0 0 0;font-size:0.9em;">Crafting <strong>${targetName}</strong> requires Alchemical Crafting feat.</p></div>`;
            }
            const calcPriceGP = itemPriceGP <= 0 ? 0.01 : itemPriceGP;
            const requiredValue = calcPriceGP / 2;
            const itemTypesToConsider = ["loot","consumable","equipment","treasure","weapon","armor","backpack"];
            const inventoryMaterials = actor.items.filter(i=>(itemTypesToConsider.includes(i.type)&&i.system?.price?.value&&((i.system.price.value.gp||0)+(i.system.price.value.sp||0)/10+(i.system.price.value.cp||0)/100>0)&&(i.system.quantity??1)>0)).sort((a,b)=>a.name.localeCompare(b.name));
            let materialInputs = `<p style="text-align:center;color:#555;"><i>No suitable priced items in inventory.</i></p>`;
            if(inventoryMaterials.length>0){materialInputs=inventoryMaterials.map(item=>{const ip=item.system.price.value,vpu=(ip.gp||0)+(ip.sp||0)/10+(ip.cp||0)/100,cq=item.system.quantity??1;return`<div class="material-row form-group" style="display:flex;align-items:center;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:5px;" data-item-id="${item.id}" data-value-per-unit="${vpu.toFixed(4)}" data-max-qty="${cq}" data-item-name="${item.name}"><div class="item-info" style="flex:2;display:flex;flex-direction:column;margin-right:10px;"><div style="display:flex;align-items:center;font-weight:bold;margin-bottom:2px;"><img src="${item.img}" style="height:24px;width:24px;margin-right:5px;border:none;flex-shrink:0;object-fit:contain;"/>${item.name}</div><div style="font-size:0.85em;color:#006000;padding-left:29px;">Value: ${vpu.toFixed(2)} gp/ea</div><div style="font-size:0.85em;color:#666;padding-left:29px;">Type: ${item.type}, Have: <span class="current-qty">${cq}</span></div></div><div class="item-input" style="flex:1;text-align:right;"><label style="display:block;font-size:0.85em;margin-bottom:2px;">Use Qty:</label><input type="number" class="material-quantity" name="${item.id}" value="0" min="0" max="${cq}" step="1" style="width:70px;height:24px;text-align:center;border:1px solid #ccc;"/></div></div>`;}).join("");}
            const finalTargetData={name:targetName,icon:targetIcon,level:itemLevel,priceGP:calcPriceGP,targetItemUuid:targetItemUuid,dcFromSheet:dcFromSheet,timeString:finalTimeString};
            const dialogId=`material-selection-dialog-${foundry.utils.randomID(10)}`;
            const materialDialogContent=`<form id="${dialogId}-form"><div class="dialog-header" style="display:flex;align-items:center;border-bottom:1px solid #999;padding-bottom:10px;margin-bottom:10px;"><img src="${finalTargetData.icon}" title="${finalTargetData.name}" style="height:64px;width:64px;margin-right:15px;border:none;flex-shrink:0;object-fit:contain;"/><h1 style="margin:0;font-size:1.8em;line-height:1.2;">Crafting: ${finalTargetData.name} <span style="font-size:0.7em;color:#555;">(Lvl ${itemLevel})</span></h1></div>${magicDisclaimer}<p style="font-size:0.9em;">Requires material value ≥ <strong>${requiredValue.toFixed(2)} gp</strong>.</p><p style="font-size:0.9em;">Est. Time: <strong>${finalTimeString}</strong> per Item.</p><fieldset style="border:1px solid #ccc;margin-bottom:10px;padding:8px;"><legend style="font-weight:bold;">Available Materials</legend><div class="material-list" style="max-height:300px;overflow-y:auto;">${materialInputs}</div></fieldset><div style="border-top:1px solid #999;padding-top:8px;margin-top:10px;display:flex;justify-content:space-between;align-items:center;"><div style="font-weight:bold;">Total Value Provided: <strong class="total-value" style="color:red;font-size:1.1em;">0.00 gp</strong></div><div style="font-size:0.9em;">Potential Qty: x<strong class="potential-items" style="color:#005000;font-weight:bold;">0</strong></div></div><p style="font-size:0.8em;color:#555;margin-top:5px;">Note: Actual material consumption depends on crafting check outcome.</p></form><script>(function(dialogId,reqVal,pricePerItem){const f=document.getElementById(\`\${dialogId}-form\`);if(!f)return;const ml=f.querySelector('.material-list'),vd=f.querySelector('.total-value'),id=f.querySelector('.potential-items'),cb=f.closest('.app.dialog')?.querySelector('.dialog-buttons button.craft-button');const vi=i=>{let cv=parseInt(i.value)||0,min=parseInt(i.min)||0,max=parseInt(i.max);if(cv<min)cv=min;if(!isNaN(max)&&cv>max)cv=max;i.value=cv;return cv;};const ut=()=>{let cur=0;if(!ml)return;ml.querySelectorAll('.material-row').forEach(r=>{const qi=r.querySelector('.material-quantity');if(!qi)return;const q=vi(qi),vp=parseFloat(r.dataset.valuePerUnit)||0;cur+=q*vp;});if(vd){vd.textContent=cur.toFixed(2)+' gp';const mv=cur>=reqVal;vd.style.color=mv?'green':'red';if(cb)cb.disabled=!mv;}if(id){let qty=0;if(cur>=reqVal&&pricePerItem>0)qty=Math.floor(cur/pricePerItem);id.textContent=qty;}};if(ml){ml.addEventListener('input',e=>{if(e.target.classList.contains('material-quantity'))ut();});ml.addEventListener('change',e=>{if(e.target.classList.contains('material-quantity'))ut();});}ut();})(\"${dialogId}\",${requiredValue},${finalTargetData.priceGP});</script>`;
            new Dialog({id:dialogId,title:`Select Materials: ${finalTargetData.name}`,content:materialDialogContent,buttons:{craft:{icon:'<i class="fas fa-hammer"></i>',label:`Attempt Craft`,classes:"craft-button",callback:async(html)=>{const mused=[];let tvu=0;const fe=html.find(`#${dialogId}-form`)[0];if(!fe){ui.notifications.error("Crafting form data missing.");return!1;}$(fe).find(".material-row").each((i,el)=>{const $e=$(el),itemId=$e.data("itemId"),qty=parseInt($e.find(".material-quantity").val())||0;if(qty>0&&itemId){const vpu=parseFloat($e.data("valuePerUnit"))||0;mused.push({id:itemId,quantity:qty,value:qty*vpu,name:$e.data("itemName")||`Item ID ${itemId}`});tvu+=qty*vpu;}});if(tvu<requiredValue){ui.notifications.warn(`Insufficient value (${tvu.toFixed(2)}gp). Requires ${requiredValue.toFixed(2)}gp.`);return!1;}else{await this._attemptCrafting(actor,finalTargetData.targetItemUuid,finalTargetData,mused,tvu,requiredValue);}}},cancel:{icon:'<i class="fas fa-times"></i>',label:"Cancel"}},default:"craft",render:html=>{const cb=html.closest(".app.dialog")?.querySelector(".dialog-buttons button.craft-button"),vde=html.find(".total-value");let iv=0;if(vde.length>0)iv=parseFloat((vde.text()||"0.00 gp").replace(" gp",""))||0;if(cb)cb.disabled=iv<requiredValue;}},{width:"600px"}).render(!0);
        } catch (error) {
            console.error(`${MODULE_ID} | Error opening material selection dialog:`, error);
            ui.notifications.error("Error preparing material selection. Check console (F12).");
        }
    }

  async _openMaterialSelectionDialog(actor, targetItem, dcFromSheet) {
    try {
      if (!targetItem || !(targetItem instanceof Item)) {
        ui.notifications.error(`Cannot craft: Invalid target item provided.`);
        return;
      }
       const itemPriceData = targetItem.system?.price?.value;
       if (!itemPriceData) {
         ui.notifications.error(`Cannot craft ${targetItem.name}: Item has no price defined.`);
         return;
       }

      const itemLevel = targetItem.level ?? 0;
      const itemPriceGP = (itemPriceData.gp || 0) + (itemPriceData.sp || 0) / 10 + (itemPriceData.cp || 0) / 100;

      const craftSkill = actor.skills.crafting;
      const proficiencyRank = craftSkill?.rank ?? 0; // Use 0 if untrained, calculateCraftingTime will use multiplier
      
      // Use the refactored, settings-driven calculation
      const finalTimeString = this.calculateCraftingTime(itemLevel, proficiencyRank); 

      const targetName = targetItem.name;
      const targetIcon = targetItem.img || "icons/svg/item-bag.svg";
      const targetItemUuid = targetItem.uuid;

      let magicDisclaimer = "";
      if (targetItem.system.traits?.value?.includes("magical")) {
        // ... (magicDisclaimer HTML remains the same) ...
         magicDisclaimer = `
             <div style="border: 1px solid orange; padding: 5px; margin: 5px 0; background-color: rgba(255, 165, 0, 0.1);">
               <strong style="color: orange;"><i class="fas fa-exclamation-triangle"></i> Magical Item Note:</strong>
               <p style="margin: 2px 0 0 0; font-size: 0.9em;">
                   Crafting <strong>${targetName}</strong> requires the Magical Crafting feat and appropriate magical components. Ensure at least half the material value comes from magical sources (GM discretion).
                </p>
             </div>`;
      }
       else if (targetItem.system.traits?.value?.includes("alchemical")) {
         magicDisclaimer = `
             <div style="border: 1px solid olivedrab; padding: 5px; margin: 5px 0; background-color: rgba(107, 142, 35, 0.1);">
               <strong style="color: olivedrab;"><i class="fas fa-flask"></i> Alchemical Item Note:</strong>
               <p style="margin: 2px 0 0 0; font-size: 0.9em;">
                   Crafting <strong>${targetName}</strong> requires the Alchemical Crafting feat.
                </p>
             </div>`;
      }

      let calcPriceGP = itemPriceGP;
      if (calcPriceGP <= 0) { calcPriceGP = 0.01; } // Ensure price is not zero for division
      const requiredValue = calcPriceGP / 2;

       // ... (Filter inventoryMaterials - remains the same) ...
       const itemTypesToConsider = [ "loot", "consumable", "equipment", "treasure", "weapon", "armor", "backpack" ];
       const inventoryMaterials = actor.items
         .filter( i =>
             itemTypesToConsider.includes(i.type) &&
             i.system?.price?.value &&
             ((i.system.price.value.gp || 0) + (i.system.price.value.sp || 0) / 10 + (i.system.price.value.cp || 0) / 100 > 0) &&
             (i.system.quantity ?? 1) > 0
         ).sort((a, b) => a.name.localeCompare(b.name));
         
       // ... (Build materialInputs HTML - remains the same) ...
      let materialInputs = `<p style="text-align: center; color: #555;"><i>No suitable items found in inventory. Items must have a price and quantity > 0.</i></p>`;
       if (inventoryMaterials.length > 0) {
         materialInputs = inventoryMaterials.map((item) => {
            const itemPrice = item.system.price.value;
            const valuePerUnit = (itemPrice.gp || 0) + (itemPrice.sp || 0) / 10 + (itemPrice.cp || 0) / 100;
            const currentQuantity = item.system.quantity ?? 1;
            return `
             <div class="material-row form-group" style="display: flex; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 5px;"
                  data-item-id="${item.id}" data-value-per-unit="${valuePerUnit.toFixed(4)}" data-max-qty="${currentQuantity}" data-item-name="${item.name}">
                 <div class="item-info" style="flex: 2; display: flex; flex-direction: column; margin-right: 10px;">
                     <div style="display: flex; align-items: center; font-weight: bold; margin-bottom: 2px;">
                        <img src="${item.img}" style="height: 24px; width: 24px; margin-right: 5px; border: none; flex-shrink: 0; object-fit: contain;"/>
                         ${item.name}
                     </div>
                     <div style="font-size: 0.85em; color: #006000; padding-left: 29px;">Value: ${valuePerUnit.toFixed(2)} gp/ea</div>
                     <div style="font-size: 0.85em; color: #666; padding-left: 29px;">Type: ${item.type}, Have: <span class="current-qty">${currentQuantity}</span> </div>
                 </div>
                 <div class="item-input" style="flex: 1; text-align: right;">
                    <label style="display: block; font-size: 0.85em; margin-bottom: 2px;">Use Qty:</label>
                    <input type="number" class="material-quantity" name="${item.id}" value="0" min="0" max="${currentQuantity}" step="1" style="width: 70px; height: 24px; text-align: center; border: 1px solid #ccc;" />
                 </div>
             </div>`;
           }).join("");
       }
      
      // Package data needed by _attemptCrafting
      const finalTargetData = {
        name: targetName,
        icon: targetIcon,
        level: itemLevel,
        priceGP: calcPriceGP,
        targetItemUuid: targetItemUuid,
        dcFromSheet: dcFromSheet, // Pass the DC from the sheet, if it existed
        timeString: finalTimeString, // Pass the calculated time string
      };

      const dialogId = `material-selection-dialog-${foundry.utils.randomID(10)}`;
       // ... (materialDialogContent HTML and Script remains the same) ...
       const materialDialogContent = `
          <form id="${dialogId}-form">
              <div class="dialog-header" style="display: flex; align-items: center; border-bottom: 1px solid #999; padding-bottom: 10px; margin-bottom: 10px;">
                 <img src="${finalTargetData.icon}" title="${finalTargetData.name}" style="height: 64px; width: 64px; margin-right: 15px; border: none; flex-shrink: 0; object-fit: contain;"/>
                 <h1 style="margin: 0; font-size: 1.8em; line-height: 1.2;">
                    Crafting: ${finalTargetData.name} <span style="font-size: 0.7em; color: #555;">(Lvl ${itemLevel})</span>
                 </h1>
              </div>
              ${magicDisclaimer}
              <p style="font-size: 0.9em;">Requires material value ≥ <strong>${requiredValue.toFixed(2)} gp</strong>.</p>
              <p style="font-size: 0.9em;">Estimated Time: <strong>${finalTimeString}</strong> per Item. (Applies regardless of quantity crafted).</p>
              <fieldset style="border: 1px solid #ccc; margin-bottom: 10px; padding: 8px;">
                  <legend style="font-weight: bold;">Available Materials</legend>
                  <div class="material-list" style="max-height: 300px; overflow-y: auto;"> ${materialInputs} </div>
              </fieldset>
              <div style="border-top: 1px solid #999; padding-top: 8px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                  <div style="font-weight: bold;">Total Value Provided: <strong class="total-value" style="color: red; font-size: 1.1em;">0.00 gp</strong></div>
                  <div style="font-size: 0.9em;">Potential Quantity Crafted: x<strong class="potential-items" style="color: #005000; font-weight: bold;">0</strong></div>
              </div>
               <p style="font-size: 0.8em; color: #555; margin-top: 5px;">
                 Note: The *actual* quantity of materials consumed/ruined depends on the crafting check outcome.
               </p>
          </form>
           <script>
             (function(dialogSpecificId, reqValue, pricePerItem) {
                 const form = document.getElementById(\`\${dialogSpecificId}-form\`);
                 if (!form) { return; }
                 const materialList = form.querySelector('.material-list');
                 const valueDisplay = form.querySelector('.total-value');
                 const itemsDisplay = form.querySelector('.potential-items');
                 const craftButton = form.closest('.app.dialog')?.querySelector('.dialog-buttons button.craft-button');
                 const validateInput = (inputElement) => {
                     let currentVal = parseInt(inputElement.value) || 0;
                     const minVal = parseInt(inputElement.min) || 0;
                     const maxVal = parseInt(inputElement.max);
                     if (currentVal < minVal) currentVal = minVal;
                     if (!isNaN(maxVal) && currentVal > maxVal) currentVal = maxVal;
                     inputElement.value = currentVal;
                     return currentVal;
                 };
                 const updateTotal = () => {
                     let currentValue = 0;
                     if (!materialList) return;
                     materialList.querySelectorAll('.material-row').forEach(row => {
                         const qtyInput = row.querySelector('.material-quantity');
                         if (!qtyInput) return;
                         const qty = validateInput(qtyInput);
                         const valuePer = parseFloat(row.dataset.valuePerUnit) || 0;
                         currentValue += qty * valuePer;
                     });
                     if (valueDisplay) {
                         valueDisplay.textContent = currentValue.toFixed(2) + ' gp';
                         const meetsValue = currentValue >= reqValue;
                         valueDisplay.style.color = meetsValue ? 'green' : 'red';
                         if (craftButton) { craftButton.disabled = !meetsValue; }
                     }
                     if (itemsDisplay) {
                         let quantity = (currentValue >= reqValue && pricePerItem > 0) ? Math.floor(currentValue / pricePerItem) : 0;
                         itemsDisplay.textContent = quantity;
                     }
                 };
                  if (materialList) {
                     materialList.addEventListener('input', (event) => { if (event.target.classList.contains('material-quantity')) { updateTotal(); } });
                     materialList.addEventListener('change', (event) => { if (event.target.classList.contains('material-quantity')) { updateTotal(); } });
                  }
                 updateTotal(); // Initial call
             })("${dialogId}", ${requiredValue}, ${finalTargetData.priceGP});
           </script>`;
           // --- End Script ---

      new Dialog(
        {
          id: dialogId,
          title: `Select Materials: ${finalTargetData.name}`,
          content: materialDialogContent,
          buttons: {
            craft: {
              icon: '<i class="fas fa-hammer"></i>',
              label: `Attempt Craft`,
              classes: "craft-button",
              callback: async (html) => {
                 // ... (Callback logic to gather materials remains the same) ...
                 const materialsToUse = [];
                 let totalValueUsed = 0;
                 const formElement = html.find(`#${dialogId}-form`)[0];
                 if (!formElement) { ui.notifications.error("Internal Error: Crafting form data missing."); return false; }
                 
                 $(formElement).find(".material-row").each((i, el) => {
                     const $el = $(el);
                     const itemId = $el.data("itemId");
                     const quantity = parseInt($el.find(".material-quantity").val()) || 0;
                      if (quantity > 0 && itemId) {
                         const valuePerUnit = parseFloat($el.data("valuePerUnit")) || 0;
                         materialsToUse.push({
                             id: itemId,
                             quantity: quantity,
                             value: quantity * valuePerUnit,
                             name: $el.data("itemName") || `Item ID ${itemId}`,
                         });
                         totalValueUsed += quantity * valuePerUnit;
                      }
                   });

                if (totalValueUsed < requiredValue) {
                   ui.notifications.warn(`Insufficient material value (${totalValueUsed.toFixed(2)}gp). Requires ${requiredValue.toFixed(2)}gp.`);
                   return false; // Prevent dialog from closing
                } else {
                  // CALL THE REFACTORED METHOD
                  await this._attemptCrafting(
                    actor,
                    finalTargetData.targetItemUuid,
                    finalTargetData, // Contains all needed data including DC and Time
                    materialsToUse,
                    totalValueUsed,
                    requiredValue
                  );
                 }
              },
            },
             cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" },
          },
          default: "craft",
           render: (html) => { // Ensure button disabled state is set correctly on render
             const craftButton = html.closest('.app.dialog')?.querySelector('.dialog-buttons button.craft-button');
             const valueDisplayElement = html.find(".total-value");
              let initialValue = 0;
             if (valueDisplayElement.length > 0) {
                 initialValue = parseFloat( (valueDisplayElement.text() || "0.00 gp").replace(" gp", "") ) || 0;
             }
             if (craftButton) {
                 craftButton.disabled = initialValue < requiredValue;
              }
           },
        },
         { width: "600px" }
      ).render(true);
      
    } catch (error) {
       console.error(`${MODULE_ID} | Error opening material selection dialog:`, error);
      ui.notifications.error(
        "An error occurred while preparing the material selection dialog. Check console (F12)."
      );
    }
  }
}