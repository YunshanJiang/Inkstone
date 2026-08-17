import { Box3, Matrix4, Mesh, Vector3, type Object3D } from 'three'

export interface VolumeCenterResult {
  center: Vector3
  source: 'volume' | 'bounds'
  volume: number
}

const MIN_VOLUME = 1e-12

/**
 * Computes the uniform-density center of mass for closed triangle meshes.
 * The returned point is expressed in the root object's local coordinates.
 * Open or non-manifold geometry falls back to the visible bounds center.
 */
export function computeVolumeCenter(root: Object3D): VolumeCenterResult {
  root.updateMatrixWorld(true)

  const rootWorldInverse = root.matrixWorld.clone().invert()
  const combinedCenter = new Vector3()
  let combinedVolume = 0

  root.traverse((object) => {
    if (!(object as Mesh).isMesh) return

    const geometry = (object as Mesh).geometry
    const position = geometry.getAttribute('position')
    if (!position || position.itemSize < 3) return

    const index = geometry.getIndex()
    const availableCount = index?.count ?? position.count
    const drawStart = Math.max(0, geometry.drawRange.start)
    const requestedCount = Number.isFinite(geometry.drawRange.count)
      ? geometry.drawRange.count
      : availableCount - drawStart
    const drawEnd = Math.min(availableCount, drawStart + requestedCount)
    if (drawEnd - drawStart < 3) return

    const modelLocalMatrix = new Matrix4().multiplyMatrices(
      rootWorldInverse,
      object.matrixWorld,
    )
    const a = new Vector3()
    const b = new Vector3()
    const c = new Vector3()
    const cross = new Vector3()
    const triangleCenterSum = new Vector3()
    const weightedCenter = new Vector3()
    let signedVolumeTimesSix = 0

    const readVertex = (vertexIndex: number, target: Vector3): void => {
      target
        .set(
          position.getX(vertexIndex),
          position.getY(vertexIndex),
          position.getZ(vertexIndex),
        )
        .applyMatrix4(modelLocalMatrix)
    }

    for (let offset = drawStart; offset + 2 < drawEnd; offset += 3) {
      const aIndex = index ? index.getX(offset) : offset
      const bIndex = index ? index.getX(offset + 1) : offset + 1
      const cIndex = index ? index.getX(offset + 2) : offset + 2

      readVertex(aIndex, a)
      readVertex(bIndex, b)
      readVertex(cIndex, c)

      const triangleVolumeTimesSix = a.dot(cross.crossVectors(b, c))
      signedVolumeTimesSix += triangleVolumeTimesSix
      triangleCenterSum.copy(a).add(b).add(c)
      weightedCenter.addScaledVector(triangleCenterSum, triangleVolumeTimesSix)
    }

    if (Math.abs(signedVolumeTimesSix) <= MIN_VOLUME) return

    const meshCenter = weightedCenter.multiplyScalar(1 / (4 * signedVolumeTimesSix))
    const meshVolume = Math.abs(signedVolumeTimesSix) / 6
    combinedCenter.addScaledVector(meshCenter, meshVolume)
    combinedVolume += meshVolume
  })

  if (combinedVolume > MIN_VOLUME) {
    return {
      center: combinedCenter.multiplyScalar(1 / combinedVolume),
      source: 'volume',
      volume: combinedVolume,
    }
  }

  const bounds = new Box3().setFromObject(root)
  const center = bounds.isEmpty()
    ? new Vector3()
    : bounds.getCenter(new Vector3()).applyMatrix4(rootWorldInverse)

  return { center, source: 'bounds', volume: 0 }
}
