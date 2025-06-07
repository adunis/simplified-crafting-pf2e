# Simplified Crafting PF2e

[![Foundry Core Compatible Version](https://img.shields.io/badge/Foundry%20Version-v10%2B-informational)](https://foundryvtt.com/)
[![PF2e System Compatible Version](https://img.shields.io/badge/PF2e%20System-4.x%2B-success)](https://foundryvtt.com/packages/pf2e)
<!-- Optional: Add License Badge e.g., [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) -->
<!-- Optional: Add Manifest Link Badge e.g., [![Forge Installs](https://img.shields.io/badge/Forge%20Installs- %25/%25-red?style=plastic&logo=forge-vtt)](https://forge-vtt.com/bazaar#package=simplified-crafting-pf2e) -->

A module for the Pathfinder 2e system on Foundry VTT that modifies and enhances the crafting, identification, and reverse engineering processes.

## Overview

This module streamlines item interaction in PF2e campaigns on Foundry VTT, offering:

1.  **Simplified Crafting:** A custom material selection and outcome system.
2.  **Enhanced Identification:** A detailed workflow with multiple approaches, feat integration, and unique outcomes.
3.  **Reverse Engineering:** A system to learn formulas by disassembling items.
4.  **UI Enhancements:** Integrated controls on Character Sheet tabs.

## Key Features

---

### 1. Simplified Crafting

Streamlines the creation of items from known formulas.

*   **Custom Workflow:**
    *   Replaces the default "Craft" button action on the character sheet's Crafting tab.
*   **Material Selection Dialog:**
    *   Select specific inventory items as materials.
    *   Materials must be worth at least **half the target item's price**.
    *   Calculates total value of selected materials and estimates potential quantity.
    *   Warns if crafting `magical` or `alchemical` items, reminding of feat requirements and component nature (GM discretion for magical components).
*   **Automatic Time Calculation:**
    *   Estimates crafting time per item based on target item level and crafter's Crafting proficiency.
*   **Crafting Skill Check:**
    *   Uses a standard PF2e Crafting skill check.
    *   DC is based on item level, rarity, and any item-specific DC.
*   **Outcome-Based Crafting:**
    *   **Critical Success:** Crafts item(s). Consumes ~50% of selected materials (random chance per unit).
    *   **Success:** Crafts item(s). Consumes 100% of selected materials.
    *   **Failure:** Crafts nothing. Consumes ~50% of selected materials.
    *   **Critical Failure:** Crafts nothing. Consumes 100% of selected materials (ruined).
    *   *Quantity Crafted:* Determined by the total value of materials provided relative to the **required material cost (half price)** of a single target item.
*   **Item Creation & Details:**
    *   Adds crafted items to inventory.
    *   Appends `(Crafted by [Actor Name])` to the item's name.
    *   Adds a note about materials used and crafting date to the item's description.
*   **Feedback:**
    *   Detailed chat message summarizing the attempt.
    *   Sound effects and scrolling text over the token for success/failure.

---

### 2. Enhanced Identification

Provides a comprehensive system for identifying unknown items.

*   **"Identify Items" Button:**
    *   Added to the Inventory tab controls.
*   **Identification Approaches:**
    *   **Detect Magic:** Scans items, reveals if a magical aura is present.
    *   **Read Aura:** Scans items, reveals magical aura and any detected school(s) of magic.
    *   **Identify Directly:** Skips preliminary scanning.
*   **Scanning Process (Detect/Read Aura):**
    *   Iterates through unidentified items one by one.
    *   **Does NOT automatically identify non-magical items.**
    *   In the subsequent dialog, items are marked as "MAGICAL" or "NOT MAGICAL" based on the scan.
    *   All items (magical or not) proceed to the skill check phase if the player chooses to identify them.
*   **Skill Check & Feat Integration:**
    *   **DC Calculation:** Based on item level, rarity, and any item-specific DC.
    *   **Skill Choice:** Allows using Arcana, Nature, Occultism, Religion, or **Crafting**.
        *   **Crafting Skill:**
            *   Can be used to attempt to identify *any* item (magical or non-magical).
            *   If used on a **MAGICAL** item, the attempt will **automatically fail** unless the character possesses the `Crafter's Appraisal` feat.
        *   **Other Skills (Arcana, Nature, etc.):**
            *   If used on a **NON-MAGICAL** item, the attempt will **automatically fail**.
    *   Society can be used via `Scholastic Identification` feat.
    *   Displays skill modifiers and supports feats like `Oddity Identification`.
*   **Bulk Identification:**
    *   **Identify All:** Attempts to identify all listed items.
    *   **Identify Only Magical:** Filters and attempts only items marked/known as magical.
    *   **Identify Only Non-Magical:** Filters and attempts only items marked/known as non-magical.
    *   These options are free of GP cost.
    *   A summary chat message includes the estimated total time for bulk attempts.
*   **Supported Feats:**
    *   `Scholastic Identification` (Use Society)
    *   `Assured Identification` (Crit Fail becomes Fail)
    *   `Quick Identification` (Reduces time)
    *   `Crafter's Appraisal` (Enables Crafting for magical item ID)
    *   `Oddity Identification` (Conditional bonus)
*   **Outcome Handling:**
    *   **Critical Success / Success:** Item becomes identified.
    *   **Failure:** Item remains unidentified. A temporary marker prevents the *same actor* from retrying that specific item with that specific skill until they level up.
    *   **Critical Failure (Deceptive Misidentification):**
        *   The original item is secretly deleted.
        *   A random, common physical item of similar type/level is created in its place.
        *   Player sees a "Success" and the replacement item.
        *   GM sees the true outcome and a note on the replacement item.
        *   `Assured Identification` feat prevents this, resulting in a normal Failure.
*   **Feedback:**
    *   Detailed chat message (blind to GM by default) for each attempt.
    *   Sound effects for scanning and identification results.

---

### 3. Reverse Engineering

Allows characters to learn formulas from existing items.

*   **"Reverse Engineer" Button:**
    *   Added to the Crafting tab controls.
*   **Item Selection:**
    *   Prompts selection of a suitable item from inventory (physical, non-artifact, has a `sourceId`, formula not already known).
*   **Reverse Engineering Check:**
    *   Crafting skill check against a DC based on item level/rarity.
*   **Outcome Handling:**
    *   **Critical Success:** Learns formula. Item is **NOT** destroyed.
    *   **Success:** Learns formula. Item **IS** destroyed.
    *   **Failure / Critical Failure:** Formula not learned. Item **IS** destroyed.
*   **Feedback:**
    *   Chat message summarizing the attempt.
    *   Sound effects.

---

### 4. UI Enhancements

*   **Inventory Tab:**
    *   Adds "Identify Items" button.
*   **Crafting Tab:**
    *   Adds "Reverse Engineer" button.
    *   Removes core "Toggle Free Crafting" button.
    *   Removes core quantity inputs for formulas (quantity is based on material value).
    *   Displays "Relevant Crafting Feats" with compendium links.
    *   Disables craft button and shows warning icons for formulas if required `Magical Crafting` or `Alchemical Crafting` feats are missing.

---

## Installation

1.  Go to Foundry VTT's "Add-on Modules" tab.
2.  Click "Install Module".
3.  Paste the Manifest URL: `https://github.com/adunis/simplified-crafting-pf2e/releases/latest/download/module.json`
4.  Click "Install" and enable "Simplified Crafting PF2e" in your World Settings.

## Usage Guide

*   **Crafting:**
    1.  Go to the "Crafting" tab on a character sheet.
    2.  Click the <i class="fas fa-hammer"></i> (Craft) button next to a known formula.
    3.  Select materials in the dialog and click "Attempt Craft".
*   **Identification:**
    1.  Go to the "Inventory" tab.
    2.  Click the "Identify Items" button.
    3.  Choose your approach (Detect, Read, Direct).
    4.  Follow prompts to select items (individually or via bulk options) and perform skill checks.
*   **Reverse Engineering:**
    1.  Go to the "Crafting" tab.
    2.  Click the "Reverse Engineer" button.
    3.  Select an item from the dropdown and click "Attempt".

## Compatibility Notes

*   **System:** Pathfinder 2e (PF2e) - Version 4.x+ recommended.
*   **Foundry VTT:** Version 10+ recommended.
*   **Potential Conflicts:** This module heavily modifies the Inventory and Crafting tabs of `CharacterSheetPF2e`. Conflicts may occur with other modules that alter these specific areas or button actions.

## Key Module-Specific Rules

*   **Deceptive Identification:** The critical failure outcome for Identification is unique to this module. GMs should inform players if this mechanic is active.
*   **Material Consumption in Crafting:** Specific rules for material loss on different crafting outcomes.
*   **Crafting Feat Requirements:** `Magical Crafting` and `Alchemical Crafting` feats are strictly enforced by this module for relevant items.
*   **Identification Skill Rules:** Crafting skill has specific rules for identifying magical vs. non-magical items (see "Enhanced Identification" feature details).

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Acknowledgements

*   Paizo Inc. for the Pathfinder Roleplaying Game.
*   The Foundry VTT team and community.
*   The developers of the Foundry VTT PF2e System.