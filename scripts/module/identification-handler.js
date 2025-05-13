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
      school: {},
    };
    this._internalSpellInfo = {
      detect: {
        slug: "detect-magic",
        name: "Detect Magic",
        icon: "fa-search-location",
      },
      read: { slug: "read-aura", name: "Read Aura", icon: "fa-book-reader" },
    };
    console.log(`${MODULE_ID} | IdentificationHandler constructed.`);
  }

  // Note: _getIdentifyFeatsConfig is called only by the constructor,
  // so it doesn't strictly need to be an arrow function for 'this' context
  // if it doesn't use 'this' itself (which it doesn't, it uses getSetting).
  // However, for consistency, we can make it one.
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

  // Getters are fine as regular methods as they are typically called as this.getStyles()
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

  _showIdentifyItemsDialog = async (
    actor,
    itemsToIdentify,
    scanResultsData,
    scanType
  ) => {
    // ... (method content - already provided and reviewed)
    // Ensure any 'this' references inside this method correctly point to the IdentificationHandler instance.
    // Since it's now an arrow function, 'this' will be lexically bound.
    // The original logic within this method using 'this.identifyFeatsConfig', 'this.identifyIcons',
    // 'this.getStyles()', 'this.getIdentifySpellInfo()', and 'this.utils.createIdentifyLink'
    // will now work correctly due to the arrow function binding 'this'.
    // The Dialog's internal callbacks should also be arrow functions if they need to access 'this'
    // of _showIdentifyItemsDialog, but here they mostly call this._attemptIdentification.
    if (!itemsToIdentify || itemsToIdentify.length === 0) return;
    itemsToIdentify.sort((a, b) => a.item.name.localeCompare(b.item.name));
    const styles = this.getStyles();
    const currentIdentifySpellInfo = this.getIdentifySpellInfo();
    let cantripLinkHTML = "",
      spellInfoForLink = null,
      scanIdentifiedMessage = "";
    if (scanType === "detect") {
      spellInfoForLink = currentIdentifySpellInfo.detect;
      scanIdentifiedMessage = `<p style="margin:0;font-size:0.9em;color:${styles.neutralColor};">Non-magical items identified by Detect Magic.</p>`;
    } else if (scanType === "read") {
      spellInfoForLink = currentIdentifySpellInfo.read;
      scanIdentifiedMessage = `<p style="margin:0;font-size:0.9em;color:${styles.neutralColor};">Non-magical items identified by Read Aura.</p>`;
    }
    if (spellInfoForLink)
      cantripLinkHTML = `<div style="margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid #ccc;"><p style="margin:0;">Initial Scrutiny via: ${this.utils.createIdentifyLink(
        spellInfoForLink.id,
        spellInfoForLink.name,
        spellInfoForLink.icon
      )}</p>${scanIdentifiedMessage}</div>`;
    else if (scanType === "identify")
      cantripLinkHTML = `<div style="margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid #ccc;"><p style="margin:0;font-style:italic;color:${styles.neutralColor};">Direct identification attempt.</p></div>`;
    let itemListHTML = itemsToIdentify
      .map(({ actor: itemActor, item }) => {
        const result = scanResultsData.get(item.id),
          scholasticFeatSlug = getSetting(
            SETTINGS.SCHOLASTIC_IDENTIFICATION_SLUG
          ),
          scholasticFeatConfig = this.identifyFeatsConfig[scholasticFeatSlug],
          craftersAppraisalSlug = getSetting(SETTINGS.CRAFTERS_APPRAISAL_SLUG),
          craftersAppraisalConfig =
            this.identifyFeatsConfig[craftersAppraisalSlug];
        let scanDisplay = "",
          skillHintDisplay = "",
          itemSkills = new Set(["arc", "nat", "occ", "rel"]);
        if (
          scholasticFeatConfig &&
          itemActor.itemTypes.feat.some((f) => f.slug === scholasticFeatSlug)
        )
          itemSkills.add(scholasticFeatConfig.substituteSkill);
        if (
          craftersAppraisalConfig &&
          itemActor.itemTypes.feat.some(
            (f) => f.slug === craftersAppraisalSlug
          ) &&
          (itemActor.skills.crafting?.rank ?? 0) > 0 &&
          craftersAppraisalConfig.substituteSkill
        )
          itemSkills.add(craftersAppraisalConfig.substituteSkill);
        const traitSkills = new Set();
        item.traits.forEach((t) => {
          if (t === "arcane") traitSkills.add("arc");
          if (t === "primal") traitSkills.add("nat");
          if (t === "occult") traitSkills.add("occ");
          if (t === "divine") traitSkills.add("rel");
        });
        const finalSkillHints =
          traitSkills.size > 0
            ? Array.from(traitSkills)
            : Array.from(itemSkills);
        skillHintDisplay = `<span style="font-size:0.9em;color:#555;margin-left:8px;">(Suggests: ${finalSkillHints
          .map(
            (s) =>
              `<i class="fas ${
                this.identifyIcons.skill[s] || "fa-question-circle"
              }" title="${
                this.identifyIcons.skillTooltips[s] || "Unknown Skill"
              }"></i>`
          )
          .join(" ")} )</span>`;
        if (result) {
          let sDisplay = "";
          if (scanType === "read" && result.schools.length > 0) {
            sDisplay = `<span style="font-size:0.9em;color:#3a2151;margin-left:5px;">(School(s): ${result.schools
              .map(
                (s) =>
                  `<i class="fas ${
                    this.identifyIcons.school[s] || "fa-question-circle"
                  }" title="${s.charAt(0).toUpperCase() + s.slice(1)}"></i>`
              )
              .join(" ")} )</span>`;
          } else if (scanType === "read")
            sDisplay = `<span style="font-size:0.9em;color:#777;margin-left:5px;">(No School)</span>`;
          scanDisplay = `<span style="color:${styles.infoColor};font-weight:bold;margin-right:5px;">Magical Aura</span>${sDisplay}`;
        } else if (scanType === "identify")
          scanDisplay = `<span style="color:${styles.neutralColor};font-style:italic;margin-right:10px;">(Direct)</span>`;
        let failureNotice = "",
          disabledAttribute = "",
          itemActorLevel = itemActor.level,
          failMarkerPattern = new RegExp(
            `<!-- failureMarker:Fail_${itemActor.id}_L(\\d+) -->`
          ),
          unidDesc =
            item.system.identification?.unidentified?.data?.description
              ?.value ?? "",
          match = unidDesc.match(failMarkerPattern);
        if (match) {
          const failedAtLevel = parseInt(match[1], 10);
          if (itemActorLevel <= failedAtLevel) {
            failureNotice = `<span style="color:${
              styles.failureColor
            };font-weight:bold;margin-left:10px;" title="Failed ID at L${failedAtLevel} by ${
              itemActor.name
            }. Requires L${
              failedAtLevel + 1
            }."><i class="fas fa-exclamation-triangle"></i> Failed (L${failedAtLevel})</span>`;
            disabledAttribute = "disabled";
          }
        }
        return `<div style="display:flex;align-items:center;margin-bottom:8px;padding:5px;border:1px solid #888;border-radius:3px;background:rgba(0,0,0,0.03);"><img src="${
          item.img
        }" title="${item.name} (Held by ${
          itemActor.name
        })" width="36" height="36" style="margin-right:10px;flex-shrink:0;border:none;"><div style="flex-grow:1;margin-right:10px;"><label style="font-weight:bold;color:#191813;display:block;">${
          item.name
        }</label><span style="font-size:0.9em;color:#444;">By <em>${
          itemActor.name
        }</em></span> ${skillHintDisplay} ${failureNotice}</div><div style="flex-shrink:0;text-align:right;margin-right:10px;">${scanDisplay}</div><button type="button" data-actor-id="${
          itemActor.id
        }" data-item-id="${item.id}" style="flex-shrink:0;width:130px;cursor:${
          disabledAttribute ? "not-allowed" : "pointer"
        };" ${disabledAttribute}><i class="fas fa-search-plus"></i> Attempt Identify</button></div>`;
      })
      .join("");
    const quickIdSlug = getSetting(SETTINGS.QUICK_IDENTIFICATION_SLUG),
      anyActorHasQuickId = itemsToIdentify.some(({ actor: itemActor }) =>
        itemActor.itemTypes.feat.some((f) => f.slug === quickIdSlug)
      ),
      timeText = anyActorHasQuickId ? "10 min (maybe faster)" : "10 min";
    let dialogTitle =
      scanType === "detect" || scanType === "read"
        ? "Identify Magical Items"
        : "Identify All Items";
    let content = `<div style="text-align:center;margin-bottom:10px;"><i class="fas fa-book-dead fa-2x" style="color:#5a3a6b;"></i></div><h3 style="color:#191813;text-align:center;">${dialogTitle}</h3>${cantripLinkHTML}<p>Select an item. Time: ${timeText} per item (Quick ID may reduce).</p><p style="font-size:0.85em;color:#600;"><em><i class="fas fa-exclamation-triangle" style="color:darkred;"></i><strong> Failed (LX):</strong> Cannot retry until Level X+1 by same actor.</em></p><hr><form style="max-height:350px;overflow-y:auto;margin-bottom:10px;">${itemListHTML}</form>`;
    const identifyDialog = new Dialog(
      {
        title: dialogTitle,
        content: content,
        buttons: {
          cancel: {
            label: "Cancel",
            icon: '<i class="fas fa-times"></i>',
            callback: () => ui.notifications.info("Identification cancelled."),
          },
        },
        render: (html) => {
          html.on("click", ".content-link", (event) => {
            const el = event.currentTarget,
              pack = game.packs.get(el.dataset.pack);
            if (pack && el.dataset.id)
              pack
                .getDocument(el.dataset.id)
                .then((d) => d?.sheet.render(true));
          });
          html
            .find("button[data-item-id]:not([disabled])")
            .on("click", async (event) => {
              const button = event.currentTarget;
              button.disabled = true;
              button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Identifying...`;
              const actorId = button.dataset.actorId,
                itemId = button.dataset.itemId,
                itemActor = game.actors.get(actorId),
                item = itemActor ? itemActor.items.get(itemId) : null;
              if (!itemActor || !item) {
                ui.notifications.error("Item or Actor not found!");
                button.disabled = false;
                button.innerHTML = `<i class="fas fa-search-plus"></i> Attempt Identify`;
                return;
              }
              try {
                await identifyDialog.close({ force: true });
              } catch (e) {}
              await this._attemptIdentification(itemActor, item);
            });
        },
      },
      { width: 650 }
    );
    identifyDialog.render(true);
  };

  _promptIdentifySkill = async (
    actor,
    item,
    dc,
    possibleSkills,
    actorFeatsForPrompt
  ) => {
    // ... (method content - already provided and reviewed)
    // This method returns a Promise and its internal callbacks are already arrow functions
    // or simple value returns, so 'this' usage inside should be fine if it refers to
    // properties like this.identifyIcons. The main method being an arrow function ensures
    // 'this' is the IdentificationHandler instance when those properties are accessed.
    let skillButtons = {},
      featCheckboxesHTML = "",
      defaultSkill = null,
      maxMod = -Infinity,
      odditySlug = getSetting(SETTINGS.ODDITY_IDENTIFICATION_SLUG);
    const toggleableFeats = actorFeatsForPrompt.filter(
      (feat) => feat.type === "roll_modifier"
    );
    let featToggleIntro = !1;
    toggleableFeats.forEach((feat) => {
      let canShowToggle = !0;
      if (feat.slug === odditySlug && feat.requiresTrainedOccultism)
        canShowToggle = (actor.skills.occultism?.rank ?? 0) > 0;
      if (canShowToggle) {
        if (!featToggleIntro) {
          featCheckboxesHTML += `<hr><p style="font-weight:bold;margin-bottom:3px;"><i class="fas fa-star-of-life"></i> Apply Techniques?</p><p style="font-size:0.9em;font-style:italic;margin-top:-2px;margin-bottom:5px;">Select if conditions met:</p>`;
          featToggleIntro = !0;
        }
        featCheckboxesHTML += `<div style="margin-top:5px;margin-left:10px;font-size:0.9em;"><input type="checkbox" id="feat-toggle-${
          feat.slug
        }" name="feat-${feat.slug}" value="${
          feat.slug
        }"><label for="feat-toggle-${feat.slug}" title="${
          feat.description || ""
        }">${feat.name}${
          feat.slug === odditySlug
            ? '<i style="font-weight:normal;color:#555;"> (If mental/divination/etc.)</i>'
            : ""
        }</label></div>`;
      }
    });
    if (featCheckboxesHTML) featCheckboxesHTML += "<hr>";
    return new Promise((resolve) => {
      possibleSkills.forEach((slug) => {
        const fullSkillName = this.identifyIcons.skillDataMap[slug];
        if (!fullSkillName) return;
        const statistic = actor.getStatistic(fullSkillName);
        if (!statistic) return;
        const mod = statistic.check.mod,
          icon = this.identifyIcons.skill[slug] || "fa-question-circle";
        skillButtons[slug] = {
          label: `${statistic.label} (${mod >= 0 ? "+" : ""}${mod})`,
          icon: `<i class="fas ${icon}"></i>`,
          callback: (html) => {
            const selectedFeats = [];
            html.find('input[name^="feat-"]:checked').each(function () {
              selectedFeats.push($(this).val());
            });
            resolve({ skillSlug: slug, selectedFeatSlugs: selectedFeats });
          },
        };
        if (mod > maxMod) {
          maxMod = mod;
          defaultSkill = slug;
        }
      });
      if (Object.keys(skillButtons).length === 0) {
        ui.notifications.error(
          `No suitable skills for ${actor.name} to ID ${item.name}.`
        );
        resolve(null);
        return;
      }
      let dialogContent = `<div style="text-align:center;"><i class="fas fa-brain fa-2x" style="color:#888;"></i></div><p><em>${actor.name}</em>, choose skill to ID <strong>${item.name}</strong>.</p><p style="text-align:center;font-size:1.1em;">Item DC ${dc}</p>${featCheckboxesHTML}<p>Select skill:</p>`;
      new Dialog({
        title: `Channel Knowledge: ${item.name}`,
        content: dialogContent,
        buttons: skillButtons,
        default: defaultSkill || Object.keys(skillButtons)[0],
        close: () => {
          ui.notifications.warn(`ID attempt cancelled for "${item.name}".`);
          resolve(null);
        },
      }).render(!0);
    });
  };

  _attemptIdentification = async (actor, item) => {

    let roll = null;
    const styles = this.getStyles();
    const wronglyIdentifiedConf = this.getWronglyIdentifiedConfig();
    const compendiumsForReplacement = getSetting(SETTINGS.COMPENDIUMS_TO_SEARCH)
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);
    try {
      let dc = null;
      const explicitDC = item.system.identification?.dc;
      dc = this.dcCalculator.calculateDC(item.level ?? 0, {
        rarity: item.rarity ?? "common",
        specificDC:
          explicitDC && !isNaN(explicitDC) && explicitDC > 0
            ? parseInt(explicitDC, 10)
            : null,
        dcType: "identification",
      });
      if (!dc || dc <= 0) {
        const manualDCInput = await Dialog.prompt({
          title: `Manual DC: ${item.name}`,
          content: `<p>Could not get DC for <strong>${item.name}</strong>. Enter DC:</p><input type="number" name="manualDC" value="15" style="width:100%;"/>`,
          label: "Set DC",
          rejectClose: !1,
          callback: (html) => {
            const val = html.find('[name="manualDC"]').val();
            return val ? parseInt(val, 10) : null;
          },
        });
        if (manualDCInput && manualDCInput > 0) dc = manualDCInput;
        else {
          ui.notifications.warn(
            `Manual DC invalid. ID aborted for ${item.name}.`
          );
          return;
        }
      }
      const possibleSkillsBase = ["arc", "nat", "occ", "rel"],
        actorFeatItems = actor.itemTypes.feat;
      let possibleSkills = [...possibleSkillsBase];
      const scholasticFeatSlug = getSetting(
          SETTINGS.SCHOLASTIC_IDENTIFICATION_SLUG
        ),
        scholasticFeatConfig = this.identifyFeatsConfig[scholasticFeatSlug],
        hasScholasticFeat =
          scholasticFeatConfig &&
          actorFeatItems.some((f) => f.slug === scholasticFeatSlug);
      if (hasScholasticFeat)
        possibleSkills.push(scholasticFeatConfig.substituteSkill);
      const craftersAppraisalSlug = getSetting(
          SETTINGS.CRAFTERS_APPRAISAL_SLUG
        ),
        craftersAppraisalConfig =
          this.identifyFeatsConfig[craftersAppraisalSlug],
        hasCraftersAppraisal =
          craftersAppraisalConfig &&
          actorFeatItems.some((f) => f.slug === craftersAppraisalSlug);
      if (
        hasCraftersAppraisal &&
        (actor.skills.crafting?.rank ?? 0) > 0 &&
        craftersAppraisalConfig.substituteSkill
      )
        possibleSkills.push(craftersAppraisalConfig.substituteSkill);
      possibleSkills = [...new Set(possibleSkills)];
      const finalSkills = possibleSkills.filter((skillSlug) => {
        const skillDataName = this.identifyIcons.skillDataMap[skillSlug];
        if (!skillDataName) return !1;
        const skill = actor.skills[skillDataName],
          rank = skill?.rank ?? 0;
        if (
          skillSlug === scholasticFeatConfig?.substituteSkill &&
          hasScholasticFeat &&
          scholasticFeatConfig?.requiresMaster &&
          rank < 3
        )
          return !1;
        return rank > 0;
      });
      if (finalSkills.length === 0) {
        ui.notifications.error(
          `${actor.name} lacks trained skill(s) to ID ${item.name}.`
        );
        return;
      }
      const actorFeatSlugs = new Set(actorFeatItems.map((f) => f.slug)),
        featsForPrompt = Object.values(this.identifyFeatsConfig).filter(
          (featConfig) =>
            featConfig &&
            actorFeatSlugs.has(featConfig.slug) &&
            featConfig.type !== "skill_substitution"
        );
      const promptResult = await this._promptIdentifySkill(
        actor,
        item,
        dc,
        finalSkills,
        featsForPrompt
      );
      if (!promptResult) {
        ui.notifications.info("ID cancelled.");
        return;
      }
      const { skillSlug: chosenSkillSlug, selectedFeatSlugs } = promptResult,
        chosenSkillDataName = this.identifyIcons.skillDataMap[chosenSkillSlug];
      if (!chosenSkillDataName) {
        ui.notifications.error(
          `Internal Error: No skill data for '${chosenSkillSlug}'.`
        );
        return;
      }
      const stat = actor.skills[chosenSkillDataName];
      if (!stat) {
        ui.notifications.error(
          `Internal Error: Stat '${chosenSkillDataName}' not found.`
        );
        return;
      }
      const mods = (selectedFeatSlugs ?? [])
        .map((slug) => this.identifyFeatsConfig[slug]?.modifier)
        .filter((m) => m)
        .map((m) => new game.pf2e.Modifier(m));
      const opts = new Set(
        actor.getRollOptions(["all", "skill-check", stat.slug])
      );
      opts.add(`action:identify-magic`);
      if (item.traits.has("magical")) opts.add("item:magical");
      (selectedFeatSlugs ?? []).forEach((slug) => opts.add(`feat:${slug}`));
      item.traits.forEach((t) => opts.add(`item:trait:${t}`));
      const assuredIdSlug = getSetting(SETTINGS.ASSURED_IDENTIFICATION_SLUG),
        hasAssuredId =
          this.identifyFeatsConfig[assuredIdSlug] &&
          actorFeatItems.some((f) => f.slug === assuredIdSlug);
      const quickIdSlug = getSetting(SETTINGS.QUICK_IDENTIFICATION_SLUG),
        hasQuickId =
          this.identifyFeatsConfig[quickIdSlug] &&
          actorFeatItems.some((f) => f.slug === quickIdSlug);
      let timeMsg = "10 minutes";
      if (hasQuickId) {
        const rank = stat.rank ?? 0;
        if (rank >= 4) timeMsg = "1 Action";
        else if (rank >= 2) timeMsg = "1 minute";
        else timeMsg = "1 minute";
      }
      const unidentifiedName =
        item.system?.identification?.unidentified?.data?.name?.value ||
        item.name;
      ui.notifications.info(
        `Attempting to ID ${unidentifiedName}... (${timeMsg})`
      );
      roll = await stat.roll({
        dc: { value: dc },
        item: item,
        extraRollOptions: Array.from(opts),
        modifiers: mods,
        title: `Identify Magic Items: ${unidentifiedName}`,
        rollMode: CONST.DICE_ROLL_MODES.BLIND,
      });
      if (!roll) {
        ui.notifications.warn(`ID roll cancelled.`);
        return;
      }
      let dos = roll.degreeOfSuccess;
      const origCritFail = dos === 0;
      let assuredApplied = !1;
      if (origCritFail && hasAssuredId) {
        dos = 1;
        assuredApplied = !0;
      }
      let playerOutcomeText = "",
        itemToLinkInChat = item,
        updateData = {},
        itemDeletedAndReplaced = !1;
      if (dos === 0 && !assuredApplied) {
        itemDeletedAndReplaced = !0;
        const originalIdentifiedName = item._source?.name ?? item.name,
          originalSourceId = item.sourceId,
          misidentificationTimestamp = new Date().toLocaleString(),
          identifyingActorName = actor.name,
          originalItemId = item.id,
          originalItemType = item.type,
          originalItemLevel = item.level ?? 0,
          originalWeaponGroup = item.isOfType("weapon")
            ? item.system.group
            : null,
          originalArmorGroup = item.isOfType("armor")
            ? item.system.group
            : null,
          originalArmorCategory = item.isOfType("armor")
            ? item.system.category
            : null,
          significantConsumableTraits = [
            "potion",
            "scroll",
            "elixir",
            "bomb",
            "oil",
            "talisman",
            "ammo",
            "snare",
            "drug",
            "tool",
          ];
        let originalMainConsumableTrait = null;
        if (item.isOfType("consumable"))
          originalMainConsumableTrait = item.system.traits.value.find((t) =>
            significantConsumableTraits.includes(t)
          );
        const originalEquipmentTraits = item.isOfType("equipment")
          ? item.system.traits.value
          : [];
        ui.notifications.info(
          `Crit Fail IDing ${originalIdentifiedName}. Misidentifying...`,
          { permanent: !1 }
        );
        let replacementItemDataSource = null,
          finalMisidentifiedName = "";
        try {
          let allPotentialItems = [];
          for (const packName of compendiumsForReplacement) {
            const pack = game.packs.get(packName);
            if (!pack) continue;
            const index = await pack.getIndex({
              fields: [
                "name",
                "type",
                "uuid",
                "system.level.value",
                "system.group",
                "system.category",
                "system.traits.value",
              ],
            });
            allPotentialItems.push(
              ...index.filter(
                (i) =>
                  [
                    "weapon",
                    "armor",
                    "equipment",
                    "consumable",
                    "treasure",
                    "backpack",
                    "container",
                    "loot",
                  ].includes(i.type) &&
                  !i.name.startsWith("Formula:") &&
                  i.uuid !== item.sourceId &&
                  (i.system?.level?.value ?? 0) <= actor.level + 3 &&
                  (i.system?.level?.value ?? 0) >= Math.max(0, actor.level - 2)
              )
            );
          }
          if (allPotentialItems.length === 0)
            throw new Error("No items in level range for replacement.");
          let specificMatches = [],
            typeMatches = [],
            chosenPool = [];
          if (originalItemType === "weapon" && originalWeaponGroup)
            specificMatches = allPotentialItems.filter(
              (p) =>
                p.type === "weapon" && p.system?.group === originalWeaponGroup
            );
          else if (originalItemType === "armor" && originalArmorGroup) {
            specificMatches = allPotentialItems.filter(
              (p) =>
                p.type === "armor" && p.system?.group === originalArmorGroup
            );
            if (specificMatches.length > 1 && originalArmorCategory) {
              const categoryMatches = specificMatches.filter(
                (p) => p.system?.category === originalArmorCategory
              );
              if (categoryMatches.length > 0) specificMatches = categoryMatches;
            }
          } else if (
            originalItemType === "consumable" &&
            originalMainConsumableTrait
          )
            specificMatches = allPotentialItems.filter(
              (p) =>
                p.type === "consumable" &&
                p.system?.traits?.value?.includes(originalMainConsumableTrait)
            );
          else if (originalItemType === "equipment") {
            if (originalEquipmentTraits.includes("wand"))
              specificMatches = allPotentialItems.filter(
                (p) =>
                  p.type === "equipment" &&
                  p.system?.traits?.value?.includes("wand")
              );
            else if (originalEquipmentTraits.includes("staff"))
              specificMatches = allPotentialItems.filter(
                (p) =>
                  p.type === "equipment" &&
                  p.system?.traits?.value?.includes("staff")
              );
          }
          if (specificMatches.length > 0) chosenPool = specificMatches;
          else {
            typeMatches = allPotentialItems.filter(
              (p) => p.type === originalItemType
            );
            if (typeMatches.length > 0) chosenPool = typeMatches;
            else chosenPool = allPotentialItems;
          }
          if (chosenPool.length === 0)
            throw new Error(
              `No suitable replacement for ${originalIdentifiedName}.`
            );
          const randomIndex = Math.floor(Math.random() * chosenPool.length),
            selectedReplacementRef = chosenPool[randomIndex],
            fetchedReplacement = await fromUuid(selectedReplacementRef.uuid);
          if (!fetchedReplacement || !fetchedReplacement.isOfType("physical"))
            throw new Error(
              `Failed to fetch/invalid replacement ${selectedReplacementRef.name}`
            );
    if (!fetchedReplacement || !fetchedReplacement.isOfType("physical")) {
            throw new Error(`Failed to fetch/invalid replacement ${selectedReplacementRef.name}`);
          }

          // --- APPLY SETTINGS FOR DECEPTIVE ITEM NAME AND DESCRIPTION ---
          const baseNameForReplacement = fetchedReplacement.name;
          const idSuffix = `(Id by ${actor.name})`;
          
          let prefixedBaseName = baseNameForReplacement;
          if (wronglyIdentifiedConf.prefix && wronglyIdentifiedConf.prefix.trim() !== "") {
            // Add prefix only if it's not already there (e.g., from compendium item name itself)
            if (!baseNameForReplacement.toLowerCase().startsWith(wronglyIdentifiedConf.prefix.toLowerCase().trim())) {
                 prefixedBaseName = `${wronglyIdentifiedConf.prefix.trim()} ${baseNameForReplacement}`;
            }
          }
          finalMisidentifiedName = `${prefixedBaseName} ${idSuffix}`;
          replacementItemDataSource = fetchedReplacement.toObject(!1);
          delete replacementItemDataSource._id;
          replacementItemDataSource.name = finalMisidentifiedName;
          replacementItemDataSource.img = fetchedReplacement.img;
          replacementItemDataSource.system.quantity = 1;
          replacementItemDataSource.system.identification = {
            status: "identified",
            identified: {
              name: finalMisidentifiedName,
              img: fetchedReplacement.img,
              data: {
                description: {
                  value: fetchedReplacement.system.description?.value + wronglyIdentifiedConf.desc.trim() || "",
                },
              },
            },
            unidentified: {
              name: `Unidentified ${fetchedReplacement.type}`,
              img: "icons/svg/mystery-man.svg",
              data: { description: { value: "<p>True nature obscured.</p>" } },
            },
            misidentifiedData: null,
          };
        } catch (selectionError) {
          ui.notifications.error(
            `Crit Fail Aborted: Replacement error: ${selectionError.message}`
          );
          console.error(
            "Replacement selection error:",
            selectionError,
            "Name:",
            finalMisidentifiedName
          );
          dos = 1;
          itemDeletedAndReplaced = !1;
          ui.notifications.warn(
            `Crit Fail on ${originalIdentifiedName} -> Failure due to replacement error.`
          );
        }
        if (itemDeletedAndReplaced && replacementItemDataSource) {
          try {
            await actor.deleteEmbeddedDocuments("Item", [originalItemId]);
          } catch (deleteError) {
            ui.notifications.error(
              `CRITICAL ERROR: Failed to delete ${originalIdentifiedName}. Replacement aborted. ${deleteError.message}`
            );
            itemDeletedAndReplaced = !1;
            return;
          }
          let newItemDoc = null;
          try {
            const createdDocs = await actor.createEmbeddedDocuments("Item", [
              replacementItemDataSource,
            ]);
            if (!createdDocs || createdDocs.length === 0)
              throw new Error("Replacement creation returned no docs.");
            newItemDoc = createdDocs[0];
            itemToLinkInChat = newItemDoc;
            const gmNoteHeader = `--- Crit Fail ID (${misidentificationTimestamp}) ---`,
              gmNoteContent = `<strong>Player:</strong> ${identifyingActorName}<br><strong>Believes Identified:</strong> "${newItemDoc.name}"<br><strong>Actual Item:</strong> "${originalIdentifiedName}" (Type: ${originalItemType}, Lvl: ${originalItemLevel}). Removed & Replaced.<br><em>Player unaware.</em>`;
            const currentGMNotes = newItemDoc.system.description?.gm ?? "",
              newGMNotes = `${gmNoteHeader}\n${gmNoteContent}\n${
                currentGMNotes ? "<hr>" + currentGMNotes : ""
              }`;
            let updateForNewItem = { "system.description.gm": newGMNotes };
            await newItemDoc.update(updateForNewItem);
            console.log(
              `${MODULE_ID} | CritFail ID: Replaced ${originalIdentifiedName} with ${newItemDoc.name}.`
            );
          } catch (creationError) {
            ui.notifications.error(
              `CRITICAL ERROR: Failed to create/update replacement ${replacementItemDataSource?.name}. ${creationError.message}`
            );
            console.error(
              "Replacement creation error:",
              creationError,
              "Name:",
              replacementItemDataSource?.name
            );
            itemDeletedAndReplaced = !1;
            return;
          }
        }
        playerOutcomeText = `<span style="color:${styles.successColor};font-weight:bold;">Success!</span> You understand it.`;
      } else if (dos >= 2) {
        playerOutcomeText = `<span style="color:${
          styles.successColor
        };font-weight:bold;">${
          dos === 3 ? "Crit Success!" : "Success!"
        }</span> You understand it.`;
        updateData["system.identification.status"] = "identified";
        let baseNameForItemSuffix;
        if (
          item.system.identification?.identified?.name &&
          item.system.identification.identified.name.trim() !== ""
        )
          baseNameForItemSuffix =
            item.system.identification.identified.name.trim();
        else if (item._source?.name && item._source.name.trim() !== "")
          baseNameForItemSuffix = item._source.name.trim();
        else
          baseNameForItemSuffix = item.name
            .replace(/\s*\((?:Id by .*?|Crafted by .*?|Unidentified)\)$/i, "")
            .trim();
        const idSuffix = `(Id by ${actor.name})`;
        let finalIdentifiedName;
        if (baseNameForItemSuffix && baseNameForItemSuffix.trim() !== "") {
          if (!baseNameForItemSuffix.endsWith(idSuffix))
            finalIdentifiedName = `${baseNameForItemSuffix} ${idSuffix}`;
          else finalIdentifiedName = baseNameForItemSuffix;
        } else {
          let trueBaseName =
            item.system.identification?.identified?.name ||
            item._source?.name ||
            item.name;
          trueBaseName = trueBaseName
            .replace(/\s*\((?:Id by .*?|Crafted by .*?|Unidentified)\)$/i, "")
            .trim();
          if (trueBaseName && trueBaseName.trim() !== "")
            finalIdentifiedName = `${trueBaseName} ${idSuffix}`;
          else finalIdentifiedName = `Identified Item ${idSuffix}`;
        }
        updateData["name"] = finalIdentifiedName;
        updateData["system.identification.identified.name"] =
          finalIdentifiedName;
        updateData["system.identification.identified.img"] = item.img;
        if (!item.system.identification.unidentified) {
          updateData["system.identification.unidentified"] = {
            name: `Unidentified ${item.type}`,
            img: "icons/svg/mystery-man.svg",
            data: { description: { value: "" } },
          };
        } else {
          if (typeof item.system.identification.unidentified.name !== "string")
            updateData[
              "system.identification.unidentified.name"
            ] = `Unidentified ${item.type}`;
          if (typeof item.system.identification.unidentified.img !== "string")
            updateData["system.identification.unidentified.img"] =
              "icons/svg/mystery-man.svg";
        }
        if (!item.system.identification.identified)
          updateData["system.identification.identified.data"] = {
            description: { value: item.system.description.value || "" },
          };
        updateData[
          `flags.${MODULE_ID}.-=${wronglyIdentifiedConf.originalDataFlag}`
        ] = null;
        const currentUnidDesc =
            item.system.identification?.unidentified?.data?.description
              ?.value ?? "",
          cleanedDesc = currentUnidDesc
            .replace(
              /(<!-- failureMarker:Fail_[^_]+_L\d+ -->|<!-- SCF:DECEPTIVE_CRIT_FAIL -->)/g,
              ""
            )
            .replace(wronglyIdentifiedConf.desc, "")
            .trim();
        if (cleanedDesc !== currentUnidDesc)
          updateData[
            "system.identification.unidentified.data.description.value"
          ] = cleanedDesc || null;
        const currentMainDesc = item.system.description?.value ?? "";
        if (currentMainDesc.includes(wronglyIdentifiedConf.deceptiveMarker))
          updateData["system.description.value"] = currentMainDesc
            .replace(wronglyIdentifiedConf.deceptiveMarker, "")
            .trim();
      } else {
        const lvl = actor.level,
          failMarker = `<!-- failureMarker:Fail_${actor.id}_L${lvl} -->`;
        playerOutcomeText = `<span style="color:orange;font-weight:bold;">Failure.</span> Item resists.`;
        if (assuredApplied)
          playerOutcomeText += ` <span style="font-style:italic;color:#777;">(Assured ID prevents worse)</span>`;
        playerOutcomeText += `<br><em style="font-size:0.9em;">${
          actor.name
        } cannot retry until Lvl ${lvl + 1}.</em>`;
        updateData["system.identification.status"] = "unidentified";
        const descPath =
          "system.identification.unidentified.data.description.value";
        let currentUnidDesc =
          item.system.identification?.unidentified?.data?.description?.value ??
          "";
        currentUnidDesc = currentUnidDesc
          .replace(/<!-- failureMarker:Fail_[^_]+_L\d+ -->/g, "")
          .trim();
        currentUnidDesc = currentUnidDesc
          .replace(wronglyIdentifiedConf.deceptiveMarker, "")
          .trim();
        currentUnidDesc = currentUnidDesc
          .replace(wronglyIdentifiedConf.desc, "")
          .trim();
        updateData[descPath] = currentUnidDesc
          ? `${currentUnidDesc} ${failMarker}`
          : failMarker;
        updateData[
          `flags.${MODULE_ID}.-=${wronglyIdentifiedConf.originalDataFlag}`
        ] = null;
        const currentMainDesc = item.system.description?.value ?? "";
        if (currentMainDesc.includes(wronglyIdentifiedConf.deceptiveMarker))
          updateData["system.description.value"] = currentMainDesc
            .replace(wronglyIdentifiedConf.deceptiveMarker, "")
            .trim();
      }
      if (!itemDeletedAndReplaced && Object.keys(updateData).length > 0) {
        try {
          await item.update(updateData);
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (updateError) {
          ui.notifications.error(
            `Error updating ${item.name} after ID: ${updateError.message}`
          );
        }
      }
      const finalLinkedItem = actor.items.get(itemToLinkInChat.id);
      let nameToShow = "Unknown Item",
        iconToShow = "icons/svg/mystery-man.svg",
        itemLink = `Item (${itemToLinkInChat?.id ?? "unknown"})`,
        retryText = "";
      if (!finalLinkedItem) {
        nameToShow = itemToLinkInChat?.name ?? "Item (State Error)";
        iconToShow = itemToLinkInChat?.img ?? "icons/svg/hazard.svg";
        itemLink = itemToLinkInChat?.uuid
          ? `@UUID[${itemToLinkInChat.uuid}]{${nameToShow}} (Post-Op Fail)`
          : nameToShow;
        ui.notifications.warn(
          `Could not fetch final state for ${itemToLinkInChat?.id}.`
        );
      } else {
        if (itemDeletedAndReplaced || finalLinkedItem.isIdentified) {
          nameToShow = finalLinkedItem.name;
          iconToShow = finalLinkedItem.img;
          itemLink = `@UUID[${finalLinkedItem.uuid}]{${nameToShow}}`;
        } else {
          nameToShow =
            finalLinkedItem.system.identification?.unidentified?.data?.name
              ?.value || "Unidentified Item";
          iconToShow =
            finalLinkedItem.system.identification?.unidentified?.data?.img ||
            "icons/svg/mystery-man.svg";
          itemLink = `@UUID[${finalLinkedItem.uuid}]{${nameToShow}}`;
          if (dos === 1)
            retryText = `<p style="font-size:0.8em;color:#800000;"><em>(Cannot retry until Lvl ${
              actor.level + 1
            })</em></p>`;
        }
      }
      const chatFlavor = `<div class="pf2e chat-card" style="padding:3px;border:1px solid var(--color-border-light-tertiary);font-size:14px;"><header class="card-header flexrow" style="border-bottom:1px solid var(--color-border-light-tertiary);padding-bottom:3px;margin-bottom:3px;"><img src="${
        actor.img
      }" title="${
        actor.name
      }" width="36" height="36" style="border:none;margin-right:5px;flex-shrink:0;"><img src="${iconToShow}" title="${nameToShow}" width="36" height="36" style="border:none;margin-right:5px;flex-shrink:0;"><h3 style="flex:1;margin:0;line-height:36px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Identify Item</h3></header><div class="card-content" style="font-size:0.95em;"><p style="margin:2px 0;"><strong>Attempted by:</strong> ${
        actor.name
      } using ${
        stat.label
      }</p><p style="margin:2px 0;"><strong>Item:</strong> ${itemLink}</p><hr style="margin:5px 0;"><div style="margin:0px 0;"><strong>Result:</strong> ${playerOutcomeText}</div>${retryText}${
        itemDeletedAndReplaced
          ? `<p style="font-size:0.8em;color:#550055;font-style:italic;"></p>`
          : ""
      }</div></div>`;
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: chatFlavor,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        roll: roll.toJSON(),
        blind: !0,
        whisper: ChatMessage.getWhisperRecipients("GM")
          .map((u) => u.id)
          .concat(game.user.id),
        flags: {
          core: { canPopout: !0 },
          "pf2e.origin": {
            type: "skill",
            uuid: stat.item?.uuid,
            slug: stat.slug,
          },
        },
      });
      ui.notifications.info(`ID attempt for "${nameToShow}" complete.`);
    } catch (err) {
      console.error(
        `${MODULE_ID} | Error during ID for item ${item?.id} on actor ${actor?.id}:`,
        err
      );
      ui.notifications.error(
        `Error during ID for "${item?.name ?? "an item"}". Check console.`
      );
      const errorContent = `<strong style="color:red;">ID Error:</strong> Unexpected error while ${
        actor?.name ?? "Someone"
      } IDed "${item?.name ?? "an item"}". Console (F12) for details. Error: ${
        err.message
      }`;
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: errorContent,
        type: CONST.CHAT_MESSAGE_TYPES.OOC,
        whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
      });
    }
  };

  runIdentifyMagicProcess = async (sheetActor = null) => {
    console.error(
      `--- IDENTIFICATION HANDLER (ARROW FN): runIdentifyMagicProcess ENTERED --- sheetActor:`,
      sheetActor?.name || "None"
    );

    const styles = this.getStyles();
    const currentIdentifySpellInfo = this.getIdentifySpellInfo();

    try {
      if (!this.utils) {
        console.error(
          `${MODULE_ID} | runIdentifyMagicProcess (ARROW): this.utils is undefined!`
        );
        ui.notifications.error("Identification utilities not available.");
        return;
      }

      const actors = this.utils.determineTargetActors(sheetActor);
      // console.log(`${MODULE_ID} | runIdentifyMagicProcess (ARROW): Determined target actors:`, actors?.map(a => a.name));

      if (!actors || actors.length === 0) {
        ui.notifications.warn(
          "Identify Magic: No actor found. Please select a token or have a character assigned."
        );
        // console.log(`${MODULE_ID} | runIdentifyMagicProcess (ARROW): No target actors found, exiting.`);
        return;
      }

      const primaryActor = actors[0];
      const actorNames = actors.map((a) => `<em>${a.name}</em>`).join(", ");

      const actorHasDetect = this.utils.actorHasSpellAvailable(
        primaryActor,
        currentIdentifySpellInfo.detect.slug
      );
      const actorHasReadAura = this.utils.actorHasSpellAvailable(
        primaryActor,
        currentIdentifySpellInfo.read.slug
      );

      let initialItemList = [];
      for (const actor of actors) {
        const items = actor.items.filter(
          (i) => i.system?.identification?.status === "unidentified"
        );
        items.forEach((item) => initialItemList.push({ actor, item }));
      }

      if (initialItemList.length === 0) {
        ui.notifications.info(`No unidentified items on ${actorNames}.`);
        // console.log(`${MODULE_ID} | runIdentifyMagicProcess (ARROW): No unidentified items found.`);
        return;
      }

      const itemCount = initialItemList.length;

      const detectMagicLink = this.utils.createIdentifyLink(
        currentIdentifySpellInfo.detect.id,
        currentIdentifySpellInfo.detect.name,
        currentIdentifySpellInfo.detect.icon
      );
      const readAuraLink = this.utils.createIdentifyLink(
        currentIdentifySpellInfo.read.id,
        currentIdentifySpellInfo.read.name,
        currentIdentifySpellInfo.read.icon
      );

      // --- RESTORED FULL DIALOG CONTENT ---
      let initialDialogContent = `
                <div style="text-align: center; margin-bottom: 10px;"><i class="fas fa-scroll fa-2x" style="color: #8B4513;"></i></div>
                <p>Before ${actorNames} lie ${itemCount} object(s) shrouded in mystery.</p>
                <p>How will you approach deciphering their nature?</p>
                <hr style="border-color: #aaa;">

                <div style="margin-bottom: 8px;">
                    <i class="fas fa-search-location fa-fw" style="color: #4682B4;"></i>
                    <strong>Detect Magic</strong> (10 min + scan) ${detectMagicLink}
                    ${
                      !actorHasDetect
                        ? '<i class="fas fa-times-circle fa-xs" style="color: tomato;" title="Spell not available"></i>'
                        : ""
                    }
                    <br><span style="font-size: 0.9em; margin-left: 20px;"><em>Scans items one by one, reveals magical presence, and automatically identifies non-magical items. Remaining magical items require a skill check.</em></span>
                </div>

                <div style="margin-bottom: 8px;">
                    <i class="fas fa-book-reader fa-fw" style="color: #8A2BE2;"></i>
                    <strong>Read Aura</strong> (1 min + scan) ${readAuraLink}
                    ${
                      !actorHasReadAura
                        ? '<i class="fas fa-times-circle fa-xs" style="color: tomato;" title="Spell not available"></i>'
                        : ""
                    }
                    <br><span style="font-size: 0.9em; margin-left: 20px;"><em>Scans items one by one, reveals magical presence & schools, and automatically identifies non-magical items. Remaining magical items require a skill check.</em></span>
                </div>

                <div style="margin-bottom: 8px;">
                    <i class="fas fa-wand-magic-sparkles fa-fw" style="color: #DAA520;"></i>
                    <strong>Identify Directly</strong>
                    <br><span style="font-size: 0.9em; margin-left: 20px;"><em>Attempt skill check directly (10 min base per item). No pre-scan; non-magical items are only identified on a successful check.</em></span>
                </div>

                <hr style="border-color: #aaa;">

                <div style="margin-bottom: 10px; padding: 5px; border: 1px solid #ccc; border-radius: 3px; background: #f0f0f0;">
                    <input type="checkbox" id="bypass-spell-restrictions" name="bypassRestrictions" style="vertical-align: middle;">
                    <label for="bypass-spell-restrictions" style="vertical-align: middle; font-size: 0.9em; color: #333;" title="Allows selecting Detect/Read even if spell is missing (scan results might be less accurate or unavailable)."><i class="fas fa-magic"></i> Bypass Spell Knowledge</label>
                </div>

                <details><summary style="cursor: pointer; font-weight: bold;"><i class="fas fa-info-circle"></i> Identification Rules Overview</summary><div style="font-size: 0.9em; padding-left: 15px;">
                    <p><strong>Detect/Read Aura Scan:</strong> Auto-identifies non-magical items. Magical items require a follow-up skill check.</p>
                    <p><strong>Identify Directly:</strong> Requires a skill check for all items.</p>
                    <p><strong>Skill Check Outcomes:</strong></p>
                    <ul>
                        <li><strong>Crit Success/Success:</strong> Item identified.</li>
                        <li><strong>Failure:</strong> Item stays unidentified. Cannot retry with the same actor until Level+1.</li>
                        <li><strong>Crit Failure:</strong> <strong style="color:${
                          styles.successColor
                        };">Success! (Deceptive to Player)</strong> Item appears generically identified to player, but remains unidentified internally. GM sees true outcome. Cannot retry with the same actor until Level+1.</li>
                    </ul>
                    <p style="margin-top: 5px;"><i class="fas fa-clock"></i> Base time is 10 minutes per item for skill check. Quick Identification feat can reduce this.</p>
                </div></details>

                <hr style="border-color: #aaa; margin-top: 10px;">
                <p style="font-size: 0.9em; color: #555; text-align: center;"><em>Choose your approach...</em></p>
            `;
      new Dialog({
        title: "Unraveling Mysteries",
        content: initialDialogContent,
        buttons: {
          detect: {
            label: "Detect",
            icon: '<i class="fas fa-search-location"></i>',
            callback: async (html) =>
              await this._handleIdentifyChoice(
                "detect",
                initialItemList,
                html.find("#bypass-spell-restrictions").prop("checked")
              ),
          },
          read: {
            label: "Read Aura",
            icon: '<i class="fas fa-book-reader"></i>',
            callback: async (html) =>
              await this._handleIdentifyChoice(
                "read",
                initialItemList,
                html.find("#bypass-spell-restrictions").prop("checked")
              ),
          },
          identify: {
            label: "Identify Directly",
            icon: '<i class="fas fa-wand-magic-sparkles"></i>',
            callback: async () =>
              await this._handleIdentifyChoice("identify", initialItemList),
          },
          cancel: {
            label: "Cancel",
            icon: '<i class="fas fa-times"></i>',
            callback: () => ui.notifications.info("Stepping back."),
          },
        },
        default: actorHasDetect || actorHasReadAura ? "detect" : "identify",
        render: (html) => {
          /* ... your existing render logic for button visibility ... */
        },
      }).render(true);
      console.log(
        `${MODULE_ID} | runIdentifyMagicProcess: Initial dialog prompted.`
      );
    } catch (err) {
      console.error(`${MODULE_ID} | Error in runIdentifyMagicProcess:`, err);
      ui.notifications.error(
        "Unexpected error during Identify Magic. Check console."
      );
    }
  };

  _handleIdentifyChoice = async (choice, initialItemList, bypass = false) => {
    let itemsForSkillCheck = [];
    let scanResultsData = new Map();
    const magicSchools = ["arcane", "primal", "occult", "divine"];
    const sounds = this.getSounds();

    if (choice === "identify") {
      itemsForSkillCheck = initialItemList;
      if (itemsForSkillCheck.length === 0) {
        ui.notifications.info(`No unidentified items found.`);
        return;
      } else {
        await this._showIdentifyItemsDialog(
          itemsForSkillCheck[0].actor,
          itemsForSkillCheck,
          scanResultsData,
          choice
        );
      }
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
    const identifiedNonMagicalNames = [];

    for (const { actor, item } of initialItemList) {
      try {
        if (sounds.detectMagic)
          AudioHelper.play(
            {
              src: sounds.detectMagic,
              volume: 0.3,
              autoplay: true,
              duration: 0.2,
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
      $(scanningIndicator.element)
        .find("p")
        .text(
          `Scanning ${item.name}... ${isMagical ? "MAGICAL!" : "Non-magical."}`
        );
      await new Promise((resolve) => setTimeout(resolve, 500)); // Shortened scan delay
      if (!isMagical) {
        try {
          await item.update({ "system.identification.status": "identified" });
          identifiedNonMagicalNames.push(item.name);
        } catch (updateError) {
          ui.notifications.error(`Failed to ID non-magical: ${item.name}`);
        }
      } else itemsForSkillCheck.push({ actor, item });
    }
    if (scanningIndicator)
      try {
        await scanningIndicator.close({ force: true });
      } catch (e) {}
    if (identifiedNonMagicalNames.length > 0) {
      const message = `${scanAction} identified ${
        identifiedNonMagicalNames.length
      } non-magical: ${identifiedNonMagicalNames.join(", ")}.`;
      ui.notifications.info(message);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ alias: "System" }),
        content: `<i class="fas fa-check-circle" style="color:green;"></i> ${message}`,
        whisper: ChatMessage.getWhisperRecipients("GM"),
      });
    }
    if (itemsForSkillCheck.length === 0) {
      ui.notifications.info(
        "Scan complete. No magical items need deeper inspection."
      );
      return;
    } else
      await this._showIdentifyItemsDialog(
        itemsForSkillCheck[0].actor,
        itemsForSkillCheck,
        scanResultsData,
        choice
      );
  };
}
