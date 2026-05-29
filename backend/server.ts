import express, { Request, Response } from 'express'
import http from 'http'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'
import { createClient } from 'redis'
import dotenv from 'dotenv'
import { Pool } from 'pg'
dotenv.config()

import * as gameServerTypes from './types'
import { verifyToken } from './middlewares'
import { moveRulesList } from './game_modes_rules'

const corsConfig = {
    origin: 'http://localhost:3000',
    credentials: true
}

const pool = new Pool({
    user: process.env.USER,
    host: 'localhost',
    database: 'ethercraft',
    password: process.env.DATABASE_PASSWORD,
    port: process.env.PORT ? parseInt(process.env.PORT) : 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
})

const expressServer = express()
const server = http.createServer(expressServer)
const socketServer = new Server(server, { cors: corsConfig })
const redisClient = createClient()

const opponentsQueue: gameServerTypes.playerIdentifiers[] = []






expressServer.use(cors(corsConfig), cookieParser(), express.json(), express.static('./assets'))



expressServer.post('/login/validatefields/newaccount', async (req: Request, res: Response) => {
    try {
        const messages: { code: [number, number], message: string }[] = []

        const idQuery = await pool.query(`select account_id from users where account_id = '${req.body.account_id}'`)
        const nicknameQuery = await pool.query(`select user_nickname from users where user_nickname = '${req.body.user_nickname}'`)

        if (idQuery.rowCount > 0) {
            messages.push({ code: [0, 0], message: 'account id already exists. choose another one' })
        }
        if (nicknameQuery.rowCount > 0) {
            messages.push({ code: [2, 0], message: 'nickname already exists. choose another one' })
        }
        if (req.body.account_id.length < 5) {
            messages.push({ code: [0, 1], message: 'account id too short. must be 5-20 characters' })
        }
        if (req.body.account_id.length > 20) {
            messages.push({ code: [0, 2], message: 'account id too long. must be 5-20 characters' })
        }
        if (req.body.password.length < 10) {
            messages.push({ code: [1, 0], message: 'password too short. must be 10-45 characters' })
        }
        if (req.body.password.length > 45) {
            messages.push({ code: [1, 1], message: 'password too long. must be 10-45 characters' })
        }
        if (req.body.user_nickname.length < 5) {
            messages.push({ code: [2, 1], message: 'nickname too short. must be 5-30 characters' })
        }
        if (req.body.user_nickname.length > 30) {
            messages.push({ code: [2, 2], message: 'nickname too long. must be 5-30 characters' })
        }

        if (messages.length > 0) {
            res.status(422).send({ messages })
        } else {
            await pool.query(`insert into users (account_id, password, access_token, user_nickname, register_date, status) values ('${req.body.account_id}', '${req.body.password}', 1, '${req.body.user_nickname}', '${req.body.register_date}', 'player') returning *`)
            res.send({ message: 'account successfully created' })
        }
    } catch (error) {
        res.status(500).send({ serverError: error })
        console.log(error)
    }
})



expressServer.post('/login/validatefields', async (req: Request, res: Response) => {
    try {
        const messages: Array<{ code: number, message: string }> = []

        const query = await pool.query(`select * from users where account_id = '${req.body.account_id}'`)

        if (query.rowCount === 0) {
            messages.push({ code: 0, message: 'account id not found. check if it was written correctly' })
        } else {
            if (req.body.password !== query.rows[0].password) {
                messages.push({ code: 1, message: 'password incorrect. check if it was written correctly' })
            }
        }

        if (messages.length > 0) {
            res.status(422).send({ messages })
        }
        else {
            const cardIndexes = query.rows[0].account_cards.map((card: any, index: number) => `$${index + 1}`)
            const deckIndexes = query.rows[0].account_decks.map((card: any, index: number) => `$${index + 1}`)

            const token = jwt.sign({ access_token: query.rows[0].access_token }, process.env.SECRET_KEY as string)

            const cardsQuery = await pool.query(`select * from game_cards where card_id in (${[...cardIndexes]})`, query.rows[0].account_cards)
            const decksQuery = await pool.query(`select * from game_decks where deck_id in (${[...deckIndexes]})`, query.rows[0].account_decks)

            res.send({
                account_id: query.rows[0].account_id,
                user_nickname: query.rows[0].user_nickname,
                cards: cardsQuery.rows,
                decks: decksQuery.rows,
                access: token
            })
        }
    }
    catch (error) {
        res.status(500).send({ serverError: error })
        console.log(error)
    }
})






async function generateCardUuid(): Promise<string> {
    return `${await redisClient.DBSIZE()}-${Date.now() + Math.round(Math.random() * 1000000)}-${Math.round(Math.random() * 100)}`
}

