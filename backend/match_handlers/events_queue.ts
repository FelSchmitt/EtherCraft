import { MatchObject, MatchPlayer, MoveRequest, GameMode, MoveAction, GameCard, ChaosEffectName, EventResult } from '../types'

export type GeneratedEvent = {
    eventResult: EventResult
    function: (...args: any[]) => any
    player?: MatchPlayer
    opponent?: MatchPlayer
    place?: 'hand' | 'table'
    source?: GameCard
    targets?: GameCard[]
    eventData?: Record<string, any>
}

type EventEmitter = (match: MatchObject, actingPlayer: MatchPlayer, opponent: MatchPlayer, request: MoveRequest, descriptorOnly?: boolean, event?: GeneratedEvent) => GeneratedEvent[]


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
        (match, actingPlayer, opponent, request) => {// annihilation (destroy every minion in the board)
            for (const card of match.player1.table_cards) {
                card.life_modifiers = []
                card.life = 0
            }
            for (const card of match.player2.table_cards) {
                card.life_modifiers = []
                card.life = 0
            }

            return []
        },

        (match, actingPlayer, opponent, request) => {// necromancy curse (ressurect all defeated minions back to hand)
            const ressurectedCards = match.graveyard.map((card, index) => {
                if (card.owner_id === actingPlayer.id) {
                    match.graveyard.splice(index, 1)
                    card.life = card.base_life
                    card.mana_cost_modifiers = []
                    card.life_modifiers = []
                    card.attack_modifiers = []
                    card.custom_properties = []
                    return card
                }
            })

            actingPlayer.hand_cards.push(...ressurectedCards)

            return []
        },
    ],



    [// major rituals
        (match, actingPlayer, opponent, request) => {// dark convergence (deal 3 damage to all enemy minions)
            for (const card of opponent.table_cards) { card.life -= 3 }

            return []
        },

        (match, actingPlayer, opponent, request) => {// summon from the deep (pending, needs the card storage system of the database first. summons a rare card from outside the game)
            return []
        },
    ],



    [// moderate rituals
        (match, actingPlayer, opponent, request) => {// soul harvest (draw 3 cards)
            actingPlayer.hand_cards.push(...actingPlayer.deck.splice(0, 3))

            return []
        },

        (match, actingPlayer, opponent, request) => {// purge (destroy a random enemy minion)
            const minion = opponent.table_cards[Math.round(Math.random() * opponent.table_cards.length)]

            minion.life = 0
            minion.life_modifiers = []

            return []
        },

        (match, actingPlayer, opponent, request) => {// rebirth (ressurect a random defeated minion)
            const ownedDefeatedMinions = match.graveyard.filter(card => card.owner_id === actingPlayer.id)
            const randomCard = ownedDefeatedMinions[Math.round(Math.random() * ownedDefeatedMinions.length)]

            actingPlayer.hand_cards.push(randomCard)

            match.graveyard.forEach((card, index) => {
                if (card == randomCard) match.graveyard.splice(index, 1)
            })

            return []
        },
    ],



    [// minor rituals
        (match, actingPlayer, opponent, request) => {// bloodbind (restore the soul vessel life by 6)
            actingPlayer.soul_vessel_life += 6

            if (actingPlayer.soul_vessel_life > 20) actingPlayer.soul_vessel_life = 20

            return []
        },

        (match, actingPlayer, opponent, request) => {// ashen strike (deal 4 damage to a random enemy minion)
            const randomTarget = opponent.table_cards[Math.round(Math.random() * opponent.table_cards.length)]

            randomTarget.life -= 4

            return []
        },
    ],
]

function damageSoulVesselAndDepleteEnergy(player: MatchPlayer, opponent: MatchPlayer, energyAmount: number, damageAmount: number) {
    player.ritual_energy -= energyAmount
    opponent.soul_vessel_life -= damageAmount
}






