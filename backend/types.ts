export type playerIdentifiers = {
    id: string,
    socketId: string,
    nickname?: string
}

export type matchObject = {
    players:
    {
        id: string,
        socketId: string,
        nickname: string,
        life: number,
        mana_level: number,
        hand_cards: { card_id: string, uuid: string, mana_cost: number, life: number, attack_damage: number, can_attack: boolean, player?: playerIdentifiers }[],
        table_cards: { card_id: string, uuid: string, mana_cost: number, life: number, attack_damage: number, can_attack: boolean, player?: playerIdentifiers }[]
    }[],
    current_turn_player: 0 | 1,
    match_id: string,
    start_time: string,
    total_turns_count: number
}

export type matchPlayer = matchObject['players'][0]

export type moveRequestType = {
    card: {
        uuid: string,
        place: 'hand' | 'table',
        side: 'self' | 'opponent'
    },
    mode: 'classic' | 'mode_that_i_cant_think_of_a_name_yet' | 'chaos' | 'ritual' | 'dungeon_run' | 'eclipse',
    action: 'throw_onto_table' | 'attack_enemy_card'
}