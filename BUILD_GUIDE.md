
# The Configurable Curved Screen: Build Guide

This guide provides a complete, step-by-step walkthrough for building the "Configurable Curved Screen" scene from a blank project, as taught in the Creator Academy advanced workshop.

---

## 1. Project Setup

1.  **Create a Project Folder:** Create a new, empty folder on your PC.
2.  **Initialize the Scene:** Open a terminal in your new folder and run `npx @dcl/sdk-commands init`, selecting the "Blank scene" template.
3.  **Create `models` folder:** Inside your project, create a new folder named `models`. Place your `curved_screen.glb` file inside it.

---

## 2. Building the Screen Component (`curved-screen.ts`)

This file will contain all the logic for our flexible screen component.

1.  In the `src` folder, create a new file named `curved-screen.ts`.
2.  Add the following code to the file.

    // src/curved-screen.ts
    import { engine, Transform, MeshRenderer, Material, TextureUnion } from "@dcl/sdk/ecs";
    import { Vector3, Quaternion, Color3 } from "@dcl/sdk/math";

    export interface CurvedScreenOptions {
        position: Vector3;
        rotation: Quaternion;
        scale: Vector3;
        videoTexture: TextureUnion;
        curveFactor?: number; // Optional: A value from 0 (flat) to 1 (very curved).
    }

    export function setUVsForSegment(segmentIndex: number, totalSegments: number): number[] {
        const uStart = segmentIndex / totalSegments;
        const uEnd = (segmentIndex + 1) / totalSegments;
        return [
            0, 0, 0, 0, 0, 0, 0, 0, // Face 1 (Top)
            0, 0, 0, 0, 0, 0, 0, 0, // Face 2 (Bottom)
            0, 0, 0, 0, 0, 0, 0, 0, // Face 3 (Back)
            0, 0, 0, 0, 0, 0, 0, 0, // Face 4 (Front)
            uStart, 1, uEnd, 1, uEnd, 0, uStart, 0, // Face 5 (Right) - THIS IS THE VISIBLE SCREEN
            0, 0, 0, 0, 0, 0, 0, 0, // Face 6 (Left)
        ];
    }

    export function createCurvedScreen(options: CurvedScreenOptions) {
        const totalSegments = 22;
        const screenWidth = 14; 
        const screenHeight = 7.875;
        const curveFactor = options.curveFactor ?? 0.3;

        const screenParent = engine.addEntity();
        Transform.create(screenParent, {
            position: options.position,
            rotation: options.rotation,
            scale: options.scale
        });

        function calculateSegmentTransform(segmentIndex: number) {
            const x = -screenWidth / 2 + (segmentIndex + 0.5) * (screenWidth / totalSegments);
            const z = curveFactor * (x / screenWidth) * (x / screenWidth) * screenWidth;
            const derivative = 2 * curveFactor * x / screenWidth;
            const angle = Math.atan(derivative);
            const rotationY = -angle * (180 / Math.PI);
            return {
                position: Vector3.create(x, 0, z),
                rotation: Quaternion.fromEulerDegrees(0, rotationY, 0),
                angle: angle
            };
        }

        for (let i = 0; i < totalSegments; i++) {
            const segmentEntity = engine.addEntity();
            const { position, rotation, angle } = calculateSegmentTransform(i);
            const adjustedWidth = (screenWidth / totalSegments) / Math.cos(angle);

            Transform.create(segmentEntity, {
                parent: screenParent,
                position: position,
                rotation: rotation,
                scale: Vector3.create(adjustedWidth, screenHeight, 0.1)
            });

            MeshRenderer.setBox(segmentEntity, setUVsForSegment(i, totalSegments));
            
            Material.setPbrMaterial(segmentEntity, {
                texture: options.videoTexture,
                roughness: 1.0,
                specularIntensity: 0,
                metallic: 0,
                emissiveTexture: options.videoTexture,
                emissiveIntensity: 1,
                emissiveColor: Color3.White()
            });
        }
        return screenParent;
    }

---

## 3. Assembling the Scene (`index.ts`)

This is the main entry point that imports our 3D model and uses our new screen component.

1.  Open the existing `src/index.ts` file.
2.  Delete all of its content and replace it with the following:

    // src/index.ts
    import { engine, Transform, Material, VideoPlayer, GltfContainer } from "@dcl/sdk/ecs";
    import { Vector3, Quaternion } from "@dcl/sdk/math";
    import { createCurvedScreen } from "./curved-screen";

    export function main() {
        const frame = engine.addEntity();
        GltfContainer.create(frame, { src: 'models/curved_screen.glb' });
        Transform.create(frame);

        const videoPlayerEntity = engine.addEntity();
        VideoPlayer.create(videoPlayerEntity, {
            src: 'https://player.vimeo.com/external/887766104.m3u8?s=ae3d36b03bdf2677371633c0f4fa0e6f71315925&logging=false',
            playing: true,
            loop: true,
        });

        const videoTexture = Material.Texture.Video({ videoPlayerEntity });

        createCurvedScreen({
            position: Vector3.create(8, 5.2, 8),
            rotation: Quaternion.fromEulerDegrees(0, 0, 0),
            scale: Vector3.create(1, 1, 1),
            videoTexture: videoTexture,
            curveFactor: 0.4
        });
    }

---

## 4. Testing Your Scene

From your project's root directory, run the following command in your terminal:

    dcl start