const endTurnAndStartNext: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (descriptorOnly) return [{ eventResult: 'turn_changed', function: endTurnAndStartNext }]

    match.current_turn_player = match.current_turn_player === 'player1' ? 'player2' : 'player1'

    const player = match[match.current_turn_player]

    if (player.mana_capacity < MAX_MANA_CAPACITY && !match.eclipse_active) {
        player.mana_capacity += DEFAULT_MANA_INCREASE
    }

    player.mana_level = player.mana_capacity

    match.total_turns_count += 1

    if (match.eclipse_active) {
        match.player1.life_pool -= (match.player1.table_cards.length > 0 ? ECLIPSE_PHASE_DAMAGE : ECLIPSE_PHASE_EMPTY_BOARD_DAMAGE)
        match.player2.life_pool -= (match.player2.table_cards.length > 0 ? ECLIPSE_PHASE_DAMAGE : ECLIPSE_PHASE_EMPTY_BOARD_DAMAGE)
    }

    return []
}



const resetMinionsCanAttack: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (descriptorOnly) {
        const events: GeneratedEvent[] = []

        for (const minion of actingPlayer.table_cards) {
            if (!minion.can_attack) events.push(
                {
                    eventResult: 'minion_enabled_attack',
                    source: minion,
                    player: actingPlayer,
                    function: resetMinionsCanAttack
                }
            )
        }

        return events
    }

    else {
        event.source.can_attack = true
    }

    return []
}



const summonMinion: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (descriptorOnly) return [
        {
            eventResult: 'summoned',
            source: actingPlayer.hand_cards.find(card => card.uuid === request.card_uuid),
            player: actingPlayer,
            function: summonMinion
        }
    ]

    const cardManaCost = event.source.mana_cost - event.source.mana_cost_modifiers.reduce((total, modifier) => total + modifier.value, 0)

    if (match.mode === 'destiny' && match.action_die === ACTION_DIE_ONE_CARD) {
        match.one_card_constraint_used = true
    }

    if (match.action_die === ACTION_DIE_DOUBLE_DAMAGE && !match.double_damage_bonus_used) {
        event.source.attack_modifiers.push({ value: event.source.attack_damage, source: 'destiny_action_die' })
        match.double_damage_bonus_used = true
    }

    if (match.action_die === ACTION_DIE_LESS_MANA_COST) {
        event.source.mana_cost_modifiers.push({ value: -ACTION_DIE_MANA_DISCOUNT, source: 'destiny_action_die' })
    }

    if (match.mode === 'eclipse' && match.eclipse_active) {
        event.source.attack_modifiers.push({ value: event.source.attack_damage, source: 'eclipse_phase' })
        event.source.life_modifiers.push({ value: event.source.life, source: 'eclipse_phase' })
    }

    actingPlayer.table_cards.push(event.source)
    actingPlayer.hand_cards.splice(actingPlayer.hand_cards.indexOf(event.source), 1)
    actingPlayer.mana_level -= cardManaCost

    return []
}



const attackMinion: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (descriptorOnly) return [
        {
            eventResult: 'attacked_minion',
            source: actingPlayer.table_cards.find(minion => minion.uuid === request.card_uuid),
            targetsUuids: [opponent.table_cards.find(minion => minion.uuid === request.target_uuid)],
            player: actingPlayer,
            opponent: opponent,
            function: attackMinion
        }
    ]

    const totalAttackModifiers = event.source.attack_modifiers.reduce((total, modifier) => total + modifier.value, 0)
    const twentyFivePercentChance = Math.floor(Math.random() * 4)

    event.source.can_attack = false

    if (match.action_die === FATE_DIE_MISS_CHANCE && twentyFivePercentChance === 0) {
        event.targets[0].life -= 0
    }

    else if (match.action_die === FATE_DIE_DOUBLE_DAMAGE_CHANCE && twentyFivePercentChance === 0) {
        event.targets[0].life -= (event.source.attack_damage + totalAttackModifiers) * 2
    }

    else if (match.action_die === FATE_DIE_CHAIN_DAMAGE && !match.chain_attack_damage_used) {
        event.targets[0].life -= event.source.attack_damage + totalAttackModifiers

        for (const enemyMinion of opponent.table_cards) {
            enemyMinion.life -= Math.ceil((event.source.attack_damage + totalAttackModifiers) / 2)
        }

        match.chain_attack_damage_used = true
    }

    else if (match.current_chaos_effects.includes('blood_moon')) {
        event.targets[0].life -= CHAOS_BLOOD_MOON_MINIONS_DAMAGE
    }

    else if (match.current_chaos_effects.includes('surge')) {
        event.targets[0].life -= event.source.attack_damage + totalAttackModifiers + CHAOS_SURGE_ATTACK_BONUS
    }

    else {
        event.targets[0].life -= event.source.attack_damage + totalAttackModifiers
    }

    return []
}



