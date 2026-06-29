import { MatchObject, MatchPlayer, MoveRequest, GameMode, MoveAction } from './types'

// Types

type ValidationResult = { ok: true } | { ok: false; message: string }
type Validator = (match: MatchObject, player: MatchPlayer, request: MoveRequest) => ValidationResult

const pass: ValidationResult = { ok: true }
const fail = (message: string): ValidationResult => ({ ok: false, message })

// Reusable validators

const isTurn: Validator = (match, player) => match.players[match.current_turn_player].id === player.id ? pass : fail("It's not your turn")



const cardInHand: Validator = (match, player, request) => {
    if (!request.card?.uuid) return fail('No card specified')

    return player.hand_cards.some(card => card.uuid === request.card.uuid) ? pass : fail('Card not found in your hand')
}



const hasMana: Validator = (match, player, request) => {
    const card = player.hand_cards.find(card => card.uuid === request.card?.uuid)

    if (!card) return fail('Card not found')

    return player.mana_level >= card.mana_cost ? pass : fail(`Not enough mana (need ${card.mana_cost}, have ${player.mana_level})`)
}



const boardLimit = (max: number): Validator => (match, player) => {
    // In Chaos, players play into the defense zone
    const zone = player.defense_cards ?? player.table_cards

    return zone.length < max ? pass : fail(`Board is full (max ${max} minions)`)
}



const attackerOnBoard: Validator = (match, player, request) => {
    if (!request.card?.uuid) return fail('No attacker specified')

    const allMinions = [...player.table_cards, ...(player.defense_cards ?? [])]

    return allMinions.some(card => card.uuid === request.card!.uuid) ? pass : fail('Attacking card is not on the board')
}



const attackerCanAttack: Validator = (match, player, request) => {
    const allMinions = [...player.table_cards, ...(player.defense_cards ?? [])]

    const card = allMinions.find(card => card.uuid === request.card?.uuid)

    return card?.can_attack ? pass : fail('This card cannot attack yet (summoning sickness or already attacked this turn)')
}



const hasTargetUuid: Validator = (match, player, request) => request.target_uuid ? pass : fail('No target specified')



const targetExistsOnOpponentBoard: Validator = (match, player, request) => {
    const opponent = match.players.find(p => p.id !== player.id)

    const all = [...opponent.table_cards, ...(opponent.defense_cards ?? []), ...(opponent.master_cards ?? [])]

    return all.some(card => card.uuid === request.target_uuid) ? pass : fail('Target card not found on opponent board')
}


// If the opponent has any Defensive-class minions, the attacker must target one.
const defensiveMustBeTargetedFirst: Validator = (match, player, request) => {
    const opponent = match.players.find(p => p.id !== player.id)!
    const defensive = opponent.table_cards.filter(c => c.classes.includes('defensive'))
    if (defensive.length === 0) return pass
    const target = opponent.table_cards.find(c => c.uuid === request.target_uuid)
    return target?.classes.includes('defensive')
        ? pass
        : fail('Must attack Defensive minions before targeting other cards')
}



const opponentHasHero: Validator = (match, player) => {
    const opponent = match.players.find(p => p.id !== player.id)!
    return opponent.hero_card ? pass : fail('Opponent has no hero card')
}


// Hero can only be attacked when NO defensive minions stand in the way.
const noDefensivesBlockingHero: Validator = (match, player) => {
    const opponent = match.players.find(p => p.id !== player.id)!
    const defensive = opponent.table_cards.filter(c => c.classes.includes('defensive'))
    return defensive.length === 0
        ? pass
        : fail('You must destroy all Defensive minions before attacking the hero')
}



const opponentHasLifePool: Validator = (match, player) => {
    const opponent = match.players.find(p => p.id !== player.id)!
    return opponent.life_pool !== undefined
        ? pass
        : fail('No life pool to attack in this mode')
}



const cardCanBeSacrificed: Validator = (match, player, request) => {
    const card = player.hand_cards.find(c => c.uuid === request.card?.uuid)
    if (!card) return fail('Card not found in hand')
    return card.mana_cost > 0
        ? pass
        : fail('Cards with 0 mana cost cannot be sacrificed')
}



const RITUAL_SPELL_COSTS: Record<string, number> = {
    bloodbind: 5, ashen_strike: 5,
    soul_harvest: 12, purge: 12, rebirth: 12,
    dark_convergence: 22, summon_from_deep: 22,
    annihilation: 35, necromancy_curse: 35,
}



