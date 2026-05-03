'use client'

import { useEffect } from 'react'
import * as three from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import { io } from 'socket.io-client'
import * as channels from './socket_channels'
import { setHandCardPositions, resetScene } from './scene_functions'
import { selectAnimation } from './animations'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js'



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
        const light = new three.DirectionalLight('#ffffff', 3)
        const composer = new EffectComposer(renderer)
        const renderPass = new RenderPass(scene, camera)
        const outlinePass = new OutlinePass(new three.Vector2(window.innerWidth, window.innerHeight), scene, camera)

        composer.addPass(renderPass)
        outlinePass.edgeStrength = 5.0
        outlinePass.edgeGlow = 0.7
        outlinePass.edgeThickness = 4.0
        outlinePass.visibleEdgeColor.set('#2fc4ff')
        outlinePass.hiddenEdgeColor.set('#15556e')
        composer.addPass(outlinePass)

        let loop: boolean = true
        let mousePosition: three.Vector2 = new three.Vector2()
        let selectedCard: three.Object3D | null = null

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

        loader.load(
            'models/carpet.glb',
            function (gltf) {
                gltf.scene.name = 'carpet'
                scene.add(gltf.scene)
                console.log('carpet model loaded')
            },
            function (progress) { },
            function (error) {
                console.error(error)
                alert(`carpet model failed: ${error}`)
            }
        )

        camera.position.setX(-12)
        camera.position.setY(28)
        light.position.setY(20)
        scene.add(light)
        renderer.render(scene, camera)



        socket.on('chat', channels.receiveChatMessage)
        socket.on('build_match', (match: channels.matchObject) => { channels.receiveAndDisplayMatchObject(match, scene, loader, textureLoader) })



        function gameLoop() {
            if (loop) {
                cameraControl.update()
                composer.render()

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
                const group = list[0].object.parent

                if (group) {
                    if (group.userData.owner = localStorage.getItem('id')) {
                        selectedCard = group
                        outlinePass.selectedObjects = [group]
                    }
                    else if (group.name == 'table' && selectedCard) {
                        socket.emit('move_request', {card: selectedCard.userData, action: 'throw_onto_table'})
                    }
                }
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

            <div id='chat-container' onClick={() => { (document.getElementById('chat-container') as HTMLDivElement).classList.toggle('closed') }} className='absolute w-[20vw] h-[50vh] border-4 border-zinc-500 flex flex-col justify-evenly items-center'>
                <div id='test-chat' className='w-[90%] h-[80%] bg-[#888] flex flex-col overflow-y-scroll'></div>

                <input type='text' id='message-input' className='bg-white border-[3px] border-[#4784ff] w-[90%]' />
                <button onClick={() => { channels.sendChatMessage(socket) }} className='bg-[#9d47ff60] border-[3px] border-[#9d47ff] rounded-[5px] w-[90%] p-0.75 text-white font-bold'>SEND</button>
            </div>

            <div id='test-tools' className='absolute w-[50vw] h-[10vh] border-2 rounded-2xl border-zinc-500 bg-[#8888] flex justify-evenly items-center'>
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

                <button onClick={() => { (document.getElementById('test-tools') as HTMLDivElement).classList.toggle('closed') }} className='font-bold bg-white p-2 rounded-2xl text-black absolute top-[85%]'>⬇</button>
            </div>
        </>
    )
}