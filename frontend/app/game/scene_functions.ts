import { Scene, Light } from 'three'
import { GLTFLoader } from 'three/examples/jsm/Addons.js'

export function resetScene(scene: Scene, loader: GLTFLoader, light: Light) {
    scene.children.splice(0)

    loader.load(
        'models/game_table.glb',
        function (gltf) {
            gltf.scene.name = 'table'
            scene.add(gltf.scene)
            console.log('table model loaded')
        },
        function (progress) {
            console.log(`${progress.loaded} of ${progress.total} loaded`)
        },
        function (error) {
            console.error(error)
            alert(`table model failed: ${error}`)
        }
    )

    scene.add(light)
}

export function setHandCardPositions(scene: Scene, side: 'opponent' | 'self') {
    const cardObjects = scene.children.filter(object => object.name == 'card')

    cardObjects.forEach((card, index) => {
        card.position.x = 14
        card.position.y = 16
        card.position.z = Math.floor(cardObjects.length / 2) * -3 + index * 3
    })
}