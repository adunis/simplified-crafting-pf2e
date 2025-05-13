import { MODULE_ID, SETTINGS } from "./constants.js";
import { getSetting } from "./settings.js";

export class ReverseEngineeringHandler {
    constructor(dcCalculator) {
        this.dcCalculator = dcCalculator;
        console.log(`${MODULE_ID} | ReverseEngineeringHandler constructed.`);
    }

    getSounds = () => ({
        reverseEngineerStart: getSetting(SETTINGS.SOUND_REVERSE_ENGINEER_START),
        success: getSetting(SETTINGS.SOUND_SUCCESS),
        failure: getSetting(SETTINGS.SOUND_FAILURE),
    });

    getStyles = () => ({
        successColor: getSetting(SETTINGS.SUCCESS_COLOR),
        failureColor: getSetting(SETTINGS.FAILURE_COLOR),
        infoColor: getSetting(SETTINGS.INFO_COLOR),
        neutralColor: getSetting(SETTINGS.NEUTRAL_COLOR),
    });

    _calculateReverseEngineeringDC = (item) => {
        let dc = item.system.crafting?.requirements?.dc;
        return this.dcCalculator.calculateDC(item.level ?? 0, {
            rarity: item.rarity ?? "common",
            specificDC: (dc && typeof dc === 'number' && dc > 0) ? dc : null,
            dcType: "reverseEngineering"
        });
    }

