'use client'

import dynamic from 'next/dynamic';

const FluidGradientCanvas = dynamic(
  () => import('@/components/FluidGradientCanvas'),
  { ssr: false }
);

export default function HeroCanvas() {
  return <FluidGradientCanvas />;
}
