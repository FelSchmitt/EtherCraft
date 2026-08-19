import { MatchObject, MatchPlayer, AbilityDescription } from '../types'
import { GeneratedEvent } from './events_queue'

type abilityFunctionHandler = (
    match: MatchObject,
    activePlayer: MatchPlayer,
    opponent: MatchPlayer,
    event: GeneratedEvent,
    queue: GeneratedEvent[],
    ability: AbilityDescription
) => any



export const abilitiesFunctions: abilityFunctionHandler[] = [
    (match, activePlayer, opponent, event, queue, ability) => {//add elements in an array
    },



    (match, activePlayer, opponent, event, queue, ability) => {//remove elements from an array
    },



    (match, activePlayer, opponent, event, queue, ability) => {//move elements from an array to another
    }
]