const resetChaosEffects: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (descriptorOnly) return [{ eventResult: 'chaos_effects_reset', function: resetChaosEffects }]

    if (match.current_chaos_effects.includes('mass_confusion')) {
        swapPlayersMinions(match)
    }

    else if (match.current_chaos_effects.includes('arcane_wind')) {
        const player = match[match.current_turn_player]

        player.mana_capacity = Math.round(player.mana_capacity / 2)
        player.mana_level > player.mana_capacity && (player.mana_level = player.mana_capacity)
    }

    else if (match.current_chaos_effects.includes('void_rift')) {
        const playerMinions = actingPlayer.table_cards.filter(minion => minion.is_master)
        const opponentMinions = opponent.table_cards.filter(minion => minion.is_master)

        if (playerMinions.length > opponentMinions.length) {
            for (const minion of playerMinions) {
                if (minion.swapped_life_enemy_uuid) {
                    const enemy = opponent.table_cards.find(enemy => enemy.uuid === minion.swapped_life_enemy_uuid)

                    if (enemy) {
                        const oppositeLife = enemy.life

                        enemy.life = minion.life
                        minion.life = oppositeLife

                        enemy.swapped_life_enemy_uuid = null
                    }

                    minion.swapped_life_enemy_uuid = null
                }
            }
        }
        else {
            for (const minion of opponentMinions) {
                if (minion.swapped_life_enemy_uuid) {
                    const enemy = actingPlayer.table_cards.find(enemy => enemy.uuid === minion.swapped_life_enemy_uuid)

                    if (enemy) {
                        const oppositeLife = enemy.life

                        enemy.life = minion.life
                        minion.life = oppositeLife

                        enemy.swapped_life_enemy_uuid = null
                    }

                    minion.swapped_life_enemy_uuid = null
                }
            }
        }
    }

    match.current_chaos_effects = []

    return []
}



const applyChaosEffects: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (descriptorOnly) return [{ eventResult: 'chaos_effects_applied', eventData: { effects_applied: match.chaos_deck.slice(0, match.chaos_draws_per_turn) }, function: applyChaosEffects }]

    const effects: ChaosEffectName[] = []

    effects.push(...match.chaos_deck.splice(0, match.chaos_draws_per_turn))

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

        if (player1Cards.length > 0) { player1Cards[0].life = 0; player1Cards[0].life_modifiers = [] }
        if (player2Cards.length > 0) { player2Cards[0].life = 0; player2Cards[0].life_modifiers = [] }
    }

    else if (effects.includes('void_rift')) {
        const playerCards = actingPlayer.table_cards.filter(card => card.is_master)
        const opponentCards = opponent.table_cards.filter(card => card.is_master)

        if (playerCards.length > 0 && opponentCards.length > 0) {
            if (playerCards.length > opponentCards.length) {
                opponentCards.forEach((card, index) => {
                    const oppositeLife = playerCards[index].life

                    playerCards[index].life = card.life
                    card.swapped_life_enemy_uuid = playerCards[index].uuid
                    playerCards[index].swapped_life_enemy_uuid = card.uuid
                    card.life = oppositeLife
                })
            }

            else {
                playerCards.forEach((card, index) => {
                    const oppositeLife = opponentCards[index].life

                    opponentCards[index].life = card.life
                    card.swapped_life_enemy_uuid = opponentCards[index].uuid
                    opponentCards[index].swapped_life_enemy_uuid = card.uuid
                    card.life = oppositeLife
                })
            }
        }
    }

    else if (effects.includes('arcane_wind')) {
        match[match.current_turn_player].mana_capacity *= 2
        match[match.current_turn_player].mana_level *= 2
    }

    match.current_chaos_effects = effects

    if (match.chaos_deck.length <= 0) {
        const chaosEffects: ChaosEffectName[] = ['earthquake', 'mass_confusion', 'blood_moon', 'surge', 'silence', 'arcane_wind', 'the_cull', 'void_rift']
        const shuffledChaosEffects: ChaosEffectName[] = []

        while (chaosEffects.length > 0) {
            shuffledChaosEffects.push(...chaosEffects.splice(Math.round(Math.random() * chaosEffects.length), 1))
        }

        match.chaos_deck_exhausted_count += 1
        match.chaos_deck = shuffledChaosEffects

        if (match.chaos_deck_exhausted_count >= CHAOS_DECK_EXHAUSTION_THRESHOLD) {
            match.chaos_draws_per_turn += 1
        }
    }

    return []
}



