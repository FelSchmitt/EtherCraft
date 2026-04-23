'use client'

import { useEffect } from 'react'
import * as three from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import { io } from 'socket.io-client'
import { sendChatMessage, receiveChatmessage, receiveMatchObject } from './socket_channels'
import { matchObject } from './socket_channels'
import { selectAnimation } from './animations'



export default function GameScreen() {
    const socket = io('http://localhost:3001')

    useEffect(() => {
        const gameScreen = document.getElementById('gamescreen') as HTMLCanvasElement
        const renderer = new three.WebGLRenderer({ canvas: gameScreen })
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(window.innerWidth, window.innerHeight)


        const scene = new three.Scene()
        const camera = new three.PerspectiveCamera(75, gameScreen.width / gameScreen.height, 1, 100)
        const cameraControl = new OrbitControls(camera, renderer.domElement)
        const raycaster = new three.Raycaster()
        const grid = new three.GridHelper(50, 10)
        const loader = new GLTFLoader()
        const textureLoader = new three.TextureLoader()
        const light = new three.DirectionalLight('#ffffff', 3)

        let loop: boolean = true
        const mousePosition: three.Vector2 = new three.Vector2()
        let selectedObject: three.Object3D | null = null
        let handCards = [
        ]

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
        scene.add(light)
        renderer.render(scene, camera)



        socket.on('chat', receiveChatmessage)
        socket.on('build_match', (match: matchObject) => { receiveMatchObject(match, scene, loader, textureLoader) })



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

        function sceneMouseInteraction(event: MouseEvent) {
            mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1
            mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1

            raycaster.setFromCamera(mousePosition, camera)
            const list = raycaster.intersectObjects(scene.children)
            if (list.length > 0) {
                selectedObject = list[0].object
                selectAnimation(selectedObject)
            }
        }

        window.addEventListener('keydown', pauseAndResumeAnimation)
        gameScreen.addEventListener('click', sceneMouseInteraction)
        gameLoop()

        return () => {
            socket.off('connection')
            window.removeEventListener('keydown', pauseAndResumeAnimation)
            gameScreen.removeEventListener('click', sceneMouseInteraction)
        }
    }, [])



    return (
        <>
            <canvas id="gamescreen"></canvas>
            <div className="absolute w-[17vw] h-[50vh] border-4 border-zinc-500 right-[80%] flex flex-col justify-evenly items-center">
                <div id="test-chat" className="w-[90%] h-[80%] bg-[#888] flex flex-col overflow-y-scroll"></div>

                <input type="text" id="message-input" className="bg-white border-[3px] border-[#4784ff] w-[90%]" />
                <button onClick={() => { sendChatMessage(socket) }} className="bg-[#9d47ff60] text-[#392453] border-[3px] border-[#9d47ff] rounded-[5px] w-[90%] p-0.75">SEND</button>
            </div>

            <div className="absolute w-[30vw] h-[10vh] bottom-[89%] right-[69%] border-4 border-zinc-500 bg-[#8888] flex justify-evenly items-center">
                <div onClick={() => { socket.emit('find_opponent', { id: localStorage.getItem('id'), nickname: localStorage.getItem('nickname') }) }} className='tools-menu-option'>
                    <img src="/icons/join.png" className='tools-menu-image' />
                    <span className='tools-menu-label'>Join Waiting Queue</span>
                </div>

                <div onClick={() => { socket.emit('clear_waiting_queue', 'message') }} className='tools-menu-option'>
                    <img src="/icons/clear.png" className='tools-menu-image' />
                    <span className='tools-menu-label'>Clear Waiting Queue</span>
                </div>

                <div onClick={() => { socket.emit('delete_all_matches', 'message') }} className='tools-menu-option'>
                    <img src="/icons/delete.png" className='tools-menu-image' />
                    <span className='tools-menu-label'>Delete All Matches</span>
                </div>
            </div>
        </>
    )
}