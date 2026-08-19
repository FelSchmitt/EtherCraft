import { Server, Socket } from 'socket.io'
import { RedisClientType } from 'redis'
import { MatchObject, MoveRequest, playerIdentifiers, GameCard, EventResult } from './types'
import { testCards } from './test_cards'
import { validateAction } from './match_handlers/game_modes_rules'
import { createMatchEventsQueue } from './match_handlers/events_queue'



async function generateCardUuid(redisConnection: RedisClientType): Promise<string> {
    return `${await redisConnection.DBSIZE()}_${Date.now() + Math.round(Math.random() * 1_000_000)}_${Math.round(Math.random() * 100)}`
}

async function getMatchFromSocketId(socketId: string, redisConnection: RedisClientType): Promise<MatchObject | null> {
    const result: any = await redisConnection.ft.search('index:matches', `@sockets_ids:{${socketId}}`)
    if (result.total === 0) return null
    return result.documents[0].value as MatchObject
}

async function updateMatch(match: MatchObject, redisConnection: RedisClientType): Promise<void> {
    await redisConnection.json.set(match.match_id, '$', JSON.stringify(match))
}

function createMatch(playersIds: playerIdentifiers[], handCards: GameCard[][], matchId: string): MatchObject {
    const mode = playersIds[0].mode ?? 'classic'
    const startMana = mode === 'destiny' ? 2 : 1

    const players = playersIds.map((player, index) => ({
        id: player.id,
        socket_id: player.socket_id,
        nickname: player.nickname,
        hand_cards: handCards[index],
        table_cards: [],
        deck: [],
        mana_level: startMana,
        mana_capacity: startMana,
        ...(mode === 'destiny' ? { favorable_rolls_streak: 0 } : {}),
        ...(mode === 'ritual' ? { soul_vessel_life: 20, ritual_energy: 3 } : {}),
        ...(mode === 'eclipse' ? { life_pool: 30 } : {}),
    }))

    const base: MatchObject = {
        match_id: matchId,
        mode,
        player1: players[0],
        player2: players[1],
        current_turn_player: (['player1', 'player2'][Math.round(Math.random())]) as 'player1' | 'player2',
        start_time: new Date().toISOString(),
        total_turns_count: 0,
        graveyard: []
    }

    if (mode === 'eclipse') {
        base.eclipse_timer = 12
        base.eclipse_active = false
        base.eclipse_current_max_count = 0
    }

    if (mode === 'chaos') {
        base.chaos_deck = []
        base.chaos_deck_exhausted_count = 0
        base.chaos_draws_per_turn = 1
        base.current_chaos_effects = []
    }

    if (mode === 'destiny') {
        base.action_die = null
        base.fate_die = null
        base.mercy_roll_used = false
        base.reversal_coin = false
        base.reversal_coin_counter = 0
    }

    return base
}






export function broadcastUserMessage(message: { sender: string, text: string }, socketServer: Server) {
    console.log(`Message from frontend: ${message.text}`)
    socketServer.emit('chat', { sender: message.sender, color: '#1cbe00', text: message.text })
}



export async function joinWaitingQueue(identifiers: playerIdentifiers, waitingQueue: playerIdentifiers[], redisConnection: RedisClientType, socketServer: Server) {
    waitingQueue.push(identifiers)

    if (waitingQueue.length >= 2) {
        const playersIds = [waitingQueue.shift(), waitingQueue.shift()]
        const matchId = `match:${Date.now()}_${Math.round(Math.random() * 100)}`

        const uuids = await Promise.all(Array.from({ length: testCards.length * 2 }, () => generateCardUuid(redisConnection)))

        const handsCards = playersIds.map((player, index) =>
            testCards.map((card, cardIndex) => (
                {
                    uuid: uuids[index * testCards.length + cardIndex],
                    card_id: card.card_id,
                    mana_cost: card.mana_cost,
                    base_life: card.base_life,
                    life: card.base_life,
                    attack_damage: card.attack_damage,
                    life_modifiers: [],
                    attack_modifiers: [],
                    mana_cost_modifiers: [],

                    classes: card.classes.map(cardClass => (
                        cardClass.functionIndex ?
                            { name: cardClass.name, functionIndex: cardClass.functionIndex, trigger: cardClass.trigger } :
                            { name: cardClass.name }
                    )),

                    abilities: card.abilities.map(ability => (
                        { functionReferences: ability.functionReferences, trigger: ability.trigger, replace_default_event: ability.replace_default_event }
                    )),

                    custom_properties: [],
                    can_attack: false,
                    rarity: card.rarity,
                }
            ))
        )

        const match = createMatch(playersIds, handsCards, matchId)

        await redisConnection.json.set(matchId, '$', JSON.stringify(match))

        socketServer.to([playersIds[0].socket_id, playersIds[1].socket_id]).socketsJoin(matchId)
    }
}



export async function moveRequest(request: MoveRequest, socketServer: Server, client: Socket, redisConnection: RedisClientType) {
    try {
        const match = await getMatchFromSocketId(client.id, redisConnection)

        if (!match) {
            client.emit('chat', { sender: 'Server', color: '#ffaa00', text: 'You are not in a match' })
            return
        }

        const player = match.player1.socket_id === client.id ? match.player1 : match.player2
        const opponent = match.player1.socket_id === client.id ? match.player2 : match.player1

        const result = validateAction(match, player, opponent, request)
        if (!result.ok) {
            client.emit('chat', { sender: 'Server', color: '#ffaa00', text: result.message })
            return
        }

        const moveResults = createMatchEventsQueue(match, player, opponent, request)

        socketServer.to(match.player1.socket_id).emit('move_response', moveResults)
        socketServer.to(match.player2.socket_id).emit('move_response', moveResults)

        await updateMatch(match, redisConnection)

        if (match.winner_id) {
            socketServer.to(match.match_id).emit('match_over', { winner_id: match.winner_id })
        }
    }
    catch (error) {
        client.emit('chat', { sender: 'Server', color: '#ff5500', text: `Server error: ${error}` })
        console.error(error)
    }
}



export function clearWaitingQueue(waitingQueue: playerIdentifiers[], socketServer: Server) {
    waitingQueue.splice(0)
    socketServer.emit('chat', { sender: 'Server', color: '#ffee00', text: 'Players waiting queue cleared' })
}



export async function getMatch(client: Socket, redisConnection: RedisClientType) {
    const match = await getMatchFromSocketId(client.id, redisConnection)
    if (match) {
        client.emit('match_data', match)
    }
}