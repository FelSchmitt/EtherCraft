export type playerIdentifiers = {
    id: string
    socket_id: string
    nickname: string
    mode?: GameMode
}



export type CardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'titan' | 'colossus'



export type RitualSpellName = 'bloodbind' | 'ashen_strike' | 'soul_harvest' | 'purge' | 'rebirth' |
    'dark_convergence' | 'summon_from_deep' | 'annihilation' | 'necromancy_curse'



export type GameCard = {
    card_id: string
    uuid: string
    mana_cost: number
    mana_cost_modifiers: { value: number, source: string }[]
    life: number
    life_modifiers: { value: number, source: string }[]
    swapped_life?: { value: number, enemy_uuid: string } // used by the 'void rift' chaos effect
    base_life: number
    attack_damage: number
    attack_modifiers: { value: number, source: string }[]
    can_attack: boolean
    classes: string[]
    abilities: { function: Function, trigger: EventResult, replace_default_event: boolean }[]
    custom_properties: { persist: boolean, source_card_uuid?: string, properties: any[] }[] // used by the special abilities of itself and other cards
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
    player1: MatchPlayer
    player2: MatchPlayer
    current_turn_player: 'player1' | 'player2'
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
    chain_attack_damage_used?: boolean
    double_damage_bonus_used?: boolean

    eclipse_timer?: number
    eclipse_active?: boolean
    eclipse_current_max_count?: number

    chaos_deck?: ChaosEffectName[]
    current_chaos_effects?: ChaosEffectName[]
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



export type EventResult = 'turn_changed' | 'summoned' | 'died' | 'ressurected' | 'attacked_minion'
    | 'damaged' | 'card_drawn' | 'won_match' | 'ability_triggered' | 'chose_hero' | 'chose_card' | 'dice_and_coin_reset' | 'chaos_effects_applied' | 'card_sacrificed' |
    'spell_cast' | 'attacked_life_pool' | 'eclipse_began' | 'eclipse_ended' | 'minion_enabled_attack' | 'none'