const removeDeadMinions: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    const events: GeneratedEvent[] = []

    actingPlayer.table_cards.forEach((minion, index) => {
        if (minion.life + minion.life_modifiers.reduce((total, modifier) => total + modifier.value, 0) <= 0) {
            if (descriptorOnly) {
                events.push({ eventResult: 'died', source: minion, player: actingPlayer, function: removeDeadMinions })
            }
            else {
                minion.owner_id = actingPlayer.id
                match.graveyard.push(...match.player1.table_cards.splice(index, 1))
            }
        }
    })

    opponent.table_cards.forEach((minion, index) => {
        if (minion.life + minion.life_modifiers.reduce((total, modifier) => total + modifier.value, 0) <= 0) {
            if (descriptorOnly) {
                events.push({ eventResult: 'died', source: minion, player: actingPlayer, function: removeDeadMinions })
            }
            else {
                minion.owner_id = opponent.id
                match.graveyard.push(...match.player1.table_cards.splice(index, 1))
            }
        }
    })

    return []
}



const setHeroMinion: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (descriptorOnly) return [{ eventResult: 'summoned', source: actingPlayer.deck.find(card => card.uuid === request.card_uuid), player: actingPlayer, function: setHeroMinion }]

    event.source.is_hero = true
    event.source.life = 30
    actingPlayer.table_cards.push(...actingPlayer.deck.splice(actingPlayer.deck.indexOf(event.source), 1))

    if (opponent.table_cards.some(card => card.is_hero)) {
        match.current_turn_player = ['player1', 'player2'][Math.round(Math.random())] as 'player1' | 'player2'
    }

    return []
}



const checkForWinnerByDefeatedMinions: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    const playerMainCards = actingPlayer.table_cards.filter(card => card.is_hero || card.is_master)
    const opponentMainCards = opponent.table_cards.filter(card => card.is_hero || card.is_master)

    if (playerMainCards.length === 0 && opponentMainCards.length === 0) {
        if (!descriptorOnly) { match.both_players_lost = true }
        return [{ eventResult: 'won_match', function: checkForWinnerByDefeatedMinions }]
    }

    else if (playerMainCards.length === 0) {
        if (!descriptorOnly) { match.winner_id = opponent.id }
        return [{ eventResult: 'won_match', player: opponent, function: checkForWinnerByDefeatedMinions }]
    }

    else if (opponentMainCards.length === 0) {
        if (!descriptorOnly) { match.winner_id = actingPlayer.id }
        return [{ eventResult: 'won_match', player: actingPlayer, function: checkForWinnerByDefeatedMinions }]
    }

    return []
}



