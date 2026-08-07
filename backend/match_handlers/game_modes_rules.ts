import { MatchObject, MatchPlayer, MoveRequest, GameMode, MoveAction, RitualSpellName } from '../types'
import { MINOR_RITUAL_ENERGY_THRESHOLD, ACTION_DIE_MINIMUM_ATTACK, ACTION_DIE_MINIMUM_ATTACK_VALUE, ACTION_DIE_SKIP_ATTACKS } from './mode_constants'

type ValidationResult = { ok: boolean, message: string }
type Validator = (match: MatchObject, requestingPlayer: MatchPlayer, opponent: MatchPlayer, request: MoveRequest) => ValidationResult

const pass: ValidationResult = { ok: true, message: null }
const fail = (message: string): ValidationResult => ({ ok: false, message: message })



const isTurn: Validator = (match, requestingPlayer, opponent, request) => match[match.current_turn_player].id === requestingPlayer.id ? pass : fail("It's not your turn")



const cardInHand: Validator = (match, requestingPlayer, opponent, request) => {
    if (!request.card_uuid) return fail('No card specified')

    return requestingPlayer.hand_cards.some(card => card.uuid === request.card_uuid) ? pass : fail('Card not found in your hand')
}



const hasMana: Validator = (match, requestingPlayer, opponent, request) => {
    const card = requestingPlayer.hand_cards.find(card => card.uuid === request.card_uuid)
    const cardManaCost = card.mana_cost + card.mana_cost_modifiers.reduce((total, modifier) => total + modifier.value, 0)

    if (!card) return fail('Card not found')

    return requestingPlayer.mana_level >= cardManaCost ? pass : fail(`Not enough mana (need ${cardManaCost}, have ${requestingPlayer.mana_level})`)
}



const boardLimit = (max: number): Validator => (match, requestingPlayer, opponent, request) => {
    const minionsCount = requestingPlayer.table_cards.filter(card => !card.is_master && !card.is_hero)

    return minionsCount.length < max ? pass : fail(`Board is full (max ${max} minions)`)
}



const attackerOnBoard: Validator = (match, requestingPlayer, opponent, request) => {
    if (!request.card_uuid) return fail('No attacker specified')

    return requestingPlayer.table_cards.some(card => card.uuid === request.card_uuid) ? pass : fail('Attacking card is not on the board')
}



const attackerCanAttack: Validator = (match, requestingPlayer, opponent, request) => {
    const card = requestingPlayer.table_cards.find(card => card.uuid === request.card_uuid)

    return card.can_attack ? pass : fail('This card cannot attack yet (summoning sickness or already attacked this turn)')
}



const hasTargetUuid: Validator = (match, requestingPlayer, opponent, request) => request.target_uuid ? pass : fail('No target specified')



const targetExistsOnOpponentBoard: Validator = (match, requestingPlayer, opponent, request) => {
    return opponent.table_cards.some(card => card.uuid === request.target_uuid) ? pass : fail('Target card not found on opponent board')
}



const defensiveMustBeTargetedFirst: Validator = (match, requestingPlayer, opponent, request) => {
    const defensive = opponent.table_cards.filter(card => card.classes.some(cardClass => cardClass.name === 'defensive'))

    return defensive.length === 0 ? pass : fail('Must destroy defensive minions before targeting others')
}



const opponentHasLifePool: Validator = (match, requestingPlayer, opponent, request) => {
    return opponent.life_pool !== undefined ? pass : fail('No life pool to attack in this mode')
}



const cardCanBeSacrificed: Validator = (match, requestingPlayer, opponent, request) => {
    const card = requestingPlayer.hand_cards.find(card => card.uuid === request.card_uuid)
    if (!card) return fail('Card not found in hand')
    return card.mana_cost > 0 ? pass : fail('Cards with 0 mana cost cannot be sacrificed')
}



const ritualEnergyIsFull: Validator = (match, requestingPlayer, opponent, request) => {
    return requestingPlayer.ritual_energy < 32 ? pass : fail('Your ritual energy is already full')
}



const hasMinimumEnergy: Validator = (match, requestingPlayer, opponent, request) => {
    return requestingPlayer.ritual_energy >= MINOR_RITUAL_ENERGY_THRESHOLD ? pass : fail(`You need an energy level of at least ${MINOR_RITUAL_ENERGY_THRESHOLD} to cast a spell`)
}



