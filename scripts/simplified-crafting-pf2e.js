import { MODULE_ID, SETTINGS } from "./module/constants.js";
import { registerSettings } from "./module/settings.js";
import { DCCalculator } from "./module/dc-calculator.js";
import { Utils } from "./module/utils.js";
import { IdentificationHandler } from "./module/identification-handler.js";
import { CraftingHandler } from "./module/crafting-handler.js";
import { ReverseEngineeringHandler } from "./module/reverse-engineering-handler.js";
import { SheetIntegrationHandler } from "./module/sheet-integration.js";
import { RuneEtchingHandler } from "./module/rune-etching-handler.js";

class SimplifiedCraftingModule {
    constructor() {
        this.moduleId = MODULE_ID;
        this.dcCalculator = null;
        this.utils = null;
        this.identificationHandler = null;
        this.craftingHandler = null;
        this.reverseEngineeringHandler = null;
        this.runeEtchingHandler = null;
        this.sheetIntegrationHandler = null;
    }

    _initializeHandlers() {
        try {
            this.dcCalculator = new DCCalculator();
            this.utils = new Utils();
            this.identificationHandler = new IdentificationHandler(this.dcCalculator, this.utils);
            this.craftingHandler = new CraftingHandler(this.dcCalculator, this.utils);
            this.reverseEngineeringHandler = new ReverseEngineeringHandler(this.dcCalculator);
            this.runeEtchingHandler = new RuneEtchingHandler(this.dcCalculator, this.utils, this.craftingHandler);
            this.sheetIntegrationHandler = new SheetIntegrationHandler(
                this.identificationHandler,
                this.reverseEngineeringHandler,
                this.craftingHandler,
                this.runeEtchingHandler,
                this.utils
            );
            return true; 
        } catch (error) {
            ui.notifications.error(`${this.moduleId}: Failed to initialize core components. Check console.`, { permanent: true });
            this.dcCalculator = this.utils = this.identificationHandler = this.craftingHandler = this.reverseEngineeringHandler = this.runeEtchingHandler = this.sheetIntegrationHandler = null;
            return false; 
        }
    }

    initialize() {
        Hooks.once("init", () => {
            registerSettings();
        });

        Hooks.once("ready", () => {
            const handlersInitialized = this._initializeHandlers(); 
            if (handlersInitialized) {
                this.registerSheetHooks();
                this.registerChatListeners();
            } else {
                console.error(`${MODULE_ID} | Halting further module initialization due to handler errors.`);
            }
        });
    }

    registerSheetHooks() {
        if (!this.sheetIntegrationHandler) {
            return;
        }
        Hooks.on("renderCharacterSheetPF2e", (app, html, data) => {
            this.sheetIntegrationHandler.onRenderCharacterSheet(app, html);
        });
        Hooks.on("renderItemSheetPF2e", (itemSheet, html, data) => {
            const item = itemSheet.item;
            if (item && item.getFlag(MODULE_ID, "craftingInfo")) {
                const craftingInfoHtml = item.getFlag(MODULE_ID, "craftingInfo");
                if (craftingInfoHtml) {
                    let targetElement = html.find('section[data-tab="description"] .item-description .description-content') || 
                                        html.find('.tab[data-tab="description"] .editor-content') || 
                                        html.find('.tab[data-tab="description"]') || 
                                        html.find('.description');
                    if (targetElement.length > 0 && targetElement.find(".custom-module-crafting-info").length === 0) {
                        targetElement.append(`<div class="custom-module-crafting-info" style="margin-top: 10px;">${craftingInfoHtml}</div>`);
                    }
                }
            }
        });
    }

    registerChatListeners() {
        if (!game.user.isGM) return;
        Hooks.on('renderChatMessage', (chatMessage, html, messageData) => {
            if (chatMessage.flags && chatMessage.flags[MODULE_ID]?.type === 'timeAdvanceSuggestion') {
                html.find(`button[data-action="module-advance-sc-time"]`).on('click', (event) => {
                    const button = event.currentTarget;
                    this._gmAdvanceSimpleCalendarTime({
                        hour: parseInt(button.dataset.hours), minute: parseInt(button.dataset.minutes),
                        second: parseInt(button.dataset.seconds), reason: button.dataset.reason
                    });
                    $(button).text('SC Time Advanced').prop('disabled', true);
                });
                html.find(`button[data-action="module-advance-core-time"]`).on('click', (event) => {
                    const button = event.currentTarget;
                    this._gmAdvanceCoreTime({ seconds: parseInt(button.dataset.seconds), reason: button.dataset.reason });
                    $(button).text('Core Time Advanced').prop('disabled', true);
                });
            }
        });
    }

    _gmAdvanceSimpleCalendarTime(timeData) {
        if (game.modules.get("foundryvtt-simple-calendar")?.active && typeof SimpleCalendar !== "undefined" && SimpleCalendar.api?.advanceTime) {
            SimpleCalendar.api.advanceTime(timeData);
            ui.notifications.info(`Simple Calendar: Advanced time for ${timeData.reason || 'task'}.`);
        } else {
            ui.notifications.warn("Simple Calendar not active or API not available for time advancement.");
        }
    }

    _gmAdvanceCoreTime(timeData) {
        const advanceBySeconds = parseInt(timeData.seconds) || 0;
        if (advanceBySeconds > 0) {
            game.time.advance(advanceBySeconds);
            ui.notifications.info(`Core Game Time: Advanced by ${advanceBySeconds}s for ${timeData.reason || 'task'}.`);
        }
    }
}

try {
    if (!window.simplifiedCrafting) {
        window.simplifiedCrafting = new SimplifiedCraftingModule();
        window.simplifiedCrafting.initialize();
    }
} catch (error) {
    console.error(`${MODULE_ID} | Error during global instantiation or initial setup:`, error);
}