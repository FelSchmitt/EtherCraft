import express, { Request, Response } from 'express'
import http from 'http'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'
import { createClient } from 'redis'
import dotenv from 'dotenv'
import { Pool } from 'pg'
const argon2 = require('argon2')
dotenv.config()

import { playerIdentifiers, MatchObject, MoveRequest, GameMode } from './types'
import { verifyToken } from './middlewares'
import { executeAction, buildPlayerView, endTurnAndStartNext, getOpponent } from './match_engine'

const corsConfig = { origin: 'http://localhost:3000', credentials: true }

export const pool = new Pool({
    user: process.env.USER,
    host: 'localhost',
    database: 'ethercraft',
    password: process.env.DATABASE_PASSWORD,
    port: 5000,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
})

const expressServer = express()
const server = http.createServer(expressServer)
const socketServer = new Server(server, { cors: corsConfig })
export const redisClient = createClient()

const opponentsQueue: playerIdentifiers[] = []



expressServer.use(cors(corsConfig), cookieParser(), express.json(), express.static('./assets'))



expressServer.post('/login/validatefields/newaccount', async (req: Request, res: Response) => {
    try {
        const messages: { code: [number, number], message: string }[] = []

        const idQuery = await pool.query(`select account_id from users where account_id = $1`, [req.body.account_id])
        const nicknameQuery = await pool.query(`select nickname from users where nickname = $1`, [req.body.username])

        if (idQuery.rowCount > 0) messages.push({ code: [0, 0], message: 'account id already exists. choose another one' })

        if (req.body.account_id.length < 5) messages.push({ code: [0, 1], message: 'account id too short. must be 5-20 characters' })

        if (req.body.account_id.length > 20) messages.push({ code: [0, 2], message: 'account id too long. must be 5-20 characters' })

        if (req.body.password.length < 10) messages.push({ code: [1, 0], message: 'password too short. must be 10-45 characters' })

        if (req.body.password.length > 45) messages.push({ code: [1, 1], message: 'password too long. must be 10-45 characters' })

        if (req.body.user_nickname.length < 5) messages.push({ code: [2, 1], message: 'nickname too short. must be 5-30 characters' })

        if (req.body.user_nickname.length > 30) messages.push({ code: [2, 2], message: 'nickname too long. must be 5-30 characters' })

        if (messages.length > 0) {
            res.status(422).send({ messages: messages })
        }
        else {
            const hash = await argon2.hash(req.body.password)

            await pool.query(
                `insert into users (account_id, password_hash, access_token, nickname, register_date) values ($1, $2, $3, $4, $5)`,
                [
                    req.body.account_id,
                    hash,
                    `${Date.now()}_${Math.round(Math.random() * 10000)}_${['token', 'net', 'config', 'random'][Math.round(Math.random() * 3)]}`,
                    req.body.user_nickname,
                    req.body.register_date,
                ]
            )
            res.status(201).send({ message: 'account successfully created' })
        }
    }
    catch (error) {
        res.status(500).send({ serverError: error })
        console.error(error)
    }
})



expressServer.post('/login/validatefields', async (req: Request, res: Response) => {
    try {
        const messages: { code: number, message: string }[] = []
        const query = await pool.query(`select * from users where account_id = $1`, [req.body.account_id])

        if (query.rows.length === 0) {
            messages.push({ code: 0, message: 'user not found. check if it was written correctly' })
        }

        const passwordIsCorrect = await argon2.verify(query.rows[0].password_hash, req.body.password)

        if (!passwordIsCorrect) {
            messages.push({ code: 1, message: 'password incorrect. check if it was written correctly' })
        }

        if (messages.length > 0) {
            res.status(422).send({ messages })
            return
        }

        const token = jwt.sign({ access_token: query.rows[0].access_token }, process.env.SECRET_KEY as string, {expiresIn: '10m'})

        const cardIds = query.rows[0].account_cards ?? []
        const deckIds = query.rows[0].account_decks ?? []

        const cardsQuery = cardIds.length
            ? await pool.query(`select * from game_cards where card_id = any($1)`, [cardIds])
            : { rows: [] }
        const decksQuery = deckIds.length
            ? await pool.query(`select * from user_decks where deck_id = any($1)`, [deckIds])
            : { rows: [] }

        res.send({
            account_id: query.rows[0].account_id,
            user_nickname: query.rows[0].nickname,
            cards: cardsQuery.rows,
            decks: decksQuery.rows,
            access: token,
        })
    } catch (error) {
        res.status(500).send({ serverError: error })
        console.error(error)
    }
})



