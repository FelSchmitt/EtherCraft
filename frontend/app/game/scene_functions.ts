import { Scene, Light, Object3D } from 'three'
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

    scene.add(light)
}



export function updateObjectVectorValue(object: any, input: HTMLInputElement) {
    object[input.dataset.vector as string][input.dataset.value as string] = input.valueAsNumber
}



export function getObjectVectorsValues(object: Object3D, inputs: NodeListOf<HTMLInputElement>) {
    for (const input of inputs) {
        if (input.dataset.vector === 'position') {
            if (input.dataset.value === 'x') {
                input.value = String(object.position.x)
            }
            else if (input.dataset.value === 'y') {
                input.value = String(object.position.y)
            }
            else if (input.dataset.value === 'z') {
                input.value = String(object.position.z)
            }
        }
        else if (input.dataset.vector === 'rotation') {
            if (input.dataset.value === 'x') {
                input.value = String(object.rotation.x)
            }
            else if (input.dataset.value === 'y') {
                input.value = String(object.rotation.y)
            }
            else if (input.dataset.value === 'z') {
                input.value = String(object.rotation.z)
            }
        }
    }
}