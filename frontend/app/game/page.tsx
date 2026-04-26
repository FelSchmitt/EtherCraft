'use client'

import { useEffect } from 'react'
import * as three from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import { io } from 'socket.io-client'
import { sendChatMessage, receiveChatMessage, receiveAndDisplayMatchObject } from './socket_channels'
import { setHandCardPositions, resetScene } from './scene_functions'
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
        const loader = new GLTFLoader()
        const textureLoader = new three.TextureLoader()
        const light = new three.AmbientLight('#ffffff', 3)

        let loop: boolean = true
        let mousePosition: three.Vector2 = new three.Vector2()
        let selectedObject: three.Object3D | null = null

        loader.load(
            'models/game_table.glb',
            function (gltf) {
                gltf.scene.name = 'table'
                scene.add(gltf.scene)
                console.log('table model loaded')
            },
            function (progress) { },
            function (error) {
                console.error(error)
                alert(`table model failed: ${error}`)
            }
        )

        camera.position.setX(-12)
        camera.position.setY(28)
        scene.add(light)
        renderer.render(scene, camera)



        socket.on('chat', receiveChatMessage)
        socket.on('build_match', (match: matchObject) => { receiveAndDisplayMatchObject(match, scene, loader, textureLoader) })



        function gameLoop() {
            if (loop) {
                cameraControl.update()
                renderer.render(scene, camera)

                requestAnimationFrame(gameLoop)
            }
        }



        function pauseAndResumeAnimation(event: KeyboardEvent) {
            if (event.key == 'Enter') {
                if (loop) {
                    loop = false
                    const label = document.getElementById('loop-label')
                    if (label) {
                        label.innerText = 'Game Scene Paused'
                    }
                }
                else {
                    loop = true
                    const label = document.getElementById('loop-label')
                    if (label) {
                        label.innerText = 'Game Scene Running'
                    }
                    gameLoop()
                }
            }
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
        document.getElementById('reset-scene')?.addEventListener('click', () => { resetScene(scene, loader, light) })
        gameLoop()

        return () => {
            socket.off('connection')
            window.removeEventListener('keydown', pauseAndResumeAnimation)
            gameScreen.removeEventListener('click', sceneMouseInteraction)
        }
    }, [])



    return (
        <>
            <canvas id='gamescreen'></canvas>
            <div className='absolute w-[20vw] h-[50vh] border-4 border-zinc-500 right-[80%] flex flex-col justify-evenly items-center'>
                <div id='test-chat' className='w-[90%] h-[80%] bg-[#888] flex flex-col overflow-y-scroll'></div>

                <input type='text' id='message-input' className='bg-white border-[3px] border-[#4784ff] w-[90%]' />
                <button onClick={() => { sendChatMessage(socket) }} className='bg-[#9d47ff60] border-[3px] border-[#9d47ff] rounded-[5px] w-[90%] p-0.75 text-white font-bold'>SEND</button>
            </div>

            <div className='absolute w-[50vw] h-[10vh] bottom-[89%] border-2 rounded-2xl border-zinc-500 bg-[#8888] flex justify-evenly items-center'>
                <div onClick={() => { (document.getElementById('test-chat') as HTMLDivElement).innerHTML = '' }} className='tools-menu-option'>
                    <img src='/icons/clear.png' className='tools-menu-image' />
                    <span className='tools-menu-label'>Clear Chat</span>
                </div>

                <div onClick={() => { localStorage.getItem('id') && socket.emit('find_opponent', { id: localStorage.getItem('id'), nickname: localStorage.getItem('nickname') }) }} className='tools-menu-option'>
                    <img src='/icons/join.png' className='tools-menu-image' />
                    <span className='tools-menu-label'>Join Waiting Queue</span>
                </div>

                <div onClick={() => { socket.emit('clear_waiting_queue', 'message') }} className='tools-menu-option'>
                    <img src='/icons/clear.png' className='tools-menu-image' />
                    <span className='tools-menu-label'>Clear Waiting Queue</span>
                </div>

                <div onClick={() => { socket.emit('delete_all_matches', 'message') }} className='tools-menu-option'>
                    <img src='/icons/delete.png' className='tools-menu-image' />
                    <span className='tools-menu-label'>Delete All Matches</span>
                </div>

                <div id='reset-scene' className='tools-menu-option'>
                    <img src='/icons/reset.png' className='tools-menu-image' />
                    <span className='tools-menu-label'>Reset Scene</span>
                </div>

                <span id='loop-label' className='font-bold bg-white p-2 rounded-2xl'>Game Scene Running</span>
            </div>
        </>
    )
}