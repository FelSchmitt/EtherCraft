import { MatchObject, MatchPlayer, MoveRequest, GameMode, MoveAction, RitualSpellNames } from './types'

type ValidationResult = { ok: true } | { ok: false, message: string }
type Validator = (match: MatchObject, player: MatchPlayer, request: MoveRequest) => ValidationResult

const pass: ValidationResult = { ok: true }
const fail = (message: string): ValidationResult => ({ ok: false, message: message })

const ritualSpellCosts: Record<RitualSpellNames, number> = {
    bloodbind: 8, ashen_strike: 8,
    soul_harvest: 16, purge: 16, rebirth: 16,
    dark_convergence: 24, summon_from_deep: 24,
    annihilation: 32, necromancy_curse: 32
}



const isTurn: Validator = (match, player, request) => match.players[match.current_turn_player].id === player.id ? pass : fail("It's not your turn")



const cardInHand: Validator = (match, player, request) => {
    if (!request.card_uuid) return fail('No card specified')

    return player.hand_cards.some(card => card.uuid === request.card_uuid) ? pass : fail('Card not found in your hand')
}



const hasMana: Validator = (match, player, request) => {
    const card = player.hand_cards.find(card => card.uuid === request.card_uuid)

    if (!card) return fail('Card not found')

    return player.mana_level >= card.mana_cost ? pass : fail(`Not enough mana (need ${card.mana_cost}, have ${player.mana_level})`)
}



const boardLimit = (max: number): Validator => (match, player, request) => {
    const minionsCount = player.table_cards.filter(card => !card.is_master && !card.is_hero)

    return minionsCount.length < max ? pass : fail(`Board is full (max ${max} minions)`)
}



const attackerOnBoard: Validator = (match, player, request) => {
    if (!request.card_uuid) return fail('No attacker specified')

    return player.table_cards.some(card => card.uuid === request.card_uuid) ? pass : fail('Attacking card is not on the board')
}



const attackerCanAttack: Validator = (match, player, request) => {
    const card = player.table_cards.find(card => card.uuid === request.card_uuid)

    return card.can_attack ? pass : fail('This card cannot attack yet (summoning sickness or already attacked this turn)')
}



const hasTargetUuid: Validator = (match, player, request) => request.target_uuid ? pass : fail('No target specified')



const targetExistsOnOpponentBoard: Validator = (match, player, request) => {
    const opponent = match.players.find(playerToTest => playerToTest.id !== player.id)

    return opponent.table_cards.some(card => card.uuid === request.target_uuid) ? pass : fail('Target card not found on opponent board')
}



const defensiveMustBeTargetedFirst: Validator = (match, player, request) => {
    const opponent = match.players.find(playerToTest => playerToTest.id !== player.id)
    const defensive = opponent.table_cards.filter(card => card.classes.includes('defensive'))

    return defensive.length === 0 ? pass : fail('Must destroy defensive minions before targeting others')
}



const opponentHasLifePool: Validator = (match, player, request) => {
    const opponent = match.players.find(p => p.id !== player.id)
    return opponent.life_pool !== undefined ? pass : fail('No life pool to attack in this mode')
}



const cardCanBeSacrificed: Validator = (match, player, request) => {
    const card = player.hand_cards.find(c => c.uuid === request.card_uuid)
    if (!card) return fail('Card not found in hand')
    return card.mana_cost > 0 ? pass : fail('Cards with 0 mana cost cannot be sacrificed')
}



const canCastRitualSpell: Validator = (match, player, request) => {
    const spell = request.spell_name
    if (!spell) return fail('No spell name specified')
    const cost = ritualSpellCosts[spell]
    if (!cost) return fail(`Unknown ritual spell: "${spell}"`)
    const energy = player.ritual_energy ?? 0
    return energy >= cost ? pass : fail(`Not enough Ritual Energy (need ${cost}, have ${energy})`)
}



const cardInHandForHeroSelection: Validator = (match, player, request) => {
    if (!request.card_uuid) return fail('No card specified')
    return player.hand_cards.some(c => c.uuid === request.card_uuid) ? pass : fail('Card not found in your hand')
}

// main dispatch

const rules: Partial<Record<`${GameMode}:${MoveAction}`, Validator[]>> = {
    'classic:throw_onto_table':  [isTurn, cardInHand, hasMana, boardLimit(7)],
    'classic:attack_minion':       [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard, defensiveMustBeTargetedFirst],
    'classic:end_turn':          [isTurn],
    'classic:choose_hero_minion':  [cardInHandForHeroSelection],

    'destiny:throw_onto_table':  [isTurn, cardInHand, hasMana, boardLimit(7)],
    'destiny:attack_minion':       [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard, defensiveMustBeTargetedFirst],
    'destiny:end_turn':          [isTurn],
    'destiny:choose_hero_minion':  [cardInHandForHeroSelection],

    'chaos:throw_onto_table':    [isTurn, cardInHand, hasMana, boardLimit(6)],
    'chaos:attack_minion':         [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard],
    'chaos:end_turn':            [isTurn],

    'ritual:throw_onto_table':   [isTurn, cardInHand, hasMana, boardLimit(8)],
    'ritual:attack_minion':        [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard, defensiveMustBeTargetedFirst],
    'ritual:end_turn':           [isTurn],
    'ritual:sacrifice_card':     [isTurn, cardInHand, cardCanBeSacrificed],
    'ritual:cast_ritual_spell':  [isTurn, canCastRitualSpell],

    'dungeon_run:throw_onto_table': [isTurn, cardInHand, hasMana, boardLimit(7)],
    'dungeon_run:attack_minion':      [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard, defensiveMustBeTargetedFirst],
    'dungeon_run:end_turn':         [isTurn],
    'dungeon_run:choose_hero_minion': [cardInHandForHeroSelection],

    'eclipse:throw_onto_table':  [isTurn, cardInHand, hasMana, boardLimit(7)],
    'eclipse:attack_minion':       [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard],
    'eclipse:attack_life_pool':  [isTurn, attackerOnBoard, attackerCanAttack, opponentHasLifePool],
    'eclipse:end_turn':          [isTurn],
}



export function validateAction(match: MatchObject, player: MatchPlayer, request: MoveRequest): ValidationResult {
    const key = `${match.mode}:${request.action}` as `${GameMode}:${MoveAction}`
    const validators = rules[key]

    if (!validators) return fail(`Action "${request.action}" is not valid in mode "${match.mode}"`)

    for (const validator of validators) {
        const result = validator(match, player, request)
        if (!result.ok) return result
    }

    return pass
}