    handleReverseEngineering = (actor) => {
        if (!actor) {
            ui.notifications.error("RE Error: Actor not found.");
            return;
        }

        const knownFormulaUUIDs = new Set(actor.system.crafting?.formulas?.map((f) => f.uuid) ?? []);
        const potentialItems = actor.items
            .filter((item) => {
                const isCorrectType = item.isOfType("weapon", "armor", "equipment", "consumable", "treasure");
                const hasSource = !!item.sourceId;
                const isNotFormula = !item.isOfType("formula");
                const isNotArtifact = !item.system.traits?.value?.includes("artifact");
                const isNotKnown = hasSource && !knownFormulaUUIDs.has(item.sourceId);
                const isOwned = item.actor === actor;
                return isCorrectType && hasSource && isNotFormula && isNotArtifact && isNotKnown && isOwned;
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        if (potentialItems.length === 0) {
            ui.notifications.info(`No suitable items found for ${actor.name} to Reverse Engineer.`);
            return;
        }

        let optionsHtml = potentialItems
            .map((item) => `<option value="${item.id}" title="${item.name} (Lvl ${item.level ?? "?"}, ${item.rarity || "common"})">${item.name} (Lvl ${item.level ?? "?"})</option>`)
            .join("");

        let dialogContent = `
            <form>
                <div class="form-group">
                    <label>Select Item to Disassemble:</label>
                    <select name="itemId" style="width: 100%;">
                        <option value="">-- Select an Item --</option>
                        ${optionsHtml}
                    </select>
                </div>
                <p style="font-size: 0.9em; color: #555; margin-top: 10px;">
                    <i class="fas fa-info-circle"></i> Attempting Reverse Engineering destroys the item on Failure, Success, or Critical Failure. On a Critical Success, the item is <strong style="color: ${this.getStyles().successColor};">not</strong> destroyed. Success grants the crafting formula if one exists and isn't already known.
                </p>
            </form>`;

        new Dialog({
            title: `Reverse Engineer: ${actor.name}`,
            content: dialogContent,
            buttons: {
                engineer: {
                    label: "Attempt",
                    icon: '<i class="fas fa-wrench"></i>',
                    callback: async (html) => {
                        const form = html.find("form")[0];
                        if (!form) return;
                        const formData = new FormData(form);
                        const selectedItemId = formData.get("itemId");
                        if (!selectedItemId) { ui.notifications.warn("No item selected for RE."); return; }
                        const itemToDestroy = actor.items.get(selectedItemId);
                        if (!itemToDestroy) { ui.notifications.error(`Selected item for RE not found on actor.`); return; }
                        await this._processReverseEngineeringAttempt(actor, itemToDestroy);
                    },
                },
                cancel: { label: "Cancel", icon: '<i class="fas fa-times"></i>', callback: () => ui.notifications.info("RE attempt cancelled.") },
            },
            default: "engineer",
            render: (html) => html.find('select[name="itemId"]').focus(),
        }, { width: 450 }).render(true);
    }

    _processReverseEngineeringAttempt = async (actor, itemToDestroy) => {
        const sounds = this.getSounds();
        const styles = this.getStyles();
        let outcomeColor = styles.neutralColor || "#191813";
        let anErrorOccurredInTryBlock = false;

        console.log(`${MODULE_ID} | RE Process: Starting for item '${itemToDestroy.name}' (ID: ${itemToDestroy.id}) on actor '${actor.name}'.`);

        const dc = this._calculateReverseEngineeringDC(itemToDestroy);
        if (dc === null || dc <= 0) {
            ui.notifications.error(`Could not determine valid DC for ${itemToDestroy.name}. RE cancelled.`);
            return;
        }
        const statistic = actor.skills.crafting;
        if (!statistic) {
            ui.notifications.error(`${actor.name} lacks Crafting skill. Cannot RE.`);
            return;
        }

        const rollArgs = {
            dc: { value: dc }, item: itemToDestroy, title: `Reverse Engineer: ${itemToDestroy.name}`,
            info: `Attempting to learn formula (Crafting DC ${dc})`,
            extraRollOptions: ["action:reverse-engineer", `item:id:${itemToDestroy.id}`, `item:slug:${itemToDestroy.slug}`],
            rollMode: CONST.DICE_ROLL_MODES.PUBLIC,
        };

const rollResult = await statistic.roll(rollArgs);
        if (!rollResult) {
            ui.notifications.warn("RE roll cancelled.");
            return;
        }

// ---- DEFINE roll-dependent variables HERE ----
const degreeOfSuccess = rollResult.degreeOfSuccess;
const rollTotal = rollResult.total; // <<<< CORRECT PLACEMENT
const rollOutcomeText = rollResult.outcome 
    ? game.i18n.localize(`PF2E.Check.Result.Degree.Check.${rollResult.outcome}`) 
    : `Degree ${degreeOfSuccess}`; // <<<< CORRECT PLACEMENT
// ---- END variable definition ----
let chatFlavor = `...`;

let notificationType = "info";
        let notificationMessage = "";
        let soundToPlay = null;

        if (degreeOfSuccess >= 2) {
            soundToPlay = sounds.success;
            outcomeColor = styles.successColor;
        } else {
            soundToPlay = sounds.failure;
            outcomeColor = styles.failureColor;
        }

        if (soundToPlay) {
            try { AudioHelper.play({ src: soundToPlay, volume: 0.8, autoplay: true }, false); }
            catch (soundError) { console.warn(`${MODULE_ID} | Error playing RE outcome sound:`, soundError); }
        }

        try { // For scrolling text animation
            const token = actor.getActiveTokens()[0];
            if (token) {
                const animText = degreeOfSuccess >= 2 ? "Success!" : "Failure!";
                const animColor = degreeOfSuccess >= 2 ? styles.successColor : styles.failureColor;
                canvas.interface.createScrollingText(token.center, "Reverse Eng...", {
                    anchor: CONST.TEXT_ANCHOR_POINTS.CENTER, fontSize: 28, fill: animColor,
                    stroke: 0x000000, strokeThickness: 4, duration: 3500,
                });
            }
        } catch (animError) { console.warn(`${MODULE_ID} | Error creating RE scrolling text:`, animError); }

        try {
            console.log(`${MODULE_ID} | RE Process: Degree of Success: ${degreeOfSuccess} for item '${itemToDestroy.name}'.`);
            const sourceId = itemToDestroy.sourceId;
            let formulaLearnedThisAttempt = false; // More descriptive name
             chatFlavor += `<br>Roll: ${rollTotal} vs DC ${dc} (<strong style="color: ${outcomeColor};">${rollOutcomeText}</strong>)`;

            if (!sourceId || typeof sourceId !== "string" || !sourceId.startsWith("Compendium.")) {
                if (degreeOfSuccess >= 2) { // Only relevant if a formula *could* have been learned
                    chatFlavor += `<br><span style="color: orange;">${degreeOfSuccess === 3 ? "Critical Success" : "Success"}!</span> But item origin unclear. Cannot add formula.`;
                    notificationType = "warning";
                    notificationMessage = `${degreeOfSuccess === 3 ? "Crit Success" : "Success"}, but no formula for ${itemToDestroy.name}.`;
                    if (degreeOfSuccess === 3) {
                        chatFlavor += ` Item <strong>not</strong> destroyed.`;
                        notificationMessage += ` Item not destroyed.`;
                    } else {
                        chatFlavor += ` Item destroyed.`;
                        notificationMessage += ` Item destroyed.`;
                    }
                }
            } else {
                const existingFormulas = actor.system.crafting?.formulas ?? [];
                const alreadyKnown = existingFormulas.some(f => f.uuid === sourceId);

                if (alreadyKnown) {
                    chatFlavor += `<br><span style="color: darkcyan;">${degreeOfSuccess === 3 ? "Critical Success" : "Success"}!</span> Formula already known.`;
                    notificationType = "info";
                    notificationMessage = `${degreeOfSuccess === 3 ? "Crit Success" : "Success"}! Already knew formula for ${itemToDestroy.name}.`;
                    // formulaLearnedThisAttempt = true; // Not strictly new, but it is "learned"
                } else if (degreeOfSuccess >= 2) { // Crit Success or Success - and formula not already known
                    // WORKAROUND for potential PF2e data prep error:
                    const newFormulaEntry = {
                        uuid: sourceId,
                        system: { description: { value: "" } } // Minimal system object
                    };
                    // If you wanted to also store name/img from source for your own UI (PF2e doesn't store it here):
                    // const sourceItemDoc = await fromUuid(sourceId);
                    // if (sourceItemDoc) {
                    //     newFormulaEntry.name = sourceItemDoc.name;
                    //     newFormulaEntry.img = sourceItemDoc.img;
                    // }

                    const updatedFormulas = [...existingFormulas, newFormulaEntry];
                    updatedFormulas.sort((a, b) => {
                        const itemA = fromUuidSync(a.uuid);
                        const itemB = fromUuidSync(b.uuid);
                        return (itemA?.level ?? 99) - (itemB?.level ?? 99) || (itemA?.name ?? "").localeCompare(itemB?.name ?? "");
                    });
                    await actor.update({ "system.crafting.formulas": updatedFormulas });
                    chatFlavor += `<br><span style="color: green;">${degreeOfSuccess === 3 ? "Critical Success" : "Success"}!</span> Learned formula for @UUID[${sourceId}]{${itemToDestroy.name}}!`;
                    notificationType = "info";
                    notificationMessage = `Learned formula for ${itemToDestroy.name}!`;
                    formulaLearnedThisAttempt = true;
                }
            }

            // Handle item destruction and remaining messages
            if (degreeOfSuccess === 3) { // Crit Success
                if (formulaLearnedThisAttempt || (sourceId && existingFormulas.some(f => f.uuid === sourceId))) { // Learned it now or already knew
                     chatFlavor += ` Item <strong>not</strong> destroyed.`;
                     notificationMessage += ` Item not destroyed.`;
                } // If origin unclear, message already handled
            } else if (degreeOfSuccess === 2) { // Success
                if (formulaLearnedThisAttempt || (sourceId && existingFormulas.some(f => f.uuid === sourceId)) || (!sourceId && itemToDestroy.sourceId)) { // Handled all cases
                    chatFlavor += ` Item destroyed.`;
                    notificationMessage += ` Item destroyed.`;
                }
                console.log(`${MODULE_ID} | RE Process: PRE-DELETE (Success) for item '${itemToDestroy.name}' (ID: ${itemToDestroy.id})`);
                const deletedItem = await itemToDestroy.delete();
                console.log(`${MODULE_ID} | RE Process: POST-DELETE (Success). Result:`, deletedItem);
                if (!deletedItem) console.warn(`${MODULE_ID} | RE Process: delete() returned falsy on Success for ${itemToDestroy.name}.`);
            } else if (degreeOfSuccess === 1) { // Failure
                chatFlavor += `<br><span style="color: red;">Failure.</span> Failed to learn formula. Item destroyed.`;
                notificationType = "warning";
                notificationMessage = `Failed to learn formula for ${itemToDestroy.name}. Item destroyed.`;
                console.log(`${MODULE_ID} | RE Process: PRE-DELETE (Failure) for item '${itemToDestroy.name}' (ID: ${itemToDestroy.id})`);
                const deletedItem = await itemToDestroy.delete();
                console.log(`${MODULE_ID} | RE Process: POST-DELETE (Failure). Result:`, deletedItem);
                if (!deletedItem) console.warn(`${MODULE_ID} | RE Process: delete() returned falsy on Failure for ${itemToDestroy.name}.`);
            } else { // Crit Failure (degreeOfSuccess === 0)
                chatFlavor += `<br><span style="color: darkred;">Critical Failure!</span> Failed to learn formula. Item destroyed.`;
                notificationType = "warning";
                notificationMessage = `Critical Failure! Failed to learn formula for ${itemToDestroy.name}. Item destroyed.`;
                console.log(`${MODULE_ID} | RE Process: PRE-DELETE (Crit Fail) for item '${itemToDestroy.name}' (ID: ${itemToDestroy.id})`);
                const deletedItem = await itemToDestroy.delete();
                console.log(`${MODULE_ID} | RE Process: POST-DELETE (Crit Fail). Result:`, deletedItem);
                if (!deletedItem) console.warn(`${MODULE_ID} | RE Process: delete() returned falsy on Crit Fail for ${itemToDestroy.name}.`);
            }
        } catch (error) {
            anErrorOccurredInTryBlock = true;
            console.error(`${MODULE_ID} | RE Process: ERROR during outcome processing for "${itemToDestroy.name}":`, error);
            ui.notifications.error(`Error processing RE result for "${itemToDestroy.name}". Check console.`);
            chatFlavor += `<br><strong style="color:red;">Error processing result! Check console.</strong>`;
            notificationType = "error";
            notificationMessage = `Error processing RE result for ${itemToDestroy.name}. Details: ${error.message}`;
        } finally {
            if (anErrorOccurredInTryBlock && degreeOfSuccess < 3) { // If error and item should have been deleted
                console.warn(`${MODULE_ID} | RE Process: An error occurred. Item '${itemToDestroy.name}' might not have been deleted if error was before delete call.`);
            }
            chatFlavor += `<br>Roll: ${rollTotal} vs DC ${dc} (<strong style="color: ${outcomeColor};">${rollOutcomeText}</strong>)`;
            ChatMessage.create({
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                content: `<div class="pf2e chat-card" style="padding:5px;border:2px solid ${outcomeColor};border-radius:5px;background-color:rgba(0,0,0,0.03);"><header class="card-header flexrow"><img src="${actor.img}" title="${actor.name}" width="36" height="36" style="border:none;margin-right:5px;"><img src="${itemToDestroy.img}" title="${itemToDestroy.name}" width="36" height="36" style="border:none;margin-right:5px;"><h3 style="flex:1;margin:0;line-height:36px;color:${outcomeColor};">Reverse Engineer: ${itemToDestroy.name}</h3></header><div class="card-content" style="font-size:0.95em;">${chatFlavor}</div></div>`,
                flags: { "pf2e.origin": { type: "skill", uuid: statistic?.item?.uuid, slug: statistic?.slug } },
            });
            if (notificationMessage) ui.notifications[notificationType](notificationMessage);
        }
    }
}