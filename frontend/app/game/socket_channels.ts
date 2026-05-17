import { Object3D, Scene, TextureLoader } from 'three'
import { Socket, io } from 'socket.io-client'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js'

export type matchObject = {
    hand_cards: { card_id: string, uuid: string }[],
    table_cards: { card_id: string, uuid: string }[],
    life: number,
    mana_level: number,
    opponent: {
        hand_cards: number,
        table_cards: number,
        id: string,
        nickname: string,
        life: number,
        mana_level: number
    }
}

type chatMessage = {
    sender: string,
    color: string,
    text: string
}

export type cardStateUpdate = {
    uuid: string | undefined,
    id: string | undefined,
    place: 'table' | 'hand',
    side: 'self' | 'opponent'
}






export const socketConnection = io('http://localhost:3001')



export function sendChatMessage(socket: Socket) {
    const input = document.getElementById('message-input') as HTMLInputElement

    socket.emit('chat', { sender: localStorage.getItem('id'), text: input.value })

    input.value = ''
}



export function receiveChatMessage(message: chatMessage) {
    const chat = document.getElementById('test-chat') as HTMLDivElement
    const chatContainer = document.getElementById('chat-container') as HTMLDivElement
    chat.innerHTML += `<p class="mb-2"><span style="color: ${message.color}; font-weight: 700">${message.sender}:</span>${message.text}</p>`
    chatContainer.classList.remove('closed')
}



export function receiveMatchDataToDisplayInConsole(message: any) {
    console.log(message)
}



export function receiveAndDisplayMatchObject(match: matchObject, scene: Scene, loader: GLTFLoader, textureLoader: TextureLoader) {
    match.hand_cards.forEach((card, index) => {
        loader.load(
            'models/card.glb',
            function (gltf) {
                const cardModel: any = gltf.scene.children[0]
                const cardTexture = textureLoader.load(`http://localhost:3001/cards/${card.card_id}.png`)

                cardModel.name = 'card'
                // cardModel.children[2].material.map = cardTexture
                cardModel.position.x = -14
                cardModel.position.y = 14
                cardModel.position.z = Math.floor(match.hand_cards.length / 2) * -3 + index * 3
                cardModel.rotateY(3.14)
                cardModel.rotateX(3.14)
                cardModel.rotateZ(-0.7)
                cardModel.userData.name = card.card_id
                cardModel.userData.place = 'hand'
                cardModel.userData.uuid = card.uuid
                cardModel.userData.side = 'self'
                
                scene.add(cardModel)
                console.log(cardModel)
            },
            function (progress) { },
            function (error) {
                console.error(error)
                alert(`card model failed: ${error}`)
            }
        )
    })
    
    for (let i = 0; i < match.opponent.hand_cards; i++) {
        loader.load(
            'models/card.glb',
            function (gltf) {
                const cardModel = gltf.scene.children[0]
                
                cardModel.name = 'card'
                cardModel.position.x = 14
                cardModel.position.y = 14
                cardModel.position.z = Math.floor(match.opponent.hand_cards / 2) * -3 + i * 3
                cardModel.rotateZ(0.7)
                cardModel.userData.place = 'hand'
                cardModel.userData.side = 'opponent'

                scene.add(cardModel)
            },
            function (progress) { },
            function (error) {
                console.error(error)
                alert(`card model failed: ${error}`)
            }
        )
    }

    const table: any = scene.getObjectByName('table')
    if (table) {
        const selfPlayerIcon = textureLoader.load(`http://localhost:3001/users/${localStorage.getItem('id')}.png`)
        const opponentPlayerIcon = textureLoader.load(`http://localhost:3001/users/${match.opponent.id}.png`)

        selfPlayerIcon.flipY = true
        opponentPlayerIcon.flipY = true

        table.children[1].children[1].material.map = selfPlayerIcon
        table.children[0].children[1].material.map = opponentPlayerIcon
    }
}



export function receiveCardUpdate(update: cardStateUpdate, scene: Scene, outline: OutlinePass, textureLoader: TextureLoader) {
    if (update.side === 'self' && update.uuid) {
        const card = scene.children.find(object => object.userData.uuid === update.uuid)

        if (card) {
            if (update.place === 'table') {
                card.userData.place = 'table'

                const cardsOnTable = scene.children.filter(object => object.userData.side === 'self' && object.userData.place === 'table')

                cardsOnTable.forEach((card, index) => {
                    card.position.x = -7
                    card.position.y = 11
                    card.position.z = Math.floor(cardsOnTable.length / 2) * -3 + index * 3

                    card.rotation.z = -1.57
                    card.rotation.y = 3.14
                })
            }
        }
    }

    else if (update.side === 'opponent') {
        if (update.place === 'table' && update.id) {
            const opponentHandCards = scene.children.filter(object => object.userData.side === 'opponent' && object.userData.place === 'hand')
            const randomlyChosenCard = opponentHandCards[Math.ceil(Math.random() * opponentHandCards.length)]
            // const cardTexture = textureLoader.load(`http://localhost:3001/cards/${update.id}.png`)

            randomlyChosenCard.userData.place = 'table'
            randomlyChosenCard.position.x = 7
            randomlyChosenCard.position.y = 11
            randomlyChosenCard.rotation.z = -1.57

            const opponentTableCards = scene.children.filter(object => object.userData.side === 'opponent' && object.userData.place === 'table')

            opponentTableCards.forEach((card, index) => {
                card.position.z = Math.floor(opponentTableCards.length / 2) * -3 + index * 3
            })
        }
    }

    if (update.side === 'self') {
        outline.selectedObjects = []
    }
}