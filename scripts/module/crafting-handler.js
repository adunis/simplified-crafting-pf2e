import { MODULE_ID, SETTINGS } from "./constants.js";
import { getSetting, getParsedJsonSetting } from "./settings.js";

export class CraftingHandler {
  constructor(dcCalculator, utils) {
    this.dcCalculator = dcCalculator;
    this.utils = utils;
  }

  getStyles() {
    return {
      successColor: getSetting(SETTINGS.SUCCESS_COLOR),
      failureColor: getSetting(SETTINGS.FAILURE_COLOR),
      infoColor: getSetting(SETTINGS.INFO_COLOR),
      neutralColor: getSetting(SETTINGS.NEUTRAL_COLOR),
    };
  }

  getSounds() {
    return {
      craftingLoop: getSetting(SETTINGS.SOUND_CRAFTING_LOOP),
      success: getSetting(SETTINGS.SOUND_SUCCESS),
      failure: getSetting(SETTINGS.SOUND_FAILURE),
    };
  }

  calculateCraftingTime = (level, proficiencyRank) => {
    const levelThresholds = getParsedJsonSetting(
      SETTINGS.CRAFTING_TIME_LEVEL_THRESHOLDS,
      [0, 3, 6, 9, 12, 15, 18]
    );
    const baseValues = getParsedJsonSetting(
      SETTINGS.CRAFTING_TIME_BASE_VALUES,
      [10, 1, 1, 1, 2, 1, 3, 6]
    );
    const baseUnits = getParsedJsonSetting(SETTINGS.CRAFTING_TIME_BASE_UNITS, [
      "minute",
      "hour",
      "day",
      "week",
      "week",
      "month",
      "month",
      "month",
    ]);
    let thresholdIndex = levelThresholds.findIndex((t) => level <= t);
    if (thresholdIndex === -1) thresholdIndex = levelThresholds.length - 1;
    if (thresholdIndex < 0) thresholdIndex = 0;
    let baseTimeValue =
      baseValues[thresholdIndex] ?? baseValues[baseValues.length - 1];
    let baseTimeUnit =
      baseUnits[thresholdIndex] ?? baseUnits[baseUnits.length - 1];
    let multiplier = 1;
    switch (parseInt(proficiencyRank)) {
      case 0:
        multiplier = getSetting(SETTINGS.CRAFTING_TIME_MULT_UNTRAINED);
        break;
      case 1:
        multiplier = getSetting(SETTINGS.CRAFTING_TIME_MULT_TRAINED);
        break;
      case 2:
        multiplier = getSetting(SETTINGS.CRAFTING_TIME_MULT_EXPERT);
        break;
      case 3:
        multiplier = getSetting(SETTINGS.CRAFTING_TIME_MULT_MASTER);
        break;
      case 4:
        multiplier = getSetting(SETTINGS.CRAFTING_TIME_MULT_LEGENDARY);
        break;
    }
    if (typeof multiplier !== "number" || isNaN(multiplier)) multiplier = 1;
    let finalTimeValue = baseTimeValue * multiplier;
    const HOURS_PER_DAY = 8;
    const DAYS_PER_WEEK = 7;
    const WEEKS_PER_MONTH = 4;
    if (baseTimeUnit === "month" && finalTimeValue < 1 && finalTimeValue > 0) {
      finalTimeValue *= WEEKS_PER_MONTH;
      baseTimeUnit = "week";
    }
    if (baseTimeUnit === "week" && finalTimeValue < 1 && finalTimeValue > 0) {
      finalTimeValue *= DAYS_PER_WEEK;
      baseTimeUnit = "day";
    }
    if (baseTimeUnit === "day" && finalTimeValue < 1 && finalTimeValue > 0) {
      finalTimeValue *= HOURS_PER_DAY;
      baseTimeUnit = "hour";
    }
    if (baseTimeUnit === "hour" && finalTimeValue < 1 && finalTimeValue > 0) {
      finalTimeValue *= 60;
      baseTimeUnit = "minute";
    }
    if (finalTimeValue <= 0) finalTimeValue = 0.1;
    if (baseTimeUnit === "minute")
      finalTimeValue = Math.max(1, Math.round(finalTimeValue));
    else if (baseTimeUnit === "hour" || baseTimeUnit === "day") {
      finalTimeValue = Math.max(0.1, Math.round(finalTimeValue * 10) / 10);
      if (finalTimeValue === Math.floor(finalTimeValue))
        finalTimeValue = Math.floor(finalTimeValue);
    } else {
      finalTimeValue = Math.max(0.1, Math.round(finalTimeValue * 10) / 10);
      if (finalTimeValue === Math.floor(finalTimeValue))
        finalTimeValue = Math.floor(finalTimeValue);
    }
    const unitString = finalTimeValue === 1 ? baseTimeUnit : `${baseTimeUnit}s`;
    return `${finalTimeValue} ${unitString}`;
  };

