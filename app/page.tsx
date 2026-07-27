import { redirect } from 'next/navigation';
import { SELF_SLUG } from '@/lib/sites';

export default function Home() {
  redirect(`/${SELF_SLUG}`);
}
