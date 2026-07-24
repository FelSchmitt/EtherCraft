import { MatchObject, MatchPlayer, MoveRequest, GameMode, MoveAction, GameCard, ChaosEffectName } from '../types'

export type GeneratedEvent = {
    matchProperty: keyof MatchObject
    playerProperty?: keyof MatchPlayer
    cardProperty?: keyof GameCard
    playerId?: string
    cardId?: string
    targetId?: string
    actionName?: 'set' | 'remove' | 'add' | 'move_to_event'
    moveSteps?: number
    value?: any
    action?: () => any
}

type EventEmitter = (match: MatchObject, queue: GeneratedEvent[], requestingPlayer: MatchPlayer, opponent: MatchPlayer, request: MoveRequest) => GeneratedEvent | void

// per-mode constants
const DEFAULT_MANA_INCREASE = 1
const MAX_MANA_CAPACITY = 12

export const ACTION_DIE_LESS_MANA_COST = 2
export const ACTION_DIE_MANA_DISCOUNT = 1
const ACTION_DIE_ONE_CARD = 1
const ACTION_DIE_EXTRA_CARD = 4
const ACTION_DIE_DOUBLE_DAMAGE = 5
const FATE_DIE_MISS_CHANCE = 1
const FATE_DIE_DOUBLE_DAMAGE_CHANCE = 3
const FATE_DIE_CHAIN_DAMAGE = 4
const REVERSAL_COIN_TURNS_INTERVAL = 3
const FAVORABLE_STREAK_MIN_NUMBER = 4

const CHAOS_DECK_EXHAUSTION_THRESHOLD = 3
const CHAOS_EARTHQUAKE_DAMAGE = 2
const CHAOS_BLOOD_MOON_MINIONS_DAMAGE = 1
const CHAOS_SURGE_ATTACK_BONUS = 2

export const MINOR_RITUAL_ENERGY_THRESHOLD = 8
const MODERATE_RITUAL_ENERGY_THRESHOLD = 16
const MAJOR_RITUAL_ENERGY_THRESHOLD = 24
const GRAND_RITUAL_ENERGY_THRESHOLD = 32
const MINOR_RITUAL_DAMAGE = 3
const MODERATE_RITUAL_DAMAGE = 6
const MAJOR_RITUAL_DAMAGE = 8
const GRAND_RITUAL_DAMAGE = 10

const ECLIPSE_RESET_TURNS_DISCOUNT = 2
const ECLIPSE_PHASE_DAMAGE = 2
const ECLIPSE_PHASE_EMPTY_BOARD_DAMAGE = 3
const ECLIPSE_PHASE_ENTERED_EMPTY_BOARD_DAMAGE = 4
const ECLIPSE_TIMER_MIN_TURNS = 2



function swapPlayersMinions(match: MatchObject) {
    const player1Cards = match.player1.table_cards.splice(0)
    const player2Cards = match.player2.table_cards.splice(0)

    match.player1.table_cards = player2Cards
    match.player2.table_cards = player1Cards
}

function swapMasterMinionsHealths(match: MatchObject) {
    const player1MasterCards = match.player1.table_cards.filter(card => card.is_master)
    const player2MasterCards = match.player2.table_cards.filter(card => card.is_master)
}

