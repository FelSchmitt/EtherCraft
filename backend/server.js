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
            const checkUserQuery = await pool.query(`select * from users where access_token = '${decodedToken.access_token}'`)

            if (checkUserQuery.rowCount === 0) {
                res.status(401).send({ message: 'user does not exist' })
            }
            else {
                req.user_data = checkUserQuery.rows[0]
                next()
            }
        }
    }
    catch {
        res.status(401).send({ message: 'invalid token' })
    }
}






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










let opponentsQueue = []

let activeMatches = []



let moveRulesList = {
    throw_onto_table: [
        { function: (match, player, request) => match.players[match.current_turn_player] === player, failMessage: "It's your opponent's turn" },
        { function: (match, player, request) => player.hand_cards.find(card => card.uuid === request.card.uuid), failMessage: "Card not found in your hand" },
        { function: (match, player, request) => player.mana_level >= player.hand_cards.find(card => card.uuid === request.card.uuid).mana_cost, failMessage: "You don't have enough mana" },
        {
            function: (match, player, request) => {
                const card = player.hand_cards.find(card => card.uuid === request.card.uuid)

                match.players.forEach((playerToSendUpdate, index) => {
                    socketServer.to(playerToSendUpdate.socketId).emit(
                        'card_update',
                        playerToSendUpdate === player ? { uuid: card.uuid, place: 'table', side: 'self' } : { place: 'table', side: 'opponent' }
                    )
                })
                player.table_cards.push(card)
                player.hand_cards.splice(player.hand_cards.indexOf(card), 1)

                return true
            },
            failMessage: "Could not update the match"
        },
    ],

    attack_enemy_card: [
        { function: (match, player, request) => match.players[match.current_turn_player] === player, failMessage: "It's your opponent's turn" },
        { function: (match, player, request) => player.hand_cards.find(card => card.uuid === request.card.uuid), failMessage: "Card not found in your hand" },
        { function: (match, player, request) => player.hand_cards.find(card => card.uuid === request.card.uuid).can_attack, failMessage: "This card must wait a turn to attack" },
        {
            function: (match, player, request) => {
                const card = player.hand_cards.find(card => card.uuid === request.card.uuid)

                match.players.forEach((playerToSendUpdate, index) => {
                    socketServer.to(playerToSendUpdate.socketId).emit(
                        'card_update',
                        playerToSendUpdate === player ? { uuid: card.uuid, place: 'table', side: 'self' } : { place: 'table', side: 'opponent' }
                    )
                })
                player.table_cards.push(card)
                player.hand_cards.splice(player.hand_cards.indexOf(card), 1)

                return true
            },
            failMessage: "Could not update the match"
        },
    ],
}



function generateCardUuid() {
    return `${activeMatches.length}-${Date.now() + Math.round(Math.random() * 1000000)}-${Math.round(Math.random() * 100)}`
}



socketServer.on('connection', (client) => {
    console.log(`client ${client.id} connected`)

    client.on('disconnect', (client) => {
        console.log(`client ${client.id} disconnected`)
    })

    client.on('chat', (message) => {
        console.log(`Message from frontend: ${message.text}`)
        socketServer.emit('chat', { sender: message.sender, color: '#1cbe00', text: message.text })
    })



    client.on('find_opponent', (identifiers) => {
        opponentsQueue.push({ id: identifiers.id, socketId: client.id, nickname: identifiers.nickname })

        if (opponentsQueue.length >= 2) {
            const playersIds = [opponentsQueue.shift(), opponentsQueue.shift()]
            const matchId = `match-${Date.now()}-${Math.round(Math.random() * 100)}`
            const playersHandCards = [
                { player: playersIds[0].id, card_id: 'giant_serpent', uuid: generateCardUuid(), mana_cost: 1, life: 5, attack_damage: 3, can_attack: false },
                { player: playersIds[0].id, card_id: 'wendigo', uuid: generateCardUuid(), mana_cost: 1, life: 4, attack_damage: 2, can_attack: false },
                { player: playersIds[0].id, card_id: 'shadow_demon', uuid: generateCardUuid(), mana_cost: 2, life: 5, attack_damage: 3, can_attack: false },
                { player: playersIds[1].id, card_id: 'giant_serpent', uuid: generateCardUuid(), mana_cost: 1, life: 5, attack_damage: 3, can_attack: false },
                { player: playersIds[1].id, card_id: 'wendigo', uuid: generateCardUuid(), mana_cost: 1, life: 4, attack_damage: 2, can_attack: false },
                { player: playersIds[1].id, card_id: 'shadow_demon', uuid: generateCardUuid(), mana_cost: 2, life: 5, attack_damage: 3, can_attack: false },
            ]

            activeMatches.push(
                {
                    players: [
                        {
                            id: playersIds[0].id,
                            socketId: playersIds[0].socketId,
                            nickname: playersIds[0].nickname,
                            life: 10,
                            mana_level: 1,
                            hand_cards: playersHandCards.filter(card => card.player === playersIds[0].id),
                            table_cards: [],
                        },
                        {
                            id: playersIds[1].id,
                            socketId: playersIds[1].socketId,
                            nickname: playersIds[1].nickname,
                            life: 10,
                            mana_level: 1,
                            hand_cards: playersHandCards.filter(card => card.player === playersIds[1].id),
                            table_cards: [],
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

    client.on('move_request', (request) => {
        try {
            const correspondingMatch = activeMatches.find(match => match.players.some(player => player.socketId === client.id))
            const player = correspondingMatch.players.find(player => player.socketId === client.id)

            if (correspondingMatch && player) {
                for (const rule of moveRulesList[request.action]) {
                    if (rule.function(correspondingMatch, player, request)) {
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



    client.on('clear_waiting_queue', (message) => {
        opponentsQueue.splice(0)
        socketServer.emit('chat', { sender: 'Server', color: '#ffee00', text: 'The opponents waiting queue was cleared' })
    })

    client.on('delete_all_matches', (message) => {
        activeMatches.forEach((match, index) => {
            socketServer.to([activeMatches[index].players_ids[0].socketId, activeMatches[index].players_ids[1].socketId]).socketsLeave(activeMatches[index].match_id)
            socketServer.to([activeMatches[index].players_ids[0].socketId, activeMatches[index].players_ids[1].socketId]).emit(
                'chat',
                { sender: 'Server', color: '#ffee00', text: `You left the match ${match.match_id}` }
            )
        })

        activeMatches.splice(0)
    })

    client.on('get_match', (message) => {
        client.emit('match_data', activeMatches.find(match => match.players.some(player => player.socketId === client.id)))
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