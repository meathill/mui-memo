import { ImageResponse } from 'next/og';
import { ShareImage } from '@/components/marketing/share-image';
import { SHARE_IMAGE_ALT } from '@/lib/site';

export const alt = SHARE_IMAGE_ALT;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(<ShareImage />, size);
}
