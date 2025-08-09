// src/index.ts
// This is our main scene file. Think of it as the "assembly instructions" for our project.
// Its only job is to load our assets (the 3D model) and then use our smart component
// (`curved-screen.ts`) to bring the scene to life.

import { engine, Transform, Material, VideoPlayer, GltfContainer } from "@dcl/sdk/ecs";
import { Vector3, Quaternion } from "@dcl/sdk/math";
// We import our component function from the other file.
// This is how we make our code modular and reusable.
import { createCurvedScreen } from "./curved-screen";

export function main() {

  // --- Step 1: Load the 3D Model ---
  // First, we create an entity to hold our 3D model.
  const sceneBase = engine.addEntity();
  // Then, we attach the GltfContainer component to it, pointing to the .glb file
  // that we created in Blender. This is the static frame for our screen.
  GltfContainer.create(sceneBase, { src: 'models/curved_screen.glb' });
  // We also give it a Transform so it exists in the scene.
  Transform.create(sceneBase);

  // --- Step 2: Set up the Video Player ---
  // This section handles the video playback logic.

  // It's a best practice in SDK 7 to have a dedicated, separate entity
  // just for the VideoPlayer component. This avoids potential conflicts and
  // makes the logic cleaner. This entity itself is invisible.
  const videoPlayerEntity = engine.addEntity();

  // We attach the VideoPlayer component to our dedicated entity.
  VideoPlayer.create(videoPlayerEntity, {
    // The URL of the HLS (.m3u8) video stream.
    src: 'https://player.vimeo.com/external/887766104.m3u8?s=ae3d36b03bdf2677371633c0f4fa0e6f71315925&logging=false',
    // Set to true to make the video play automatically when the scene loads.
    playing: true,
    // Set to true to make the video loop when it ends.
    loop: true,
  });

  // --- Step 3: Create the Video Texture ---
  // Now we create a video texture. This isn't a static image; it's a dynamic
  // material that is linked directly to the entity playing the video.
  const videoTexture = Material.Texture.Video({ videoPlayerEntity: videoPlayerEntity });

  // --- Step 4: Assemble the Final Product! ---
  // This is the payoff. All the complex logic is hidden inside our component.
  // All we have to do is call our `createCurvedScreen` function one time.
  createCurvedScreen({
    // We provide the "options" object that our component's interface expects.
    // These position and rotation values have been carefully chosen to place
    // our procedural screen perfectly inside the cutout of our 3D model.
    position: Vector3.create(.875, 5.3, 16),
    rotation: Quaternion.fromEulerDegrees(0, 90, 0),
    scale: Vector3.create(1, 1, 1),
    // We pass in the video texture we just created.
    videoTexture: videoTexture,
    // And here's the "knob" we can turn. This is the fun part to demonstrate live.
    // Changing this one value will change the curve of the screen instantly.
    curveFactor: 0.3
  });
  
  // --- Optional: Add a Ground Plane ---
  // This is just for visual reference, so we can see where the screen is in the scene.
  // It's not part of the curved screen logic, but it helps us visualize the setup.
  // You can remove this if you want a cleaner scene.
  const ground = engine.addEntity()
  GltfContainer.create(ground, { src: 'models/ground_2x2.glb' });
  Transform.create(ground);
}
