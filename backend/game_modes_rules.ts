import { matchObject, matchPlayer, moveRequestType } from "./types"

export const moveRulesList = {
    classic: {
        throw_onto_table: [
            { function: (match: matchObject, player: matchPlayer, request: moveRequestType) => match.players[match.current_turn_player] === player, failMessage: "It's your opponent's turn" },
            { function: (match: matchObject, player: matchPlayer, request: moveRequestType) => player.hand_cards.find(card => card.uuid === request.card.uuid), failMessage: "Card not found in your hand" },
            { function: (match: matchObject, player: matchPlayer, request: moveRequestType) => player.mana_level >= player.hand_cards.find(card => card.uuid === request.card.uuid).mana_cost, failMessage: "You don't have enough mana" },
            {
                function: (match: matchObject, player: matchPlayer, request: moveRequestType) => {
                    const card = player.hand_cards.find(card => card.uuid === request.card.uuid)

                    player.table_cards.push(card)
                    player.hand_cards.splice(player.hand_cards.indexOf(card), 1)

                    return true
                },
                failMessage: "Could not update the match"
            }
        ],
        attack_enemy_card: [
            { function: (match: matchObject, player: matchPlayer, request: moveRequestType) => match.players[match.current_turn_player] === player, failMessage: "It's your opponent's turn" },
            { function: (match: matchObject, player: matchPlayer, request: moveRequestType) => player.hand_cards.find(card => card.uuid === request.card.uuid), failMessage: "Card not found in your hand" },
            { function: (match: matchObject, player: matchPlayer, request: moveRequestType) => player.hand_cards.find(card => card.uuid === request.card.uuid).can_attack, failMessage: "This card must wait a turn to attack" },
            {
                function: (match: matchObject, player: matchPlayer, request: moveRequestType) => {
                    const card = player.hand_cards.find(card => card.uuid === request.card.uuid)

                    player.table_cards.push(card)
                    player.hand_cards.splice(player.hand_cards.indexOf(card), 1)

                    return true
                },
                failMessage: "Could not update the match"
            }
        ]
    }
}