const checkForWinnerByDepletedLifePool: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    const playerLifePool = actingPlayer.life_pool || actingPlayer.soul_vessel_life as number
    const opponentLifePool = opponent.life_pool || opponent.soul_vessel_life as number

    if (playerLifePool <= 0 && opponentLifePool <= 0) {
        if (!descriptorOnly) [match.both_players_lost = true]
        return [{ eventResult: 'won_match', function: checkForWinnerByDepletedLifePool }]
    }

    else if (playerLifePool <= 0) {
        if (!descriptorOnly) { match.winner_id = opponent.id }
        return [{ eventResult: 'won_match', player: opponent, function: checkForWinnerByDepletedLifePool }]
    }

    else if (opponentLifePool <= 0) {
        if (!descriptorOnly) { match.winner_id = actingPlayer.id }
        return [{ eventResult: 'won_match', player: actingPlayer, function: checkForWinnerByDepletedLifePool }]
    }

    return []
}



const checkForWinnerByJudgeVerdict: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    const playerStreaks = actingPlayer.favorable_rolls_streak as number
    const opponentStreaks = opponent.favorable_rolls_streak as number

    if (playerStreaks >= 3) {
        if (!descriptorOnly) { match.winner_id = actingPlayer.id }
        return [{ eventResult: 'won_match', player: actingPlayer, function: checkForWinnerByJudgeVerdict }]
    }

    else if (opponentStreaks >= 3) {
        if (!descriptorOnly) { match.winner_id = opponent.id }
        return [{ eventResult: 'won_match', player: opponent, function: checkForWinnerByJudgeVerdict }]
    }

    return []
}



const resetDiceAndCoin: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (descriptorOnly) return [{ eventResult: 'dice_and_coin_reset', function: resetDiceAndCoin }]

    match.one_card_constraint_used = false
    match.chain_attack_damage_used = false
    match.double_damage_bonus_used = false

    match[match.current_turn_player].table_cards.forEach(minion => {
        minion.attack_modifiers.forEach((modifier, index) => {
            if (modifier.source === 'destiny_action_die') minion.attack_modifiers.splice(index, 1)
        })

        minion.mana_cost_modifiers.forEach((modifier, index) => {
            if (modifier.source === 'destiny_action_die') minion.mana_cost_modifiers.splice(index, 1)
        })
    })

    match.action_die = Math.ceil(Math.random() * 6)
    match.fate_die = Math.ceil(Math.random() * 4)

    if (match.action_die >= FAVORABLE_STREAK_MIN_NUMBER) {
        (actingPlayer.favorable_rolls_streak as number) += 1
    }

    (match.reversal_coin_counter as number) += 1

    if ((match.reversal_coin_counter as number) >= REVERSAL_COIN_TURNS_INTERVAL) {
        match.reversal_coin = Math.round(Math.random()) === 1 ? true : false
        match.reversal_coin_counter = 0
    }

    return []
}



const destinyTurns: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (descriptorOnly) return [{ eventResult: 'turn_changed', function: destinyTurns }]

    const reversalCoinCounter = match.reversal_coin_counter as number

    if (match.reversal_coin) {
        if ((reversalCoinCounter % 2) > 0) {
            match.current_turn_player = match.current_turn_player === 'player1' ? 'player2' : 'player1'
        }
    }

    else {
        match.current_turn_player = match.current_turn_player === 'player1' ? 'player2' : 'player1'
    }

    const player = match[match.current_turn_player]

    for (const card of player.table_cards) {
        card.can_attack = true
    }

    player.mana_capacity < MAX_MANA_CAPACITY && (player.mana_capacity += DEFAULT_MANA_INCREASE)
    player.mana_level = player.mana_capacity

    match.total_turns_count += 1

    return []
}



const sacrificeCard: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (descriptorOnly) return [{ eventResult: 'card_sacrificed', source: actingPlayer.hand_cards.find(card => card.uuid === request.card_uuid), player: actingPlayer, function: sacrificeCard }]

    if (actingPlayer.ritual_energy) {
        actingPlayer.ritual_energy += event.source.mana_cost

        actingPlayer.hand_cards.splice(actingPlayer.hand_cards.indexOf(event.source), 1)

        actingPlayer.ritual_energy > 32 && (actingPlayer.ritual_energy = 32)
    }

    return []
}



