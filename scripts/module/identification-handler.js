import {
  MODULE_ID,
  SETTINGS,
  DEFAULT_SUPPORTED_IDENTIFY_FEATS_CONFIG,
  DEFAULT_IDENTIFY_ICONS_SKILL_MAP,
  DEFAULT_IDENTIFY_ICONS_SKILL_TOOLTIPS,
  DEFAULT_IDENTIFY_ICONS_SKILL_DATA_MAP,
} from "./constants.js";
import { getSetting, getParsedJsonSetting } from "./settings.js";

export class IdentificationHandler {
  constructor(dcCalculator, utils) {
    this.dcCalculator = dcCalculator;
    this.utils = utils;

    this.identifyFeatsConfig = this._getIdentifyFeatsConfig();
    this.identifyIcons = {
      skill: DEFAULT_IDENTIFY_ICONS_SKILL_MAP,
      skillTooltips: DEFAULT_IDENTIFY_ICONS_SKILL_TOOLTIPS,
      skillDataMap: DEFAULT_IDENTIFY_ICONS_SKILL_DATA_MAP,
      school: {
        abjuration: "fa-shield-alt",
        conjuration: "fa-magic",
        divination: "fa-eye",
        enchantment: "fa-brain",
        evocation: "fa-bolt",
        illusion: "fa-mask",
        necromancy: "fa-skull-crossbones",
        transmutation: "fa-atom",
      },
    };
    this._internalSpellInfo = {
      detect: {
        slug: "detect-magic",
        name: "Detect Magic",
        icon: "fa-search-location",
      },
      read: { slug: "read-aura", name: "Read Aura", icon: "fa-book-reader" },
    };
  }

  _getIdentifyFeatsConfig = () => {
    const defaults = DEFAULT_SUPPORTED_IDENTIFY_FEATS_CONFIG;
    const scholasticSlug = getSetting(SETTINGS.SCHOLASTIC_IDENTIFICATION_SLUG);
    const assuredSlug = getSetting(SETTINGS.ASSURED_IDENTIFICATION_SLUG);
    const quickSlug = getSetting(SETTINGS.QUICK_IDENTIFICATION_SLUG);
    const craftersSlug = getSetting(SETTINGS.CRAFTERS_APPRAISAL_SLUG);
    const odditySlug = getSetting(SETTINGS.ODDITY_IDENTIFICATION_SLUG);
    const config = {};
    if (scholasticSlug)
      config[scholasticSlug] = {
        ...defaults["scholastic-identification"],
        name: "Scholastic Identification",
        slug: scholasticSlug,
        requiresMaster: getSetting(
          SETTINGS.SCHOLASTIC_IDENTIFICATION_REQ_MASTER
        ),
      };
    if (assuredSlug)
      config[assuredSlug] = {
        ...defaults["assured-identification"],
        name: "Assured Identification",
        slug: assuredSlug,
      };
    if (quickSlug)
      config[quickSlug] = {
        ...defaults["quick-identification"],
        name: "Quick Identification",
        slug: quickSlug,
      };
    if (craftersSlug)
      config[craftersSlug] = {
        ...defaults["crafters-appraisal"],
        name: "Crafter's Appraisal",
        slug: craftersSlug,
      };
    if (odditySlug) {
      const oddityBonus = getSetting(SETTINGS.ODDITY_IDENTIFICATION_BONUS);
      config[odditySlug] = {
        ...defaults["oddity-identification"],
        name: `Oddity Identification (+${oddityBonus} Circ.)`,
        slug: odditySlug,
        description: `Gain a +${oddityBonus} circumstance bonus...`,
        modifier: {
          label: `Oddity Identification (+${oddityBonus} Conditional)`,
          slug: `${odditySlug}-bonus`,
          type: "circumstance",
          modifier: oddityBonus,
        },
        requiresTrainedOccultism: getSetting(
          SETTINGS.ODDITY_IDENTIFICATION_REQ_TRAINED_OCC
        ),
      };
    }
    return config;
  };

  getStyles = () => ({
    successColor: getSetting(SETTINGS.SUCCESS_COLOR),
    failureColor: getSetting(SETTINGS.FAILURE_COLOR),
    infoColor: getSetting(SETTINGS.INFO_COLOR),
    neutralColor: getSetting(SETTINGS.NEUTRAL_COLOR),
  });
  getSounds = () => ({
    detectMagic: getSetting(SETTINGS.SOUND_DETECT_MAGIC),
    success: getSetting(SETTINGS.SOUND_SUCCESS),
    failure: getSetting(SETTINGS.SOUND_FAILURE),
  });
  getIdentifySpellInfo = () => ({
    compendium: getSetting(SETTINGS.IDENTIFY_SPELL_COMPENDIUM),
    detect: {
      id: getSetting(SETTINGS.DETECT_MAGIC_SPELL_ID),
      slug: this._internalSpellInfo.detect.slug,
      name: this._internalSpellInfo.detect.name,
      icon: this._internalSpellInfo.detect.icon,
    },
    read: {
      id: getSetting(SETTINGS.READ_AURA_SPELL_ID),
      slug: this._internalSpellInfo.read.slug,
      name: this._internalSpellInfo.read.name,
      icon: this._internalSpellInfo.read.icon,
    },
  });
  getWronglyIdentifiedConfig = () => ({
    prefix: getSetting(SETTINGS.WRONGLY_IDENTIFIED_PREFIX),
    desc: getSetting(SETTINGS.WRONGLY_IDENTIFIED_DESC),
    deceptiveMarker: getSetting(SETTINGS.DECEPTIVE_CRIT_FAIL_MARKER),
    originalDataFlag: getSetting(SETTINGS.CRIT_FAIL_ORIGINAL_DATA_FLAG),
  });

  _parseTimeTakenStringToMinutes(timeString) {
    if (!timeString || typeof timeString !== "string") return 0;
    const lowerTime = timeString.toLowerCase();
    if (lowerTime.includes("action")) return 0.1;
    const numberMatch = lowerTime.match(/(\d+(\.\d+)?)/);
    if (!numberMatch) return 0;
    const value = parseFloat(numberMatch[1]);
    if (lowerTime.includes("minute")) return value;
    if (lowerTime.includes("hour")) return value * 60;
    if (lowerTime.includes("day")) return value * 60 * 8;
    return 0;
  }

// In scripts/module/identification-handler.js

