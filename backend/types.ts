// Card & Ability

export type AbilityTrigger = 'on_play' | 'in_hand' | 'passive'

export type CardAbility = {
    name: string
    trigger: AbilityTrigger
    description: string
}

export type GameCard = {
    card_id: string
    uuid: string
    name: string
    mana_cost: number
    life: number
    max_life: number
    attack_damage: number
    can_attack: boolean
    classes: string[]
    abilities: CardAbility[]
    rarity: string
    is_hero?: boolean
}

// Players

export type MatchPlayer = {
    id: string
    socketId: string
    nickname: string
    hand_cards: GameCard[]
    // Classic / Destiny / Dungeon Run / Ritual: active minion zone
    // Eclipse: active minion zone (no hero, attacks life_pool directly)
    table_cards: GameCard[]
    // Chaos only: the cards auto-placed as victory targets
    master_cards?: GameCard[]
    // Chaos only: player-controlled minions in defense zone
    defense_cards?: GameCard[]
    // Classic / Destiny / Dungeon Run
    hero_card?: GameCard
    // Ritual
    soul_vessel_life?: number
    ritual_energy?: number
    // Eclipse / Chaos life counter
    life_pool?: number
    // Mana
    mana_level: number
    mana_capacity: number
}

// Matches

export type GameMode = 'classic' | 'destiny' | 'chaos' | 'ritual' | 'dungeon_run' | 'eclipse'

export type ChaosEffectName = 'earthquake' | 'mass_confusion' | 'blood_moon' | 'surge' | 'silence' | 'second_wind' | 'the_cull' | 'mirror' | 'void_rift'

export type MatchObject = {
    match_id: string
    mode: GameMode
    players: MatchPlayer[]
    current_turn_player: 0 | 1
    start_time: string
    total_turns_count: number
    winner_id?: string

    // Destiny
    action_die?: number | null        // d6 rolled at start of each turn
    fate_die?: number | null          // d4 determines hit variance
    favorable_rolls_streak?: number   // consecutive action_die >= 4; 3 in a row = Judge's Verdict
    mercy_roll_used?: boolean
    reversal_coin_counter?: number    // cycles 0‑1‑2; at 0 flip a coin

    // Eclipse
    eclipse_timer?: number            // counts down from 12; each end-of-turn counts down by 1
    eclipse_active?: boolean
    eclipse_reset_count?: number
    mana_cap_at_eclipse?: number      // mana capacity is frozen when Eclipse triggers

    // Chaos
    chaos_deck?: ChaosEffectName[]
    current_chaos_effect?: ChaosEffectName | null
    chaos_deck_exhausted_count?: number
    chaos_draws_per_turn?: number     // starts at 1; becomes 2 after third deck exhaustion

    // Chaos per-turn temporaries (reset at end of turn)
    blood_moon_active?: boolean
    mass_confusion_active?: boolean
    silence_active?: boolean
    surge_active?: boolean
    void_rift_active?: boolean
}

// Requests

export type MoveAction = 'throw_onto_table' | 'attack_card' | 'attack_hero' | 'attack_life_pool' | 'end_turn'
    | 'sacrifice_card'      // Ritual only
    | 'cast_ritual_spell'   // Ritual only
    | 'choose_hero_card'    // Classic / Destiny / Dungeon Run setup

export type MoveRequest = {
    card?: { uuid: string, place: 'hand' | 'table', side: 'self' | 'opponent' }
    target_uuid?: string   // uuid of the card / hero being targeted
    mode: GameMode
    action: MoveAction
    spell_name?: string    // for cast_ritual_spell
}

// Backward-compat aliases (kept so server.ts compiles unchanged)

export type playerIdentifiers = {
    id: string
    socketId: string
    nickname?: string
}

export type matchObject = MatchObject
export type matchPlayer = MatchPlayer
export type moveRequestType = MoveRequest