const castRitualSpell: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (descriptorOnly) return [{ eventResult: 'spell_cast', player: actingPlayer, function: castRitualSpell }]

    const energy = actingPlayer.ritual_energy

    if (energy >= GRAND_RITUAL_ENERGY_THRESHOLD) {
        const randomIndex = Math.round(Math.random())

        RITUAL_SPELL_ACTIONS[0][randomIndex](match, actingPlayer, opponent, request)

        damageSoulVesselAndDepleteEnergy(actingPlayer, opponent, GRAND_RITUAL_ENERGY_THRESHOLD, GRAND_RITUAL_DAMAGE)
    }

    else if (energy >= MAJOR_RITUAL_ENERGY_THRESHOLD) {
        const randomIndex = Math.round(Math.random())

        RITUAL_SPELL_ACTIONS[1][randomIndex](match, actingPlayer, opponent, request)

        damageSoulVesselAndDepleteEnergy(actingPlayer, opponent, MAJOR_RITUAL_ENERGY_THRESHOLD, MAJOR_RITUAL_DAMAGE)
    }

    else if (energy >= MODERATE_RITUAL_ENERGY_THRESHOLD) {
        const randomIndex = Math.floor(Math.random() * 3)

        RITUAL_SPELL_ACTIONS[2][randomIndex](match, actingPlayer, opponent, request)

        damageSoulVesselAndDepleteEnergy(actingPlayer, opponent, MODERATE_RITUAL_ENERGY_THRESHOLD, MODERATE_RITUAL_DAMAGE)
    }

    else if (energy >= MINOR_RITUAL_ENERGY_THRESHOLD) {
        const randomIndex = Math.round(Math.random())

        RITUAL_SPELL_ACTIONS[3][randomIndex](match, actingPlayer, opponent, request)

        damageSoulVesselAndDepleteEnergy(actingPlayer, opponent, MINOR_RITUAL_ENERGY_THRESHOLD, MINOR_RITUAL_DAMAGE)
    }

    return []
}



const attackLifePool: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (descriptorOnly) return [
        {
            eventResult: 'attacked_life_pool',
            player: actingPlayer,
            opponent: opponent,
            function: attackLifePool
        }
    ]

    const minion = actingPlayer.table_cards.find(card => card.uuid === request.card_uuid) as GameCard
    const totalAttackModifiers = minion.attack_modifiers.reduce((total, modifier) => total + modifier.value, 0);

    (opponent.life_pool as number) -= ((minion.attack_damage + totalAttackModifiers) * (match.eclipse_active ? 1 : 2))

    return []
}



