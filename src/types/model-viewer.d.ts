export interface InkstoneModelViewerElement extends HTMLElement {
  src: string
  loaded: boolean
  cameraOrbit: string
  cameraTarget: string
  fieldOfView: string
  exposure: number
  shadowIntensity: number
  autoRotate: boolean
  updateComplete: Promise<boolean>
  updateFraming(): Promise<void>
  jumpCameraToGoal(): void
}

export {}
