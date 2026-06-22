'use client'

import { useEffect } from 'react'
import * as three from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'
import * as channels from './socket_channels'
import * as sceneFunctions from './scene_functions'
import { keyboardCommandsHandler } from './keyboard_commands'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js'

import { ServerControlTools } from './menu_tools/ServerControlTools'
import { ObjectVectorsMenu } from './menu_tools/ObjectVectorsMenu'



export default function GameScreen() {
    useEffect(() => {
        const gameScreen = document.getElementById('gamescreen') as HTMLCanvasElement
        const renderer = new three.WebGLRenderer({ canvas: gameScreen })
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(window.innerWidth, window.innerHeight)


        const scene = new three.Scene()
        const camera = new three.PerspectiveCamera(75, gameScreen.width / gameScreen.height, 1, 300)
        const cameraControl = new OrbitControls(camera, renderer.domElement)
        const raycaster = new three.Raycaster()
        const loader = new GLTFLoader()
        const textureLoader = new three.TextureLoader()
        const light = new three.AmbientLight('#ffffff', 4)
        const composer = new EffectComposer(renderer)
        const renderPass = new RenderPass(scene, camera)
        const outlinePass = new OutlinePass(new three.Vector2(window.innerWidth, window.innerHeight), scene, camera)

        composer.addPass(renderPass)
        outlinePass.edgeStrength = 5.0
        outlinePass.edgeGlow = 0.6
        outlinePass.edgeThickness = 3.0
        outlinePass.visibleEdgeColor.set('#2fc4ff')
        outlinePass.hiddenEdgeColor.set('#15556e')
        composer.addPass(outlinePass)

        let loop: boolean = true
        const mousePosition: three.Vector2 = new three.Vector2()
        let selectedObject: three.Object3D | null = null
        const inputs: NodeListOf<HTMLInputElement> = document.querySelectorAll('.vectorinput')

        loader.load(
            'models/tavern_background_default.glb',
            function (gltf) {
                gltf.scene.name = 'tavern'
                scene.add(gltf.scene)
                console.log('tavern loaded')
            },
            function (progress) { },
            function (error) {
                console.error(error)
                alert(`tavern model failed: ${error}`)
            }
        )

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
        scene.add(light)
        renderer.render(scene, camera)



        channels.socketConnection.on('chat', channels.receiveChatMessage)
        channels.socketConnection.on('build_match', (match: channels.matchObject) => { channels.receiveAndDisplayMatchObject(match, scene, loader, textureLoader) })
        channels.socketConnection.on('card_update', (update: channels.cardStateUpdate) => { channels.receiveCardUpdate(update, scene, outlinePass, textureLoader) })
        channels.socketConnection.on('match_data', channels.receiveMatchDataToDisplayInConsole)



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
                    if (selectedObject) {
                        if (group.name === 'table' && selectedObject.name === 'card' && selectedObject.userData.side === 'self') {
                            channels.socketConnection.emit('move_request', { card: selectedObject.userData, mode: 'classic', action: 'throw_onto_table' })
                            selectedObject = null
                            outlinePass.selectedObjects = []
                        }
                    }
                    else {
                        selectedObject = group
                        outlinePass.selectedObjects = [group]
                    }
                }
            }
            else {
                selectedObject = null
                outlinePass.selectedObjects = []
            }
        }

        function detectVectorInputChange(this: HTMLInputElement) {
            selectedObject && sceneFunctions.updateObjectVectorValue(selectedObject, this)
        }

        function getObject() {
            selectedObject && sceneFunctions.getObjectVectorsValues(selectedObject, inputs)
        }

        window.addEventListener('keydown', pauseAndResumeAnimation)
        window.addEventListener('keydown', keyboardCommandsHandler)
        gameScreen.addEventListener('click', sceneMouseInteraction)
        document.getElementById('reset-scene')?.addEventListener('click', () => { sceneFunctions.resetScene(scene, loader, light) })
        document.getElementById('get-object-vectors')?.addEventListener('click', getObject)

        for (const input of inputs) {
            input.addEventListener('change', detectVectorInputChange)
        }

        gameLoop()

        return () => {
            channels.socketConnection.off('connection')
            window.removeEventListener('keydown', pauseAndResumeAnimation)
            gameScreen.removeEventListener('click', sceneMouseInteraction)
            for (const input of inputs) { input.removeEventListener('change', detectVectorInputChange) }
        }
    }, [])



    return (
        <>
            <canvas id='gamescreen'></canvas>

            <div id='chat-container' className='absolute w-[20vw] h-[50vh] border-4 border-zinc-500 flex flex-col justify-evenly items-center'>
                <div id='test-chat' className='w-[90%] h-[80%] bg-[#888] flex flex-col overflow-y-scroll'></div>

                <input type='text' id='message-input' className='bg-white border-[3px] border-[#4784ff] w-[90%]' />
                <button onClick={() => { channels.sendChatMessage(channels.socketConnection) }} className='bg-[#9d47ff60] border-[3px] border-[#9d47ff] rounded-[5px] w-[90%] p-0.75 text-white font-bold'>SEND</button>
            </div>

            <ServerControlTools />
            <ObjectVectorsMenu />
        </>
    )
}