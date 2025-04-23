// --- GLOBAL LOGGING FUNCTION ---
function craftLog(level, ...args) {
    const LOG_LEVELS = { DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4 };
    // Set to INFO for less spam, DEBUG for more details during development/testing
    const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO;
    const messageLevel = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
    if (messageLevel >= CURRENT_LOG_LEVEL) {
        // Using a more specific version number for clarity (adjust as needed)
        const prefix = `[CUSTOM CRAFTING v9.2 - ${level.toUpperCase()}]`;
        if (level.toUpperCase() === 'ERROR') console.error(prefix, ...args);
        else if (level.toUpperCase() === 'WARN') console.warn(prefix, ...args);
        else console.log(prefix, ...args);
    }
}

// Module ID - Ensure this matches your module.json and folder name
const MOD_ID = 'simplified-crafting-pf2e'; // Example ID, replace if different

// --- Main Execution Wrapper ---
function initializeModule() {
    craftLog("INFO", "--- Initializing Custom Crafting Module ---");

    // Hook into the rendering of the Character Sheet
    const hookName = `renderCharacterSheetPF2e`; // Standard hook for PF2e character sheets
    craftLog("INFO", `Registering hook: ${hookName}`);

    Hooks.on(hookName, (sheetInstance, html) => { // html is passed as a jQuery object
        craftLog('DEBUG', `Hook "${hookName}" fired for Actor ID: ${sheetInstance.actor?.id}`);
        if (!sheetInstance?.actor || !html || html.length === 0) {
            craftLog('WARN', `Hook "${hookName}" fired with missing sheet instance, actor, or html.`);
            return;
        }

        // Use jQuery provided by the hook to find buttons within this specific sheet instance
        // Selector targets craft buttons within the crafting tab's item list
        const craftButtons = html.find('.tab.crafting .item-list li.item button[data-action="craft-item"]');
        craftLog('DEBUG', `Found ${craftButtons.length} craft buttons using selector.`);

        // Detach any previous listeners using a namespace to prevent duplicates on re-renders
        craftButtons.off('click.customCrafting');

        // Attach our custom click listener directly to these buttons
        craftButtons.on('click.customCrafting', (event) => {
            craftLog('INFO', `Custom listener intercepted "craft-item" click on sheet ${sheetInstance.id}!`);
            event.preventDefault();   // Prevent default button action
            event.stopPropagation(); // Stop event from bubbling up further

            // Wrap the handler call in a try-catch for safety within the event handler
            try {
                handleCustomCraftingIntercept(sheetInstance, event);
            } catch (error) {
                craftLog("ERROR", "Error during handleCustomCraftingIntercept execution:", error);
                ui.notifications.error("An error occurred processing the craft click. Check console (F12).");
            }
        });

        if (craftButtons.length > 0) {
            craftLog('DEBUG', `Attached custom click listeners to ${craftButtons.length} craft buttons.`);
        } else {
            // This is common if the crafting tab isn't the active one on first render
            craftLog('DEBUG', 'Could not find craft buttons with the current selector on this render.');
        }
    });

    craftLog("INFO", `Hook "${hookName}" registration complete.`);
}

// Initialize the module once Foundry is ready
// Use 'ready' to ensure necessary game data and sheet classes are fully defined
Hooks.once('ready', initializeModule);

// --- Function to handle the intercepted craft button click ---
async function handleCustomCraftingIntercept(sheetInstance, event) {
    craftLog('INFO', 'Handling custom crafting intercept...');
    const actor = sheetInstance?.actor;

    // Basic validation
    if (!actor || !(actor instanceof Actor)) {
        craftLog('ERROR', `Invalid or missing actor for sheet instance ID: ${sheetInstance?.id}`);
        ui.notifications.error("Custom Crafting: Could not get actor from sheet.");
        return;
    }
    craftLog('DEBUG', 'Got Actor:', actor.name);

    // --- Extract Formula UUID and DC from Sheet ---
    let formulaUuid = null;
    let formulaDCFromSheet = null;
    try {
        const clickedElement = event?.currentTarget;
        craftLog('DEBUG', 'Clicked Element:', clickedElement);

        // Find the closest parent LI element which should contain the formula's UUID
        const listItemElement = clickedElement?.closest("li[data-item-uuid]");
        craftLog('DEBUG', 'Closest List Item Element [data-item-uuid]:', listItemElement);

        if (listItemElement) {
            formulaUuid = listItemElement.dataset.itemUuid;
            craftLog('DEBUG', `Found formula UUID from parent li: ${formulaUuid}`);

            // Attempt to find the DC element within the same list item
            // The selector might need adjustment based on specific sheet structure changes
            const dcElement = listItemElement.querySelector("div.dc"); // Adjust selector if needed
            if (dcElement) {
                const dcText = dcElement.textContent?.trim();
                // Extract number, ignoring potential surrounding text like "DC "
                const dcMatch = dcText?.match(/\d+/);
                const dcValue = dcMatch ? parseInt(dcMatch[0], 10) : NaN;

                if (!isNaN(dcValue)) {
                    formulaDCFromSheet = dcValue;
                    craftLog('INFO', `Retrieved DC ${formulaDCFromSheet} from sheet element.`);
                } else {
                     craftLog('WARN', `Found DC element but content "${dcText}" did not contain a parsable number.`);
                }
            } else {
                 craftLog('WARN', 'Could not find element with class "dc" within the list item to retrieve DC.');
            }

        } else {
            craftLog('WARN', `Could not find parent 'li[data-item-uuid]' for the clicked element.`);
        }
    } catch (e) {
        craftLog('ERROR', 'Error extracting UUID or DC from event target:', e);
    }

    // Validate the extracted UUID
    if (!formulaUuid || typeof formulaUuid !== 'string' || !formulaUuid.includes('.')) { // Basic format check
        craftLog('ERROR', `Could not extract a valid formula UUID. Value found: ${formulaUuid}`);
        ui.notifications.error("Custom Crafting: Could not identify the formula clicked.");
        return;
    }
    craftLog('INFO', `Extracted Formula UUID: ${formulaUuid}`);

    // --- Load Formula Item ---
    let formulaItem = null;
    try {
        formulaItem = await fromUuid(formulaUuid);
    } catch (e) {
        craftLog('ERROR', `Error loading item from UUID: ${formulaUuid}`, e);
        ui.notifications.error(`Error loading formula ${formulaUuid}. See console (F12).`);
        return;
    }

    // Validate the loaded item and proceed to material selection
    if (formulaItem && formulaItem instanceof Item) {
        craftLog('DEBUG', 'Loaded formula item:', formulaItem.name);
        // Pass the retrieved DC (or null if not found) to the next step
        await openMaterialSelectionDialog(actor, formulaItem, formulaDCFromSheet);
    } else {
        craftLog('ERROR', `Failed to load a valid Item from UUID: ${formulaUuid}. Loaded object:`, formulaItem);
        ui.notifications.error(`Custom Crafting: Failed to load formula item ${formulaUuid}.`);
    }
}


