import { GameCard, MatchObject, MatchPlayer } from './types'

// Registry shape

export type AbilityEvent = { type: string, [key: string]: unknown }

type AbilityEffect = (
    match: MatchObject,
    caster: GameCard,
    player: MatchPlayer,
    opponent: MatchPlayer
) => AbilityEvent[]

// Maps the ability `name` stored in the database to its runtime effect.
// Adding a new ability only requires a new entry here — no other file needs to change.
const registry: Record<string, AbilityEffect> = {

    // Deal 1 damage to every enemy minion on the table.
    venomous_bite: (match, caster, player, opponent) => {
        const events: AbilityEvent[] = []
        for (const card of opponent.table_cards) {
            card.life -= 1
            events.push({ type: 'card_damaged', uuid: card.uuid, damage: 1, source: caster.uuid })
        }
        opponent.table_cards = opponent.table_cards.filter(c => c.life > 0)
        return events
    },

    // Draw a card (card draw from the deck is handled by the server; this just signals intent).
    arcane_draw: (match, caster, player, opponent) => [
        { type: 'draw_card', player_id: player.id, count: 1 }
    ],

    // Heal your life target (hero / soul vessel / life pool) by 3.
    healing_aura: (match, caster, player, opponent) => {
        if (player.hero_card) {
            player.hero_card.life = Math.min(player.hero_card.life + 3, 30)
            return [{ type: 'hero_healed', player_id: player.id, amount: 3 }]
        }
        if (player.soul_vessel_life !== undefined) {
            player.soul_vessel_life = Math.min(player.soul_vessel_life + 3, 20)
            return [{ type: 'soul_vessel_healed', player_id: player.id, amount: 3 }]
        }
        if (player.life_pool !== undefined) {
            player.life_pool = Math.min(player.life_pool + 3, 30)
            return [{ type: 'life_pool_healed', player_id: player.id, amount: 3 }]
        }
        return []
    },

    // Deal 2 damage to one random enemy minion.
    shadow_bolt: (match, caster, player, opponent) => {
        const targets = opponent.table_cards
        if (targets.length === 0) return []
        const target = targets[Math.floor(Math.random() * targets.length)]
        target.life -= 2
        const events: AbilityEvent[] = [{ type: 'card_damaged', uuid: target.uuid, damage: 2, source: caster.uuid }]
        if (target.life <= 0) {
            opponent.table_cards = opponent.table_cards.filter(c => c.uuid !== target.uuid)
            events.push({ type: 'card_died', uuid: target.uuid, owner_id: opponent.id })
        }
        return events
    },

    // Gain +1 attack for each other friendly minion already on the table.
    pack_mentality: (match, caster, player, opponent) => {
        const alliesOnTable = player.table_cards.filter(c => c.uuid !== caster.uuid).length
        caster.attack_damage += alliesOnTable
        return [{ type: 'card_buffed', uuid: caster.uuid, attack_bonus: alliesOnTable, life_bonus: 0 }]
    },

    // Give all OTHER friendly minions +1/+1.
    warchief_cry: (match, caster, player, opponent) => {
        const events: AbilityEvent[] = []
        for (const card of player.table_cards) {
            if (card.uuid === caster.uuid) continue
            card.attack_damage += 1
            card.life += 1
            card.max_life += 1
            events.push({ type: 'card_buffed', uuid: card.uuid, attack_bonus: 1, life_bonus: 1 })
        }
        return events
    },

    // Destroy the weakest enemy minion (lowest current life).
    assassinate: (match, caster, player, opponent) => {
        if (opponent.table_cards.length === 0) return []
        const weakest = opponent.table_cards.reduce((min, c) => c.life < min.life ? c : min, opponent.table_cards[0])
        opponent.table_cards = opponent.table_cards.filter(c => c.uuid !== weakest.uuid)
        return [{ type: 'card_died', uuid: weakest.uuid, owner_id: opponent.id, cause: 'assassinate' }]
    },

    // Give THIS card +2/+2.
    battle_hardened: (match, caster, player, opponent) => {
        caster.attack_damage += 2
        caster.life += 2
        caster.max_life += 2
        return [{ type: 'card_buffed', uuid: caster.uuid, attack_bonus: 2, life_bonus: 2 }]
    },

    // Deal 1 damage to the opponent's life target (hero / vessel / life pool).
    spirit_sting: (match, caster, player, opponent) => {
        const events: AbilityEvent[] = []
        if (opponent.hero_card) {
            opponent.hero_card.life -= 1
            events.push({ type: 'hero_damaged', player_id: opponent.id, amount: 1, source: caster.uuid })
        } else if (opponent.soul_vessel_life !== undefined) {
            opponent.soul_vessel_life -= 1
            events.push({ type: 'soul_vessel_damaged', player_id: opponent.id, amount: 1, source: caster.uuid })
        } else if (opponent.life_pool !== undefined) {
            opponent.life_pool -= 1
            events.push({ type: 'life_pool_damaged', player_id: opponent.id, amount: 1, source: caster.uuid })
        }
        return events
    },

    // Restore this card to full health when played.
    regenerate: (match, caster, player, opponent) => {
        caster.life = caster.max_life
        return [{ type: 'card_healed', uuid: caster.uuid, amount: caster.max_life }]
    },

    // Colossal passive: restore 2 health at the start of each owner's turn.
    // Triggered in endTurnAndStartNext, not during on_play resolution.
    colossal_regen: () => [],

    // Titan split: handled in damage resolution logic, not as a generic ability.
    titan_split: () => [],
}

// Public API

export function triggerAbilities(
    trigger: 'on_play' | 'in_hand' | 'passive',
    card: GameCard,
    match: MatchObject,
    player: MatchPlayer,
    opponent: MatchPlayer,
    silenced = false
): AbilityEvent[] {
    if (!card.abilities || silenced) return []
    const events: AbilityEvent[] = []
    for (const ability of card.abilities) {
        if (ability.trigger !== trigger) continue
        const effect = registry[ability.name]
        if (effect) {
            events.push(...effect(match, card, player, opponent))
            events.unshift({ type: 'ability_triggered', uuid: card.uuid, ability_name: ability.name })
        }
    }
    return events
}