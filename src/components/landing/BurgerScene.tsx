import * as React from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Group, Material } from "three";
import { ACESFilmicToneMapping, MathUtils, SRGBColorSpace } from "three";

type Profile = "desktop" | "tablet" | "mobile";

type BurgerModelProps = {
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
  activeRef: React.MutableRefObject<boolean>;
  reduceMotion: boolean;
  profile: Profile;
};

type LoadedGltf = {
  scene: Group;
};

type StandardishMaterial = Material & {
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  needsUpdate?: boolean;
};

function tuneMainMaterial(material: StandardishMaterial) {
  if (typeof material.roughness === "number") {
    material.roughness = Math.max(0.2, material.roughness * 0.84);
  }
  if (typeof material.metalness === "number") {
    material.metalness = Math.min(0.14, material.metalness);
  }
  if (typeof material.envMapIntensity === "number") {
    material.envMapIntensity = Math.max(0.96, material.envMapIntensity);
  }
  material.needsUpdate = true;
}

function cloneSceneForUse(scene: Group) {
  const main = scene.clone(true);
  main.traverse((node) => {
    const mesh = node as {
      isMesh?: boolean;
      material?: unknown;
      castShadow?: boolean;
      receiveShadow?: boolean;
    };
    if (!mesh.isMesh || !mesh.material) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const nextMaterials = materials.map((item) => {
      const next = (item as StandardishMaterial).clone() as StandardishMaterial;
      tuneMainMaterial(next);
      return next;
    });
    mesh.material = Array.isArray(mesh.material) ? nextMaterials : nextMaterials[0];
  });
  return main;
}

function BurgerModel({ pointerRef, activeRef, reduceMotion, profile }: BurgerModelProps) {
  const gltf = useLoader(GLTFLoader, "/burger.glb") as LoadedGltf;
  const primaryRef = React.useRef<Group | null>(null);
  const scene = React.useMemo(() => cloneSceneForUse(gltf.scene), [gltf.scene]);

  const targetScale = profile === "desktop" ? 1.78 : profile === "tablet" ? 1.62 : 1.38;
  const baseY = profile === "mobile" ? -0.04 : -0.01;

  useFrame((state, delta) => {
    const primary = primaryRef.current;
    if (!primary) return;

    const pointerMagnitude = Math.hypot(pointerRef.current.x, pointerRef.current.y);
    const interactionBlend = MathUtils.clamp(pointerMagnitude * 2.1, 0, 1);
    const activeBoost = activeRef.current ? 1 : 0;

    const idleAmplitudeBase = profile === "mobile" ? 0.012 : 0.022;
    const idleAmplitude = idleAmplitudeBase * (1 - interactionBlend * 0.68);
    const idleY = reduceMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.28) * idleAmplitude;

    const pointerInfluence = profile === "desktop" ? 0.17 : profile === "tablet" ? 0.12 : 0.07;
    const restYaw = 0.08;
    const targetRotY = restYaw + idleY + pointerRef.current.x * pointerInfluence;
    const targetRotX = -0.02 + pointerRef.current.y * pointerInfluence * 0.64;

    primary.rotation.y = MathUtils.lerp(primary.rotation.y, targetRotY, 0.075);
    primary.rotation.x = MathUtils.lerp(primary.rotation.x, targetRotX, 0.075);
    primary.scale.setScalar(
      MathUtils.lerp(primary.scale.x, targetScale + activeBoost * 0.04 + interactionBlend * 0.03, 0.08)
    );
    primary.position.y = MathUtils.lerp(primary.position.y, baseY + activeBoost * 0.015, 0.08);

    if (!reduceMotion) {
      const spin = profile === "mobile" ? 0.014 : 0.021;
      primary.rotation.y += delta * spin * (1 - interactionBlend * 0.5);
    }
  });

  return (
    <group ref={primaryRef} position={[0, baseY, 0]} scale={1.65}>
      <primitive object={scene} />
    </group>
  );
}

export function BurgerScene() {
  const pointerRef = React.useRef({ x: 0, y: 0 });
  const activeRef = React.useRef(false);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [profile, setProfile] = React.useState<Profile>("desktop");
  const [dprMax, setDprMax] = React.useState(1.2);
  const [canInteract, setCanInteract] = React.useState(true);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  React.useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const finePointer = window.matchMedia("(pointer: fine)").matches;
      if (width >= 1200) {
        setProfile("desktop");
        setDprMax(1.2);
      } else if (width >= 768) {
        setProfile("tablet");
        setDprMax(1.1);
      } else {
        setProfile("mobile");
        setDprMax(1);
      }
      setCanInteract(finePointer && width >= 768);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (reduceMotion || !canInteract) return;
      activeRef.current = true;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * -2;
      pointerRef.current = {
        x: MathUtils.clamp(x, -0.55, 0.55),
        y: MathUtils.clamp(y, -0.45, 0.45),
      };
    },
    [canInteract, reduceMotion]
  );

  const handlePointerLeave = React.useCallback(() => {
    activeRef.current = false;
    pointerRef.current = { x: 0, y: 0 };
  }, []);

  return (
    <div className="relative h-full w-full" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
      <Canvas
        camera={{ position: [0, profile === "mobile" ? 0.34 : 0.42, 3.28], fov: profile === "mobile" ? 34 : 32 }}
        dpr={[1, dprMax]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.96;
          gl.outputColorSpace = SRGBColorSpace;
        }}
      >
        <ambientLight intensity={0.44} color="#fff5ea" />
        <hemisphereLight intensity={0.34} color="#fff5ea" groundColor="#1a120f" />
        <directionalLight position={[3.0, 4.1, 2.8]} intensity={0.94} color="#ffe7d2" />
        <spotLight
          position={[-2.1, 2.7, 2.4]}
          intensity={0.5}
          angle={0.46}
          penumbra={0.82}
          color="#ff9a5e"
          distance={10}
        />
        <pointLight position={[1.4, 0.45, -1.8]} intensity={0.2} color="#ffd9c1" />
        <pointLight position={[0, 0.5, 2.0]} intensity={0.22} color="#ff8b3f" />

        <BurgerModel pointerRef={pointerRef} activeRef={activeRef} reduceMotion={reduceMotion} profile={profile} />
      </Canvas>
    </div>
  );
}