const RITUAL_SPELL_ACTIONS: EventEmitter[][] = [
    [// grand rituals
        (match, queue, requestingPlayer, opponent, request) => {// annihilation (destroy every minion in the board)
            for (const card of match.player1.table_cards) {
                card.life_modifiers = []
                card.life = 0
            }
            for (const card of match.player2.table_cards) {
                card.life_modifiers = []
                card.life = 0
            }
        },

        (match, queue, requestingPlayer, opponent, request) => {// necromancy curse (ressurect all defeated minions back to hand)
            const ressurectedCards = match.graveyard.map((card, index) => {
                if (card.owner_id === requestingPlayer.id) {
                    match.graveyard.splice(index, 1)
                    return card
                }
            })

            for (const card of ressurectedCards) {
                if (card) {
                    card.life = card.base_life
                    card.attack_modifiers = []
                    card.life_modifiers = []
                    requestingPlayer.hand_cards.push(card)
                }
            }
        },
    ],



    [// major rituals
        (match, queue, requestingPlayer, opponent, request) => {// dark convergence (deal 3 damage to all enemy minions)
            for (const card of opponent.table_cards) { card.life -= 3 }
        },

        (match, queue, requestingPlayer, opponent, request) => {// summon from the deep (pending, needs the card storage system of the database first. summons a rare card from outside the game)
        },
    ],



    [// moderate rituals
        (match, queue, requestingPlayer, opponent, request) => {// soul harvest (draw 3 cards)
            requestingPlayer.hand_cards.push(...requestingPlayer.deck.splice(0, 3))
        },

        (match, queue, requestingPlayer, opponent, request) => {// purge (destroy a random enemy minion)
            const minion = opponent.table_cards[Math.round(Math.random() * opponent.table_cards.length)]

            minion.life = 0
            minion.life_modifiers = []
        },

        (match, queue, requestingPlayer, opponent, request) => {// rebirth (ressurect a random defeated minion)
            const ownedDefeatedMinions = match.graveyard.filter(card => card.owner_id === requestingPlayer.id)
            const randomCard = ownedDefeatedMinions[Math.round(Math.random() * ownedDefeatedMinions.length)]

            requestingPlayer.hand_cards.push(randomCard)

            match.graveyard.forEach((card, index) => {
                if (card == randomCard) match.graveyard.splice(index, 1)
            })
        },
    ],



    [// minor rituals
        (match, queue, requestingPlayer, opponent, request) => {// bloodbind (restore the soul vessel life by 6)
            (requestingPlayer.soul_vessel_life as number) += 6

            if ((requestingPlayer.soul_vessel_life as number) > 20) requestingPlayer.soul_vessel_life = 20
        },

        (match, queue, requestingPlayer, opponent, request) => {// ashen strike (deal 4 damage to a random enemy minion)
            const randomTarget = opponent.table_cards[Math.round(Math.random() * opponent.table_cards.length)]

            randomTarget.life -= 4
        },
    ],
]

function damageSoulVesselAndDepleteEnergy(player: MatchPlayer, opponent: MatchPlayer, energyAmount: number, damageAmount: number) {
    (player.ritual_energy as number) -= energyAmount;
    (opponent.soul_vessel_life as number) -= damageAmount
}






const triggerAbilities: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
}



const endTurnAndStartNext: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    match.current_turn_player = match.current_turn_player === 'player1' ? 'player2' : 'player1'

    const player = match[match.current_turn_player]

    for (const minion of player.table_cards) {
        minion.can_attack = true
    }

    if (player.mana_capacity < MAX_MANA_CAPACITY && !match.eclipse_active) {
        player.mana_capacity += DEFAULT_MANA_INCREASE
    }

    player.mana_level = player.mana_capacity

    match.total_turns_count += 1

    if (match.eclipse_active) {
        match.player1.life_pool -= (match.player1.table_cards.length > 0 ? ECLIPSE_PHASE_DAMAGE : ECLIPSE_PHASE_EMPTY_BOARD_DAMAGE)
        match.player2.life_pool -= (match.player2.table_cards.length > 0 ? ECLIPSE_PHASE_DAMAGE : ECLIPSE_PHASE_EMPTY_BOARD_DAMAGE)
    }
}



const throwCardOnTable: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    const card = requestingPlayer.hand_cards.find(card => card.uuid === request.card_uuid) as GameCard
    const cardManaCost = card.mana_cost - (match.action_die === ACTION_DIE_LESS_MANA_COST ? ACTION_DIE_MANA_DISCOUNT : 0)

    if (match.mode === 'destiny' && match.action_die === ACTION_DIE_ONE_CARD) {
        match.one_card_constraint_used = true
    }

    if (match.action_die === ACTION_DIE_DOUBLE_DAMAGE && !match.double_damage_bonus_used) {
        card.attack_modifiers.push({ value: card.attack_damage, source: 'destiny_action_die' })
        match.double_damage_bonus_used = true
    }

    if (match.mode === 'eclipse' && match.eclipse_active) {
        card.attack_modifiers.push({ value: card.attack_damage, source: 'eclipse_phase' })
        card.life_modifiers.push({ value: card.life, source: 'eclipse_phase' })
    }

    requestingPlayer.table_cards.push(card)
    requestingPlayer.hand_cards.splice(requestingPlayer.hand_cards.indexOf(card), 1)
    requestingPlayer.mana_level -= cardManaCost
}



