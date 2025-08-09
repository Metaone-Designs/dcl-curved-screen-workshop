// src/curved-screen.ts
// This file contains all the logic for our "smart" component.
// Its only job is to create a curved screen. By keeping this logic separate
// from our main scene file (index.ts), we create a reusable and maintainable component.

import { engine, Transform, MeshRenderer, Material, TextureUnion } from "@dcl/sdk/ecs";
import { Vector3, Quaternion, Color3 } from "@dcl/sdk/math";

// --- The "Control Panel" for our Component ---
// An "interface" is like a contract or a blueprint for an object.
// It defines exactly what properties an object MUST have.
// We use this to create a clean and predictable "options" object for our component,
// making it easy for anyone (including our future selves) to know how to use it.
export interface CurvedScreenOptions {
    // These are the basic transform properties every scene object needs.
    position: Vector3;
    rotation: Quaternion;
    scale: Vector3;
    // This allows the user to pass in ANY valid video texture.
    // Our component doesn't need to know where the video comes from, just that it's a texture.
    videoTexture: TextureUnion;
    // We add a '?' to make this property optional. If the user doesn't provide it,
    // we'll use a default value later on. This is the main "knob" users can turn.
    curveFactor?: number;
}

// --- The UV Mapping Function: The Secret to a Seamless Image ---
/**
 * Calculates the UV coordinates for a single segment of the screen.
 * UV mapping tells the engine which part of a 2D texture to display on a 3D surface.
 * For our screen, we need to "slice" our video texture into vertical strips
 * and apply one strip to each segment of the screen.
 * @param segmentIndex The index of the screen segment (e.g., 0, 1, 2...).
 * @param totalSegments The total number of segments we're creating.
 * @returns An array of numbers representing the UV coordinates for a box mesh.
 */
export function setUVsForSegment(segmentIndex: number, totalSegments: number): number[] {
    // FIX 1: Reverse the order that texture slices are applied to the physical
    // segments. This gets the slices in the correct left-to-right order.
    const reversedSegmentIndex = (totalSegments - 1) - segmentIndex;
    const uStart = reversedSegmentIndex / totalSegments;
    const uEnd = (reversedSegmentIndex + 1) / totalSegments;

    // This long array might look intimidating, but it's just defining the UV coordinates
    // for each of the 6 faces of a standard box. We only care about ONE face.
    // The order is Top, Bottom, Back, Front, Right, Left.
    // We've chosen the "Right" face (face #5) to be the visible part of our screen segment.
    return [
        0, 0, 0, 0, 0, 0, 0, 0, // Face 1 (Top) - Not visible
        0, 0, 0, 0, 0, 0, 0, 0, // Face 2 (Bottom) - Not visible
        0, 0, 0, 0, 0, 0, 0, 0, // Face 3 (Back) - Not visible
        0, 0, 0, 0, 0, 0, 0, 0, // Face 4 (Front) - Not visible
        // Face 5 (Right) - THIS IS THE VISIBLE SCREEN FACE
        // FIX 2: Swap uStart and uEnd in the mapping below. This un-mirrors
        // each individual slice of the texture.
        uEnd, 1,   // Top-left corner of the texture slice
        uStart, 1, // Top-right corner
        uStart, 0, // Bottom-right corner
        uEnd, 0,   // Bottom-left corner
        0, 0, 0, 0, 0, 0, 0, 0, // Face 6 (Left) - Not visible
    ];
}
// --- The Main Component Function: The "Recipe" ---
/**
 * Creates a procedurally generated curved screen composed of multiple segments.
 * This is the main function we'll call from our scene file.
 * @param options An object that conforms to our CurvedScreenOptions interface.
 */
export function createCurvedScreen(options: CurvedScreenOptions) {
    // --- Internal Blueprint Specs ---
    // These are the "designer's choices" for the component. They are not meant
    // to be changed by the end-user, as they define the core structure.
    const totalSegments = 22;      // A good balance between smoothness and performance.
    const screenWidth = 16;        // The width of the screen area, matching our 3D model.
    const screenHeight = 9;    // The height, calculated for a 16:9 aspect ratio.

    // Here we use the nullish coalescing operator '??'.
    // It means: "If options.curveFactor is provided, use it. Otherwise, use 0.3."
    // This makes our `curveFactor` option truly optional.
    const curveFactor = options.curveFactor ?? 0.3;

    // --- Parent Entity ---
    // We create a single, invisible parent entity. We will then make all our
    // screen segments children of this parent. This allows us to move, rotate,
    // or scale the entire screen just by transforming this one parent entity.
    const screenParent = engine.addEntity();
    Transform.create(screenParent, {
        position: options.position,
        rotation: options.rotation,
        scale: options.scale
    });

    // --- The Math Function: The Heart of the Curve ---
    /**
     * Calculates the transform for a segment to place it along a parabolic curve.
     * @param segmentIndex The index of the segment we're placing.
     * @returns The position, rotation, and angle for the segment.
     */
    function calculateSegmentTransform(segmentIndex: number) {
        // Calculate the horizontal position (x) for this segment, from left to right.
        const x = -screenWidth / 2 + (segmentIndex + 0.5) * (screenWidth / totalSegments);

        // This is the parabolic formula. It calculates the depth (z) based on the
        // horizontal position (x) and the curveFactor. When x is 0 (the center), z is 0.
        // As x moves towards the edges, z increases, pulling the segments back.
        const z = curveFactor * (x / screenWidth) * (x / screenWidth) * screenWidth;

        // To make the screen seamless, we need to rotate each segment to face the center.
        // We calculate the tangent of the curve at this point (the derivative).
        const derivative = 2 * curveFactor * x / screenWidth;
        // Then we use arctangent to convert that slope into an angle in radians.
        const angle = Math.atan(derivative);
        
        // The SDK uses Quaternions for rotation, which often work with degrees.
        const rotationY = -angle * (180 / Math.PI);

        return {
            position: Vector3.create(x, 0, z),
            rotation: Quaternion.fromEulerDegrees(0, rotationY, 0),
            angle: angle // We need this angle later to fix gaps.
        };
    }

    // --- The Creation Loop: Building the Screen ---
    // This is where we execute our "recipe" `totalSegments` times.
    for (let i = 0; i < totalSegments; i++) {
        const segmentEntity = engine.addEntity();
        
        // Get the calculated position and rotation for this segment.
        const { position, rotation, angle } = calculateSegmentTransform(i);

        // A small but crucial detail: as we rotate the segments, tiny triangular gaps
        // appear between them. We can close these gaps by making each segment slightly
        // wider using trigonometry (the cosine of the segment's angle).
        const adjustedWidth = (screenWidth / totalSegments) / Math.cos(angle);

        Transform.create(segmentEntity, {
            parent: screenParent, // Make it a child of our main parent.
            position: position,
            rotation: rotation,
            scale: Vector3.create(adjustedWidth, screenHeight, 0.1)
        });

        // Assign a box shape to our entity and apply the correct UV map for this segment.
        MeshRenderer.setBox(segmentEntity, setUVsForSegment(i, totalSegments));
        
        // Apply the video material provided by the user.
        // We set roughness to 1 and specular to 0 to prevent reflections.
        // We use the video as an "emissive" texture, making it glow like a real screen.
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
    // Finally, we return the parent entity so it can be used elsewhere if needed.
    return screenParent;
}