const canCastRitualSpell: Validator = (match, player, request) => {
    const spell = request.spell_name
    if (!spell) return fail('No spell name specified')
    const cost = RITUAL_SPELL_COSTS[spell]
    if (cost === undefined) return fail(`Unknown ritual spell: "${spell}"`)
    const energy = player.ritual_energy ?? 0
    return energy >= cost
        ? pass
        : fail(`Not enough Ritual Energy (need ${cost}, have ${energy})`)
}



const cardInHandForHeroSelection: Validator = (match, player, request) => {
    if (!request.card?.uuid) return fail('No card specified')
    return player.hand_cards.some(c => c.uuid === request.card!.uuid)
        ? pass
        : fail('Card not found in your hand')
}

// Ruleset table

// Keyed as "<mode>:<action>". Adding support for a new mode or action only
// requires a new entry here — no other file needs to change.
const rules: Partial<Record<`${GameMode}:${MoveAction}`, Validator[]>> = {
    // Classic
    'classic:throw_onto_table':  [isTurn, cardInHand, hasMana, boardLimit(7)],
    'classic:attack_card':       [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard, defensiveMustBeTargetedFirst],
    'classic:attack_hero':       [isTurn, attackerOnBoard, attackerCanAttack, opponentHasHero, noDefensivesBlockingHero],
    'classic:end_turn':          [isTurn],
    'classic:choose_hero_card':  [cardInHandForHeroSelection],

    // Destiny
    'destiny:throw_onto_table':  [isTurn, cardInHand, hasMana, boardLimit(7)],
    'destiny:attack_card':       [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard, defensiveMustBeTargetedFirst],
    'destiny:attack_hero':       [isTurn, attackerOnBoard, attackerCanAttack, opponentHasHero, noDefensivesBlockingHero],
    'destiny:end_turn':          [isTurn],
    'destiny:choose_hero_card':  [cardInHandForHeroSelection],

    // Chaos
    // No hero cards. Defense zone blocks master zone. Defensive class has no
    // special meaning here (the whole defense zone functions as the blocker).
    'chaos:throw_onto_table':    [isTurn, cardInHand, hasMana, boardLimit(6)],
    'chaos:attack_card':         [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard],
    'chaos:end_turn':            [isTurn],

    // Ritual
    // No hero cards. Soul Vessel can only be damaged by spells, not minions.
    'ritual:throw_onto_table':   [isTurn, cardInHand, hasMana, boardLimit(8)],
    'ritual:attack_card':        [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard, defensiveMustBeTargetedFirst],
    'ritual:end_turn':           [isTurn],
    'ritual:sacrifice_card':     [isTurn, cardInHand, cardCanBeSacrificed],
    'ritual:cast_ritual_spell':  [isTurn, canCastRitualSpell],

    // Dungeon Run
    'dungeon_run:throw_onto_table': [isTurn, cardInHand, hasMana, boardLimit(7)],
    'dungeon_run:attack_card':      [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard, defensiveMustBeTargetedFirst],
    'dungeon_run:attack_hero':      [isTurn, attackerOnBoard, attackerCanAttack, opponentHasHero, noDefensivesBlockingHero],
    'dungeon_run:end_turn':         [isTurn],
    'dungeon_run:choose_hero_card': [cardInHandForHeroSelection],

    // Eclipse
    // No hero cards. Every minion attacks the life pool directly.
    // Defensive class has no gameplay effect in this mode.
    'eclipse:throw_onto_table':  [isTurn, cardInHand, hasMana, boardLimit(7)],
    'eclipse:attack_card':       [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard],
    'eclipse:attack_life_pool':  [isTurn, attackerOnBoard, attackerCanAttack, opponentHasLifePool],
    'eclipse:end_turn':          [isTurn],
}

// Public API

export function validateAction(match: MatchObject, player: MatchPlayer, request: MoveRequest): ValidationResult {
    const key = `${match.mode}:${request.action}` as `${GameMode}:${MoveAction}`
    const validators = rules[key]

    if (!validators) {
        return fail(`Action "${request.action}" is not valid in mode "${match.mode}"`)
    }

    for (const validator of validators) {
        const result = validator(match, player, request)
        if (!result.ok) return result
    }

    return pass
}

// Kept for backward compat — server.ts previously imported this symbol.
export const moveRulesList = rules