  _showIdentifyItemsDialog = async (actor, itemsToIdentify, scanResultsData, scanType) => {
    if (!itemsToIdentify || itemsToIdentify.length === 0) return;
    itemsToIdentify.sort((a, b) => a.item.name.localeCompare(b.item.name));
    const styles = this.getStyles();
    const currentIdentifySpellInfo = this.getIdentifySpellInfo();
    let cantripLinkHTML = "", spellInfoForLink = null;
    if (scanType === "detect") spellInfoForLink = currentIdentifySpellInfo.detect;
    else if (scanType === "read") spellInfoForLink = currentIdentifySpellInfo.read;
    if (spellInfoForLink) cantripLinkHTML = `<div style="margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid #ccc;"><p style="margin:0;">Initial Scrutiny via: ${this.utils.createIdentifyLink(spellInfoForLink.id,spellInfoForLink.name,spellInfoForLink.icon )}</p></div>`;
    else if (scanType === "identify") cantripLinkHTML = `<div style="margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid #ccc;"><p style="margin:0;font-style:italic;color:${styles.neutralColor};">Direct identification attempt.</p></div>`;
    
    let itemListHTML = itemsToIdentify.map(({ actor: itemActor, item }) => {
        const scanResult = scanResultsData.get(item.id); 
        const scholasticFeatSlug = getSetting(SETTINGS.SCHOLASTIC_IDENTIFICATION_SLUG);
        const scholasticFeatConfig = this.identifyFeatsConfig[scholasticFeatSlug];
        let scanDisplay = "";
        const itemIsMagical = scanResult ? scanResult.isMagical : item.traits.has("magical"); // Use scan if available, else trait
        if (itemIsMagical) {
            let sDisplay = "";
            if (scanType === "read" && scanResult && scanResult.schools.length > 0) sDisplay = `<span style="font-size:0.9em;color:#3a2151;margin-left:5px;">(School(s): ${scanResult.schools.map(s =>`<i class="fas ${this.identifyIcons.school[s] || "fa-question-circle"}" title="${s.charAt(0).toUpperCase() + s.slice(1)}"></i>`).join(" ")} )</span>`;
            else if (scanType === "read") sDisplay = `<span style="font-size:0.9em;color:#777;margin-left:5px;">(No School Determined)</span>`;
            scanDisplay = `<span style="color:${styles.infoColor};font-weight:bold;margin-right:5px;">MAGICAL</span>${sDisplay}`;
        } else if (scanType === "detect" || scanType === "read") scanDisplay = `<span style="color:${styles.neutralColor};font-style:italic;margin-right:10px;">(NOT MAGICAL)</span>`;
        else scanDisplay = `<span style="color:${styles.neutralColor};font-style:italic;margin-right:10px;">(Direct)</span>`;
        let itemSkills = new Set(["arc", "nat", "occ", "rel", "cra"]); 
        if (scholasticFeatConfig && itemActor.itemTypes.feat.some(f => f.slug === scholasticFeatSlug)) itemSkills.add(scholasticFeatConfig.substituteSkill);
        const traitSkills = new Set(); item.traits.forEach(t => { if (t === "arcane") traitSkills.add("arc"); if (t === "primal") traitSkills.add("nat"); if (t === "occult") traitSkills.add("occ"); if (t === "divine") traitSkills.add("rel");});
        const finalSkillHints = traitSkills.size > 0 && itemIsMagical ? Array.from(traitSkills) : Array.from(itemSkills);
        const skillHintDisplay = `<span style="font-size:0.9em;color:#555;margin-left:8px;">(Suggests: ${finalSkillHints.map(s =>`<i class="fas ${this.identifyIcons.skill[s] || "fa-question-circle"}" title="${this.identifyIcons.skillTooltips[s] || "Unknown Skill"}"></i>`).join(" ")} )</span>`;
        let failureNotice = "", disabledAttribute = ""; const itemActorLevel = itemActor.level; const failMarkerPattern = new RegExp(`<!-- failureMarker:Fail_${itemActor.id}_L(\\d+) -->`); const unidDesc = item.system.identification?.unidentified?.data?.description?.value ?? ""; const match = unidDesc.match(failMarkerPattern);
        if (match) { const failedAtLevel = parseInt(match[1], 10); if (itemActorLevel <= failedAtLevel) { failureNotice = `<span style="color:${styles.failureColor};font-weight:bold;margin-left:10px;" title="Failed ID at L${failedAtLevel} by ${itemActor.name}. Requires L${failedAtLevel + 1}."><i class="fas fa-exclamation-triangle"></i> Failed (L${failedAtLevel})</span>`; disabledAttribute = "disabled"; }}
        return `<div style="display:flex;align-items:center;margin-bottom:8px;padding:5px;border:1px solid #888;border-radius:3px;background:rgba(0,0,0,0.03);"><img src="${item.img}" title="${item.name} (Held by ${itemActor.name})" width="36" height="36" style="margin-right:10px;flex-shrink:0;border:none;"><div style="flex-grow:1;margin-right:10px;"><label style="font-weight:bold;color:#191813;display:block;">${item.name}</label><span style="font-size:0.9em;color:#444;">By <em>${itemActor.name}</em></span> ${skillHintDisplay} ${failureNotice}</div><div style="flex-shrink:0;text-align:right;margin-right:10px;">${scanDisplay}</div><button type="button" data-actor-id="${itemActor.id}" data-item-id="${item.id}" style="flex-shrink:0;width:130px;cursor:${disabledAttribute ? "not-allowed" : "pointer"};" ${disabledAttribute}><i class="fas fa-search-plus"></i> Attempt Identify</button></div>`;
      }).join("");
    const quickIdSlug = getSetting(SETTINGS.QUICK_IDENTIFICATION_SLUG); const anyActorHasQuickId = itemsToIdentify.some(({ actor: itemActor }) => itemActor.itemTypes.feat.some((f) => f.slug === quickIdSlug)); const timeText = anyActorHasQuickId ? "10 min (maybe faster)" : "10 min";
    let dialogTitle = "Identify Items"; 
    let content = `<div style="text-align:center;margin-bottom:10px;"><i class="fas fa-book-dead fa-2x" style="color:#5a3a6b;"></i></div><h3 style="color:#191813;text-align:center;">${dialogTitle}</h3>${cantripLinkHTML}<p>Select an item. Time: ${timeText} per item (Quick ID may reduce).</p><p style="font-size:0.85em;color:#600;"><em><i class="fas fa-exclamation-triangle" style="color:darkred;"></i><strong> Failed (LX):</strong> Cannot retry until Level X+1 by same actor.</em></p><hr><form style="max-height:350px;overflow-y:auto;margin-bottom:10px;">${itemListHTML}</form>`;
    const dialogButtons = { cancel: { label: "Cancel", icon: '<i class="fas fa-times"></i>', callback: () => ui.notifications.info("Identification cancelled.")}};
    const currentHandlerInstance = this; 

    if (itemsToIdentify.length > 1) {
        dialogButtons.identifyAll = { 
            label: `Identify All (${itemsToIdentify.length})`, 
            icon: '<i class="fas fa-layer-group"></i>', 
            callback: async () => { 
                if (!currentHandlerInstance) { console.error("ERROR: currentHandlerInstance (this) is undefined in Identify All callback!"); ui.notifications.error("Critical error: Identify handler context lost."); return; }
                if (typeof currentHandlerInstance._attemptBulkIdentification !== 'function') { console.error("ERROR: _attemptBulkIdentification is not a function on currentHandlerInstance!", currentHandlerInstance); ui.notifications.error("Critical error: Bulk identification method missing."); return; }
                await currentHandlerInstance._attemptBulkIdentification(actor, itemsToIdentify); 
            }
        };
        const magicalItems = itemsToIdentify.filter(entry => (scanResultsData.get(entry.item.id)?.isMagical ?? entry.item.traits.has("magical")));
        if (magicalItems.length > 0) {
            dialogButtons.identifyMagical = {
                label: `ID Only Magical (${magicalItems.length})`,
                icon: '<i class="fas fa-hat-wizard"></i>',
                callback: async () => {
                    if (!currentHandlerInstance) { /* error */ return; }
                    await currentHandlerInstance._attemptBulkIdentification(actor, magicalItems);
                }
            };
        }
        const nonMagicalItems = itemsToIdentify.filter(entry => !(scanResultsData.get(entry.item.id)?.isMagical ?? entry.item.traits.has("magical")));
        if (nonMagicalItems.length > 0) {
             dialogButtons.identifyNonMagical = {
                label: `ID Only Non-Magical (${nonMagicalItems.length})`,
                icon: '<i class="fas fa-tools"></i>',
                callback: async () => {
                    if (!currentHandlerInstance) { /* error */ return; }
                    await currentHandlerInstance._attemptBulkIdentification(actor, nonMagicalItems);
                }
            };
        }
    }

    const identifyDialog = new Dialog({ title: dialogTitle, content: content, buttons: dialogButtons, render: (html) => { html.on("click", ".content-link", (event) => { const el = event.currentTarget; const pack = game.packs.get(el.dataset.pack); if (pack && el.dataset.id) pack.getDocument(el.dataset.id).then((d) => d?.sheet.render(true)); }); html.find("button[data-item-id]:not([disabled])").on("click", async (event) => { const button = event.currentTarget; button.disabled = true; button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Identifying...`; const actorId = button.dataset.actorId, itemId = button.dataset.itemId; const itemActor = game.actors.get(actorId), item = itemActor ? itemActor.items.get(itemId) : null; if (!itemActor || !item) { ui.notifications.error("Item or Actor not found!"); button.disabled = false; button.innerHTML = `<i class="fas fa-search-plus"></i> Attempt Identify`; return; } try { identifyDialog.close({ force: true }); } catch (e) {} await this._attemptIdentification(itemActor, item); }); }}, { width: 650 });
    identifyDialog.render(true);
  };

  _promptIdentifySkill = async (actor, item, dc, possibleSkills, actorFeatsForPrompt) => {
    let skillButtons = {}, featCheckboxesHTML = "", defaultSkill = null, maxMod = -Infinity; const odditySlug = getSetting(SETTINGS.ODDITY_IDENTIFICATION_SLUG); const toggleableFeats = actorFeatsForPrompt.filter(feat => feat.type === "roll_modifier"); let featToggleIntro = false;
    toggleableFeats.forEach((feat) => { let canShowToggle = true; if (feat.slug === odditySlug && feat.requiresTrainedOccultism) canShowToggle = (actor.skills.occultism?.rank ?? 0) > 0; if (canShowToggle) { if (!featToggleIntro) { featCheckboxesHTML += `<hr><p style="font-weight:bold;margin-bottom:3px;"><i class="fas fa-star-of-life"></i> Apply Techniques?</p><p style="font-size:0.9em;font-style:italic;margin-top:-2px;margin-bottom:5px;">Select if conditions met:</p>`; featToggleIntro = true; } featCheckboxesHTML += `<div style="margin-top:5px;margin-left:10px;font-size:0.9em;"><input type="checkbox" id="feat-toggle-${feat.slug}" name="feat-${feat.slug}" value="${feat.slug}"><label for="feat-toggle-${feat.slug}" title="${feat.description || ""}">${feat.name}${feat.slug === odditySlug ? '<i style="font-weight:normal;color:#555;"> (If mental/divination/etc.)</i>' : ""}</label></div>`; }});
    if (featCheckboxesHTML) featCheckboxesHTML += "<hr>";
    return new Promise((resolve) => {
      possibleSkills.forEach((slug) => { const fullSkillName = this.identifyIcons.skillDataMap[slug]; if (!fullSkillName) return; const statistic = actor.getStatistic(fullSkillName); if (!statistic) return; const mod = statistic.check.mod; const icon = this.identifyIcons.skill[slug] || "fa-question-circle"; skillButtons[slug] = { label: `${statistic.label} (${mod >= 0 ? "+" : ""}${mod})`, icon: `<i class="fas ${icon}"></i>`, callback: (html) => { const selectedFeats = []; html.find('input[name^="feat-"]:checked').each(function () { selectedFeats.push($(this).val()); }); resolve({ skillSlug: slug, selectedFeatSlugs: selectedFeats }); }}; if (mod > maxMod) { maxMod = mod; defaultSkill = slug; }});
      if (Object.keys(skillButtons).length === 0) { ui.notifications.error(`No suitable skills for ${actor.name} to ID ${item.name}.`); resolve(null); return; }
      let dialogContent = `<div style="text-align:center;"><i class="fas fa-brain fa-2x" style="color:#888;"></i></div><p><em>${actor.name}</em>, choose skill to ID <strong>${item.name}</strong>.</p><p style="text-align:center;font-size:1.1em;">Item DC ${dc}</p>${featCheckboxesHTML}<p>Select skill:</p>`;
      new Dialog({ title: `Channel Knowledge: ${item.name}`, content: dialogContent, buttons: skillButtons, default: defaultSkill || Object.keys(skillButtons)[0], close: () => {
         resolve(null); }}).render(true);
    });
  };
  
  _getIdentificationTime = (actor, skillStatistic) => {
      const quickIdSlug = getSetting(SETTINGS.QUICK_IDENTIFICATION_SLUG); const hasQuickId = actor.itemTypes.feat.some(f => f.slug === quickIdSlug); let timeMsg = "10 minutes";
      if (hasQuickId) { const rank = skillStatistic?.rank ?? 0; if (rank >= 4) timeMsg = "1 Action"; else if (rank >= 2) timeMsg = "1 minute"; else timeMsg = "1 minute"; }
      return timeMsg;
  };


_attemptBulkIdentification = async (actor, itemsToIdentify) => {
    if (!actor || !itemsToIdentify || itemsToIdentify.length === 0) {
        ui.notifications.warn("Bulk Identify: No actor or items provided.");
        return;
    }

    let successes = 0;
    let failures = 0;
    let critFailsDeceptive = 0;
    const identifiedItemLinks = [];
    const failedItemNames = [];
    const styles = this.getStyles();

    // Calculate total minutes taken upfront based on the new rule: 10 minutes per item
    const totalMinutesTaken = itemsToIdentify.length * 10;

    const progressDialog = new Dialog({
        title: "Bulk Identification Progress",
        content: `
            <div>Identifying items for ${actor.name}...</div>
            <div id="bulk-id-progress-bar-container" style="width:100%; height:20px; background-color:#ccc; border-radius:5px; margin-top:10px;">
                <div id="bulk-id-progress-bar" style="width:0%; height:100%; background-color:${styles.infoColor}; border-radius:5px; transition: width 0.1s linear;"></div>
            </div>
            <div id="bulk-id-progress-text" style="text-align:center; margin-top:5px;">0 / ${itemsToIdentify.length}</div>
        `,
        buttons: {}
    }, { id: "bulk-identification-progress", width: 400 });

    progressDialog.render(true);

    for (let i = 0; i < itemsToIdentify.length; i++) {
        const { actor: itemActor, item } = itemsToIdentify[i];
        let result;

        try {
            // Call the individual identification method
            result = await this._attemptIdentification(itemActor, item);

            if (result === undefined) {
                console.error(`${MODULE_ID} | _attemptIdentification returned undefined for item:`, item.name, item.id);
                result = { success: false, item: item, timeTakenString: "N/A" }; // Default to failure on unexpected return
            }
        } catch (e) {
            console.error(`${MODULE_ID} | Error during individual _attemptIdentification for ${item.name} in bulk process:`, e);
            result = { success: false, item: item, timeTakenString: "N/A" }; // Default to failure on error
        }

        // Check for deceptive identification (crit fail misidentification)
        const finalItemForFlagCheck = result.item;
        if (finalItemForFlagCheck && finalItemForFlagCheck.getFlag(MODULE_ID, SETTINGS.CRIT_FAIL_ORIGINAL_DATA_FLAG)) {
            critFailsDeceptive++;
        } else if (result.success) {
            successes++;
        } else {
            failures++;
        }

        // Collect item names/links for summary
        if (result.item) {
            if (result.success) {
                // Link to the identified item if successful
                identifiedItemLinks.push(`@UUID[${result.item.uuid}]{${result.item.name}}`);
            } else {
                // Store failed item name if it remained unidentified or was a true failure
                failedItemNames.push(result.item.name);
            }
        }

        // Update progress bar
        const progressPercent = ((i + 1) / itemsToIdentify.length) * 100;
        const progressBarElement = progressDialog.element.find("#bulk-id-progress-bar");
        const progressTextElement = progressDialog.element.find("#bulk-id-progress-text");

        if (progressBarElement.length) {
            progressBarElement.css("width", `${progressPercent}%`);
        }
        if (progressTextElement.length) {
            progressTextElement.text(`${i + 1} / ${itemsToIdentify.length}`);
        }

        // Small delay to allow UI to update
        await new Promise(r => setTimeout(r, 50));
    }

    // Close the progress dialog after all items are processed
    try {
        if (progressDialog.rendered) {
            await progressDialog.close({ force: true });
        }
    } catch (e) {
        /* ignore errors on closing dialog, it might already be closed */
    }

    // Format total time for display
    let totalTimeDisplay;
    if (totalMinutesTaken < 1 && totalMinutesTaken > 0) {
        totalTimeDisplay = "Less than a minute (multiple actions)";
    } else if (totalMinutesTaken === 0) {
        totalTimeDisplay = "Effectively no time (e.g. no items were processed)";
    } else if (totalMinutesTaken < 60) {
        totalTimeDisplay = `${Math.round(totalMinutesTaken)} minute(s)`;
    } else {
        totalTimeDisplay = `${(totalMinutesTaken / 60).toFixed(1)} hour(s)`;
    }

    // Construct summary message
    let summaryMessage = `<h3>Bulk Identification Summary for ${actor.name}</h3>
                          <p><strong>Total Time Taken:</strong> ${totalTimeDisplay}</p>`;

    summaryMessage += `<p><strong style="color:${styles.successColor};">Identified:</strong> ${successes} item(s).</p>`;
    if (identifiedItemLinks.length > 0) {
        summaryMessage += `<p style="font-size:0.9em;">${identifiedItemLinks.join(", ")}</p>`;
    }

    summaryMessage += `<p><strong style="color:${styles.failureColor};">Failed/Remained Unidentified:</strong> ${failures} item(s).</p>`;
    if (failedItemNames.length > 0) {
        summaryMessage += `<p style="font-size:0.9em;">(${failedItemNames.join(", ")})</p>`;
    }

    if (critFailsDeceptive > 0) {
        summaryMessage += `<p><strong style="color:purple;">Deceptively Identified (Crit Fail):</strong> ${critFailsDeceptive} item(s). GM sees details in individual roll messages.</p>`;
    }

    // Send summary to chat
    ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: summaryMessage,
        whisper: ChatMessage.getWhisperRecipients("GM").concat(game.user.id)
    });

    ui.notifications.info(`Bulk identification complete for ${actor.name}.`);

    // Optionally re-render actor sheet to reflect changes
    if (actor.sheet?.rendered) {
        actor.sheet.render(true);
    }
};

  runIdentifyMagicProcess = async (sheetActor = null) => {
    const styles = this.getStyles(); const currentIdentifySpellInfo = this.getIdentifySpellInfo();
    try {
      if (!this.utils) { ui.notifications.error("Identification utilities not available."); return; }
      const actors = this.utils.determineTargetActors(sheetActor); if (!actors || actors.length === 0) { ui.notifications.warn("Identify Magic: No actor selected."); return; }
      const primaryActor = actors[0]; const actorNames = actors.map((a) => `<em>${a.name}</em>`).join(", ");
      const actorHasDetect = this.utils.actorHasSpellAvailable(primaryActor, currentIdentifySpellInfo.detect.slug); const actorHasReadAura = this.utils.actorHasSpellAvailable(primaryActor, currentIdentifySpellInfo.read.slug);
      let initialItemList = []; for (const act of actors) { const items = act.items.filter((i) => i.system?.identification?.status === "unidentified"); items.forEach((item) => initialItemList.push({ actor: act, item }));}
      if (initialItemList.length === 0) { ui.notifications.info(`No unidentified items on ${actorNames}.`); return; }
      const itemCount = initialItemList.length; const detectMagicLink = this.utils.createIdentifyLink(currentIdentifySpellInfo.detect.id, currentIdentifySpellInfo.detect.name, currentIdentifySpellInfo.detect.icon); const readAuraLink = this.utils.createIdentifyLink(currentIdentifySpellInfo.read.id, currentIdentifySpellInfo.read.name, currentIdentifySpellInfo.read.icon);
      let initialDialogContent = `<div style="text-align: center; margin-bottom: 10px;"><i class="fas fa-scroll fa-2x" style="color: #8B4513;"></i></div><p>Before ${actorNames} lie ${itemCount} object(s) shrouded in mystery.</p><p>How will you approach deciphering their nature?</p><hr style="border-color: #aaa;"><div style="margin-bottom: 8px;"><i class="fas fa-search-location fa-fw" style="color: #4682B4;"></i> <strong>Detect Magic</strong> (10 min + scan) ${detectMagicLink} ${!actorHasDetect ? '<i class="fas fa-times-circle fa-xs" style="color: tomato;" title="Spell not available"></i>' : ""}<br><span style="font-size: 0.9em; margin-left: 20px;"><em>Scans items, reveals magical presence. All items still require a skill check.</em></span></div><div style="margin-bottom: 8px;"><i class="fas fa-book-reader fa-fw" style="color: #8A2BE2;"></i> <strong>Read Aura</strong> (1 min + scan) ${readAuraLink} ${!actorHasReadAura ? '<i class="fas fa-times-circle fa-xs" style="color: tomato;" title="Spell not available"></i>' : ""}<br><span style="font-size: 0.9em; margin-left: 20px;"><em>Scans, reveals magical presence & schools. All items still require a skill check.</em></span></div><div style="margin-bottom: 8px;"><i class="fas fa-wand-magic-sparkles fa-fw" style="color: #DAA520;"></i> <strong>Identify Directly</strong><br><span style="font-size: 0.9em; margin-left: 20px;"><em>Attempt skill check directly (10 min base per item).</em></span></div><hr style="border-color: #aaa;"><div style="margin-bottom: 10px; padding: 5px; border: 1px solid #ccc; border-radius: 3px; background: #f0f0f0;"><input type="checkbox" id="bypass-spell-restrictions" name="bypassRestrictions" style="vertical-align: middle;"><label for="bypass-spell-restrictions" style="vertical-align: middle; font-size: 0.9em; color: #333;" title="Allows selecting Detect/Read even if spell is missing."><i class="fas fa-magic"></i> Bypass Spell Knowledge</label></div><details><summary style="cursor: pointer; font-weight: bold;"><i class="fas fa-info-circle"></i> ID Rules Overview</summary><div style="font-size: 0.9em; padding-left: 15px;"><p><strong>Scan:</strong> Reveals magical aura/schools. Does NOT auto-ID non-magical items.</p><p><strong>Crafting Skill:</strong> Can be used for any item. Auto-fails on MAGICAL items if lacking Crafter's Appraisal feat.</p><p><strong>Other Skills:</strong> Auto-fail on NON-MAGICAL items if used.</p><p><strong>Outcomes:</strong> Crit Success/Success: Identified. Failure: Stays unidentified (retry Lvl+1). Crit Failure: <strong style="color:${styles.successColor};">Success! (Deceptive)</strong> Player sees ID, GM sees truth.</p><p><i class="fas fa-clock"></i> Base time 10 min/item. Quick ID can reduce.</p></div></details><hr style="border-color: #aaa; margin-top: 10px;"><p style="font-size: 0.9em; color: #555; text-align: center;"><em>Choose your approach...</em></p>`;
      new Dialog({ title: "Unraveling Mysteries", content: initialDialogContent, buttons: { detect: { label: "Detect", icon: '<i class="fas fa-search-location"></i>', callback: async (html) => await this._handleIdentifyChoice("detect", initialItemList, html.find("#bypass-spell-restrictions").prop("checked"), primaryActor)}, read: { label: "Read Aura", icon: '<i class="fas fa-book-reader"></i>', callback: async (html) => await this._handleIdentifyChoice("read", initialItemList, html.find("#bypass-spell-restrictions").prop("checked"), primaryActor)}, identify: { label: "Identify Directly", icon: '<i class="fas fa-wand-magic-sparkles"></i>', callback: async () => await this._handleIdentifyChoice("identify", initialItemList, false, primaryActor)}, cancel: { label: "Cancel", icon: '<i class="fas fa-times"></i>', callback: () => ui.notifications.info("Stepping back.") }}, default: actorHasDetect || actorHasReadAura ? "detect" : "identify"}).render(true);
    } catch (err) { ui.notifications.error("Unexpected error during Identify Magic. Check console."); }
  }; 

  runIdentifyMagicProcess = async (sheetActor = null) => {
    const styles = this.getStyles(); const currentIdentifySpellInfo = this.getIdentifySpellInfo();
    try {
      if (!this.utils) { ui.notifications.error("Identification utilities not available."); return; }
      const actors = this.utils.determineTargetActors(sheetActor); if (!actors || actors.length === 0) { ui.notifications.warn("Identify Magic: No actor selected."); return; }
      const primaryActor = actors[0]; const actorNames = actors.map((a) => `<em>${a.name}</em>`).join(", ");
      const actorHasDetect = this.utils.actorHasSpellAvailable(primaryActor, currentIdentifySpellInfo.detect.slug); const actorHasReadAura = this.utils.actorHasSpellAvailable(primaryActor, currentIdentifySpellInfo.read.slug);
      let initialItemList = []; for (const act of actors) { const items = act.items.filter((i) => i.system?.identification?.status === "unidentified"); items.forEach((item) => initialItemList.push({ actor: act, item }));}
      if (initialItemList.length === 0) { ui.notifications.info(`No unidentified items on ${actorNames}.`); return; }
      const itemCount = initialItemList.length; const detectMagicLink = this.utils.createIdentifyLink(currentIdentifySpellInfo.detect.id, currentIdentifySpellInfo.detect.name, currentIdentifySpellInfo.detect.icon); const readAuraLink = this.utils.createIdentifyLink(currentIdentifySpellInfo.read.id, currentIdentifySpellInfo.read.name, currentIdentifySpellInfo.read.icon);
      let initialDialogContent = `<div style="text-align: center; margin-bottom: 10px;"><i class="fas fa-scroll fa-2x" style="color: #8B4513;"></i></div><p>Before ${actorNames} lie ${itemCount} object(s) shrouded in mystery.</p><p>How will you approach deciphering their nature?</p><hr style="border-color: #aaa;"><div style="margin-bottom: 8px;"><i class="fas fa-search-location fa-fw" style="color: #4682B4;"></i> <strong>Detect Magic</strong> (10 min + scan) ${detectMagicLink} ${!actorHasDetect ? '<i class="fas fa-times-circle fa-xs" style="color: tomato;" title="Spell not available"></i>' : ""}<br><span style="font-size: 0.9em; margin-left: 20px;"><em>Scans items, reveals magical presence. All items still require a skill check.</em></span></div><div style="margin-bottom: 8px;"><i class="fas fa-book-reader fa-fw" style="color: #8A2BE2;"></i> <strong>Read Aura</strong> (1 min + scan) ${readAuraLink} ${!actorHasReadAura ? '<i class="fas fa-times-circle fa-xs" style="color: tomato;" title="Spell not available"></i>' : ""}<br><span style="font-size: 0.9em; margin-left: 20px;"><em>Scans, reveals magical presence & schools. All items still require a skill check.</em></span></div><div style="margin-bottom: 8px;"><i class="fas fa-wand-magic-sparkles fa-fw" style="color: #DAA520;"></i> <strong>Identify Directly</strong><br><span style="font-size: 0.9em; margin-left: 20px;"><em>Attempt skill check directly (10 min base per item).</em></span></div><hr style="border-color: #aaa;"><div style="margin-bottom: 10px; padding: 5px; border: 1px solid #ccc; border-radius: 3px; background: #f0f0f0;"><input type="checkbox" id="bypass-spell-restrictions" name="bypassRestrictions" style="vertical-align: middle;"><label for="bypass-spell-restrictions" style="vertical-align: middle; font-size: 0.9em; color: #333;" title="Allows selecting Detect/Read even if spell is missing."><i class="fas fa-magic"></i> Bypass Spell Knowledge</label></div><details><summary style="cursor: pointer; font-weight: bold;"><i class="fas fa-info-circle"></i> ID Rules Overview</summary><div style="font-size: 0.9em; padding-left: 15px;"><p><strong>Scan:</strong> Reveals magical aura/schools. Does NOT auto-ID non-magical items.</p><p><strong>Crafting Skill:</strong> Can be used for any item. Auto-fails on MAGICAL items if lacking Crafter's Appraisal feat.</p><p><strong>Other Skills:</strong> Auto-fail on NON-MAGICAL items if used.</p><p><strong>Outcomes:</strong> Crit Success/Success: Identified. Failure: Stays unidentified (retry Lvl+1). Crit Failure: <strong style="color:${styles.successColor};">Success! (Deceptive)</strong> Player sees ID, GM sees truth.</p><p><i class="fas fa-clock"></i> Base time 10 min/item. Quick ID can reduce.</p></div></details><hr style="border-color: #aaa; margin-top: 10px;"><p style="font-size: 0.9em; color: #555; text-align: center;"><em>Choose your approach...</em></p>`;
      new Dialog({ title: "Unraveling Mysteries", content: initialDialogContent, buttons: { detect: { label: "Detect", icon: '<i class="fas fa-search-location"></i>', callback: async (html) => await this._handleIdentifyChoice("detect", initialItemList, html.find("#bypass-spell-restrictions").prop("checked"), primaryActor)}, read: { label: "Read Aura", icon: '<i class="fas fa-book-reader"></i>', callback: async (html) => await this._handleIdentifyChoice("read", initialItemList, html.find("#bypass-spell-restrictions").prop("checked"), primaryActor)}, identify: { label: "Identify Directly", icon: '<i class="fas fa-wand-magic-sparkles"></i>', callback: async () => await this._handleIdentifyChoice("identify", initialItemList, false, primaryActor)}, cancel: { label: "Cancel", icon: '<i class="fas fa-times"></i>', callback: () => ui.notifications.info("Stepping back.") }}, default: actorHasDetect || actorHasReadAura ? "detect" : "identify"}).render(true);
    } catch (err) { ui.notifications.error("Unexpected error during Identify Magic. Check console."); }
  }; 

  _handleIdentifyChoice = async (choice, initialItemList, bypass = false, primaryActor) => {
    let itemsForSkillCheck = []; let scanResultsData = new Map(); const magicSchools = Object.keys(this.identifyIcons.school); const sounds = this.getSounds();
    if (choice === "identify") { itemsForSkillCheck = initialItemList; if (itemsForSkillCheck.length === 0) { ui.notifications.info(`No unidentified items found.`); return; } await this._showIdentifyItemsDialog(primaryActor, itemsForSkillCheck, scanResultsData, choice); return; }
    const scanAction = choice === "detect" ? "Detect Magic" : "Read Aura"; ui.notifications.info(`Performing ${scanAction} scan...`);
    let scanningIndicator = new Dialog({ title: "Scanning Items...", content: `<div style="text-align:center;"><i class="fas fa-spinner fa-spin fa-3x"></i><p>Scanning ${initialItemList.length} items...</p></div>`, buttons: {}}, { id: "scanning-indicator", width: 300 }).render(true);
    for (const { actor, item } of initialItemList) { 
      try { if (sounds.detectMagic) AudioHelper.play({ src: sounds.detectMagic, volume: 0.3, autoplay: true, duration:0.1 }, false); } catch (e) {}
      const isMagical = item.traits.has("magical"); let schools = [];
      if (isMagical && choice === "read") magicSchools.forEach((s) => { if (item.traits.has(s)) schools.push(s); });
      scanResultsData.set(item.id, { isMagical, schools }); itemsForSkillCheck.push({ actor, item }); 
      $(scanningIndicator.element).find("p").text(`Scanning ${item.name}... ${isMagical ? "MAGICAL AURA!" : "No magical aura."}`);
      await new Promise((resolve) => setTimeout(resolve, 50)); 
    }
    if (scanningIndicator) try { await scanningIndicator.close({ force: true }); } catch (e) {}
    if (itemsForSkillCheck.length === 0) { ui.notifications.info("Scan complete. No items to inspect further."); return; }
    await this._showIdentifyItemsDialog(primaryActor, itemsForSkillCheck, scanResultsData, choice);
  }; 

  _handleIdentifyChoice = async (
    choice,
    initialItemList,
    bypass = false,
    primaryActor
  ) => {
    let itemsForSkillCheck = [];
    let scanResultsData = new Map();
    const magicSchools = Object.keys(this.identifyIcons.school);
    const sounds = this.getSounds();
    if (choice === "identify") {
      itemsForSkillCheck = initialItemList;
      if (itemsForSkillCheck.length === 0) {
        ui.notifications.info(`No unidentified items found.`);
        return;
      }
      await this._showIdentifyItemsDialog(
        primaryActor,
        itemsForSkillCheck,
        scanResultsData,
        choice
      );
      return;
    }
    const scanAction = choice === "detect" ? "Detect Magic" : "Read Aura";
    ui.notifications.info(`Performing ${scanAction} scan...`);
    let scanningIndicator = new Dialog(
      {
        title: "Scanning Items...",
        content: `<div style="text-align:center;"><i class="fas fa-spinner fa-spin fa-3x"></i><p>Scanning ${initialItemList.length} items...</p></div>`,
        buttons: {},
      },
      { id: "scanning-indicator", width: 300 }
    ).render(true);
    for (const { actor, item } of initialItemList) {
      try {
        if (sounds.detectMagic)
          AudioHelper.play(
            {
              src: sounds.detectMagic,
              volume: 0.3,
              autoplay: true,
              duration: 0.1,
            },
            false
          );
      } catch (e) {}
      const isMagical = item.traits.has("magical");
      let schools = [];
      if (isMagical && choice === "read")
        magicSchools.forEach((s) => {
          if (item.traits.has(s)) schools.push(s);
        });
      scanResultsData.set(item.id, { isMagical, schools });
      itemsForSkillCheck.push({ actor, item });
      $(scanningIndicator.element)
        .find("p")
        .text(
          `Scanning ${item.name}... ${
            isMagical ? "MAGICAL AURA!" : "No magical aura."
          }`
        );
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (scanningIndicator)
      try {
        await scanningIndicator.close({ force: true });
      } catch (e) {}
    if (itemsForSkillCheck.length === 0) {
      ui.notifications.info("Scan complete. No items to inspect further.");
      return;
    }
    await this._showIdentifyItemsDialog(
      primaryActor,
      itemsForSkillCheck,
      scanResultsData,
      choice
    );
  };


_attemptIdentification = async (actor, item) => {
    let roll = null;
    const styles = this.getStyles();
    const wronglyIdentifiedConf = this.getWronglyIdentifiedConfig();
    const compendiumsForReplacement = getSetting(SETTINGS.COMPENDIUMS_TO_SEARCH)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);

    const isMagicalItem = item.traits.has("magical");
    let timeTakenString = "10 minutes";

    try {
        let dc = null;
        const explicitDC = item.system.identification?.dc;

        dc = this.dcCalculator.calculateDC(item.level ?? 0, {
            rarity: item.rarity ?? "common",
            specificDC: explicitDC && !isNaN(explicitDC) && explicitDC > 0 ? parseInt(explicitDC, 10) : null,
            dcType: "identification"
        });

        if (!dc || dc <= 0) {
            const val = await Dialog.prompt({
                title: `Manual DC: ${item.name}`,
                content: `<p>Could not get DC for <strong>${item.name}</strong>. Enter DC:</p><input type="number" name="manualDC" value="15" style="width:100%;"/>`,
                label: "Set DC",
                rejectClose: false,
                callback: (html) => html.find('input[name="manualDC"]').val()
            });
            dc = parseInt(val);
            if (Number.isNaN(dc) || dc <= 0) {
                ui.notifications.warn(`Manual DC invalid. ID aborted for ${item.name}.`);
                return { success: false, item: item, timeTakenString: "N/A" };
            }
        }

        const possibleSkillsBase = ["arc", "nat", "occ", "rel", "cra"];
        const actorFeatItems = actor.itemTypes.feat;
        let possibleSkills = [...possibleSkillsBase];

        const scholasticFeatSlug = getSetting(SETTINGS.SCHOLASTIC_IDENTIFICATION_SLUG);
        const scholasticFeatConfig = this.identifyFeatsConfig[scholasticFeatSlug];
        const hasScholasticFeat = scholasticFeatConfig && actorFeatItems.some((f) => f.slug === scholasticFeatSlug);

        if (hasScholasticFeat) {
            possibleSkills.push(scholasticFeatConfig.substituteSkill);
        }
        possibleSkills = [...new Set(possibleSkills)]; // Remove duplicates

        const finalSkillsForPrompt = possibleSkills.filter((skillSlug) => {
            const skillDataName = this.identifyIcons.skillDataMap[skillSlug];
            if (!skillDataName) return false;

            const skill = actor.skills[skillDataName];
            const rank = skill?.rank ?? 0;

            if (skillSlug === scholasticFeatConfig?.substituteSkill && hasScholasticFeat && scholasticFeatConfig?.requiresMaster && rank < 3) {
                return false;
            }
            if (skillSlug !== 'cra' && rank === 0 && game.settings.get("pf2e", "proficiencyVariant") !== "ProficiencyWithoutLevel") {
                return false;
            }
            return true;
        });

        if (finalSkillsForPrompt.length === 0) {
            ui.notifications.error(`${actor.name} lacks any suitable skill(s) to attempt to ID ${item.name}.`);
            return { success: false, item: item, timeTakenString: "N/A" };
        }

        const actorFeatSlugs = new Set(actorFeatItems.map((f) => f.slug));
        const featsForPrompt = Object.values(this.identifyFeatsConfig).filter(
            (featConfig) => featConfig && actorFeatSlugs.has(featConfig.slug) && featConfig.type !== "skill_substitution"
        );

        const promptResult = await this._promptIdentifySkill(actor, item, dc, finalSkillsForPrompt, featsForPrompt);
        if (!promptResult) {
            ui.notifications.info("ID cancelled.");
            return { success: false, item: item, timeTakenString: "N/A" };
        }

        const { skillSlug: chosenSkillSlug, selectedFeatSlugs } = promptResult;
        const chosenSkillDataName = this.identifyIcons.skillDataMap[chosenSkillSlug];

        if (!chosenSkillDataName) {
            ui.notifications.error(`Internal Error: No skill data for '${chosenSkillSlug}'.`);
            return { success: false, item: item, timeTakenString: "N/A" };
        }

        const stat = actor.skills[chosenSkillDataName];
        if (!stat) {
            ui.notifications.error(`Internal Error: Stat '${chosenSkillDataName}' not found.`);
            return { success: false, item: item, timeTakenString: "N/A" };
        }

        timeTakenString = this._getIdentificationTime(actor, stat);

        const craftersAppraisalSlug = getSetting(SETTINGS.CRAFTERS_APPRAISAL_SLUG);
        const hasCraftersAppraisal = actorFeatItems.some((f) => f.slug === craftersAppraisalSlug);

        // Specific failure conditions based on item type and chosen skill
        if (chosenSkillSlug === 'cra' && isMagicalItem && !hasCraftersAppraisal) {
            const failMsg = `${actor.name} attempts to Identify the magical item ${item.name} with Crafting but lacks Crafter's Appraisal. The attempt automatically fails.`;
            ui.notifications.warn(failMsg);
            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                content: failMsg,
                whisper: ChatMessage.getWhisperRecipients("GM").concat(game.user.id)
            });
            const lvl = actor.level;
            const failMarker = `<!-- failureMarker:Fail_${actor.id}_L${lvl} -->`;
            const currentUnidDesc = (item.system.identification?.unidentified?.data?.description?.value ?? "")
                .replace(/<!-- failureMarker:Fail_[^_]+_L\d+ -->/g, "")
                .trim();
            await item.update({ "system.identification.unidentified.data.description.value": currentUnidDesc ? `${currentUnidDesc} ${failMarker}` : failMarker });
            return { success: false, item: item, timeTakenString: timeTakenString };
        }

        if (chosenSkillSlug !== 'cra' && !isMagicalItem) {
            const failMsg = `${actor.name} attempts to Identify the non-magical item ${item.name} with ${stat.label}, not Crafting. The attempt automatically fails.`;
            ui.notifications.warn(failMsg);
            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                content: failMsg,
                whisper: ChatMessage.getWhisperRecipients("GM").concat(game.user.id)
            });
            const lvl = actor.level;
            const failMarker = `<!-- failureMarker:Fail_${actor.id}_L${lvl} -->`;
            const currentUnidDesc = (item.system.identification?.unidentified?.data?.description?.value ?? "")
                .replace(/<!-- failureMarker:Fail_[^_]+_L\d+ -->/g, "")
                .trim();
            await item.update({ "system.identification.unidentified.data.description.value": currentUnidDesc ? `${currentUnidDesc} ${failMarker}` : failMarker });
            return { success: false, item: item, timeTakenString: timeTakenString };
        }

        const mods = (selectedFeatSlugs ?? [])
            .map((slug) => this.identifyFeatsConfig[slug]?.modifier)
            .filter((m) => m)
            .map((m) => new game.pf2e.Modifier(m));

        const opts = new Set(actor.getRollOptions(["all", "skill-check", stat.slug]));
        opts.add(`action:identify`);
        if (isMagicalItem) {
            opts.add("item:magical");
        } else {
            opts.add("item:nonmagical");
        }
        (selectedFeatSlugs ?? []).forEach((slug) => opts.add(`feat:${slug}`));
        item.traits.forEach((t) => opts.add(`item:trait:${t}`));

        const assuredIdSlug = getSetting(SETTINGS.ASSURED_IDENTIFICATION_SLUG);
        const hasAssuredId = this.identifyFeatsConfig[assuredIdSlug] && actorFeatItems.some((f) => f.slug === assuredIdSlug);

        const unidentifiedName = item.system?.identification?.unidentified?.data?.name?.value || item.name;
        ui.notifications.info(`Attempting to ID ${unidentifiedName}... (${timeTakenString})`);

        roll = await stat.roll({
            dc: { value: dc },
            item: item,
            extraRollOptions: Array.from(opts),
            modifiers: mods,
            title: `Identify Item: ${unidentifiedName}`,
            rollMode: CONST.DICE_ROLL_MODES.BLIND
        });

        if (!roll) {
            ui.notifications.warn(`ID roll cancelled.`);
            return { success: false, item: item, timeTakenString: timeTakenString };
        }

        let dos = roll.degreeOfSuccess;
        const origCritFail = dos === 0;
        let assuredApplied = false;
        if (origCritFail && hasAssuredId) {
            dos = 1; // Change crit fail to normal failure due to Assured Identification
            assuredApplied = true;
        }

        let playerOutcomeText = "";
        let itemToLinkInChat = item;
        let updateData = {};
        let itemDeletedAndReplaced = false;

        // Handle Critical Failure (Misidentification)
        if (dos === 0 && !assuredApplied) {
            itemDeletedAndReplaced = true;
            const originalIdentifiedName = item._source?.name ?? item.name;
            const originalItemId = item.id;
            const originalItemType = item.type;
            const originalItemLevel = item.level ?? 0;

            ui.notifications.info(`Crit Fail IDing ${originalIdentifiedName}. Misidentifying...`, { permanent: false });

            let replacementItemDataSource = null;
            let finalMisidentifiedName = "";

            try {
                let allPotentialItems = [];
                for (const packName of compendiumsForReplacement) {
                    const pack = game.packs.get(packName);
                    if (!pack) continue;
                    const index = await pack.getIndex({ fields: ["name", "type", "uuid", "system.level.value"] });
                    allPotentialItems.push(
                        ...index.filter(
                            (i) =>
                                ["weapon", "armor", "equipment", "consumable", "treasure", "backpack", "container", "loot"].includes(i.type) &&
                                !i.name.startsWith("Formula:") &&
                                i.uuid !== item.sourceId &&
                                (i.system?.level?.value ?? 0) <= actor.level + 3 &&
                                (i.system?.level?.value ?? 0) >= Math.max(0, actor.level - 2)
                        )
                    );
                }

                if (allPotentialItems.length === 0) {
                    throw new Error("No items in level range for replacement.");
                }

                let typeMatches = allPotentialItems.filter((p) => p.type === originalItemType);
                const chosenPool = typeMatches.length > 0 ? typeMatches : allPotentialItems;

                if (chosenPool.length === 0) {
                    throw new Error(`No suitable replacement for ${originalIdentifiedName}.`);
                }

                const randomIndex = Math.floor(Math.random() * chosenPool.length);
                const selectedReplacementRef = chosenPool[randomIndex];
                const fetchedReplacement = await fromUuid(selectedReplacementRef.uuid);

                if (!fetchedReplacement || !fetchedReplacement.isOfType("physical")) {
                    throw new Error(`Failed to fetch/invalid replacement ${selectedReplacementRef.name}`);
                }

                const baseNameForReplacement = fetchedReplacement.name;
                const idSuffix = `(Id by ${actor.name})`;
                let prefixedBaseName = baseNameForReplacement;

                if (wronglyIdentifiedConf.prefix && wronglyIdentifiedConf.prefix.trim() !== "") {
                    if (!baseNameForReplacement.toLowerCase().startsWith(wronglyIdentifiedConf.prefix.toLowerCase().trim())) {
                        prefixedBaseName = `${wronglyIdentifiedConf.prefix.trim()} ${baseNameForReplacement}`;
                    }
                }

                finalMisidentifiedName = `${prefixedBaseName} ${idSuffix}`;
                replacementItemDataSource = fetchedReplacement.toObject(false);
                delete replacementItemDataSource._id; // Remove _id to allow creation of a new document
                replacementItemDataSource.name = finalMisidentifiedName;
                replacementItemDataSource.img = fetchedReplacement.img;
                replacementItemDataSource.system.quantity = item.system.quantity; // Maintain original quantity
                replacementItemDataSource.system.identification = {
                    status: "identified", // The misidentified item appears identified to the player
                    identified: {
                        name: finalMisidentifiedName,
                        img: fetchedReplacement.img,
                        data: { description: { value: (fetchedReplacement.system.description?.value ?? "") + (wronglyIdentifiedConf.desc ?? "").trim() } }
                    },
                    unidentified: {
                        name: `Unidentified ${fetchedReplacement.type}`, // What it looks like if unidentified
                        img: "icons/svg/mystery-man.svg",
                        data: { description: { value: "<p>True nature obscured.</p>" } }
                    },
                    misidentifiedData: null // No misidentified data on the "new" item
                };
                replacementItemDataSource.flags = foundry.utils.mergeObject(replacementItemDataSource.flags ?? {}, {
                    [MODULE_ID]: {
                        [wronglyIdentifiedConf.originalDataFlag]: {
                            name: originalIdentifiedName,
                            uuid: item.uuid,
                            sourceId: item.sourceId,
                            type: originalItemType,
                            level: originalItemLevel
                        }
                    }
                });
            } catch (selectionError) {
                ui.notifications.error(`Crit Fail Aborted: Replacement error: ${selectionError.message}`);
                dos = 1; // If replacement fails, downgrade crit fail to a normal failure
                itemDeletedAndReplaced = false;
                ui.notifications.warn(`Crit Fail on ${originalIdentifiedName} -> Failure due to replacement error.`);
            }

            if (itemDeletedAndReplaced && replacementItemDataSource) {
                try {
                    await actor.deleteEmbeddedDocuments("Item", [originalItemId]);
                } catch (deleteError) {
                    ui.notifications.error(`CRITICAL ERROR: Failed to delete ${originalIdentifiedName}. Replacement aborted. ${deleteError.message}`);
                    itemDeletedAndReplaced = false;
                    return { success: false, item: item, timeTakenString: timeTakenString };
                }

                let newItemDoc = null;
                try {
                    const createdDocs = await actor.createEmbeddedDocuments("Item", [replacementItemDataSource]);
                    if (!createdDocs || createdDocs.length === 0) {
                        throw new Error("Replacement creation returned no docs.");
                    }
                    newItemDoc = createdDocs[0];
                    itemToLinkInChat = newItemDoc; // Link to the new, misidentified item

                    // Add GM note to the new item's description
                    const gmNoteHeader = `--- Crit Fail ID (${new Date().toLocaleString()}) ---`;
                    const gmNoteContent = `<strong>Player:</strong> ${actor.name}<br><strong>Believes Identified:</strong> "${newItemDoc.name}"<br><strong>Actual Item Was:</strong> "${originalIdentifiedName}" (Type: ${originalItemType}, Lvl: ${originalItemLevel}, UUID: ${item.uuid}). Removed & Replaced.`;
                    const currentGMNotes = newItemDoc.system.description?.gm ?? "";
                    const newGMNotes = `${gmNoteHeader}\n${gmNoteContent}\n${currentGMNotes ? "<hr>" + currentGMNotes : ""}`;
                    await newItemDoc.update({ "system.description.gm": newGMNotes });
                } catch (creationError) {
                    ui.notifications.error(`CRITICAL ERROR: Failed to create/update replacement ${replacementItemDataSource?.name}. ${creationError.message}`);
                    itemDeletedAndReplaced = false;
                    return { success: false, item: item, timeTakenString: timeTakenString };
                }
            }
            // Player perceives success when misidentified
            playerOutcomeText = `<span style="color:${styles.successColor};font-weight:bold;">Success!</span> You understand it.`;
        }
        // Handle Success or Critical Success
        else if (dos >= 2) {
            playerOutcomeText = `<span style="color:${styles.successColor};font-weight:bold;">${dos === 3 ? "Crit Success!" : "Success!"}</span> You understand it.`;
            updateData["system.identification.status"] = "identified";

            let baseNameForItemSuffix =
                item.system.identification?.identified?.name?.trim() ||
                item._source?.name?.trim() ||
                item.name.replace(/\s*\((?:Id by .*?|Crafted by .*?|Unidentified)\)$/i, "").trim();

            const idSuffix = `(Id by ${actor.name})`;
            let finalIdentifiedName;
            if (baseNameForItemSuffix) {
                finalIdentifiedName = !baseNameForItemSuffix.endsWith(idSuffix) ? `${baseNameForItemSuffix} ${idSuffix}` : baseNameForItemSuffix;
            } else {
                // Fallback for empty base name
                let trueBaseName = (item.system.identification?.identified?.name || item._source?.name || item.name)
                    .replace(/\s*\((?:Id by .*?|Crafted by .*?|Unidentified)\)$/i, "")
                    .trim();
                finalIdentifiedName = (trueBaseName && trueBaseName.trim() !== "") ? `${trueBaseName} ${idSuffix}` : `Identified Item ${idSuffix}`;
            }

            updateData["name"] = finalIdentifiedName;
            updateData["system.identification.identified.name"] = finalIdentifiedName;
            updateData["system.identification.identified.img"] = item.img;

            // Ensure unidentified data structure exists if not present
            if (!item.system.identification.unidentified) {
                updateData["system.identification.unidentified"] = { name: `Unidentified ${item.type}`, img: "icons/svg/mystery-man.svg", data: { description: { value: "" } } };
            } else {
                if (typeof item.system.identification.unidentified.name !== "string") {
                    updateData["system.identification.unidentified.name"] = `Unidentified ${item.type}`;
                }
                if (typeof item.system.identification.unidentified.img !== "string") {
                    updateData["system.identification.unidentified.img"] = "icons/svg/mystery-man.svg";
                }
            }

            // Ensure identified description exists
            if (!item.system.identification.identified?.data?.description) {
                updateData["system.identification.identified.data"] = { description: { value: item.system.description.value || "" } };
            } else if (!item.system.identification.identified.data.description.value) {
                updateData["system.identification.identified.data.description.value"] = item.system.description.value || "";
            }

            // Remove flag for misidentification (if it was ever there)
            updateData[`flags.${MODULE_ID}.-=${wronglyIdentifiedConf.originalDataFlag}`] = null;

            // Clean up old failure markers and deceptive descriptions
            const currentUnidDesc = item.system.identification?.unidentified?.data?.description?.value ?? "";
            const cleanedDesc = currentUnidDesc
                .replace(/(<!-- failureMarker:Fail_[^_]+_L\d+ -->|<!-- SCF:DECEPTIVE_CRIT_FAIL -->)/g, "")
                .replace(wronglyIdentifiedConf.desc, "")
                .trim();
            if (cleanedDesc !== currentUnidDesc) {
                updateData["system.identification.unidentified.data.description.value"] = cleanedDesc || "<p></p>";
            }

            const currentMainDesc = item.system.description?.value ?? "";
            if (currentMainDesc.includes(wronglyIdentifiedConf.deceptiveMarker)) {
                updateData["system.description.value"] = currentMainDesc.replace(wronglyIdentifiedConf.deceptiveMarker, "").trim();
            }
        }
        // Handle Failure
        else {
            const lvl = actor.level;
            const failMarker = `<!-- failureMarker:Fail_${actor.id}_L${lvl} -->`;
            playerOutcomeText = `<span style="color:orange;font-weight:bold;">Failure.</span> Item resists.`;
            if (assuredApplied) {
                playerOutcomeText += ` <span style="font-style:italic;color:#777;">(Assured ID prevents worse)</span>`;
            }
            playerOutcomeText += `<br><em style="font-size:0.9em;">${actor.name} cannot retry until Lvl ${lvl + 1}.</em>`;

            updateData["system.identification.status"] = "unidentified";
            const descPath = "system.identification.unidentified.data.description.value";
            let currentUnidDesc = item.system.identification?.unidentified?.data?.description?.value ?? "";
            // Clean up existing markers before adding new one
            currentUnidDesc = currentUnidDesc
                .replace(/<!-- failureMarker:Fail_[^_]+_L\d+ -->/g, "")
                .trim();
            currentUnidDesc = currentUnidDesc.replace(wronglyIdentifiedConf.deceptiveMarker, "").trim();
            currentUnidDesc = currentUnidDesc.replace(wronglyIdentifiedConf.desc, "").trim();
            updateData[descPath] = currentUnidDesc ? `${currentUnidDesc} ${failMarker}` : failMarker;

            // Remove flag for misidentification (if it was ever there)
            updateData[`flags.${MODULE_ID}.-=${wronglyIdentifiedConf.originalDataFlag}`] = null;

            const currentMainDesc = item.system.description?.value ?? "";
            if (currentMainDesc.includes(wronglyIdentifiedConf.deceptiveMarker)) {
                updateData["system.description.value"] = currentMainDesc.replace(wronglyIdentifiedConf.deceptiveMarker, "").trim();
            }
        }

        // Apply item updates if not replaced and there are updates
        if (!itemDeletedAndReplaced && Object.keys(updateData).length > 0) {
            try {
                await item.update(updateData);
                await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay, possibly for UI rendering
            } catch (updateError) {
                ui.notifications.error(`Error updating ${item.name} after ID: ${updateError.message}`);
            }
        }

        // Prepare chat message content
        const finalLinkedItem = actor.items.get(itemToLinkInChat.id) || itemToLinkInChat; // Get fresh reference or use old one

        let nameToShow = "Unknown Item";
        let iconToShow = "icons/svg/mystery-man.svg";
        let itemLink = `Item (${itemToLinkInChat?.id ?? "unknown"})`;
        let retryText = "";

        if (!finalLinkedItem) {
            nameToShow = itemToLinkInChat?.name ?? "Item (State Error)";
            iconToShow = itemToLinkInChat?.img ?? "icons/svg/hazard.svg";
            itemLink = itemToLinkInChat?.uuid ? `@UUID[${itemToLinkInChat.uuid}]{${nameToShow}} (Post-Op Fail)` : nameToShow;
            ui.notifications.warn(`Could not fetch final state for ${itemToLinkInChat?.id}. Chat link may be inaccurate.`);
        } else {
            if (itemDeletedAndReplaced || finalLinkedItem.isIdentified) {
                nameToShow = finalLinkedItem.name;
                iconToShow = finalLinkedItem.img;
                itemLink = `@UUID[${finalLinkedItem.uuid}]{${nameToShow}}`;
            } else {
                nameToShow = finalLinkedItem.system.identification?.unidentified?.data?.name?.value || "Unidentified Item";
                iconToShow = finalLinkedItem.system.identification?.unidentified?.data?.img || "icons/svg/mystery-man.svg";
                itemLink = `@UUID[${finalLinkedItem.uuid}]{${nameToShow}}`;
                if (dos === 1) {
                    retryText = `<p style="font-size:0.8em;color:#800000;"><em>(${actor.name} cannot retry until Lvl ${actor.level + 1})</em></p>`;
                }
            }
        }

        const chatFlavor = `<div class="pf2e chat-card" style="padding:3px;border:1px solid var(--color-border-light-tertiary);font-size:14px;">
            <header class="card-header flexrow" style="border-bottom:1px solid var(--color-border-light-tertiary);padding-bottom:3px;margin-bottom:3px;">
                <img src="${actor.img}" title="${actor.name}" width="36" height="36" style="border:none;margin-right:5px;flex-shrink:0;">
                <img src="${iconToShow}" title="${nameToShow}" width="36" height="36" style="border:none;margin-right:5px;flex-shrink:0;">
                <h3 style="flex:1;margin:0;line-height:36px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Identify Item</h3>
            </header>
            <div class="card-content" style="font-size:0.95em;">
                <p style="margin:2px 0;"><strong>Attempted by:</strong> ${actor.name} using ${stat.label}</p>
                <p style="margin:2px 0;"><strong>Item:</strong> ${itemLink}</p>
                <p style="margin:2px 0;"><strong>Time Taken:</strong> ${timeTakenString}</p>
                <hr style="margin:5px 0;">
                <div style="margin:0px 0;"><strong>Result:</strong> ${playerOutcomeText}</div>
                ${retryText}
          
            </div>
        </div>`;

        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            flavor: chatFlavor,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            roll: roll.toJSON(),
            blind: true,
            whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id).concat(game.user.id),
            flags: {
                core: { canPopout: true },
                "pf2e.origin": { type: "skill", uuid: stat.item?.uuid, slug: stat.slug }
            }
        });

        ui.notifications.info(`ID attempt for "${nameToShow}" complete.`);
        return { success: (dos >= 2 || itemDeletedAndReplaced), item: finalLinkedItem, timeTakenString: timeTakenString };
    } catch (err) {
        console.error(`${MODULE_ID} | Error in _attemptIdentification for item ${item?.name} (UUID: ${item?.uuid}):`, err);
        ui.notifications.error(`Error during ID for "${item?.name ?? "an item"}". Check console.`);
        const errorContent = `<strong style="color:red;">ID Error:</strong> Unexpected error while ${actor?.name ?? "Someone"} IDed "${item?.name ?? "an item"}". Error: ${err.message}`;
        try {
            await ChatMessage.create({
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor }),
                content: errorContent,
                type: CONST.CHAT_MESSAGE_TYPES.OOC,
                whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id)
            });
        } catch (chatError) {
            console.error(`${MODULE_ID} | Failed to create error chat message:`, chatError);
        }
        return { success: false, item: item, timeTakenString: timeTakenString };
    }
};

}