// --- Helper Function for Material Selection Dialog ---
async function openMaterialSelectionDialog(actor, formulaItem, dcFromSheet = null){
    try {
        craftLog('INFO', "--- Opening Material Selection ---");
        craftLog('DEBUG', "Received Formula Item:", formulaItem.name, `(UUID: ${formulaItem.uuid})`);
        craftLog('DEBUG', "Received DC from Sheet:", dcFromSheet); // Log the DC received

        // Get Formula Details
        const itemLevel = formulaItem.system.level?.value ?? 0;
        const itemPrice = formulaItem.system.price.value;
        // Calculate price in GP consistently
        const itemPriceGP = ((itemPrice.gp || 0) + (itemPrice.sp || 0) / 10 + (itemPrice.cp || 0) / 100);
        // Determine if it's a 'simple' craft (e.g., basic consumables often are)
        // This flag might need refinement based on specific item types or traits
        craftLog("DEBUG", `Formula Details - Lvl: ${itemLevel}, Price: ${itemPriceGP.toFixed(2)}gp`);

        // Calculate Crafting Time based on actor's current proficiency
        const craftSkill = actor.skills.crafting;
        const proficiencyRank = craftSkill?.rank ?? 1; // Default to Trained (rank 1) if skill/rank missing
        const finalTimeString = calculateCraftingTime(itemLevel, proficiencyRank); // Use helper function only for non-simple
        craftLog("INFO", `Calculated required time per item: ${finalTimeString}`);

        // Find the Target Item (the item being crafted)
        let targetItemUuid = null;
        let targetItemObject = null;

        // Attempt to guess target name by removing "Formula: " prefix
        const potentialTargetName = formulaItem.name.startsWith("Formula: ") ? formulaItem.name.substring(9).trim() : formulaItem.name;
        const targetName = targetItemObject?.name || potentialTargetName;
        const targetIcon = targetItemObject?.img || formulaItem.img || 'icons/svg/item-bag.svg'; // Use target icon, fallback to formula or default
        // List of standard PF2e compendium packs to search
        const packNamesToSearch = [
            "pf2e.equipment-srd", "pf2e.consumables-srd", "pf2e.weapons-srd",
            "pf2e.armor-srd", "pf2e.treasure-vault-srd", "pf2e.spells-srd",
            "pf2e.feats-srd", "pf2e.actions-srd", "pf2e.conditionitems-srd" // Added more packs potentially containing craftable items
        ];
        craftLog("INFO", `Searching for target item named "${potentialTargetName}" in compendiums...`);

        searchLoop: // Label for breaking out of the outer loop efficiently
        for (const packName of packNamesToSearch) {
            const pack = game.packs.get(packName);
            if (!pack) { craftLog("WARN", `Compendium pack ${packName} not found or accessible.`); continue; }
            craftLog("DEBUG", `Searching in pack: ${packName}`);
            try {
                // Get index with necessary fields for matching and constructing UUID
                const index = await pack.getIndex({ fields: ["name", "type"] }); // Minimal fields needed
                const entryInIndex = index.find(entry => entry.name.toLowerCase() === potentialTargetName.toLowerCase()); // Case-insensitive match

                if (entryInIndex) {
                    // Construct UUID using metadata from the pack
                    const docType = pack.documentName; // Use documentName for robustness (e.g., Item, Actor)
                    const tempUuid = `Compendium.${pack.collection}.${entryInIndex._id}`; // Use collection key and _id
                    craftLog("INFO", `Found potential match "${entryInIndex.name}" in ${packName}. Constructed UUID: ${tempUuid}. Loading...`);
                    const tempObject = await fromUuid(tempUuid);
                    if (tempObject) {
                        targetItemUuid = tempUuid; // Assign UUID if loaded successfully
                        targetItemObject = tempObject; // Store the loaded item object
                        craftLog("DEBUG", "Target item loaded successfully from compendium.");
                        break searchLoop; // Exit the loop once a valid item is found and loaded
                    } else {
                        craftLog("WARN", `Found UUID ${tempUuid} for "${entryInIndex.name}" but failed to load the item object from ${packName}. Continuing search...`);
                    }
                }
            } catch (err) {
                // Log error but continue searching other packs
                craftLog("ERROR", `Error searching or loading from pack "${packName}" for "${potentialTargetName}":`, err);
            }
        } // End for loop

        // Fallback: If not found by name, check if the formula itself might be the target (e.g., crafting a unique item)
        if (!targetItemUuid && !targetItemObject) {
            craftLog("WARN", `Could not find "${potentialTargetName}" by name in any searched pack. Checking if the formula itself is the target...`);
            // Use the formula if its name doesn't indicate it's just a formula
            if (!formulaItem.name.startsWith("Formula: ")) {
                targetItemUuid = formulaItem.uuid;
                targetItemObject = formulaItem;
                craftLog("INFO", `Using the formula's own UUID (${targetItemUuid}) as the target.`);
            } else {
                // Critical failure - cannot determine what is being crafted
                ui.notifications.error(`Custom Crafting: Could not find target item matching name "${potentialTargetName}" in compendiums.`);
                craftLog("ERROR", `Failed compendium name search for "${potentialTargetName}" and formula name suggests it's not the target.`);
                return; // Stop if we couldn't find the target item
            }
        }
        craftLog("INFO", `Final Target Item: ${targetItemObject?.name ?? potentialTargetName} (UUID: ${targetItemUuid})`);

        // Check for Magical Trait and add disclaimer
        let magicDisclaimer = '';
        if (targetItemObject?.system?.traits?.value?.includes('magical')) {
             magicDisclaimer = `
                <div style="border: 1px solid orange; padding: 5px; margin: 5px 0; background-color: rgba(255, 165, 0, 0.1);">
                    <strong style="color: orange;"><i class="fas fa-exclamation-triangle"></i> Magical Item Note:</strong>
                    <p style="margin: 2px 0 0 0; font-size: 0.9em;">Crafting <strong>${targetItemObject.name}</strong> typically requires magical components. Ensure at least half the material value comes from appropriate sources (e.g., Magical Essence, scrolls, runes, other magic items). GM discretion applies.</p>
                </div>`;
            craftLog("INFO", `Target item "${targetItemObject.name}" is magical. Added disclaimer.`);
        }

        // Calculate Crafting Requirements
        let calcPriceGP = itemPriceGP;
        // Handle zero-price items, especially simple ones (e.g., basic ammo might be < 1cp)
        if (calcPriceGP <= 0) {
            calcPriceGP = 0.01; // Assign a minimal cost (1cp)
            craftLog("WARN", `Target item price is 0 or less, using default ${calcPriceGP}gp for requirement calculation.`);
        } else if (calcPriceGP <= 0) {
             craftLog("ERROR", `Target item "${targetData.name}" has price <= 0 GP (${calcPriceGP}gp) and is not 'simple'. Cannot calculate material requirement.`);
             ui.notifications.error(`Cannot craft ${targetData.name}: Invalid price (${calcPriceGP}gp).`);
             return; // Cannot proceed with 0 cost for non-simple items
        }

        const requiredValue = calcPriceGP / 2;
        craftLog("DEBUG", `Required Material Value: ${requiredValue.toFixed(2)}gp`);

        // Filter Actor's Inventory for Potential Materials
        // Consider a broader range of item types that might have value
        const itemTypesToConsider = ['loot', 'consumable', 'equipment', 'treasure', 'weapon', 'armor', 'backpack'];
        const inventoryMaterials = actor.items.filter(i =>
            itemTypesToConsider.includes(i.type) &&
            i.system?.price?.value && // Check if price object exists
            ((i.system.price.value.gp || 0) + (i.system.price.value.sp || 0) / 10 + (i.system.price.value.cp || 0) / 100 > 0) && // Check if value > 0
            i.system.quantity > 0 // Ensure item quantity is positive
        ).sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
        craftLog("INFO", `Found ${inventoryMaterials.length} potential material items in inventory.`);

        // Build Material Selection UI HTML
        let materialInputs = `<p><i>No suitable items with value found in inventory.</i></p>`;
        if (inventoryMaterials.length > 0) {
            materialInputs = inventoryMaterials.map(item => {
                const itemPrice = item.system.price.value;
                const valuePerUnit = (itemPrice.gp || 0) + (itemPrice.sp || 0) / 10 + (itemPrice.cp || 0) / 100;
                const currentQuantity = item.system.quantity ?? 1; // Default to 1 if quantity is missing
                return `
                <div class="material-row form-group" style="display: flex; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 5px;"
                     data-item-id="${item.id}" data-value-per-unit="${valuePerUnit.toFixed(4)}" data-max-qty="${currentQuantity}" data-item-name="${item.name}">
                  <div class="item-info" style="flex: 2; display: flex; flex-direction: column; margin-right: 10px;">
                      <div style="display: flex; align-items: center; font-weight: bold; margin-bottom: 2px;">
                          <img src="${item.img}" style="height: 24px; width: 24px; margin-right: 5px; border: none;"/>
                          ${item.name}
                      </div>
                      <div style="font-size: 0.85em; color: #006000; padding-left: 29px;">
                          Value: ${valuePerUnit.toFixed(2)} gp/ea
                      </div>
                       <div style="font-size: 0.85em; color: #666; padding-left: 29px;">
                          Type: ${item.type}, Have: <span class="current-qty">${currentQuantity}</span>
                      </div>
                  </div>
                  <div class="item-input" style="flex: 1; text-align: right;">
                      <label style="display: block; font-size: 0.85em; margin-bottom: 2px;">Use Qty:</label>
                      <input type="number" class="material-quantity" name="${item.id}" value="0" min="0" max="${currentQuantity}" step="1"
                             style="width: 70px; height: 24px; text-align: center; border: 1px solid #ccc;" />
                  </div>
                </div>`;
            }).join('');
        }
        craftLog("DEBUG", "Generated material input HTML.");

        // Prepare final target data object to pass to the crafting attempt function
        const finalTargetData = {
            name: targetItemObject?.name || potentialTargetName,
            icon: targetIcon, // <<<< ADDED ICON HERE // Use loaded name if available
            level: itemLevel,
            priceGP: calcPriceGP, // Use the potentially adjusted price
            targetItemUuid: targetItemUuid, // Pass the UUID of the item to be created
            dcFromSheet: dcFromSheet, // Pass the DC found on the sheet (or null)
            timeString: finalTimeString // Store the calculated time string per item
       };
       craftLog("DEBUG", "Final target data prepared:", finalTargetData);

        // Assemble Dialog Content HTML
        const dialogId = `material-selection-dialog-${foundry.utils.randomID(10)}`; // Use Foundry's randomID for uniqueness
        const materialDialogContent = `
        <form>
          <!-- *** NEW: Big Icon and Title Header *** -->
          <div class="dialog-header" style="display: flex; align-items: center; border-bottom: 1px solid #999; padding-bottom: 10px; margin-bottom: 10px;">
              <img src="${targetIcon}" title="${finalTargetData.name}" style="height: 64px; width: 64px; margin-right: 15px; border: none; flex-shrink: 0; object-fit: contain; /* Helps with odd aspect ratios */"/>
              <h1 style="margin: 0; font-size: 1.8em; line-height: 1.2;">Crafting: ${finalTargetData.name} <span style="font-size: 0.7em; color: #555;">(Lvl ${itemLevel})</span></h1>
          </div>
          <!-- *** END: New Header *** -->
          ${magicDisclaimer} <!-- Include disclaimer if applicable -->
          <p style="font-size: 0.9em;">Requires material value ≥ <strong>${requiredValue.toFixed(2)} gp</strong>.</p>
          <p style="font-size: 0.9em;">Estimated Time: <strong>${finalTimeString}</strong> per Item (Based on current Crafting proficiency).</p>

          <fieldset style="border: 1px solid #ccc; margin-bottom: 10px; padding: 8px;">
              <legend style="font-weight: bold;">Available Materials (Inventory)</legend>
              <div id="material-list-${dialogId}" class="material-list" style="max-height: 300px; overflow-y: auto; /* Increased height */">
                ${materialInputs}
              </div>
          </fieldset>

       <div style="border-top: 1px solid #999; padding-top: 8px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <div style="font-weight: bold;">Total Value Provided: <strong id="total-value-${dialogId}" class="total-value" style="color: red; font-size: 1.1em;">0.00 gp</strong></div>
              <div style="font-size: 0.9em;">Quantity Crafted: x<strong id="potential-items-${dialogId}" class="potential-items" style="color: #005000; font-weight: bold;">0</strong></div>
    
          <p style="font-size: 0.8em; color: #555; margin-top: 5px;">Note: Materials will be consumed based on crafting check outcome.</p>
        </form>
        <!-- Script embedded for dynamic updates within the dialog -->
        <script>
          (function(dialogId, reqValue, pricePerItem) {
              const form = document.getElementById(dialogId).closest('.dialog-content').querySelector('form');
              if (!form) return; // Guard against script running before form exists
              const materialList = form.querySelector('.material-list');
              const valueDisplay = form.querySelector('.total-value');
              const itemsDisplay = form.querySelector('.potential-items'); // Might be null if not simple
              const craftButton = form.closest('.app.dialog').querySelector('.dialog-buttons button.craft-button'); // Find button relative to dialog

              const validateInput = (inputElement) => {
                  let currentVal = parseInt(inputElement.value) || 0;
                  const minVal = parseInt(inputElement.min);
                  const maxVal = parseInt(inputElement.max);
                  if (currentVal < minVal) currentVal = minVal;
                  if (currentVal > maxVal) currentVal = maxVal;
                  inputElement.value = currentVal; // Correct the input field visually
                  return currentVal;
              };

              const updateTotal = () => {
                  let currentValue = 0;
                  if (!materialList) return; // Guard
                  materialList.querySelectorAll('.material-row').forEach(row => {
                      const qtyInput = row.querySelector('.material-quantity');
                      if (!qtyInput) return;
                      const qty = validateInput(qtyInput); // Validate and get corrected value
                      const valuePer = parseFloat(row.dataset.valuePerUnit) || 0;
                      currentValue += qty * valuePer;
                  });

                  if (valueDisplay) {
                     valueDisplay.textContent = currentValue.toFixed(2) + ' gp';
                     const meetsValue = currentValue >= reqValue;
                     valueDisplay.style.color = meetsValue ? 'green' : 'red';

                     // Enable/disable craft button based on meeting requirement
                     if (craftButton) {
                         craftButton.disabled = !meetsValue;
                     }
                  }

                   if (itemsDisplay) {
                      let quantity = 0;
                      // Calculate only if value requirement is met AND item has a positive price
                      if (currentValue >= reqValue && pricePerItem > 0) {
                          quantity = Math.floor(currentValue / pricePerItem);
                      }
                      itemsDisplay.textContent = quantity; // Display the calculated quantity (or 0)
                  }
              };

              // Use event delegation on the material list container
              if (materialList) {
                  materialList.addEventListener('input', (event) => {
                      if (event.target.classList.contains('material-quantity')) {
                           updateTotal();
                      }
                  });
                   materialList.addEventListener('change', (event) => { // Also catch changes from spinners etc.
                      if (event.target.classList.contains('material-quantity')) {
                           validateInput(event.target); // Ensure validation on change too
                           updateTotal();
                      }
                  });
              }

              // Initial update on render
              updateTotal();

          })("material-list-${dialogId}", ${requiredValue}, ${finalTargetData.priceGP});
        </script>
        `;

        // Display the Material Selection Dialog
        craftLog("DEBUG", "Displaying material selection dialog.");
        new Dialog({
            id: dialogId, // Assign unique ID for potential styling/scripting
            title: `Select Materials: ${finalTargetData.name}`,
            content: materialDialogContent,
            buttons: {
                craft: {
                    icon: '<i class="fas fa-hammer"></i>',
                    label: `Attempt Craft`, // Label doesn't need time here anymore
                    classes: "craft-button", // Class for script to find
                    callback: async (html) => {
                        craftLog("INFO", "Craft button clicked.");
                        const materialsToUse = [];
                        let totalValueUsed = 0;
                        // Use jQuery to find selected materials within the dialog's HTML
                        html.find('.material-row').each((i, el) => {
                            const $el = $(el); // jQuery wrapper for the element
                            const itemId = $el.data('itemId');
                            const quantityInput = $el.find('.material-quantity');
                            const quantity = parseInt(quantityInput.val()) || 0;
                            const valuePerUnit = parseFloat($el.data('valuePerUnit')) || 0;
                            const maxQty = parseInt($el.data('maxQty')) || 0;
                            const itemName = $el.data('itemName') || `Item ID ${itemId}`; // Get name for logging

                            // Double check quantity against max (should be handled by input validation, but good safeguard)
                            const safeQuantity = Math.max(0, Math.min(quantity, maxQty));

                            if (safeQuantity > 0 && itemId) {
                                const valueProvided = safeQuantity * valuePerUnit;
                                materialsToUse.push({
                                    id: itemId,
                                    quantity: safeQuantity,
                                    value: valueProvided,
                                    name: itemName // Store name for easier logging/chat messages
                                });
                                totalValueUsed += valueProvided;
                            }
                        });

                        craftLog("DEBUG", "Materials selected:", materialsToUse);
                        craftLog("INFO", `Total value provided: ${totalValueUsed.toFixed(2)}gp (Required: ${requiredValue.toFixed(2)}gp)`);

                        // Final check: Ensure sufficient value before proceeding
                        if (totalValueUsed < requiredValue) {
                            ui.notifications.warn(`Insufficient material value provided (${totalValueUsed.toFixed(2)}gp). Requires ${requiredValue.toFixed(2)}gp.`);
                            craftLog("WARN", "Insufficient material value selected. Aborting craft attempt.");
                            return false; // Prevent dialog from closing automatically
                        } else {
                            craftLog("INFO", "Sufficient material value provided. Proceeding to crafting attempt.");
                            // Pass all necessary data to the crafting function
                            // NOTE: The finalTimeString (time per item) is now part of finalTargetData
                            await attemptCrafting(actor, formulaItem, finalTargetData, materialsToUse, totalValueUsed);
                        }
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel",
                    callback: () => craftLog("INFO", "Material selection cancelled.")
                }
            },
            default: "craft",
            render: (html) => {
                craftLog("DEBUG", `Material selection dialog #${dialogId} rendered.`);
                // The embedded script handles dynamic updates now.
                // We can ensure the craft button starts disabled if needed
                const craftButton = html.closest('.app.dialog').find('.dialog-buttons button.craft-button');
                // Disable initially if value is 0 (should be handled by script's initial call, but safe)
                const initialValue = parseFloat(html.find('.total-value').text()) || 0;
                 if (craftButton.length > 0 && initialValue < requiredValue) {
                     craftButton.prop('disabled', true);
                 }
            },
            close: () => craftLog("DEBUG", `Material selection dialog #${dialogId} closed.`)
        }, { width: 550 }).render(true); // Render the dialog

    } catch (error) {
        craftLog("ERROR", "Error in openMaterialSelectionDialog:", error);
        ui.notifications.error("An error occurred opening the material selection dialog. Check console (F12).");
    }
}


// --- Helper Function for Crafting Attempt (v9.3 - Unit-Based Consumption) ---
async function attemptCrafting(actor, formulaItem, targetData, materialsUsed, valueUsed) {
    try {
        craftLog("INFO", "--- Attempting Crafting ---");
        craftLog("DEBUG", "Received Actor:", actor?.name);
        craftLog("DEBUG", "Received Formula Item:", formulaItem?.name);
        craftLog("DEBUG", "Received Target Data:", targetData);
        craftLog("DEBUG", "Received Materials Used:", materialsUsed); // List of {id, quantity, value, name}
        craftLog("DEBUG", "Received Value Used:", valueUsed.toFixed(2));

        // --- Determine DC ---
        const itemLevel = targetData.level;
        const dcLevel = Math.max(0, itemLevel);
        let baseDC;

        if (typeof targetData.dcFromSheet === 'number' && !isNaN(targetData.dcFromSheet) && targetData.dcFromSheet > 0) {
            baseDC = targetData.dcFromSheet;
            craftLog("INFO", `Using DC ${baseDC} retrieved directly from sheet element.`);
        } else {
             const craftingEntry = actor.system.crafting?.formulas?.find(f => f.uuid === formulaItem.uuid);
             baseDC = craftingEntry?.dc // Use optional chaining
            if(baseDC){
               craftLog("INFO", `Using DC ${baseDC} from actor's known formula entry.`);
            } else {
               // Fallback: Calculate DC based on level if not found elsewhere
                baseDC = game.pf2e.actions.craft.calculateDC(itemLevel, { proficiencyRank: actor.skills.crafting?.rank ?? 1 }); // Use PF2e helper if available
                 if (isNaN(baseDC) || baseDC <= 0) { // Fallback if PF2e helper not available or returns invalid
                    baseDC = [14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 38, 39, 40, 42, 44, 46, 48, 50][dcLevel] || 10; // Use standard DC by Level table
                    craftLog("WARN", `Could not find DC on sheet or actor formula entry. Calculated fallback DC ${baseDC} based on level ${dcLevel}.`);
                 } else {
                    craftLog("INFO", `Calculated DC ${baseDC} based on item level ${dcLevel} using system defaults.`);
                 }
            }

        }
        // --- END DC Determination ---

        // --- Roll Crafting Check ---
        const craftSkill = actor.skills.crafting;
        if (!craftSkill) {
            craftLog("ERROR", `Actor ${actor.name} does not have a 'crafting' skill defined.`);
            ui.notifications.error(`Cannot perform Craft check: ${actor.name} missing Crafting skill.`);
            throw new Error(`Actor ${actor.name} has no crafting skill!`);
        }

        craftLog("INFO", `Rolling Crafting check vs DC ${baseDC}`);
        let roll = await craftSkill.roll({ dc: { value: baseDC }, skipDialog: false });

        if (!roll) {
            craftLog("WARN", "Crafting roll was cancelled or aborted by the user.");
            ui.notifications.warn("Crafting roll cancelled.");
            return;
        }
        craftLog("INFO", `Roll Result: ${roll.total} vs DC ${baseDC}. Outcome: ${roll.outcome}`);

        // --- Process Result & Determine Material Consumption ---
        const successDegree = roll.degreeOfSuccess; // 0:CF, 1:F, 2:S, 3:CS
        craftLog("INFO", "Degree of Success:", successDegree);
        let outcomeMessage = "";
        let itemsCreatedData = [];
        let quantityCrafted = 0;
        const timeStringPerItem = targetData.timeString;

        // Holds details for actual consumption: { id, name, quantityToConsume }
        const materialConsumptionDetails = [];
        let totalUnitsConsumed = 0;
        let totalUnitsSaved = 0; // Specific to CS/F outcomes

        craftLog("INFO", "Determining material consumption and craft outcome based on roll...");

        if (successDegree === 3) { // *** Critical Success ***
            quantityCrafted = (targetData.priceGP > 0) ? Math.max(1, Math.floor(valueUsed / targetData.priceGP)) : 1;
            outcomeMessage = `Critical Success! Crafted [QUANTITY]x ${targetData.name}.`;
            outcomeMessage += `\nRequired Time: ${timeStringPerItem} per item.`;

            let consumedUnitCount = 0;
            let savedUnitCount = 0;
            for (const mat of materialsUsed) {
                let unitsToConsume = 0;
                for (let i = 0; i < mat.quantity; i++) {
                    // 50% chance FOR EACH UNIT to be consumed
                    if (Math.random() < 0.5) {
                        unitsToConsume++;
                    }
                }
                if (unitsToConsume > 0) {
                     materialConsumptionDetails.push({ id: mat.id, name: mat.name, quantityToConsume: unitsToConsume });
                     craftLog("DEBUG", `Crit Success: Marked ${unitsToConsume}/${mat.quantity} units of ${mat.name} (ID: ${mat.id}) for consumption.`);
                } else {
                     craftLog("DEBUG", `Crit Success: Saved all ${mat.quantity} units of ${mat.name} (ID: ${mat.id}).`);
                }
                consumedUnitCount += unitsToConsume;
                savedUnitCount += (mat.quantity - unitsToConsume);
            }
            totalUnitsConsumed = consumedUnitCount; // Store for overall count
            totalUnitsSaved = savedUnitCount;

            outcomeMessage += ` Consumed ${consumedUnitCount} material unit(s) and saved ${savedUnitCount}.`;

        } else if (successDegree === 2) { // *** Success ***
            quantityCrafted = (targetData.priceGP > 0) ? Math.max(1, Math.floor(valueUsed / targetData.priceGP)) : 1;
            outcomeMessage = `Success! Crafted [QUANTITY]x ${targetData.name}.`;
            outcomeMessage += `\nRequired Time: ${timeStringPerItem} per item.`;

            // Consume ALL units of ALL materials used
            let consumedUnitCount = 0;
            for (const mat of materialsUsed) {
                 materialConsumptionDetails.push({ id: mat.id, name: mat.name, quantityToConsume: mat.quantity });
                 consumedUnitCount += mat.quantity;
            }
            totalUnitsConsumed = consumedUnitCount;
            outcomeMessage += ` Consumed all ${totalUnitsConsumed} material unit(s).`;
            craftLog("DEBUG", `Success: Marked all ${totalUnitsConsumed} units from ${materialsUsed.length} stacks for consumption.`);

        } else if (successDegree === 1) { // *** Failure ***
            quantityCrafted = 0;
            outcomeMessage = `Failure. The attempt failed, and no items were crafted.`;
            outcomeMessage += `\nTime Spent (Wasted): ${timeStringPerItem}.`;

            let consumedUnitCount = 0;
            let savedUnitCount = 0;
            for (const mat of materialsUsed) {
                 let unitsToConsume = 0;
                 for (let i = 0; i < mat.quantity; i++) {
                     // 50% chance FOR EACH UNIT to be consumed (ruined)
                     if (Math.random() < 0.5) {
                         unitsToConsume++;
                     }
                 }
                 if (unitsToConsume > 0) {
                     materialConsumptionDetails.push({ id: mat.id, name: mat.name, quantityToConsume: unitsToConsume });
                     craftLog("DEBUG", `Failure: Marked ${unitsToConsume}/${mat.quantity} units of ${mat.name} (ID: ${mat.id}) as ruined (consumed).`);
                 } else {
                      craftLog("DEBUG", `Failure: Kept all ${mat.quantity} units of ${mat.name} (ID: ${mat.id}).`);
                 }
                 consumedUnitCount += unitsToConsume;
                 savedUnitCount += (mat.quantity - unitsToConsume);
            }
            totalUnitsConsumed = consumedUnitCount;
            totalUnitsSaved = savedUnitCount;

            outcomeMessage += ` Ruined ${consumedUnitCount} material unit(s) but kept ${savedUnitCount}.`;

        } else { // *** Critical Failure (successDegree === 0) ***
            quantityCrafted = 0;
            outcomeMessage = `Critical Failure! The attempt failed badly, and no items were crafted.`;
            outcomeMessage += `\nTime Spent (Wasted): ${timeStringPerItem}.`;

            // Consume ALL units of ALL materials used
            let consumedUnitCount = 0;
            for (const mat of materialsUsed) {
                 materialConsumptionDetails.push({ id: mat.id, name: mat.name, quantityToConsume: mat.quantity });
                 consumedUnitCount += mat.quantity;
            }
            totalUnitsConsumed = consumedUnitCount;
            outcomeMessage += ` All ${totalUnitsConsumed} material unit(s) were ruined.`;
            craftLog("DEBUG", `Crit Failure: Marked all ${totalUnitsConsumed} units from ${materialsUsed.length} stacks for consumption.`);
        }

        // Replace quantity placeholder in outcome message
        outcomeMessage = outcomeMessage.replace("[QUANTITY]", quantityCrafted > 0 ? `${quantityCrafted}` : "0");

        // --- Consume Lost/Used Materials (Based on materialConsumptionDetails) ---
        if (materialConsumptionDetails.length > 0) {
            craftLog("INFO", `Applying consumption for determined material units.`);
            const updates = []; // To update quantities
            const deletions = []; // To delete stacks fully consumed

            for (const detail of materialConsumptionDetails) {
                // Skip if 0 units are to be consumed for this item
                if (detail.quantityToConsume <= 0) continue;

                const item = actor.items.get(detail.id);
                if (!item) {
                    craftLog("WARN", `Material item ${detail.name} (ID: ${detail.id}) not found on actor ${actor.name} during consumption phase. Skipping.`);
                    continue; // Skip if item somehow disappeared
                }

                const currentQuantity = item.system.quantity ?? 1; // Actor's current quantity

                craftLog("DEBUG", `Processing consumption: Attempting to consume ${detail.quantityToConsume} of ${item.name} (Current: ${currentQuantity})`);

                if (currentQuantity > detail.quantityToConsume) {
                    // If consuming less than the full stack, prepare an update
                    updates.push({ _id: detail.id, "system.quantity": currentQuantity - detail.quantityToConsume });
                    craftLog("DEBUG", ` > Updating quantity of ${item.name} to ${currentQuantity - detail.quantityToConsume}`);
                } else {
                    // If consuming the entire stack (or more, although logic should prevent consuming more than available), prepare deletion
                    deletions.push(detail.id);
                    craftLog("DEBUG", ` > Deleting item stack ${item.name} (ID: ${detail.id}). Consumed ${detail.quantityToConsume}/${currentQuantity}.`);
                }
            }

            // Apply updates and deletions to the actor's inventory
            try {
                if (updates.length > 0) {
                    craftLog("INFO", `Updating quantities for ${updates.length} item stacks.`);
                    await actor.updateEmbeddedDocuments("Item", updates);
                }
                if (deletions.length > 0) {
                    craftLog("INFO", `Deleting ${deletions.length} item stacks.`);
                    await actor.deleteEmbeddedDocuments("Item", deletions);
                }
                 if (updates.length > 0 || deletions.length > 0) {
                    craftLog("INFO", `Material consumption (${totalUnitsConsumed} units total) applied successfully.`);
                 } else if (totalUnitsConsumed > 0) {
                    // This case implies items were marked for consumption but not found on actor
                    craftLog("WARN", "Material units were marked for consumption, but no updates or deletions were performed (items might be missing).");
                 }
            } catch (error) {
                craftLog("ERROR", "Error updating/deleting materials from inventory:", error);
                ui.notifications.error("Error applying material consumption. Inventory may be inconsistent. Check console (F12).");
                outcomeMessage += `\n<strong style="color:orange;">Warning: Error occurred while consuming materials. Inventory might need manual adjustment.</strong>`;
            }
        } else {
             craftLog("INFO", "No material units were marked for consumption for this outcome.");
        }
        // --- END Material Consumption ---

        // --- Prepare Created Item Data --- (Rest of the function remains the same)
        if (successDegree >= 2 && quantityCrafted > 0) {
            craftLog("INFO", `Preparing to create ${quantityCrafted}x ${targetData.name}.`);
            if (!targetData.targetItemUuid) {
                craftLog("ERROR", `Cannot create item: Target Item UUID is missing from targetData.`);
                ui.notifications.error(`Crafting Error: Missing target item UUID for ${targetData.name}. Cannot create item.`);
                outcomeMessage += `\n<strong style="color:red;">Error: Failed to create ${targetData.name} - Internal data missing (UUID).</strong>`;
            } else {
                craftLog("DEBUG", `Attempting to fetch source item from UUID: ${targetData.targetItemUuid}`);
                const sourceItem = await fromUuid(targetData.targetItemUuid);

                if (sourceItem && sourceItem instanceof Item) {
                    craftLog("INFO", `Source item "${sourceItem.name}" loaded successfully.`);
                    const itemData = sourceItem.toObject();

                    itemData.system.quantity = quantityCrafted;
                    delete itemData._id;
                    delete itemData.flags?.pf2e_crafting;
                    itemData.name = itemData.name || targetData.name;
                    itemData.type = itemData.type || 'equipment';

                    itemsCreatedData.push(itemData);
                    craftLog("DEBUG", "Prepared item data for creation:", itemsCreatedData);
                } else {
                    craftLog("ERROR", `Failed to load valid source Item from UUID: ${targetData.targetItemUuid}. Loaded:`, sourceItem);
                    ui.notifications.error(`Could not find or load the source item (${targetData.name}) to create. See console (F12).`);
                    outcomeMessage += `\n<strong style="color:red;">Error: Failed to create ${targetData.name} - Could not load source item data.</strong>`;
                }
            }
        }
        // --- END Item Preparation ---

        // --- Add Created Items to Actor's Inventory ---
        if (itemsCreatedData.length > 0) {
             try {
                craftLog("INFO", `Adding ${itemsCreatedData[0].system.quantity}x "${itemsCreatedData[0].name}" to ${actor.name}'s inventory.`);
                const createdDocs = await actor.createEmbeddedDocuments("Item", itemsCreatedData);
                craftLog("INFO", `Successfully added ${createdDocs.length} new item document(s).`);
                if (createdDocs.length > 0 && createdDocs[0].uuid) {
                     outcomeMessage += `\nCreated: @UUID[${createdDocs[0].uuid}]{${createdDocs[0].name}}`;
                }
            } catch (error) {
                 craftLog("ERROR", "Error adding created item(s) to actor's inventory:", error);
                 ui.notifications.error(`Failed to add ${itemsCreatedData[0].name} to inventory. See console (F12).`);
                 outcomeMessage += `\n<strong style="color:red;">Error: Succeeded roll, but failed to add ${itemsCreatedData[0].name} to inventory.</strong>`;
            }
        } else if (successDegree >= 2 && quantityCrafted > 0) {
            craftLog("WARN", "Crafting roll was successful, but no item data was prepared (likely source item load failure). No items added.");
        } else {
            craftLog("INFO", "No items to add to inventory for this outcome.");
        }
        // --- END Item Addition ---

        // --- Generate Chat Message ---
        craftLog("INFO", "Generating chat message for the crafting attempt.");
        const materialList = materialsUsed.length > 0
            ? materialsUsed.map(m => `${m.name} x${m.quantity}`).join(', ')
            : 'None';

        const outcomeString = roll.outcome ? game.i18n.localize(`PF2E.Check.Result.Degree.Check.${roll.outcome}`) : `Degree ${successDegree}`;
        const targetItemLink = targetData.targetItemUuid ? `@UUID[${targetData.targetItemUuid}]{${targetData.name}}` : targetData.name;

        const chatContent = `
            <div class="pf2e chat-card" style="padding: 3px; border: 1px solid var(--color-border-light-tertiary); font-size: 14px;">
              <header class="card-header flexrow" style="border-bottom: 1px solid var(--color-border-light-tertiary); padding-bottom: 3px; margin-bottom: 5px; align-items: center;">
                <img src="${actor.img}" title="${actor.name}" width="36" height="36" style="border: none; margin-right: 5px;">
                <img src="${targetData.icon}" title="${targetData.name}" width="36" height="36" style="border: none; margin-right: 5px; flex-shrink: 0;">
                <h3 style="margin: 0; line-height: 1.2; flex-grow: 1;">${actor.name} attempts to Craft: ${targetItemLink}</h3>
              </header>
              <div class="card-content" style="font-size: 0.95em;">
                <p style="margin: 2px 0;"><strong>Formula:</strong> ${formulaItem.name}</p>
                <p style="margin: 2px 0;"><strong>Materials Selected (Value: ${valueUsed.toFixed(2)}gp):</strong> ${materialList}</p>
                <p style="margin: 2px 0;"><strong>Crafting DC:</strong> ${baseDC}</p>
                <p style="margin: 2px 0;"><strong>Time Required per Item:</strong> ${timeStringPerItem}</p>
                ${roll ? `<p style="margin: 2px 0;"><strong>Roll Result:</strong> ${roll.total} vs DC ${baseDC} (${outcomeString})</p>` : '<p style="color:red;">Roll Error or Cancelled</p>'}
                <hr style="margin: 5px 0;">
                <p style="margin: 2px 0; white-space: pre-wrap;"><strong>Outcome:</strong> ${outcomeMessage}</p>
                ${(totalUnitsConsumed > 0 || totalUnitsSaved > 0) ? `<p style="font-size:0.9em; color: #444; margin: 3px 0 0 0;"><em>(${totalUnitsConsumed} material units consumed, ${totalUnitsSaved} saved/kept)</em></p>` : ''}
                <p style="font-size:0.9em; color: #555; margin: 3px 0 0 0;"><em>GM Note: Verify material appropriateness (e.g., magical items).</em></p>
              </div>
              ${roll ? `<hr style="margin-top: 5px; margin-bottom: 3px;"> <div style="padding-top: 3px;">${await roll.render()}</div>` : ''}
            </div>`;

        await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            content: chatContent,
            sound: CONFIG.sounds.dice,
        });
        craftLog("INFO", "Chat message created successfully.");
        // --- END Chat Message ---

    } catch (error) {
        craftLog("ERROR", "--- Critical Error in attemptCrafting ---", error);
        ui.notifications.error("A critical error occurred during the crafting attempt. Check console (F12).");
        ChatMessage.create({
             user: game.user.id,
             speaker: ChatMessage.getSpeaker({ actor: actor }),
             content: `<strong style="color:red;">Crafting Error:</strong> An unexpected error occurred processing the craft attempt for ${targetData?.name || 'an item'}. Please see the console (F12) for details.`
         });
    } finally {
        craftLog("INFO", "--- Crafting Attempt End ---");
    }
} // --- END attemptCrafting Function ---

