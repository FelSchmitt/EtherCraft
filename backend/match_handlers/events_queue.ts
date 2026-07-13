import { MatchObject, MatchPlayer, MoveRequest, GameMode, MoveAction, GameCard, ChaosEffectName } from './types'

export type GeneratedEvent = {
    matchProperties: (keyof MatchObject)[]
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

type EventEmitter = (match: MatchObject, queue: GeneratedEvent[], player: MatchPlayer, request: MoveRequest) => GeneratedEvent | void



const triggerAbilities: EventEmitter = (match, queue, player, request) => {
    queue.forEach(event => {
    })
}



const endTurnAndStartNext: EventEmitter = (match, queue, player, request) => {
    switch (match.mode) {
        case 'classic':
            queue.push({ matchProperties: ['current_turn_player'], actionName: 'set', value: match.current_turn_player === 0 ? 1 : 0 })
            break

        case 'destiny':
            queue.push({ matchProperties: ['current_turn_player'], actionName: 'set', value: match.current_turn_player === 0 ? 1 : 0 })
            break

        case 'chaos':
            queue.push({ matchProperties: ['current_turn_player'], actionName: 'set', value: match.current_turn_player === 0 ? 1 : 0 })

            queue.push(
                {
                    matchProperties: ['blood_moon_active', 'mass_confusion_active', 'silence_active', 'surge_active', 'void_rift_active'],
                    actionName: 'set',
                    value: false
                }
            )

            queue.push({ matchProperties: ['chaos_deck'], actionName: 'remove'})

            if ((match.chaos_deck as ChaosEffectName[]).length < 2) {
                queue.push({ matchProperties: ['chaos_deck'], actionName: 'set', value: ['earthquake', 'mass_confusion', 'blood_moon', 'surge', 'silence', 'second_wind', 'the_cull', 'mirror', 'void_rift']})
                queue.push({ matchProperties: ['chaos_deck_exhausted_count'], actionName: 'set', value: (match.chaos_deck_exhausted_count as number) + 1})
                
                if ((match.chaos_deck_exhausted_count as number) >= 2) {
                    queue.push({ matchProperties: ['chaos_draws_per_turn'], actionName: 'set', value: (match.chaos_draws_per_turn as number) + 1})
                }
            }
            break

        case 'ritual':
            queue.push({ matchProperties: ['current_turn_player'], actionName: 'set', value: match.current_turn_player === 0 ? 1 : 0 })
            break

        case 'dungeon_run':
            queue.push({ matchProperties: ['current_turn_player'], actionName: 'set', value: match.current_turn_player === 0 ? 1 : 0 })
            break

        case 'eclipse':
            queue.push({ matchProperties: ['current_turn_player'], actionName: 'set', value: match.current_turn_player === 0 ? 1 : 0 })
            break
    }
}



const addCard: EventEmitter = (match, queue, player, request) => {
    queue.push({ actionName: 'add', matchProperties: ['players'], playerId: player.id, playerProperty: 'table_cards' })
}



const removeCard: EventEmitter = (match, queue, player, request) => {
    queue.push({ actionName: 'remove', matchProperties: ['players'], playerId: player.id, playerProperty: 'hand_cards', cardId: request.card_uuid })
}



const attackCard: EventEmitter = (match, queue, player, request) => {
}



const attackLifePool: EventEmitter = (match, queue, player, request) => {
}



const chooseHeroCard: EventEmitter = (match, queue, player, request) => {
}



const sacrificeCard: EventEmitter = (match, queue, player, request) => {
}



const drawFromChaosDeck: EventEmitter = (match, queue, player, request) => {
}



const applyChaosEffect: EventEmitter = (match, queue, player, request) => {
}



const toggleChaosEffects: EventEmitter = (match, queue, player, request) => {
}



const titanSplit: EventEmitter = (match, queue, player, request) => {
}



const removeDeadCards: EventEmitter = (match, queue, player, request) => {
    match.players.forEach(player => {
        player.table_cards.forEach((card, index) => {
            if (card.life <= 0) {
            }
        })
    })
}



const checkForWinners: EventEmitter = (match, queue, player, request) => {
}



const moveEvents: Partial<Record<`${GameMode}:${MoveAction}`, EventEmitter[]>> = {
    'classic:throw_onto_table': [removeCard, addCard, triggerAbilities],
    'classic:attack_card': [],
    'classic:attack_hero': [],
    'classic:end_turn': [],
    'classic:choose_hero_card': [],

    'destiny:throw_onto_table': [],
    'destiny:attack_card': [],
    'destiny:attack_hero': [],
    'destiny:end_turn': [],
    'destiny:choose_hero_card': [],

    'chaos:throw_onto_defense': [],
    'chaos:throw_onto_master': [],
    'chaos:attack_card': [],
    'chaos:end_turn': [],

    'ritual:throw_onto_table': [],
    'ritual:attack_card': [],
    'ritual:end_turn': [],
    'ritual:sacrifice_card': [],
    'ritual:cast_ritual_spell': [],

    'dungeon_run:throw_onto_table': [],
    'dungeon_run:attack_card': [],
    'dungeon_run:attack_hero': [],
    'dungeon_run:end_turn': [],
    'dungeon_run:choose_hero_card': [],

    'eclipse:throw_onto_table': [],
    'eclipse:attack_card': [],
    'eclipse:attack_life_pool': [],
    'eclipse:end_turn': [],
}

// main dispatch

export function createMatchUpdatesQueue(match: MatchObject, player: MatchPlayer, request: MoveRequest): GeneratedEvent[] {
    const key = `${match.mode}:${request.action}` as `${GameMode}:${MoveAction}`
    const events = moveEvents[key]

    const queue: GeneratedEvent[] = []

    return queue
}