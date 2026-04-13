import { AccountCardsData } from "../types"

export default function ProfileDecks({ cards, decks }: AccountCardsData) {
    return (
        <>
            {
                decks.map((deck) => (
                    <ul key={deck.deck_id} className="flex flex-wrap overflow-x-auto min-w-[95%] mb-30">
                        <h2 className="decktitle w-full text-[40px]">{deck.name}</h2>
                        {
                            cards.filter((card) => card.belongs_to_decks.includes(deck.deck_id)).map((card) => (
                                <li key={card.card_number} className="w-45 flex flex-col items-center font-serif mr-6">
                                    <img src={`http://localhost:3001/cards/${card.card_id}.png`} alt="Imagem da Frente da Carta" />
                                    <p>{card.name}</p>
                                </li>
                            ))
                        }
                    </ul>
                ))
            }
        </>
    )
}