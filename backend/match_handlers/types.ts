export type playerIdentifiers = {
    id: string
    socket_id: string
    nickname: string
}



export type GameCard = {
    card_id: string
    uuid: string
    owner_id?: string
    mana_cost: number
    life: number
    max_life: number
    attack_damage: number
    can_attack: boolean
    classes: string[]
    abilities: CardAbility[]
    rarity: string
    is_hero?: boolean
    is_master?: boolean
    is_defense?: boolean
}



export type MatchPlayer = {
    id: string
    socket_id: string
    nickname: string
    hand_cards: GameCard[]
    table_cards: GameCard[]
    deck: GameCard[]
    soul_vessel_life?: number
    ritual_energy?: number
    life_pool?: number
    mana_level: number
    mana_capacity: number
}



export type GameMode = 'classic' | 'destiny' | 'chaos' | 'ritual' | 'dungeon_run' | 'eclipse'



export type ChaosEffectName = 'earthquake' | 'mass_confusion' | 'blood_moon' | 'surge' | 'silence' | 'second_wind' | 'the_cull' | 'mirror' | 'void_rift'



export type MatchObject = {
    match_id: string
    mode: GameMode
    players: MatchPlayer[]
    current_turn_player: 0 | 1
    start_time: string
    total_turns_count: number
    graveyard: GameCard[]
    winner_id?: string

    action_die?: number | null
    fate_die?: number | null
    favorable_rolls_streak?: number
    mercy_roll_used?: boolean
    reversal_coin_counter?: number

    eclipse_timer?: number
    eclipse_active?: boolean
    eclipse_reset_count?: number
    mana_cap_at_eclipse?: number

    chaos_deck?: ChaosEffectName[]
    current_chaos_effect?: ChaosEffectName | null
    chaos_deck_exhausted_count?: number
    chaos_draws_per_turn?: number
    blood_moon_active?: boolean
    mass_confusion_active?: boolean
    silence_active?: boolean
    surge_active?: boolean
    void_rift_active?: boolean
}



export type MoveAction = 'throw_onto_table' | 'throw_onto_defense' | 'throw_onto_master' | 'attack_card' | 'attack_hero'
| 'attack_life_pool' | 'end_turn' | 'sacrifice_card' | 'cast_ritual_spell' | 'choose_hero_card'



export type MoveRequest = {
    card_uuid?: string
    target_uuid?: string
    mode: GameMode
    action: MoveAction
    spell_name?: string
}



export type CardAbility = {
    trigger: 'on_play' | 'in_hand' | 'damaged' | 'turn_change'
    timers?: {
    }
}