const attackMinion: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    const attacker = requestingPlayer.table_cards.find(card => card.uuid === request.card_uuid) as GameCard
    const target = opponent.table_cards.find(card => card.uuid === request.target_uuid) as GameCard

    const totalAttackModifiers = attacker.attack_modifiers.reduce((total, modifier) => total + modifier.value, 0)
    const twentyFivePercentChance = Math.floor(Math.random() * 4)

    attacker.can_attack = false

    if (match.action_die === FATE_DIE_MISS_CHANCE && twentyFivePercentChance === 0) {
        target.life -= 0
    }

    else if (match.action_die === FATE_DIE_DOUBLE_DAMAGE_CHANCE && twentyFivePercentChance === 0) {
        target.life -= (attacker.attack_damage + totalAttackModifiers) * 2
    }

    else if (match.action_die === FATE_DIE_CHAIN_DAMAGE && !match.chain_attack_damage_used) {
        target.life -= attacker.attack_damage + totalAttackModifiers

        for (const enemyMinion of opponent.table_cards) {
            enemyMinion.life -= Math.ceil((attacker.attack_damage + totalAttackModifiers) / 2)
        }

        match.chain_attack_damage_used = true
    }

    else if (match.current_chaos_effects.includes('blood_moon')) {
        target.life -= CHAOS_BLOOD_MOON_MINIONS_DAMAGE
    }

    else if (match.current_chaos_effects.includes('surge')) {
        target.life -= attacker.attack_damage + totalAttackModifiers + CHAOS_SURGE_ATTACK_BONUS
    }

    else {
        target.life -= attacker.attack_damage + totalAttackModifiers
    }
}



const resetChaosEffects: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    if (match.current_chaos_effects.includes('mass_confusion')) {
        swapPlayersMinions(match)
    }

    else if (match.current_chaos_effects.includes('arcane_wind')) {
        const player = match[match.current_turn_player]

        player.mana_capacity = Math.round(player.mana_capacity / 2)
        player.mana_level > player.mana_capacity && (player.mana_level = player.mana_capacity)
    }

    else if (match.current_chaos_effects.includes('void_rift')) {
    }

    match.current_chaos_effects = []
}



const applyChaosEffects: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    const effects: ChaosEffectName[] = []

    for (let index = 0; index < match.chaos_draws_per_turn; index++) {
        effects.push(match.chaos_deck.shift())
    }

    if (effects.includes('earthquake')) {
        for (const card of match.player1.table_cards) {
            card.life -= CHAOS_EARTHQUAKE_DAMAGE
        }
        for (const card of match.player2.table_cards) {
            card.life -= CHAOS_EARTHQUAKE_DAMAGE
        }
    }

    else if (effects.includes('mass_confusion')) {
        swapPlayersMinions(match)
    }

    else if (effects.includes('the_cull')) {
        const player1Cards = match.player1.table_cards.sort((a, b) => a.life - b.life)
        const player2Cards = match.player2.table_cards.sort((a, b) => a.life - b.life)

        player1Cards.length > 0 && (player1Cards[0].life = 0)
        player2Cards.length > 0 && (player2Cards[0].life = 0)
    }

    else if (effects.includes('void_rift')) {
    }

    else if (effects.includes('arcane_wind')) {
        match[match.current_turn_player].mana_capacity *= 2
        match[match.current_turn_player].mana_level *= 2
    }

    match.current_chaos_effects = effects

    if ((match.chaos_deck as ChaosEffectName[]).length <= 0) {
        const chaosEffects: ChaosEffectName[] = ['earthquake', 'mass_confusion', 'blood_moon', 'surge', 'silence', 'arcane_wind', 'the_cull', 'void_rift']
        const shuffledChaosEffects: ChaosEffectName[] = []

        while (chaosEffects.length > 0) {
            shuffledChaosEffects.push(...chaosEffects.splice(Math.round(Math.random() * chaosEffects.length), 1))
        }

        (match.chaos_deck_exhausted_count as number) += 1
        match.chaos_deck = shuffledChaosEffects

        if ((match.chaos_deck_exhausted_count as number) >= CHAOS_DECK_EXHAUSTION_THRESHOLD) {
            (match.chaos_draws_per_turn as number) += 1
        }
    }
}



