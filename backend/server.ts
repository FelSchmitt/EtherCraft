import express, { Request, Response } from 'express'
import http from 'http'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'
import { createClient, SCHEMA_FIELD_TYPE, FT_AGGREGATE_GROUP_BY_REDUCERS, FT_AGGREGATE_STEPS, RedisClientType } from 'redis'
import dotenv from 'dotenv'
import { Pool } from 'pg'
const argon2 = require('argon2')
dotenv.config()

import { verifyToken } from './middlewares'
import { playerIdentifiers } from './types'
import * as channels from './socket_channels'

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
const redisClient: RedisClientType = createClient()




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
                    `${Date.now()}_${Math.round(Math.random() * 10_000)}_${['token', 'net', 'config', 'random'][Math.round(Math.random() * 3)]}`,
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

        const passwordIsCorrect: boolean = await argon2.verify(query.rows[0].password_hash, req.body.password)

        if (!passwordIsCorrect) {
            messages.push({ code: 1, message: 'password incorrect. check if it was written correctly' })
        }

        if (messages.length > 0) {
            res.status(422).send({ messages })
            return
        }

        const token = jwt.sign({ access_token: query.rows[0].access_token }, process.env.SECRET_KEY as string, { expiresIn: '10m' })

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



const waitingQueue: playerIdentifiers[] = []

socketServer.on('connection', (client: Socket) => {
    console.log(`client ${client.id} connected`)

    client.on('disconnect', () => {
        console.log(`client ${client.id} disconnected`)
    })

    client.on('chat', (message) => {channels.broadcastUserMessage(message, socketServer)})
    client.on('find_opponent', (ids) => {channels.joinWaitingQueue({id: ids.id, socket_id: client.id, nickname: ids.nickname}, waitingQueue, redisClient, socketServer)})
    client.on('move_request', (request) => {channels.moveRequest(request, socketServer, client, redisClient)})
    client.on('clear_waiting_queue', () => {channels.clearWaitingQueue(waitingQueue, socketServer)})
    client.on('get_match', () => {channels.getMatch(client.id, client, redisClient)})
})



async function initServer(): Promise<void> {
    redisClient.on('error', (error: Error) => console.log(`Redis error: ${error}`))
    await redisClient.connect()

    try {
        await redisClient.ft.create(
            'index:matches',
            { '$.?(player1 || player2).socket_id': { type: 'TAG', AS: 'sockets_ids' } },
            { ON: 'JSON', PREFIX: 'match:' }
        )
    }
    catch (error) {
        console.log(`an error occured or index already exists: ${error.message}`)
    }

    server.listen(3001, () => console.log('backend server running on http://localhost:3001'))
}

initServer()