// --- Helper Function for Calculating Crafting Time ---
// Based on simplified interpretation or homebrew rules; PF2e RAW is more complex (Earn Income subsystem)
// This function provides a structured time based on level and proficiency.
function calculateCraftingTime(level, proficiencyRank) {
    craftLog("DEBUG", `Calculating base time for level ${level}, proficiency rank ${proficiencyRank}`);
    let baseTimeValue;
    let baseTimeUnit;

    // --- Determine Base Time Unit & Value based on Item Level ---
    // This is a highly simplified scale - ADJUST AS NEEDED for your game's pacing
    if (level <= 0) { baseTimeValue = 10; baseTimeUnit = "minute"; } // Very simple items
    else if (level <= 3) { baseTimeValue = 1; baseTimeUnit = "hour"; } // Low-level items
    else if (level <= 6) { baseTimeValue = 1; baseTimeUnit = "day"; } // Mid-low level
    else if (level <= 9) { baseTimeValue = 1; baseTimeUnit = "week"; } // Mid level
    else if (level <= 12) { baseTimeValue = 2; baseTimeUnit = "week"; } // Mid-high level
    else if (level <= 15) { baseTimeValue = 1; baseTimeUnit = "month"; } // High level
    else if (level <= 18) { baseTimeValue = 3; baseTimeUnit = "month"; } // Very high level
    else { baseTimeValue = 6; baseTimeUnit = "month"; } // Legendary / Artifact level baseline

    // --- Determine Time Multiplier based on Proficiency Rank ---
    // Proficiency ranks: 0=Untrained, 1=Trained, 2=Expert, 3=Master, 4=Legendary
    // Higher proficiency significantly reduces time. Adjust multipliers as desired.
    let multiplier;
    switch (proficiencyRank) {
        case 0: multiplier = 10; break;  // Untrained: Takes much longer (x4)
        case 1: multiplier = 1; break;  // Trained: Baseline (x1)
        case 2: multiplier = 0.75; break; // Expert: Faster (x0.75)
        case 3: multiplier = 0.5; break; // Master: Significantly faster (x0.5)
        case 4: multiplier = 0.25; break; // Legendary: Extremely fast (x0.25)
        default: multiplier = 1; break; // Default to Trained if rank is invalid
    }
    craftLog("DEBUG", `Base Time: ${baseTimeValue} ${baseTimeUnit}, Proficiency Multiplier: ${multiplier}`);

    // Apply Multiplier
    let finalTimeValue = baseTimeValue * multiplier;

    // --- Convert & Format Time String ---
    // Convert large fractions of units to smaller units for readability
    // (e.g., 0.5 weeks -> 3.5 days, 0.25 days -> 6 hours)

    if (baseTimeUnit === "month") {
        if (finalTimeValue < 1) { // Less than a month
            finalTimeValue *= 4; // Convert to weeks (approx)
            baseTimeUnit = "week";
        }
    }
    if (baseTimeUnit === "week") {
         if (finalTimeValue < 1) { // Less than a week
            finalTimeValue *= 7; // Convert to days
            baseTimeUnit = "day";
        }
    }
     if (baseTimeUnit === "day") {
        if (finalTimeValue < 1) { // Less than a day
            finalTimeValue *= 8; // Convert to hours (assuming 8-hour workday for crafting)
            // Alternative: finalTimeValue *= 24; for full day conversion
            baseTimeUnit = "hour";
        }
    }
    if (baseTimeUnit === "hour") {
         if (finalTimeValue < 1) { // Less than an hour
             finalTimeValue *= 60; // Convert to minutes
             baseTimeUnit = "minute";
         }
    }

    // Round to a reasonable precision and ensure a minimum time
    if (baseTimeUnit === "minute") {
        finalTimeValue = Math.max(1, Math.round(finalTimeValue)); // Min 1 minute, round to nearest minute
    } else if (baseTimeUnit === "hour") {
        finalTimeValue = Math.max(1, Math.round(finalTimeValue * 10) / 10); // Min 1 hour, round to 1 decimal place if fractional
        if (finalTimeValue === Math.floor(finalTimeValue)) finalTimeValue = Math.floor(finalTimeValue); // Show whole number if it rounds cleanly
    } else if (baseTimeUnit === "day") {
         finalTimeValue = Math.max(1, Math.round(finalTimeValue * 10) / 10); // Min 1 day, round to 1 decimal
         if (finalTimeValue === Math.floor(finalTimeValue)) finalTimeValue = Math.floor(finalTimeValue);
    }
     else { // Weeks, Months
        finalTimeValue = Math.max(1, Math.round(finalTimeValue)); // Round to nearest whole unit, min 1
    }


    // Handle pluralization
    const unitString = (finalTimeValue === 1) ? baseTimeUnit : `${baseTimeUnit}s`;
    const timeString = `${finalTimeValue} ${unitString}`;

    craftLog("INFO", `Final Calculated Crafting Time: ${timeString}`);
    return timeString;
}


// --- Final log indicating the script has been parsed ---
craftLog('INFO', 'PF2e Custom Crafting Module Script Initialized and Ready.');