const removeDeadMinions: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    match.player1.table_cards.forEach((minion, index) => {
        if (minion.life + minion.life_modifiers.reduce((total, modifier) => total + modifier.value, 0) <= 0) {
            match.graveyard.push(...match.player1.table_cards.splice(index, 1))
        }
    })
    match.player2.table_cards.forEach((minion, index) => {
        if (minion.life + minion.life_modifiers.reduce((total, modifier) => total + modifier.value, 0) <= 0) {
            match.graveyard.push(...match.player2.table_cards.splice(index, 1))
        }
    })
}



const setHeroMinion: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    const cardIndex = requestingPlayer.deck.findIndex(card => card.uuid === request.card_uuid)

    requestingPlayer.deck[cardIndex].is_hero = true
    requestingPlayer.deck[cardIndex].life = 30
    requestingPlayer.table_cards.push(...requestingPlayer.deck.splice(cardIndex, 1))

    if (opponent.table_cards.some(card => card.is_hero)) {
        match.current_turn_player = ['player1', 'player2'][Math.round(Math.random())] as 'player1' | 'player2'
    }
}



const checkForWinnerByDefeatedMinions: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    const playerMainCards = requestingPlayer.table_cards.filter(card => card.is_hero || card.is_master)
    const opponentMainCards = opponent.table_cards.filter(card => card.is_hero || card.is_master)

    if (playerMainCards.length === 0 && opponentMainCards.length === 0) {
        match.both_players_lost = true
    }

    else if (playerMainCards.length === 0) {
        match.winner_id = requestingPlayer.id
    }

    else if (opponentMainCards.length === 0) {
        match.winner_id = opponent.id
    }
}



const checkForWinnerByDepletedLifePool: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    const playerLifePool = requestingPlayer.life_pool || requestingPlayer.soul_vessel_life as number
    const opponentLifePool = opponent.life_pool || opponent.soul_vessel_life as number

    if (playerLifePool <= 0 && opponentLifePool <= 0) {
        match.both_players_lost = true
    }

    else if (playerLifePool <= 0) {
        match.winner_id = requestingPlayer.id
    }

    else if (opponentLifePool <= 0) {
        match.winner_id = opponent.id
    }
}



const checkForWinnerByJudgeVerdict: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    const playerStreaks = requestingPlayer.favorable_rolls_streak as number
    const opponentStreaks = opponent.favorable_rolls_streak as number

    if (playerStreaks >= 3) {
        match.winner_id = requestingPlayer.id
    }

    else if (opponentStreaks >= 3) {
        match.winner_id = opponent.id
    }
}



const setDiceAndCoin: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    match.one_card_constraint_used = false
    match.chain_attack_damage_used = false
    match.double_damage_bonus_used = false

    match.action_die = Math.ceil(Math.random() * 6)
    match.fate_die = Math.ceil(Math.random() * 4)

    if (match.action_die >= FAVORABLE_STREAK_MIN_NUMBER) {
        (requestingPlayer.favorable_rolls_streak as number) += 1
    }

    (match.reversal_coin_counter as number) += 1

    if ((match.reversal_coin_counter as number) >= REVERSAL_COIN_TURNS_INTERVAL) {
        match.reversal_coin = Math.round(Math.random()) === 1 ? true : false
        match.reversal_coin_counter = 0
    }
}



