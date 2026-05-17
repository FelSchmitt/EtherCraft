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



export function updateObjectVectorValue(object: Object3D, inputElement: HTMLInputElement) {
}