const cardInHandForHeroSelection: Validator = (match, requestingPlayer, opponent, request) => {
    if (!request.card_uuid) return fail('No card specified')
    return requestingPlayer.hand_cards.some(card => card.uuid === request.card_uuid) ? pass : fail('Card not found in your hand')
}



const onlyOneCardConstraint: Validator = (match, requestingPlayer, opponent, request) => {
    return !match.one_card_constraint_used ? pass : fail('The Action Die is allowing to throw only one minion')
}



const belowAttackDamageConstraint: Validator = (match, requestingPlayer, opponent, request) => {
    const card = requestingPlayer.table_cards.find(card => card.uuid === request.card_uuid)

    if (match.action_die === ACTION_DIE_MINIMUM_ATTACK) {
        card.attack_damage >= ACTION_DIE_MINIMUM_ATTACK_VALUE ? pass : fail(`The Action Die is allowing only minions with ${ACTION_DIE_MINIMUM_ATTACK_VALUE} or higher damage to attack`)
    }
    else {
        return pass
    }
}



const skipAttacksConstraint: Validator = (match, requestingPlayer, opponent, request) => {
    return match.action_die !== ACTION_DIE_SKIP_ATTACKS ? pass : fail('The Action Die is not allowing to attack enemies')
}

// main dispatch

const rules: Partial<Record<`${GameMode}:${MoveAction}`, Validator[]>> = {
    'classic:throw_onto_table': [isTurn, cardInHand, hasMana, boardLimit(7)],
    'classic:attack_minion': [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard, defensiveMustBeTargetedFirst],
    'classic:end_turn': [isTurn],
    'classic:choose_hero_minion': [cardInHandForHeroSelection],

    'destiny:throw_onto_table': [isTurn, cardInHand, hasMana, onlyOneCardConstraint, boardLimit(7)],
    'destiny:attack_minion': [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard, skipAttacksConstraint, belowAttackDamageConstraint, defensiveMustBeTargetedFirst],
    'destiny:end_turn': [isTurn],
    'destiny:choose_hero_minion': [cardInHandForHeroSelection],

    'chaos:throw_onto_table': [isTurn, cardInHand, hasMana, boardLimit(6)],
    'chaos:attack_minion': [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard],
    'chaos:end_turn': [isTurn],

    'ritual:throw_onto_table': [isTurn, cardInHand, hasMana, boardLimit(8)],
    'ritual:attack_minion': [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard, defensiveMustBeTargetedFirst],
    'ritual:end_turn': [isTurn],
    'ritual:sacrifice_card': [isTurn, cardInHand, cardCanBeSacrificed, ritualEnergyIsFull],
    'ritual:cast_ritual_spell': [isTurn, hasMinimumEnergy],

    'dungeon_run:throw_onto_table': [isTurn, cardInHand, hasMana, boardLimit(7)],
    'dungeon_run:attack_minion': [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard, defensiveMustBeTargetedFirst],
    'dungeon_run:end_turn': [isTurn],
    'dungeon_run:choose_hero_minion': [cardInHandForHeroSelection],

    'eclipse:throw_onto_table': [isTurn, cardInHand, hasMana, boardLimit(7)],
    'eclipse:attack_minion': [isTurn, attackerOnBoard, attackerCanAttack, hasTargetUuid, targetExistsOnOpponentBoard],
    'eclipse:attack_life_pool': [isTurn, attackerOnBoard, attackerCanAttack, opponentHasLifePool, defensiveMustBeTargetedFirst],
    'eclipse:end_turn': [isTurn],
}



export function validateAction(match: MatchObject, requestingPlayer: MatchPlayer, opponent: MatchPlayer, request: MoveRequest): ValidationResult {
    const key = `${match.mode}:${request.action}` as `${GameMode}:${MoveAction}`
    const validators = rules[key]

    if (!validators) return fail(`Action "${request.action}" is not valid in mode "${match.mode}"`)

    for (const validator of validators) {
        const result = validator(match, requestingPlayer, opponent, request)
        if (!result.ok) return result
    }

    return pass
}