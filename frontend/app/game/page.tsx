'use client'

import { useEffect } from "react"
import * as three from 'three'
import { OrbitControls } from "three/examples/jsm/Addons.js"
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import { io } from "socket.io-client"

export default function GameScreen() {
    useEffect(() => {
        // const socket = io('http://localhost:3001')

        // socket.on('chat', (message) => {
        //     console.log(`Mensagem recebida do backend: ${message}`)
        //     const chat: any = document.getElementById('test-chat')
        //     chat.innerHTML += `<p><span class="text-[${message.color}] font-bold mb-2">${message.sender}:</span>${message.text}</p>`
        // })

        // function sendChatMessage() {
        //     const input = document.getElementById('message-input') as HTMLInputElement

        //     socket.emit('chat', { sender: 'Usuário', text: input.value })

        //     input.value = ''
        // }






        const gameScreen = document.getElementById('gamescreen') as HTMLCanvasElement
        const renderer = new three.WebGLRenderer({ canvas: gameScreen })
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(900, 600)

        const scene = new three.Scene()
        const camera = new three.PerspectiveCamera(75, gameScreen.width / gameScreen.height, 1, 100)
        const cameraControl = new OrbitControls(camera, renderer.domElement)
        const grid = new three.GridHelper(50, 10)
        const loader = new GLTFLoader()

        const light = new three.DirectionalLight('#ffffff', 3)

        loader.load(
            'models/game_table.glb',
            function (gltf) {
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

        loader.load(
            'models/card.glb',
            function (gltf) {
                scene.add(gltf.scene)
                console.log(gltf)
            },
            function (progress) {
                console.log((progress.loaded / progress.total * 100) + '% loaded')
            },
            function (error) {
                console.error(error)
                alert(`Deu ruim no modelo: ${error}`)
            }
        )

        let loop: boolean = true


        camera.position.setZ(30)
        light.position.set(20, 20, 20)

        scene.add(grid)
        scene.add(light)

        renderer.render(scene, camera)

        function gameLoop() {
            if (loop) {
                cameraControl.update()
                renderer.render(scene, camera)
                requestAnimationFrame(gameLoop)
            }
        }

        window.addEventListener('keydown', event => {
            if (event.key == 'l') { loop ? loop = false : loop = true; gameLoop() }
        })

        gameLoop()

        return () => {
            // socket.off('connection')
        }
    }, [])

    return (
        <>
            <canvas id="gamescreen" width={900} height={600} className="border-8 border-[#b30000]"></canvas>
            <div className="absolute w-[17vw] h-[50vh] border-4 border-zinc-500 right-[80%] flex flex-col justify-evenly items-center">
                <div id="test-chat" className="w-[90%] h-[80%] bg-[#888] flex flex-col overflow-y-scroll"></div>

                <input type="text" id="message-input" className="bg-white border-[3px] border-[#4784ff] w-[90%]" />
                <button className="bg-[#9d47ff60] border-[3px] border-[#9d47ff] rounded-[5px] w-[90%] p-0.75">MANDAR</button>
            </div>
        </>
    )
}