  _calculateMaterialConsumptionDetails(materials, consumeFiftyPercentChance) {
    const consumptionDetails = [];
    let consumedCount = 0;
    let savedCount = 0;
    materials.forEach((m) => {
      let unitsToConsume = 0;
      if (consumeFiftyPercentChance) {
        for (let i = 0; i < m.quantity; i++) {
          if (Math.random() < 0.5) unitsToConsume++;
        }
      } else {
        unitsToConsume = m.quantity;
      }
      if (unitsToConsume > 0)
        consumptionDetails.push({
          id: m.id,
          name: m.name,
          quantityToConsume: unitsToConsume,
        });
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
    targetData,
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
    const costBasisPerItem = requiredValue;
    if (!craftSkill) {
      ui.notifications.error(
        `Crafting skill missing for ${actor.name}. Cannot craft.`
      );
      return;
    }
    try {
      let baseDC;
      const itemLevelForDC = Math.max(0, targetData.level);
      const craftingEntry = actor.system.crafting?.formulas?.find(
        (f) => f.uuid === targetItemUuid
      );
      let specificDCForCalc = targetData.dcFromSheet;
      if (
        !specificDCForCalc &&
        craftingEntry?.dc &&
        typeof craftingEntry.dc === "number" &&
        craftingEntry.dc > 0
      )
        specificDCForCalc = craftingEntry.dc;
      baseDC = this.dcCalculator.calculateDC(itemLevelForDC, {
        specificDC: specificDCForCalc,
        rarity: targetData.rarity,
        dcType: "crafting",
      });
      if (!baseDC || baseDC <= 0) {
        ui.notifications.error(
          `Could not determine valid Crafting DC for ${targetData.name}. Aborting.`
        );
        return;
      }
      roll = await craftSkill.roll({
        dc: { value: baseDC },
        extraRollOptions: [
          "action:craft",
          `item:level:${targetData.level}`,
          `item:rarity:${targetData.rarity}`,
        ],
        title: `Craft: ${targetData.name}`,
        flavor: `Using materials worth ${valueUsed.toFixed(
          2
        )} gp (Req Per Item: ${requiredValue.toFixed(2)} gp) for ${
          targetData.name
        }. DC ${baseDC}.`,
        skipDialog: false,
      });
      if (!roll) {
        ui.notifications.warn("Crafting roll cancelled.");
        return;
      }
      successDegree = roll.degreeOfSuccess;
      const rollOutcomeText = roll.outcome
        ? game.i18n.localize(`PF2E.Check.Result.Degree.Check.${roll.outcome}`)
        : `Degree ${successDegree}`;
      AudioHelper.play(
        {
          src: successDegree >= 2 ? sounds.success : sounds.failure,
          volume: 0.8,
          autoplay: true,
        },
        false
      );
      const token = actor.getActiveTokens()[0];
      if (token)
        canvas.interface.createScrollingText(
          token.center,
          successDegree >= 2 ? "Success!" : "Failure!",
          {
            anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
            fontSize: 28,
            fill:
              successDegree >= 2 ? styles.successColor : styles.failureColor,
            stroke: 0x000000,
            strokeThickness: 4,
            duration: 5000,
          }
        );
      if (sounds.craftingLoop)
        soundInstance = await AudioHelper.play(
          { src: sounds.craftingLoop, volume: 0.6, autoplay: true, loop: true },
          false
        );
      loadingIndicatorElement = document.createElement("div");
      loadingIndicatorElement.id = `crafting-loading-${foundry.utils.randomID()}`;
      Object.assign(loadingIndicatorElement.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: "rgba(0,0,0,0.75)",
        color: "white",
        padding: "20px 30px",
        borderRadius: "8px",
        zIndex: 10000,
        textAlign: "center",
        fontSize: "1.2em",
      });
      loadingIndicatorElement.innerHTML = `<div style="margin-bottom:10px;"><i class="fas fa-hammer fa-spin fa-fw fa-2x"></i></div><div id="crafting-progress-bar-container" style="width:200px;height:20px;background-color:#555;border-radius:5px;margin:0 auto 10px auto;border:1px solid #777;overflow:hidden;"><div id="crafting-progress-bar" style="width:0%;height:100%;background-color:#4CAF50;transition:width 0.1s linear;"></div></div><div id="crafting-progress-text" style="font-size:0.9em;">Forging ${targetData.name}...</div>`;
      document.body.appendChild(loadingIndicatorElement);
      const progressBar = loadingIndicatorElement.querySelector(
        "#crafting-progress-bar"
      );
      const progressText = loadingIndicatorElement.querySelector(
        "#crafting-progress-text"
      );
      let quantityCrafted = 0;
      let consumeFiftyPercentChance = false;
      if (successDegree === 3) {
        chatMessageColor = styles.successColor;
        quantityCrafted = Math.max(
          1,
          costBasisPerItem > 0 ? Math.floor(valueUsed / costBasisPerItem) : 1
        );
        outcomeMessage = `<strong>Critical Success!</strong> Crafted ${quantityCrafted}x ${targetData.name}.`;
        consumeFiftyPercentChance = true;
      } else if (successDegree === 2) {
        chatMessageColor = styles.successColor;
        quantityCrafted = Math.max(
          1,
          costBasisPerItem > 0 ? Math.floor(valueUsed / costBasisPerItem) : 1
        );
        outcomeMessage = `<strong>Success!</strong> Crafted ${quantityCrafted}x ${targetData.name}.`;
        consumeFiftyPercentChance = false;
      } else if (successDegree === 1) {
        chatMessageColor = styles.failureColor;
        outcomeMessage = `<strong>Failure.</strong> No items crafted.`;
        consumeFiftyPercentChance = true;
      } else {
        chatMessageColor = styles.failureColor;
        outcomeMessage = `<strong>Critical Failure!</strong> All materials ruined.`;
        consumeFiftyPercentChance = false;
      }
      const { consumptionDetails, totalUnitsConsumed, totalUnitsSaved } =
        this._calculateMaterialConsumptionDetails(
          materialsUsed,
          consumeFiftyPercentChance
        );
      if (consumptionDetails.length > 0) {
        const materialUpdates = [],
          materialDeletions = [];
        for (const detail of consumptionDetails) {
          const item = actor.items.get(detail.id);
          if (!item) continue;
          const currentQty = item.system.quantity ?? 1;
          if (currentQty > detail.quantityToConsume)
            materialUpdates.push({
              _id: detail.id,
              "system.quantity": currentQty - detail.quantityToConsume,
            });
          else materialDeletions.push(detail.id);
        }
        if (materialUpdates.length > 0)
          await actor.updateEmbeddedDocuments("Item", materialUpdates);
        if (materialDeletions.length > 0)
          await actor.deleteEmbeddedDocuments("Item", materialDeletions);
      }
      outcomeMessage += `\nTime: ${timeStringPerItem}.`;
      outcomeMessage += `\nMaterials: ${
        totalUnitsConsumed > 0
          ? `Consumed/Ruined ${totalUnitsConsumed} unit(s).`
          : "No units consumed."
      }${totalUnitsSaved > 0 ? ` Kept/Saved ${totalUnitsSaved} unit(s).` : ""}`;
      let tempCreatedDoc = null;
      let finalCraftedName = "";
      if (quantityCrafted > 0) {
        if (!targetItemUuid)
          outcomeMessage += `\n<strong style="color:red;">Error: Missing target item UUID for creation!</strong>`;
        else {
          try {
            const sourceItem = await fromUuid(targetItemUuid);
            if (sourceItem?.isOfType("physical")) {
              const itemSource = sourceItem.toObject(false);
              delete itemSource._id;
              const baseNameFromFormula =
                targetData.name || sourceItem.name || "Crafted Item";
              const craftSuffix = `(Crafted by ${crafterName})`;
              finalCraftedName = baseNameFromFormula.endsWith(craftSuffix)
                ? baseNameFromFormula
                : `${baseNameFromFormula} ${craftSuffix}`;
              itemSource.name = finalCraftedName;
              itemSource.img = sourceItem.img || targetData.icon;
              const newSystemData = foundry.utils.deepClone(sourceItem.system);
              const materialListStringForDesc =
                materialsUsed
                  .map((m) => `${m.name} (x${m.quantity})`)
                  .join(", ") || "various materials";
              let gameDateTimeStringForDesc = new Date().toLocaleString();
              if (
                game.modules.get("foundryvtt-simple-calendar")?.active &&
                typeof SimpleCalendar !== "undefined" &&
                SimpleCalendar.api?.currentDateTime
              ) {
                try {
                  const scdt = SimpleCalendar.api.currentDateTime();
                  let fmt = SimpleCalendar.api.formatDateTime?.(
                    scdt,
                    "MMMM Do, YYYY, HH:mm"
                  );
                  if (!fmt || fmt.toLowerCase().includes("invalid")) {
                    const dsp = SimpleCalendar.api.currentDateTimeDisplay?.();
                    fmt =
                      dsp?.date && dsp?.time
                        ? `${dsp.date}, ${dsp.time}`
                        : new Date().toLocaleString();
                  }
                  gameDateTimeStringForDesc = fmt;
                } catch (e) {}
              }
              const craftInfoForDesc = `<hr><p><em>Item crafted by ${crafterName} on ${gameDateTimeStringForDesc} using: ${materialListStringForDesc}.</em></p>`;
              let existingDescription = newSystemData.description?.value || "";
              const craftedBySignature = `Item crafted by ${crafterName}`;
              if (
                existingDescription &&
                !existingDescription.includes(craftedBySignature)
              )
                existingDescription += craftInfoForDesc;
              else if (!existingDescription)
                existingDescription = craftInfoForDesc;
              newSystemData.description.value = existingDescription;
              itemSource.system = {
                ...newSystemData,
                quantity: quantityCrafted,
                identification: {
                  status: "identified",
                  identified: {
                    name: finalCraftedName,
                    img: itemSource.img,
                    data: {
                      description: {
                        value: newSystemData.description?.value || "",
                      },
                    },
                  },
                  unidentified: {
                    name: `Unidentified ${sourceItem.type || "Item"}`,
                    img: "icons/svg/mystery-man.svg",
                    data: {
                      description: {
                        value: "<p>This item has just been crafted.</p>",
                      },
                    },
                  },
                  misidentifiedData: null,
                },
              };
              const createdItemsArray = await actor.createEmbeddedDocuments(
                "Item",
                [itemSource]
              );
              if (createdItemsArray && createdItemsArray.length > 0)
                tempCreatedDoc = createdItemsArray[0];
              else
                outcomeMessage += `\n<strong style="color:red;">Error: Item creation returned no documents.</strong>`;
            } else
              outcomeMessage += `\n<strong style="color:red;">Error: Source item (UUID: ${targetItemUuid}) not physical/invalid.</strong>`;
          } catch (loadError) {
            outcomeMessage += `\n<strong style="color:red;">Error loading/creating source item ${targetItemUuid}: ${loadError.message}</strong>`;
          }
        }
      }
      let itemLinkForChat = "";
      const createdDocOnActor = tempCreatedDoc
        ? actor.items.get(tempCreatedDoc.id)
        : null;
      if (createdDocOnActor instanceof Item && createdDocOnActor.id) {
        const materialListString =
          materialsUsed.map((m) => `${m.name} (x${m.quantity})`).join(", ") ||
          "various materials";
        let gameDateTimeString = new Date().toLocaleString();
        if (
          game.modules.get("foundryvtt-simple-calendar")?.active &&
          typeof SimpleCalendar !== "undefined" &&
          SimpleCalendar.api?.currentDateTime
        ) {
          try {
            const scCurrentDateTime = SimpleCalendar.api.currentDateTime();
            let formatted = SimpleCalendar.api.formatDateTime?.(
              scCurrentDateTime,
              "MMMM Do, YYYY, HH:mm"
            );
            if (!formatted || formatted.toLowerCase().includes("invalid")) {
              const display = SimpleCalendar.api.currentDateTimeDisplay?.();
              formatted =
                display?.date && display?.time
                  ? `${display.date}, ${display.time}`
                  : new Date().toLocaleString();
            }
            gameDateTimeString = formatted;
          } catch (scError) {}
        }
        const craftInfoHtmlForFlag = `<hr><p><em>Item crafted by ${crafterName} on ${gameDateTimeString} using: ${materialListString}.</em></p>`;
        const updateDataForFlags = {
          [`flags.${MODULE_ID}.craftedTimestamp`]: Date.now(),
          [`flags.${MODULE_ID}.craftingInfo`]: craftInfoHtmlForFlag,
        };
        try {
          await createdDocOnActor.update(updateDataForFlags);
          await new Promise((resolve) => setTimeout(resolve, 150));
          const finalUpdatedItemOnActor = actor.items.get(createdDocOnActor.id);
          if (finalUpdatedItemOnActor) {
            itemLinkForChat = `@UUID[${finalUpdatedItemOnActor.uuid}]{${finalUpdatedItemOnActor.name}}`;
            if (actor.sheet?.rendered)
              actor.sheet.render(true, { focus: false });
          } else
            itemLinkForChat = `@UUID[${createdDocOnActor.uuid}]{${createdDocOnActor.name}} (Final Verification Failed)`;
        } catch (updateError) {
          outcomeMessage += `\n<strong style="color:red;">Error updating final item details (flags): ${updateError.message}</strong>`;
          itemLinkForChat = `@UUID[${createdDocOnActor.uuid}]{${createdDocOnActor.name}} (Final Update Exception)`;
        }
        if (itemLinkForChat) outcomeMessage += `\nCreated: ${itemLinkForChat}`;
      } else if (quantityCrafted > 0) {
        if (!outcomeMessage.includes("Error:"))
          outcomeMessage += `\n<strong style="color:red;">(Internal Error: Crafted item not found on actor for final modifications.)</strong>`;
      }
      let totalDurationMs = Math.max(1000, valueUsed * 50);
      if (quantityCrafted === 0) totalDurationMs = 1500;
      const startTime = performance.now();
      const animateProgress = (timestamp) => {
        const elapsedTime = timestamp - startTime;
        let progressPercentage = Math.min(
          100,
          (elapsedTime / totalDurationMs) * 100
        );
        if (!loadingIndicatorElement) return;
        if (progressBar) progressBar.style.width = `${progressPercentage}%`;
        if (elapsedTime < totalDurationMs)
          animationFrameId = requestAnimationFrame(animateProgress);
        else {
          if (progressBar) progressBar.style.width = "100%";
          if (progressText)
            progressText.innerHTML = `<i class="fas ${
              quantityCrafted > 0 ? "fa-check-circle" : "fa-times-circle"
            } fa-fw" style="color:${chatMessageColor};"></i> ${
              quantityCrafted > 0
                ? "Crafting Complete!"
                : successDegree === 0
                ? "Materials Ruined!"
                : "Process Failed."
            }`;
          setTimeout(
            () => {
              if (loadingIndicatorElement) {
                loadingIndicatorElement.remove();
                loadingIndicatorElement = null;
              }
              if (soundInstance) {
                soundInstance
                  .stop()
                  .catch(() => {})
                  .then(() => (soundInstance = null));
              }
              if (animationFrameId) cancelAnimationFrame(animationFrameId);
            },
            quantityCrafted > 0 ? 1500 : 1000
          );
        }
      };
      animationFrameId = requestAnimationFrame(animateProgress);
      await new Promise((resolve) =>
        setTimeout(resolve, totalDurationMs + 100)
      );
      const materialListDisplay =
        materialsUsed.length > 0
          ? materialsUsed.map((m) => `${m.name} x${m.quantity}`).join(", ")
          : "None selected";
      const targetItemDisplayLink = targetItemUuid
        ? `@UUID[${targetItemUuid}]{${targetData.name}}`
        : targetData.name;
      const finalChatMessage = `<div class="pf2e chat-card" style="padding:5px;border:2px solid ${chatMessageColor};border-radius:5px;font-size:14px;background-color:rgba(0,0,0,0.03);"><header class="card-header flexrow"><img src="${
        actor.img
      }" title="${
        actor.name
      }" width="36" height="36" style="border:none;margin-right:5px;"><img src="${
        targetData.icon
      }" title="${
        targetData.name
      }" width="36" height="36" style="border:none;margin-right:5px;"><h3 style="flex-grow:1;margin:0;line-height:36px;color:${chatMessageColor};">Craft: ${targetItemDisplayLink}</h3></header><div class="card-content" style="font-size:0.95em;"><p style="margin:2px 0;"><strong>Crafter:</strong> ${
        actor.name
      }</p><p style="margin:2px 0;"><strong>Materials Used (Value: ${valueUsed.toFixed(
        2
      )}gp / Req Per Item: ${requiredValue.toFixed(
        2
      )}gp):</strong> ${materialListDisplay}</p><p style="margin:2px 0;"><strong>Craft DC:</strong> ${
        baseDC ?? "?"
      }</p><p style="margin:2px 0;"><strong>Roll Result:</strong> ${
        roll?.total ?? "?"
      } vs DC ${baseDC ?? "?"} (<strong style="color:${chatMessageColor};">${
        rollOutcomeText || "No Roll"
      }</strong>)</p><hr style="margin:5px 0;"><p style="margin:2px 0;white-space:pre-wrap;">${outcomeMessage}</p><p style="font-size:0.9em;color:#555;margin-top:5px;"><em>GM Note: Verify material appropriateness & time. Base time/item: ${timeStringPerItem}.</em></p></div></div>`;
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: finalChatMessage,
        roll: roll.toJSON(),
        flags: {
          "pf2e.origin": {
            type: "skill",
            uuid: craftSkill?.item?.uuid,
            slug: craftSkill?.slug,
          },
          core: { canPopout: true },
        },
      });
    } catch (error) {
      ui.notifications.error(
        `A critical error occurred while crafting ${targetData.name}. Check console (F12).`
      );
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (loadingIndicatorElement) loadingIndicatorElement.remove();
      if (soundInstance) await soundInstance.stop().catch((e) => {});
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ alias: "System Error" }),
        content: `<b>${MODULE_ID} ERROR:</b> Critical error while ${crafterName} crafted ${targetData.name}. Error: ${error.message}.`,
        whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
      });
    } finally {
      if (animationFrameId && loadingIndicatorElement)
        cancelAnimationFrame(animationFrameId);
      if (loadingIndicatorElement) loadingIndicatorElement.remove();
      if (soundInstance) soundInstance.stop().catch(() => {});
    }
  };


  async _openMaterialSelectionDialog(actor, targetItem, dcFromSheet) {
    try {
      if (!targetItem || !(targetItem instanceof Item)) { ui.notifications.error(`Cannot craft: Invalid target item provided.`); return; }
      
      let itemFullPriceGP;
      const priceData = targetItem.price?.value;

      if (priceData && typeof priceData.totalGold === 'function') {
          itemFullPriceGP = priceData.totalGold();
      } else if (priceData && (typeof priceData.gp === 'number' || typeof priceData.sp === 'number' || typeof priceData.cp === 'number')) {
          itemFullPriceGP = (priceData.gp || 0) + (priceData.sp || 0) / 10 + (priceData.cp || 0) / 100;
      }

      if (typeof itemFullPriceGP !== 'number' || Number.isNaN(itemFullPriceGP) || itemFullPriceGP <= 0) {
          console.warn(`${MODULE_ID} | Invalid or zero price for target item ${targetItem.name} (UUID: ${targetItem.uuid}). Original price data:`, priceData, `Evaluated GP: ${itemFullPriceGP}. Defaulting to 0.01gp.`);
          ui.notifications.warn(`Invalid or zero price for ${targetItem.name}. Defaulting to 0.01gp for crafting calculation.`);
          itemFullPriceGP = 0.01;
      }
      
      const itemLevel = targetItem.level ?? 0; const craftSkill = actor.skills.crafting; const proficiencyRank = craftSkill?.rank ?? 0; 
      const finalTimeString = this.calculateCraftingTime(itemLevel, proficiencyRank); 
      const targetName = targetItem.name; const targetIcon = targetItem.img || "icons/svg/item-bag.svg"; const targetItemUuid = targetItem.uuid; const targetRarity = targetItem.rarity ?? "common";
      let magicDisclaimer = ""; const targetTraits = targetItem.system.traits?.value ?? [];
      if (targetTraits.includes("magical")) magicDisclaimer = `<div style="border: 1px solid orange; padding: 5px; margin: 5px 0; background-color: rgba(255, 165, 0, 0.1);"><strong style="color: orange;"><i class="fas fa-exclamation-triangle"></i> Magical Item Note:</strong><p style="margin: 2px 0 0 0; font-size: 0.9em;">Crafting <strong>${targetName}</strong> requires Magical Crafting & magical components. Half value from magical sources (GM discretion).</p></div>`;
      else if (targetTraits.includes("alchemical")) magicDisclaimer = `<div style="border: 1px solid olivedrab; padding: 5px; margin: 5px 0; background-color: rgba(107, 142, 35, 0.1);"><strong style="color: olivedrab;"><i class="fas fa-flask"></i> Alchemical Item Note:</strong><p style="margin: 2px 0 0 0; font-size: 0.9em;">Crafting <strong>${targetName}</strong> requires Alchemical Crafting.</p></div>`;
      const requiredValuePerItem = itemFullPriceGP / 2; const costBasisPerItemForQtyDisplay = requiredValuePerItem > 0 ? requiredValuePerItem : 0.005; 
      const itemTypesToConsider = [ "loot", "consumable", "equipment", "treasure", "weapon", "armor", "backpack" ];
      
      const inventoryMaterials = actor.items.filter(i => {
          if (!itemTypesToConsider.includes(i.type)) return false;
          if (!i.assetValue || typeof i.assetValue.goldValue !== 'number') return false; // Must have assetValue and numeric goldValue for the stack
          const quantity = i.system.quantity ?? 1;
          if (quantity <= 0) return false;
          const valuePerSingleUnit = i.assetValue.goldValue / quantity; // Calculate value per single unit
          return valuePerSingleUnit > 0; // Only consider if a single unit has some value
      }).sort((a, b) => a.name.localeCompare(b.name));
         
      let materialInputs = `<p style="text-align: center; color: #555;"><i>No suitable priced items in inventory.</i></p>`;
      if (inventoryMaterials.length > 0) {
        materialInputs = inventoryMaterials.map((item) => {
            const totalStackValueGP = item.assetValue.goldValue;
            const currentQuantityInStack = item.system.quantity ?? 1;
            const valuePerSingleUnit = currentQuantityInStack > 0 ? (totalStackValueGP / currentQuantityInStack) : 0;

            // Ensure valuePerSingleUnit is positive for display and data attribute
            const displayValuePerUnit = Math.max(0.0001, valuePerSingleUnit); 

            return `<div class="material-row form-group" style="display: flex; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 5px;" 
                         data-item-id="${item.id}" 
                         data-value-per-unit="${displayValuePerUnit.toFixed(4)}" 
                         data-max-qty="${currentQuantityInStack}" 
                         data-item-name="${item.name}">
                        <div class="item-info" style="flex: 2; display: flex; flex-direction: column; margin-right: 10px;">
                            <div style="display: flex; align-items: center; font-weight: bold; margin-bottom: 2px;">
                                <img src="${item.img}" style="height: 24px; width: 24px; margin-right: 5px; border: none; flex-shrink: 0; object-fit: contain;"/> 
                                ${item.name}
                            </div>
                            <div style="font-size: 0.85em; color: #006000; padding-left: 29px;">Value: ${displayValuePerUnit.toFixed(2)} gp/ea</div>
                            <div style="font-size: 0.85em; color: #666; padding-left: 29px;">Type: ${item.type}, Have: <span class="current-qty">${currentQuantityInStack}</span> </div>
                        </div>
                        <div class="item-input" style="flex: 1; text-align: right;">
                            <label style="display: block; font-size: 0.85em; margin-bottom: 2px;">Use Qty:</label>
                            <input type="number" class="material-quantity" name="${item.id}" value="0" min="0" max="${currentQuantityInStack}" step="1" style="width: 70px; height: 24px; text-align: center; border: 1px solid #ccc;" />
                        </div>
                    </div>`; 
        }).join("");
      }

      const finalTargetData = { name: targetName, icon: targetIcon, level: itemLevel, priceGP: itemFullPriceGP, rarity: targetRarity, targetItemUuid: targetItemUuid, dcFromSheet: dcFromSheet, timeString: finalTimeString };
      const dialogId = `material-selection-dialog-${foundry.utils.randomID(10)}`;
      const materialDialogContent = `<form id="${dialogId}-form"><div class="dialog-header" style="display: flex; align-items: center; border-bottom: 1px solid #999; padding-bottom: 10px; margin-bottom: 10px;"><img src="${finalTargetData.icon}" title="${finalTargetData.name}" style="height: 64px; width: 64px; margin-right: 15px; border: none; flex-shrink: 0; object-fit: contain;"/><h1 style="margin: 0; font-size: 1.8em; line-height: 1.2;">Crafting: ${finalTargetData.name} <span style="font-size: 0.7em; color: #555;">(Lvl ${itemLevel}, ${targetRarity})</span></h1></div>${magicDisclaimer}<p style="font-size: 0.9em;">Requires material value ≥ <strong>${requiredValuePerItem.toFixed(2)} gp</strong> (for one item).</p><p style="font-size: 0.9em;">Estimated Time: <strong>${finalTimeString}</strong> per Item.</p><fieldset style="border: 1px solid #ccc; margin-bottom: 10px; padding: 8px;"><legend style="font-weight: bold;">Available Materials</legend><div class="material-list" style="max-height: 300px; overflow-y: auto;"> ${materialInputs} </div></fieldset><div style="border-top: 1px solid #999; padding-top: 8px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;"><div style="font-weight: bold;">Total Value Provided: <strong class="total-value" style="color: red; font-size: 1.1em;">0.00 gp</strong></div><div style="font-size: 0.9em;">Potential Quantity Crafted: x<strong class="potential-items" style="color: #005000; font-weight: bold;">0</strong></div></div><p style="font-size: 0.8em; color: #555; margin-top: 5px;">Note: Actual material consumption depends on outcome. Potential quantity is based on success/crit success efficiency.</p></form><script>(function(dialogSpecificId, reqValuePerItem, costBasisForQtyDisplay) { const form = document.getElementById(\`\${dialogSpecificId}-form\`); if (!form) return; const ml = form.querySelector('.material-list'), vd = form.querySelector('.total-value'), id = form.querySelector('.potential-items'), cb = form.closest('.app.dialog')?.querySelector('.dialog-buttons button.craft-button'); const vi = i => {let cv=parseInt(i.value)||0,mn=parseInt(i.min)||0,mx=parseInt(i.max);if(cv<mn)cv=mn;if(!isNaN(mx)&&cv>mx)cv=mx;i.value=cv;return cv;}; const ut=()=>{let cur=0;if(!ml)return;ml.querySelectorAll('.material-row').forEach(r=>{const qi=r.querySelector('.material-quantity');if(!qi)return;const q=vi(qi),vp=parseFloat(r.dataset.valuePerUnit)||0;cur+=q*vp;});const mv=cur>=reqValuePerItem;if(vd){vd.textContent=cur.toFixed(2)+' gp';vd.style.color=mv?'green':'red';}if(cb)cb.disabled=!mv;if(id){let qty=(mv&&costBasisForQtyDisplay>0)?Math.floor(cur/costBasisForQtyDisplay):0;id.textContent=qty;}}; if(ml){ml.addEventListener('input',e=>{if(e.target.classList.contains('material-quantity'))ut();});ml.addEventListener('change',e=>{if(e.target.classList.contains('material-quantity'))ut();});} ut();})("${dialogId}", ${requiredValuePerItem}, ${costBasisPerItemForQtyDisplay});</script>`;
      new Dialog({ id: dialogId, title: `Select Materials: ${finalTargetData.name}`, content: materialDialogContent, buttons: { craft: { icon: '<i class="fas fa-hammer"></i>', label: `Attempt Craft`, classes: "craft-button", callback: async (html) => { const materialsToUse = []; let totalValueUsed = 0; const formElement = html.find(`#${dialogId}-form`)[0]; if (!formElement) { ui.notifications.error("Internal Error: Crafting form data missing."); return false; } $(formElement).find(".material-row").each((i, el) => { const $el = $(el); const itemId = $el.data("itemId"); const quantity = parseInt($el.find(".material-quantity").val()) || 0; if (quantity > 0 && itemId) { const valuePerUnit = parseFloat($el.data("valuePerUnit")) || 0; materialsToUse.push({ id: itemId, quantity: quantity, value: quantity * valuePerUnit, name: $el.data("itemName") || `Item ID ${itemId}`}); totalValueUsed += quantity * valuePerUnit; }}); if (totalValueUsed < requiredValuePerItem) { ui.notifications.warn(`Insufficient material value (${totalValueUsed.toFixed(2)}gp). Requires ${requiredValuePerItem.toFixed(2)}gp for one item.`); return false; } else await this._attemptCrafting(actor, finalTargetData.targetItemUuid, finalTargetData, materialsToUse, totalValueUsed, requiredValuePerItem ); }}, cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }}, default: "craft", render: (html) => { const cb = html.closest('.app.dialog')?.querySelector('.dialog-buttons button.craft-button'); const vde = html.find(".total-value"); let iv = 0; if (vde.length > 0) iv = parseFloat( (vde.text() || "0.00 gp").replace(" gp", "") ) || 0; if (cb) cb.disabled = iv < requiredValuePerItem; }}, { width: "600px" }).render(true);
    } catch (error) { console.error(`${MODULE_ID} | Error opening material selection dialog:`, error); ui.notifications.error( "An error occurred while preparing the material selection dialog. Check console (F12).");}
  }

}
