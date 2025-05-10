class SimplifiedCraftingModule {
  constructor() {
    this.moduleId = "simplified-crafting-pf2e";
    this.targetItemCache = new Map();
    this.sounds = {
      craftingLoop: `modules/${this.moduleId}/sounds/BlackSmithCraftingA.ogg`,
      detectMagic: `modules/${this.moduleId}/sounds/DetectMagic.ogg`,
      reverseEngineerStart: `modules/${this.moduleId}/sounds/ReverseEngineer.ogg`,
      success: `modules/${this.moduleId}/sounds/Success.ogg`,
      failure: `modules/${this.moduleId}/sounds/Fail.ogg`,
    };

    this.styles = {
      successColor: "darkgreen",
      failureColor: "darkred",
      infoColor: "#005eff",
      neutralColor: "#555",
    };
    this.config = {
      MAGICAL_CRAFTING_FEAT_SLUG: "magical-crafting",
      ALCHEMICAL_CRAFTING_FEAT_SLUG: "alchemical-crafting",
      REVERSE_ENGINEER_FORMULA_ICON: "icons/svg/book.svg",
      WRONGLY_IDENTIFIED_PREFIX: "WRONGLY IDENTIFIED",
      WRONGLY_IDENTIFIED_DESC:
        "<hr><p><strong>Critically Failed Identification:</strong> You have completely misinterpreted this item's nature due to a critical failure on an Identify  Items check. Its true properties remain unknown, and using it based on your incorrect assessment could be dangerous.</p>",

      DECEPTIVE_CRIT_FAIL_MARKER: "<!-- SCF:DECEPTIVE_CRIT_FAIL -->",
      CRIT_FAIL_ORIGINAL_DATA_FLAG: "criticalFailureOriginalData",
    };

    this.SUPPORTED_IDENTIFY_FEATS = {
      "scholastic-identification": {
        name: "Scholastic Identification",
        slug: "scholastic-identification",
        description: "Allows using Society for Identify  Items checks.",
        type: "skill_substitution",
        substituteSkill: "soc",
        requiresMaster: true,
      },
      "assured-identification": {
        name: "Assured Identification",
        slug: "assured-identification",
        description:
          "Treats a critical failure on Identify  Items as a regular failure.",
        type: "outcome_modifier",
        effect: "crit_fail_becomes_fail",
      },
      "quick-identification": {
        name: "Quick Identification",
        slug: "quick-identification",
        description:
          "Reduces Identify  Items time (1 min base, faster with skill mastery).",
        type: "time_modifier",
      },
      "crafters-appraisal": {
        name: "Crafter's Appraisal",
        slug: "crafters-appraisal",
        description:
          "Allows using Crafting instead of a magic tradition skill to Identify Magic on magic items.",
        type: "skill_substitution",
        substituteSkill: "cra",
        appliesTo: "magic_items",
      },
      "oddity-identification": {
        name: "Oddity Identification (+2 Circ.)",
        slug: "oddity-identification",
        description:
          "Gain a +2 circumstance bonus to Identify  Items *if* the item involves mental, fortune/misfortune, detection, prediction, revelation, or scrying effects.",
        type: "roll_modifier",
        modifier: {
          label: "Oddity Identification (Conditional)",
          slug: "oddity-identification-bonus",
          type: "circumstance",
          modifier: 2,
        },
        requiresTrainedOccultism: true,
      },
    };

    this.CRAFTING_FEAT_SLUGS = new Set([
      "magical-crafting",
      "alchemical-crafting",
      "inventor",
      "quick-setup",
      "improvise-tool",
      "snare-crafting",
      "specialty-crafting",
      "impeccable-crafter",
      "quick-repair",
      "rapid-affixture",
      "gadget-specialist",
      "efficient-construction",
      "ubiquitous-gadgets",
      "construct-crafting",
      "master-crafter",
      "craft-anything",
      "legendary-crafter",
    ]);

    this.IDENTIFY_ICONS = {
      school: {},
      skill: {
        arc: "fa-atom",
        nat: "fa-leaf",
        occ: "fa-eye",
        rel: "fa-crosshairs",
        soc: "fa-landmark",
        cra: "fa-hammer",
      },
      skillTooltips: {
        arc: "Arcana",
        nat: "Nature",
        occ: "Occultism",
        rel: "Religion",
        soc: "Society",
        cra: "Crafting",
      },
      skillDataMap: {
        arc: "arcana",
        nat: "nature",
        occ: "occultism",
        rel: "religion",
        soc: "society",
        cra: "crafting",
      },
    };

    this.IDENTIFY_SPELL_INFO = {
      compendium: "pf2e.spells-srd",
      detect: {
        id: "gpzpAAAJ1Lza2JVl",
        slug: "detect-magic",
        name: "Detect Magic",
        icon: "fa-search-location",
      },
      read: {
        id: "OhD2Z6rIGGD5ocZA",
        slug: "read-aura",
        name: "Read Aura",
        icon: "fa-book-reader",
      },
    };
    this.COMPENDIUMS_TO_SEARCH = [
      "pf2e.equipment-srd",
      "pf2e.consumables-srd",
      "pf2e.weapons-srd",
      "pf2e.armor-srd",
      "pf2e.treasure-vault-srd",
      "pf2e.spells-srd",
      "pf2e.feats-srd",
      "pf2e.actions-srd",
      "pf2e.conditionitems-srd",
    ];
  }

  async findTargetItemForFormula(formulaData) {
    if (!formulaData?.uuid) return null;
    if (this.targetItemCache.has(formulaData.uuid)) {
      return this.targetItemCache.get(formulaData.uuid);
    }
    try {
      const targetItem = await fromUuid(formulaData.uuid);
      if (targetItem) {
        this.targetItemCache.set(formulaData.uuid, targetItem);
        return targetItem;
      }
    } catch (err) {}
    const potentialTargetName = formulaData.name?.startsWith("Formula: ")
      ? formulaData.name.substring(9).trim()
      : formulaData.name;
    if (!potentialTargetName) return null;
    for (const packName of this.COMPENDIUMS_TO_SEARCH) {
      const pack = game.packs.get(packName);
      if (!pack) continue;
      try {
        const index = await pack.getIndex({ fields: ["name", "type"] });
        const entryInIndex = index.find(
          (entry) =>
            entry.name.toLowerCase() === potentialTargetName.toLowerCase()
        );
        if (entryInIndex) {
          const tempUuid = `Compendium.${pack.collection}.${entryInIndex._id}`;
          const tempObject = await fromUuid(tempUuid);
          if (tempObject) {
            this.targetItemCache.set(formulaData.uuid, tempObject);
            return tempObject;
          }
        }
      } catch (err) {}
    }
    return null;
  }
  calculateCraftingTime(level, proficiencyRank) {
    let baseTimeValue;
    let baseTimeUnit;
    if (level <= 0) {
      baseTimeValue = 10;
      baseTimeUnit = "minute";
    } else if (level <= 3) {
      baseTimeValue = 1;
      baseTimeUnit = "hour";
    } else if (level <= 6) {
      baseTimeValue = 1;
      baseTimeUnit = "day";
    } else if (level <= 9) {
      baseTimeValue = 1;
      baseTimeUnit = "week";
    } else if (level <= 12) {
      baseTimeValue = 2;
      baseTimeUnit = "week";
    } else if (level <= 15) {
      baseTimeValue = 1;
      baseTimeUnit = "month";
    } else if (level <= 18) {
      baseTimeValue = 3;
      baseTimeUnit = "month";
    } else {
      baseTimeValue = 6;
      baseTimeUnit = "month";
    }
    let multiplier;
    switch (proficiencyRank) {
      case 0:
        multiplier = 10;
        break;
      case 1:
        multiplier = 1;
        break;
      case 2:
        multiplier = 0.75;
        break;
      case 3:
        multiplier = 0.5;
        break;
      case 4:
        multiplier = 0.25;
        break;
      default:
        multiplier = 1;
        break;
    }
    let finalTimeValue = baseTimeValue * multiplier;
    if (baseTimeUnit === "month" && finalTimeValue < 1) {
      finalTimeValue *= 4;
      baseTimeUnit = "week";
    }
    if (baseTimeUnit === "week" && finalTimeValue < 1) {
      finalTimeValue *= 7;
      baseTimeUnit = "day";
    }
    if (baseTimeUnit === "day" && finalTimeValue < 1) {
      finalTimeValue *= 8;
      baseTimeUnit = "hour";
    }
    if (baseTimeUnit === "hour" && finalTimeValue < 1) {
      finalTimeValue *= 60;
      baseTimeUnit = "minute";
    }
    if (baseTimeUnit === "minute") {
      finalTimeValue = Math.max(1, Math.round(finalTimeValue));
    } else if (baseTimeUnit === "hour" || baseTimeUnit === "day") {
      finalTimeValue = Math.max(1, Math.round(finalTimeValue * 10) / 10);
      if (finalTimeValue === Math.floor(finalTimeValue))
        finalTimeValue = Math.floor(finalTimeValue);
    } else {
      finalTimeValue = Math.max(1, Math.round(finalTimeValue));
    }
    const unitString = finalTimeValue === 1 ? baseTimeUnit : `${baseTimeUnit}s`;
    const timeString = `${finalTimeValue} ${unitString}`;
    return timeString;
  }
  _calculateReverseEngineeringDC(item) {
    let dc = item.system.crafting?.requirements?.dc;
    let dcSource = "Item Specific";
    if (!dc || typeof dc !== "number") {
      try {
        const itemLevel = item.level ?? 0;
        const itemRarity = item.rarity ?? "common";
        if (typeof pf2e?.DC?.calculate === "function") {
          dc = pf2e.DC.calculate(itemLevel, { rarity: itemRarity });
          dcSource = `Standard (Item Lvl ${itemLevel}, ${itemRarity})`;
        } else {
          throw new Error("pf2e.DC.calculate function not found.");
        }
      } catch (e) {
        const dcByLvl = [
          14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35,
          36, 38, 39, 40, 42, 44, 46, 48, 50,
        ];
        const itemLevel = item.level ?? 0;
        dc = dcByLvl[itemLevel] ?? 10;
        dcSource = `Fallback Array (Item Lvl ${itemLevel})`;
      }
    } else {
    }
    if (typeof dc !== "number" || dc <= 0) {
      return null;
    }
    return dc;
  }

  _determineTargetActors(contextActor) {
    if (contextActor?.isOwner) return [contextActor];
    const c = canvas.tokens.controlled
      .map((t) => t.actor)
      .filter((a) => a?.isOwner);
    if (c.length > 0) return c;
    const u = game.user.character;
    if (u?.isOwner) return [u];
    return null;
  }
  _createIdentifyLink(id, name, iconClass) {
    const pack = this.IDENTIFY_SPELL_INFO.compendium;
    if (!id || !pack) return "";
    return ` <a class="content-link" data-pack="${pack}" data-id="${id}" title="Consult ${name} Spell"><i class="fas ${iconClass} fa-xs"></i></a>`;
  }
  _actorHasSpellAvailable(actor, spellSlug) {
    if (!actor || !spellSlug) return false;
    for (const e of actor.spellcasting) {
      if (e.spells?.some((s) => s.slug === spellSlug)) return true;
    }
    if (
      actor.itemTypes.spell.some(
        (s) => s.slug === spellSlug && s.system.spellcasting?.isInnate
      )
    )
      return true;
    return false;
  }
  async _showIdentifyItemsDialog(
    actor,
    itemsToIdentify,
    scanResultsData,
    scanType
  ) {
    if (!itemsToIdentify || itemsToIdentify.length === 0) {
      return;
    }
    itemsToIdentify.sort((a, b) => a.item.name.localeCompare(b.item.name));

    let cantripLinkHTML = "";
    let spellInfo = null;
    let scanIdentifiedMessage = "";

    if (scanType === "detect") {
      spellInfo = this.IDENTIFY_SPELL_INFO.detect;
      scanIdentifiedMessage = `<p style="margin: 0; font-size:0.9em; color:${this.styles.neutralColor};">Non-magical items were identified by the initial Detect Magic scan.</p>`;
    } else if (scanType === "read") {
      spellInfo = this.IDENTIFY_SPELL_INFO.read;
      scanIdentifiedMessage = `<p style="margin: 0; font-size:0.9em; color:${this.styles.neutralColor};">Non-magical items were identified by the initial Read Aura scan.</p>`;
    }

    if (spellInfo) {
      cantripLinkHTML = `<div style="margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #ccc;"><p style="margin: 0;">Initial Scrutiny via: ${this._createIdentifyLink(
        spellInfo.id,
        spellInfo.name,
        spellInfo.icon
      )}</p>${scanIdentifiedMessage}</div>`;
    } else if (scanType === "identify") {
      cantripLinkHTML = `<div style="margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #ccc;"><p style="margin: 0; font-style: italic; color:${this.styles.neutralColor};">Attempting direct identification (no preliminary spell scan).</p></div>`;
    }

    let itemListHTML = itemsToIdentify
      .map(({ actor: itemActor, item }) => {
        const result = scanResultsData.get(item.id);
        let scanDisplay = "";
        let skillHintDisplay = "";

        const itemSkills = new Set(["arc", "nat", "occ", "rel"]);
        const actorFeatItems = itemActor.itemTypes.feat;
        if (
          actorFeatItems.some(
            (f) =>
              f.slug ===
              this.SUPPORTED_IDENTIFY_FEATS["scholastic-identification"]?.slug
          )
        ) {
          itemSkills.add("soc");
        }
        const craftersAppraisalConfig =
          this.SUPPORTED_IDENTIFY_FEATS["crafters-appraisal"];
        const hasCraftersAppraisal =
          craftersAppraisalConfig &&
          actorFeatItems.some((f) => f.slug === craftersAppraisalConfig.slug);
        const isMagicItem = item.traits.has("magical");
        const isTrainedInCrafting = (itemActor.skills.crafting?.rank ?? 0) > 0;

        if (
          hasCraftersAppraisal &&
          isTrainedInCrafting &&
          craftersAppraisalConfig.substituteSkill
        ) {
          itemSkills.add(craftersAppraisalConfig.substituteSkill);
        }

        const traitSkills = new Set();
        if (item.traits.has("arcane")) traitSkills.add("arc");
        if (item.traits.has("primal")) traitSkills.add("nat");
        if (item.traits.has("occult")) traitSkills.add("occ");
        if (item.traits.has("divine")) traitSkills.add("rel");

        const finalSkillHints =
          traitSkills.size > 0
            ? Array.from(traitSkills)
            : Array.from(itemSkills);

        skillHintDisplay = `<span style="font-size: 0.9em; color: #555; margin-left: 8px;">(Suggests: `;
        skillHintDisplay += finalSkillHints
          .map((s) => {
            const iconClass =
              this.IDENTIFY_ICONS.skill[s] || "fa-question-circle";
            const tooltip =
              this.IDENTIFY_ICONS.skillTooltips[s] || "Unknown Skill";
            return `<i class="fas ${iconClass}" title="${tooltip}"></i>`;
          })
          .join(" ");
        skillHintDisplay += `)</span>`;

        if (result) {
          let schoolDisplay = "";
          if (scanType === "read" && result.schools.length > 0) {
            schoolDisplay = `<span style="font-size: 0.9em; color: #3a2151; margin-left: 5px;">(School(s): `;
            schoolDisplay += result.schools
              .map(
                (s) =>
                  `<i class="fas ${
                    this.IDENTIFY_ICONS.school[s] || "fa-question-circle"
                  }" title="${s.charAt(0).toUpperCase() + s.slice(1)}"></i>`
              )
              .join(" ");
            schoolDisplay += `)</span>`;
          } else if (scanType === "read") {
            schoolDisplay = `<span style="font-size: 0.9em; color: #777; margin-left: 5px;">(No School Detected)</span>`;
          }
          scanDisplay = `<span style="color: ${this.styles.infoColor}; font-weight: bold; margin-right: 5px;">Magical Aura</span>${schoolDisplay}`;
        } else if (scanType === "identify") {
          scanDisplay = `<span style="color: ${this.styles.neutralColor}; font-style: italic; margin-right: 10px;">(Direct Attempt)</span>`;
        }

        let failureNotice = "";
        let disabledAttribute = "";
        const itemActorLevel = itemActor.level;
        const failMarkerPattern = new RegExp(
          `<!-- failureMarker:Fail_${itemActor.id}_L(\\d+) -->`
        );
        const unidDesc =
          item.system.identification?.unidentified?.data?.description?.value ??
          "";
        const match = unidDesc.match(failMarkerPattern);

        if (match) {
          const failedAtLevel = parseInt(match[1], 10);
          if (itemActorLevel <= failedAtLevel) {
            failureNotice = `<span style="color: ${
              this.styles.failureColor
            }; font-weight: bold; margin-left: 10px;" title="Failed identification at Level ${failedAtLevel} by ${
              itemActor.name
            }. Requires Level ${
              failedAtLevel + 1
            }."><i class="fas fa-exclamation-triangle"></i> Failed (L${failedAtLevel})</span>`;
            disabledAttribute = "disabled";
          }
        }

        const buttonText = "Attempt Identify";

        return `<div style="display: flex; align-items: center; margin-bottom: 8px; padding: 5px; border: 1px solid #888; border-radius: 3px; background: rgba(0,0,0,0.03);">
                    <img src="${item.img}" title="${item.name} (Held by ${
          itemActor.name
        })" width="36" height="36" style="margin-right: 10px; flex-shrink: 0; border: none;">
                    <div style="flex-grow: 1; margin-right: 10px;">
                        <label style="font-weight: bold; color: #191813; display: block;">${
                          item.name
                        }</label>
                        <span style="font-size: 0.9em; color: #444;">Possessed by <em>${
                          itemActor.name
                        }</em></span> ${skillHintDisplay} ${failureNotice}
                    </div>
                    <div style="flex-shrink: 0; text-align: right; margin-right: 10px;">
                        ${scanDisplay}
                    </div>
                    <button type="button" data-actor-id="${
                      itemActor.id
                    }" data-item-id="${
          item.id
        }" style="flex-shrink: 0; width: 130px; cursor: ${
          disabledAttribute ? "not-allowed" : "pointer"
        };" ${disabledAttribute}>
                        <i class="fas fa-search-plus"></i> ${buttonText}</button>
                </div>`;
      })
      .join("");

    const quickIdFeat = Object.values(this.SUPPORTED_IDENTIFY_FEATS).find(
      (f) => f.slug === "quick-identification"
    );
    const anyActorHasQuickId = itemsToIdentify.some(({ actor: itemActor }) =>
      itemActor.itemTypes.feat.some((f) => f.slug === quickIdFeat?.slug)
    );
    const timeText = anyActorHasQuickId ? "10 min (maybe faster)" : "10 min";

    let dialogTitle = "Identify Item Skill Check";
    if (scanType === "detect" || scanType === "read") {
      dialogTitle = "Identify Magical Items";
    } else {
      dialogTitle = "Identify All Items";
    }

    let content = `<div style="text-align: center; margin-bottom: 10px;"><i class="fas fa-book-dead fa-2x" style="color: #5a3a6b;"></i></div>
                   <h3 style="color: #191813; text-align: center;">${dialogTitle}</h3>
                   ${cantripLinkHTML}
                   <p>Select an item to focus your knowledge. Identification takes ${timeText} per item (Quick Identification feat may reduce this).</p>
                   <p style="font-size:0.85em; color: #600;"><em><i class="fas fa-exclamation-triangle" style="color:darkred;"></i><strong> Failed (LX):</strong> Cannot retry identifying this item until Level X+1 by the same actor.</em></p>
                   <hr>
                   <form style="max-height: 350px; overflow-y: auto; margin-bottom: 10px;">${itemListHTML}</form>`;

    const identifyDialog = new Dialog(
      {
        title: dialogTitle,
        content: content,
        buttons: {
          cancel: {
            label: "Cancel",
            icon: '<i class="fas fa-times"></i>',
            callback: () => {
              ui.notifications.info("Identification attempt cancelled.");
            },
          },
        },
        render: (html) => {
          html.on("click", ".content-link", (event) => {
            const el = event.currentTarget;
            const pack = game.packs.get(el.dataset.pack);
            if (pack && el.dataset.id)
              pack
                .getDocument(el.dataset.id)
                .then((d) => d?.sheet.render(true));
          });

          html
            .find("button[data-item-id]:not([disabled])")
            .on("click", async (event) => {
              const button = event.currentTarget;
              const originalContent = button.innerHTML;
              button.disabled = true;
              button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Identifying...`;

              const actorId = button.dataset.actorId;
              const itemId = button.dataset.itemId;

              const itemActor = game.actors.get(actorId);
              const item = itemActor ? itemActor.items.get(itemId) : null;

              if (!itemActor || !item) {
                ui.notifications.error("Item or Actor not found!");
                button.disabled = false;
                button.innerHTML = originalContent;
                return;
              }

              try {
                await identifyDialog.close({ force: true });
              } catch (closeError) {
                try {
                  $(event.delegateTarget)
                    .closest(".app.dialog")
                    .find(".dialog-button.cancel")
                    .trigger("click");
                } catch (fallbackError) {}
              }

              await this._attemptIdentification(itemActor, item);
            });
        },
        close: () => {},
      },
      { width: 650 }
    );
    identifyDialog.render(true);
  }

  async _promptIdentifySkill(actor, item, dc, possibleSkills, actorFeats) {
    let skillButtons = {};
    let featCheckboxesHTML = "";
    let defaultSkill = null;
    let maxMod = -Infinity;

    const toggleableFeats = actorFeats.filter(
      (feat) => feat.type === "roll_modifier"
    );
    let featToggleIntro = false;

    toggleableFeats.forEach((feat) => {
      let canShowToggle = true;
      if (
        feat.slug === "oddity-identification" &&
        feat.requiresTrainedOccultism
      ) {
        canShowToggle = (actor.skills.occultism?.rank ?? 0) > 0;
      }

      if (canShowToggle) {
        if (!featToggleIntro) {
          featCheckboxesHTML += `<hr><p style="font-weight: bold; margin-bottom: 3px;"><i class="fas fa-star-of-life"></i> Apply Techniques?</p><p style="font-size: 0.9em; font-style: italic; margin-top: -2px; margin-bottom: 5px;">Select if conditions met:</p>`;
          featToggleIntro = true;
        }
        featCheckboxesHTML += `<div style="margin-top: 5px; margin-left: 10px; font-size: 0.9em;">
                                                <input type="checkbox" id="feat-toggle-${
                                                  feat.slug
                                                }" name="feat-${
          feat.slug
        }" value="${feat.slug}">
                                                <label for="feat-toggle-${
                                                  feat.slug
                                                }" title="${
          feat.description || ""
        }">${feat.name}${
          feat.slug === "oddity-identification"
            ? '<i style="font-weight:normal; color:#555;"> (If mental/divination/etc.)</i>'
            : ""
        }</label>
                                               </div>`;
      }
    });

    if (featCheckboxesHTML) featCheckboxesHTML += `<hr>`;

    return new Promise((resolve) => {
      possibleSkills.forEach((slug) => {
        const fullSkillName = this.IDENTIFY_ICONS.skillDataMap[slug];
        if (!fullSkillName) return;

        const statistic = actor.getStatistic(fullSkillName);
        if (!statistic) return;

        const mod = statistic.check.mod;
        const icon = this.IDENTIFY_ICONS.skill[slug] || "fa-question-circle";

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
          `No suitable knowledge skills trained or proficient for <em>${actor.name}</em> to identify <em>${item.name}</em>.`
        );
        resolve(null);
        return;
      }

      let dialogContent = `<div style="text-align: center;"><i class="fas fa-brain fa-2x" style="color: #888;"></i></div>
                                         <p><em>${actor.name}</em>, choose the knowledge skill to identify <strong>${item.name}</strong>.</p>
                                         <p style="text-align: center; font-size: 1.1em;">Item DC ${dc}</p>
                                         ${featCheckboxesHTML}
                                         <p>Select skill:</p>`;

      new Dialog({
        title: `Channel Knowledge: ${item.name}`,
        content: dialogContent,
        buttons: skillButtons,
        default: defaultSkill || Object.keys(skillButtons)[0],
        close: () => {
          ui.notifications.warn(
            `Identification attempt cancelled for "${item.name}".`
          );
          resolve(null);
        },
      }).render(true);
    });
  }

  async _attemptIdentification(actor, item) {
    let roll = null;

    try {
      let dc = null;
      const explicitDC = item.system.identification?.dc;
      if (explicitDC && !isNaN(explicitDC) && explicitDC > 0) {
        dc = parseInt(explicitDC, 10);
      } else {
        const itemLvl = item.level ?? 0;
        try {
          dc = pf2e.DC.calculate(itemLvl, { rarity: item.rarity ?? "common" });
          if (!dc || typeof dc !== "number" || dc <= 0) {
            throw new Error(
              `Invalid DC calculated: ${dc} for item level ${itemLvl}`
            );
          }
        } catch (e) {
          const dcByLvl = [
            14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35,
            36, 38, 39, 40, 42, 44, 46, 48, 50,
          ];
          dc = dcByLvl[itemLvl] ?? 10;
        }
      }

      if (!dc || dc <= 0) {
        try {
          const manualDCInput = await Dialog.prompt({
            title: `Manual DC Required: ${item.name}`,
            content: `<p>Could not automatically determine a valid DC for <strong>${
              item.name
            }</strong> (Level ${item.level ?? "N/A"}, Rarity ${
              item.rarity ?? "common"
            }). Please enter the DC manually:</p><input type="number" name="manualDC" value="15" style="width: 100%;"/>`,
            label: "Set Identification DC",
            rejectClose: false,
            callback: (html) => {
              const val = html.find('[name="manualDC"]').val();
              return val ? parseInt(val, 10) : null;
            },
          });

          if (manualDCInput && manualDCInput > 0) {
            dc = manualDCInput;
          } else {
            ui.notifications.warn(
              `Manual DC input cancelled or invalid. Identification aborted for ${item.name}.`
            );
            return;
          }
        } catch {
          ui.notifications.warn(
            `Manual DC prompt cancelled. Identification aborted for ${item.name}.`
          );
          return;
        }
      }

      const possibleSkillsBase = ["arc", "nat", "occ", "rel"];
      const actorFeats = actor.itemTypes.feat;
      const isMagicItem = item.traits.has("magical");
      let possibleSkills = [...possibleSkillsBase];

      const scholasticFeatConfig =
        this.SUPPORTED_IDENTIFY_FEATS["scholastic-identification"];
      const hasScholasticFeat =
        scholasticFeatConfig &&
        actorFeats.some((f) => f.slug === scholasticFeatConfig.slug);
      if (hasScholasticFeat) {
        possibleSkills.push("soc");
      }

      const craftersAppraisalConfig =
        this.SUPPORTED_IDENTIFY_FEATS["crafters-appraisal"];
      const hasCraftersAppraisal =
        craftersAppraisalConfig &&
        actorFeats.some((f) => f.slug === craftersAppraisalConfig.slug);
      const craftingSkill = actor.skills.crafting;
      const isTrainedInCrafting = (craftingSkill?.rank ?? 0) > 0;

      if (
        hasCraftersAppraisal &&
        isTrainedInCrafting &&
        craftersAppraisalConfig.substituteSkill
      ) {
        possibleSkills.push(craftersAppraisalConfig.substituteSkill);
      }

      possibleSkills = [...new Set(possibleSkills)];

      const finalSkills = possibleSkills.filter((slug) => {
        const skillDataName = this.IDENTIFY_ICONS.skillDataMap[slug];
        if (!skillDataName) return false;

        const skill = actor.skills[skillDataName];
        const rank = skill?.rank ?? 0;

        if (
          slug === "soc" &&
          hasScholasticFeat &&
          scholasticFeatConfig?.requiresMaster &&
          rank < 3
        ) {
          return false;
        }

        return rank > 0;
      });

      if (finalSkills.length === 0) {
        ui.notifications.error(
          `${actor.name} lacks the necessary trained skill(s) (potentially including Crafting Rank 1+ for magic items if feat owned) to identify ${item.name}.`
        );
        return;
      }

      const featsForPrompt = actorFeats
        .map((f) => this.SUPPORTED_IDENTIFY_FEATS[f.slug])
        .filter(
          (featConfig) => featConfig && featConfig.type !== "skill_substitution"
        );

      const promptResult = await this._promptIdentifySkill(
        actor,
        item,
        dc,
        finalSkills,
        featsForPrompt
      );

      if (!promptResult) {
        ui.notifications.info("Identification cancelled by user.");
        return;
      }

      const { skillSlug: chosenSkillSlug, selectedFeatSlugs } = promptResult;
      const chosenSkillDataName =
        this.IDENTIFY_ICONS.skillDataMap[chosenSkillSlug];
      if (!chosenSkillDataName) {
        ui.notifications.error(
          `Internal Error: Could not map chosen skill slug '${chosenSkillSlug}' to a skill data name.`
        );
        return;
      }
      const stat = actor.skills[chosenSkillDataName];
      if (!stat) {
        ui.notifications.error(
          `Internal Error: Statistic '${chosenSkillDataName}' not found on actor ${actor.name}.`
        );
        return;
      }

      const mods = (selectedFeatSlugs ?? [])
        .map((slug) => this.SUPPORTED_IDENTIFY_FEATS[slug]?.modifier)
        .filter((m) => m)
        .map((m) => new game.pf2e.Modifier(m));

      const opts = new Set(
        actor.getRollOptions(["all", "skill-check", stat.slug])
      );
      opts.add(`action:identify-magic`);
      if (isMagicItem) opts.add("item:magical");
      (selectedFeatSlugs ?? []).forEach((slug) => opts.add(`feat:${slug}`));
      item.traits.forEach((t) => opts.add(`item:trait:${t}`));

      const assuredIdConfig =
        this.SUPPORTED_IDENTIFY_FEATS["assured-identification"];
      const hasAssuredId =
        assuredIdConfig &&
        actorFeats.some((f) => f.slug === assuredIdConfig.slug);

      const quickIdConfig =
        this.SUPPORTED_IDENTIFY_FEATS["quick-identification"];
      const hasQuickId =
        quickIdConfig && actorFeats.some((f) => f.slug === quickIdConfig.slug);

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
        `Attempting to identify ${unidentifiedName}... (${timeMsg})`
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
        ui.notifications.warn(`Identification roll cancelled.`);
        return;
      }

      if (!roll) {
        ui.notifications.warn(`Identification roll cancelled.`);
        return;
      }

      let dos = roll.degreeOfSuccess;
      const origCritFail = dos === 0;
      let assuredApplied = false;
      if (origCritFail && hasAssuredId) {
        dos = 1; // Assured ID changes crit fail to regular fail
        assuredApplied = true;
      }

      let playerOutcomeText = "";
      let chatFlavor = ""; // We'll build this at the end
      let itemToLinkInChat = item; // Start with the original item for linking unless replaced
      let updateData = {}; // Used ONLY for non-crit-fail outcomes now
      let itemDeletedAndReplaced = false; // Flag to track replacement

      // --- CRITICAL FAILURE (Deceptive Replacement) ---
      // This 'if' block replaces the previous 'else if (isDeceptiveCritFail)'
// ... inside _attemptIdentification method

// --- CRITICAL FAILURE (Deceptive Replacement) ---
if (dos === 0 && !assuredApplied) { // Actual Critical Failure
    itemDeletedAndReplaced = true;

    const originalIdentifiedName = item._source?.name ?? item.name;
    const originalUUID = item.uuid;
    const originalSourceId = item.sourceId;
    const misidentificationTimestamp = new Date().toLocaleString();
    const identifyingActorId = actor.id;
    const identifyingActorName = actor.name;
    const originalItemId = item.id;
    
    const originalItemType = item.type;
    const originalItemLevel = item.level ?? 0;
    const originalWeaponGroup = item.isOfType("weapon") ? item.system.group : null;
    const originalArmorGroup = item.isOfType("armor") ? item.system.group : null;
    const originalArmorCategory = item.isOfType("armor") ? item.system.category : null;
    const significantConsumableTraits = ["potion", "scroll", "elixir", "bomb", "oil", "talisman", "ammo", "snare", "drug", "tool"];
    let originalMainConsumableTrait = null;
    if (item.isOfType("consumable")) {
        originalMainConsumableTrait = item.system.traits.value.find(t => significantConsumableTraits.includes(t));
    }
    const originalEquipmentTraits = item.isOfType("equipment") ? item.system.traits.value : [];

    ui.notifications.info(
      `Crit Fail Identifying ${originalIdentifiedName}. Misidentifying with a similar item...`,
      { permanent: false }
    );

    let replacementItemDataSource = null;
    let selectedReplacementRef = null;
    const replacementCompendiums = [
      "pf2e.equipment-srd",
      "pf2e.weapons-srd",
      "pf2e.armor-srd",
      "pf2e.consumables-srd",
      "pf2e.treasure-vault-srd",
    ];
    const physicalItemTypes = [
        "weapon", "armor", "equipment", "consumable", "treasure", "backpack", "container", "loot"
    ];
    const indexFieldsToFetch = ["name", "type", "uuid", "system.level.value", "system.group", "system.category", "system.traits.value"];

    // --- INITIALIZE finalMisidentifiedName HERE ---
    let finalMisidentifiedName = ""; // Initialize to ensure it's always defined

    try {
      let allPotentialItems = [];
      for (const packName of replacementCompendiums) {
        const pack = game.packs.get(packName);
        if (!pack) continue;
        const index = await pack.getIndex({ fields: indexFieldsToFetch });
        
        allPotentialItems.push(
          ...index.filter(
            (i) =>
              physicalItemTypes.includes(i.type) &&
              !i.name.startsWith("Formula:") &&
              i.uuid !== item.sourceId && 
              (i.system?.level?.value ?? 0) <= actor.level + 3 && 
              (i.system?.level?.value ?? 0) >= Math.max(0, actor.level - 2) 
          )
        );
      }

      if (allPotentialItems.length === 0) {
        throw new Error("No physical items found in the general level range across compendiums to serve as a replacement.");
      }

      let specificMatches = [];
      let typeMatches = [];
      let chosenPool = [];

      if (originalItemType === "weapon" && originalWeaponGroup) {
        specificMatches = allPotentialItems.filter(p => p.type === "weapon" && p.system?.group === originalWeaponGroup);
      } else if (originalItemType === "armor" && originalArmorGroup) {
        specificMatches = allPotentialItems.filter(p => p.type === "armor" && p.system?.group === originalArmorGroup);
        if (specificMatches.length > 1 && originalArmorCategory) { 
            const categoryMatches = specificMatches.filter(p => p.system?.category === originalArmorCategory);
            if (categoryMatches.length > 0) specificMatches = categoryMatches;
        }
      } else if (originalItemType === "consumable" && originalMainConsumableTrait) {
        specificMatches = allPotentialItems.filter(p =>
            p.type === "consumable" &&
            p.system?.traits?.value?.includes(originalMainConsumableTrait)
        );
      } else if (originalItemType === "equipment") {
        if (originalEquipmentTraits.includes("wand")) {
            specificMatches = allPotentialItems.filter(p => p.type === "equipment" && p.system?.traits?.value?.includes("wand"));
        } else if (originalEquipmentTraits.includes("staff")) {
            specificMatches = allPotentialItems.filter(p => p.type === "equipment" && p.system?.traits?.value?.includes("staff"));
        }
      }

      if (specificMatches.length > 0) {
        chosenPool = specificMatches;
      } else {
        typeMatches = allPotentialItems.filter(p => p.type === originalItemType);
        if (typeMatches.length > 0) {
          chosenPool = typeMatches;
        } else {
          chosenPool = allPotentialItems;
        }
      }
      
      if (chosenPool.length === 0) { 
        throw new Error(
          `No suitable replacement items found even after all fallbacks for item ${originalIdentifiedName}.`
        );
      }

      const randomIndex = Math.floor(Math.random() * chosenPool.length);
      selectedReplacementRef = chosenPool[randomIndex];

      const fetchedReplacement = await fromUuid(selectedReplacementRef.uuid);
      if (!fetchedReplacement || !fetchedReplacement.isOfType("physical")) {
        throw new Error(
          `Failed to fetch or invalid type for chosen replacement item ${selectedReplacementRef.name} (${selectedReplacementRef.uuid})`
        );
      }

      // --- LOGIC TO DETERMINE finalMisidentifiedName ---
      const baseNameForReplacement = fetchedReplacement.name; // Name from compendium
      const characterNameForReplacement = actor.name;
      const idSuffixForReplacement = `(Id by ${characterNameForReplacement})`;
      
      if (baseNameForReplacement && !baseNameForReplacement.endsWith(idSuffixForReplacement)) {
          finalMisidentifiedName = `${baseNameForReplacement} ${idSuffixForReplacement}`;
      } else if (baseNameForReplacement) { // If it already ends with suffix or has no suffix and is just base name
          finalMisidentifiedName = baseNameForReplacement;
      } else {
          // Fallback if fetchedReplacement.name is somehow empty
          finalMisidentifiedName = `Misidentified Item ${idSuffixForReplacement}`;
      }
      // --- End logic for finalMisidentifiedName ---

      replacementItemDataSource = fetchedReplacement.toObject(false); // Get the source object
      delete replacementItemDataSource._id; // Remove existing ID for new creation

      // Apply our modifications
      replacementItemDataSource.name = finalMisidentifiedName; // This is _source.name
      replacementItemDataSource.img = fetchedReplacement.img;   // This is _source.img (should be there from .toObject(false))

      replacementItemDataSource.system.quantity = 1; 
      replacementItemDataSource.system.identification = {
        status: "identified", // It appears identified to the player
        identified: {         // This object MUST exist
          name: finalMisidentifiedName,       // Name player sees
          img: fetchedReplacement.img,        // Image player sees
          data: {                             // Good to have a structure
              description: { value: fetchedReplacement.system.description?.value || "" } // Use replacement's description
          }
        },
        unidentified: {     // This object should also exist, even with generic data
          name: `Unidentified ${fetchedReplacement.type}`, // Generic
          img: "icons/svg/mystery-man.svg",               // Generic
          data: {
            description: { value: "<p>The true nature of this item is obscured by your misjudgment.</p>" }
          }
        },
        misidentifiedData: null, 
      };
      // Ensure other critical system properties are part of replacementItemDataSource.system
      // fetchedReplacement.toObject(false) should have populated `system` already.
      // We are just overriding/setting specific fields like name, img, identification.

    } catch (selectionError) {
      ui.notifications.error(
        `Crit Fail Action Aborted: Error selecting/fetching replacement: ${selectionError.message}`
      );
      // Log the error if finalMisidentifiedName was involved in the error, though unlikely here
      console.error("Error during replacement selection:", selectionError, "Current finalMisidentifiedName:", finalMisidentifiedName);
      dos = 1; 
      itemDeletedAndReplaced = false; 
      ui.notifications.warn(
        `Crit Fail on ${originalIdentifiedName} reverted to regular Failure due to replacement error.`
      );
    }

    // The rest of the critical failure logic (delete original, create new, update GM notes)
    // will use `finalMisidentifiedName` which should now be defined.

    if (itemDeletedAndReplaced && replacementItemDataSource) {
      try {
        await actor.deleteEmbeddedDocuments("Item", [originalItemId]);
      } catch (deleteError) {
        ui.notifications.error(
          `CRITICAL ERROR: Failed to delete original item ${originalIdentifiedName}. Replacement aborted. Error: ${deleteError.message}`
        );
        itemDeletedAndReplaced = false;
        return;
      }
    
      let newItemDoc = null;
      try {
        const createdDocs = await actor.createEmbeddedDocuments("Item", [
          replacementItemDataSource, // This now has the correctly structured name and identification
        ]);
        if (!createdDocs || createdDocs.length === 0) {
          throw new Error("Replacement item creation returned no documents.");
        }
        newItemDoc = createdDocs[0];
        itemToLinkInChat = newItemDoc; // newItemDoc.name should reflect finalMisidentifiedName
        

        const gmNoteHeader = `--- Critical Failure on Identification (${misidentificationTimestamp}) ---`;
        
        // Simplified GM Note Content
        const gmNoteContent = 
          `<strong>Player:</strong> ${identifyingActorName}<br>` +
          `<strong>Player Believes They Identified:</strong> "${newItemDoc.name}" (This is the deceptive item they now possess).<br>` +
          `<strong>Actual Item Misidentified:</strong> "${originalIdentifiedName}" (Type: ${originalItemType}, Level: ${originalItemLevel}). This item was removed and replaced.<br>` +
          `<em>The player is unaware of the misidentification.</em>`;

        const currentGMNotes = newItemDoc.system.description?.gm ?? "";
        
        // Prepend the new, simplified note
        const newGMNotes = `${gmNoteHeader}\n${gmNoteContent}\n${currentGMNotes ? "<hr>" + currentGMNotes : ""}`;
        // Using \n for newlines in the GM note often renders better than <br> if it's just plain text.
        // If you want HTML formatting, stick with <br> and <hr>.

        let updateForNewItem = { 
            "system.description.gm": newGMNotes,
        };
        

        // The block you had for renaming the REPLACEMENT item to include "(Id by Character Name)"
        // is now handled *before* creation by setting replacementItemDataSource.name = finalMisidentifiedName
        // and replacementItemDataSource.system.identification.identified.name = finalMisidentifiedName.
        // So, the update here is simpler.

        await newItemDoc.update(updateForNewItem);
        console.log(
            `${this.moduleId} | CritFail ID: Replaced ${originalIdentifiedName} with ${newItemDoc.name} (which is finalMisidentifiedName).`
        );

      } catch (creationError) {
        ui.notifications.error(
          `CRITICAL ERROR: Failed to create/update replacement item ${replacementItemDataSource?.name}. Error: ${creationError.message}`
        );
        // Log the error if finalMisidentifiedName was involved, e.g. if replacementItemDataSource.name was undefined
        console.error("Error during replacement creation/update:", creationError, "Replacement data source name:", replacementItemDataSource?.name);
        itemDeletedAndReplaced = false; 
        return; 
      }
    }
    // Player outcome text is for success because they *think* they succeeded
    playerOutcomeText = `<span style="color: ${
      this.styles.successColor ?? "green"
    }; font-weight: bold;">Success!</span> You understand the item's nature.`;
// This closes: if (dos === 0 && !assuredApplied)
} 
// ... then the `else if (dos >= 2)` block
// ... then the `else` block for `dos === 1` (Failure)
    
    
    
    else if (dos >= 2) { // Success or Critical Success
    playerOutcomeText = `<span style="color: ${
      this.styles.successColor ?? "green"
    }; font-weight: bold;">${
      dos === 3 ? "Critical Success!" : "Success!"
    }</span> You understand the item's nature.`;
    updateData["system.identification.status"] = "identified";

    // ----- PROBLEM AREA LIKELY STARTS HERE -----
    let baseNameForItemSuffix = "";
    // This block determines baseNameForItemSuffix
    if (item.system.identification?.identified?.name && item.system.identification.identified.name.trim() !== "") {
        baseNameForItemSuffix = item.system.identification.identified.name.trim();
    } else if (item._source?.name && item._source.name.trim() !== "") { // Check _source.name too
        baseNameForItemSuffix = item._source.name.trim();
    } else { // Fallback to current item.name if the others are empty
        baseNameForItemSuffix = item.name.replace(/\s*\((?:Id by .*?|Crafted by .*?|Unidentified)\)$/i, "").trim();
    }
    
    const characterName = actor.name;
    const idSuffix = `(Id by ${characterName})`;
    
    // --- INITIALIZE finalIdentifiedName HERE ---
    let finalIdentifiedName = ""; // Initialize to an empty string or a default

    if (baseNameForItemSuffix && baseNameForItemSuffix.trim() !== "") { // Ensure baseName is not just whitespace
        if (!baseNameForItemSuffix.endsWith(idSuffix)) {
            finalIdentifiedName = `${baseNameForItemSuffix} ${idSuffix}`;
        } else {
            // It already has the correct suffix (or is the base name if suffix logic is skipped)
            finalIdentifiedName = baseNameForItemSuffix; 
        }
    } else {
        // baseNameForItemSuffix was empty or only whitespace.
        // This could happen if item.name was just "(Unidentified)" or similar.
        // We need a sensible default.
        // Let's try to get the 'true' name from the item if possible,
        // otherwise construct a very generic one.
        let trueBaseName = item.system.identification?.identified?.name || // True identified name if it exists
                           item._source?.name ||                            // Original source name
                           item.name;                                      // Current name as last resort

        // Clean up any existing suffixes from this fallback trueBaseName
        trueBaseName = trueBaseName.replace(/\s*\((?:Id by .*?|Crafted by .*?|Unidentified)\)$/i, "").trim();

        if (trueBaseName && trueBaseName.trim() !== "") {
            finalIdentifiedName = `${trueBaseName} ${idSuffix}`;
        } else {
            // Absolute fallback if even trueBaseName is empty
            finalIdentifiedName = `Identified Item ${idSuffix}`; 
        }
    }
    // At this point, finalIdentifiedName should always be defined.

    // ----- END OF POTENTIAL PROBLEM AREA -----

    updateData["name"] = finalIdentifiedName; 
    updateData["system.identification.identified.name"] = finalIdentifiedName;
    updateData["system.identification.identified.img"] = item.img; 

    // Adding the safety checks for unidentified structure as discussed before:
    if (!item.system.identification.unidentified) {
        updateData["system.identification.unidentified"] = {
            name: `Unidentified ${item.type}`,
            img: "icons/svg/mystery-man.svg",
            data: { description: { value: "" } }
        };
    } else {
        if (typeof item.system.identification.unidentified.name !== 'string') {
            updateData["system.identification.unidentified.name"] = `Unidentified ${item.type}`;
        }
        if (typeof item.system.identification.unidentified.img !== 'string') {
            updateData["system.identification.unidentified.img"] = "icons/svg/mystery-man.svg";
        }
    }
    // Similar check for identified structure if it could be missing (less likely if status is 'identified')
    if (!item.system.identification.identified) { // Should not happen if status is 'identified' but for extreme safety
        updateData["system.identification.identified.data"] = { description: { value: item.system.description.value || "" } };
    }


    updateData[
      `flags.${this.moduleId}.-=${this.config.CRIT_FAIL_ORIGINAL_DATA_FLAG}`
    ] = null;
    
    const currentUnidDesc =
      item.system.identification?.unidentified?.data?.description?.value ?? "";
    const cleanedDesc = currentUnidDesc
      .replace(
        /(<!-- failureMarker:Fail_[^_]+_L\d+ -->|<!-- SCF:DECEPTIVE_CRIT_FAIL -->)/g, 
        ""
      )
      .replace(this.config.WRONGLY_IDENTIFIED_DESC, "")
      .trim(); 

    if (cleanedDesc !== currentUnidDesc) {
      updateData[
        "system.identification.unidentified.data.description.value"
      ] = cleanedDesc || null; 
    }
    
    const currentMainDesc = item.system.description?.value ?? "";
    if (currentMainDesc.includes(this.config.DECEPTIVE_CRIT_FAIL_MARKER)) {
      updateData["system.description.value"] = currentMainDesc
        .replace(this.config.DECEPTIVE_CRIT_FAIL_MARKER, "")
        .trim();
    }
      
      
      
  }
      
      else {
        // dos === 1
        const lvl = actor.level;
        const failMarker = `<!-- failureMarker:Fail_${actor.id}_L${lvl} -->`;
        playerOutcomeText = `<span style="color: orange; font-weight: bold;">Failure.</span> The item resists scrutiny.`;
        if (assuredApplied) {
          playerOutcomeText += ` <span style="font-style: italic; color: #777;">(Assured Identification prevents worse)</span>`;
        }
        playerOutcomeText += `<br><em style="font-size:0.9em;">${
          actor.name
        } cannot retry until Level ${lvl + 1}.</em>`;

        updateData["system.identification.status"] = "unidentified";

        const descPath =
          "system.identification.unidentified.data.description.value";
        let currentUnidDesc =
          item.system.identification?.unidentified?.data?.description?.value ??
          "";
        // Remove *old* failure markers for *other actors/levels* before adding the new one
        currentUnidDesc = currentUnidDesc
          .replace(/<!-- failureMarker:Fail_[^_]+_L\d+ -->/g, "")
          .trim();
        // Remove deceptive markers/text as well, since it's now just a normal failure
        currentUnidDesc = currentUnidDesc
          .replace(this.config.DECEPTIVE_CRIT_FAIL_MARKER, "")
          .trim();
        currentUnidDesc = currentUnidDesc
          .replace(this.config.WRONGLY_IDENTIFIED_DESC, "")
          .trim();

        updateData[descPath] = currentUnidDesc
          ? `${currentUnidDesc} ${failMarker}`
          : failMarker; // Add new marker

        // Clear our flag if it was previously set
        updateData[
          `flags.${this.moduleId}.-=${this.config.CRIT_FAIL_ORIGINAL_DATA_FLAG}`
        ] = null;
        // Also clean the main description if it contains the deceptive marker
        const currentMainDesc = item.system.description?.value ?? "";
        if (currentMainDesc.includes(this.config.DECEPTIVE_CRIT_FAIL_MARKER)) {
          updateData["system.description.value"] = currentMainDesc
            .replace(this.config.DECEPTIVE_CRIT_FAIL_MARKER, "")
            .trim();
        }
      }

      // Apply updates ONLY if the item wasn't deleted/replaced
      if (!itemDeletedAndReplaced && Object.keys(updateData).length > 0) {
        try {
          await item.update(updateData);
          await new Promise((resolve) => setTimeout(resolve, 50)); // Short pause for data propagation
        } catch (updateError) {
          ui.notifications.error(
            `Error updating item ${item.name} after identification attempt: ${updateError.message}`
          );
          // Log error but continue to chat message generation
        }
      }

      // --- Chat Message Generation ---

      const finalLinkedItem = actor.items.get(itemToLinkInChat.id); // Use the ID of the item we intend to link

      let nameToShow = "Unknown Item";
      let iconToShow = "icons/svg/mystery-man.svg";
      let itemLink = `Item (${itemToLinkInChat?.id ?? "unknown"})`;
      let retryText = "";

      if (!finalLinkedItem) {
        nameToShow = itemToLinkInChat?.name ?? "Item (State Error)";
        iconToShow = itemToLinkInChat?.img ?? "icons/svg/hazard.svg";
        itemLink = itemToLinkInChat?.uuid
          ? `@UUID[${itemToLinkInChat.uuid}]{${nameToShow}} (Post-Op Fetch Failed)`
          : nameToShow;
        ui.notifications.warn(
          `Could not fetch final state for item ${itemToLinkInChat?.id} to generate chat link.`
        );
      } else {
        // If the item linked is the *replacement*, it should *appear* identified to the player
        if (itemDeletedAndReplaced || finalLinkedItem.isIdentified) {
          nameToShow = finalLinkedItem.name;
          iconToShow = finalLinkedItem.img;
          itemLink = `@UUID[${finalLinkedItem.uuid}]{${nameToShow}}`;
        } else {
          // Item is the original and remains unidentified (normal failure/success case)
          nameToShow =
            finalLinkedItem.system.identification?.unidentified?.data?.name
              ?.value || "Unidentified Item";
          iconToShow =
            finalLinkedItem.system.identification?.unidentified?.data?.img ||
            "icons/svg/mystery-man.svg";
          itemLink = `@UUID[${finalLinkedItem.uuid}]{${nameToShow}}`; // Link shows unidentified name

          if (dos === 1) {
            // Add retry text only on actual failure
            retryText = `<p style="font-size:0.8em; color: #800000;"><em>(Cannot retry with this skill until Level ${
              actor.level + 1
            })</em></p>`;
          }
        }
      }

      // Construct the chat message flavor text
      chatFlavor = `
              <div class="pf2e chat-card" style="padding: 3px; border: 1px solid var(--color-border-light-tertiary); font-size: 14px;">
                  <header class="card-header flexrow" style="border-bottom: 1px solid var(--color-border-light-tertiary); padding-bottom: 3px; margin-bottom: 3px;">
                      <img src="${actor.img}" title="${
        actor.name
      }" width="36" height="36" style="border: none; margin-right: 5px; flex-shrink: 0;">
                      <img src="${iconToShow}" title="${nameToShow}" width="36" height="36" style="border: none; margin-right: 5px; flex-shrink: 0;">
                      <h3 style="flex: 1; margin: 0; line-height: 36px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Identify Item</h3>
                  </header>
                  <div class="card-content" style="font-size: 0.95em;">
                      <p style="margin: 2px 0;"><strong>Attempted by:</strong> ${
                        actor.name
                      } using ${stat.label}</p>
                      <p style="margin: 2px 0;"><strong>Item:</strong> ${itemLink}</p>
                      <hr style="margin: 5px 0;">
                      <div style="margin: 0px 0;">
                          <strong>Result:</strong> ${playerOutcomeText}
                      </div>
                      ${retryText}
                      ${
                        itemDeletedAndReplaced
                          ? `<p style="font-size:0.8em; color: #550055; font-style:italic;"></p>`
                          : ""
                      }
                  </div>
              </div>`;

      // Send the chat message (blind to GM)
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: chatFlavor,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL, // Keep type roll to associate with the blind roll
        roll: roll.toJSON(), // Pass the roll data
        blind: true, // Ensure it respects the original roll's blindness
        whisper: ChatMessage.getWhisperRecipients("GM")
          .map((u) => u.id)
          .concat(game.user.id), // Whisper to GM and self
        flags: {
          core: { canPopout: true },
          "pf2e.origin": {
            // Link to the skill check
            type: "skill",
            uuid: stat.item?.uuid, // UUID of the skill's Ability item if available
            slug: stat.slug,
          },
        },
      });

      ui.notifications.info(
        `Identification attempt for "${nameToShow}" complete.`
      );
    } catch (err) {
      console.error(
        `${this.moduleId} | Error during identification attempt for item ID ${item?.id} on actor ${actor?.id}:`,
        err
      );
      ui.notifications.error(
        `Error during identification attempt for "${
          item?.name ?? "an item"
        }". Check console (F12) for details.`
      );
      // Send OOC error message
      const errorContent = `<strong style="color:red;">Identification Error:</strong> An unexpected error occurred while ${
        actor?.name ?? "Someone"
      } attempted to identify "${
        item?.name ?? "an item"
      }". Please see the console (F12) for technical details. Error: ${
        err.message
      }`;
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: errorContent,
        type: CONST.CHAT_MESSAGE_TYPES.OOC,
        whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id), // Whisper error to GM
      });
    }
  } // End _attemptIdentification

  async runIdentifyMagicProcess(sheetActor = null) {
    try {
      const actors = this._determineTargetActors(sheetActor);
      if (!actors || actors.length === 0) {
        ui.notifications.warn(
          "Identify Magic: No actor found. Please select a token or have a character assigned."
        );
        return;
      }
      const primaryActor = actors[0];
      const actorNames = actors.map((a) => `<em>${a.name}</em>`).join(", ");

      const actorHasDetect = this._actorHasSpellAvailable(
        primaryActor,
        this.IDENTIFY_SPELL_INFO.detect.slug
      );
      const actorHasReadAura = this._actorHasSpellAvailable(
        primaryActor,
        this.IDENTIFY_SPELL_INFO.read.slug
      );

      let initialItemList = [];
      for (const actor of actors) {
        const items = actor.items.filter(
          (i) =>
            i.system?.identification?.status &&
            i.system.identification.status === "unidentified"
        );
        items.forEach((item) => initialItemList.push({ actor, item }));
      }

      if (initialItemList.length === 0) {
        ui.notifications.info(`No unidentified items on ${actorNames}.`);
        return;
      }

      const itemCount = initialItemList.length;

      const detectMagicLink = this._createIdentifyLink(
        this.IDENTIFY_SPELL_INFO.detect.id,
        this.IDENTIFY_SPELL_INFO.detect.name,
        this.IDENTIFY_SPELL_INFO.detect.icon
      );
      const readAuraLink = this._createIdentifyLink(
        this.IDENTIFY_SPELL_INFO.read.id,
        this.IDENTIFY_SPELL_INFO.read.name,
        this.IDENTIFY_SPELL_INFO.read.icon
      );

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
                      this.styles.successColor
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
            callback: () => {
              ui.notifications.info("Stepping back from mysteries.");
            },
          },
        },
        default: actorHasDetect || actorHasReadAura ? "detect" : "identify",
        render: (html) => {
          const dialogElement = html.closest(".app.dialog")[0];

          if (!dialogElement) {
            return;
          }

          const setupDialogElements = () => {
            const $dialogElement = $(dialogElement);
            const checkbox = $dialogElement.find("#bypass-spell-restrictions");
            const buttonContainer = $dialogElement.find(".dialog-buttons");

            if (buttonContainer.length === 0) {
              return false;
            }

            const detectButton = buttonContainer.find(
              'button[data-button="detect"]'
            );
            const readAuraButton = buttonContainer.find(
              'button[data-button="read"]'
            );

            if (
              checkbox.length === 0 ||
              detectButton.length === 0 ||
              readAuraButton.length === 0
            ) {
              return false;
            }

            const updateButtonVisibility = () => {
              const bypassChecked = checkbox.prop("checked");
              const showDetect = bypassChecked || actorHasDetect;
              const showReadAura = bypassChecked || actorHasReadAura;

              detectButton.toggle(showDetect);
              readAuraButton.toggle(showReadAura);
            };

            updateButtonVisibility();

            checkbox
              .off("change.identifyDialog")
              .on("change.identifyDialog", () => {
                updateButtonVisibility();
              });

            html
              .off("click.identifyDialogContentLink")
              .on("click.identifyDialogContentLink", ".content-link", (ev) => {
                const el = ev.currentTarget;
                const pack = game.packs.get(el.dataset.pack);
                if (pack && el.dataset.id) {
                  pack
                    .getDocument(el.dataset.id)
                    .then((d) => d?.sheet.render(true));
                }
              });

            return true;
          };

          if (setupDialogElements()) {
            return;
          }

          let observer = new MutationObserver((mutationsList, obs) => {
            if (!observer) return;
            if (setupDialogElements()) {
              obs.disconnect();
              observer = null;
            }
          });

          const config = { childList: true, subtree: true };
          observer.observe(dialogElement, config);

          Hooks.once(`closeDialog`, (app) => {
            if (app.element[0] === dialogElement && observer) {
              observer.disconnect();
              observer = null;
            }
          });
        },
      }).render(true);
    } catch (err) {
      ui.notifications.error(
        "An unexpected error occurred during the Identify Magic process. Check console (F12)."
      );
    }
  }

  async _handleIdentifyChoice(choice, initialItemList, bypass = false) {
    let itemsForSkillCheck = [];
    let scanResultsData = new Map();
    const magicSchools = ["arcane", "primal", "occult", "divine"];

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
    const scanTime = choice === "detect" ? "10 min scan" : "1 min scan";
    ui.notifications.info(`Performing ${scanAction} scan...`);

    let scanningIndicator = new Dialog(
      {
        title: "Scanning Items...",
        content: `<div style="text-align:center;"><i class="fas fa-spinner fa-spin fa-3x"></i><p>Scanning ${initialItemList.length} items with ${scanAction}...</p></div>`,
        buttons: {},
      },
      { id: "scanning-indicator", width: 300 }
    ).render(true);

    const identifiedNonMagicalNames = [];

    for (const { actor, item } of initialItemList) {
      try {
        if (this.sounds.detectMagic) {
          AudioHelper.play(
            {
              src: this.sounds.detectMagic,
              volume: 0.3,
              autoplay: true,
              duration: 0.2,
            },
            false
          );
        }
      } catch (soundError) {}

      const isMagical = item.traits.has("magical");
      let schools = [];

      if (isMagical && choice === "read") {
        magicSchools.forEach((s) => {
          if (item.traits.has(s)) schools.push(s);
        });
      }

      scanResultsData.set(item.id, { isMagical, schools });

      $(scanningIndicator.element)
        .find("p")
        .text(
          `Scanning ${item.name}... ${isMagical ? "MAGICAL!" : "Non-magical."}`
        );

      await new Promise((resolve) => setTimeout(resolve, 2500));

      if (!isMagical) {
        try {
          await item.update({ "system.identification.status": "identified" });
          identifiedNonMagicalNames.push(item.name);
        } catch (updateError) {
          ui.notifications.error(
            `Failed to identify non-magical item: ${item.name}`
          );
        }
      } else {
        itemsForSkillCheck.push({ actor, item });
      }
    }

    if (scanningIndicator) {
      try {
        await scanningIndicator.close({ force: true });
      } catch (e) {}
    }

    if (identifiedNonMagicalNames.length > 0) {
      const message = `${scanAction} identified ${
        identifiedNonMagicalNames.length
      } non-magical item(s): ${identifiedNonMagicalNames.join(", ")}.`;
      ui.notifications.info(message);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ alias: "System" }),
        content: `<i class="fas fa-check-circle" style="color: green;"></i> ${message}`,
        whisper: ChatMessage.getWhisperRecipients("GM"),
      });
    }

    if (itemsForSkillCheck.length === 0) {
      ui.notifications.info(
        "Scan complete. No magical items require deeper inspection."
      );
      return;
    } else {
      await this._showIdentifyItemsDialog(
        itemsForSkillCheck[0].actor,
        itemsForSkillCheck,
        scanResultsData,
        choice
      );
    }
  }

  handleReverseEngineering(actor) {
    if (!actor) {
      ui.notifications.error("RE Error: Actor not found.");
      return;
    }

    const knownFormulaUUIDs = new Set(
      actor.system.crafting?.formulas?.map((f) => f.uuid) ?? []
    );

    const potentialItems = actor.items
      .filter((item) => {
        const isCorrectType = item.isOfType(
          "weapon",
          "armor",
          "equipment",
          "consumable",
          "treasure"
        );
        const hasSource = !!item.sourceId;
        const isNotFormula = !item.isOfType("formula");
        const isNotArtifact = !item.system.traits?.value?.includes("artifact");
        const isNotKnown = hasSource && !knownFormulaUUIDs.has(item.sourceId);
        const isOwned = item.actor === actor;

        return (
          isCorrectType &&
          hasSource &&
          isNotFormula &&
          isNotArtifact &&
          isNotKnown &&
          isOwned
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (potentialItems.length === 0) {
      ui.notifications.info(
        `No suitable items found for ${actor.name} to Reverse Engineer. Ensure the item has a source (is from a compendium), isn't an artifact or formula, and its formula isn't already known.`
      );
      return;
    }

    let optionsHtml = potentialItems
      .map(
        (item) =>
          `<option value="${item.id}" title="${item.name} (Lvl ${
            item.level ?? "?"
          }, ${item.rarity || "common"})">${item.name} (Lvl ${
            item.level ?? "?"
          })</option>`
      )
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
                            <i class="fas fa-info-circle"></i> Attempting Reverse Engineering destroys the item on Failure, Success, or Critical Failure. On a Critical Success, the item is <strong style="color: darkgreen;">not</strong> destroyed. Success grants the crafting formula if one exists and isn't already known.
                        </p>
                    </form>`;

    new Dialog(
      {
        title: `Reverse Engineer: ${actor.name}`,
        content: dialogContent,
        buttons: {
          engineer: {
            label: "Attempt",
            icon: '<i class="fas fa-wrench"></i>',
            callback: async (html) => {
              const form = html.find("form")[0];
              if (!form) {
                return;
              }
              const formData = new FormData(form);
              const selectedItemId = formData.get("itemId");

              if (!selectedItemId) {
                ui.notifications.warn(
                  "No item selected for Reverse Engineering."
                );
                return;
              }

              const itemToDestroy = actor.items.get(selectedItemId);
              if (!itemToDestroy) {
                ui.notifications.error(
                  `Selected item not found on ${actor.name}.`
                );
                return;
              }

              await this._processReverseEngineeringAttempt(
                actor,
                itemToDestroy
              );
            },
          },
          cancel: {
            label: "Cancel",
            icon: '<i class="fas fa-times"></i>',
            callback: () => {
              ui.notifications.info("Reverse Engineering attempt cancelled.");
            },
          },
        },
        default: "engineer",
        render: (html) => {
          html.find('select[name="itemId"]').focus();
        },
        close: () => {},
      },
      { width: 450 }
    ).render(true);
  }

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

      if (unitsToConsume > 0) {
        consumptionDetails.push({
          id: m.id,
          name: m.name,
          quantityToConsume: unitsToConsume,
        });
      }
      consumedCount += unitsToConsume;
      savedCount += m.quantity - unitsToConsume;
    });

    return {
      consumptionDetails,
      totalUnitsConsumed: consumedCount,
      totalUnitsSaved: savedCount,
    };
  }

  async _attemptCrafting(
    actor,
    targetItemUuid,
    targetData, // Contains targetItem.name, .icon, .level, .priceGP
    materialsUsed,
    valueUsed,
    requiredValue
  ) {
    let roll = null;
    let successDegree = -1;
    let outcomeMessage = "";
    // let createdDoc = null; // We'll get this from tempCreatedDoc
    let soundInstance = null;
    let loadingIndicatorElement = null;
    let animationFrameId = null;

    const crafterName = actor.name || "Unknown Crafter";
    const craftSkill = actor.skills.crafting;
    const timeStringPerItem = targetData.timeString;
    let chatMessageColor = this.styles.neutralColor || "#191813";

    if (!craftSkill) {
      ui.notifications.error(
        `Crafting skill missing for ${actor.name}. Cannot craft.`
      );
      return;
    }

    try {
      // ... (DC calculation logic - remains the same) ...
      let baseDC;
      const itemLevelForDC = Math.max(0, targetData.level);
      if (
        typeof targetData.dcFromSheet === "number" &&
        !isNaN(targetData.dcFromSheet) &&
        targetData.dcFromSheet > 0
      ) {
        baseDC = targetData.dcFromSheet;
      } else {
        const craftingEntry = actor.system.crafting?.formulas?.find(
          (f) => f.uuid === targetItemUuid
        );
        if (
          craftingEntry?.dc &&
          typeof craftingEntry.dc === "number" &&
          !isNaN(craftingEntry.dc) &&
          craftingEntry.dc > 0
        ) {
          baseDC = craftingEntry.dc;
        } else {
          if (typeof pf2e?.DC?.calculate === "function") {
            baseDC = pf2e.DC.calculate(itemLevelForDC, {
              proficiencyRank: craftSkill?.rank ?? 1,
            });
          }
          if (!baseDC || typeof baseDC !== "number" || baseDC <= 0) {
            const fallbackDCs = [
              14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34,
              35, 36, 38, 39, 40, 42, 44, 46, 48, 50,
            ];
            baseDC = fallbackDCs[itemLevelForDC] ?? 10;
          }
        }
      }
      if (!baseDC || baseDC <= 0) {
        ui.notifications.error(
          `Could not determine a valid Crafting DC for ${targetData.name}. Aborting.`
        );
        return;
      }

      // ... (Roll logic - remains the same) ...
      roll = await craftSkill.roll({
        dc: { value: baseDC },
        extraRollOptions: ["action:craft", `item:level:${targetData.level}`],
        title: `Craft: ${targetData.name}`,
        flavor: `Using materials worth ${valueUsed.toFixed(
          2
        )} gp (Req: ${requiredValue.toFixed(2)} gp) for ${
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


      // ... (Sound and animation - remains the same) ...
      let soundToPlay =
        successDegree >= 2 ? this.sounds.success : this.sounds.failure;
      if (soundToPlay)
        AudioHelper.play(
          { src: soundToPlay, volume: 0.8, autoplay: true },
          false
        );
      const token = actor.getActiveTokens()[0];
      if (token) {
        const animText = successDegree >= 2 ? "Success!" : "Failure!";
        const animColor =
          successDegree >= 2
            ? this.styles.successColor || "green"
            : this.styles.failureColor || "darkred";
        canvas.interface.createScrollingText(token.center, animText, {
          anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
          fontSize: 28,
          fill: animColor,
          stroke: 0x000000,
          strokeThickness: 4,
          duration: 5000,
        });
      }
      if (this.sounds.craftingLoop) {
        soundInstance = await AudioHelper.play(
          {
            src: this.sounds.craftingLoop,
            volume: 0.6,
            autoplay: true,
            loop: true,
          },
          false
        );
      }
      loadingIndicatorElement = document.createElement("div");
      loadingIndicatorElement.id = `crafting-loading-${foundry.utils.randomID()}`;
      Object.assign(loadingIndicatorElement.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        color: "white",
        padding: "20px 30px",
        borderRadius: "8px",
        zIndex: "10000",
        textAlign: "center",
        fontSize: "1.2em",
      });
      loadingIndicatorElement.innerHTML = `
        <div style="margin-bottom: 10px;">
            <i class="fas fa-hammer fa-spin fa-fw fa-2x"></i>
        </div>
        <div id="crafting-progress-bar-container" style="width: 200px; height: 20px; background-color: #555; border-radius: 5px; margin: 0 auto 10px auto; border: 1px solid #777; overflow: hidden;">
            <div id="crafting-progress-bar" style="width: 0%; height: 100%; background-color: #4CAF50; transition: width 0.1s linear;"></div>
        </div>
        <div id="crafting-progress-text" style="font-size: 0.9em;">Forging ${targetData.name}...</div>
      `;
      document.body.appendChild(loadingIndicatorElement);
      const progressBar = loadingIndicatorElement.querySelector(
        "#crafting-progress-bar"
      );
      const progressText = loadingIndicatorElement.querySelector(
        "#crafting-progress-text"
      );

      // ... (Quantity and material consumption logic - remains the same) ...
      let quantityCrafted = 0;
      let consumeFiftyPercentChance = false;
      if (successDegree === 3) {
        chatMessageColor = this.styles.successColor;
        quantityCrafted = Math.max(
          1,
          targetData.priceGP > 0
            ? Math.floor(valueUsed / (targetData.priceGP / 2))
            : 1
        );
        outcomeMessage = `<strong>Critical Success!</strong> Crafted ${quantityCrafted}x ${targetData.name}.`;
        consumeFiftyPercentChance = true;
      } else if (successDegree === 2) {
        chatMessageColor = this.styles.successColor;
        quantityCrafted = Math.max(
          1,
          targetData.priceGP > 0
            ? Math.floor(valueUsed / targetData.priceGP)
            : 1
        );
        outcomeMessage = `<strong>Success!</strong> Crafted ${quantityCrafted}x ${targetData.name}.`;
        consumeFiftyPercentChance = false;
      } else if (successDegree === 1) {
        chatMessageColor = this.styles.failureColor;
        outcomeMessage = `<strong>Failure.</strong> No items crafted.`;
        consumeFiftyPercentChance = true;
      } else {
        chatMessageColor = this.styles.failureColor;
        outcomeMessage = `<strong>Critical Failure!</strong> All materials ruined.`;
        consumeFiftyPercentChance = false;
      }

      const { consumptionDetails, totalUnitsConsumed, totalUnitsSaved } =
        this._calculateMaterialConsumptionDetails(
          materialsUsed,
          consumeFiftyPercentChance
        );
      if (consumptionDetails.length > 0) {
        const materialUpdates = [];
        const materialDeletions = [];
        for (const detail of consumptionDetails) {
          const item = actor.items.get(detail.id);
          if (!item) continue;
          const currentQty = item.system.quantity ?? 1;
          if (currentQty > detail.quantityToConsume) {
            materialUpdates.push({
              _id: detail.id,
              "system.quantity": currentQty - detail.quantityToConsume,
            });
          } else {
            materialDeletions.push(detail.id);
          }
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


      // --- Item Creation ---
      let tempCreatedDoc = null;
      // --- DEFINE finalCraftedName HERE ---
      let finalCraftedName = ""; // Initialize

      if (quantityCrafted > 0) {
        if (!targetItemUuid) {
          outcomeMessage += `\n<strong style="color:red;">Error: Missing target item UUID for creation!</strong>`;
          console.error(`${this.moduleId} | ITEM CREATION FAILED: Missing targetItemUuid.`);
        } else {
          try {
            const sourceItem = await fromUuid(targetItemUuid);
         if (sourceItem?.isOfType("physical")) {
              const itemSource = sourceItem.toObject(false);
              delete itemSource._id;
              itemSource.system.quantity = quantityCrafted;

              // ... (finalCraftedName calculation) ...
              const baseNameFromFormula = targetData.name || sourceItem.name || "Crafted Item";
              const craftSuffix = `(Crafted by ${crafterName})`;
              if (baseNameFromFormula && !baseNameFromFormula.endsWith(craftSuffix)) {
                finalCraftedName = `${baseNameFromFormula} ${craftSuffix}`;
              } else if (baseNameFromFormula) {
                finalCraftedName = baseNameFromFormula;
              } else {
                finalCraftedName = `Unknown Crafted Item ${craftSuffix}`;
              }

              itemSource.name = finalCraftedName;
              itemSource.img = sourceItem.img || targetData.icon;

              // --- ROBUST IDENTIFICATION BLOCK ---
              itemSource.system.identification = {
                status: "identified",
                identified: {
                  name: finalCraftedName,
                  img: itemSource.img,
                  // Ensure 'data' and 'data.description' objects exist
                  data: {
                    description: {
                      value: sourceItem.system.description?.value || "" // Get value if possible, else empty string
                    }
                  }
                },
                unidentified: {
                  name: `Unidentified ${sourceItem.type || "Item"}`,
                  img: "icons/svg/mystery-man.svg",
                  // Ensure 'data' and 'data.description' objects exist
                  data: {
                    description: {
                      value: "<p>This item has just been crafted.</p>" // Default unidentified description
                    }
                  }
                },
                misidentifiedData: null
              };
              // --- END ROBUST IDENTIFICATION BLOCK ---


                         const newSystemData = foundry.utils.deepClone(sourceItem.system);

              // Merge our specific changes (quantity, identification) into the cloned system data
              // This order ensures our `identification` object overwrites any from sourceItem.system
              itemSource.system = {
                  ...newSystemData, // Spread all properties from the original system
                  quantity: quantityCrafted, // Our specific quantity
                  identification: itemSource.system.identification // Our carefully constructed identification block
                  // Note: itemSource.name and itemSource.img are top-level, not in itemSource.system
              };
              // If `sourceItem.system` itself could be undefined (very unlikely for a valid item):
              // itemSource.system = {
              //    ...(sourceItem.system || {}), // Spread empty obj if sourceItem.system is undefined
              //    quantity: quantityCrafted,
              //    identification: itemSource.system.identification
              // };


              console.log(`${this.moduleId} | Prepared itemSource for creation:`, foundry.utils.deepClone(itemSource)); // Log the full source

              const createdItemsArray = await actor.createEmbeddedDocuments("Item", [itemSource]);
              
              if (createdItemsArray && createdItemsArray.length > 0) {
                tempCreatedDoc = createdItemsArray[0];
              } else {
                outcomeMessage += `\n<strong style="color:red;">Error: Item creation process yielded no documents.</strong>`;
              }
            } else {
              outcomeMessage += `\n<strong style="color:red;">Error: Source item (UUID: ${targetItemUuid}) is not physical or invalid.</strong>`;
            }
          } catch (loadError) {
            outcomeMessage += `\n<strong style="color:red;">Error loading/processing source item ${targetItemUuid}: ${loadError.message}</strong>`;
            console.error(`${this.moduleId} | ITEM CREATION FAILED for ${targetItemUuid}:`, loadError);
          }
        }
      } else {
        console.log(`${this.moduleId} | Quantity to craft is 0. No item creation attempted.`);
      }


      // --- 7. Item Modification (Name, Description) and UI Refresh ---
      let itemLinkForChat = "";
      const createdDocOnActor = tempCreatedDoc ? actor.items.get(tempCreatedDoc.id) : null;

    
      if (createdDocOnActor instanceof Item && createdDocOnActor.id) {
        const materialListString =
          materialsUsed.map((m) => `${m.name} (x${m.quantity})`).join(", ") ||
          "various materials";

        let gameDateTimeString = "";
        const simpleCalendarActive = game.modules.get("foundryvtt-simple-calendar")?.active;
        if (simpleCalendarActive && typeof SimpleCalendar !== "undefined" && SimpleCalendar.api) {
            try {
                const scCurrentDateTime = SimpleCalendar.api.currentDateTime();
                const formatString = "MMMM Do, YYYY, HH:mm";
                gameDateTimeString = SimpleCalendar.api.formatDateTime(scCurrentDateTime, formatString);
                if (!gameDateTimeString || gameDateTimeString.toLowerCase().includes("invalid")) {
                    const display = SimpleCalendar.api.currentDateTimeDisplay?.();
                    gameDateTimeString = (display && display.date && display.time) ? `${display.date}, ${display.time}` : new Date().toLocaleString();
                }
            } catch (scError) { gameDateTimeString = new Date().toLocaleString(); }
        } else { gameDateTimeString = new Date().toLocaleString(); }

        const nameForUpdate = finalCraftedName; // Assumes finalCraftedName is correctly defined from creation block

        // --- DETAILED DESCRIPTION DEBUGGING ---
        console.log(`${this.moduleId} | --- Preparing Description Update for: ${createdDocOnActor.name} (ID: ${createdDocOnActor.id}) ---`);
        console.log(`${this.moduleId} | Crafter: ${crafterName}, DateTime: ${gameDateTimeString}, Materials: ${materialListString}`);

        let baseDescription = createdDocOnActor.system.description?.value ?? "";
        console.log(`${this.moduleId} | 1. Initial baseDescription from createdDoc:`, JSON.stringify(baseDescription));

        // Regex to find and remove a previously added crafting marker to prevent duplication
        const craftMarkerRegex = /<hr>\s*<p>\s*<em>Item crafted by.*?<\/em>\s*<\/p>/si;
        if (craftMarkerRegex.test(baseDescription)) {
            console.log(`${this.moduleId} | Found existing craft marker. Removing it.`);
            baseDescription = baseDescription.replace(craftMarkerRegex, "").trim();
            // If trimming leaves an empty string or just whitespace, make it truly empty
            if (baseDescription.match(/^\s*$/)) {
                baseDescription = "";
            }
            // Remove any trailing <hr> or <br> that might be left after removing the marker
            baseDescription = baseDescription.replace(/<(hr|br)\s*\/?>\s*$/i, "").trim();
        }
        console.log(`${this.moduleId} | 2. baseDescription after potential cleaning:`, JSON.stringify(baseDescription));

        const craftInfoHtml = `<hr><p><em>Item crafted by ${crafterName} on ${gameDateTimeString} using: ${materialListString}.</em></p>`;
        console.log(`${this.moduleId} | 3. craftInfoHtml to append:`, JSON.stringify(craftInfoHtml));

        let descriptionWithAddition;
        if (baseDescription) {
            // Check if baseDescription already ends with a closing p tag or an hr/br to avoid awkward concatenation
            if (baseDescription.match(/<\/(p|div|ul|ol)>$|<\/(li)>$|<(hr|br)\s*\/?>$/i)) {
                descriptionWithAddition = baseDescription + craftInfoHtml; // Append directly
            } else {
                descriptionWithAddition = baseDescription + "\n" + craftInfoHtml; // Add a newline before HR if not ending with block
            }
        } else {
            // If baseDescription is empty, remove the leading <hr> from craftInfoHtml as it's not separating anything.
            descriptionWithAddition = craftInfoHtml.replace(/^<hr>/, '').trim();
        }
        console.log(`${this.moduleId} | 4. Final descriptionWithAddition for update:`, JSON.stringify(descriptionWithAddition));
        // --- END DETAILED DESCRIPTION DEBUGGING ---

        const updateData = {
          name: nameForUpdate,
          "system.description.value": descriptionWithAddition, 
          "system.identification.status": "identified",
          "system.identification.identified.name": nameForUpdate,
          "system.identification.identified.img": createdDocOnActor.img,
          [`flags.${this.moduleId}.craftedTimestamp`]: Date.now(),
        };
        
        if (!createdDocOnActor.system.identification.unidentified) {
            updateData["system.identification.unidentified"] = {
                name: `Unidentified ${createdDocOnActor.type || "Item"}`,
                img: "icons/svg/mystery-man.svg",
                data: { description: { value: "" } }
            };
        }

        console.log(`${this.moduleId} | Update Data being sent:`, foundry.utils.deepClone(updateData));

        try {
          await createdDocOnActor.update(updateData);
          console.log(`${this.moduleId} | Item update promise resolved for ${createdDocOnActor.id}.`);
          
          await new Promise(resolve => setTimeout(resolve, 100)); 

          const finalUpdatedItemOnActor = actor.items.get(createdDocOnActor.id);

          if (finalUpdatedItemOnActor) {
            console.log(`${this.moduleId} | Fetched finalUpdatedItemOnActor. Name: ${finalUpdatedItemOnActor.name}`);
            console.log(`${this.moduleId} | Description on finalUpdatedItemOnActor:`, JSON.stringify(finalUpdatedItemOnActor.system.description?.value));
            console.log(`${this.moduleId} | Does it include crafterName '${crafterName}'?`, finalUpdatedItemOnActor.system.description?.value.includes(crafterName));
            
            itemLinkForChat = `@UUID[${finalUpdatedItemOnActor.uuid}]{${finalUpdatedItemOnActor.name}}`;

            if (actor.sheet?.rendered) {
              console.log(`${this.moduleId} | Forcing sheet refresh for actor ${actor.name}`);
              // actor.sheet.actor = game.actors.get(actor.id); // Re-assigning actor might not be necessary if data model is reactive
              actor.sheet.render(true, { focus: false });
            }
          } else {
            console.error(`${this.moduleId} | Item ${createdDocOnActor.id} NOT FOUND on actor after its own update() method and pause.`);
            itemLinkForChat = `@UUID[${createdDocOnActor.uuid}]{${nameForUpdate}} (Final Verification Failed)`;
          }
        } catch (updateError) {
          console.error(`${this.moduleId} | Error during createdDocOnActor.update():`, updateError);
          outcomeMessage += `\n<strong style="color:red;">Error updating final item details: ${updateError.message}</strong>`;
          itemLinkForChat = `@UUID[${createdDocOnActor.uuid}]{${createdDocOnActor.name}} (Final Update Exception)`; // Use current name if update fails
        }
        if (itemLinkForChat) outcomeMessage += `\nCreated & Modified: ${itemLinkForChat}`;
      } 
      
      
      else if 
    (quantityCrafted > 0) {
        // This case means item creation might have failed or tempCreatedDoc wasn't found on actor
        console.error(`${this.moduleId} | Item modification skipped. 'createdDocOnActor' not valid. tempCreatedDoc ID: ${tempCreatedDoc?.id}`);
        if (!outcomeMessage.includes("Error:")) {
          outcomeMessage += `\n<strong style="color:red;">(Internal Error: Crafted item not found on actor for final modifications.)</strong>`;
        }
      }

      // ... (Progress bar animation and cleanup - remains the same) ...
      let totalDurationMs = Math.max(1000, valueUsed * 100);
      if (quantityCrafted === 0) { totalDurationMs = 2000; }
      const startTime = performance.now();
      const animateProgress = (timestamp) => {
        const elapsedTime = timestamp - startTime;
        let progressPercentage = Math.min(100, (elapsedTime / totalDurationMs) * 100);
        if (progressBar) progressBar.style.width = `${progressPercentage}%`;
        if (elapsedTime < totalDurationMs) {
          animationFrameId = requestAnimationFrame(animateProgress);
        } else {
          if (progressBar) progressBar.style.width = "100%";
          if (progressText && loadingIndicatorElement) {
            progressText.innerHTML = `<i class="fas ${quantityCrafted > 0 ? 'fa-check-circle' : 'fa-times-circle'} fa-fw" style="color: ${chatMessageColor};"></i> ${quantityCrafted > 0 ? 'Crafting Complete!' : (successDegree === 0 ? 'Materials Ruined!' : 'Process Failed.')}`;
          }
          setTimeout(() => {
            if (loadingIndicatorElement) loadingIndicatorElement.remove();
            loadingIndicatorElement = null;
            if (soundInstance) soundInstance.stop().then(() => (soundInstance = null));
          }, quantityCrafted > 0 ? 1500 : 1000);
        }
      };
      animationFrameId = requestAnimationFrame(animateProgress);
      await new Promise((resolve) => setTimeout(resolve, totalDurationMs));

      // ... (Chat message creation - remains the same, ensure it uses the final name from itemLinkForChat or createdDocOnActor.name) ...
      const materialListDisplay = materialsUsed.length > 0 ? materialsUsed.map((m) => `${m.name} x${m.quantity}`).join(", ") : "None selected";
      const targetItemDisplayLink = targetItemUuid ? `@UUID[${targetItemUuid}]{${targetData.name}}` : targetData.name;
      const finalChatMessage = `
        <div class="pf2e chat-card" style="padding: 5px; border: 2px solid ${chatMessageColor}; border-radius: 5px; font-size: 14px; background-color: rgba(0,0,0,0.03);">
          <header class="card-header flexrow">
            <img src="${actor.img}" title="${actor.name}" width="36" height="36" style="border: none; margin-right: 5px;">
            <img src="${targetData.icon}" title="${targetData.name}" width="36" height="36" style="border: none; margin-right: 5px;">
            <h3 style="flex-grow: 1; margin: 0; line-height: 36px; color: ${chatMessageColor};">
              Craft: ${targetItemDisplayLink}
            </h3>
          </header>
          <div class="card-content" style="font-size: 0.95em;">
            <p style="margin: 2px 0;"><strong>Crafter:</strong> ${actor.name}</p>
            <p style="margin: 2px 0;"><strong>Formula:</strong> ${targetData.name}</p>
            <p style="margin: 2px 0;"><strong>Materials Used (Value: ${valueUsed.toFixed(2)}gp / Req: ${requiredValue.toFixed(2)}gp):</strong> ${materialListDisplay}</p>
            <p style="margin: 2px 0;"><strong>Craft DC:</strong> ${baseDC ?? "?"}</p>
            <p style="margin: 2px 0;"><strong>Roll Result:</strong> ${roll?.total ?? "?"} vs DC ${baseDC ?? "?"} (<strong style="color: ${chatMessageColor};">${rollOutcomeText || "No Roll"}</strong>)</p>
            <hr style="margin: 5px 0;">
            <p style="margin: 2px 0; white-space: pre-wrap;">${outcomeMessage}</p>
            <p style="font-size:0.9em; color: #555; margin-top: 5px;"><em>GM Note: Verify material appropriateness and time tracking for overall task. Base time/item: ${timeStringPerItem}.</em></p>
          </div>
        </div>`;

      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: finalChatMessage,
        roll: roll.toJSON(),
        flags: {
          "pf2e.origin": { type: "skill", uuid: craftSkill?.item?.uuid, slug: craftSkill?.slug },
          core: { canPopout: true },
        },
      });

    } catch (error) {
      console.error(`${this.moduleId} | CRITICAL CRAFTING ERROR for ${targetData.name}:`, error);
      ui.notifications.error(`A critical error occurred while crafting ${targetData.name}. Check console (F12).`);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (loadingIndicatorElement) loadingIndicatorElement.remove();
      if (soundInstance) await soundInstance.stop();
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ alias: "System Error" }),
        content: `<b>${this.moduleId} ERROR:</b> A critical error occurred while ${crafterName} was crafting ${targetData.name}. Error: ${error.message}.`,
        whisper: ChatMessage.getWhisperRecipients("GM").map((u) => u.id),
      });
    } finally {
      if (animationFrameId && !loadingIndicatorElement) {
        cancelAnimationFrame(animationFrameId);
      }
    }
  }

  async _processReverseEngineeringAttempt(actor, itemToDestroy) {
    let outcomeColor = "#191813";

    try {
      const startSound = this.sounds.reverseEngineerStart;
      if (startSound) {
        AudioHelper.play(
          { src: startSound, volume: 0.7, autoplay: true },
          false
        );
      }
    } catch (e) {}

    const dc = this._calculateReverseEngineeringDC(itemToDestroy);
    if (dc === null) {
      ui.notifications.error(
        `Could not determine DC for ${itemToDestroy.name}. Reverse Engineering cancelled.`
      );
      return;
    }

    const statistic = actor.skills.crafting;
    if (!statistic) {
      ui.notifications.error(
        `${actor.name} does not have the Crafting skill. Cannot Reverse Engineer.`
      );
      return;
    }

    const rollArgs = {
      dc: { value: dc },
      item: itemToDestroy,
      title: `Reverse Engineer: ${itemToDestroy.name}`,
      info: `Attempting to learn formula (Crafting DC ${dc})`,
      extraRollOptions: [
        "action:reverse-engineer",
        `item:id:${itemToDestroy.id}`,
        `item:slug:${itemToDestroy.slug}`,
      ],
      rollMode: CONST.DICE_ROLL_MODES.PUBLIC,
    };

    const rollResult = await statistic.roll(rollArgs);

    if (!rollResult) {
      ui.notifications.warn("Reverse Engineering roll cancelled.");
      return;
    }

    const degreeOfSuccess = rollResult.degreeOfSuccess;
    let formulaLearned = false;
    let chatFlavor = `<strong>Reverse Engineering: ${itemToDestroy.name}</strong> (Crafting DC ${dc})`;
    let notificationType = "info";
    let notificationMessage = "";
    const rollTotal = rollResult.total;
    const rollOutcomeText = rollResult.outcome
      ? game.i18n.localize(
          `PF2E.Check.Result.Degree.Check.${rollResult.outcome}`
        )
      : `Degree ${degreeOfSuccess}`;

    let soundToPlay = null;
    if (degreeOfSuccess >= 2) {
      soundToPlay = this.sounds.success;
      outcomeColor = this.styles.successColor;
    } else {
      soundToPlay = this.sounds.failure;
      outcomeColor = this.styles.failureColor;
    }

    if (soundToPlay) {
      try {
        AudioHelper.play(
          { src: soundToPlay, volume: 0.8, autoplay: true },
          false
        );
      } catch (soundError) {}
    }

    try {
      const token = actor.getActiveTokens()[0];
      if (token) {
        const animText = degreeOfSuccess >= 2 ? "Success!" : "Failure!";
        const animColor =
          degreeOfSuccess >= 2
            ? this.styles.successColor
            : this.styles.failureColor;
        canvas.interface.createScrollingText(token.center, "Reverse Eng...", {
          anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
          fontSize: 28,
          fill: animColor,
          stroke: 0x000000,
          strokeThickness: 4,
          duration: 3500,
        });
      } else {
      }
    } catch (animError) {}

    try {
      if (degreeOfSuccess === 3) {
        const sourceId = itemToDestroy.sourceId;
        if (
          !sourceId ||
          typeof sourceId !== "string" ||
          !sourceId.startsWith("Compendium.")
        ) {
          chatFlavor += `<br><span style="color: orange;">Critical Success!</span> But the item's origin is unclear. Cannot add formula. Item <strong>not</strong> destroyed.`;
          notificationType = "warning";
          notificationMessage = `Critical Success, but couldn't get formula for ${itemToDestroy.name}. Item not destroyed.`;
        } else {
          const existingFormulas = actor.system.crafting?.formulas ?? [];
          const alreadyKnown = existingFormulas.some(
            (f) => f.uuid === sourceId
          );
          if (alreadyKnown) {
            chatFlavor += `<br><span style="color: darkcyan;">Critical Success!</span> You already knew the formula. Item <strong>not</strong> destroyed.`;
            notificationType = "info";
            notificationMessage = `Critical Success! Already knew formula for ${itemToDestroy.name}. Item not destroyed.`;
            formulaLearned = true;
          } else {
            const newFormulaEntry = { uuid: sourceId };
            const updatedFormulas = [...existingFormulas, newFormulaEntry];
            updatedFormulas.sort((a, b) => {
              const itemA = fromUuidSync(a.uuid);
              const itemB = fromUuidSync(b.uuid);
              return (
                (itemA?.level ?? 99) - (itemB?.level ?? 99) ||
                (itemA?.name ?? "").localeCompare(itemB?.name ?? "")
              );
            });
            try {
              await actor.update({
                "system.crafting.formulas": updatedFormulas,
              });
              chatFlavor += `<br><span style="color: green;">Critical Success!</span> Learned formula for @UUID[${sourceId}]{${itemToDestroy.name}}! Item <strong>not</strong> destroyed.`;
              notificationType = "info";
              notificationMessage = `Successfully learned formula for ${itemToDestroy.name}! Item not destroyed.`;
              formulaLearned = true;
            } catch (updateError) {
              throw new Error(
                `Failed to save learned formula for ${itemToDestroy.name}. Item not destroyed.`
              );
            }
          }
        }
      } else if (degreeOfSuccess === 2) {
        const sourceId = itemToDestroy.sourceId;
        if (
          !sourceId ||
          typeof sourceId !== "string" ||
          !sourceId.startsWith("Compendium.")
        ) {
          chatFlavor += `<br><span style="color: orange;">Success!</span> But item origin unclear. Cannot add formula. Item destroyed.`;
          notificationType = "warning";
          notificationMessage = `Success, but couldn't get formula for ${itemToDestroy.name}. Item destroyed.`;
        } else {
          const existingFormulas = actor.system.crafting?.formulas ?? [];
          const alreadyKnown = existingFormulas.some(
            (f) => f.uuid === sourceId
          );
          if (alreadyKnown) {
            chatFlavor += `<br><span style="color: darkcyan;">Success!</span> You already knew the formula. Item destroyed.`;
            notificationType = "info";
            notificationMessage = `Success! Already knew formula for ${itemToDestroy.name}. Item destroyed.`;
            formulaLearned = true;
          } else {
            const newFormulaEntry = { uuid: sourceId };
            const updatedFormulas = [...existingFormulas, newFormulaEntry];
            updatedFormulas.sort((a, b) => {
              const itemA = fromUuidSync(a.uuid);
              const itemB = fromUuidSync(b.uuid);
              return (
                (itemA?.level ?? 99) - (itemB?.level ?? 99) ||
                (itemA?.name ?? "").localeCompare(itemB?.name ?? "")
              );
            });
            try {
              await actor.update({
                "system.crafting.formulas": updatedFormulas,
              });
              chatFlavor += `<br><span style="color: green;">Success!</span> Learned formula for @UUID[${sourceId}]{${itemToDestroy.name}}! Item destroyed.`;
              notificationType = "info";
              notificationMessage = `Successfully learned formula for ${itemToDestroy.name}! Item destroyed.`;
              formulaLearned = true;
            } catch (updateError) {
              throw new Error(
                `Failed to save learned formula for ${itemToDestroy.name}. Item destroyed.`
              );
            }
          }
        }
        await itemToDestroy.delete();
      } else if (degreeOfSuccess === 1) {
        chatFlavor += `<br><span style="color: red;">Failure.</span> Failed to learn formula. Item destroyed.`;
        notificationType = "warning";
        notificationMessage = `Failed to learn formula for ${itemToDestroy.name}. Item destroyed.`;
        formulaLearned = false;
        await itemToDestroy.delete();
      } else {
        chatFlavor += `<br><span style="color: darkred;">Critical Failure!</span> Failed to learn formula. Item destroyed.`;
        notificationType = "warning";
        notificationMessage = `Critical Failure! Failed to learn formula for ${itemToDestroy.name}. Item destroyed.`;
        formulaLearned = false;
        await itemToDestroy.delete();
      }
    } catch (error) {
      ui.notifications.error(
        `Error processing Reverse Engineering result for "${itemToDestroy.name}". Check console.`
      );
      chatFlavor += `<br><strong style="color:red;">Error processing result! Check console.</strong>`;
      notificationType = "error";
      notificationMessage = `Error processing RE result for ${itemToDestroy.name}. Check console.`;
    } finally {
      chatFlavor += `<br>Roll: ${rollTotal} vs DC ${dc} (<strong style="color: ${outcomeColor};">${rollOutcomeText}</strong>)`;

      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: `<div class="pf2e chat-card" style="padding: 5px; border: 2px solid ${outcomeColor}; border-radius: 5px; background-color: rgba(0,0,0,0.03);">
                    <header class="card-header flexrow">
                        <img src="${actor.img}" title="${actor.name}" width="36" height="36" style="border:none; margin-right:5px;">
                        <img src="${itemToDestroy.img}" title="${itemToDestroy.name}" width="36" height="36" style="border:none; margin-right:5px;">
                        <h3 style="flex:1; margin:0; line-height:36px; color: ${outcomeColor};">Reverse Engineer: ${itemToDestroy.name}</h3>
                    </header>
                    <div class="card-content" style="font-size:0.95em;">
                        ${chatFlavor}
                    </div>
                 </div>`,
        sound: null,
        flags: {
          "pf2e.origin": {
            type: "skill",
            uuid: statistic?.item?.uuid,
            slug: statistic?.slug,
          },
        },
      });

      if (notificationMessage) {
        ui.notifications[notificationType](notificationMessage);
      }
    }
  }

  async handleCustomCraftingIntercept(actor, event) {
    if (!actor || !(actor instanceof Actor)) {
      ui.notifications.error("Custom Crafting Error: Actor data missing.");
      return;
    }

    let formulaUuid = null;
    let formulaDCFromSheet = null;
    const listItemElement = event?.currentTarget?.closest("li[data-item-uuid]");

    if (listItemElement) {
      formulaUuid = listItemElement.dataset.itemUuid;

      const dcElement = listItemElement.querySelector("div.dc");
      if (dcElement) {
        const dcText = dcElement.textContent?.trim();
        const dcMatch = dcText?.match(/\d+/);
        if (dcMatch) {
          const dcValue = parseInt(dcMatch[0], 10);
          if (!isNaN(dcValue)) {
            formulaDCFromSheet = dcValue;
          } else {
          }
        } else {
        }
      } else {
      }
    } else {
      ui.notifications.error(
        "Custom Crafting Error: Could not identify formula from sheet element."
      );
      return;
    }

    if (
      !formulaUuid ||
      typeof formulaUuid !== "string" ||
      !formulaUuid.includes(".")
    ) {
      ui.notifications.error("Custom Crafting Error: Invalid formula data.");
      return;
    }

    const targetItemData = await this.findTargetItemForFormula({
      uuid: formulaUuid,
    });

    if (targetItemData) {
      this._openMaterialSelectionDialog(
        actor,
        targetItemData,
        formulaDCFromSheet
      );
    } else {
      ui.notifications.error(
        `Custom Crafting Error: Failed to load target item data for crafting UUID "${formulaUuid}".`
      );
    }
  }

  async _openMaterialSelectionDialog(actor, targetItem, dcFromSheet) {
    try {
      if (!targetItem || !(targetItem instanceof Item)) {
        ui.notifications.error(`Cannot craft: Invalid target item provided.`);
        return;
      }
      if (!targetItem.system?.price?.value) {
        ui.notifications.error(
          `Cannot craft ${targetItem.name}: Item has no price defined.`
        );
        return;
      }

      const itemLevel = targetItem.level ?? 0;
      const itemPrice = targetItem.system.price.value;
      const itemPriceGP =
        (itemPrice.gp || 0) +
        (itemPrice.sp || 0) / 10 +
        (itemPrice.cp || 0) / 100;

      const craftSkill = actor.skills.crafting;
      const proficiencyRank = craftSkill?.rank > 0 ? craftSkill.rank : 1;
      const finalTimeString = this.calculateCraftingTime(
        itemLevel,
        proficiencyRank
      );

      const targetName = targetItem.name;
      const targetIcon = targetItem.img || "icons/svg/item-bag.svg";
      const targetItemUuid = targetItem.uuid;

      let magicDisclaimer = "";
      if (targetItem.system.traits?.value?.includes("magical")) {
        magicDisclaimer = `
                    <div style="border: 1px solid orange; padding: 5px; margin: 5px 0; background-color: rgba(255, 165, 0, 0.1);">
                        <strong style="color: orange;"><i class="fas fa-exclamation-triangle"></i> Magical Item Note:</strong>
                        <p style="margin: 2px 0 0 0; font-size: 0.9em;">
                            Crafting <strong>${targetName}</strong> requires magical components. Ensure at least half the material value comes from appropriate magical sources (GM discretion).
                        </p>
                    </div>`;
      }

      let calcPriceGP = itemPriceGP;
      if (calcPriceGP <= 0) {
        calcPriceGP = 0.01;
      }
      const requiredValue = calcPriceGP / 2;

      const itemTypesToConsider = [
        "loot",
        "consumable",
        "equipment",
        "treasure",
        "weapon",
        "armor",
        "backpack",
      ];
      const inventoryMaterials = actor.items
        .filter(
          (i) =>
            itemTypesToConsider.includes(i.type) &&
            i.system?.price?.value &&
            (i.system.price.value.gp || 0) +
              (i.system.price.value.sp || 0) / 10 +
              (i.system.price.value.cp || 0) / 100 >
              0 &&
            (i.system.quantity ?? 1) > 0
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      let materialInputs = `<p style="text-align: center; color: #555;"><i>No suitable items found in inventory. Items must have a price and quantity > 0.</i></p>`;
      if (inventoryMaterials.length > 0) {
        materialInputs = inventoryMaterials
          .map((item) => {
            const itemPrice = item.system.price.value;
            const valuePerUnit =
              (itemPrice.gp || 0) +
              (itemPrice.sp || 0) / 10 +
              (itemPrice.cp || 0) / 100;
            const currentQuantity = item.system.quantity ?? 1;

            return `
                        <div class="material-row form-group"
                             style="display: flex; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 5px;"
                             data-item-id="${item.id}"
                             data-value-per-unit="${valuePerUnit.toFixed(4)}"
                             data-max-qty="${currentQuantity}"
                             data-item-name="${item.name}">

                            <div class="item-info" style="flex: 2; display: flex; flex-direction: column; margin-right: 10px;">
                                <div style="display: flex; align-items: center; font-weight: bold; margin-bottom: 2px;">
                                    <img src="${
                                      item.img
                                    }" style="height: 24px; width: 24px; margin-right: 5px; border: none; flex-shrink: 0; object-fit: contain;"/>
                                    ${item.name}
                                </div>
                                <div style="font-size: 0.85em; color: #006000; padding-left: 29px;">
                                    Value: ${valuePerUnit.toFixed(2)} gp/ea
                                </div>
                                <div style="font-size: 0.85em; color: #666; padding-left: 29px;">
                                    Type: ${
                                      item.type
                                    }, Have: <span class="current-qty">${currentQuantity}</span>
                                </div>
                            </div>

                            <div class="item-input" style="flex: 1; text-align: right;">
                                <label style="display: block; font-size: 0.85em; margin-bottom: 2px;">Use Qty:</label>
                                <input type="number"
                                       class="material-quantity"
                                       name="${item.id}"
                                       value="0"
                                       min="0"
                                       max="${currentQuantity}"
                                       step="1"
                                       style="width: 70px; height: 24px; text-align: center; border: 1px solid #ccc;"
                                />
                            </div>
                        </div>
                    `;
          })
          .join("");
      }

      const finalTargetData = {
        name: targetName,
        icon: targetIcon,
        level: itemLevel,
        priceGP: calcPriceGP,
        targetItemUuid: targetItemUuid,
        dcFromSheet: dcFromSheet,
        timeString: finalTimeString,
      };

      const dialogId = `material-selection-dialog-${foundry.utils.randomID(
        10
      )}`;
      const materialDialogContent = `
                <form id="${dialogId}-form">
                    <div class="dialog-header" style="display: flex; align-items: center; border-bottom: 1px solid #999; padding-bottom: 10px; margin-bottom: 10px;">
                        <img src="${finalTargetData.icon}" title="${
        finalTargetData.name
      }" style="height: 64px; width: 64px; margin-right: 15px; border: none; flex-shrink: 0; object-fit: contain;"/>
                        <h1 style="margin: 0; font-size: 1.8em; line-height: 1.2;">
                            Crafting: ${
                              finalTargetData.name
                            } <span style="font-size: 0.7em; color: #555;">(Lvl ${itemLevel})</span>
                        </h1>
                    </div>

                    ${magicDisclaimer}

                    <p style="font-size: 0.9em;">
                        Requires material value ≥ <strong>${requiredValue.toFixed(
                          2
                        )} gp</strong>.
                    </p>
                     <p style="font-size: 0.9em;">
                        Estimated Time: <strong>${finalTimeString}</strong> per Item. (Applies regardless of quantity crafted).
                    </p>

                    <fieldset style="border: 1px solid #ccc; margin-bottom: 10px; padding: 8px;">
                        <legend style="font-weight: bold;">Available Materials</legend>
                        <div class="material-list" style="max-height: 300px; overflow-y: auto;">
                            ${materialInputs}
                        </div>
                    </fieldset>

                    <div style="border-top: 1px solid #999; padding-top: 8px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-weight: bold;">
                            Total Value Provided: <strong class="total-value" style="color: red; font-size: 1.1em;">0.00 gp</strong>
                        </div>
                        <div style="font-size: 0.9em;">
                            Potential Quantity Crafted: x<strong class="potential-items" style="color: #005000; font-weight: bold;">0</strong>
                        </div>
                    </div>

                    <p style="font-size: 0.8em; color: #555; margin-top: 5px;">
                        Note: The *actual* quantity of materials consumed/ruined depends on the crafting check outcome (Crit Success/Failure consume 50% on average, Success/Crit Failure consume 100%). Potential Quantity Crafted is illustrative, based on full value used.
                    </p>
                </form>

                <script>
                    (function(dialogSpecificId, reqValue, pricePerItem) {
                        const form = document.getElementById(\`\${dialogSpecificId}-form\`);
                        if (!form) {
                             console.error('Simplified Crafting Module: Material selection form not found.');
                             return;
                        }
                        const materialList = form.querySelector('.material-list');
                        const valueDisplay = form.querySelector('.total-value');
                        const itemsDisplay = form.querySelector('.potential-items');
                        const craftButton = form.closest('.app.dialog')?.querySelector('.dialog-buttons button.craft-button');

                        const validateInput = (inputElement) => {
                            let currentVal = parseInt(inputElement.value) || 0;
                            const minVal = parseInt(inputElement.min) || 0;
                            const maxVal = parseInt(inputElement.max);
                            if (currentVal < minVal) currentVal = minVal;
                            if (!isNaN(maxVal) && currentVal > maxVal) currentVal = maxVal;
                            inputElement.value = currentVal;
                            return currentVal;
                        };

                        const updateTotal = () => {
                            let currentValue = 0;
                            if (!materialList) return;
                            materialList.querySelectorAll('.material-row').forEach(row => {
                                const qtyInput = row.querySelector('.material-quantity');
                                if (!qtyInput) return;
                                const qty = validateInput(qtyInput);
                                const valuePer = parseFloat(row.dataset.valuePerUnit) || 0;
                                currentValue += qty * valuePer;
                            });
                            if (valueDisplay) {
                                valueDisplay.textContent = currentValue.toFixed(2) + ' gp';
                                const meetsValue = currentValue >= reqValue;
                                valueDisplay.style.color = meetsValue ? 'green' : 'red';
                                if (craftButton) {
                                    craftButton.disabled = !meetsValue;
                                }
                            }
                            if (itemsDisplay) {
                                let quantity = 0;
                                if (currentValue >= reqValue && pricePerItem > 0) {
                                    quantity = Math.floor(currentValue / pricePerItem);
                                }
                                itemsDisplay.textContent = quantity;
                            }
                        };

                        if (materialList) {
                            materialList.addEventListener('input', (event) => {
                                if (event.target.classList.contains('material-quantity')) {
                                    updateTotal();
                                }
                            });
                             materialList.addEventListener('change', (event) => {
                                if (event.target.classList.contains('material-quantity')) {
                                     updateTotal();
                                }
                            });
                        }
                        updateTotal();
                    })("${dialogId}", ${requiredValue}, ${
        finalTargetData.priceGP
      });
                </script>`;

      new Dialog(
        {
          id: dialogId,
          title: `Select Materials: ${finalTargetData.name}`,
          content: materialDialogContent,
          buttons: {
            craft: {
              icon: '<i class="fas fa-hammer"></i>',
              label: `Attempt Craft`,
              classes: "craft-button",
              callback: async (html) => {
                const materialsToUse = [];
                let totalValueUsed = 0;
                const formElement = html.find(`#${dialogId}-form`)[0];
                if (!formElement) {
                  ui.notifications.error(
                    "Internal Error: Crafting form data missing."
                  );
                  return false;
                }
                $(formElement)
                  .find(".material-row")
                  .each((i, el) => {
                    const $el = $(el);
                    const itemId = $el.data("itemId");
                    const quantityInput = $el.find(".material-quantity");
                    const quantity = parseInt(quantityInput.val()) || 0;
                    const safeQuantity = Math.max(
                      0,
                      Math.min(quantity, parseInt($el.data("maxQty")) || 0)
                    );
                    const valuePerUnit =
                      parseFloat($el.data("valuePerUnit")) || 0;
                    const itemName =
                      $el.data("itemName") || `Item ID ${itemId}`;
                    if (safeQuantity > 0 && itemId) {
                      const valueProvided = safeQuantity * valuePerUnit;
                      materialsToUse.push({
                        id: itemId,
                        quantity: safeQuantity,
                        value: valueProvided,
                        name: itemName,
                      });
                      totalValueUsed += valueProvided;
                    }
                  });

                if (totalValueUsed < requiredValue) {
                  ui.notifications.warn(
                    `Insufficient material value provided (${totalValueUsed.toFixed(
                      2
                    )}gp). Requires at least ${requiredValue.toFixed(
                      2
                    )}gp. Please adjust quantities.`
                  );
                  return false;
                } else {
                  await this._attemptCrafting(
                    actor,
                    finalTargetData.targetItemUuid,
                    finalTargetData,
                    materialsToUse,
                    totalValueUsed,
                    requiredValue
                  );
                }
              },
            },
            cancel: {
              icon: '<i class="fas fa-times"></i>',
              label: "Cancel",
              callback: () => {
                ui.notifications.info("Material selection cancelled.");
              },
            },
          },
          default: "craft",
          render: (html) => {
            const craftButton = html
              .closest(".app.dialog")
              ?.querySelector(".dialog-buttons button.craft-button");
            const valueDisplayElement = html.find(".total-value");
            let initialValue = 0;
            if (valueDisplayElement.length > 0) {
              const initialValueText = valueDisplayElement.text() || "0.00 gp";
              initialValue =
                parseFloat(initialValueText.replace(" gp", "")) || 0;
            } else {
            }
            if (craftButton) {
              const disableButton = initialValue < requiredValue;
              craftButton.disabled = disableButton;
            } else {
            }
          },
          close: () => {},
        },
        { width: "600px" }
      ).render(true);
    } catch (error) {
      ui.notifications.error(
        "An error occurred while preparing the material selection dialog. Check console (F12)."
      );
    }
  }

  /**
   * Hook handler for renderCharacterSheetPF2e.
   * Modifies the Inventory and Crafting tabs to add/remove elements and listeners.
   * @param {Application} sheetInstance - The sheet application instance.
   * @param {jQuery} htmlJq - The jQuery object representing the sheet HTML.
   */
  async onRenderCharacterSheet(sheetInstance, htmlJq) {
    const actor = sheetInstance?.actor;
    if (!actor || !htmlJq || htmlJq.length === 0) {
      return;
    }

    this.targetItemCache.clear();

    try {
      this._modifyInventoryTabUI(htmlJq, actor);
      await this._modifyCraftingTabUI(htmlJq, actor);
    } catch (error) {}
  }

  /**
   * Adds the "Identify Magic" button to the inventory controls.
   */
  _addIdentifyButton(controlsContainer, actor) {
    if (controlsContainer.find(".identify-magic-items-button").length === 0) {
      const identifyButtonHtml = `<button type="button" class="identify-magic-items-button" data-tooltip-content="Identify unidentified items.">
                                          <i class="fas fa-search-plus"></i> Identify Magic Items
                                        </button>`;

      controlsContainer.prepend(identifyButtonHtml);

      controlsContainer
        .off("click.identifyMagic", ".identify-magic-items-button")
        .on("click.identifyMagic", ".identify-magic-items-button", (event) => {
          event.preventDefault();
          try {
            this.runIdentifyMagicProcess(actor);
          } catch (err) {
            ui.notifications.error(
              "Failed to run Identify Magic. Check console (F12)."
            );
          }
        });
    } else {
    }
  }

  /**
   * Adds the "Reverse Engineer" button to the crafting controls.
   */
  _addReverseEngineerButton(controlsContainer, actor) {
    if (controlsContainer.find(".reverse-engineer-button").length === 0) {
      const reverseEngButtonHtml = `<button type="button" class="reverse-engineer-button" data-tooltip-content="Attempt to learn a formula by disassembling an item.">
                                            <i class="fas fa-wrench"></i> Reverse Engineer
                                          </button>`;

      controlsContainer.append(reverseEngButtonHtml);

      controlsContainer
        .off("click.reverseEngineer", ".reverse-engineer-button")
        .on("click.reverseEngineer", ".reverse-engineer-button", (event) => {
          event.preventDefault();
          try {
            this.handleReverseEngineering(actor);
          } catch (err) {
            ui.notifications.error(
              "Reverse Engineering Error. Check console (F12)."
            );
          }
        });
    } else {
    }
  }

  /**
   * Modifies the Inventory tab UI.
   */
  _modifyInventoryTabUI(htmlJq, actor) {
    const inventoryTab = htmlJq.find(".tab.inventory");

    if (inventoryTab.length > 0) {
      const controlsContainerSelector = ".inventory-controls";
      let controlsContainer = inventoryTab.find(controlsContainerSelector);

      if (controlsContainer.length === 0) {
        const insertPoint = inventoryTab
          .find(".inventory-list, .inventory-sections")
          .first();
        if (insertPoint.length > 0) {
          const controlsDiv = $(
            '<div class="inventory-controls" style="display: flex; justify-content: flex-end; gap: 5px; margin-bottom: 5px; flex-wrap: wrap;"></div>'
          );
          insertPoint.before(controlsDiv);
          controlsContainer = controlsDiv;
        } else {
        }
      }

      if (controlsContainer.length > 0) {
        this._addIdentifyButton(controlsContainer, actor);
        const existingREButton = controlsContainer.find(
          ".reverse-engineer-button"
        );
        if (existingREButton.length > 0) {
          existingREButton.remove();
        }
      } else {
      }
    } else {
    }
  }

  /**
   * Modifies the Crafting tab UI.
   * Adds a "Relevant Crafting Feats" section.
   * Adds the Reverse Engineer button.
   * Removes default free crafting toggle and quantity inputs/headers.
   * Intercepts formula craft buttons to check requirements and run custom logic.
   */
  async _modifyCraftingTabUI(htmlJq, actor) {
    const craftTab = htmlJq.find(".tab.crafting");

    if (craftTab.length > 0) {
      try {
        const allActorFeats = actor.itemTypes.feat;

        const relevantFeats = allActorFeats.filter((feat) =>
          this.CRAFTING_FEAT_SLUGS.has(feat.slug)
        );

        relevantFeats.sort((a, b) => a.name.localeCompare(b.name));

        let featListHtml = "";
        if (relevantFeats.length > 0) {
          const featListItemPromises = relevantFeats.map(async (feat) => {
            const enrichedLink = await TextEditor.enrichHTML(
              `@UUID[${feat.uuid}]{${feat.name}}`
            );
            return `<li style="display: flex; align-items: center; margin-bottom: 3px; line-height: 1.2;">
                       <img src="${feat.img}" title="${feat.name}" width="16" height="16" style="margin-right: 5px; border: none; flex-shrink: 0; vertical-align: middle;">
                       ${enrichedLink}
                     </li>`;
          });

          const resolvedFeatListItems = await Promise.all(featListItemPromises);

          featListHtml = resolvedFeatListItems.join("");
        } else {
          featListHtml = `<li style="color: #666; font-style: italic;">None</li>`;
        }

        const featsSectionHtml = `
          <div class="relevant-crafting-feats" style="border: 1px solid var(--color-border-light-tertiary); border-radius: 3px; padding: 8px 12px; margin-bottom: 10px; background-color: rgba(0,0,0,0.02);">
            <h3 style="margin: 0 0 5px 0; padding-bottom: 3px; border-bottom: 1px solid var(--color-border-light-divider); font-size: 1.1em; font-weight: bold; color: var(--color-text-dark-primary);">
              <i class="fas fa-star" style="margin-right: 5px; color: var(--color-text-dark-secondary);"></i>Crafting Feats
            </h3>
            <ul style="list-style: none; margin: 0; padding: 0; font-size: 0.95em;">
              ${featListHtml}
            </ul>
          </div>
        `;

        craftTab.find(".relevant-crafting-feats").remove();
        craftTab.prepend(featsSectionHtml);
      } catch (featError) {}

      const formulasHeader = craftTab.find(".known-formulas header");

      if (formulasHeader.length > 0) {
        let craftControls = formulasHeader.find("div.controls");
        if (craftControls.length === 0) {
          const controlsDiv = $(
            '<div class="controls" style="display: flex; gap: 0.25rem;"></div>'
          );
          formulasHeader.append(controlsDiv);
          craftControls = controlsDiv;
        }

        if (craftControls.length > 0) {
          this._addReverseEngineerButton(craftControls, actor);
        } else {
        }

        const freeCraftingButton = formulasHeader.find(
          'button[data-action="toggle-free-crafting"]'
        );
        if (freeCraftingButton.length > 0) {
          freeCraftingButton.remove();
        } else {
        }
      } else {
      }

      const quantityHeader = craftTab.find(
        ".formula-level-header .formula-quantity-header"
      );
      if (quantityHeader.length > 0) {
        quantityHeader.remove();
      } else {
      }

      const quantityInputsToModify = craftTab.find(
        '.formula-item:not([data-ability="advanced-alchemy"]) .quantity'
      );
      if (quantityInputsToModify.length > 0) {
        quantityInputsToModify.remove();
      } else {
      }

      const actorFeats = actor.itemTypes.feat;
      const hasMagicalCraftingFeat = actorFeats.some(
        (f) => f.slug === this.config.MAGICAL_CRAFTING_FEAT_SLUG
      );
      const hasAlchemicalCraftingFeat = actorFeats.some(
        (f) => f.slug === this.config.ALCHEMICAL_CRAFTING_FEAT_SLUG
      );

      const formulaListItems = craftTab.find(
        ".item-list li.item[data-item-uuid]"
      );

      const processingPromises = formulaListItems
        .get()
        .map(async (liElement) => {
          const $li = $(liElement);
          $li.find(".crafting-feat-warning").remove();

          const formulaUuid = $li.data("itemUuid");
          const craftButton = $li.find('button[data-action="craft-item"]');

          if (!formulaUuid || craftButton.length === 0) {
            return;
          }

          craftButton.off("click.customCrafting");
          craftButton.prop("disabled", false).removeAttr("title");

          try {
            const formulaDataInActor = actor.system.crafting?.formulas?.find(
              (f) => f.uuid === formulaUuid
            ) ?? { uuid: formulaUuid };
            const targetItem = await this.findTargetItemForFormula(
              formulaDataInActor
            );

            if (!targetItem) {
              craftButton
                .prop("disabled", true)
                .attr("title", "Could not load item details.");
              return;
            }

            let missingFeatSlug = null;
            let missingFeatName = "";
            const itemTraits = targetItem.system?.traits?.value ?? [];
            const isMagical = itemTraits.includes("magical");
            const isAlchemical = itemTraits.includes("alchemical");

            if (isMagical && !hasMagicalCraftingFeat) {
              missingFeatSlug = this.config.MAGICAL_CRAFTING_FEAT_SLUG;
              missingFeatName = "Magical Crafting";
            } else if (isAlchemical && !hasAlchemicalCraftingFeat) {
              missingFeatSlug = this.config.ALCHEMICAL_CRAFTING_FEAT_SLUG;
              missingFeatName = "Alchemical Crafting";
            }

            if (missingFeatSlug) {
              const warningIconHtml = `<span class="crafting-feat-warning" title="Requires ${missingFeatName} feat" style="color: red; margin-left: 5px; cursor: help;"><i class="fas fa-exclamation-triangle"></i></span>`;
              const nameElement = $li
                .find(".item-name h4, .item-name .action-name")
                .first();
              if (nameElement.length > 0) {
                nameElement.append(warningIconHtml);
              } else {
                $li.find(".item-controls").prepend(warningIconHtml);
              }
              craftButton
                .prop("disabled", true)
                .attr("title", `Requires ${missingFeatName} feat`);
            } else {
              craftButton.on("click.customCrafting", (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.handleCustomCraftingIntercept(actor, event).catch(
                  (error) => {
                    ui.notifications.error(
                      "An error occurred during crafting initiation. Check console (F12)."
                    );
                  }
                );
              });
            }
          } catch (err) {
            craftButton
              .prop("disabled", true)
              .attr("title", "Error processing formula details.");
            const errorIconHtml = `<span class="crafting-feat-warning" title="Error processing formula details: ${err.message}" style="color: darkorange; margin-left: 5px; cursor: help;"><i class="fas fa-bug"></i></span>`;
            $li
              .find(".item-name h4, .item-name .action-name")
              .first()
              .append(errorIconHtml);
          }
        });

      await Promise.allSettled(processingPromises);
    } else {
    }
  }

// Inside your SimplifiedCraftingModule class

  initialize() {
    Hooks.once("ready", () => {
      // Other ready tasks...
      this.registerChatListeners();
    });

    Hooks.on("renderCharacterSheetPF2e", (app, html) =>
      this.onRenderCharacterSheet(app, html)
    );
    // Other hooks...
  }

  registerChatListeners() {
    // Ensure this listener is only active for GMs to prevent errors/abuse
    if (!game.user.isGM) {
      return;
    }

    Hooks.on('renderChatMessage', (chatMessage, html, messageData) => {
        // Check if the message was flagged by your module as a time advance suggestion
        if (chatMessage.flags && chatMessage.flags[this.moduleId]?.type === 'timeAdvanceSuggestion') {
            const advanceSCButton = html.find(`button[data-action="module-advance-sc-time"]`);
            if (advanceSCButton.length) {
                advanceSCButton.on('click', (event) => {
                    const button = event.currentTarget;
                    const timeData = {
                        hour: parseInt(button.dataset.hours),
                        minute: parseInt(button.dataset.minutes),
                        second: parseInt(button.dataset.seconds),
                        reason: button.dataset.reason
                    };
                    this._gmAdvanceSimpleCalendarTime(timeData);
                    // Optionally disable or change the button after click
                    $(button).text('SC Time Advanced').prop('disabled', true);
                });
            }

            const advanceCoreButton = html.find(`button[data-action="module-advance-core-time"]`);
            if (advanceCoreButton.length) {
                advanceCoreButton.on('click', (event) => {
                    const button = event.currentTarget;
                    const timeData = {
                        seconds: parseInt(button.dataset.seconds),
                        reason: button.dataset.reason
                    };
                    this._gmAdvanceCoreTime(timeData);
                    $(button).text('Core Time Advanced').prop('disabled', true);
                });
            }
        }
    });
  }



}

try {
  if (!window.simplifiedCrafting) {
    window.simplifiedCrafting = new SimplifiedCraftingModule();
    if (typeof window.simplifiedCrafting.initialize === "function") {
      window.simplifiedCrafting.initialize();
    } else {
    }
  } else {
  }
} catch (error) {}
