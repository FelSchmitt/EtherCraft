import { Scene, TextureLoader } from 'three'
import { Socket } from 'socket.io-client'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'

export type matchObject = {
    hand_cards: { card_id: string, uuid: string }[],
    table_cards: { card_id: string }[] | null,
    life: number,
    mana_level: number,
    opponent: {
        hand_cards: number,
        table_cards: number | null,
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






export function sendChatMessage(socket: Socket) {
    const input = document.getElementById('message-input') as HTMLInputElement

    socket.emit('chat', { sender: localStorage.getItem('id'), text: input.value })

    input.value = ''
}



export function receiveChatMessage(message: chatMessage) {
    const chat = document.getElementById('test-chat') as HTMLDivElement
    chat.innerHTML += `<p class="mb-2"><span style="color: ${message.color}; font-weight: 700">${message.sender}:</span>${message.text}</p>`
}



export function receiveAndDisplayMatchObject(match: matchObject, scene: Scene, loader: GLTFLoader, textureLoader: TextureLoader) {
    match.hand_cards.forEach((card, index) => {
        loader.load(
            'models/card.glb',
            function (gltf) {
                const cardModel: any = gltf.scene.children[0]
                const cardTexture = textureLoader.load(`http://localhost:3001/cards/${card.card_id}.png`)

                cardModel.children[2].material.map = cardTexture
                cardModel.position.x = -14
                cardModel.position.y = 14
                cardModel.position.z = Math.floor(match.hand_cards.length / 2) * -3 + index * 3
                cardModel.rotateY(3.14)
                cardModel.rotateZ(1.2)
                cardModel.userData.name = card.card_id
                cardModel.userData.place = 'hand'
                cardModel.userData.uuid = card.uuid

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

                cardModel.position.x = 14
                cardModel.position.y = 14
                cardModel.position.z = Math.floor(match.opponent.hand_cards / 2) * -4 + i * 4

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