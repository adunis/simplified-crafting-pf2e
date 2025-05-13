import { MODULE_ID } from "./module/constants.js"; // Adjusted path assuming this file is in scripts/
import { registerSettings } from "./module/settings.js"; // Adjusted path
import { DCCalculator } from "./module/dc-calculator.js"; // Adjusted path
import { Utils } from "./module/utils.js"; // Adjusted path
import { IdentificationHandler } from "./module/identification-handler.js"; // Adjusted path
import { CraftingHandler } from "./module/crafting-handler.js"; // Adjusted path
import { ReverseEngineeringHandler } from "./module/reverse-engineering-handler.js"; // Adjusted path
import { SheetIntegrationHandler } from "./module/sheet-integration.js"; // Adjusted path
import { RuneEtchingHandler } from "./module/rune-etching-handler.js"; // Corrected path

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

        console.log(`${this.moduleId} | Main module class constructed (handlers not yet initialized).`);
    }

    /**
     * Initializes all handler instances.
     * This should be called only when 'game.settings' and other game systems are ready.
     */
    _initializeHandlers() {
        console.log(`${MODULE_ID} | _initializeHandlers: Starting handler initialization.`);
        try {
            this.dcCalculator = new DCCalculator();
            this.utils = new Utils();
            console.log(`${MODULE_ID} | _initializeHandlers: DC Calculator and Utils created.`);

            this.identificationHandler = new IdentificationHandler(this.dcCalculator, this.utils);
            console.log(`${MODULE_ID} | _initializeHandlers: IdentificationHandler created.`);

            this.craftingHandler = new CraftingHandler(this.dcCalculator, this.utils);
            console.log(`${MODULE_ID} | _initializeHandlers: CraftingHandler created.`);

            this.reverseEngineeringHandler = new ReverseEngineeringHandler(this.dcCalculator);
            console.log(`${MODULE_ID} | _initializeHandlers: ReverseEngineeringHandler created.`);

            this.runeEtchingHandler = new RuneEtchingHandler(this.dcCalculator, this.utils, this.craftingHandler);
            console.log(`${MODULE_ID} | _initializeHandlers: RuneEtchingHandler created.`);
            
            this.sheetIntegrationHandler = new SheetIntegrationHandler(
                this.identificationHandler,
                this.reverseEngineeringHandler,
                this.craftingHandler,
                this.runeEtchingHandler, // Pass the RuneEtchingHandler
                this.utils
            );
            console.log(`${MODULE_ID} | _initializeHandlers: SheetIntegrationHandler created.`);
            console.log(`${MODULE_ID} | All handlers initialized successfully.`);
            return true; // Indicate success
        } catch (error) {
            console.error(`${MODULE_ID} | CRITICAL ERROR during _initializeHandlers:`, error);
            ui.notifications.error(`${this.moduleId}: Failed to initialize core components. Some features may be disabled. Check console.`, { permanent: true });
            // Ensure all handlers are null if any part fails, to prevent partial functionality
            this.dcCalculator = null;
            this.utils = null;
            this.identificationHandler = null;
            this.craftingHandler = null;
            this.reverseEngineeringHandler = null;
            this.runeEtchingHandler = null;
            this.sheetIntegrationHandler = null;
            return false; // Indicate failure
        }
    }

    /**
     * Sets up hooks and initializes the module.
     */
    initialize() {
        Hooks.once("init", () => {
            console.log(`${this.moduleId} | Hook: init - Registering settings.`);
            registerSettings();
        });

        Hooks.once("ready", () => {
            console.log(`${this.moduleId} | Hook: ready - System is ready.`);
            
            const handlersInitialized = this._initializeHandlers(); 
            
            if (handlersInitialized) {
                this.registerSheetHooks();
                this.registerChatListeners();
                console.log(`${MODULE_ID} | All core components and hooks initialized.`);
            } else {
                console.error(`${MODULE_ID} | Halting further module initialization due to handler errors.`);
            }
        });
    }

    /**
     * Registers hooks related to actor and item sheets.
     */
    registerSheetHooks() {
        if (!this.sheetIntegrationHandler) {
            console.error(`${MODULE_ID} | Cannot register sheet hooks: sheetIntegrationHandler not initialized.`);
            return;
        }

        Hooks.on("renderCharacterSheetPF2e", (app, html, data) => {
            // console.log(`${MODULE_ID} | Hook: renderCharacterSheetPF2e for ${app.actor?.name}`);
            this.sheetIntegrationHandler.onRenderCharacterSheet(app, html);
        });

        Hooks.on("renderItemSheetPF2e", (itemSheet, html, data) => {
            // console.log(`${MODULE_ID} | Hook: renderItemSheetPF2e for ${itemSheet.item?.name}`);
            const item = itemSheet.item;
            if (item && item.getFlag(MODULE_ID, "craftingInfo")) {
                const craftingInfoHtml = item.getFlag(MODULE_ID, "craftingInfo");
                if (craftingInfoHtml) {
                    // More robust selector finding for PF2e item sheet description
                    let targetElement = html.find('section[data-tab="description"] .item-description .description-content');
                    if (!targetElement.length) targetElement = html.find('.tab[data-tab="description"] .editor-content'); // Common fallback
                    if (!targetElement.length) targetElement = html.find('.tab[data-tab="description"]'); // Broader tab content
                    if (!targetElement.length) targetElement = html.find('.description'); // Most generic

                    if (targetElement.length > 0) {
                        if (targetElement.find(".custom-module-crafting-info").length === 0) {
                            targetElement.append(`<div class="custom-module-crafting-info" style="margin-top: 10px;">${craftingInfoHtml}</div>`);
                            // console.log(`${MODULE_ID} | Appended crafting info to item sheet for ${item.name}`);
                        }
                    } else {
                        console.warn(`${MODULE_ID} | Could not find description element on item sheet for ${item.name} to append crafting info.`);
                    }
                }
            }
        });
        console.log(`${MODULE_ID} | Sheet-related hooks registered.`);
    }

    /**
     * Registers listeners for chat messages (e.g., for GM time advancement).
     */
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
        console.log(`${MODULE_ID} | Chat listeners registered for GM.`);
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
        } else {
            console.warn(`${MODULE_ID} | _gmAdvanceCoreTime called with invalid seconds:`, timeData.seconds);
        }
    }
}

// Global instantiation
try {
    if (!window.simplifiedCrafting) {
        window.simplifiedCrafting = new SimplifiedCraftingModule();
        window.simplifiedCrafting.initialize(); // Sets up hooks
        console.log(`${MODULE_ID} | Main module instance created and initialize() called.`);
    } else {
        console.log(`${MODULE_ID} | window.simplifiedCrafting already exists.`);
    }
} catch (error) {
    console.error(`${MODULE_ID} | Error during global instantiation or initial setup:`, error);
}