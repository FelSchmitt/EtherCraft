import { Object3D } from 'three'

export function selectAnimation(object: Object3D) {
    const positions = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, -0.1, -0.1, -0.1, -0.1, -0.1, -0.1, -0.1]
    let frame = 0

    function execute() {
        if (frame < positions.length - 1) {
            object.position.y += positions[frame]

            frame += 1

            setTimeout(execute, 50)
        }
    }

    execute()
}