const updateEclipseTimer: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (descriptorOnly && match.eclipse_timer === 1) { return [{ eventResult: 'eclipse_began', function: updateEclipseTimer }] }
    else if (descriptorOnly) { return [{ eventResult: 'eclipse_timer_countdown', function: updateEclipseTimer }] }

    if (match.eclipse_timer > 0) {
        match.eclipse_timer -= 1

        if (match.eclipse_timer <= 0) {
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

    return []
}



const resetEclipseTimer: EventEmitter = (match, actingPlayer, opponent, request, descriptorOnly, event) => {
    if (opponent.table_cards.length === 0) {
        if (!descriptorOnly) {
            match.eclipse_active = false

            if (match.eclipse_current_max_count > ECLIPSE_TIMER_MIN_TURNS) {
                match.eclipse_current_max_count -= ECLIPSE_RESET_TURNS_DISCOUNT
            }

            match.eclipse_timer = match.eclipse_current_max_count

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

        return [{ eventResult: 'eclipse_ended', function: resetEclipseTimer }]
    }

    return []
}






function executeFunctions(match: MatchObject, player: MatchPlayer, opponent: MatchPlayer, request: MoveRequest, queue: GeneratedEvent[], event: GeneratedEvent) {
    if (event.source) {
        if (!event.source.abilities.some(ability => ability.replace_default_event)) event.function(match, player, opponent, request, false, event)

        for (const ability of event.source.abilities) {
            event.eventResult === ability.trigger && !(match.current_chaos_effects?.includes('silence')) && ability.function(match, player, opponent, queue, event)
        }

        for (const target of event.targets) {
            for (const ability of target.abilities) {
                event.eventResult === ability.trigger && !(match.current_chaos_effects?.includes('silence')) && ability.function(match, player, opponent, queue, event)
            }
        }
    }

    else {
        const cards = [...match.player1.hand_cards, ...match.player1.table_cards, ...match.player2.hand_cards, ...match.player2.table_cards]

        for (const card of cards) {
            if (!card.abilities.some(ability => ability.replace_default_event)) event.function(match, player, opponent, request, false, event)

            for (const ability of card.abilities) {
                event.eventResult === ability.trigger && !(match.current_chaos_effects?.includes('silence')) && ability.function(match, player, opponent, queue, event)
            }
        }
    }
}



const moveEvents: Partial<Record<`${GameMode}:${MoveAction}`, EventEmitter[]>> = {
    'classic:throw_onto_table': [summonMinion],
    'classic:attack_minion': [attackMinion, removeDeadMinions, checkForWinnerByDefeatedMinions],
    'classic:end_turn': [endTurnAndStartNext, resetMinionsCanAttack],
    'classic:choose_hero_minion': [setHeroMinion],

    'destiny:throw_onto_table': [summonMinion],
    'destiny:attack_minion': [attackMinion, removeDeadMinions, checkForWinnerByDefeatedMinions, checkForWinnerByJudgeVerdict],
    'destiny:end_turn': [resetDiceAndCoin, destinyTurns, resetMinionsCanAttack],
    'destiny:choose_hero_minion': [setHeroMinion],

    'chaos:throw_onto_table': [summonMinion],
    'chaos:attack_minion': [attackMinion, removeDeadMinions],
    'chaos:end_turn': [resetChaosEffects, endTurnAndStartNext, resetMinionsCanAttack, applyChaosEffects, removeDeadMinions, checkForWinnerByDefeatedMinions],

    'ritual:throw_onto_table': [summonMinion],
    'ritual:attack_minion': [attackMinion, removeDeadMinions],
    'ritual:end_turn': [endTurnAndStartNext, resetMinionsCanAttack],
    'ritual:sacrifice_card': [sacrificeCard],
    'ritual:cast_ritual_spell': [castRitualSpell, removeDeadMinions, checkForWinnerByDepletedLifePool],

    'dungeon_run:throw_onto_table': [summonMinion],
    'dungeon_run:attack_minion': [attackMinion, removeDeadMinions, checkForWinnerByDefeatedMinions],
    'dungeon_run:end_turn': [endTurnAndStartNext, resetMinionsCanAttack],
    'dungeon_run:choose_hero_minion': [setHeroMinion],

    'eclipse:throw_onto_table': [summonMinion],
    'eclipse:attack_minion': [attackMinion, removeDeadMinions, resetEclipseTimer],
    'eclipse:attack_life_pool': [attackLifePool, checkForWinnerByDepletedLifePool],
    'eclipse:end_turn': [endTurnAndStartNext, updateEclipseTimer, resetMinionsCanAttack],
}

// main dispatch

export function createMatchEventsQueue(match: MatchObject, requestingPlayer: MatchPlayer, opponent: MatchPlayer, request: MoveRequest): GeneratedEvent[] {
    const key = `${match.mode}:${request.action}` as `${GameMode}:${MoveAction}`
    const defaultEvents = moveEvents[key]
    const queue: GeneratedEvent[] = []

    for (const eventDescription of defaultEvents) {
        queue.push(...eventDescription(match, requestingPlayer, opponent, request, true))
    }

    for (let index = 0; index < queue.length; index++) {
        executeFunctions(match, requestingPlayer, opponent, request, queue, queue[index])
    }

    return queue
}