// Helpers

async function generateCardUuid(): Promise<string> {
    return `${await redisClient.DBSIZE()}-${Date.now() + Math.round(Math.random() * 1_000_000)}-${Math.round(Math.random() * 100)}`
}

async function getMatchForSocket(socketId: string): Promise<MatchObject | null> {
    const matchId = await redisClient.get(`socket_match:${socketId}`)
    if (!matchId) return null
    const data = await redisClient.json.get(matchId)
    return data ? (data as MatchObject) : null
}

async function saveMatch(match: MatchObject): Promise<void> {
    await redisClient.json.set(match.match_id, '$', match as any)
}

function broadcastMatchState(match: MatchObject): void {
    for (const player of match.players) {
        socketServer.to(player.socketId).emit('match_state', buildPlayerView(match, player.id))
    }
}

// Build the initial MatchObject for a given mode.
function buildMatchState(
    mode: GameMode,
    playersIds: playerIdentifiers[],
    handCards: MatchObject['players'][0]['hand_cards'][],
    matchId: string
): MatchObject {
    const startMana = mode === 'destiny' ? 2 : 1

    const players = playersIds.map((p, i) => ({
        id: p.id,
        socketId: p.socketId,
        nickname: p.nickname ?? p.id,
        hand_cards: handCards[i],
        table_cards: [] as MatchObject['players'][0]['table_cards'],
        mana_level: startMana,
        mana_capacity: startMana,
        // Mode-specific life targets
        ...(mode === 'ritual' ? { soul_vessel_life: 20, ritual_energy: 3 } : {}),
        ...(mode === 'eclipse' ? { life_pool: 30 } : {}),
        ...(mode === 'chaos' ? { master_cards: [] as any[], defense_cards: [] as any[] } : {}),
    }))

    const base: MatchObject = {
        match_id: matchId,
        mode,
        players: players as MatchObject['players'],
        current_turn_player: Math.round(Math.random()) as 0 | 1,
        start_time: new Date().toISOString(),
        total_turns_count: 0,
    }

    if (mode === 'eclipse') {
        base.eclipse_timer = 12
        base.eclipse_active = false
        base.eclipse_reset_count = 0
    }

    if (mode === 'chaos') {
        base.chaos_deck = []   // filled on first draw
        base.chaos_deck_exhausted_count = 0
        base.chaos_draws_per_turn = 1
        base.current_chaos_effect = null
    }

    if (mode === 'destiny') {
        base.action_die = null
        base.fate_die = null
        base.favorable_rolls_streak = 0
        base.mercy_roll_used = false
        base.reversal_coin_counter = 0
    }

    return base
}



// ─── Socket events ────────────────────────────────────────────────────────────