const destinyTurns: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    const reversalCoinCounter = match.reversal_coin_counter as number

    match[match.current_turn_player].table_cards.forEach(minion => {
        minion.attack_modifiers.forEach((modifier, index) => {
            if (modifier.source === 'destiny_action_die') minion.attack_modifiers.splice(index, 1)
        })
    })

    if (match.reversal_coin) {
        if ((reversalCoinCounter % 2) > 0) {
            match.current_turn_player = match.current_turn_player === 'player1' ? 'player2' : 'player1'
        }
    }

    else { match.current_turn_player = match.current_turn_player === 'player1' ? 'player2' : 'player1' }

    const player = match[match.current_turn_player]

    for (const card of player.table_cards) {
        card.can_attack = true
    }

    player.mana_capacity < MAX_MANA_CAPACITY && (player.mana_capacity += DEFAULT_MANA_INCREASE)
    player.mana_level = player.mana_capacity

    match.total_turns_count += 1
}



const sacrificeCard: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    const minion = requestingPlayer.hand_cards.find(card => card.uuid === request.card_uuid) as GameCard

    if (requestingPlayer.ritual_energy) {
        requestingPlayer.ritual_energy += minion.mana_cost

        requestingPlayer.hand_cards.splice(requestingPlayer.hand_cards.indexOf(minion), 1)

        requestingPlayer.ritual_energy > 32 && (requestingPlayer.ritual_energy = 32)
    }
}



const castRitualSpell: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    const energy = requestingPlayer.ritual_energy as number

    if (energy >= GRAND_RITUAL_ENERGY_THRESHOLD) {
        const randomIndex = Math.round(Math.random())

        RITUAL_SPELL_ACTIONS[0][randomIndex](match, queue, requestingPlayer, opponent, request)

        damageSoulVesselAndDepleteEnergy(requestingPlayer, opponent, GRAND_RITUAL_ENERGY_THRESHOLD, GRAND_RITUAL_DAMAGE)
    }

    else if (energy >= MAJOR_RITUAL_ENERGY_THRESHOLD) {
        const randomIndex = Math.round(Math.random())

        RITUAL_SPELL_ACTIONS[1][randomIndex](match, queue, requestingPlayer, opponent, request)

        damageSoulVesselAndDepleteEnergy(requestingPlayer, opponent, MAJOR_RITUAL_ENERGY_THRESHOLD, MAJOR_RITUAL_DAMAGE)
    }

    else if (energy >= MODERATE_RITUAL_ENERGY_THRESHOLD) {
        const randomIndex = Math.floor(Math.random() * 3)

        RITUAL_SPELL_ACTIONS[2][randomIndex](match, queue, requestingPlayer, opponent, request)

        damageSoulVesselAndDepleteEnergy(requestingPlayer, opponent, MODERATE_RITUAL_ENERGY_THRESHOLD, MODERATE_RITUAL_DAMAGE)
    }

    else if (energy >= MINOR_RITUAL_ENERGY_THRESHOLD) {
        const randomIndex = Math.round(Math.random())

        RITUAL_SPELL_ACTIONS[3][randomIndex](match, queue, requestingPlayer, opponent, request)

        damageSoulVesselAndDepleteEnergy(requestingPlayer, opponent, MINOR_RITUAL_ENERGY_THRESHOLD, MINOR_RITUAL_DAMAGE)
    }
}



const attackLifePool: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    const minion = requestingPlayer.table_cards.find(card => card.uuid === request.card_uuid) as GameCard
    const totalAttackModifiers = minion.attack_modifiers.reduce((total, modifier) => total + modifier.value, 0);

    (opponent.life_pool as number) -= ((minion.attack_damage + totalAttackModifiers) * (match.eclipse_active ? 1 : 2))
}



const updateEclipseTimer: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    if ((match.eclipse_timer as number) > 0) {
        (match.eclipse_timer as number) -= 1

        if ((match.eclipse_timer as number) <= 0) {
            match.eclipse_active = true

            match.player1.table_cards.length === 0 && (match.player1.life_pool -= ECLIPSE_PHASE_ENTERED_EMPTY_BOARD_DAMAGE)
            match.player2.table_cards.length === 0 && (match.player2.life_pool -= ECLIPSE_PHASE_ENTERED_EMPTY_BOARD_DAMAGE)

            for (const minion of match.player1.table_cards) {
                minion.attack_modifiers.push({ value: minion.attack_damage, source: 'eclipse_phase' })
                minion.life_modifiers.push({ value: minion.life, source: 'eclipse_phase' })
            }
            for (const minion of match.player2.table_cards) {
                minion.attack_modifiers.push({ value: minion.attack_damage, source: 'eclipse_phase' })
                minion.life_modifiers.push({ value: minion.life, source: 'eclipse_phase' })
            }
        }
    }
}



