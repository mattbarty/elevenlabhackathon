import { NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
	auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
	try {
		const { description } = await request.json();

		if (!description) {
			return NextResponse.json(
				{ error: 'Description is required' },
				{ status: 400 }
			);
		}

		const output = await replicate.run(
			'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
			{
				input: {
					prompt: `${description}, medieval fantasy style, detailed craftsmanship, intricate details, metallic, realistic, professional product photography, dark background`,
					width: 768,
					height: 768,
					refine: 'expert_ensemble_refiner',
					scheduler: 'K_EULER',
					lora_scale: 0.6,
					num_outputs: 1,
					guidance_scale: 7.5,
					apply_watermark: false,
					high_noise_frac: 0.8,
					negative_prompt:
						'blurry, low quality, distorted, deformed, ugly, bad anatomy',
					prompt_strength: 0.8,
					num_inference_steps: 25,
				},
			}
		);

		console.log('Output:', output);

		// The output should be an array with the generated image URL
		if (Array.isArray(output) && output.length > 0) {
			return NextResponse.json({ imageUrl: output[0] });
		} else {
			throw new Error('No image URL in response');
		}
	} catch (error) {
		console.error('Image generation error:', error);
		return NextResponse.json(
			{ error: 'Failed to generate image' },
			{ status: 500 }
		);
	}
}
