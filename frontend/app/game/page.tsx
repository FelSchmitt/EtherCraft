'use client'

import { useEffect } from 'react'
import * as three from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import { io } from 'socket.io-client'

type matchObject = {
    hand_cards: { card_id: string }[],
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



export default function GameScreen() {
    useEffect(() => {
        const gameScreen = document.getElementById('gamescreen') as HTMLCanvasElement
        const renderer = new three.WebGLRenderer({ canvas: gameScreen })
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(window.innerWidth, window.innerHeight)
        const observer = new ResizeObserver(() => { renderer.setSize(window.innerWidth, window.innerHeight) })
        observer.observe(gameScreen)

        let loop: boolean = true

        const scene = new three.Scene()
        const camera = new three.PerspectiveCamera(75, gameScreen.width / gameScreen.height, 1, 100)
        const cameraControl = new OrbitControls(camera, renderer.domElement)
        const grid = new three.GridHelper(50, 10)
        const loader = new GLTFLoader()
        const textureLoader = new three.TextureLoader()

        const light = new three.DirectionalLight('#ffffff', 3)

        loader.load(
            'models/game_table.glb',
            function (gltf) {
                gltf.scene.name = 'table'
                scene.add(gltf.scene)
                console.log('table model loaded')
            },
            function (progress) {
                console.log((progress.loaded / progress.total * 100) + '% loaded')
            },
            function (error) {
                console.error(error)
                alert(`table model failed: ${error}`)
            }
        )

        camera.position.setX(-12)
        camera.position.setY(28)
        light.position.set(16, 20, 16)

        scene.add(grid)
        scene.add(light)

        renderer.render(scene, camera)



        const socket = io('http://localhost:3001')

        const button = document.getElementById('send-button') as HTMLButtonElement

        socket.on('chat', (message) => {
            console.log(`Message from backend: ${message}`)
            const chat = document.getElementById('test-chat') as HTMLDivElement
            chat.innerHTML += `<p class="mb-2"><span class="text-[${message.color}] font-bold">${message.sender}:</span>${message.text}</p>`
        })

        function sendChatMessage() {
            const input = document.getElementById('message-input') as HTMLInputElement

            socket.emit('chat', { sender: 'User', text: input.value })

            input.value = ''
        }



        socket.on('build_scene', (match: matchObject) => {
            match.hand_cards.forEach((card, index) => {
                loader.load(
                    'models/card.glb',
                    function (gltf) {
                        const cardModel: any = gltf.scene.children[0]
                        const cardTexture = textureLoader.load(`http://localhost:3001/cards/${card.card_id}.png`)

                        cardModel.children[2].material.map = cardTexture
                        cardModel.children[2].material.needsUpdate = true
                        cardModel.position.x = -14
                        cardModel.position.y = 16
                        cardModel.position.z = gltf.scene.children.length / 2 * -3 + gltf.scene.children.length * 3 * index
                        cardModel.rotateY(3.14)
                        cardModel.rotateZ(1.2)

                        scene.add(gltf.scene)
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
                        cardModel.position.y = 16
                        cardModel.position.z = gltf.scene.children.length / 2 * -3 - gltf.scene.children.length * 3 * i

                        scene.add(gltf.scene)
                    },
                    function (progress) {},
                    function (error) {
                        console.error(error)
                        alert(`card model failed: ${error}`)
                    }
                )
            }

            const table: any = scene.getObjectByName('table')
            console.log(table)
            if (table) {
                const selfPlayerIcon = textureLoader.load(`http://localhost:3001/users/${localStorage.getItem('id')}.png`)
                const opponentPlayerIcon = textureLoader.load(`http://localhost:3001/users/${match.opponent.id}.png`)

                table.children[1].children[1].material.map = selfPlayerIcon
                table.children[0].children[1].material.map = opponentPlayerIcon
            }
        })

        setTimeout(() => {
            const loggedUser = localStorage.getItem('id')
            if (loggedUser) {
                socket.emit('find_opponent', { id: loggedUser, nickname: localStorage.getItem('nickname') })
            }
        }, 3000)



        function gameLoop() {
            if (loop) {
                cameraControl.update()
                renderer.render(scene, camera)
                requestAnimationFrame(gameLoop)
            }
        }

        function pauseAndResumeAnimation(event: KeyboardEvent) {
            if (event.key == 'Enter') { loop ? loop = false : loop = true; gameLoop() }
        }

        window.addEventListener('keydown', pauseAndResumeAnimation)
        button.addEventListener('click', sendChatMessage)

        gameLoop()



        return () => {
            socket.off('connection')
            window.removeEventListener('keydown', pauseAndResumeAnimation)
            button.removeEventListener('click', sendChatMessage)
        }
    }, [])

    return (
        <>
            <canvas id="gamescreen"></canvas>
            <div className="absolute w-[17vw] h-[50vh] border-4 border-zinc-500 right-[80%] flex flex-col justify-evenly items-center">
                <div id="test-chat" className="w-[90%] h-[80%] bg-[#888] flex flex-col overflow-y-scroll"></div>

                <input type="text" id="message-input" className="bg-white border-[3px] border-[#4784ff] w-[90%]" />
                <button id="send-button" className="bg-[#9d47ff60] border-[3px] border-[#9d47ff] rounded-[5px] w-[90%] p-0.75">SEND</button>
            </div>
        </>
    )
}