socketServer.on('connection', (client: Socket) => {
    console.log(`client ${client.id} connected`)

    client.on('disconnect', async () => {
        console.log(`client ${client.id} disconnected`)
        await redisClient.del(`socket_match:${client.id}`)
    })

    client.on('chat', (message: { sender: string; text: string }) => {
        console.log(`Message from frontend: ${message.text}`)
        socketServer.emit('chat', { sender: message.sender, color: '#1cbe00', text: message.text })
    })



    client.on('find_opponent', async (identifiers: { id: string; nickname: string; mode?: GameMode }) => {
        const mode: GameMode = identifiers.mode ?? 'classic'
        opponentsQueue.push({ id: identifiers.id, socketId: client.id, nickname: identifiers.nickname })

        if (opponentsQueue.length >= 2) {
            const playersIds = [opponentsQueue.shift()!, opponentsQueue.shift()!]
            const matchId = `match:${Date.now()}-${Math.round(Math.random() * 100)}`

            // Placeholder hand cards — replace with real deck queries once deck management is wired
            const uuids = await Promise.all(Array.from({ length: 6 }, () => generateCardUuid()))

            const starterCards = [
                { card_id: 'giant_serpent', name: 'Giant Serpent', mana_cost: 1, life: 5, max_life: 5, attack_damage: 3, can_attack: false, classes: ['beast'], abilities: [], rarity: 'common' },
                { card_id: 'wendigo', name: 'Wendigo', mana_cost: 1, life: 4, max_life: 4, attack_damage: 2, can_attack: false, classes: ['undead'], abilities: [], rarity: 'common' },
                { card_id: 'shadow_demon', name: 'Shadow Demon', mana_cost: 2, life: 5, max_life: 5, attack_damage: 3, can_attack: false, classes: ['shadow'], abilities: [], rarity: 'uncommon' },
            ]

            const handCards = playersIds.map((_, pi) =>
                starterCards.map((card, ci) => ({ ...card, player: playersIds[pi].id, uuid: uuids[pi * 3 + ci] }))
            )

            const match = buildMatchState(mode, playersIds, handCards, matchId)

            await redisClient.json.set(matchId, '$', match as any)
            await redisClient.set(`socket_match:${playersIds[0].socketId}`, matchId)
            await redisClient.set(`socket_match:${playersIds[1].socketId}`, matchId)

            socketServer.to([playersIds[0].socketId, playersIds[1].socketId]).socketsJoin(matchId)

            // Notify both players: use the existing build_match format for the 3D scene
            for (let i = 0; i < 2; i++) {
                const me = match.players[i]
                const opp = match.players[i === 0 ? 1 : 0]

                socketServer.to(me.socketId).emit('build_match', {
                    hand_cards: me.hand_cards,
                    table_cards: null,
                    life: 30,
                    mana_level: me.mana_level,
                    opponent: {
                        hand_cards: opp.hand_cards.length,
                        table_cards: null,
                        id: opp.id,
                        nickname: opp.nickname,
                        life: 30,
                        mana_level: opp.mana_level,
                    },
                })

                socketServer.to(me.socketId).emit('chat', {
                    sender: 'Server',
                    color: '#ffee00',
                    text: `You joined match ${matchId} against ${opp.nickname} (mode: ${mode})`,
                })
            }

            // Send full typed state to both
            broadcastMatchState(match)
        }
    })



    client.on('move_request', async (request: MoveRequest) => {
        try {
            const match = await getMatchForSocket(client.id)
            if (!match) {
                client.emit('chat', { sender: 'Server', color: '#ff5500', text: 'You are not in a match' })
                return
            }

            const player = match.players.find(p => p.socketId === client.id)
            if (!player) {
                client.emit('chat', { sender: 'Server', color: '#ff5500', text: 'Player not found in match' })
                return
            }

            const result = executeAction(match, player, request)

            if (!result.ok) {
                client.emit('chat', { sender: 'Server', color: '#ffaa00', text: result.message ?? 'Move denied' })
                return
            }

            await saveMatch(match)

            // Update the 3D scene for card movement
            if (request.action === 'throw_onto_table' && request.card) {
                const opponent = getOpponent(match, player)
                const playedCard = [...player.table_cards, ...(player.defense_cards ?? [])].find(c => c.uuid === request.card!.uuid)

                client.emit('card_update', {
                    uuid: request.card.uuid,
                    id: request.card.uuid,
                    place: 'table',
                    side: 'self',
                })
                socketServer.to(opponent.socketId).emit('card_update', {
                    uuid: undefined,
                    id: playedCard?.card_id,
                    place: 'table',
                    side: 'opponent',
                })
            }

            // Full state sync to both players
            broadcastMatchState(match)

            if (match.winner_id) {
                socketServer.to(match.match_id).emit('match_over', { winner_id: match.winner_id })
            }
        } catch (error) {
            client.emit('chat', { sender: 'Server', color: '#ff5500', text: `Server error: ${error}` })
            console.error(error)
        }
    })



    client.on('clear_waiting_queue', () => {
        opponentsQueue.splice(0)
        socketServer.emit('chat', { sender: 'Server', color: '#ffee00', text: 'Opponents queue cleared' })
    })

    client.on('get_match', async () => {
        const match = await getMatchForSocket(client.id)
        if (match) {
            client.emit('match_data', buildPlayerView(match, match.players.find(p => p.socketId === client.id)!.id))
        }
    })
})



async function initServer(): Promise<void> {
    redisClient.on('error', (error: Error) => console.error(`Redis error: ${error}`))
    await redisClient.connect()

    try {
        await redisClient.ft.create(
            'index:matches',
            { '$.players': { type: 'TAG', AS: 'players' } },
            { ON: 'JSON', PREFIX: 'match:' }
        )
    } catch {
        console.log('Redis search index already exists or could not be created')
    }

    server.listen(3001, () => console.log('Backend server running on http://localhost:3001'))
}

initServer().catch(console.error)