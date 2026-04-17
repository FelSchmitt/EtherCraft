const express = require('express')
const http = require('http')
const { Pool } = require('pg')
const cors = require('cors')
var cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const { Server } = require('socket.io')
require('dotenv').config()


const corsConfig = {
    origin: 'http://localhost:3000',
    credentials: true
}


const expressServer = express()
const server = http.createServer(expressServer)
const socketServer = new Server(server, { cors: corsConfig })

const pool = new Pool({
    user: process.env.USER,
    host: 'localhost',
    database: 'ethercraft',
    password: process.env.DATABASE_PASSWORD,
    port: process.env.PORT,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
})






expressServer.use(cors(corsConfig), cookieParser(), express.json(), express.static('./assets'))

async function verifyToken(req, res, next) {//currently unused
    try {
        if (!req.body.access) {
            res.status(401).send({ message: 'not authorized' })
        }
        else {
            jwt.verify(req.body.access, process.env.SECRET_KEY)

            const decodedToken = jwt.decode(req.body.access)
            const checkUserQuery = await pool.query(`select account_id from users where access_token = '${decodedToken.access_token}'`)

            if (checkUserQuery.rowCount === 0) {
                res.status(401).send({ message: 'user does not exist' })
            }
            else {
                req.user_id = checkUserQuery.rows[0].account_id
                next()
            }
        }
    }
    catch {
        res.status(401).send({ message: 'invalid token' })
    }
}



let opponentsQueue = []






expressServer.post('/login/validatefields/newaccount', async (req, res) => {
    try {
        let messages = []

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
            res.status(422).send({ messages: messages })
        }
        else {
            const newUser = await pool.query(`insert into users (account_id, password, access_token, user_nickname, register_date, status) values ('${req.body.account_id}', '${req.body.password}', 1, '${req.body.user_nickname}', '${req.body.register_date}', 'player') returning *`)
            res.send({ message: 'account successfully created' })
        }
    }
    catch (error) {
        res.status(500).send({ serverError: error })
        console.log(error)
    }
})



expressServer.post('/login/validatefields', async (req, res) => {
    try {
        let messages = []

        const query = await pool.query(`select * from users where account_id = '${req.body.account_id}'`)

        if (query.rowCount === 0) {
            messages.push({ code: 0, message: 'account id not found. check if it was written correctly' })
        }
        else {
            if (req.body.password !== query.rows[0].password) {
                messages.push({ code: 1, message: 'password incorrect. check if it was written correctly' })
            }
        }

        if (messages.length > 0) {
            res.status(422).send({ messages: messages })
        }
        else {
            const cardIndexes = query.rows[0].account_cards.map((card, index) => `$${index + 1}`)
            const deckIndexes = query.rows[0].account_decks.map((deck, index) => `$${index + 1}`)

            const token = jwt.sign({ access_token: query.rows[0].access_token }, process.env.SECRET_KEY)

            const cardsQuery = await pool.query(`select * from game_cards where card_id in (${[...cardIndexes]})`, query.rows[0].account_cards)
            const decksQuery = await pool.query(`select * from game_decks where deck_id in (${[...deckIndexes]})`, query.rows[0].account_decks)

            res.send(
                {
                    account_id: query.rows[0].account_id,
                    user_nickname: query.rows[0].user_nickname,
                    cards: cardsQuery.rows,
                    decks: decksQuery.rows,
                    access: token
                }
            )
        }
    }
    catch (error) {
        res.status(500).send({ serverError: error })
        console.log(error)
    }
})






socketServer.on('connection', (client) => {
    console.log(`user ${client.id} connected`)

    client.on('disconnect', (client) => {
        console.log(`user ${client.id} disconnected`)
    })

    client.on('chat', (message) => {
        console.log(`Message from frontend: ${message.text}`)
        socketServer.emit('chat', { sender: message.sender, color: '#1cbe00', text: message.text })
    })



    client.on('find_opponent', (message) => {
        opponentsQueue.push({ id: message.user_id, socketId: client.id })//currently simply adds the id of the user from the frontend to the queue. Later will be added a middleware to verify the identity

        if (opponentsQueue.length >= 2) {
            const player1 = opponentsQueue.shift()
            const player2 = opponentsQueue.shift()

            socketServer.in(player1.socketId).socketsJoin('test_room')
            socketServer.in(player2.socketId).socketsJoin('test_room')
        }
    })

    client.on('build_scene', async () => {
        const sessionQuery = await pool.query(`select * from active_sessions where session_id = 'test_match'`)

        socketServer.emit('scene_add_objects', sessionQuery.rows[0])
    })
})






// const queueCounter = setInterval(() => {
//     opponentsQueue.forEach(player => {
//         player.waitingTime += 2
//     })
// }, 2000)

server.listen(3001, () => {
    console.log('backend server running on http://localhost:3001')
})