import { MODULE_ID, SETTINGS, DEFAULT_CRAFTING_FEAT_SLUGS } from "./constants.js";
import { getSetting } from "./settings.js";

export class SheetIntegrationHandler {
    constructor(
        identificationHandler,
        reverseEngineeringHandler,
        craftingHandler,
        runeEtchingHandler, 
        utils
    ) {
        this.identificationHandler = identificationHandler;
        this.reverseEngineeringHandler = reverseEngineeringHandler;
        this.craftingHandler = craftingHandler;
        this.runeEtchingHandler = runeEtchingHandler; 
        this.utils = utils;
        this.craftingFeatSlugs = DEFAULT_CRAFTING_FEAT_SLUGS; 
    }

    onRenderCharacterSheet = async (sheetInstance, htmlJq) => {
        const actor = sheetInstance?.actor;
        if (!actor || !htmlJq || htmlJq.length === 0) {
            return;
        }

        if (!this.utils || !this.utils.targetItemCache) {
            return;
        }

        this.utils.targetItemCache.clear();

        try {
            this._modifyInventoryTabUI(htmlJq, actor);
            await this._modifyCraftingTabUI(htmlJq, actor);
        } catch (error) {
        }
    };

    _modifyInventoryTabUI = (htmlJq, actor) => {
        const inventoryTab = htmlJq.find(".tab.inventory");
        if (inventoryTab.length === 0) return;

        let controlsContainer = inventoryTab.find(".inventory-controls");
        if (controlsContainer.length === 0) {
            const insertPoint = inventoryTab.find(".inventory-list, .inventory-sections").first();
            if (insertPoint.length > 0) {
                controlsContainer = $('<div class="inventory-controls" style="display: flex; justify-content: flex-end; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;"></div>').insertBefore(insertPoint);
            } else {
                return;
            }
        }
        
        this._addIdentifyButton(controlsContainer, actor);
        controlsContainer.find(".reverse-engineer-button").remove(); 
    };

    _addIdentifyButton = (controlsContainer, actor) => {
        if (controlsContainer.find(".identify-magic-items-button").length === 0) {
            const buttonHtml = `<button type="button" class="identify-magic-items-button" data-tooltip-content="Identify unidentified items."><i class="fas fa-search-plus"></i> Identify Items</button>`;
            controlsContainer.prepend(buttonHtml);
        }

        controlsContainer
            .off("click.identifyMagic", ".identify-magic-items-button")
            .on("click.identifyMagic", ".identify-magic-items-button", (event) => {
                event.preventDefault();
                if (!this.identificationHandler) {
                    ui.notifications.error("Identify Handler not ready."); return;
                }
                if (typeof this.identificationHandler.runIdentifyMagicProcess !== "function") {
                    ui.notifications.error("Identify Handler method missing."); return;
                }
                try {
                    this.identificationHandler.runIdentifyMagicProcess(actor);
                } catch (err) {
                    ui.notifications.error("Failed to run Identify Magic. Check console (F12).");
                }
            });
    };

    _addReverseEngineerButton = (controlsContainer, actor) => {
        if (controlsContainer.find(".reverse-engineer-button").length > 0) return;
        const buttonHtml = `<button type="button" class="reverse-engineer-button" data-tooltip-content="Attempt to learn a formula by disassembling an item."><i class="fas fa-wrench"></i> Reverse Engineer</button>`;
        controlsContainer.append(buttonHtml);
        controlsContainer
            .off("click.reverseEngineer", ".reverse-engineer-button")
            .on("click.reverseEngineer", ".reverse-engineer-button", (event) => {
                event.preventDefault();
                if (!this.reverseEngineeringHandler) {
                    ui.notifications.error("Reverse Engineer Handler not ready."); return;
                }
                try {
                    this.reverseEngineeringHandler.handleReverseEngineering(actor);
                } catch (err) {
                    ui.notifications.error("Reverse Engineering Error. Check console (F12).");
                }
            });
    };

