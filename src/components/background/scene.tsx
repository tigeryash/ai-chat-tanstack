import { PerspectiveCamera, shaderMaterial } from "@react-three/drei";
import { Canvas, extend, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import fragmentShader from "@/shaders/fragment.glsl";
import vertexShader from "@/shaders/vertex.glsl";

type Uniforms = {
	uTime: number;
	color: THREE.Color;
};

const WaveMaterial = shaderMaterial(
	{
		uTime: 0,
		uColors: [
			new THREE.Color("#0f172a"), // Dark Slate
			new THREE.Color("#BD285E"), // Blue
			new THREE.Color("#600F75"), // Violet
			new THREE.Color("#DB041C"), // Cyan
			new THREE.Color("#6E343B"), // Pink
		],
	},
	vertexShader,
	fragmentShader,
);

extend({ WaveMaterial });

declare module "@react-three/fiber" {
	interface ThreeElements {
		waveMaterial: {
			ref?: React.Ref<THREE.ShaderMaterial & Uniforms>;
			uTime?: number;
			color?: THREE.Color;
		};
	}
}

const WaveMesh = () => {
	const ref = useRef<THREE.ShaderMaterial & Uniforms>(null);

	useFrame((state) => {
		if (ref.current) {
			ref.current.uTime = state.clock.elapsedTime;
		}
	});

	return (
		<mesh rotation={[-0.86, 0, 0]} position={[0, 0, -2]}>
			<planeGeometry args={[10, 10, 180, 180]} />
			<waveMaterial color={new THREE.Color("blue")} ref={ref} uTime={0} />
		</mesh>
	);
};

const Scene = () => {
	return (
		<div className="absolute z-0 inset-3 rounded-2xl m-0 p-0">
			<Canvas
				// camera={{ position: [0, 0, cameraPosition], fov: 45 }}
				style={{
					margin: 0,
					padding: 0,
					width: "100%",
					height: "100%",
					borderRadius: "20px",
				}}
			>
				<PerspectiveCamera
					makeDefault
					position={[0, -0.4, 0.2]}
					rotation={[0.09, 0, 0]}
				/>

				<color attach="background" args={["#000"]} />

				<ambientLight intensity={1} />
				<WaveMesh />
			</Canvas>
		</div>
	);
};

export default Scene;
