'use client'

import { useEffect } from "react"
import * as three from 'three'
import { OrbitControls } from "three/examples/jsm/Addons.js"
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import { io } from "socket.io-client"

export default function GameScreen() {
    useEffect(() => {
        const socket = io('http://localhost:3001')

        socket.on('chat', (message) => {
            console.log(`Message from backend: ${message}`)
            const chat: any = document.getElementById('test-chat')
            chat.innerHTML += `<p class="mb-2"><span class="text-[${message.color}] font-bold">${message.sender}:</span>${message.text}</p>`
        })

        const button = document.getElementById('send-button') as HTMLButtonElement
        
        function sendChatMessage() {
            const input = document.getElementById('message-input') as HTMLInputElement
            
            socket.emit('chat', { sender: 'User', text: input.value })
            
            input.value = ''
        }

    
        
        
        

        socket.emit('build_scene', 'just to get the objects of the scene from the database')

        socket.on('scene_add_objects', (objectsList) => {
            console.log(objectsList)
        })
        
        
        const gameScreen = document.getElementById('gamescreen') as HTMLCanvasElement
        const renderer = new three.WebGLRenderer({ canvas: gameScreen })
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(window.innerWidth, window.innerHeight)

        let loop: boolean = true

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

        camera.position.setX(-12)
        camera.position.setY(28)
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