const resetEclipseTimer: EventEmitter = (match, queue, requestingPlayer, opponent, request) => {
    if (opponent.table_cards.length === 0) {
        match.eclipse_active = false

        if ((match.eclipse_current_max_count as number) > ECLIPSE_TIMER_MIN_TURNS) {
            (match.eclipse_current_max_count as number) -= ECLIPSE_RESET_TURNS_DISCOUNT
        }

        (match.eclipse_timer as number) = (match.eclipse_current_max_count as number)

        for (const minion of match.player1.table_cards) {
            minion.attack_modifiers.forEach((modifier, index) => {
                modifier.source === 'eclipse_phase' && minion.attack_modifiers.splice(index, 1)
            })

            minion.life_modifiers.forEach((modifier, index) => {
                modifier.source === 'eclipse_phase' && minion.life_modifiers.splice(index, 1)
            })
        }

        for (const minion of match.player2.table_cards) {
            minion.attack_modifiers.forEach((modifier, index) => {
                modifier.source === 'eclipse_phase' && minion.attack_modifiers.splice(index, 1)
            })

            minion.life_modifiers.forEach((modifier, index) => {
                modifier.source === 'eclipse_phase' && minion.life_modifiers.splice(index, 1)
            })
        }
    }
}



const moveEvents: Partial<Record<`${GameMode}:${MoveAction}`, EventEmitter[]>> = {
    'classic:throw_onto_table': [throwCardOnTable],
    'classic:attack_minion': [attackMinion, removeDeadMinions, checkForWinnerByDefeatedMinions],
    'classic:end_turn': [endTurnAndStartNext],
    'classic:choose_hero_minion': [setHeroMinion],

    'destiny:throw_onto_table': [throwCardOnTable],
    'destiny:attack_minion': [attackMinion, removeDeadMinions, checkForWinnerByDefeatedMinions, checkForWinnerByJudgeVerdict],
    'destiny:end_turn': [setDiceAndCoin, destinyTurns],
    'destiny:choose_hero_minion': [setHeroMinion],

    'chaos:throw_onto_table': [throwCardOnTable],
    'chaos:attack_minion': [attackMinion, removeDeadMinions],
    'chaos:end_turn': [resetChaosEffects, endTurnAndStartNext, applyChaosEffects, removeDeadMinions, checkForWinnerByDefeatedMinions],

    'ritual:throw_onto_table': [throwCardOnTable],
    'ritual:attack_minion': [attackMinion, removeDeadMinions],
    'ritual:end_turn': [endTurnAndStartNext],
    'ritual:sacrifice_card': [sacrificeCard],
    'ritual:cast_ritual_spell': [castRitualSpell, removeDeadMinions, checkForWinnerByDepletedLifePool],

    'dungeon_run:throw_onto_table': [throwCardOnTable],
    'dungeon_run:attack_minion': [attackMinion, removeDeadMinions, checkForWinnerByDefeatedMinions],
    'dungeon_run:end_turn': [endTurnAndStartNext],
    'dungeon_run:choose_hero_minion': [setHeroMinion],

    'eclipse:throw_onto_table': [throwCardOnTable],
    'eclipse:attack_minion': [attackMinion, removeDeadMinions, resetEclipseTimer],
    'eclipse:attack_life_pool': [attackLifePool, checkForWinnerByDepletedLifePool],
    'eclipse:end_turn': [updateEclipseTimer],
}

// main dispatch

export function createMatchEventsQueue(match: MatchObject, requestingPlayer: MatchPlayer, opponent: MatchPlayer, request: MoveRequest): GeneratedEvent[] {
    const key = `${match.mode}:${request.action}` as `${GameMode}:${MoveAction}`
    const events = moveEvents[key]

    const queue: GeneratedEvent[] = []

    return queue
}