import { MatchObject, MatchPlayer, MoveRequest, GameMode, MoveAction, GameCard, ChaosEffectName } from './types'

export type GeneratedEvent = {
    matchProperty: keyof MatchObject
    playerProperty?: keyof MatchPlayer
    cardProperty?: keyof GameCard
    playerId?: string
    cardId?: string
    targetId?: string
    actionName?: 'set' | 'remove' | 'add' | 'move_to_event'
    moveSteps?: number // if actionName is flagged as 'move_to_event'. Can be negative numbers to move something to a previous event
    value?: any
    action?: () => any
}

type EventEmitter = (match: MatchObject, queue: GeneratedEvent[], requestingPlayer: MatchPlayer, request: MoveRequest) => GeneratedEvent | void



function swapPlayersMinions(match: MatchObject) {
    const player1Cards = match.players[0].table_cards.splice(0)
    const player2Cards = match.players[1].table_cards.splice(0)

    match.players[0].table_cards = player2Cards
    match.players[1].table_cards = player1Cards
}

function swapMasterCardsHealths(match: MatchObject) {
    const player1MasterCards = match.players[0].table_cards.filter(card => card.is_master)
    const player2MasterCards = match.players[1].table_cards.filter(card => card.is_master)
}






const triggerAbilities: EventEmitter = (match, queue, requestingPlayer, request) => {
    queue.forEach(event => {
    })
}



const endTurnAndStartNext: EventEmitter = (match, queue, requestingPlayer, request) => {
    for (const card of requestingPlayer.table_cards) {
        card.can_attack = true
    }

    match.current_turn_player = match.current_turn_player === 0 ? 1 : 0

    const player = match.players[match.current_turn_player]

    player.mana_capacity < 12 && (player.mana_capacity += 1)
    player.mana_level = player.mana_capacity
}



const throwCardOnTable: EventEmitter = (match, queue, requestingPlayer, request) => {
    const card = requestingPlayer.hand_cards.find(card => card.uuid === request.card_uuid) as GameCard

    requestingPlayer.table_cards.push(card)
    requestingPlayer.hand_cards.splice(requestingPlayer.hand_cards.indexOf(card), 1)
    requestingPlayer.mana_level -= card.mana_cost
}



const attackCard: EventEmitter = (match, queue, requestingPlayer, request) => {
    const opponent = match.players[match.current_turn_player === 0 ? 1 : 0]
    const attacker = requestingPlayer.table_cards.find(card => card.uuid === request.card_uuid) as GameCard
    const target = opponent.table_cards.find(card => card.uuid === request.target_uuid) as GameCard
    
    target.life -= attacker.attack_damage + attacker.attack_modifiers.reduce((total, current) => total + current, 0)
    attacker.can_attack = false
}



const resetChaosEffects: EventEmitter = (match, queue, requestingPlayer, request) => {
    if (match.current_chaos_effect === 'mass_confusion') {
        swapPlayersMinions(match)
    }

    else if (match.current_chaos_effect === 'arcane_wind') {
        const player = match.players[match.current_turn_player]

        player.mana_capacity = Math.round(player.mana_capacity / 2)
        player.mana_level > player.mana_capacity && (player.mana_level = player.mana_capacity)
    }

    else if (match.current_chaos_effect === 'void_rift') {
    }

    match.current_chaos_effect = null
}



const applyChaosEffects: EventEmitter = (match, queue, requestingPlayer, request) => {
    const effect = match.chaos_deck?.shift() as ChaosEffectName

    if (effect === 'earthquake') {
        for (const player of match.players) {
            for (const card of player.table_cards) {
                card.life -= 2
            }
        }
    }

    else if (effect === 'mass_confusion') {
        swapPlayersMinions(match)
    }

    else if (effect === 'the_cull') {
        const player1Cards = match.players[0].table_cards.sort((a, b) => a.life - b.life)
        const player2Cards = match.players[1].table_cards.sort((a, b) => a.life - b.life)

        player1Cards.length > 0 && (player1Cards[0].life = 0)
        player2Cards.length > 0 && (player2Cards[0].life = 0)
    }

    else if (effect === 'void_rift') {
    }

    else if (effect === 'arcane_wind') {
        match.players[match.current_turn_player].mana_capacity *= 2
        match.players[match.current_turn_player].mana_level *= 2
    }

    match.current_chaos_effect = effect

    if ((match.chaos_deck as ChaosEffectName[]).length <= 0) {
        const chaosEffects: ChaosEffectName[] = ['earthquake', 'mass_confusion', 'blood_moon', 'surge', 'silence', 'arcane_wind', 'the_cull', 'void_rift']
        const shuffledChaosEffects: ChaosEffectName[] = []

        while (chaosEffects.length > 0) {
            shuffledChaosEffects.push(...chaosEffects.splice(Math.round(Math.random() * chaosEffects.length), 1))
        }

        (match.chaos_deck_exhausted_count as number) += 1
        match.chaos_deck = shuffledChaosEffects

        if ((match.chaos_deck_exhausted_count as number) >= 3) {
            (match.chaos_draws_per_turn as number) += 1
        }
    }
}



const removeDeadCards: EventEmitter = (match, queue, requestingPlayer, request) => {
    match.players.forEach(player => {
        player.table_cards.forEach((card, index) => {
            if (card.life + card.life_modifiers.reduce((total, current) => total + current, 0) <= 0) {
                match.graveyard.push(...player.table_cards.splice(index, 1))
            }
        })
    })
}



const checkForWinner: EventEmitter = (match, queue, requestingPlayer, request) => {
}



const moveEvents: Partial<Record<`${GameMode}:${MoveAction}`, EventEmitter[]>> = {
    'classic:throw_onto_table': [throwCardOnTable],
    'classic:attack_card': [attackCard, removeDeadCards],
    'classic:attack_hero': [attackCard, removeDeadCards],
    'classic:end_turn': [endTurnAndStartNext],
    'classic:choose_hero_card': [],

    'destiny:throw_onto_table': [throwCardOnTable],
    'destiny:attack_card': [attackCard, removeDeadCards],
    'destiny:attack_hero': [attackCard, removeDeadCards],
    'destiny:end_turn': [],
    'destiny:choose_hero_card': [],

    'chaos:throw_onto_table': [throwCardOnTable],
    'chaos:attack_card': [attackCard, removeDeadCards],
    'chaos:end_turn': [resetChaosEffects, endTurnAndStartNext, applyChaosEffects, removeDeadCards],

    'ritual:throw_onto_table': [throwCardOnTable],
    'ritual:attack_card': [attackCard, removeDeadCards],
    'ritual:end_turn': [endTurnAndStartNext],
    'ritual:sacrifice_card': [],
    'ritual:cast_ritual_spell': [],

    'dungeon_run:throw_onto_table': [throwCardOnTable],
    'dungeon_run:attack_card': [attackCard, removeDeadCards],
    'dungeon_run:attack_hero': [attackCard, removeDeadCards],
    'dungeon_run:end_turn': [endTurnAndStartNext],
    'dungeon_run:choose_hero_card': [],

    'eclipse:throw_onto_table': [throwCardOnTable],
    'eclipse:attack_card': [attackCard, removeDeadCards],
    'eclipse:attack_life_pool': [],
    'eclipse:end_turn': [],
}

// main dispatch

export function createMatcheEventsQueue(match: MatchObject, requestingPlayer: MatchPlayer, request: MoveRequest): GeneratedEvent[] {
    const key = `${match.mode}:${request.action}` as `${GameMode}:${MoveAction}`
    const events = moveEvents[key]

    const queue: GeneratedEvent[] = []

    return queue
}