import { MODULE_ID, SETTINGS } from "./constants.js";
import { getSetting } from "./settings.js";


export class Utils {
    constructor() {
        this.targetItemCache = new Map();
    }

    determineTargetActors(contextActor) {
        if (contextActor?.isOwner) return [contextActor];
        const c = canvas.tokens.controlled
            .map((t) => t.actor)
            .filter((a) => a?.isOwner);
        if (c.length > 0) return c;
        const u = game.user.character;
        if (u?.isOwner) return [u];
        return null;
    }

    createIdentifyLink(spellId, spellName, spellIconClass) {
        const pack = getSetting(SETTINGS.IDENTIFY_SPELL_COMPENDIUM);
        if (!spellId || !pack) return "";
        return ` <a class="content-link" data-pack="${pack}" data-id="${spellId}" title="Consult ${spellName} Spell"><i class="fas ${spellIconClass} fa-xs"></i></a>`;
    }

    actorHasSpellAvailable(actor, spellSlug) {
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
        } catch (err) { /* Not found by UUID directly */ }

        const potentialTargetName = formulaData.name?.startsWith("Formula: ")
            ? formulaData.name.substring(9).trim()
            : formulaData.name;
        if (!potentialTargetName) return null;

        const compendiumListString = getSetting(SETTINGS.COMPENDIUMS_TO_SEARCH);
        const compendiumsToSearch = compendiumListString.split(',').map(s => s.trim()).filter(s => s);

        for (const packName of compendiumsToSearch) {
            const pack = game.packs.get(packName);
            if (!pack) continue;
            try {
                const index = await pack.getIndex({ fields: ["name", "type"] });
                const entryInIndex = index.find(
                    (entry) => entry.name.toLowerCase() === potentialTargetName.toLowerCase()
                );
                if (entryInIndex) {
                    const tempUuid = `Compendium.${pack.collection}.${entryInIndex._id}`;
                    const tempObject = await fromUuid(tempUuid);
                    if (tempObject) {
                        this.targetItemCache.set(formulaData.uuid, tempObject);
                        return tempObject;
                    }
                }
            } catch (err) {
                console.warn(`${MODULE_ID} | Error searching compendium ${packName}:`, err);
            }
        }
        return null;
    }
}