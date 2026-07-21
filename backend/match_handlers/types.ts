export type playerIdentifiers = {
    id: string
    socket_id: string
    nickname: string
}



export type CardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'titan' | 'colossus'



export type RitualSpellName = 'bloodbind' | 'ashen_strike' | 'soul_harvest' | 'purge' | 'rebirth' |
'dark_convergence' | 'summon_from_deep' | 'annihilation' | 'necromancy_curse'



export type GameCard = {
    card_id: string
    uuid: string
    mana_cost: number
    life: number
    life_modifiers: { value: number, source: string }[]
    swapped_life?: { value: number, enemy_uuid: string }
    base_life: number
    attack_damage: number
    attack_modifiers: { value: number, source: string }[]
    can_attack: boolean
    classes: string[]
    abilities: CardAbility[]
    rarity: CardRarity
    is_hero?: boolean
    is_master?: boolean
    is_defense?: boolean
    owner_id?: string
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
    favorable_rolls_streak?: number
    mana_level: number
    mana_capacity: number
}



export type GameMode = 'classic' | 'destiny' | 'chaos' | 'ritual' | 'dungeon_run' | 'eclipse'



export type ChaosEffectName = 'earthquake' | 'mass_confusion' | 'blood_moon' | 'surge' | 'silence' | 'arcane_wind' | 'the_cull' | 'void_rift'



export type MatchObject = {
    match_id: string
    mode: GameMode
    players: MatchPlayer[]
    current_turn_player: 0 | 1
    start_time: string
    total_turns_count: number
    graveyard: GameCard[]
    winner_id?: string
    both_players_lost?: boolean

    action_die?: number
    fate_die?: number
    mercy_roll_used?: boolean
    reversal_coin?: boolean
    reversal_coin_counter?: number
    one_card_constraint_used?: boolean

    eclipse_timer?: number
    eclipse_active?: boolean
    eclipse_current_max_count?: number

    chaos_deck?: ChaosEffectName[]
    current_chaos_effect?: ChaosEffectName | null
    chaos_deck_exhausted_count?: number
    chaos_draws_per_turn?: number
}



export type MoveAction = 'throw_onto_table' | 'attack_minion' | 'attack_life_pool' |
    'end_turn' | 'sacrifice_card' | 'cast_ritual_spell' | 'choose_hero_minion'



export type MoveRequest = {
    card_uuid?: string
    target_uuid?: string
    mode: GameMode
    action: MoveAction
}



export type CardAbility = {
    trigger: 'on_play' | 'in_hand' | 'damaged' | 'turn_change'
}