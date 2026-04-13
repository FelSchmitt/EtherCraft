export type CardData = {
    card_id: string,
    card_number: number,
    name: string,
    total_life: number,
    type: string,
    classes: string[],
    mana_cost: number,
    abilities: Object[],
    belongs_to_decks: string[]
}

export type DeckData = {
    deck_id: string,
    deck_number: number,
    name: string,
    card_ids: string[]
}

export type AccountCardsData = {
    cards: CardData[],
    decks: DeckData[]
}