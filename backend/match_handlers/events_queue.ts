import { MatchObject, GeneratedEvent } from './types'

type EventEmitter = (match: MatchObject, queue: GeneratedEvent[]) => GeneratedEvent



export function triggerAbilities(match: MatchObject, queue: GeneratedEvent) {
}



export function endTurnAndStartNext(match: MatchObject, queue: GeneratedEvent[]) {
    switch (match.mode) {
        case 'classic':
            break

        case 'destiny':
            break

        case 'chaos':
            break

        case 'ritual':
            break

        case 'dungeon_run':
            break

        case 'eclipse':
            break
    }
}



export function removeDeadCards(match: MatchObject, queue: GeneratedEvent[]) {
    match.players.forEach(player => {
        player.table_cards.forEach((card, index) => {
            if (card.life <= 0) {
                queue.push(
                    {cardUuid: card.uuid}
                )
            }
        })
    })
}