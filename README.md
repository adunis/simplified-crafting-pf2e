# Simplified Crafting PF2e

[![Foundry Core Compatible Version](https://img.shields.io/badge/Foundry%20Version-v10%2B-informational)](https://foundryvtt.com/)
[![PF2e System Compatible Version](https://img.shields.io/badge/PF2e%20System-4.x%2B-success)](https://foundryvtt.com/packages/pf2e)
<!-- Optional: Add License Badge e.g., [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) -->
<!-- Optional: Add Manifest Link Badge e.g., [![Forge Installs](https://img.shields.io/badge/Forge%20Installs- %25/%25-red?style=plastic&logo=forge-vtt)](https://forge-vtt.com/bazaar#package=simplified-crafting-pf2e) -->

A module for the Pathfinder 2e system on Foundry VTT that modifies and enhances the crafting, identification, and reverse engineering processes.

## Overview

This module aims to streamline certain aspects of item interaction in PF2e campaigns running on Foundry VTT. It provides:

1.  **Simplified Crafting:** Intercepts the standard crafting process with a custom material selection dialog and outcome handling based on the crafting check.
2.  **Enhanced Identification:** Adds a dedicated workflow for identifying items, supporting different approaches (Detect Magic, Read Aura, Direct Skill Check) and specific identification feats. Includes a unique (and potentially dangerous!) outcome for critical identification failures.
3.  **Reverse Engineering:** Introduces an action to attempt learning a formula by disassembling an existing item.
4.  **UI Enhancements:** Modifies the Character Sheet's Inventory and Crafting tabs for better integration of these features.

## Features

### 1. Simplified Crafting

*   **Custom Workflow:** Replaces the default "Craft" button action on the character sheet's Crafting tab for known formulas.
*   **Material Selection:** Opens a dialog allowing the player to select specific items from their inventory to use as materials.
    *   Calculates the total value of selected materials.
    *   Requires materials worth at least half the item's Price.
    *   Shows potential quantity based on value (for estimation only).
    *   Warns if the item is `magical` and requires appropriate components (GM discretion).
*   **Time Calculation:** Automatically calculates the estimated crafting time per item based on the target item's level and the character's Crafting proficiency rank.
*   **Crafting Check:** Prompts the standard PF2e skill check dialog for Crafting against the item's DC (or a calculated DC if none is specified).
*   **Outcome Handling:**
    *   **Critical Success:** Crafts item(s) (potentially multiple based on value provided vs. cost). Consumes roughly 50% of the selected materials (random chance per unit).
    *   **Success:** Crafts item(s) (based on value provided vs. cost). Consumes 100% of the selected materials.
    *   **Failure:** Crafts nothing. Consumes roughly 50% of the selected materials.
    *   **Critical Failure:** Crafts nothing. Consumes 100% of the selected materials (ruined).
*   **Item Creation:** Adds the successfully crafted item(s) to the actor's inventory. Appends `(Crafted by [Actor Name])` to the item name/details and adds a note about materials used to the description.
*   **Chat Message:** Posts a detailed chat message summarizing the attempt, roll, materials, time, and outcome.
*   **Sounds & Effects:** Plays sounds for success/failure and displays scrolling text over the token.

### 2. Enhanced Identification

*   **Identify Button:** Adds an "Identify Magic Items" button to the Inventory tab controls.
*   **Identification Workflow:**
    *   Presents options: Detect Magic, Read Aura, or Identify Directly.
    *   Supports identifying items across selected tokens or the user's character.
*   **Scanning (Detect/Read Aura):**
    *   Simulates scanning items one by one (with sound effects).
    *   Automatically identifies non-magical items.
    *   Optionally reveals magical aura presence (Detect) or aura + school(s) (Read Aura).
    *   Presents remaining unidentified *magical* items for skill checks.
*   **Direct Identification:** Skips scanning and presents *all* unidentified items for skill checks.
*   **Skill Check Prompt:**
    *   Calculates the Identification DC based on the item's level and rarity (or uses item-specific DC).
    *   Prompts the user to choose an appropriate skill (Arcana, Nature, Occultism, Religion, plus Society or Crafting if relevant feats are present and requirements met).
    *   Displays the modifier for each available skill.
    *   Supports applying bonuses/effects from feats like `Oddity Identification`.
*   **Feat Support:** Recognizes and applies effects/options for:
    *   `Scholastic Identification` (Use Society)
    *   `Assured Identification` (Crit Fail becomes Fail)
    *   `Quick Identification` (Reduces time)
    *   `Crafter's Appraisal` (Use Crafting for magic items)
    *   `Oddity Identification` (Conditional bonus)
*   **Outcome Handling:**
    *   **Critical Success / Success:** Item becomes identified.
    *   **Failure:** Item remains unidentified. A marker is added preventing the *same actor* from retrying until they gain a level.
    *   **Critical Failure (Deceptive):** This is a special, module-specific outcome:
        *   The *original* item is secretly deleted from the actor's inventory.
        *   A *different*, randomly selected physical item (weapon, armor, equipment, consumable, etc.) from common compendiums is created in its place.
        *   To the *player*, the roll appears as a **Success**, and they see the *replacement* item as if it were correctly identified.
        *   The *GM* sees the true critical failure result in the chat log and a GM note is added to the *replacement* item detailing the original item and the misidentification.
        *   *Note:* `Assured Identification` prevents this deceptive outcome, resulting in a normal Failure instead.
*   **Chat Message:** Posts a chat message (blind to GM by default, showing player outcome) detailing the attempt, skill used, roll result, and outcome (including deceptive status for GM).
*   **Sounds & Effects:** Plays sounds for scanning and identification results.

### 3. Reverse Engineering

*   **Reverse Engineer Button:** Adds a "Reverse Engineer" button to the Crafting tab controls.
*   **Item Selection:** Prompts the user to select a suitable item from their inventory to disassemble.
    *   Suitable items are typically physical items (weapon, armor, equipment, consumable, treasure) that originate from a compendium (`sourceId` is present), are not artifacts, and whose formula is not already known by the actor.
*   **Reverse Engineering Check:** Prompts a Crafting skill check against a calculated DC based on the item's level/rarity (or item-specific DC).
*   **Outcome Handling:**
    *   **Critical Success:** The actor learns the item's formula (added to their Crafting tab). The item is **NOT** destroyed.
    *   **Success:** The actor learns the item's formula. The item **IS** destroyed.
    *   **Failure:** The formula is not learned. The item **IS** destroyed.
    *   **Critical Failure:** The formula is not learned. The item **IS** destroyed.
*   **Formula Management:** Adds the learned formula's UUID to the actor's crafting entry.
*   **Chat Message:** Posts a chat message summarizing the attempt, roll, DC, and outcome, indicating if the formula was learned and if the item was destroyed.
*   **Sounds & Effects:** Plays sounds for the attempt and result.

### 4. UI Enhancements

*   **Inventory Tab:** Adds the "Identify Magic Items" button.
*   **Crafting Tab:**
    *   Adds the "Reverse Engineer" button.
    *   Removes the core "Toggle Free Crafting" button.
    *   Removes the core quantity headers and inputs for formulas (as quantity is handled by material value).
    *   Adds a "Relevant Crafting Feats" section displaying the character's known crafting-related feats (from a predefined list in the code) with compendium links.
    *   Disables the craft button and adds a warning icon (<i class="fas fa-exclamation-triangle" style="color:red;"></i>) next to formulas that require `Magical Crafting` or `Alchemical Crafting` if the actor lacks the respective feat.

## Installation

1.  Go to the Add-on Modules tab in the Foundry VTT setup screen.
2.  Click "Install Module".
3.  In the "Manifest URL" field, paste the following link:

    `https://github.com/adunis/simplified-crafting-pf2e/releases/latest/download/module.json`

4.  Click "Install".
5.  Enable the "Simplified Crafting PF2e" module in your World Settings.

## Usage

*   **Crafting:** Navigate to the "Crafting" tab on the character sheet. Find a known formula. Click the <i class="fas fa-hammer"></i> (Craft) button next to it. Select materials in the dialog and click "Attempt Craft".
*   **Identification:** Navigate to the "Inventory" tab. Click the "Identify Magic Items" button in the controls area. Choose your approach (Detect, Read, Direct) and follow the prompts to select items and perform skill checks.
*   **Reverse Engineering:** Navigate to the "Crafting" tab. Click the "Reverse Engineer" button in the controls area above the formulas list. Select an item from the dropdown and click "Attempt".

## Compatibility

*   **Required System:** Pathfinder 2e (PF2e) - Version 4.x or higher recommended.
*   **Required Foundry VTT:** Version 10 or higher recommended.
*   **Potential Conflicts:** This module significantly modifies the Inventory and Crafting tabs of the `CharacterSheetPF2e`. Conflicts *might* arise with other modules that heavily alter these same tabs or intercept the same button actions. Generally compatible with modules that add new tabs or modify other parts of the sheet.

## Key Differences & Considerations

*   **Deceptive Identification:** The critical failure result for Identification is a custom rule specific to this module and can be surprising or confusing if players aren't aware of the possibility. GMs should decide if this mechanic fits their game.
*   **Material Consumption:** The rules for how much material is consumed on different crafting outcomes (especially the 50% chance on Crit Success/Failure) are specific to this module.
*   **No Batch Crafting Input:** The module removes the default quantity input for crafting formulas. The number of items crafted is determined by the value of materials provided relative to the item cost and the degree of success.
*   **Feat Requirements:** Crafting magical or alchemical items strictly requires the corresponding feat if this module is active.

## License

<!-- Replace with your chosen license -->
This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details (if you add one).

## Acknowledgements

*   Paizo Inc. for the Pathfinder Roleplaying Game and Pathfinder 2e system.
*   The Foundry VTT team.
*   The developers of the Foundry VTT Pathfinder 2e System implementation.