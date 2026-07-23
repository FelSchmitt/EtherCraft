import { Server, Socket } from 'socket.io'
import { RedisClientType } from 'redis'
import { MatchObject, MoveRequest, playerIdentifiers, GameCard, CardRarity } from './types'
import { executeAction, buildPlayerView } from './match_handlers/match_engine'



async function generateCardUuid(redisConnection: RedisClientType): Promise<string> {
    return `${await redisConnection.DBSIZE()}_${Date.now() + Math.round(Math.random() * 1_000_000)}_${Math.round(Math.random() * 100)}`
}

async function getMatchFromSocketId(socketId: string, redisConnection: RedisClientType): Promise<MatchObject | null> {
    const result: any = await redisConnection.ft.search('index:matches', `@sockets_ids:{${socketId}}`)
    if (result.total === 0) return null
    return result.documents[0].value as MatchObject
}

async function updateMatch(match: MatchObject, redisConnection: RedisClientType): Promise<void> {
    await redisConnection.json.set(match.match_id, '$', match)
}

function broadcastMatchState(match: MatchObject, socketServer: Server): void {
    for (const player of match.players) {
        socketServer.to(player.socket_id).emit('match_state', 'something')
    }
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
        players: players,
        current_turn_player: Math.round(Math.random()) as 0 | 1,
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

        const uuids = await Promise.all(Array.from({ length: 6 }, () => generateCardUuid(redisConnection)))

        const starterCards = [
            { card_id: 'giant_serpent', mana_cost: 1, base_life: 5, attack_damage: 3, classes: ['beast'], abilities: [], rarity: 'common' as CardRarity },
            { card_id: 'wendigo', mana_cost: 1, base_life: 4, attack_damage: 2, classes: ['undead'], abilities: [], rarity: 'common' as CardRarity },
            { card_id: 'shadow_demon', mana_cost: 2, base_life: 5, attack_damage: 3, classes: ['spectral'], abilities: [], rarity: 'rare' as CardRarity },
        ]

        const handsCards = playersIds.map((player, index) =>
            starterCards.map((card, cardIndex) => ({ ...card, uuid: uuids[index * 3 + cardIndex], can_attack: false, life_modifiers: [], attack_modifiers: [], life: card.base_life }))
        )

        const match = createMatch(playersIds, handsCards, matchId)

        await redisConnection.json.set(matchId, '$', match)

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

        const player = match.players.find(player => player.socket_id === client.id)
        const result = executeAction(match, player, request)

        if (!result.ok) {
            client.emit('chat', { sender: 'Server', color: '#ffaa00', text: result.message })
            return
        }

        await updateMatch(match, redisConnection)

        broadcastMatchState(match, socketServer)

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



export async function getMatch(socketId: string, client: Socket, redisConnection: RedisClientType) {
    const match = await getMatchFromSocketId(socketId, redisConnection)
    if (match) {
        client.emit('match_data', buildPlayerView(match, match.players.find(p => p.socket_id === client.id).id))
    }
}