socketServer.on('connection', (client: Socket) => {
    console.log(`client ${client.id} connected`)

    client.on('disconnect', () => {
        console.log(`client ${client.id} disconnected`)
    })

    client.on('chat', (message: { sender: string, text: string }) => {
        console.log(`Message from frontend: ${message.text}`)
        socketServer.emit('chat', { sender: message.sender, color: '#1cbe00', text: message.text })
    })


    client.on('find_opponent', async (identifiers: { id: string, nickname: string }) => {
        opponentsQueue.push({ id: identifiers.id, socketId: client.id, nickname: identifiers.nickname })

        if (opponentsQueue.length >= 2) {
            const playersIds = [opponentsQueue.shift()!, opponentsQueue.shift()!]
            const matchId = `match:${Date.now()}-${Math.round(Math.random() * 100)}`
            const uuids = await Promise.all(Array.from({ length: 6 }, () => generateCardUuid()))

            const playersHandCards = [
                { player: playersIds[0].id, card_id: 'giant_serpent', uuid: uuids[0], mana_cost: 1, life: 5, attack_damage: 3, can_attack: false },
                { player: playersIds[0].id, card_id: 'wendigo', uuid: uuids[1], mana_cost: 1, life: 4, attack_damage: 2, can_attack: false },
                { player: playersIds[0].id, card_id: 'shadow_demon', uuid: uuids[2], mana_cost: 2, life: 5, attack_damage: 3, can_attack: false },
                { player: playersIds[1].id, card_id: 'giant_serpent', uuid: uuids[3], mana_cost: 1, life: 5, attack_damage: 3, can_attack: false },
                { player: playersIds[1].id, card_id: 'wendigo', uuid: uuids[4], mana_cost: 1, life: 4, attack_damage: 2, can_attack: false },
                { player: playersIds[1].id, card_id: 'shadow_demon', uuid: uuids[5], mana_cost: 2, life: 5, attack_damage: 3, can_attack: false },
            ]

            await redisClient.json.set(matchId, '$',
                {
                    players: [
                        {
                            id: playersIds[0].id,
                            socketId: playersIds[0].socketId,
                            nickname: playersIds[0].nickname,
                            life: 10,
                            mana_level: 1,
                            hand_cards: playersHandCards.filter(card => card.player === playersIds[0].id),
                            table_cards: []
                        },
                        {
                            id: playersIds[1].id,
                            socketId: playersIds[1].socketId,
                            nickname: playersIds[1].nickname,
                            life: 10,
                            mana_level: 1,
                            hand_cards: playersHandCards.filter(card => card.player === playersIds[1].id),
                            table_cards: []
                        }
                    ],
                    current_turn_player: Math.round(Math.random()),
                    match_id: matchId,
                    start_time: (new Date()).toISOString(),
                    total_turns_count: 0
                }
            )

            socketServer.to([playersIds[0].socketId, playersIds[1].socketId]).socketsJoin(matchId)

            playersIds.forEach((player, index) => {
                socketServer.to(player.socketId).emit('build_match',
                    {
                        hand_cards: playersHandCards.filter(card => card.player === player.id),
                        table_cards: null,
                        life: 10,
                        mana_level: 1,
                        opponent: {
                            hand_cards: 3,
                            table_cards: null,
                            id: playersIds[index === 0 ? 1 : 0].id,
                            nickname: playersIds[index === 0 ? 1 : 0].nickname,
                            life: 10,
                            mana_level: 1
                        }
                    }
                )

                socketServer.to(playersIds[index].socketId).emit(
                    'chat',
                    { sender: 'Server', color: '#ffee00', text: `You joined the match ${matchId} with ${playersIds[index === 0 ? 1 : 0].nickname}` }
                )
            })
        }
    })


    client.on('move_request', async (request: gameServerTypes.moveRequestType) => {
        try {
            const correspondingMatch = await redisClient.ft.search('index:matches', '')

            if (correspondingMatch) {
                for (const rule of moveRulesList[request.action]) {
                    if (rule.function()) {
                    }
                    else {
                        client.emit('chat', { sender: 'Server', color: '#ffee00', text: rule.failMessage })
                        break
                    }
                }
            }
            else {
                client.emit('chat', { sender: 'Server', color: '#ffaa00', text: 'Movement denied' })
            }
        }
        catch (error) {
            client.emit('chat', { sender: 'Server', color: '#ff5500', text: `unexpected error in the move request channel: ${error}` })
            console.log(error)
        }
    })


    client.on('clear_waiting_queue', () => {
        opponentsQueue.splice(0)
        socketServer.emit('chat', { sender: 'Server', color: '#ffee00', text: 'The opponents waiting queue was cleared' })
    })

    client.on('delete_all_matches', () => {
    })

    client.on('get_match', () => {
    })
})


async function initServer(): Promise<void> {
    redisClient.on('error', (error: Error) => console.error(`error when connecting to redis: ${error}`))
    await redisClient.connect()

    try {
        await redisClient.ft.create(
            'index:matches',
            {
                '$.players': { type: 'TAG', AS: 'players' },
            },
            {
                ON: 'JSON',
                PREFIX: 'match:',
            }
        )
    }
    catch (error) {
        console.log(`an error occurred or index already exists: ${error}`)
    }

    server.listen(3001, () => {
        console.log('backend server running on http://localhost:3001')
    })
}

initServer().catch(console.error)