    _modifyCraftingTabUI = async (htmlJq, actor) => {
        const craftTab = htmlJq.find(".tab.crafting");
        if (craftTab.length === 0) return;

        try { 
            const allActorFeats = actor.itemTypes.feat;
            const relevantFeats = allActorFeats.filter(feat => this.craftingFeatSlugs.has(feat.slug))
                .filter((feat, index, self) => index === self.findIndex(f => f.slug === feat.slug))
                .sort((a, b) => a.name.localeCompare(b.name));
            let featListHtml = relevantFeats.length > 0 ? (await Promise.all(relevantFeats.map(async feat => {
                const enrichedLink = await TextEditor.enrichHTML(`@UUID[${feat.uuid}]{${feat.name}}`);
                return `<li style="display:flex;align-items:center;margin-bottom:3px;line-height:1.2;"><img src="${feat.img}" title="${feat.name}" width="16" height="16" style="margin-right:5px;border:none;flex-shrink:0;vertical-align:middle;"> ${enrichedLink}</li>`;
            }))).join("") : `<li style="color:#666;font-style:italic;">None</li>`;
            const featsSectionHtml = `<div class="relevant-crafting-feats" style="border:1px solid var(--color-border-light-tertiary);border-radius:3px;padding:8px 12px;margin-bottom:10px;background-color:rgba(0,0,0,0.02);"><h3 style="margin:0 0 5px 0;padding-bottom:3px;border-bottom:1px solid var(--color-border-light-divider);font-size:1.1em;font-weight:bold;color:var(--color-text-dark-primary);"><i class="fas fa-star" style="margin-right:5px;color:var(--color-text-dark-secondary);"></i>Crafting Feats</h3><ul style="list-style:none;margin:0;padding:0;font-size:0.95em;">${featListHtml}</ul></div>`;
            craftTab.find(".relevant-crafting-feats").remove();
            craftTab.prepend(featsSectionHtml);
        } catch (featError) { }

        const formulasHeader = craftTab.find(".known-formulas header");
        if (formulasHeader.length > 0) {
            let craftControls = formulasHeader.find("div.controls");
            if (craftControls.length === 0) {
                craftControls = $('<div class="controls" style="display: flex; gap: 0.25rem;"></div>').appendTo(formulasHeader);
            }
            this._addReverseEngineerButton(craftControls, actor);
            formulasHeader.find('button[data-action="toggle-free-crafting"]').remove();
        }

        craftTab.find(".formula-level-header .formula-quantity-header").remove();
        craftTab.find('.formula-item:not([data-ability="advanced-alchemy"]) .quantity').remove();

        const magicalCraftingFeatSlug = getSetting(SETTINGS.MAGICAL_CRAFTING_FEAT_SLUG);
        const alchemicalCraftingFeatSlug = getSetting(SETTINGS.ALCHEMICAL_CRAFTING_FEAT_SLUG);
        const actorHasMagicalCrafting = actor.itemTypes.feat.some(f => f.slug === magicalCraftingFeatSlug);
        const actorHasAlchemicalCrafting = actor.itemTypes.feat.some(f => f.slug === alchemicalCraftingFeatSlug);

        const formulaListItems = craftTab.find(".item-list li.item[data-item-uuid]");
        const processingPromises = formulaListItems.get().map(async (liElement) => {
            const $li = $(liElement); $li.find(".crafting-feat-warning").remove();
            const formulaUuid = $li.data("itemUuid"); const craftButton = $li.find('button[data-action="craft-item"]');
            if (!formulaUuid || craftButton.length === 0) return;
            craftButton.off("click.customCrafting").prop("disabled", false).removeAttr("title");
            try {
                if (!this.utils) throw new Error("Utils service not available for formula lookup.");
                const formulaDataInActor = actor.system.crafting?.formulas?.find(f => f.uuid === formulaUuid) ?? { uuid: formulaUuid };
                const targetItem = await this.utils.findTargetItemForFormula(formulaDataInActor);
                if (!targetItem) { craftButton.prop("disabled", true).attr("title", "Could not load item details."); return; }
                const itemTraits = targetItem.system?.traits?.value ?? [];
                const isMagical = itemTraits.includes("magical"), isAlchemical = itemTraits.includes("alchemical");
                let missingFeatName = null;
                if (isMagical && !actorHasMagicalCrafting) missingFeatName = "Magical Crafting";
                else if (isAlchemical && !actorHasAlchemicalCrafting) missingFeatName = "Alchemical Crafting";
                if (missingFeatName) {
                    const warningIconHtml = `<span class="crafting-feat-warning" title="Requires ${missingFeatName} feat" style="color:red;margin-left:5px;cursor:help;"><i class="fas fa-exclamation-triangle"></i></span>`;
                    $li.find(".item-name h4, .item-name .action-name").first().append(warningIconHtml);
                    craftButton.prop("disabled", true).attr("title", `Requires ${missingFeatName} feat`);
                } else {
                    craftButton.on("click.customCrafting", (event) => {
                        event.preventDefault(); event.stopPropagation();
                        this.handleCustomCraftingIntercept(actor, event).catch(error => {
                            ui.notifications.error("An error occurred during crafting initiation. Check console (F12).");
                        });
                    });
                }
            } catch (err) {
                craftButton.prop("disabled", true).attr("title", "Error processing formula details.");
                const errorIconHtml = `<span class="crafting-feat-warning" title="Error: ${err.message}" style="color:darkorange;margin-left:5px;cursor:help;"><i class="fas fa-bug"></i></span>`;
                $li.find(".item-name h4, .item-name .action-name").first().append(errorIconHtml);
            }
        });
        await Promise.allSettled(processingPromises);
    };

    handleCustomCraftingIntercept = async (actor, event) => {
        if (!this.utils || !this.craftingHandler) {
            ui.notifications.error("Crafting system components not ready."); return;
        }
        let formulaUuid = null, formulaDCFromSheet = null;
        const listItemElement = event?.currentTarget?.closest("li[data-item-uuid]");
        if (listItemElement) {
            formulaUuid = listItemElement.dataset.itemUuid;
            const dcElement = listItemElement.querySelector("div.dc");
            if (dcElement?.textContent?.match(/\d+/)) {
                formulaDCFromSheet = parseInt(dcElement.textContent.match(/\d+/)[0], 10);
            }
        } else { ui.notifications.error("Custom Crafting Error: Could not identify formula from sheet element."); return; }
        if (!formulaUuid || typeof formulaUuid !== "string" || !formulaUuid.includes(".")) {
            ui.notifications.error("Custom Crafting Error: Invalid formula data."); return;
        }
        const targetItemData = await this.utils.findTargetItemForFormula({ uuid: formulaUuid });
        if (targetItemData) {
            this.craftingHandler._openMaterialSelectionDialog(actor, targetItemData, formulaDCFromSheet);
        } else {
            ui.notifications.error(`Custom Crafting Error: Failed to load target item data for formula UUID "${formulaUuid}".`);
        }
    };
}